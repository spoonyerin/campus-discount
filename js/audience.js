// 대상자(내 상황) 선택에 따른 목록 순서·상세 안내 문구
// DOM에 의존하지 않으므로 scripts/test-logic.mjs(Node)에서도 그대로 import 한다.
// 원칙: 공지의 '대상' 칸 원문에 있는 단어만 근거로 쓴다. 없는 대상은 "불가"가 아니라 "공지에서 확인되지 않습니다"로 쓴다.

export const NOTES_URL = 'data/audience-notes.json';

export const AUDIENCES = {
  a: { label: '학부 재학생', who: '학부생 · 재학생 · 학부에 재학 중인 학생' },
  b: { label: '휴학생·졸업생', who: '휴학생 · 졸업생 · 수료생' },
  all: { label: '전체 혜택 보기', who: '대학원생 · 교직원 · 가족·지인 등 위에 해당하지 않는 분' },
};

export const MSG_NO_TARGET = '대상 정보 없음';
export const B_WORDS = ['휴학생', '졸업생', '수료생'];
const A_RE = /학부|재학/;
// 학과·캠퍼스·수강·신규 고객처럼 학적 말고 다른 자격이 붙는 경우
const EXTRA_RE = /학과|캠퍼스|인사캠|자과캠|수강|신규|주문 이력/;
const PROOF_RE = /증명서|증빙/;

export function targetText(b) {
  return (b.target || []).filter((t) => t && String(t).trim()).join(', ');
}

/** 대상 칸에 '학생'이라는 말만 있는가 (휴학생 속 '학생'은 빼고 본다) */
function mentionsStudent(text) {
  return /학생/.test(text.replace(/휴학생/g, ''));
}

/**
 * 대상 판정
 * - A: 'yes'(학부·재학 명시) | 'student'('학생'으로만 표기) | 'unknown'(그 밖) | 'none'(대상 정보 없음)
 * - B: { found: ['휴학생', ...], missing: [...] } 또는 대상 정보 없음이면 null
 */
export function matchA(b) {
  const t = targetText(b);
  if (!t) return 'none';
  if (A_RE.test(t)) return 'yes';
  if (mentionsStudent(t)) return 'student';
  return 'unknown';
}

export function matchB(b) {
  const t = targetText(b);
  if (!t) return null;
  const found = B_WORDS.filter((w) => t.includes(w));
  return { found, missing: B_WORDS.filter((w) => !found.includes(w)) };
}

/** 학적 외 추가 조건(학과·캠퍼스·수강·신규 고객)이 있으면 해당 조건 칸 원문(조건 칸에 없으면 대상 원문)을 돌려준다. 없으면 null */
export function extraConditions(b) {
  const t = targetText(b);
  const conds = (b.conditions || []).filter(Boolean);
  const hit = conds.filter((c) => EXTRA_RE.test(c));
  if (hit.length) return hit.join(' / ');
  if (EXTRA_RE.test(t) || b.campus) return `대상 원문 "${t}"`;
  return null;
}

/**
 * 목록 순서용 등급 (작을수록 위). 'all'이면 모두 0 → 기존 순서 그대로.
 * 0: 공지 대상에 내 상황이 명시됨 / 1: '학생'으로만 표기되었거나 대상 정보 없음 / 2: 공지에서 확인되지 않음
 */
export function audienceRank(b, aud) {
  if (aud === 'a') return { yes: 0, student: 1, none: 1, unknown: 2 }[matchA(b)];
  if (aud === 'b') {
    const m = matchB(b);
    if (!m) return 1;
    if (m.found.length) return 0;
    return mentionsStudent(targetText(b)) && !A_RE.test(targetText(b)) ? 1 : 2;
  }
  return 0;
}

const joinWords = (ws) => ws.join('·');
const sentence = (s) => (/[.!?)]$/.test(s) ? s : `${s}.`);

/**
 * 자동 규칙 안내 문구 (문장 배열, 2~3문장). 데이터 원문만 이어 붙인다.
 */
export function autoGuide(b, aud) {
  if (aud !== 'a' && aud !== 'b') return [];
  const t = targetText(b);
  if (!t) return [`${MSG_NO_TARGET}. 이용 전 공식 링크에서 대상을 확인하세요.`];
  const out = [];
  const how = (b.howTo || []).filter(Boolean)[0];
  const extra = extraConditions(b);

  if (aud === 'a') {
    const m = matchA(b);
    if (m === 'yes') out.push('공지 대상에 학부생 또는 재학생이 명시되어 있어 이용 대상입니다.');
    else if (m === 'student') out.push(`공지에는 "학생"으로만 표기되어 있어요 (대상: ${t}).`);
    else out.push(`공지의 대상은 "${t}"이며, 학부 재학생은 공지에서 확인되지 않습니다.`);
    if (how) out.push(sentence(`이용 방법: ${how}`));
  } else {
    const m = matchB(b);
    if (m.found.length) {
      out.push(`공지 대상에 ${joinWords(m.found)}이 포함되어 있어요.`);
      if (m.missing.length) out.push(`${joinWords(m.missing)}은 공지에서 확인되지 않습니다.`);
    } else {
      out.push(`공지의 대상은 "${t}"이며, 휴학생·졸업생·수료생은 공지에서 확인되지 않습니다.`);
    }
    const proof = [...(b.howTo || []), ...(b.conditions || []), ...(b.exceptions || [])].find((s) => s && PROOF_RE.test(s));
    if (proof) out.push(sentence(`필요 서류: ${proof}`));
    else if (how && m.found.length) out.push(sentence(`이용 방법: ${how}`));
  }
  if (extra) out.push(sentence(`다른 조건이 있어요: ${extra}`));
  return out.slice(0, 3);
}

/**
 * 상세에 보여 줄 안내. 팀이 쓴 대표 문구(notes)가 있으면 우선, 없으면 자동 규칙.
 * @returns {{ text: string[], source: 'team' | 'auto' } | null}
 */
export function guideFor(b, aud, notes = {}) {
  if (aud !== 'a' && aud !== 'b') return null;
  const note = notes[b.id] && notes[b.id][aud];
  if (note && String(note).trim()) return { text: [String(note).trim()], source: 'team' };
  return { text: autoGuide(b, aud), source: 'auto' };
}

/** 도움말의 '다음 행동' 목록 (데이터에 있는 이용 방법 + 링크 안내) */
export function nextSteps(b, aud) {
  const steps = (b.howTo || []).filter(Boolean).map((s) => s);
  if (aud === 'b') {
    const m = matchB(b);
    if (!m || m.missing.length) steps.push('내 학적 상태가 대상인지 확실하지 않다면 이용 전 문의처나 공식 링크에서 먼저 확인하세요.');
  } else if (aud === 'a' && matchA(b) !== 'yes') {
    steps.push('학부 재학생이 대상인지 확실하지 않다면 이용 전 문의처나 공식 링크에서 먼저 확인하세요.');
  }
  steps.push(b.links && b.links.apply ? '아래 "신청하기" 버튼으로 신청하세요.' : '아래 링크에서 최종 조건을 확인하세요.');
  return steps;
}

/** 브라우저 전용: 대표 문구 로드. 실패해도 자동 규칙으로 대신하므로 빈 객체를 돌려준다. */
export async function loadNotes(url = NOTES_URL) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json && typeof json.notes === 'object' ? json.notes : {};
  } catch (err) {
    console.warn('[대상자 안내 문구 로드 실패 — 자동 규칙으로 표시]', err);
    return {};
  }
}
