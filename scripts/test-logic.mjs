// 검색·기간 처리 시험 스크립트 (Node 내장 기능만 사용, 의존성 없음)
// 실행: node scripts/test-logic.mjs
// 기준일을 고정해 실행하므로 언제 실행해도 같은 결과가 나온다.
// 실제 데이터(benefits.json)는 시트 동기화로 계속 바뀌므로, 코드 시험은 고정된 시험용 사본
// scripts/fixtures/benefits-sample.json(혜택 3건)으로 한다. 시험 중 바꾼 값은 메모리에서만 바꾼다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lib from '../js/data.js';
import * as sheet from './sheet-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/fixtures/benefits-sample.json'), 'utf8'));
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

console.log('\n[6] 분야 순서·캠퍼스 필터');
const multi = [
  { ...data[1], id: 'c1', category: '디지털·구독', campus: null },
  { ...data[1], id: 'c2', category: '음식점', campus: '인사캠' },
  { ...data[1], id: 'c3', category: '시험용 분야', campus: '자과캠' },
  { ...data[1], id: 'c4', category: '카페·디저트', campus: null },
];
check('C1', '분야 순서: 정해진 순서 → 목록 밖 분야는 뒤', lib.getCategories(multi).map((c) => c.name), ['음식점', '카페·디저트', '디지털·구독', '시험용 분야']);
const campus = (c) => multi.filter((b) => lib.matchesCampus(b, c)).map((b) => b.id);
check('C2', '인사캠 → 공통 + 인사캠 한정', campus('인사캠'), ['c1', 'c2', 'c4']);
check('C3', '자과캠 → 공통 + 자과캠 한정', campus('자과캠'), ['c1', 'c3', 'c4']);
check('C4', '전체 → 모두', campus('전체').length, 4);
check('C5', 'campus 값이 잘못되면 스키마 오류', lib.validateBenefits([{ ...data[1], campus: '율전' }]).errors.length > 0, true);

console.log('\n[7] 시트 변환 규칙 (시험용 행)');
const head = Object.values(sheet.COLUMNS);
const csvRow = (o) => head.map((h) => `"${String(o[h] ?? '').replace(/"/g, '""')}"`).join(',');
const csv = `${head.join(',')}\n${csvRow({
  '혜택 이름': '시험용 카페', '분야': '\t카페/디저트', '한 줄 요약': '음료 10% 할인', '핵심 혜택': '음료 10% 할인',
  '대상': '성균관대학교 자연과학캠퍼스 학생', '이용 방법': '학생증 제시; 앱 쿠폰, 매장 결제', '조건': '평일만',
  '제외·유의사항': '중복 불가,없음,없음(상시)', '시작일': '원문에 시작일 없음', '종료일': '7월 31일(2027년)',
  "연도(공지에 없으면 '없음')": '없음', '장소': '본점: 서울 종로구 1; 분점 — 수원시 2', '신청·공식 링크': '현장 결제(별도 링크 없음)',
  '문의처': '본점 02-111-2222 / 분점 031-333-4444', '출처 링크': 'https://www.instagram.com/p/ABC/?img_index=3&utm_source=x&dmpr=y',
  '게시한 곳': '시험용', '공지 게시일': '2026-03', '확인한 날': '11월 21일', '확인 안 되는 것': '시작일, 할인 금액; 문의처', '검색 별칭': '카페, 커피',
})}\n${csvRow({ '혜택 이름': '' })}\n`;
const rows = sheet.parseCsv(csv);
check('V1', 'CSV 2행 읽기(빈 행 포함)', rows.length, 2);
const warns = [];
const v = sheet.rowToBenefit(rows[0], { id: 'test-cafe', sourceNo: '999' }, { today: day('2026-11-26'), warn: (m) => warns.push(m) });
check('V2', '분야 탭 제거·"/" → "·"', v.category, '카페·디저트');
check('V3', '인스타그램 링크는 img_index만 남김', v.links.source, 'https://www.instagram.com/p/ABC/?img_index=3');
check('V4', '"7월 31일(2027년)", 시작일 없음 → 종료 07-31·연도 2027', v.validity, { start: null, end: '07-31', year: 2027 });
check('V5', '연도 없는 확인일은 올해로', v.lastCheckedAt, '2026-11-21');
check('V6', '자연과학캠퍼스 대상 → 자과캠 한정', v.campus, '자과캠');
check('V7', '링크가 아닌 신청 안내는 이용 방법에 추가', v.howTo, ['학생증 제시', '앱 쿠폰, 매장 결제', '신청: 현장 결제(별도 링크 없음)']);
check('V8', '다른 칸이 섞인 ",없음…" 꼬리 제거 + 경고', [v.exceptions, warns.some((m) => m.includes('다른 칸'))], [['중복 불가'], true]);
check('V9', '장소 "이름: 주소"·"이름 — 주소" 분리', v.locations, [{ label: '본점', address: '서울 종로구 1' }, { label: '분점', address: '수원시 2' }]);
check('V10', '문의처 첫 전화번호를 tel로', v.contact.tel, '02-111-2222');
check('V11', '확인 안 되는 것 → 항목별 unverified', v.unverified.map((u) => u.field), ['validity', 'discount', 'contact']);
check('V12', '변환 결과가 스키마 검증 통과', lib.validateBenefits([v]).errors, []);
check('V13', '"?"·"없음"은 빈 값, 연도 숫자는 값', [sheet.isBlank('?'), sheet.isBlank('없음(상시)'), sheet.isBlank('2026')], [true, true, false]);
check('V14', '날짜 표기 여러 형식', ['2026. 8. 14', '2026.11.22', '12/31', '2026-03'].map((s) => sheet.parseDate(s)),
  [{ year: 2026, month: 8, day: 14 }, { year: 2026, month: 11, day: 22 }, { year: null, month: 12, day: 31 }, { year: 2026, month: 3, day: null }]);

console.log('\n[8] 기간 표시 문구');
check('P1', '시작일 없이 종료일만 → "~ 2026. 12. 31.까지"', lib.formatValidity({ start: null, end: '12-31', year: 2026 }), '~ 2026. 12. 31.까지');
check('P2', '연도·시작일 없음 → "제휴 기간 ~ 11/30까지 · 연도 확인 필요"', lib.formatValidity({ start: null, end: '11-30', year: null }), '제휴 기간 ~ 11/30까지 · 연도 확인 필요');

console.log(`\n합계: 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
