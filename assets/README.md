# 미디어 에셋 목록

사이트는 아래 파일이 **없어도 정상 동작**합니다(자리표시자 이미지·4단계 안내 카드로 대체, 음성 플레이어는 숨김).
파일을 넣으면 코드 수정 없이 자동으로 표시됩니다. 런타임에 외부 서비스를 호출하지 않습니다.

## 넣을 파일과 규격

| 종류 | 경로/파일명 | 형식·권장 사양 | 상태 |
|---|---|---|---|
| 혜택 이미지 | `img/benefits/yonggah-hotpot.webp` | WebP, 가로 800px 내외, 150KB 이하 | 미제작 |
| 혜택 이미지 | `img/benefits/toeic-speaking.webp` | 〃 | 미제작 |
| 혜택 이미지 | `img/benefits/balgeun-eye-clinic.webp` | 〃 | 미제작 |
| 장면 이미지 | `img/scenes/scene-1.webp` ~ `scene-4.webp` | WebP, 16:10, 150KB 이하 | 미제작 |
| 음성 | `audio/yonggah-hotpot.mp3` | mp3, 모노, 64~96kbps, 약 20초 | 미제작 |
| 음성 | `audio/toeic-speaking.mp3` | 〃 | 미제작 |
| 음성 | `audio/balgeun-eye-clinic.mp3` | 〃 | 미제작 |
| 영상 | `video/intro.mp4` | H.264/AAC, 720p, 약 40초, 10MB 이하 | 미제작 |
| 영상 포스터 | `video/intro-poster.webp` | 영상 첫 화면 캡처 | 미제작 |
| 영상 자막 | `video/intro.ko.vtt` | WebVTT (계획서의 영상 나레이션 4장면 기준) | **작성 완료** — 실제 영상 길이에 맞춰 시간 조정 |
| 공유 미리보기 | `img/og.webp` | 1200×630 | 미제작 |
| 자리표시자 | `img/placeholder.svg`, `img/favicon.svg` | 팀이 직접 작성한 SVG (외부 소스 없음) | 완료 |

### 제작 시 주의
- **로고·상표·실존 인물 얼굴·글자가 들어간 이미지 금지.** 글자는 HTML로 표시합니다.
- 음성 대본은 `data/benefits.json`의 `media.audioScript`를 그대로 읽어 주세요. 대본은 공지 원문 내용만 담고 있습니다. 공지 내용이 바뀌면 대본과 음성을 함께 갱신합니다.
- 이미지를 넣은 뒤 `data/benefits.json`의 `media.imageAlt`가 **실제 이미지 내용과 맞는지** 확인하고 고칩니다.
- 영상 장면 2 나레이션의 "교통·문화생활·디지털"은 현재 데이터 분야(음식점·어학·시험·의료·건강)와 다릅니다. 팀에서 결정이 필요합니다.
- 각 도구의 무료 한도·공개/상업 이용 조건은 수시로 바뀌므로 **파일을 넣기 전에 현재 약관을 확인**하고 아래 표에 날짜를 남깁니다.

## 제작 기록 (파일을 넣을 때 작성)

| 파일 | 제작 도구 | 생성일 | 프롬프트 요약 | 이용 조건 확인일 / 확인 내용 |
|---|---|---|---|---|
| (예) img/benefits/yonggah-hotpot.webp | (도구 이름) | YYYY-MM-DD | 훠궈 냄비와 재료, 로고·글자 없음 | YYYY-MM-DD / 공개 웹사이트 사용 가능 여부 |
| | | | | |
