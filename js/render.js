// 목록·상세 렌더링 (innerHTML 대신 DOM API로 만들어 데이터 속 문자가 HTML로 해석되지 않게 한다)
import { computeStatus, formatValidity, MSG_UNKNOWN, uncheckedItems, daysUntilEnd, isEmpty } from './data.js';

export const PLACEHOLDER_IMG = 'assets/img/placeholder.svg';

/** 작은 DOM 생성 도우미: el('a', { href, class: 'x' }, '텍스트', 자식요소...) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** 이미지가 없으면(404 등) 자리표시자 SVG로 바꾼다. */
export function imageWithFallback(src, alt, extra = {}) {
  const img = el('img', { src: src || PLACEHOLDER_IMG, alt: src ? alt : '', loading: 'lazy', decoding: 'async', ...extra });
  img.addEventListener('error', () => {
    if (img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = PLACEHOLDER_IMG;
    img.alt = ''; // 자리표시자는 장식용
  }, { once: false });
  return img;
}

export function externalLink(href, text, className = 'btn btn--ghost') {
  return el('a', { href, class: `${className} ext`, target: '_blank', rel: 'noopener noreferrer' },
    text, el('span', { class: 'visually-hidden' }, ' (새 창)'));
}

// ----- 카테고리 아이콘 (데이터에 없는 분야는 기본 아이콘) -----
const ICONS = {
  '전체': '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  '음식점': '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8 7c0-1 1-1.5 1-2.5M12 7c0-1 1-1.5 1-2.5M16 7c0-1 1-1.5 1-2.5"/>',
  '어학·시험': '<path d="M4 5h11v9H8l-4 3z"/><path d="M15 9h5v8l-3-2h-6v-1"/>',
  '의료·건강': '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  default: '<path d="M4 8h16v4a2 2 0 0 0 0 4v0H4v0a2 2 0 0 0 0-4z" transform="translate(0 -1)"/>',
};
function categoryIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] || ICONS.default; // 고정 문자열만 사용
  return svg;
}

/**
 * @param {HTMLElement} listEl
 * @param {{name:string,count:number}[]} categories
 * @param {string} active  '전체' 또는 카테고리명
 * @param {(name:string)=>void} onSelect
 */
export function renderCategories(listEl, categories, active, total, onSelect) {
  const all = [{ name: '전체', count: total }, ...categories];
  listEl.replaceChildren(...all.map(({ name, count }) =>
    el('li', {},
      el('button', {
        type: 'button', class: 'cat-btn', 'aria-pressed': String(name === active),
        onclick: () => onSelect(name),
      }, categoryIcon(name), el('span', {}, name), el('span', { class: 'cat-btn__count' }, `${count}건`)))
  ));
}

/** 카드에 붙는 칩: 상태 칩 + 데이터의 highlights */
function statusChips(b, status) {
  const chips = [];
  if (status === 'expired') chips.push(el('li', { class: 'chip chip--ended' }, '종료'));
  if (status === 'upcoming') chips.push(el('li', { class: 'chip' }, '시작 전'));
  if (status === 'needsCheck') chips.push(el('li', { class: 'chip chip--warn' }, '추가 확인 필요'));
  (b.highlights || []).forEach((h, i) => chips.push(el('li', { class: i === 0 ? 'chip chip--req' : 'chip' }, h)));
  return chips;
}

export function renderCard(b, now, onOpen) {
  const status = computeStatus(b, now);
  const sourceHref = b.links.official || b.links.source;
  const validity = formatValidity(b.validity);
  return el('li', {},
    el('article', { class: `card${status === 'expired' ? ' card--expired' : ''}`, 'aria-labelledby': `card-${b.id}` },
      el('figure', { class: 'card__media' }, imageWithFallback(b.media && b.media.image, b.media && b.media.imageAlt)),
      el('div', { class: 'card__body' },
        el('span', { class: 'tag' }, b.category),
        el('h3', { class: 'card__name', id: `card-${b.id}` }, b.name),
        el('p', { class: 'card__summary' }, b.summary),
        validity && el('p', { class: 'card__summary' }, validity),
        el('ul', { class: 'chips', 'aria-label': '핵심 조건' }, statusChips(b, status)),
        el('div', { class: 'card__actions' },
          externalLink(sourceHref, b.links.official ? '공식 링크' : '출처 공지'),
          el('button', {
            type: 'button', class: 'btn btn--primary', dataset: { detailId: b.id },
            'aria-label': `${b.name} 상세 보기`, onclick: (e) => onOpen(b.id, e.currentTarget),
          }, '상세 보기')))));
}

export function renderList(listEl, items, now, onOpen) {
  listEl.replaceChildren(...items.map((b) => renderCard(b, now, onOpen)));
  listEl.setAttribute('aria-busy', 'false');
}

// ===== 상세 =====

function unknown() {
  return el('span', { class: 'unknown' }, MSG_UNKNOWN);
}

function listOrUnknown(arr) {
  if (isEmpty(arr)) return unknown();
  if (arr.length === 1) return el('p', {}, arr[0]);
  return el('ul', {}, arr.map((t) => el('li', {}, t)));
}

function fact(label, content) {
  return el('div', { class: 'fact' }, el('dt', {}, label), el('dd', {}, content));
}

function validityContent(b, now) {
  const text = formatValidity(b.validity);
  if (!text) return unknown();
  const left = daysUntilEnd(b, now);
  return el('div', {},
    el('p', {}, text),
    left != null && left >= 0 && left <= 7 && el('span', { class: 'chip chip--warn' }, left === 0 ? '오늘 종료' : `종료 ${left}일 전`),
    b.validity.note && el('span', { class: 'fact__note' }, b.validity.note));
}

function locationsContent(locs) {
  if (isEmpty(locs)) return null;
  return el('ul', {}, locs.map((l) => el('li', {}, el('strong', {}, l.label), ' — ', l.address)));
}

function contactContent(c) {
  if (!c || (!c.tel && !c.label)) return null;
  return el('p', {},
    c.label, c.tel && ' ',
    c.tel && el('a', { href: `tel:${c.tel.replace(/[^0-9+]/g, '')}` }, c.tel));
}

/**
 * 상세 패널 내용을 만든다. 음성 영역(.voice)은 audio.js가 연결한다.
 * 표시 순서: 혜택명 → (추가 확인 필요) → 핵심 혜택 → 대상/이용 방법/기간/조건/제외·유의사항 → 이미지 → 음성 → 공식 링크 → 출처·확인일
 */
export function renderDetail(b, now, { onClose, onOpenOther, others = [] }) {
  const status = computeStatus(b, now);
  const checks = uncheckedItems(b);

  const links = [];
  if (b.links.apply) links.push(externalLink(b.links.apply, '신청하기', 'btn btn--navy'));
  if (b.links.official) links.push(externalLink(b.links.official, '공식 링크', b.links.apply ? 'btn btn--ghost' : 'btn btn--navy'));
  links.push(externalLink(b.links.source, '출처 공지 보기', links.length ? 'btn btn--ghost' : 'btn btn--navy'));

  const locs = locationsContent(b.locations);
  const contact = contactContent(b.contact);

  return [
    el('div', { class: 'detail__top' },
      el('div', { class: 'detail__heading' },
        el('span', { class: 'tag' }, b.category),
        el('h2', { class: 'detail__title', id: 'detail-title', tabindex: '-1' }, b.name)),
      el('button', { type: 'button', class: 'detail__close', 'aria-label': '상세 닫기', onclick: onClose }, '✕')),

    status === 'expired' && el('section', { class: 'box box--ended', role: 'note' },
      el('span', { class: 'chip chip--ended' }, '종료'),
      el('span', {}, '이 혜택은 제휴 기간이 끝났습니다. 연장 여부는 출처 공지에서 확인하세요.')),

    checks.length > 0 && el('section', { class: 'box box--warn', 'aria-labelledby': 'check-title' },
      el('h3', { id: 'check-title' }, '추가 확인 필요'),
      el('p', { class: 'fact__note' }, '아래 항목은 공식 자료에서 확인되지 않았어요. 이용 전 공식 링크에서 꼭 확인하세요.'),
      el('ul', {}, checks.map((c) => el('li', {}, c)))),

    el('section', { 'aria-labelledby': 'benefit-core' },
      el('p', { class: 'highlight', id: 'benefit-core' },
        el('span', { class: 'highlight__label' }, '핵심 혜택'),
        b.discount && b.discount.label ? b.discount.label : unknown())),

    el('section', { 'aria-label': '이용 조건' },
      el('dl', { class: 'facts' },
        fact('대상', listOrUnknown(b.target)),
        fact('이용 방법', listOrUnknown(b.howTo)),
        fact('기간', validityContent(b, now)),
        fact('조건', listOrUnknown(b.conditions)),
        fact('제외·유의사항', listOrUnknown(b.exceptions)),
        locs && fact('장소', locs),
        contact && fact('문의', contact))),

    b.media && b.media.image && el('section', { class: 'detail__figure', 'aria-label': '관련 이미지' },
      el('figure', {}, imageWithFallback(b.media.image, b.media.imageAlt))),

    el('section', { class: 'voice', id: 'voice', 'aria-labelledby': 'voice-title', hidden: true },
      el('h3', { id: 'voice-title' }, '음성 안내'),
      el('div', { class: 'voice__row' },
        el('button', { type: 'button', class: 'btn btn--lime', id: 'voice-toggle', hidden: true }, '▶ 음성 안내 듣기'),
        el('p', { class: 'voice__status', id: 'voice-status', 'aria-live': 'polite' })),
      el('audio', { id: 'voice-audio', controls: true, preload: 'none' }),
      b.media && b.media.audioScript && el('details', {},
        el('summary', {}, '음성 대본 보기'),
        el('p', {}, b.media.audioScript))),

    el('section', { 'aria-labelledby': 'links-title' },
      el('h3', { id: 'links-title' }, '공식 링크로 이동'),
      el('div', { class: 'links' }, links)),

    el('section', { class: 'source', 'aria-label': '출처 정보' },
      el('p', {}, `근거 자료 번호 ${b.sourceNo} · 출처: ${b.sourceOwner || MSG_UNKNOWN}`),
      el('p', {}, `마지막 확인일 ${b.lastCheckedAt} · 최종 조건은 반드시 공식 링크에서 확인하세요.`)),

    others.length > 0 && el('section', { class: 'others', 'aria-labelledby': 'others-title' },
      el('h3', { id: 'others-title' }, '다른 혜택 보기'),
      el('ul', {}, others.map((o) => el('li', {},
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => onOpenOther(o.id) }, o.name))))),
  ].filter(Boolean);
}
