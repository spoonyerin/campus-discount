// 진입점: 데이터 로드 → 목록·필터 렌더링 → 해시 라우팅(#/benefit/<id>)
import { loadBenefits, getCategories, matchesQuery, matchesCampus, sortBenefits } from './data.js';
import { renderCategories, renderList, renderDetail } from './render.js';
import { setupVoice, stopVoice, setupHeroVideo, setupSceneImages } from './audio.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_TITLE = document.title;
const DETAIL_RE = /^#\/benefit\/([^/?#]+)\/?$/;

const state = {
  benefits: [],
  category: '전체',
  campus: '전체',
  query: '',
};

const OTHERS_MAX = 6;

const detail = {
  openId: null,
  pushed: false,   // 목록에서 열어 history에 항목을 추가했는지 (닫을 때 back으로 되돌림)
  returnId: null,  // 닫은 뒤 포커스를 돌려줄 카드의 혜택 id
};

// ----- 목록 -----

function filtered() {
  return sortBenefits(state.benefits).filter((b) =>
    (state.category === '전체' || b.category === state.category)
    && matchesCampus(b, state.campus) && matchesQuery(b, state.query));
}

function renderAll() {
  renderCategories($('category-list'), getCategories(state.benefits), state.category, state.benefits.length, (name) => {
    state.category = name;
    renderAll();
    const btn = [...$('category-list').querySelectorAll('.cat-btn')].find((b) => b.getAttribute('aria-pressed') === 'true');
    if (btn) btn.focus();
  });
  document.querySelectorAll('#campus-filter [data-campus]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.campus === state.campus));
  });
  const items = filtered();
  renderList($('benefit-list'), items, new Date(), openFromClick);
  $('empty-state').hidden = items.length > 0;
  $('result-count').textContent = `총 ${items.length}건`;
}

function resetFilters() {
  state.category = '전체';
  state.campus = '전체';
  state.query = '';
  $('search-input').value = '';
  renderAll();
  $('search-input').focus();
}

function showNotice(text) {
  const n = $('notice');
  n.textContent = text;
  n.hidden = !text;
}

// ----- 상세 -----

/** '상세 보기' 클릭(사용자 제스처) → 음성 자동 재생 시도 */
function openFromClick(id) {
  if (detail.openId) {
    history.replaceState(null, '', `#/benefit/${id}`); // 상세 안에서 전환: 기록을 늘리지 않음
  } else {
    history.pushState(null, '', `#/benefit/${id}`);
    detail.pushed = true;
    detail.returnId = id;
  }
  showDetail(id, { autoplay: true });
}

function showDetail(id, { autoplay }) {
  const b = state.benefits.find((x) => x.id === id);
  if (!b) { handleInvalid(id); return; }
  showNotice('');
  stopVoice();

  const dialog = $('detail');
  const content = $('detail-content');
  // 다른 혜택: 같은 분야를 먼저, 최대 OTHERS_MAX개
  const rest = state.benefits.filter((x) => x.id !== id);
  const others = [...rest.filter((x) => x.category === b.category), ...rest.filter((x) => x.category !== b.category)]
    .slice(0, OTHERS_MAX);
  content.replaceChildren(...renderDetail(b, new Date(), {
    onClose: () => closeDetail(),
    onOpenOther: (otherId) => openFromClick(otherId),
    others,
  }));
  if (!dialog.open) dialog.showModal();
  if (!detail.returnId) detail.returnId = id;
  detail.openId = id;
  dialog.scrollTop = 0;
  $('detail-title').focus();
  document.title = `${b.name} — 캠퍼스할인.zip`;
  setupVoice(content, b.media && b.media.audio, { autoplay });
}

function closeDetail({ fromHistory = false } = {}) {
  const dialog = $('detail');
  if (!dialog.open) return;
  stopVoice();
  dialog.close();
  $('detail-content').replaceChildren();
  document.title = DEFAULT_TITLE;
  const returnId = detail.returnId;
  const pushed = detail.pushed;
  detail.openId = null;
  detail.pushed = false;
  detail.returnId = null;

  if (!fromHistory) {
    if (pushed) history.back();                     // 목록 상태로 되돌림 (hashchange는 무시됨)
    else history.replaceState(null, '', '#/');      // 공유 링크로 들어온 경우
  }
  // 호출한 '상세 보기' 버튼으로 포커스 복귀 (필터로 사라졌으면 목록 제목으로)
  const btn = returnId && $('benefit-list').querySelector(`[data-detail-id="${CSS.escape(returnId)}"]`);
  (btn || $('benefit-list-heading')).focus();
}

function handleInvalid(id) {
  if ($('detail').open) closeDetail({ fromHistory: true });
  history.replaceState(null, '', '#/');
  showNotice(`요청한 혜택(${id})을 찾을 수 없어 목록으로 돌아왔어요. 목록에서 다시 선택해 주세요.`);
  $('benefit-list-heading').focus();
}

function route() {
  const m = location.hash.match(DETAIL_RE);
  if (m) {
    let id;
    try { id = decodeURIComponent(m[1]); } catch { id = m[1]; }
    if (detail.openId !== id) showDetail(id, { autoplay: false });
  } else if ($('detail').open) {
    closeDetail({ fromHistory: true });
  }
}

// ----- 초기화 -----

function showLoadError(err) {
  console.error('[혜택 데이터 로드 실패]', err);
  $('load-error').hidden = false;
  if (location.protocol === 'file:') {
    $('load-error-detail').textContent =
      '파일을 직접 열면 데이터를 불러올 수 없어요. 프로젝트 폴더에서 "python -m http.server 5173"을 실행한 뒤 http://localhost:5173 으로 접속하세요. 그동안 아래 공식 공지에서 직접 확인할 수 있어요.';
  }
  $('benefit-list').setAttribute('aria-busy', 'false');
  $('result-count').textContent = '';
}

async function init() {
  setupHeroVideo();
  setupSceneImages();

  $('search-input').addEventListener('input', (e) => {
    state.query = e.target.value;
    renderAll();
  });
  $('search-form').addEventListener('submit', (e) => e.preventDefault());
  $('reset-filters').addEventListener('click', resetFilters);
  $('campus-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-campus]');
    if (!btn) return;
    state.campus = btn.dataset.campus;
    renderAll();
  });

  const dialog = $('detail');
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeDetail(); }); // Esc
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDetail(); }); // 바깥(배경) 클릭

  try {
    state.benefits = await loadBenefits();
  } catch (err) {
    showLoadError(err);
    return;
  }
  renderAll();
  window.addEventListener('hashchange', route);
  route();
}

init();
