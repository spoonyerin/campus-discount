# 캠퍼스할인.zip

> 모르고 지나쳤던 혜택, 이제 한 곳에서 확인하세요!

성균관대학교 학생이 흩어져 있는 제휴·할인 혜택을 한 곳에서 보고, 조건을 확인한 뒤 공식 링크로 이동하게 해 주는 **정적 웹사이트**입니다.
서버·DB·로그인·외부 라이브러리 없이 HTML·CSS·JavaScript와 JSON만으로 동작합니다.

> 학생 팀 프로젝트 사이트이며 성균관대학교·총학생회의 공식 사이트가 아닙니다. 정보는 공식 공지를 바탕으로 하며, 최종 조건은 반드시 공식 링크에서 확인하세요.

## 로컬 실행

`index.html`을 더블클릭하면 데이터를 불러오지 못합니다(브라우저 보안 정책). 간단한 로컬 서버로 여세요.

```powershell
cd <프로젝트 폴더>
python -m http.server 5173
# 브라우저에서 http://localhost:5173
```

데이터 점검(의존성 없음, Node 18 이상):

```powershell
node scripts/check-data.mjs
node scripts/test-logic.mjs   # 검색·기간 처리 시험 (기준일 고정)
```

## 폴더 구조

```
index.html            단일 페이지 (해시 라우팅: #/benefit/<id>)
css/tokens.css        색·간격·글꼴 변수
css/style.css         화면 스타일
js/main.js            진입점, 검색·필터, 라우팅, 상세 열기/닫기
js/data.js            JSON 로딩·스키마 검증·상태(종료/추가 확인 필요) 계산
js/render.js          목록 카드·상세 패널 렌더링
js/audio.js           음성 안내·안내 영상 재생 제어
data/benefits.json    혜택 데이터 (화면이 읽는 파일, 시트에서 생성)
data/audience-notes.json  대상자(A 학부 재학생·B 휴학생·졸업생)별 대표 안내 문구 (직접 관리)
data/sheet-map.json   시트 행 ↔ 혜택 id·근거 번호 고정표
assets/               이미지·음성·영상 (목록은 assets/README.md)
docs/test-checklist.md 테스트 체크리스트
scripts/check-data.mjs 데이터·미디어 점검 스크립트
scripts/test-logic.mjs 검색·기간·시트 변환 시험 스크립트 (시험용 사본 scripts/fixtures/ 사용)
scripts/sync-sheet.mjs 구글 시트 → benefits.json 변환
scripts/sheet-lib.mjs  시트 행 변환 규칙
scripts/media/         임시 미디어 생성기 (make-media.py, tts.ps1)
assets/temp-media.json 자동 생성한 임시 미디어 목록
.github/workflows/sync-sheet.yml  GitHub에서 버튼으로 시트 동기화
```

## 혜택 데이터 갱신 (구글 시트 → 사이트)

혜택 정보는 팀 구글 시트에서 관리합니다. DB는 쓰지 않습니다. 시트를 고친 뒤 아래 둘 중 하나로 반영합니다.

**A. 내 컴퓨터에서**
```powershell
node scripts/sync-sheet.mjs --dry-run   # 무엇이 바뀌는지만 확인
node scripts/sync-sheet.mjs             # data/benefits.json 다시 만들기
node scripts/check-data.mjs             # 게시 전 점검
git add data && git commit -m "혜택 데이터 갱신" && git push
```

**B. GitHub에서 버튼으로** — 저장소 **Actions → 시트 → 혜택 데이터 동기화 → Run workflow**.
시트를 내려받아 변환·점검하고, 오류가 없을 때만 `data/` 변경을 커밋합니다. 커밋되면 Pages가 다시 배포됩니다.
(매일 자동 실행은 워크플로 파일의 `schedule` 주석을 풀면 켜집니다. 원문 대조 전 내용이 바로 공개될 수 있으니 팀 확인 절차를 정한 뒤 켜세요.)

**시트 작성 규칙**
- 시트 공유는 "링크가 있는 모든 사용자: 보기"로 둡니다(내려받기에 필요). 조사자 열은 사이트에 나가지 않습니다.
- 첫 행 머리글(열 이름)은 바꾸지 않습니다. 바뀌면 변환이 멈춥니다.
- 여러 값은 `;`로 나눕니다(대상·이용 방법·조건·제외·유의사항·장소). 검색 별칭은 `,`로 나눕니다.
- 날짜는 `2026-11-30`처럼 쓰는 것이 가장 안전합니다. `11월 30일`, `2026. 11. 30`, `11/30`도 읽습니다. 모르면 `?`나 비워 둡니다.
- 분야는 음식점·카페·디저트·생활·쇼핑·문화·여가·의료·건강·어학·시험·디지털·구독 중에서 씁니다(`/`는 `·`로 바뀜).
- 대상·조건에 "인사캠/인문사회과학캠퍼스" 또는 "자과캠/자연과학캠퍼스"만 적혀 있으면 그 캠퍼스 한정 혜택이 됩니다.
- "확인 안 되는 것" 칸은 `;`나 `,`로 나누어 상세의 "추가 확인 필요" 상자에 그대로 나옵니다.
- 링크의 `utm_` 같은 추적용 쿼리는 자동으로 지워집니다.
- **혜택 이름을 바꾸면 새 혜택으로 취급**해 번호·id가 새로 붙습니다. 이름을 고쳐야 하면 `data/sheet-map.json`의 `name`도 같이 고칩니다.
- 001 훠궈·002 TOEIC처럼 시트에 없는 항목은 `benefits.json`에 직접 쓴 내용이 유지됩니다.

## 대상자 선택 (첫 화면)
접속하면 "학부 재학생 / 휴학생·졸업생 / 전체 혜택 보기" 카드 3장이 화면 전체에 나옵니다.

- 목록: 모든 혜택을 보여 주되, 공지 '대상' 칸에 내 상황이 적힌 혜택을 위로 올립니다. 종료된 혜택은 그래도 맨 아래입니다.
- 상세: 대상자별 안내 2~3문장 + 도움말(대상 원문·다음 행동). `data/audience-notes.json`에 문구가 있는 혜택은 그 문구를, 없는 혜택은 `js/audience.js`의 자동 규칙을 씁니다.
- 선택은 저장하지 않습니다(새로고침하면 다시 고름). 공유 링크(`#/benefit/<id>`)로 들어오면 '전체 혜택 보기'로 엽니다.
- 시트 동기화는 `audience-notes.json`을 건드리지 않습니다. 공지가 바뀌면 문구를 다시 대조하고 `checkedAt`을 고치세요. `node scripts/check-data.mjs`가 없는 id·오래된 문구를 알려 줍니다.

## benefits.json 직접 고치기 (시트에 없는 항목)

`data/benefits.json`은 배열이며 항목 하나가 혜택 하나입니다.

- **필수:** `id`(영문 소문자-하이픈), `sourceNo`, `name`, `category`, `summary`, `links.source`, `lastCheckedAt`(YYYY-MM-DD)
- **선택:** `highlights`(카드 칩), `keywords`(검색 별칭, 예: "토익". 혜택 내용이 아니라 같은 뜻의 검색어만), `discount`, `target`, `howTo`, `conditions`, `exceptions`, `validity`, `unverified`, `locations`, `links.official`/`links.apply`, `contact`, `media`, `sourceOwner`
- 값이 없으면 화면에 "공식 자료에서 확인되지 않은 정보입니다"로 표시됩니다. **공지에 없는 내용은 추측해서 채우지 마세요.**
- `validity`는 `{ "start": "MM-DD", "end": "MM-DD", "year": 2026 또는 null, "note": "…" }`
  - `year`가 숫자면 종료일이 지나면 자동으로 **종료** 배지가 붙고 목록 아래로 내려갑니다.
  - 종료 7일 전부터 카드와 상세에 "종료 n일 전" 칩이 붙습니다.
  - `year`가 `null`이면 자동 종료 판정을 하지 않고 "연도 확인 필요"로 표시합니다. 올해 기준 종료일이 지나면 "추가 확인 필요" 박스에 연도·연장 확인 안내가 추가됩니다.
- 확인되지 않은 항목은 `unverified`에 `{ "field": "validity", "message": "…" }`로 적으면 상세 상단 "추가 확인 필요" 박스에 나옵니다.
- 카테고리 메뉴는 데이터의 `category` 값으로 자동 생성됩니다.
- 링크에서 `utm_source` 같은 추적용 쿼리는 지워 주세요.
- 목록 정렬은 기본순(근거 번호)·종료 임박순·가나다순·최근 확인순 중에서 고를 수 있고, 종료된 혜택은 항상 맨 아래로 갑니다. 정렬 이름을 바꾸거나 추가하려면 `js/data.js`의 `SORT_OPTIONS`를 고칩니다.
- `campus`는 `"인사캠"`·`"자과캠"`·`null`. 값이 있으면 카드에 "○○ 한정" 칩이 붙고 캠퍼스 필터에 반영됩니다.
- 고친 뒤 `node scripts/check-data.mjs`와 `node scripts/test-logic.mjs`로 오류가 없는지 확인하고, 원문과 대조한 날짜를 `lastCheckedAt`에 적습니다.

## 미디어 넣기

`assets/README.md`의 표에 있는 이름 그대로 파일을 넣으면 코드 수정 없이 표시됩니다. 파일이 없으면 자리표시자 이미지·4단계 안내 카드가 대신 보이고, 음성 플레이어는 숨겨집니다.

지금 들어 있는 이미지·음성·영상은 자동으로 만든 **임시 파일**입니다. 팀이 만든 파일을 같은 이름으로 덮어쓰면 교체되고, `node scripts/check-data.mjs`에서 `임시` / `팀 제작`을 구분해 보여 줍니다. 다시 만드는 방법은 `assets/README.md`에 있습니다.

## GitHub Pages 배포 (무료)

> 무료 계정의 Pages는 **public 저장소**가 필요합니다. 개인정보·키·비공개 자료를 커밋하지 마세요.
> 무료 플랜의 용량·트래픽 제한은 바뀔 수 있으니 배포 전에 GitHub 공식 문서를 확인하세요.

1. GitHub에서 새 저장소를 만듭니다(Public). README 등은 추가하지 않습니다.
2. 로컬에서 원격을 연결하고 올립니다.
   ```powershell
   git remote add origin https://github.com/<계정>/<저장소>.git
   git push -u origin main
   ```
3. 저장소 **Settings → Pages → Build and deployment**에서 Source를 **Deploy from a branch**, Branch를 **main / (root)** 로 선택하고 저장합니다.
4. 1~2분 뒤 `https://<계정>.github.io/<저장소>/` 에서 확인합니다. (`.nojekyll` 파일이 있어 파일이 그대로 게시됩니다.)
5. 배포 후 `docs/test-checklist.md`의 T1~T5를 배포 주소에서 다시 확인합니다.

## 원칙

- 무료 유지: 서버·DB·로그인·결제·유료 API·외부 라이브러리·외부 폰트·분석 스크립트를 쓰지 않습니다.
- 개인정보를 수집하지 않습니다(쿠키·폼 저장·추적 없음).
- 업체 로고·상표 이미지를 쓰지 않고 업체명은 텍스트로만 표기합니다.
- 미디어는 팀이 생성형 AI로 직접 만든 파일만 사용하고, 제작 기록을 `assets/README.md`에 남깁니다.
