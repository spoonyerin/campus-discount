// 음성 안내·안내 영상 재생 제어
// 원칙: 소리 있는 자동재생은 사용자 제스처('상세 보기' 클릭) 때만 시도하고, 막히면 조용히 ▶ 버튼을 보여 준다.

let active = null; // 현재 상세 패널의 <audio>

/** 재생 중인 음성을 즉시 정지하고 연결을 끊는다. (다른 혜택으로 전환·닫기 시 호출) */
export function stopVoice() {
  const audio = active;
  active = null; // error 이벤트 핸들러가 이전 오디오를 무시하도록 먼저 비운다
  if (!audio) return;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

/**
 * 상세 패널의 음성 영역(#voice)을 연결한다.
 * @param {HTMLElement} root  상세 패널 컨테이너
 * @param {string|null} src   mp3 경로 (없으면 영역 숨김)
 * @param {{autoplay:boolean}} opts
 */
export function setupVoice(root, src, { autoplay }) {
  stopVoice();
  const section = root.querySelector('#voice');
  const audio = root.querySelector('#voice-audio');
  const btn = root.querySelector('#voice-toggle');
  const status = root.querySelector('#voice-status');
  if (!section || !audio) return;
  if (!src) { section.hidden = true; return; }

  active = audio;
  const isCurrent = () => active === audio;
  const show = () => { if (isCurrent()) { section.hidden = false; btn.hidden = false; } };
  const label = (playing) => { btn.textContent = playing ? '❚❚ 일시정지' : '▶ 음성 안내 듣기'; };

  audio.addEventListener('loadedmetadata', show);
  // 파일이 없거나 재생할 수 없으면 플레이어를 숨긴다(대본은 상세 글에 같은 내용이 있으므로 생략)
  audio.addEventListener('error', () => { if (isCurrent()) section.hidden = true; });
  audio.addEventListener('play', () => { label(true); status.textContent = '음성 안내 재생 중'; });
  audio.addEventListener('pause', () => { label(false); if (!audio.ended && isCurrent()) status.textContent = '일시정지됨'; });
  audio.addEventListener('ended', () => { label(false); status.textContent = '재생이 끝났어요'; });
  btn.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => { status.textContent = '음성을 재생할 수 없어요.'; });
    else audio.pause();
  });

  audio.preload = 'metadata';
  audio.src = src;

  if (autoplay) {
    audio.play().catch((err) => {
      if (!isCurrent()) return;
      if (err && err.name === 'NotAllowedError') {
        show();
        status.textContent = '자동 재생이 차단되었어요. ▶ 버튼을 눌러 들어 보세요.';
      }
      // 그 밖의 오류(파일 없음 등)는 error 이벤트에서 영역을 숨긴다.
    });
  }
}

/**
 * 히어로 영상: 파일이 있으면 영상 블록을 보이고 4단계 카드를 숨긴다. 없으면 4단계 카드를 유지한다.
 * 기본 음소거 + 자막 표시. 소리 자동재생은 시도하지 않는다.
 */
export function setupHeroVideo() {
  const wrap = document.getElementById('hero-video-wrap');
  const video = document.getElementById('hero-video');
  const steps = document.getElementById('hero-steps');
  if (!wrap || !video) return;

  video.muted = true;
  video.addEventListener('loadedmetadata', () => {
    wrap.hidden = false;
    if (steps) steps.hidden = true;
    const track = video.textTracks && video.textTracks[0];
    if (track) track.mode = 'showing';
  }, { once: true });
  video.addEventListener('error', () => { wrap.hidden = true; if (steps) steps.hidden = false; });

  if (video.dataset.poster) {
    // 포스터 파일이 있을 때만 지정 (없으면 검은 화면 대신 첫 프레임)
    const probe = new Image();
    probe.onload = () => { video.poster = video.dataset.poster; };
    probe.src = video.dataset.poster;
  }
  video.src = video.dataset.src;
}

/** 4단계 카드의 장면 이미지: 파일이 있으면 기본 SVG 아이콘을 이미지로 교체 */
export function setupSceneImages() {
  document.querySelectorAll('.step__media[data-scene]').forEach((fig) => {
    const img = new Image();
    img.alt = ''; // 옆에 같은 내용의 글이 있으므로 장식용
    img.decoding = 'async';
    img.onload = () => fig.replaceChildren(img);
    img.src = fig.dataset.scene;
  });
}
