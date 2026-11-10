# -*- coding: utf-8 -*-
"""Генератор презентации Olimpik в стиле референса Chinatown."""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.oxml.ns import qn
from lxml import etree

# ── Цвета из референса ──────────────────────────────────────────────────────
C_BLACK      = RGBColor(0x00, 0x00, 0x00)
C_WHITE      = RGBColor(0xFF, 0xFF, 0xFF)
C_BEIGE_DARK = RGBColor(0xDD, 0xD9, 0xC3)   # карточка тёмно-бежевая
C_BEIGE_LIGHT= RGBColor(0xEE, 0xEC, 0xE1)   # карточка светло-бежевая (lt2)
C_GREY_LIGHT = RGBColor(0xF2, 0xF2, 0xF2)   # карточка светло-серая
C_RED_BORDER = RGBColor(0x86, 0x1D, 0x00)   # граница карточек
C_GOLD       = RGBColor(0xC4, 0xBD, 0x97)   # золотой
C_ORANGE     = RGBColor(0xE8, 0x4C, 0x22)   # accent1
C_DARK_GREY  = RGBColor(0x40, 0x40, 0x40)

# ── Размер слайда 16:9 ──────────────────────────────────────────────────────
W = Inches(12.19)
H = Inches(6.86)

# ── Шрифты ──────────────────────────────────────────────────────────────────
F_TITLE = "Arial Black"
F_BODY  = "Arial"

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H


# ============================================================================
# Вспомогательные функции
# ============================================================================

def blank_slide(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def _apply_border(spPr, border_color, border_w_emu=12700):
    """Устанавливает границу в spPr."""
    # Убираем старую ln если есть
    for old_ln in spPr.findall(qn('a:ln')):
        spPr.remove(old_ln)
    ln = etree.SubElement(spPr, qn('a:ln'))
    if border_color:
        ln.set('w', str(border_w_emu))
        ln.set('cap', 'flat')
        ln.set('cmpd', 'sng')
        sf = etree.SubElement(ln, qn('a:solidFill'))
        sc = etree.SubElement(sf, qn('a:srgbClr'))
        sc.set('val', '%02X%02X%02X' % (border_color[0], border_color[1], border_color[2]))
        etree.SubElement(ln, qn('a:prstDash')).set('val', 'solid')
        etree.SubElement(ln, qn('a:miter')).set('lim', '8000')
    else:
        etree.SubElement(ln, qn('a:noFill'))
    return ln


def _apply_shadow(spPr):
    """Добавляет тень как в референсе."""
    for old in spPr.findall(qn('a:effectLst')):
        spPr.remove(old)
    effectLst = etree.SubElement(spPr, qn('a:effectLst'))
    outerShdw = etree.SubElement(effectLst, qn('a:outerShdw'))
    outerShdw.set('blurRad', '63500')
    outerShdw.set('dist', '38100')
    outerShdw.set('dir', '18900000')
    srgb = etree.SubElement(outerShdw, qn('a:srgbClr'))
    srgb.set('val', '000000')
    etree.SubElement(srgb, qn('a:alpha')).set('val', '40000')


def add_card(slide, left, top, width, height, fill, border_color=C_RED_BORDER, shadow=True):
    """Карточка: заливка + граница + тень (стиль Chinatown)."""
    shape = slide.shapes.add_shape(1, left, top, width, height)
    el = shape._element
    spPr = el.find(qn('p:spPr'))

    shape.fill.solid()
    shape.fill.fore_color.rgb = fill

    _apply_border(spPr, border_color)
    if shadow:
        _apply_shadow(spPr)
    return shape


def add_strip(slide, left, top, width, height, fill):
    """Прямоугольник без границы и тени."""
    shape = slide.shapes.add_shape(1, left, top, width, height)
    el = shape._element
    spPr = el.find(qn('p:spPr'))
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    _apply_border(spPr, None)
    return shape


def add_text(slide, text, left, top, width, height,
             font_name=F_BODY, font_size=Pt(14), bold=False,
             color=C_BLACK, align=PP_ALIGN.LEFT, v_anchor='t'):
    """Текстовый блок."""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True

    # Убираем все пустые параграфы, добавляем нужные
    paragraphs = text.split('\n')
    for i, para_text in enumerate(paragraphs):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.alignment = align
        run = p.add_run()
        run.text = para_text
        run.font.name = font_name
        run.font.size = font_size
        run.font.bold = bold
        run.font.color.rgb = color

    bodyPr = tf._txBody.find(qn('a:bodyPr'))
    if bodyPr is not None:
        bodyPr.set('anchor', v_anchor)
        bodyPr.set('wrap', 'square')
    return txBox


# ============================================================================
# СЛАЙД 1 — Титульный
# ============================================================================
sld1 = blank_slide(prs)

# Правая декоративная полоска (как в ref slide 1)
strip_w = Inches(1.4)
add_strip(sld1, W - strip_w, 0, strip_w, H, C_GREY_LIGHT)

# Название бренда
add_text(sld1, 'OLIMPIK',
         Inches(0.5), Inches(1.1), Inches(9), Inches(2.0),
         font_name=F_TITLE, font_size=Pt(80), bold=True,
         color=C_BLACK, align=PP_ALIGN.LEFT)

# Подзаголовок (золотой, как в ref)
add_text(sld1,
         'БИЗНЕС-ПЛАН ПО СОЗДАНИЮ ОНЛАЙН-ШКОЛЫ\n'
         'ДЛЯ ПОДГОТОВКИ К ОЛИМПИАДАМ ПО МАТЕМАТИКЕ',
         Inches(0.5), Inches(3.2), Inches(9.5), Inches(1.2),
         font_name=F_BODY, font_size=Pt(15), bold=True,
         color=C_GOLD, align=PP_ALIGN.LEFT)

# Автор / руководитель
add_text(sld1,
         'Выполнила: ученица 10 класса П-7 ГБОУ Школы №338\n'
         'Клименко Елизавета Олеговна\n'
         'Руководитель: Антонова Екатерина Германовна',
         Inches(0.5), Inches(4.65), Inches(8.5), Inches(1.5),
         font_name=F_BODY, font_size=Pt(11),
         color=C_BLACK, align=PP_ALIGN.LEFT)

# Год
add_text(sld1, 'Москва, 2026',
         Inches(5.8), Inches(6.3), Inches(3), Inches(0.4),
         font_name=F_BODY, font_size=Pt(11),
         color=C_BLACK, align=PP_ALIGN.LEFT)


# ============================================================================
# СЛАЙД 2 — Бизнес-план (3 карточки)
# ============================================================================
sld2 = blank_slide(prs)

add_text(sld2, 'Бизнес-план',
         Inches(0.5), Inches(0.2), Inches(10), Inches(1.0),
         font_name=F_TITLE, font_size=Pt(42), bold=True,
         color=C_BLACK, align=PP_ALIGN.LEFT)

CARD_TOP = Inches(1.3)
CARD_H   = Inches(5.2)
CARD_W   = Inches(3.65)
GAP      = Inches(0.12)
L1 = Inches(0.5)
L2 = L1 + CARD_W + GAP
L3 = L2 + CARD_W + GAP

fills2 = [C_BEIGE_LIGHT, C_BEIGE_DARK, C_GREY_LIGHT]
for lx, fill in zip([L1, L2, L3], fills2):
    add_card(sld2, lx, CARD_TOP, CARD_W, CARD_H, fill)

HDR_TOP  = CARD_TOP + Inches(0.2)
BODY_TOP = CARD_TOP + Inches(0.95)
BODY_H   = CARD_H - Inches(1.1)

hdrs2  = ['ЧТО ЭТО?', 'СТРАТЕГИЯ', 'СУТЬ']
bolds2 = [True, False, False]
bods2 = [
    'Olimpik — онлайн-школа для подготовки учеников '
    '8–10 классов к олимпиадам по математике.\n\n'
    'Живые занятия, персональный куратор, '
    'индивидуальный трек.',

    'Занять нишу олимпиадной подготовки, '
    'которую крупные платформы (Фоксфорд, Умскул) '
    'не закрывают глубоко.\n\n'
    'Целевой рынок: 500 000+ учеников в год.',

    'Создать платформу, где каждый ученик получает '
    'персональный маршрут, живые разборы задач '
    'и обратную связь куратора\n\nза 4 900 ₽/мес.',
]

for lx, hdr, bold, body in zip([L1, L2, L3], hdrs2, bolds2, bods2):
    add_text(sld2, hdr,
             lx + Inches(0.18), HDR_TOP, CARD_W - Inches(0.3), Inches(0.65),
             font_name=F_BODY, font_size=Pt(26), bold=True,
             color=C_BLACK, align=PP_ALIGN.LEFT)
    add_text(sld2, body,
             lx + Inches(0.18), BODY_TOP, CARD_W - Inches(0.3), BODY_H,
             font_name=F_BODY, font_size=Pt(13),
             color=C_BLACK, align=PP_ALIGN.LEFT)


# ============================================================================
# СЛАЙД 3 — Анализ ЦА и конкурентов
# ============================================================================
sld3 = blank_slide(prs)

add_text(sld3, 'Целевая аудитория и конкуренты',
         Inches(0.5), Inches(0.2), Inches(11), Inches(1.0),
         font_name=F_TITLE, font_size=Pt(36), bold=True,
         color=C_BLACK, align=PP_ALIGN.LEFT)

# Левая карточка ЦА
add_card(sld3, Inches(0.5), Inches(1.3), Inches(4.9), Inches(5.2), C_BEIGE_LIGHT)
add_text(sld3, 'ЦЕЛЕВАЯ АУДИТОРИЯ',
         Inches(0.65), Inches(1.5), Inches(4.6), Inches(0.6),
         font_name=F_BODY, font_size=Pt(20), bold=True, color=C_BLACK)
add_text(sld3,
         '• Ученики 8–10 классов\n'
         '• Мотивированные к олимпиадам\n'
         '• Родители, готовые платить за результат\n'
         '• Города: Москва, СПб, крупные регионы\n\n'
         'Объём рынка:\n'
         '~500 000 участников олимпиад\n'
         'по математике ежегодно',
         Inches(0.65), Inches(2.2), Inches(4.5), Inches(4.0),
         font_name=F_BODY, font_size=Pt(13), color=C_BLACK)

# Правая карточка конкурентов
add_card(sld3, Inches(5.7), Inches(1.3), Inches(6.0), Inches(5.2), C_GREY_LIGHT)
add_text(sld3, 'КОНКУРЕНТЫ И УТП',
         Inches(5.85), Inches(1.5), Inches(5.7), Inches(0.6),
         font_name=F_BODY, font_size=Pt(20), bold=True, color=C_BLACK)

rows_data = [
    ('Фоксфорд',   '5 500 ₽/мес',  'Нет олимп. трека'),
    ('Умскул',     '4 200 ₽/мес',  'Общая математика'),
    ('Репетитор',  '3–5 000 ₽/ч',  'Дорого, нет платф.'),
    ('Olimpik',    '4 900 ₽/мес',  '✓ Олимп. + куратор'),
]
ROW_H  = Inches(0.95)
RC     = [C_BEIGE_DARK, C_BEIGE_LIGHT, C_BEIGE_DARK, C_ORANGE]
TC     = [C_BLACK, C_BLACK, C_BLACK, C_WHITE]

for i, (name, price, note) in enumerate(rows_data):
    ry = Inches(2.2) + i * (ROW_H + Inches(0.05))
    add_card(sld3, Inches(5.7), ry, Inches(6.0), ROW_H, RC[i])
    add_text(sld3, name,
             Inches(5.85), ry + Inches(0.1), Inches(1.9), ROW_H - Inches(0.15),
             font_size=Pt(13), bold=(name == 'Olimpik'), color=TC[i])
    add_text(sld3, price,
             Inches(7.85), ry + Inches(0.1), Inches(1.9), ROW_H - Inches(0.15),
             font_size=Pt(12), color=TC[i])
    add_text(sld3, note,
             Inches(9.85), ry + Inches(0.1), Inches(1.75), ROW_H - Inches(0.15),
             font_size=Pt(11), color=TC[i])


# ============================================================================
# СЛАЙД 4 — Крупные игроки (3 карточки)
# ============================================================================
sld4 = blank_slide(prs)

add_text(sld4, 'Крупные игроки рынка',
         Inches(0.5), Inches(0.2), Inches(10), Inches(1.0),
         font_name=F_TITLE, font_size=Pt(38), bold=True, color=C_BLACK)

fills4  = [C_BEIGE_LIGHT, C_BEIGE_DARK, C_GREY_LIGHT]
hdrs4   = ['ФОКСФОРД', 'РЕПЕТИТОРЫ', 'OLIMPIK']
bods4   = [
    'Крупнейшая платформа.\n'
    'Выручка: 5,8 млрд ₽/год\n\n'
    'Широкий охват предметов,\n'
    'нет глубокой олимпиадной специализации.\n\n'
    'Цена: от 5 500 ₽/мес',

    'Частные репетиторы.\n\n'
    'Высокое качество, но:\n'
    '• нет структурированной программы\n'
    '• 3 000–5 000 ₽/час\n'
    '• нет платформы и аналитики',

    'Наше решение:\n\n'
    '• Олимпиадная специализация\n'
    '• Персональный куратор\n'
    '• Живые разборы задач\n'
    '• Трек прогресса\n'
    '• 4 900 ₽/месяц',
]

for i, (fill, hdr, body) in enumerate(zip(fills4, hdrs4, bods4)):
    lx = L1 + i * (CARD_W + GAP)
    add_card(sld4, lx, CARD_TOP, CARD_W, CARD_H, fill)
    add_text(sld4, hdr,
             lx + Inches(0.18), CARD_TOP + Inches(0.2), CARD_W - Inches(0.3), Inches(0.7),
             font_name=F_BODY, font_size=Pt(22), bold=True, color=C_BLACK)
    add_text(sld4, body,
             lx + Inches(0.18), CARD_TOP + Inches(1.0), CARD_W - Inches(0.3), CARD_H - Inches(1.2),
             font_name=F_BODY, font_size=Pt(13), color=C_BLACK)


# ============================================================================
# СЛАЙД 5 — Ценностное предложение
# ============================================================================
sld5 = blank_slide(prs)

add_text(sld5, 'Ценностное предложение',
         Inches(0.5), Inches(0.2), Inches(10), Inches(1.0),
         font_name=F_TITLE, font_size=Pt(36), bold=True, color=C_BLACK)

# Левый большой блок с ценой
add_card(sld5, Inches(0.5), Inches(1.3), Inches(4.5), Inches(5.2), C_BEIGE_DARK)
add_text(sld5, '4 900 ₽',
         Inches(0.6), Inches(1.9), Inches(4.3), Inches(1.3),
         font_name=F_TITLE, font_size=Pt(60), bold=True,
         color=C_BLACK, align=PP_ALIGN.CENTER)
add_text(sld5, 'в месяц',
         Inches(0.6), Inches(3.2), Inches(4.3), Inches(0.6),
         font_name=F_BODY, font_size=Pt(20),
         color=C_BLACK, align=PP_ALIGN.CENTER)
add_text(sld5, '6-недельный интенсивный модуль\nолимпиадной математики для 8–10 классов',
         Inches(0.6), Inches(3.9), Inches(4.3), Inches(1.2),
         font_name=F_BODY, font_size=Pt(13),
         color=C_BLACK, align=PP_ALIGN.CENTER)

# 5 плашек справа
usp_items = [
    ('Олимпиадная специализация',    'Только задачи уровня ВсОШ и профиль ЕГЭ'),
    ('Персональный куратор',          'Еженедельная обратная связь и разбор ошибок'),
    ('Живые онлайн-занятия',          'Расписание под ученика, запись каждого урока'),
    ('Трек прогресса',                'Аналитика результатов, мотивационный дашборд'),
    ('Гарантия результата',           'Если нет прогресса — возврат за модуль'),
]

USP_H = Inches(0.95)
USP_W = Inches(6.8)
USP_L = Inches(5.3)
usp_colors = [C_BEIGE_LIGHT, C_GREY_LIGHT, C_BEIGE_LIGHT, C_GREY_LIGHT, C_BEIGE_LIGHT]

for i, (title, desc) in enumerate(usp_items):
    uy = Inches(1.3) + i * (USP_H + Inches(0.07))
    add_card(sld5, USP_L, uy, USP_W, USP_H, usp_colors[i])
    add_text(sld5, title,
             USP_L + Inches(0.2), uy + Inches(0.07), USP_W - Inches(0.3), Inches(0.42),
             font_name=F_BODY, font_size=Pt(14), bold=True, color=C_BLACK)
    add_text(sld5, desc,
             USP_L + Inches(0.2), uy + Inches(0.5), USP_W - Inches(0.3), Inches(0.42),
             font_name=F_BODY, font_size=Pt(11), color=C_DARK_GREY)


# ============================================================================
# Сохранение
# ============================================================================
OUT = r'c:\Users\admin\Documents\Vibe Code Projects\olimpic\olimpik_presentation.pptx'
prs.save(OUT)
print(f'Сохранено: {OUT}')
print(f'Слайдов: {len(prs.slides)}')
