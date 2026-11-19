// 검색·기간 처리 시험 스크립트 (Node 내장 기능만 사용, 의존성 없음)
// 실행: node scripts/test-logic.mjs
// 기준일을 고정해 실행하므로 언제 실행해도 같은 결과가 나온다.
// 시험용 자료는 benefits.json을 메모리에서 복사해 바꾼 것이며 파일은 바꾸지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lib from '../js/data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/benefits.json'), 'utf8'));
const has = (fn) => typeof lib[fn] === 'function';

// 검색어 → 결과 id 목록
const search = (q, list = data) => list.filter((b) => lib.matchesQuery(b, q)).map((b) => b.id);
const day = (s) => new Date(`${s}T12:00:00`);

let pass = 0; let fail = 0;
function check(no, title, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${no} ${title}`);
  if (!ok) console.log(`     기대: ${JSON.stringify(expected)}\n     실제: ${JSON.stringify(actual)}`);
}

console.log('[1] 검색 정규화 (공백·대소문자·기호)');
check('S1', '"TOEIC" → TOEIC 1건 (기존 동작 유지)', search('TOEIC'), ['toeic-speaking']);
check('S2', '"어학시험" → 어학·시험 분야 1건', search('어학시험'), ['toeic-speaking']);
check('S3', '"의료 건강" → 의료·건강 분야 1건', search('의료 건강'), ['balgeun-eye-clinic']);
check('S4', '"헬스장" → 0건', search('헬스장'), []);

console.log('\n[2] 별칭·대상 검색');
check('K1', '"토익" → TOEIC 1건', search('토익'), ['toeic-speaking']);
check('K2', '"토스" → TOEIC 1건', search('토스'), ['toeic-speaking']);
check('K3', '"시력교정" → 안과 1건', search('시력교정'), ['balgeun-eye-clinic']);
check('K4', '"대학원생" → TOEIC 1건', search('대학원생'), ['toeic-speaking']);
check('K5', '"skku pass" → SKKUPASS 제휴(훠궈) 1건', search('skku pass'), ['yonggah-hotpot']);

console.log('\n[3] 종료 임박 표시 (훠궈 종료일 2026-11-30)');
const hotpot = data.find((b) => b.id === 'yonggah-hotpot');
const soon = (d) => (has('endingSoonLabel') ? lib.endingSoonLabel(hotpot, day(d)) : '(함수 없음)');
check('D1', '11-20 → 표시 없음 (10일 전)', soon('2026-11-20'), null);
check('D2', '11-25 → "종료 5일 전"', soon('2026-11-25'), '종료 5일 전');
check('D3', '11-30 → "오늘 종료"', soon('2026-11-30'), '오늘 종료');
check('D4', '12-01 → 상태 expired', lib.computeStatus(hotpot, day('2026-12-01')), 'expired');

console.log('\n[4] 연도 미확인 기간 (시험용: 훠궈 validity.year = null)');
const noYear = structuredClone(hotpot);
noYear.validity.year = null;
const items = (d) => lib.uncheckedItems(noYear, day(d));
const passedMsg = (d) => items(d).some((t) => t.includes('종료일(11/30)이 지났'));
check('Y1', '12-05 → 자동 종료하지 않음 (needsCheck)', lib.computeStatus(noYear, day('2026-12-05')), 'needsCheck');
check('Y2', '12-05 → 추가 확인 목록에 "종료일 지남" 안내', passedMsg('2026-12-05'), true);
check('Y3', '11-20 → "종료일 지남" 안내 없음', passedMsg('2026-11-20'), false);

console.log('\n[5] 자료 추가 (시험용 4번째 혜택)');
const extra = { ...structuredClone(data[1]), id: 'test-extra', sourceNo: '999', name: '시험용 혜택', category: '시험용 분야', keywords: ['테스트'] };
const list4 = lib.validateBenefits([...data, extra]).valid;
check('A1', '추가 후 유효 4건', list4.length, 4);
check('A2', '분야 목록에 "시험용 분야" 생성', lib.getCategories(list4).map((c) => c.name).includes('시험용 분야'), true);
check('A3', '"테스트" 검색 → 추가한 혜택 1건', search('테스트', list4), ['test-extra']);
const badKw = lib.validateBenefits([{ ...extra, id: 'bad-kw', keywords: '토익' }]);
check('A4', 'keywords가 배열이 아니면 스키마 오류', badKw.errors.length > 0, true);

console.log(`\n합계: 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
