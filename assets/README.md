# 미디어 에셋 목록

사이트는 아래 파일이 **없어도 정상 동작**합니다(자리표시자 이미지·4단계 안내 카드로 대체, 음성 플레이어는 숨김).
파일을 넣으면 코드 수정 없이 자동으로 표시됩니다. 런타임에 외부 서비스를 호출하지 않습니다.

## 지금 들어 있는 파일은 "임시"입니다 (2026-11-26)

발표 준비 시간이 부족할 때를 대비해 아래 파일을 자동으로 만들어 두었습니다. 목록은 `assets/temp-media.json`에 있습니다.

| 종류 | 만든 방법 |
|---|---|
| 혜택 이미지 20개, 장면 이미지 4개, 공유 이미지, 영상 포스터 | 코드로 그린 단순 일러스트(SVG → WebP). 로고·글자·인물 없음 |
| 음성 20개 | `data/benefits.json`의 `media.audioScript`를 Windows 기본 한국어 음성(Microsoft Heami)으로 읽은 TTS |
| 안내 영상 `intro.mp4` (약 55초) | 장면 이미지 4장 + 첫 화면 4단계 문구를 같은 TTS로 읽은 나레이션 |
| 자막 `intro.ko.vtt` | 위 영상 길이에 맞춰 자동 계산 |

**교체 방법:** 팀이 만든 파일을 **같은 경로·같은 이름으로 덮어쓰면 끝**입니다. 코드는 고치지 않습니다.
- `node scripts/check-data.mjs`의 "미디어 파일" 목록에 `있음(임시)` / `있음(팀 제작)`으로 구분되어 나옵니다.
- 이미지를 바꾸면 `data/benefits.json`의 그 혜택 `media.imageAlt`를 새 이미지 설명으로 고칩니다.
- 영상을 바꿀 때는 **영상·자막을 같이** 바꿉니다(자막 시간이 영상 길이에 맞아야 함). 포스터는 영상 첫 화면 캡처로 바꿉니다.
- 음성 대본(`audioScript`)은 시트 동기화를 해도 유지됩니다. 팀 음성을 녹음하면 실제로 읽은 대본으로 고칩니다.
- Windows 기본 음성(SAPI)으로 만든 음성을 공개 사이트에 계속 쓸지는 발표 전에 팀이 Microsoft 이용 조건을 확인합니다. 확인이 어려우면 클로바더빙 등 계획서의 도구로 바꿉니다.

**임시 파일 다시 만들기** (혜택이 늘었거나 대본·문구가 바뀌었을 때). 팀이 바꾼 파일은 건드리지 않습니다.
```powershell
pip install pillow pymupdf lameenc av     # 처음 한 번 (C: 공간이 부족하면 --target D:\tools\pymedia 후 $env:PYTHONPATH="D:\tools\pymedia")
python scripts/media/make-media.py        # 바뀐 것만 생성
python scripts/media/make-media.py --only audio   # images | audio | video 중 하나만
```

## 넣을 파일과 규격

| 종류 | 경로/파일명 | 형식·권장 사양 | 상태 |
|---|---|---|---|
| 혜택 이미지 | `img/benefits/<혜택 id>.webp` (아래 표) | WebP, 가로 800px 내외, 150KB 이하 | 임시 |
| 장면 이미지 | `img/scenes/scene-1.webp` ~ `scene-4.webp` | WebP, 16:10, 150KB 이하 | 임시 |
| 음성 | `audio/<혜택 id>.mp3` (아래 표) | mp3, 모노, 64~96kbps | 임시 |
| 영상 | `video/intro.mp4` | H.264/AAC, 720p, 10MB 이하 | 임시 |
| 영상 포스터 | `video/intro-poster.webp` | 영상 첫 화면 캡처 | 임시 |
| 영상 자막 | `video/intro.ko.vtt` | WebVTT, 한 큐 2줄 이하 | 임시 (영상 길이에 맞춤) |
| 공유 미리보기 | `img/og.webp` | 1200×630 | 임시 |
| 자리표시자 | `img/placeholder.svg`, `img/favicon.svg` | 팀이 직접 작성한 SVG (외부 소스 없음) | 완료 |

### 혜택별 파일 이름 (id)

이미지는 `img/benefits/<id>.webp`, 음성은 `audio/<id>.mp3`로 넣습니다. 시트에서 새로 생긴 혜택의 id는 `data/sheet-map.json`에서 확인합니다.
이미지를 넣은 뒤 `media.imageAlt`를 실제 이미지 설명으로, 음성을 넣은 뒤 `media.audioScript`에 읽은 대본을 `data/benefits.json`에 적습니다(시트 동기화 후에도 유지됨).

| 번호 | 혜택 | id |
|---|---|---|
| 001 | 용가회전훠궈 대학로점 | `yonggah-hotpot` |
| 002 | TOEIC Speaking 응시료 할인 | `toeic-speaking` |
| 003 | S'PEAK X 밝은성모안과 제휴 혜택 | `balgeun-eye-clinic` |
| 004 | 달콤정장 정장세트 대여 할인 | `dalkom-suit` |
| 005 | 원모아 제휴병원 할인 | `wonmoa-clinics` |
| 006 | 졸업이찌 졸업스냅 제휴 | `jolupitzi-snap` |
| 007 | DDP 디자인스토어 할인 | `ddp-design-store` |
| 008 | 2026학년도 SPSS 소프트웨어 라이선스 | `spss-license` |
| 009 | S’PEAK X 시대인재LEET - 얼리버드 단체 접수 | `sdij-leet-mock` |
| 010 | S'PEAK X 커넥츠영단기 제휴 (영단기 패키지) | `conects-ydg-hssc` |
| 011 | 홈즈앤루팡24 오티티 보드게임 플러스 대학로점 | `holmes-lupin-boardgame` |
| 012 | 비급여 치료 지원 | `aju-rehab-clinic` |
| 013 | 비타민휘트니스 율전점 4:1 PT 특별 패키지 | `vitamin-fitness-pt` |
| 014 | 커넥츠 영단기 신학기 대학생 필수 스펙 장학지원 | `conects-ydg-nsc` |
| 015 | SHEIN(쉬인) 신규 고객 할인 이벤트 | `shein-new-customer` |
| 016 | 프롬하츠 커피 대학로점 SKKUPASS 혜택 | `from-hearts-coffee` |
| 017 | 서피동파 SKKUPASS 혜택 | `seopi-dongpa` |
| 018 | 미스터포토 대학로점 SKKUPASS 혜택 | `mr-photo` |
| 019 | 알레클라이밍 혜화점 SKKUPASS 혜택 | `alle-climbing` |
| 020 | 노트북 무료 대여 | `laptop-rental` |

### 제작 시 주의
- **로고·상표·실존 인물 얼굴·글자가 들어간 이미지 금지.** 글자는 HTML로 표시합니다.
- 음성 대본은 `data/benefits.json`의 `media.audioScript`를 그대로 읽어 주세요. 대본은 공지 원문 내용만 담고 있습니다. 공지 내용이 바뀌면 대본과 음성을 함께 갱신합니다.
- 이미지를 넣은 뒤 `data/benefits.json`의 `media.imageAlt`가 **실제 이미지 내용과 맞는지** 확인하고 고칩니다.
- 영상 장면 2 나레이션은 실제 분야에 맞춰 "먼저, 음식점부터 어학·시험, 의료·건강까지!"로 바뀌었습니다(첫 화면 안내 카드·자막 동일). 영상 음성도 이 문구로 녹음해야 자막과 맞습니다. 분야가 늘거나 바뀌면 세 곳을 함께 고칩니다.
- 각 도구의 무료 한도·공개/상업 이용 조건은 수시로 바뀌므로 **파일을 넣기 전에 현재 약관을 확인**하고 아래 표에 날짜를 남깁니다.

## 제작 기록 (파일을 넣을 때 작성)

| 파일 | 제작 도구 | 생성일 | 프롬프트 요약 | 이용 조건 확인일 / 확인 내용 |
|---|---|---|---|---|
| 임시 파일 전체 (`assets/temp-media.json`) | 직접 작성한 SVG + Pillow·PyMuPDF(이미지), Windows 기본 음성 Microsoft Heami + LAME(음성), PyAV/FFmpeg(영상) | 2026-11-26 | 혜택·분야별 단순 일러스트, 대본은 `audioScript` 그대로 | (팀 확인 필요) / Windows 음성의 공개 사이트 사용 조건 |
| (예) img/benefits/yonggah-hotpot.webp | (도구 이름) | YYYY-MM-DD | 훠궈 냄비와 재료, 로고·글자 없음 | YYYY-MM-DD / 공개 웹사이트 사용 가능 여부 |
| | | | | |
