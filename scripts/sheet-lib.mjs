// 구글 시트(CSV) 한 행 → benefits.json 항목 변환 규칙 (Node 내장 기능만 사용, 파일·네트워크 접근 없음)
// scripts/sync-sheet.mjs와 scripts/test-logic.mjs가 함께 쓴다.

// 시트 열 이름 (첫 행 머리글과 같아야 한다)
export const COLUMNS = {
  name: '혜택 이름',
  category: '분야',
  summary: '한 줄 요약',
  discount: '핵심 혜택',
  target: '대상',
  howTo: '이용 방법',
  conditions: '조건',
  exceptions: '제외·유의사항',
  start: '시작일',
  end: '종료일',
  year: "연도(공지에 없으면 '없음')",
  locations: '장소',
  apply: '신청·공식 링크',
  contact: '문의처',
  source: '출처 링크',
  owner: '게시한 곳',
  postedAt: '공지 게시일',
  checkedAt: '확인한 날',
  unverified: '확인 안 되는 것',
  keywords: '검색 별칭',
};

// 분야 이름 통일: '/'를 '·'로 바꾸고 아래 이름으로 맞춘다. 목록에 없는 분야는 경고 후 그대로 쓴다.
export const CATEGORIES = ['음식점', '카페·디저트', '생활·쇼핑', '문화·여가', '의료·건강', '어학·시험', '디지털·구독'];

// ----- CSV -----

/** RFC 4180 CSV 파서 (따옴표 안 쉼표·줄바꿈·"" 처리) → 객체 배열 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [head = [], ...body] = rows;
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

// ----- 값 정리 -----

/** 탭·연속 공백 정리 */
export function clean(s) {
  return String(s ?? '').replace(/[\t ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** '?', '없음', '원문에 ~ 없음' 같은 "값 없음" 표기인가 */
export function isBlank(s) {
  const t = clean(s);
  return t === '' || /^[?？-]+$/.test(t) || /^없음/.test(t) || /^원문에.*없음/.test(t);
}

/** 세미콜론으로 나눈 목록. 빈 값·"값 없음" 표기는 버린다. */
export function splitList(s) {
  if (isBlank(s)) return [];
  return clean(s).split(/\s*;\s*/).map(clean).filter((t) => t && !isBlank(t));
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * 날짜 표기 해석. 지원: 2026-11-20, 2026.11.22, 2026. 8. 14, 11월 21일, 7월 31일(2027년), 12/31, 2026-03(월까지)
 * @returns {{year:number|null, month:number, day:number|null}|null}
 */
export function parseDate(s) {
  const t = clean(s);
  if (isBlank(t)) return null;
  let m = t.match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\.?$/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3] };
  m = t.match(/^(\d{4})\s*[-./]\s*(\d{1,2})\.?$/);
  if (m) return { year: +m[1], month: +m[2], day: null };
  m = t.match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*\(\s*(\d{4})\s*년?\s*\))?/);
  if (m) return { year: m[3] ? +m[3] : null, month: +m[1], day: +m[2] };
  m = t.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (m) return { year: null, month: +m[1], day: +m[2] };
  return null;
}

const validMd = (d) => d && d.day && d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= 31;
const toMmdd = (d) => `${pad(d.month)}-${pad(d.day)}`;
const toIso = (d, fallbackYear) => `${d.year ?? fallbackYear}-${pad(d.month)}-${pad(d.day)}`;

/** 추적용 쿼리 제거. 인스타그램은 몇 번째 사진인지(img_index)만 남긴다. */
export function cleanUrl(s) {
  const t = clean(s);
  let u;
  try { u = new URL(t); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const keep = /(^|\.)instagram\.com$/.test(u.hostname) ? ['img_index'] : null;
  for (const k of [...u.searchParams.keys()]) {
    if (keep ? !keep.includes(k) : /^utm_/i.test(k)) u.searchParams.delete(k);
  }
  return u.toString();
}

const PHONE_RE = /(0\d{1,2}-\d{3,4}-\d{4})/;

/** 문의처: 전화번호가 있으면 첫 번호를 tel로, 원문 표기는 label로 */
export function parseContact(s) {
  if (isBlank(s)) return null;
  const label = clean(s);
  const m = label.match(PHONE_RE);
  return { label, tel: m ? m[1] : null };
}

/** 장소: ';' 또는 ' / '로 나누고, "이름: 주소" / "이름 — 주소" 형태면 이름을 분리 */
export function parseLocations(s) {
  if (isBlank(s)) return [];
  return clean(s).split(/\s*;\s*|\s+\/\s+/).filter(Boolean).map((part) => {
    const m = part.match(/^([^:—]{1,20}?)\s*(?::|—)\s*(.+)$/);
    return m ? { label: m[1].trim(), address: m[2].trim() } : { label: '', address: part };
  });
}

/** 캠퍼스 한정 여부: 대상·조건에 특정 캠퍼스만 적혀 있을 때만 정한다 (게시한 곳은 보지 않음). */
export function detectCampus(text) {
  const hssc = /인사캠|인문사회과학캠퍼스/.test(text);
  const nsc = /자과캠|자연과학캠퍼스/.test(text);
  if (hssc && !nsc) return '인사캠';
  if (nsc && !hssc) return '자과캠';
  return null;
}

/** "확인 안 되는 것" 한 항목이 어느 필드에 해당하는지 (상세 '추가 확인 필요' 박스의 항목 이름) */
export function unverifiedField(text) {
  if (/시작일|종료일|기간|유효|진행 여부|가능 여부|운영|연도/.test(text)) return 'validity';
  if (/URL|링크/i.test(text)) return 'links';
  if (/문의/.test(text)) return 'contact';
  if (/할인|금액|가격|수강료|대여가|장학금|응시료|구성|지원 범위/.test(text)) return 'discount';
  if (/대상|가족|증빙|인원/.test(text)) return 'target';
  if (/장소|위치/.test(text)) return 'locations';
  if (/중복/.test(text)) return 'exceptions';
  return 'conditions';
}

export function normalizeCategory(s, warn) {
  const t = clean(s).replace(/\s*\/\s*/g, '·');
  if (!CATEGORIES.includes(t)) warn(`분야 '${t}'는 정해진 목록(${CATEGORIES.join(', ')})에 없습니다`);
  return t;
}

/**
 * 시트 한 행 → 혜택 항목. 이름이 비어 있으면 null.
 * @param {object} row  parseCsv 결과의 한 행
 * @param {{id:string, sourceNo:string}} ident  sheet-map.json에서 정한 id·번호
 * @param {{today:Date, warn:(msg:string)=>void}} opts
 */
export function rowToBenefit(row, ident, { today = new Date(), warn = () => {} } = {}) {
  const get = (key) => clean(row[COLUMNS[key]]);
  const name = get('name');
  if (!name) return null;
  const w = (msg) => warn(`${ident.sourceNo} ${name}: ${msg}`);
  const thisYear = today.getFullYear();

  // 출처 (필수)
  const source = cleanUrl(get('source'));
  if (!source) w(`출처 링크가 URL이 아닙니다: '${get('source')}'`);
  if (source && source !== get('source')) w('출처 링크의 추적용 쿼리를 지웠습니다');

  // 신청 링크: URL이면 링크, 글이면 이용 방법에 덧붙인다
  const howTo = splitList(get('howTo'));
  let apply = null;
  if (!isBlank(get('apply'))) {
    apply = cleanUrl(get('apply'));
    if (apply && apply !== get('apply')) w('신청 링크의 추적용 쿼리를 지웠습니다');
    if (!apply) howTo.push(`신청: ${get('apply')}`);
  }

  // 제외·유의사항: 다른 칸 내용이 쉼표로 붙어 들어온 경우(",없음..." 꼬리) 잘라 낸다
  const exceptions = splitList(get('exceptions')).map((t) => {
    const cut = t.replace(/,\s*없음.*$/, '');
    if (cut !== t) w(`제외·유의사항 끝의 '${t.slice(cut.length + 1)}'는 다른 칸 내용으로 보여 뺐습니다. 시트를 확인하세요`);
    return cut;
  }).filter(Boolean);

  // 기간
  const yearText = get('year');
  const yearCol = (yearText.match(/\d{4}/) || [])[0];
  const startD = parseDate(get('start'));
  const endD = parseDate(get('end'));
  const notes = [];
  for (const [label, key, d] of [['시작일', 'start', startD], ['종료일', 'end', endD]]) {
    const raw = get(key);
    if (!isBlank(raw) && !validMd(d)) notes.push(`${label}: ${raw}`);
  }
  let validity = null;
  const start = validMd(startD) ? toMmdd(startD) : null;
  const end = validMd(endD) ? toMmdd(endD) : null;
  if (start || end || notes.length) {
    let year = startD?.year ?? (yearCol ? +yearCol : null);
    if (year == null && endD?.year != null) {
      year = endD.year;
      if (start && end && end < start) year -= 1; // 해를 넘기는 기간: 종료 연도에서 1년 앞이 시작 연도
    }
    if (!start && !end) year = null;
    validity = { start, end, year };
    if (notes.length) validity.note = `원문 표기 — ${notes.join(' / ')}`;
  }

  // 확인 안 되는 것 → unverified (';' 또는 ','로 나눔)
  const unverified = isBlank(get('unverified')) ? [] : clean(get('unverified')).split(/\s*[;,]\s*/)
    .filter(Boolean).map((t) => ({ field: unverifiedField(t), message: `${t} 확인 필요` }));

  // 확인한 날 (연도 없이 적었으면 올해로 본다)
  const checked = parseDate(get('checkedAt'));
  let lastCheckedAt = validMd(checked) ? toIso(checked, thisYear) : null;
  if (!lastCheckedAt) w(`확인한 날 '${get('checkedAt')}'을 날짜로 읽지 못했습니다`);
  else if (checked.year == null) w(`확인한 날에 연도가 없어 ${thisYear}년으로 봤습니다`);

  const posted = parseDate(get('postedAt'));
  const postedAt = posted ? (posted.day ? toIso(posted, thisYear) : `${posted.year}-${pad(posted.month)}`) : null;

  const target = splitList(get('target'));
  const conditions = splitList(get('conditions'));
  const discountLabel = get('discount');
  const campus = detectCampus([...target, ...conditions].join(' '));

  return {
    id: ident.id,
    sourceNo: ident.sourceNo,
    origin: 'sheet',
    name,
    category: normalizeCategory(get('category'), w),
    campus,
    summary: get('summary') || discountLabel || name,
    keywords: isBlank(get('keywords')) ? [] : clean(get('keywords')).split(/\s*,\s*/).filter(Boolean),
    // 카드 칩: 짧은 조건 두 개까지 (원문 그대로)
    highlights: conditions.filter((t) => t.length <= 24).slice(0, 2),
    discount: discountLabel ? { label: discountLabel, percent: null } : null,
    target,
    howTo,
    conditions,
    exceptions,
    validity,
    unverified,
    locations: parseLocations(get('locations')),
    links: { official: null, apply, source },
    contact: parseContact(get('contact')),
    media: {
      image: `assets/img/benefits/${ident.id}.webp`,
      imageAlt: `${name} 안내 이미지`,
      audio: `assets/audio/${ident.id}.mp3`,
    },
    sourceOwner: get('owner') || null,
    postedAt,
    lastCheckedAt,
  };
}

/** 이름 비교용 키 (공백·기호·대소문자 무시) */
export function nameKey(s) {
  return clean(s).normalize('NFC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

/** 새 행에 붙일 id·번호: 기존 최대 번호 + 1, id는 benefit-<번호> */
export function nextIdent(map, existing) {
  const nums = [...map.map((m) => +m.sourceNo), ...existing.map((b) => +b.sourceNo)].filter(Number.isFinite);
  const no = String(Math.max(0, ...nums) + 1).padStart(3, '0');
  return { id: `benefit-${no}`, sourceNo: no };
}
