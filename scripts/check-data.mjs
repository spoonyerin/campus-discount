// 데이터·미디어 점검 스크립트 (Node 내장 기능만 사용, 의존성 없음)
// 실행: node scripts/check-data.mjs
// 출력: 스키마 오류, 종료·종료 임박(7일 이내) 혜택, 미확인 항목, 미디어 파일 유무, 사이트 용량
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  validateBenefits, computeStatus, endingSoonLabel, uncheckedItems, formatValidity,
} from '../js/data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(ROOT, p);
let problems = 0;

function section(title) { console.log(`\n=== ${title} ===`); }

// 1) 스키마
section('스키마 검증');
let list;
try {
  list = JSON.parse(fs.readFileSync(rel('data/benefits.json'), 'utf8'));
} catch (e) {
  console.error('benefits.json을 읽거나 해석할 수 없습니다:', e.message);
  process.exit(1);
}
const { valid, errors, warnings } = validateBenefits(list);
console.log(`전체 ${Array.isArray(list) ? list.length : 0}건 / 유효 ${valid.length}건`);
errors.forEach((e) => { problems++; console.log('  [오류]', e); });
warnings.forEach((w) => console.log('  [경고]', w));
if (!errors.length) console.log('  스키마 위반 없음');

// 2) 상태
section('상태 (오늘 기준)');
const now = new Date();
for (const b of valid) {
  const status = computeStatus(b, now);
  const soon = endingSoonLabel(b, now);
  const label = { expired: '종료', upcoming: '시작 전', needsCheck: '추가 확인 필요', ok: '정상' }[status];
  let extra = formatValidity(b.validity) || (b.validity && b.validity.note) || '기간 정보 없음';
  if (soon) extra += ` · ⚠ ${soon}`;
  console.log(`  ${b.sourceNo} ${b.name} — ${label} (${extra}) · 마지막 확인 ${b.lastCheckedAt}`);
  // 연도 미확정이지만 종료 월·일이 7일 이내로 다가온 경우도 알려 준다
  if (b.validity && b.validity.year == null && b.validity.end) {
    const [m, d] = b.validity.end.split('-').map(Number);
    const end = new Date(now.getFullYear(), m - 1, d);
    const diff = Math.round((end - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    if (diff >= 0 && diff <= 7) console.log(`      ⚠ 올해 기준이라면 종료일(${m}/${d})까지 ${diff}일 — 연장 여부 확인 필요`);
    else if (diff >= 0 && diff <= 30) console.log(`      ⓘ 올해 기준이라면 종료일(${m}/${d})까지 ${diff}일 — 연도·연장 여부 확인 필요`);
  }
}

// 3) 미확인 항목
section('추가 확인이 필요한 항목');
for (const b of valid) {
  const items = uncheckedItems(b, now);
  if (!items.length) continue;
  console.log(`  ${b.sourceNo} ${b.name}`);
  items.forEach((i) => console.log(`    - ${i}`));
}

// 4) 미디어 연결 (혜택 ID ↔ 이미지·음성 파일)
section('미디어 파일');
const mediaRows = [];
// 자동 생성한 임시 파일 목록(scripts/media/make-media.py). 같은 경로에 팀 파일을 덮어쓰면 해시가 달라져 '팀 제작'으로 보인다.
const tempList = fs.existsSync(rel('assets/temp-media.json')) ? JSON.parse(fs.readFileSync(rel('assets/temp-media.json'), 'utf8')) : {};
const kind = (p) => {
  const t = tempList[p];
  if (!t) return '팀 제작';
  const hash = crypto.createHash('sha256').update(fs.readFileSync(rel(p))).digest('hex');
  return hash === t.sha256 ? '임시' : '팀 제작';
};
for (const b of valid) {
  for (const key of ['image', 'audio']) {
    const p = b.media && b.media[key];
    if (!p) { mediaRows.push([b.id, key, '(경로 없음)', '-']); continue; }
    const expected = key === 'image' ? `assets/img/benefits/${b.id}.webp` : `assets/audio/${b.id}.mp3`;
    if (p !== expected) console.log(`  [경고] ${b.id} media.${key} 경로가 규칙(${expected})과 다릅니다: ${p}`);
    const exists = fs.existsSync(rel(p));
    let size = '-';
    if (exists) {
      const kb = fs.statSync(rel(p)).size / 1024;
      size = `${kb.toFixed(0)}KB`;
      if (key === 'image' && kb > 150) console.log(`  [경고] ${p}가 150KB를 넘습니다 (${size})`);
    }
    mediaRows.push([b.id, key, p, exists ? `있음(${kind(p)}) ${size}` : '없음(대체 UI 표시)']);
  }
}
for (const p of ['assets/video/intro.mp4', 'assets/video/intro-poster.webp', 'assets/video/intro.ko.vtt',
  'assets/img/og.webp', ...[1, 2, 3, 4].map((n) => `assets/img/scenes/scene-${n}.webp`)]) {
  const exists = fs.existsSync(rel(p));
  const size = exists ? `${(fs.statSync(rel(p)).size / 1024 / 1024).toFixed(2)}MB` : '';
  mediaRows.push(['(공통)', path.extname(p).slice(1), p, exists ? `있음(${kind(p)}) ${size}` : '없음(대체 UI 표시)']);
  if (p.endsWith('.mp4') && exists && fs.statSync(rel(p)).size > 10 * 1024 * 1024) console.log(`  [경고] ${p}가 10MB 목표를 넘습니다`);
}
mediaRows.forEach((r) => console.log('  ' + r.join(' | ')));
const tempCount = mediaRows.filter((r) => String(r[3]).startsWith('있음(임시)')).length;
if (tempCount) console.log(`  ⓘ 임시 미디어 ${tempCount}개 — 같은 경로에 팀 파일을 덮어쓰면 교체됩니다 (assets/README.md)`);

// 5) 사이트 용량 (배포 대상 파일만)
section('사이트 용량');
const IGNORE = new Set(['.git', 'design', 'node_modules']);
let total = 0; let biggest = { p: '', s: 0 };
(function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else {
      const s = fs.statSync(full).size;
      total += s;
      if (s > biggest.s) biggest = { p: path.relative(ROOT, full), s };
      if (s >= 100 * 1024 * 1024) { problems++; console.log(`  [오류] 100MB 이상 파일: ${full}`); }
    }
  }
})(ROOT);
console.log(`  합계 ${(total / 1024 / 1024).toFixed(2)}MB (목표 50MB 이하) · 가장 큰 파일 ${biggest.p} ${(biggest.s / 1024).toFixed(0)}KB`);
if (total > 50 * 1024 * 1024) console.log('  [경고] 목표 용량 50MB를 넘었습니다');

console.log(problems ? `\n문제 ${problems}건 발견` : '\n문제 없음');
process.exit(problems ? 1 : 0);
