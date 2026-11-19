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
data/benefits.json    혜택 데이터 (유일한 원본)
assets/               이미지·음성·영상 (목록은 assets/README.md)
docs/test-checklist.md 테스트 체크리스트
scripts/check-data.mjs 데이터·미디어 점검 스크립트
scripts/test-logic.mjs 검색·기간 처리 시험 스크립트
```

## 혜택 추가·수정 (JSON만 고치면 됩니다)

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
- 고친 뒤 `node scripts/check-data.mjs`와 `node scripts/test-logic.mjs`로 오류가 없는지 확인하고, 원문과 대조한 날짜를 `lastCheckedAt`에 적습니다.

## 미디어 넣기

`assets/README.md`의 표에 있는 이름 그대로 파일을 넣으면 코드 수정 없이 표시됩니다. 파일이 없으면 자리표시자 이미지·4단계 안내 카드가 대신 보이고, 음성 플레이어는 숨겨집니다.

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
