// 데이터 로딩·검증·상태 계산
// DOM에 의존하지 않으므로 scripts/check-data.mjs(Node)에서도 그대로 import 한다.

export const DATA_URL = 'data/benefits.json';
export const MSG_UNKNOWN = '공식 자료에서 확인되지 않은 정보입니다';
export const MSG_NEEDS_CHECK = '추가 확인 필요';

export const REQUIRED_FIELDS = ['id', 'sourceNo', 'name', 'category', 'summary', 'links.source', 'lastCheckedAt'];

// 상세 화면에 표시하는 선택 필드와 이름 (값이 없으면 "확인되지 않은 정보"로 표시)
export const FIELD_LABELS = {
  discount: '핵심 혜택',
  target: '대상',
  howTo: '이용 방법',
  validity: '기간',
  'validity.year': '기간(연도)',
  conditions: '조건',
  exceptions: '제외·유의사항',
  locations: '장소',
  contact: '문의',
  status: '유효 여부',
};

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MMDD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function isHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * 스키마 검증. 필수 필드가 없거나 id가 중복된 항목은 화면에서 제외한다.
 * @returns {{ valid: object[], errors: string[], warnings: string[] }}
 */
export function validateBenefits(list) {
  const errors = [];
  const warnings = [];
  const valid = [];
  if (!Array.isArray(list)) {
    return { valid, errors: ['benefits.json의 최상위 값은 배열이어야 합니다.'], warnings };
  }
  const seen = new Set();
  list.forEach((b, i) => {
    const where = `[${i}] ${b && b.id ? b.id : '(id 없음)'}`;
    const itemErrors = [];
    if (!b || typeof b !== 'object') {
      errors.push(`${where}: 객체가 아닙니다.`);
      return;
    }
    for (const f of REQUIRED_FIELDS) {
      if (isEmpty(getPath(b, f))) itemErrors.push(`필수 필드 '${f}' 누락`);
    }
    if (b.id && !ID_RE.test(b.id)) itemErrors.push(`id '${b.id}'는 영문 소문자·숫자·하이픈만 사용해야 합니다`);
    if (b.id && seen.has(b.id)) itemErrors.push(`id '${b.id}' 중복`);
    if (b.lastCheckedAt && !DATE_RE.test(b.lastCheckedAt)) itemErrors.push(`lastCheckedAt은 YYYY-MM-DD 형식이어야 합니다`);

    for (const key of ['official', 'apply', 'source']) {
      const url = b.links ? b.links[key] : null;
      if (url != null && !isHttpUrl(url)) itemErrors.push(`links.${key} URL 형식 오류: ${url}`);
      if (url && /[?&]utm_/.test(url)) warnings.push(`${where}: links.${key}에 추적용 utm 쿼리가 남아 있습니다`);
    }

    const v = b.validity;
    if (v != null) {
      if (v.start != null && !MMDD_RE.test(v.start)) itemErrors.push(`validity.start는 MM-DD 형식이어야 합니다`);
      if (v.end != null && !MMDD_RE.test(v.end)) itemErrors.push(`validity.end는 MM-DD 형식이어야 합니다`);
      if (v.year != null && !Number.isInteger(v.year)) itemErrors.push(`validity.year는 정수 또는 null이어야 합니다`);
    }
    if (b.discount && b.discount.percent != null && typeof b.discount.percent !== 'number') {
      itemErrors.push('discount.percent는 숫자 또는 null이어야 합니다');
    }
    if (b.media) {
      for (const key of ['image', 'audio']) {
        const p = b.media[key];
        if (p && /^[a-z]+:/i.test(p)) itemErrors.push(`media.${key}는 사이트 안의 상대 경로여야 합니다(외부 런타임 호출 금지)`);
      }
      if (b.media.image && isEmpty(b.media.imageAlt)) itemErrors.push('media.image가 있으면 media.imageAlt가 필요합니다');
    }
    if (b.unverified != null && !Array.isArray(b.unverified)) itemErrors.push('unverified는 배열이어야 합니다');
    if (b.keywords != null && !(Array.isArray(b.keywords) && b.keywords.every((k) => typeof k === 'string'))) {
      itemErrors.push('keywords는 문자열 배열이어야 합니다');
    }

    if (itemErrors.length) {
      itemErrors.forEach((e) => errors.push(`${where}: ${e}`));
      // 필수 필드 누락·중복은 렌더링 불가 → 제외. 그 밖의 형식 오류도 안전하게 제외한다.
      return;
    }
    seen.add(b.id);
    valid.push(b);
  });
  return { valid, errors, warnings };
}

// ----- 날짜·상태 -----

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function mmddToDate(year, mmdd) {
  const [m, d] = mmdd.split('-').map(Number);
  return new Date(year, m - 1, d);
}

/** 연도가 확정된 경우에만 {start, end} Date를 돌려준다. (종료일이 시작일보다 앞서면 다음 해로 본다) */
export function validityRange(v) {
  if (!v || v.year == null || !v.end) return null;
  const start = v.start ? mmddToDate(v.year, v.start) : null;
  let end = mmddToDate(v.year, v.end);
  if (start && end < start) end = mmddToDate(v.year + 1, v.end);
  return { start, end };
}

/**
 * 상태 계산: 'expired' | 'upcoming' | 'needsCheck' | 'ok'
 * - year 미확정이면 자동 종료 판정을 하지 않는다.
 */
export function computeStatus(b, now = new Date()) {
  const today = startOfToday(now);
  const range = validityRange(b.validity);
  if (range && today > range.end) return 'expired';
  if (range && range.start && today < range.start) return 'upcoming';
  if (needsCheck(b)) return 'needsCheck';
  return 'ok';
}

export function needsCheck(b) {
  return (Array.isArray(b.unverified) && b.unverified.length > 0) || !b.validity || b.validity.year == null;
}

/** 종료까지 남은 일수(연도 확정 시). 오늘이 종료일이면 0. */
export function daysUntilEnd(b, now = new Date()) {
  const range = validityRange(b.validity);
  if (!range) return null;
  return Math.round((range.end - startOfToday(now)) / 86400000);
}

export const ENDING_SOON_DAYS = 7;

/** 종료 임박(0~7일 남음) 문구. 해당 없으면 null. 카드와 상세가 같은 기준을 쓴다. */
export function endingSoonLabel(b, now = new Date()) {
  const left = daysUntilEnd(b, now);
  if (left == null || left < 0 || left > ENDING_SOON_DAYS) return null;
  return left === 0 ? '오늘 종료' : `종료 ${left}일 전`;
}

/** 연도 미확인 기간에서 올해 기준 종료일이 지났는가. 자동 종료 판정 대신 확인 안내에만 쓴다. */
export function yearlessEndPassed(b, now = new Date()) {
  const v = b.validity;
  if (!v || v.year != null || !v.end) return false;
  const today = startOfToday(now);
  const end = mmddToDate(today.getFullYear(), v.end);
  if (v.start && mmddToDate(today.getFullYear(), v.start) > end) return false; // 해를 넘기는 기간은 판단하지 않음
  return today > end;
}

function mmddLabel(mmdd) {
  const [m, d] = mmdd.split('-').map(Number);
  return `${m}/${d}`;
}

/** 기간 표시 문자열. 정보가 없으면 null. */
export function formatValidity(v) {
  if (!v || (!v.start && !v.end)) return null;
  const s = v.start ? mmddLabel(v.start) : '';
  const e = v.end ? mmddLabel(v.end) : '';
  if (v.year == null) return `제휴 기간 ${s} ~ ${e}까지 · 연도 확인 필요`;
  const range = validityRange(v);
  const fmt = (d) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  return `${range.start ? fmt(range.start) : ''} ~ ${fmt(range.end)}`;
}

/** "추가 확인 필요" 목록: unverified 항목 + 값이 비어 있는 주요 선택 필드 */
export function uncheckedItems(b, now = new Date()) {
  const items = [];
  const seenMsg = new Set();
  if (yearlessEndPassed(b, now)) {
    items.push(`기간: 올해 기준 종료일(${mmddLabel(b.validity.end)})이 지났습니다. 연도와 연장 여부 확인 필요`);
  }
  (b.unverified || []).forEach((u) => {
    const label = FIELD_LABELS[u.field] || u.field;
    const text = `${label}: ${u.message}`;
    if (!seenMsg.has(text)) { seenMsg.add(text); items.push(text); }
  });
  for (const f of ['discount', 'target', 'howTo', 'validity', 'conditions', 'exceptions']) {
    const val = f === 'discount' ? (b.discount && b.discount.label) : b[f];
    const alreadyListed = (b.unverified || []).some((u) => u.field === f || u.field.startsWith(f + '.'));
    if (isEmpty(val) && !alreadyListed) items.push(`${FIELD_LABELS[f]}: ${MSG_UNKNOWN}`);
  }
  return items;
}

// ----- 검색·정렬·카테고리 -----

// 공백과 기호(·, -, 괄호 등)를 지워 "어학시험"이 "어학·시험"과, "kingo m"이 "KINGO-M"과 맞게 한다.
export function normalize(s) {
  return String(s ?? '').normalize('NFC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

export function searchText(b) {
  return normalize([
    b.name, b.summary, b.category,
    b.discount && b.discount.label,
    ...(b.keywords || []),
    ...(b.target || []),
    ...(b.highlights || []),
    ...(b.locations || []).map((l) => `${l.label} ${l.address}`),
  ].filter(Boolean).join(' '));
}

export function matchesQuery(b, query) {
  const q = normalize(query);
  return q === '' || searchText(b).includes(q);
}

/** 데이터에 존재하는 category를 등장 순서대로, 개수와 함께 */
export function getCategories(list) {
  const map = new Map();
  list.forEach((b) => map.set(b.category, (map.get(b.category) || 0) + 1));
  return [...map].map(([name, count]) => ({ name, count }));
}

/** 종료된 혜택은 아래로. 나머지는 sourceNo 순서 유지. */
export function sortBenefits(list, now = new Date()) {
  return [...list].sort((a, b) => {
    const ea = computeStatus(a, now) === 'expired' ? 1 : 0;
    const eb = computeStatus(b, now) === 'expired' ? 1 : 0;
    return ea - eb || String(a.sourceNo).localeCompare(String(b.sourceNo));
  });
}

/** 브라우저 전용: JSON 로드 + 검증. 실패하면 예외를 던진다. */
export async function loadBenefits(url = DATA_URL) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} 응답 오류 (HTTP ${res.status})`);
  const json = await res.json();
  const { valid, errors, warnings } = validateBenefits(json);
  errors.forEach((e) => console.error('[benefits.json 스키마 오류]', e));
  warnings.forEach((w) => console.warn('[benefits.json 경고]', w));
  return valid;
}
