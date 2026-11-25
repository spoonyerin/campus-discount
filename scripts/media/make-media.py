"""임시 미디어 생성기 — 혜택 이미지·장면 이미지·공유 이미지·음성·안내 영상·자막

팀이 생성형 AI로 만든 최종 파일을 넣기 전까지 쓰는 '임시' 파일을 만든다.
교체 규칙(중요):
  - 만든 파일은 assets/temp-media.json에 기록한다(파일 해시 포함).
  - 같은 경로에 팀이 만든 파일을 덮어쓰면 해시가 달라지므로, 다음 실행부터 그 파일은 건드리지 않고
    목록에서 뺀다. 즉 "같은 이름으로 덮어쓰기"가 곧 교체다.
  - 데이터(대본·혜택)가 바뀌면 아직 임시인 파일만 다시 만든다.

실행 (Windows, Python 3.10+):
  pip install pillow pymupdf lameenc av      # C: 공간이 부족하면 --target D:\\tools\\pymedia 후 PYTHONPATH 지정
  python scripts/media/make-media.py          # 바뀐 것만 생성
  python scripts/media/make-media.py --only images|audio|video
  python scripts/media/make-media.py --force  # 임시 파일 전부 다시 생성 (팀이 바꾼 파일은 그래도 건드리지 않음)

음성은 Windows 기본 한국어 음성(Microsoft Heami)으로 만든다(scripts/media/tts.ps1).
"""
import argparse
import hashlib
import html
import io
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'assets'
MANIFEST = ASSETS / 'temp-media.json'
DATA = ROOT / 'data' / 'benefits.json'
TTS_PS1 = Path(__file__).with_name('tts.ps1')
VOICE = 'Microsoft Heami Desktop'
GEN_VERSION = '2'  # 그림 규칙을 바꾸면 올려서 임시 파일을 다시 만든다

NAVY = '#0B3B70'
LIME = '#8DC21F'
WHITE = '#FFFFFF'

# 분야별 배경·강조색
PALETTE = {
    '음식점': ('#FFF1E6', '#FFDCC4', '#E8743B'),
    '카페·디저트': ('#F7EEE5', '#E9D6C2', '#9A6338'),
    '생활·쇼핑': ('#F4EEFB', '#E1D3F4', '#7A4FB5'),
    '문화·여가': ('#FFF7DC', '#FFE7A3', '#D99A00'),
    '의료·건강': ('#E7F6F2', '#CBEADF', '#1E8A72'),
    '어학·시험': ('#EAF0F8', '#D3DEEE', '#2F55B4'),
    '디지털·구독': ('#E8F4FC', '#CDE5F5', '#1F7BB8'),
}
DEFAULT_PALETTE = ('#EEF1F5', '#DCE3EC', '#55606E')

# ----------------------------------------------------------------------------- 그림 조각 (200x200, 중심 0,0)

def S(extra=''):
    return f'stroke="{NAVY}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" {extra}'

def steam(x, y):
    return ''.join(
        f'<path d="M{x + dx} {y} c-10 -14 10 -22 0 -38" fill="none" {S("opacity=\".55\"")}/>' for dx in (-28, 0, 28))

MOTIFS = {
    'bowl': lambda a: f'''
      {steam(0, -40)}
      <path d="M-78 -30 L78 -30" {S()}/>
      <path d="M-92 -18 H92 A92 86 0 0 1 -92 -18 Z" fill="{WHITE}" {S()}/>
      <path d="M-74 -2 H74" fill="none" stroke="{a}" stroke-width="10" stroke-linecap="round"/>
      <path d="M40 -96 L96 -28 M58 -104 L104 -40" {S()}/>''',
    'cup': lambda a: f'''
      {steam(-14, -46)}
      <ellipse cx="0" cy="82" rx="96" ry="16" fill="{a}" opacity=".35"/>
      <path d="M-74 -34 H50 V30 A48 48 0 0 1 2 78 H-26 A48 48 0 0 1 -74 30 Z" fill="{WHITE}" {S()}/>
      <path d="M50 -10 h12 a24 24 0 0 1 0 48 h-14" fill="none" {S()}/>
      <path d="M-74 -8 H50" stroke="{a}" stroke-width="10"/>''',
    'headset': lambda a: f'''
      <path d="M-70 20 V-10 A70 70 0 0 1 70 -10 V20" fill="none" {S()}/>
      <rect x="-92" y="0" width="36" height="66" rx="14" fill="{a}" {S()}/>
      <rect x="56" y="0" width="36" height="66" rx="14" fill="{a}" {S()}/>
      <path d="M-74 66 C-74 96 -40 100 -14 100" fill="none" {S()}/>
      <rect x="-20" y="90" width="26" height="18" rx="8" fill="{WHITE}" {S()}/>''',
    'eye': lambda a: f'''
      <path d="M-100 0 C-50 -70 50 -70 100 0 C50 70 -50 70 -100 0 Z" fill="{WHITE}" {S()}/>
      <circle cx="0" cy="0" r="38" fill="{a}" {S()}/>
      <circle cx="0" cy="0" r="16" fill="{NAVY}"/>
      <circle cx="12" cy="-12" r="7" fill="{WHITE}"/>
      <path d="M70 -78 l8 16 16 8 -16 8 -8 16 -8 -16 -16 -8 16 -8z" fill="{LIME}"/>''',
    'suit': lambda a: f'''
      <path d="M0 -96 a14 14 0 1 1 14 14 v10" fill="none" {S()}/>
      <path d="M0 -72 L-96 -26 H96 Z" fill="none" {S()}/>
      <path d="M-70 -30 L-88 96 H88 L70 -30 L24 -30 L0 30 L-24 -30 Z" fill="{a}" {S()}/>
      <path d="M-24 -30 L0 30 L24 -30" fill="{WHITE}" {S()}/>
      <path d="M0 4 l-8 16 8 34 8 -34z" fill="{NAVY}"/>''',
    'clinic': lambda a: f'''
      <circle cx="0" cy="0" r="92" fill="{WHITE}" {S()}/>
      <path d="M-22 -62 H22 V-22 H62 V22 H22 V62 H-22 V22 H-62 V-22 H-22 Z" fill="{a}" {S()}/>''',
    'rehab': lambda a: f'''
      <circle cx="-14" cy="-6" r="80" fill="{WHITE}" {S()}/>
      <path d="M-30 -60 H2 V-30 H32 V2 H2 V32 H-30 V2 H-60 V-30 H-30 Z" fill="{a}" {S()}/>
      <path d="M-100 74 H-40 L-24 44 L-4 100 L14 60 L26 74 H100" fill="none" {S()}/>''',
    'camera': lambda a: f'''
      <path d="M-96 -40 H-44 L-30 -64 H30 L44 -40 H96 V74 H-96 Z" fill="{WHITE}" {S()}/>
      <circle cx="0" cy="16" r="44" fill="{a}" {S()}/>
      <circle cx="0" cy="16" r="20" fill="{WHITE}" {S()}/>
      <rect x="58" y="-26" width="22" height="12" rx="4" fill="{LIME}"/>''',
    'gradcap': lambda a: f'''
      <path d="M-96 -40 H-44 L-30 -64 H30 L44 -40 H96 V74 H-96 Z" fill="{WHITE}" {S()}/>
      <circle cx="0" cy="16" r="44" fill="{a}" {S()}/>
      <circle cx="0" cy="16" r="20" fill="{WHITE}" {S()}/>
      <path d="M38 -96 L108 -76 L38 -56 L-32 -76 Z" fill="{NAVY}"/>
      <path d="M96 -78 V-44" {S()}/><circle cx="96" cy="-40" r="7" fill="{LIME}"/>''',
    'bag': lambda a: f'''
      <path d="M-40 -36 V-54 A40 40 0 0 1 40 -54 V-36" fill="none" {S()}/>
      <path d="M-84 -36 H84 L96 92 H-96 Z" fill="{a}" {S()}/>
      <path d="M30 18 L74 18 L90 34 L74 50 L30 50 Z" fill="{WHITE}" {S()}/>
      <circle cx="44" cy="34" r="5" fill="{NAVY}"/>''',
    'laptop_chart': lambda a: f'''
      <rect x="-86" y="-74" width="172" height="112" rx="10" fill="{WHITE}" {S()}/>
      <path d="M-110 44 H110 L96 74 H-96 Z" fill="{a}" {S()}/>
      <rect x="-56" y="-14" width="22" height="34" fill="{a}"/>
      <rect x="-22" y="-40" width="22" height="60" fill="{LIME}"/>
      <rect x="12" y="-26" width="22" height="46" fill="{a}"/>
      <path d="M-62 20 H48" {S()}/>''',
    'laptop': lambda a: f'''
      <rect x="-86" y="-74" width="172" height="112" rx="10" fill="{WHITE}" {S()}/>
      <path d="M-110 44 H110 L96 74 H-96 Z" fill="{a}" {S()}/>
      <path d="M-30 -32 a42 42 0 0 1 60 0 M-16 -16 a22 22 0 0 1 32 0" fill="none" {S()}/>
      <circle cx="0" cy="2" r="7" fill="{LIME}"/>''',
    'paper': lambda a: f'''
      <rect x="-70" y="-90" width="128" height="176" rx="10" fill="{WHITE}" {S()}/>
      {''.join(f'<circle cx="{-40 + 26 * c}" cy="{-50 + 36 * r}" r="9" fill="{a if (r + c) % 3 == 0 else WHITE}" stroke="{NAVY}" stroke-width="4"/>' for r in range(4) for c in range(4))}
      <path d="M44 74 L100 -6 L116 6 L60 86 L40 92 Z" fill="{LIME}" {S()}/>''',
    'book': lambda a: f'''
      <path d="M0 -60 C-30 -80 -70 -80 -100 -64 V76 C-70 60 -30 60 0 80 C30 60 70 60 100 76 V-64 C70 -80 30 -80 0 -60 Z" fill="{WHITE}" {S()}/>
      <path d="M0 -60 V80" {S()}/>
      <path d="M-76 -30 H-24 M-76 -2 H-24 M24 -30 H76 M24 -2 H76" stroke="{a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M50 -78 V-28 L62 -38 L74 -28 V-78" fill="{LIME}" {S()}/>''',
    'dice': lambda a: f'''
      <rect x="-98" y="-40" width="96" height="96" rx="20" fill="{WHITE}" {S()} transform="rotate(-10 -50 8)"/>
      <rect x="10" y="-70" width="88" height="88" rx="18" fill="{a}" {S()} transform="rotate(12 54 -26)"/>
      <circle cx="-74" cy="-10" r="8" fill="{NAVY}"/><circle cx="-50" cy="12" r="8" fill="{NAVY}"/><circle cx="-26" cy="32" r="8" fill="{NAVY}"/>
      <circle cx="40" cy="-46" r="8" fill="{WHITE}"/><circle cx="68" cy="-4" r="8" fill="{WHITE}"/>''',
    'dumbbell': lambda a: f'''
      <path d="M-56 0 H56" stroke="{NAVY}" stroke-width="14" stroke-linecap="round"/>
      <rect x="-96" y="-50" width="30" height="100" rx="10" fill="{a}" {S()}/>
      <rect x="-66" y="-34" width="18" height="68" rx="6" fill="{WHITE}" {S()}/>
      <rect x="66" y="-50" width="30" height="100" rx="10" fill="{a}" {S()}/>
      <rect x="48" y="-34" width="18" height="68" rx="6" fill="{WHITE}" {S()}/>''',
    'bottle': lambda a: f'''
      <path d="M-62 -96 H-30 V-60 C-6 -48 -6 -30 -6 -20 V86 H-86 V-20 C-86 -30 -86 -48 -62 -60 Z" fill="{WHITE}" {S()}/>
      <path d="M-86 6 H-6 V40 H-86 Z" fill="{a}" opacity=".85"/>
      <path d="M14 20 H100 L90 86 H24 Z" fill="{WHITE}" {S()}/>
      <path d="M22 40 H92" stroke="{a}" stroke-width="10"/>''',
    'holds': lambda a: f'''
      <path d="M-80 -96 L80 -96 L100 96 L-100 96 Z" fill="{WHITE}" {S()}/>
      <circle cx="-40" cy="-56" r="14" fill="{a}"/><circle cx="34" cy="-36" r="12" fill="{LIME}"/>
      <ellipse cx="-14" cy="0" rx="18" ry="12" fill="{NAVY}"/><circle cx="48" cy="34" r="14" fill="{a}"/>
      <ellipse cx="-50" cy="56" rx="16" ry="11" fill="{LIME}"/>
      <path d="M0 -96 C10 -40 -20 20 6 96" fill="none" stroke="{a}" stroke-width="5" stroke-dasharray="4 10"/>''',
    'ticket': lambda a: f'''
      <path d="M-100 -50 H100 V-18 A18 18 0 0 0 100 18 V50 H-100 V18 A18 18 0 0 0 -100 -18 Z" fill="{WHITE}" {S()}/>
      <path d="M40 -40 V-26 M40 -8 V8 M40 26 V40" {S()}/>
      <path d="M-66 30 L4 -30" stroke="{a}" stroke-width="8" stroke-linecap="round"/>
      <circle cx="-58" cy="-20" r="10" fill="none" stroke="{a}" stroke-width="6"/>
      <circle cx="-4" cy="20" r="10" fill="none" stroke="{a}" stroke-width="6"/>''',
}

ALT = {
    'bowl': '김이 나는 냄비 요리 일러스트', 'cup': '김이 나는 커피잔 일러스트', 'headset': '마이크가 달린 헤드셋 일러스트',
    'eye': '눈 모양 일러스트', 'suit': '옷걸이에 걸린 정장 재킷 일러스트', 'clinic': '병원 십자 표시 일러스트',
    'rehab': '병원 십자 표시와 심박 그래프 일러스트', 'camera': '사진기 일러스트', 'gradcap': '사진기와 학사모 일러스트',
    'bag': '쇼핑백과 가격표 일러스트', 'laptop_chart': '막대그래프가 띄워진 노트북 일러스트', 'laptop': '와이파이 표시가 있는 노트북 일러스트',
    'paper': '답안지와 연필 일러스트', 'book': '펼쳐진 책 일러스트', 'dice': '주사위 두 개 일러스트', 'dumbbell': '아령 일러스트',
    'bottle': '막걸리 병과 잔 일러스트', 'holds': '클라이밍 벽과 홀드 일러스트', 'ticket': '할인 쿠폰 일러스트',
}

# 혜택 id → 그림. 없으면 분야 기본 그림.
BENEFIT_MOTIF = {
    'yonggah-hotpot': 'bowl', 'toeic-speaking': 'headset', 'balgeun-eye-clinic': 'eye', 'dalkom-suit': 'suit',
    'wonmoa-clinics': 'clinic', 'jolupitzi-snap': 'gradcap', 'ddp-design-store': 'bag', 'spss-license': 'laptop_chart',
    'sdij-leet-mock': 'paper', 'conects-ydg-hssc': 'book', 'conects-ydg-nsc': 'book', 'holmes-lupin-boardgame': 'dice',
    'aju-rehab-clinic': 'rehab', 'vitamin-fitness-pt': 'dumbbell', 'shein-new-customer': 'bag', 'from-hearts-coffee': 'cup',
    'seopi-dongpa': 'bottle', 'mr-photo': 'camera', 'alle-climbing': 'holds', 'laptop-rental': 'laptop',
}
CATEGORY_MOTIF = {
    '음식점': 'bowl', '카페·디저트': 'cup', '생활·쇼핑': 'bag', '문화·여가': 'ticket',
    '의료·건강': 'clinic', '어학·시험': 'book', '디지털·구독': 'laptop',
}

def seeded(text, n):
    h = hashlib.sha256(text.encode()).digest()
    return [h[i] / 255 for i in range(n)]

def benefit_svg(b):
    bg1, bg2, accent = PALETTE.get(b['category'], DEFAULT_PALETTE)
    motif = BENEFIT_MOTIF.get(b['id']) or CATEGORY_MOTIF.get(b['category'], 'ticket')
    r = seeded(b['id'], 6)
    c1 = (560 + 200 * r[0], 40 + 80 * r[1], 110 + 60 * r[2])
    c2 = (60 + 160 * r[3], 420 + 60 * r[4], 70 + 50 * r[5])
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="{bg1}"/>
  <path d="M800 0 V500 H0 Z" fill="{bg2}" opacity=".55"/>
  <circle cx="{c1[0]:.0f}" cy="{c1[1]:.0f}" r="{c1[2]:.0f}" fill="{LIME}" opacity=".22"/>
  <circle cx="{c2[0]:.0f}" cy="{c2[1]:.0f}" r="{c2[2]:.0f}" fill="{NAVY}" opacity=".08"/>
  <circle cx="{700 - 500 * r[2]:.0f}" cy="{380 + 60 * r[0]:.0f}" r="10" fill="{accent}" opacity=".5"/>
  <circle cx="{120 + 200 * r[4]:.0f}" cy="{90 + 40 * r[3]:.0f}" r="7" fill="{NAVY}" opacity=".25"/>
  <ellipse cx="400" cy="400" rx="180" ry="20" fill="{NAVY}" opacity=".08"/>
  <g transform="translate(400 245) scale(1.45)">{MOTIFS[motif](accent)}</g>
</svg>'''
    return svg, ALT[motif]

# ----------------------------------------------------------------------------- 장면 이미지 (1280x800, 글자 없음)

def bar(x, y, w, h=14, color='#C9D3E1', rx=7):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{color}"/>'

def mini(motif, x, y, scale, accent):
    return f'<g transform="translate({x} {y}) scale({scale})">{MOTIFS[motif](accent)}</g>'

def scene_svg(n):
    # 그라데이션(url 참조)은 렌더러(pymupdf)에서 검게 나오므로 단색 두 겹으로 표현한다
    bg = f'''<rect width="1280" height="800" fill="#F4F6F9"/><path d="M1280 0 V800 H0 Z" fill="#E3EAF4" opacity=".7"/>
  <circle cx="1150" cy="120" r="180" fill="{LIME}" opacity=".18"/><circle cx="120" cy="720" r="160" fill="{NAVY}" opacity=".07"/>'''
    if n == 1:  # 혜택을 놓치는 학생 → 사이트 발견: 흩어진 쿠폰을 돋보기로 찾기
        body = f'''
  <g opacity=".45">{mini('ticket', 260, 230, .9, '#E8743B')}{mini('ticket', 1010, 560, .8, '#7A4FB5')}{mini('ticket', 300, 600, .7, '#1E8A72')}</g>
  <rect x="470" y="110" width="340" height="600" rx="44" fill="{WHITE}" stroke="{NAVY}" stroke-width="10"/>
  <rect x="510" y="170" width="260" height="70" rx="14" fill="{NAVY}"/>{bar(530, 198, 120, 14, LIME)}
  {mini('ticket', 640, 330, .8, '#E8743B')}{mini('ticket', 640, 470, .8, '#2F55B4')}{mini('ticket', 640, 610, .8, '#1E8A72')}
  <circle cx="900" cy="300" r="96" fill="{WHITE}" fill-opacity=".6" stroke="{NAVY}" stroke-width="16"/>
  <path d="M968 368 L1060 460" stroke="{NAVY}" stroke-width="26" stroke-linecap="round"/>
  <path d="M870 300 h60 M900 270 v60" stroke="{LIME}" stroke-width="14" stroke-linecap="round"/>'''
    elif n == 2:  # 분야별 목록
        cats = list(CATEGORY_MOTIF.items())
        tiles = ''
        for i, (cat, motif) in enumerate(cats + [('전체', 'ticket')]):
            col, row = i % 4, i // 4
            x, y = 190 + col * 240, 170 + row * 260
            accent = PALETTE.get(cat, DEFAULT_PALETTE)[2]
            sel = i == 0
            tiles += f'''<rect x="{x}" y="{y}" width="200" height="220" rx="28" fill="{PALETTE.get(cat, DEFAULT_PALETTE)[0]}" stroke="{NAVY if sel else '#C9D3E1'}" stroke-width="{8 if sel else 4}"/>
  {mini(motif, x + 100, y + 95, .55, accent)}{bar(x + 50, y + 172, 100, 14, NAVY if sel else '#B4C0D0')}'''
        body = tiles
    elif n == 3:  # 상세 보기
        body = f'''
  <rect x="200" y="90" width="880" height="620" rx="36" fill="{WHITE}" stroke="{NAVY}" stroke-width="8"/>
  {bar(260, 140, 90, 28, '#FFDCC4', 14)}{bar(260, 190, 420, 34, NAVY, 10)}
  <rect x="260" y="260" width="460" height="90" rx="18" fill="#EEF6DC" stroke="{LIME}" stroke-width="6"/>{bar(290, 290, 220, 18, '#3F6B0A', 9)}{bar(290, 318, 320, 12, '#9BBF5A', 6)}
  {''.join(bar(260, 390 + 46 * i, 70, 14, '#8C99AA') + bar(360, 390 + 46 * i, 300 - 40 * (i % 3), 14) for i in range(6))}
  <rect x="760" y="250" width="270" height="190" rx="20" fill="#FFF1E6"/>{mini('bowl', 895, 350, .55, '#E8743B')}
  <rect x="760" y="470" width="270" height="90" rx="20" fill="{NAVY}"/>
  <path d="M800 500 h18 l22 -18 v56 l-22 -18 h-18 z" fill="{WHITE}"/>
  <path d="M858 496 a20 20 0 0 1 0 28 M872 486 a36 36 0 0 1 0 48" fill="none" stroke="{LIME}" stroke-width="6" stroke-linecap="round"/>
  {bar(900, 500, 100, 14, '#8FA6C8')}{bar(900, 526, 70, 10, '#6D86AE')}'''
    else:  # 공식 링크
        body = f'''
  <rect x="200" y="150" width="520" height="500" rx="36" fill="{WHITE}" stroke="{NAVY}" stroke-width="8"/>
  {mini('ticket', 460, 300, 1.1, '#2F55B4')}
  {bar(270, 430, 380, 20, '#C9D3E1', 10)}{bar(270, 466, 300, 20, '#C9D3E1', 10)}
  <rect x="270" y="530" width="380" height="80" rx="18" fill="#2F55B4"/>{bar(330, 562, 200, 16, WHITE, 8)}
  <path d="M590 556 l20 14 -20 14" fill="none" stroke="{WHITE}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M700 570 C800 570 820 420 900 400" fill="none" stroke="{NAVY}" stroke-width="10" stroke-dasharray="4 22" stroke-linecap="round"/>
  <rect x="860" y="220" width="300" height="340" rx="30" fill="{WHITE}" stroke="{NAVY}" stroke-width="8"/>
  <rect x="860" y="220" width="300" height="70" rx="30" fill="{NAVY}"/><rect x="860" y="260" width="300" height="30" fill="{NAVY}"/>
  {bar(900, 330, 220, 16)}{bar(900, 366, 180, 16)}{bar(900, 402, 200, 16)}
  <circle cx="1100" cy="500" r="54" fill="{LIME}"/><path d="M1076 500 l18 18 34 -36" fill="none" stroke="{NAVY}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>'''
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">{bg}{body}</svg>'

def og_svg():
    items = [('bowl', '#E8743B'), ('cup', '#9A6338'), ('bag', '#7A4FB5'), ('book', '#2F55B4'), ('clinic', '#1E8A72'), ('laptop', '#1F7BB8')]
    circles = ''.join(
        f'<circle cx="{170 + i * 172}" cy="{430 + (40 if i % 2 else 0)}" r="78" fill="{WHITE}"/>{mini(m, 170 + i * 172, 430 + (40 if i % 2 else 0), .5, a)}'
        for i, (m, a) in enumerate(items))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="{NAVY}"/>
  <circle cx="1080" cy="80" r="200" fill="{LIME}" opacity=".25"/><circle cx="80" cy="40" r="120" fill="{WHITE}" opacity=".06"/>
  <g transform="translate(600 200) scale(1.6)">{MOTIFS['ticket'](LIME)}</g>
  {circles}
</svg>'''

# ----------------------------------------------------------------------------- 공통: 기록·렌더링

def sha(data):
    return hashlib.sha256(data).hexdigest()

class Manifest:
    def __init__(self):
        self.items = json.loads(MANIFEST.read_text('utf-8')) if MANIFEST.exists() else {}
        self.replaced = []

    def is_temp(self, rel):
        """파일이 없거나, 우리가 만든 그대로면 True. 팀이 바꿨으면 False(목록에서 제거)."""
        p = ROOT / rel
        if not p.exists():
            return True
        rec = self.items.get(rel)
        if rec and rec['sha256'] == sha(p.read_bytes()):
            return True
        if rec:
            self.replaced.append(rel)
            del self.items[rel]
        return False

    def needs(self, rel, input_key, force):
        if not self.is_temp(rel):
            return False
        rec = self.items.get(rel)
        return force or not (ROOT / rel).exists() or not rec or rec.get('input') != input_key

    def record(self, rel, data, input_key, note):
        p = ROOT / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        self.items[rel] = {'sha256': sha(data), 'input': input_key, 'note': note}

    def save(self):
        MANIFEST.write_text(json.dumps(dict(sorted(self.items.items())), ensure_ascii=False, indent=2) + '\n', 'utf-8')

def svg_to_webp(svg, width, height, quality=80, crop=None):
    import pymupdf
    from PIL import Image
    doc = pymupdf.open(stream=svg.encode('utf-8'), filetype='svg')
    page = doc[0]
    zoom = width / page.rect.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    if crop:
        img = img.crop(crop)
    if img.size != (width, height) and not crop:
        img = img.resize((width, height), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'WEBP', quality=quality, method=6)
    return buf.getvalue(), img

def tts_wav(text, rate=0):
    with tempfile.TemporaryDirectory() as tmp:
        txt = Path(tmp, 't.txt')
        wav = Path(tmp, 't.wav')
        txt.write_text(text, 'utf-8')
        subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(TTS_PS1),
                        '-TextFile', str(txt), '-OutWav', str(wav), '-Voice', VOICE, '-Rate', str(rate)],
                       check=True, capture_output=True)
        with wave.open(str(wav)) as w:
            return w.getframerate(), w.readframes(w.getnframes())

def mp3(rate, pcm, kbps=64):
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(pcm) + enc.flush()

# ----------------------------------------------------------------------------- 작업

def make_images(data, man, force):
    changed_alt = False
    for b in data:
        rel = f'assets/img/benefits/{b["id"]}.webp'
        svg, alt = benefit_svg(b)
        key = sha((GEN_VERSION + svg).encode())
        if man.needs(rel, key, force):
            webp, _ = svg_to_webp(svg, 800, 500)
            man.record(rel, webp, key, '자동 생성 일러스트(임시)')
            print(f'  이미지  {rel} ({len(webp) // 1024}KB)')
        if man.is_temp(rel) and b.get('media') and b['media'].get('imageAlt') != alt:
            b['media']['imageAlt'] = alt  # 임시 이미지에 맞는 설명. 팀 이미지로 바꾸면 직접 고친다.
            changed_alt = True
    for n in range(1, 5):
        rel = f'assets/img/scenes/scene-{n}.webp'
        svg = scene_svg(n)
        key = sha((GEN_VERSION + svg).encode())
        if man.needs(rel, key, force):
            webp, _ = svg_to_webp(svg, 1280, 800, quality=78)
            man.record(rel, webp, key, f'안내 4단계 장면 {n} 일러스트(임시)')
            print(f'  장면    {rel} ({len(webp) // 1024}KB)')
    rel = 'assets/img/og.webp'
    svg = og_svg()
    key = sha((GEN_VERSION + svg).encode())
    if man.needs(rel, key, force):
        webp, _ = svg_to_webp(svg, 1200, 630)
        man.record(rel, webp, key, '공유 미리보기 일러스트(임시)')
        print(f'  공유    {rel} ({len(webp) // 1024}KB)')
    return changed_alt

def make_audio(data, man, force):
    for b in data:
        script = (b.get('media') or {}).get('audioScript')
        rel = (b.get('media') or {}).get('audio')
        if not script or not rel:
            continue
        key = sha(f'{GEN_VERSION}|{VOICE}|{script}'.encode())
        if man.needs(rel, key, force):
            rate, pcm = tts_wav(script)
            data_mp3 = mp3(rate, pcm)
            man.record(rel, data_mp3, key, f'Windows 기본 음성({VOICE}) TTS(임시)')
            print(f'  음성    {rel} ({len(pcm) / 2 / rate:.1f}초, {len(data_mp3) // 1024}KB)')

def scene_texts():
    html_text = (ROOT / 'index.html').read_text('utf-8')
    texts = [html.unescape(re.sub(r'\s+', ' ', t)).strip() for t in re.findall(r'<p class="step__text">(.*?)</p>', html_text, re.S)]
    if len(texts) != 4:
        sys.exit('index.html에서 4단계 안내 문구를 찾지 못했습니다.')
    return texts

def wrap2(text, limit=26):
    """자막 한 큐를 2줄 이하로: 길면 가운데에 가까운 공백에서 나눈다."""
    if len(text) <= limit:
        return text
    mid = len(text) // 2
    spaces = [i for i, ch in enumerate(text) if ch == ' ']
    cut = min(spaces, key=lambda i: abs(i - mid)) if spaces else mid
    return text[:cut].strip() + '\n' + text[cut:].strip()

def vtt_time(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f'{int(h):02d}:{int(m):02d}:{s:06.3f}'

def make_video(man, force):
    texts = scene_texts()
    svgs = [scene_svg(n) for n in range(1, 5)]
    key = sha(f'{GEN_VERSION}|{VOICE}|{json.dumps(texts, ensure_ascii=False)}|{"".join(svgs)}'.encode())
    rel_video, rel_vtt, rel_poster = 'assets/video/intro.mp4', 'assets/video/intro.ko.vtt', 'assets/video/intro-poster.webp'
    # 자막은 영상과 함께 만든다(영상 길이에 맞춘 시간). 팀이 자막을 고쳤으면 영상도 건드리지 않는다.
    # 단, 영상이 아직 없을 때의 자막은 시간이 정해지지 않은 초안이므로 새 영상에 맞춰 다시 쓴다(원본은 git 기록에 있음).
    video_exists = (ROOT / rel_video).exists()
    vtt_temp = man.is_temp(rel_vtt) or not video_exists
    if not vtt_temp and not man.is_temp(rel_video):
        return
    if video_exists and not (man.needs(rel_video, key, force) or man.needs(rel_poster, key, force) or man.needs(rel_vtt, key, force)):
        return
    if not man.is_temp(rel_video) or not vtt_temp:
        print('  영상과 자막 중 하나만 팀 파일로 바뀌어 있어 영상을 다시 만들지 않습니다. 둘 다 바꾸거나 둘 다 임시로 두세요.')
        return
    import av
    import numpy as np
    from PIL import Image

    W, H, FPS, PAD, FADE = 1280, 720, 24, 0.7, 0.5
    voices = [tts_wav(t) for t in texts]
    rate = voices[0][0]
    durations = [len(pcm) / 2 / rate + PAD for _, pcm in voices]
    starts = [sum(durations[:i]) for i in range(4)]
    total = sum(durations)
    pcm_all = b''.join(pcm + b'\x00\x00' * int(PAD * rate) for _, pcm in voices)

    # 장면 이미지를 영상 비율(16:9)로: 1280x800에서 위아래 40px 잘라 냄. 살짝 확대(줌인) 효과용으로 크게 렌더링.
    BIG = 1.08
    bases = []
    for svg in svgs:
        _, img = svg_to_webp(svg, int(1280 * BIG), int(800 * BIG))
        top = int(40 * BIG)
        bases.append(img.crop((0, top, int(1280 * BIG), top + int(720 * BIG))))

    def frame_at(i, t):
        p = min(1.0, t / durations[i])
        z = BIG - (BIG - 1.0) * (1 - p)  # 1.0 → BIG 로 줌인: 잘라 낼 영역을 줄인다
        bw, bh = bases[i].size
        cw, ch = bw / z, bh / z
        x0, y0 = (bw - cw) / 2, (bh - ch) / 2
        return bases[i].crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((W, H), Image.BILINEAR)

    # faststart(재생 정보 앞으로 옮기기)는 파일 출력에서만 동작하므로 임시 파일에 쓴다
    tmp_dir = tempfile.TemporaryDirectory()
    out_path = Path(tmp_dir.name, 'intro.mp4')
    container = av.open(str(out_path), mode='w', format='mp4', options={'movflags': 'faststart'})
    vs = container.add_stream('libx264', rate=FPS)
    vs.width, vs.height, vs.pix_fmt = W, H, 'yuv420p'
    vs.options = {'crf': '27', 'preset': 'medium'}
    as_ = container.add_stream('aac', rate=rate)
    as_.layout = 'mono'

    n_frames = int(math.ceil(total * FPS))
    for f in range(n_frames):
        t = f / FPS
        i = max(k for k in range(4) if starts[k] <= t)
        img = frame_at(i, t - starts[i])
        if i < 3 and t > starts[i + 1] - FADE:  # 다음 장면으로 서서히 전환
            a = (t - (starts[i + 1] - FADE)) / FADE
            img = Image.blend(img, frame_at(i + 1, 0), a)
        frame = av.VideoFrame.from_image(img)
        for pkt in vs.encode(frame):
            container.mux(pkt)
    for pkt in vs.encode():
        container.mux(pkt)

    samples = np.frombuffer(pcm_all, dtype=np.int16)
    chunk = 1024
    for k in range(0, len(samples), chunk):
        part = samples[k:k + chunk]
        if len(part) < chunk:
            part = np.pad(part, (0, chunk - len(part)))
        af = av.AudioFrame.from_ndarray(part.reshape(1, -1), format='s16', layout='mono')
        af.sample_rate = rate
        af.pts = k
        for pkt in as_.encode(af):
            container.mux(pkt)
    for pkt in as_.encode():
        container.mux(pkt)
    container.close()
    video = out_path.read_bytes()
    tmp_dir.cleanup()

    # 자막: 장면 문장을 나누고, 장면 길이 안에서 글자 수 비율로 시간 배분
    cues = []
    for i, text in enumerate(texts):
        sents = [s.strip() for s in re.split(r'(?<=[?!.])\s+|(?<=,)\s+(?=\S{2,})', text) if s.strip()]
        # 너무 짧은 조각은 붙인다: 쉼표로 끝나면 다음 조각 앞에, 아니면 앞 조각 뒤에
        merged, carry = [], ''
        for s in sents:
            s = f'{carry} {s}'.strip() if carry else s
            carry = ''
            if len(s) < 12 and s.endswith(','):
                carry = s
            elif merged and len(s) < 12:
                merged[-1] += ' ' + s
            else:
                merged.append(s)
        if carry:
            merged.append(carry)
        speak = durations[i] - PAD
        total_chars = sum(len(s) for s in merged)
        t = starts[i]
        for s in merged:
            d = speak * len(s) / total_chars
            cues.append((t, t + d + (PAD if s is merged[-1] else 0), wrap2(s)))
            t += d
    vtt = 'WEBVTT\n\nNOTE\n자동 생성 자막(임시). 영상과 함께 scripts/media/make-media.py가 만든다.\n\n' + '\n'.join(
        f'{n}\n{vtt_time(a)} --> {vtt_time(b)}\n{txt}\n' for n, (a, b, txt) in enumerate(cues, 1))

    poster_img = bases[0].resize((W, H), Image.LANCZOS)
    buf = io.BytesIO()
    poster_img.save(buf, 'WEBP', quality=80, method=6)

    man.record(rel_video, video, key, f'장면 일러스트 + Windows 기본 음성({VOICE}) 나레이션(임시)')
    man.record(rel_vtt, vtt.encode('utf-8'), key, '영상 길이에 맞춘 자막(임시)')
    man.record(rel_poster, buf.getvalue(), key, '영상 첫 장면(임시)')
    print(f'  영상    {rel_video} ({total:.1f}초, {len(video) / 1024 / 1024:.2f}MB), 자막 {len(cues)}큐, 포스터')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', choices=['images', 'audio', 'video'])
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()

    data = json.loads(DATA.read_text('utf-8'))
    man = Manifest()
    alt_changed = False
    if args.only in (None, 'images'):
        alt_changed = make_images(data, man, args.force)
    if args.only in (None, 'audio'):
        make_audio(data, man, args.force)
    if args.only in (None, 'video'):
        make_video(man, args.force)
    man.save()
    if alt_changed:
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', 'utf-8', newline='\n')
        print('  data/benefits.json의 imageAlt를 임시 이미지 설명으로 맞췄습니다.')
    if man.replaced:
        print('팀 파일로 교체되어 임시 목록에서 뺀 파일:')
        for r in man.replaced:
            print(f'  - {r}')
    print(f'임시 파일 {len(man.items)}개 (assets/temp-media.json)')

if __name__ == '__main__':
    main()
