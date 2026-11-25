// 구글 시트 → data/benefits.json 동기화 (Node 18 이상 내장 기능만 사용, 의존성 없음)
//
// 실행:  node scripts/sync-sheet.mjs            시트를 내려받아 benefits.json을 다시 만든다
//        node scripts/sync-sheet.mjs --dry-run  결과만 출력하고 파일은 바꾸지 않는다
//        node scripts/sync-sheet.mjs --file 시트.csv   내려받은 CSV 파일로 실행
//
// - 시트는 "링크가 있는 모든 사용자: 보기" 공유 상태여야 내려받을 수 있다.
// - 시트 행마다 id·근거 번호는 data/sheet-map.json에 고정해 둔다(행 순서가 바뀌어도 번호 유지).
//   새 행은 자동으로 다음 번호와 benefit-<번호> id를 받는다. 혜택 이름을 바꾸면 새 행으로 취급하니 주의.
// - 시트에 없는 기존 항목(origin이 'sheet'가 아닌 것, 예: 001 훠궈·002 TOEIC)은 그대로 둔다.
// - 이미지 대체 텍스트·음성 대본(media.imageAlt, media.audioScript)은 JSON에 직접 쓴 값을 유지한다.
// - 스키마 오류가 있으면 파일을 쓰지 않고 종료 코드 1로 끝난다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBenefits } from '../js/data.js';
import { parseCsv, rowToBenefit, nameKey, nextIdent, COLUMNS } from './sheet-lib.mjs';

const SHEET_ID = '163k8Bh5qnz6pPGRP0ZvIk3OUeWuIdM2AmV6yDtxL5WQ';
const SHEET_GID = '510695126';
const SHEET_CSV_URL = process.env.SHEET_CSV_URL
  || `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data/benefits.json');
const MAP = path.join(ROOT, 'data/sheet-map.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;

async function readSheet() {
  if (fileArg) return fs.readFileSync(fileArg, 'utf8');
  const res = await fetch(SHEET_CSV_URL, { redirect: 'follow' });
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.includes('text/csv')) {
    throw new Error(`시트를 CSV로 받지 못했습니다 (HTTP ${res.status}, ${type}). 시트 공유가 "링크가 있는 모든 사용자: 보기"인지 확인하세요.`);
  }
  return res.text();
}

const warnings = [];
const warn = (m) => warnings.push(m);

const rows = parseCsv(await readSheet());
const missingCols = Object.values(COLUMNS).filter((c) => rows.length && !(c in rows[0]));
if (missingCols.length) {
  console.error(`시트 머리글이 바뀌었습니다. 없는 열: ${missingCols.join(', ')}`);
  process.exit(1);
}

const existing = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const map = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP, 'utf8')) : [];
const byKey = new Map(map.map((m) => [nameKey(m.name), m]));

const produced = [];
const seenKeys = new Set();
let skipped = 0;
const added = [];
for (const row of rows) {
  const name = (row[COLUMNS.name] || '').trim();
  if (!name) { skipped++; continue; }
  const key = nameKey(name);
  if (seenKeys.has(key)) { warn(`혜택 이름 '${name}'이 시트에 두 번 있습니다. 첫 행만 씁니다`); continue; }
  seenKeys.add(key);
  let ident = byKey.get(key);
  if (!ident) {
    ident = { name, ...nextIdent(map, existing) };
    map.push(ident);
    byKey.set(key, ident);
    added.push(`${ident.sourceNo} ${name} (id ${ident.id})`);
  }
  const b = rowToBenefit(row, ident, { warn });
  const prev = existing.find((x) => x.id === b.id);
  if (prev && prev.media) {
    // 사람이 직접 쓴 이미지 설명·음성 대본은 유지
    if (prev.media.imageAlt) b.media.imageAlt = prev.media.imageAlt;
    if (prev.media.audioScript) b.media.audioScript = prev.media.audioScript;
  }
  produced.push(b);
}

const producedIds = new Set(produced.map((b) => b.id));
const kept = existing.filter((b) => b.origin !== 'sheet' && !producedIds.has(b.id));
const removed = existing.filter((b) => b.origin === 'sheet' && !producedIds.has(b.id));
const next = [...kept, ...produced].sort((a, b) => String(a.sourceNo).localeCompare(String(b.sourceNo)));

const { valid, errors, warnings: schemaWarnings } = validateBenefits(next);

console.log(`시트 ${rows.length}행 → 혜택 ${produced.length}건 (빈 행 ${skipped}개 건너뜀)`);
console.log(`시트 밖 기존 항목 유지 ${kept.length}건: ${kept.map((b) => `${b.sourceNo} ${b.name}`).join(', ') || '없음'}`);
if (added.length) console.log(`새로 번호를 받은 항목 ${added.length}건:\n  ${added.join('\n  ')}`);
if (removed.length) console.log(`시트에서 빠져 삭제되는 항목 ${removed.length}건: ${removed.map((b) => `${b.sourceNo} ${b.name}`).join(', ')}`);
if (warnings.length || schemaWarnings.length) {
  console.log(`\n[확인할 점 ${warnings.length + schemaWarnings.length}건]`);
  [...warnings, ...schemaWarnings].forEach((m) => console.log(`  - ${m}`));
}
if (errors.length) {
  console.log(`\n[스키마 오류 ${errors.length}건 — 파일을 바꾸지 않았습니다]`);
  errors.forEach((e) => console.log(`  - ${e}`));
  process.exit(1);
}

const changed = JSON.stringify(next) !== JSON.stringify(existing);
if (dryRun) {
  console.log(`\n--dry-run: 파일을 바꾸지 않았습니다 (적용하면 ${changed ? '변경 있음' : '변경 없음'}, 유효 ${valid.length}건)`);
} else {
  fs.writeFileSync(DATA, `${JSON.stringify(next, null, 2)}\n`);
  fs.writeFileSync(MAP, `${JSON.stringify(map, null, 2)}\n`);
  console.log(`\n${changed ? 'data/benefits.json을 새로 썼습니다' : '변경 없음'} (유효 ${valid.length}건). 다음으로 node scripts/check-data.mjs를 실행하세요.`);
}
