import os
import sys
import argparse
import requests
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
from io import BytesIO
from dotenv import dotenv_values
from typing import Optional

# ── Configuración ─────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
config     = dotenv_values(os.path.join(BASE_DIR, '..', '.env'))
# TODO: Para que quiero el .env si por aqui paso la url de la api?
API_BASE   = config.get('API_URL', 'http://localhost:3000')
ASSETS_DIR = os.path.join(BASE_DIR, '..', 'assets')
OUTPUT_DIR = os.path.join(BASE_DIR, '..', 'output')
BG_PATH    = os.path.join(ASSETS_DIR, 'backgrounds', 'background.png')

# TODO: Poner que puedas elegir las dimensiones. Al menos las de A3 o variables. Inscluso variable para que el fronent envie las dimensiones de A3 y A4
# Dimensiones A4 a 300 dpi
POSTER_W = 2480
POSTER_H = 3508
DPI      = 300

# ── Fuentes ───────────────────────────────────────────────
def load_font(filename, size):
    """Carga fuente desde assets/fonts/, con fallback a arial."""
    font_path = os.path.join(ASSETS_DIR, 'fonts', filename)
    if os.path.exists(font_path):
        return ImageFont.truetype(font_path, size)
    # Fallback — fuente del sistema. No creo que nunca se llegue aqui, pero por si acaso
    try:
        return ImageFont.truetype('arial.ttf', size)
    except:
        return ImageFont.load_default()

# ── Llamadas a la API de Node ───────────────────────────── > Levantar antes la API de NodeJs
def get_monster(name: str) -> dict:
    """Obtiene datos del monstruo desde la API de Node."""
    try:
        resp = requests.get(
            f'{API_BASE}/monsters/{requests.utils.quote(name)}',
            timeout=10
        )
        if resp.status_code == 404:
            print(f'✗ Monstruo no encontrado: {name}')
            sys.exit(1)
        resp.raise_for_status()
        return resp.json()

    except requests.exceptions.ConnectionError:
        print(f'✗ No se puede conectar con la API en {API_BASE}')
        print('  Asegúrate de que el servidor Node está corriendo: node src/server.js')
        sys.exit(1)
    except requests.exceptions.Timeout:
        print(f'✗ La API no respondió en 10 segundos ({API_BASE})')
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f'✗ Error inesperado al contactar la API: {e}')
        sys.exit(1)


def get_monster_image(name: str) -> Optional[Image.Image]:#Image.Image | None: -> Solo funciona en Python 3.10+. Como estoy trabajando en Python 3.8.0 me como los mocos
    """Descarga el icono del monstruo desde la API de Node."""
    try:
        url  = f'{API_BASE}/monsters/{requests.utils.quote(name)}/image'
        resp = requests.get(url, timeout=10)

        if resp.status_code == 404:
            print(f'  ⚠ Icono no encontrado para: {name}')
            return None

        resp.raise_for_status()
        return Image.open(BytesIO(resp.content)).convert('RGBA')

    except requests.exceptions.ConnectionError:
        print(f'  ✗ No se puede conectar con la API para descargar el icono')
        print('  Asegúrate de que el servidor Node está corriendo: node src/server.js')
        sys.exit(1)
    except requests.exceptions.Timeout:
        print(f'  ✗ Timeout descargando el icono de: {name}')
        return None
    except requests.exceptions.RequestException as e:
        print(f'  ✗ Error descargando icono: {e}')
        return None
    
# ── Composición del póster ────────────────────────────────
def draw_centered_text(draw, text, font, y, canvas_w, color):
    """Dibuja texto centrado horizontalmente en la posición Y dada."""
    bbox  = draw.textbbox((0, 0), text, font=font)
    tw    = bbox[2] - bbox[0]
    x     = (canvas_w - tw) // 2
    draw.text((x, y), text, font=font, fill=color)
    return bbox[3] - bbox[1]  # devuelve altura del texto
# Este para el Cinzel-Bold
# def draw_text_with_shadow(draw, text, font, y, canvas_w, color, shadow_color, offset=6):
#     """Dibuja texto con sombra para efecto vintage."""
#     bbox = draw.textbbox((0, 0), text, font=font)
#     tw   = bbox[2] - bbox[0]
#     x    = (canvas_w - tw) // 2
#     # Sombra
#     draw.text((x + offset, y + offset), text, font=font, fill=shadow_color)
#     # Texto principal
#     draw.text((x, y), text, font=font, fill=color)
#     return bbox[3] - bbox[1]
# OptimusPrincepsSemiBold
# def draw_text_with_shadow(draw, text, font, y, canvas_w, color, shadow_color, offset=6):
#     bbox   = draw.textbbox((0, 0), text, font=font)
#     tw     = bbox[2] - bbox[0]
#     ascent = bbox[1]
#     x      = (canvas_w - tw) // 2
#     y_real = y - ascent

#     draw.text((x + offset, y_real + offset), text, font=font, fill=shadow_color)
#     draw.text((x, y_real),                   text, font=font, fill=color)
#     return bbox[3] - bbox[1]

def draw_text_with_shadow(draw, text, font, y, canvas_w, color, shadow_color, offset=6, letter_spacing=0):
    if letter_spacing == 0:
        bbox   = draw.textbbox((0, 0), text, font=font)
        tw     = bbox[2] - bbox[0]
        ascent = bbox[1]
        x      = (canvas_w - tw) // 2
        y_real = y - ascent
        draw.text((x + offset, y_real + offset), text, font=font, fill=shadow_color)
        draw.text((x, y_real),                   text, font=font, fill=color)
        return bbox[3] - bbox[1]
    else:
        # Letra a letra con espaciado
        total_w = sum(draw.textbbox((0, 0), ch, font=font)[2] for ch in text) + letter_spacing * (len(text) - 1)
        x       = (canvas_w - total_w) // 2
        bbox    = draw.textbbox((0, 0), text, font=font)
        ascent  = bbox[1]
        y_real  = y - ascent
        cx      = x
        for ch in text:
            ch_w = draw.textbbox((0, 0), ch, font=font)[2]
            draw.text((cx + offset, y_real + offset), ch, font=font, fill=shadow_color)
            draw.text((cx, y_real),                   ch, font=font, fill=color)
            cx += ch_w + letter_spacing
        return bbox[3] - bbox[1]
# Este para el Cinzel-ExtraBold
# def draw_text_bold_effect(draw, text, font, y, canvas_w, color, shadow_color, offset=5, passes=2):
#     """Dibuja texto con sombra y grosor extra simulado."""
#     bbox = draw.textbbox((0, 0), text, font=font)
#     tw   = bbox[2] - bbox[0]
#     x    = (canvas_w - tw) // 2
#     # Sombra
#     for dx in range(passes):
#         for dy in range(passes):
#             draw.text((x + offset + dx, y + offset + dy), text, font=font, fill=shadow_color)
#     # Texto principal con grosor extra
#     for dx in range(passes):
#         for dy in range(passes):
#             draw.text((x + dx, y + dy), text, font=font, fill=color)
#     return bbox[3] - bbox[1]
# OptimusPrincepsSemiBold
def draw_text_bold_effect(draw, text, font, y, canvas_w, color, shadow_color, offset=5, passes=2, letter_spacing=0):
    """Dibuja texto con sombra, grosor extra y espaciado entre letras."""
    # Calcular ancho total con espaciado
    total_w = sum(draw.textbbox((0, 0), ch, font=font)[2] for ch in text) + letter_spacing * (len(text) - 1)
    x       = (canvas_w - total_w) // 2

    # Calcular ascent para evitar el corte superior
    bbox   = draw.textbbox((0, 0), text, font=font)
    ascent = bbox[1]
    y_real = y - ascent

    # Dibujar letra a letra
    cx = x
    for ch in text:
        ch_bbox = draw.textbbox((0, 0), ch, font=font)
        ch_w    = ch_bbox[2] - ch_bbox[0]
        # Sombra
        for dx in range(passes):
            for dy in range(passes):
                draw.text((cx + offset + dx, y_real + offset + dy), ch, font=font, fill=shadow_color)
        # Texto principal
        for dx in range(passes):
            for dy in range(passes):
                draw.text((cx + dx, y_real + dy), ch, font=font, fill=color)
        cx += ch_w + letter_spacing

    return bbox[3] - bbox[1]

#def apply_sepia_tint(img: Image.Image, intensity=0.35) -> Image.Image: -> Solo funciona en Python 3.10+. Como estoy trabajando en Python 3.8.0 me como los mocos
def apply_sepia_tint(img: Image.Image, intensity: float = 0.35) -> Image.Image:
    """Aplica un tinte sepia suave a la imagen del icono para que encaje con el fondo."""
    r, g, b, a = img.split()
    r = r.point(lambda i: min(255, int(i * (1 + intensity * 0.2))))
    g = g.point(lambda i: min(255, int(i * (1 - intensity * 0.05))))
    b = b.point(lambda i: min(255, int(i * (1 - intensity * 0.2))))
    return Image.merge('RGBA', (r, g, b, a))

def apply_icon_blend(icon: Image.Image) -> Image.Image:
    """Solo difumina bordes, sin alterar colores del icono."""
    import numpy as np
    w, h = icon.size

    # Máscara radial — centro opaco, bordes transparentes
    mask      = Image.new('L', (w, h), 0)
    mask_draw = ImageDraw.Draw(mask)
    steps     = 80
    for i in range(steps):
        ratio   = i / steps
        opacity = int(255 * ratio)
        shrink  = int(min(w, h) * (1 - ratio) * 0.5)
        mask_draw.ellipse(
            [shrink, shrink, w - shrink, h - shrink],
            fill=opacity
        )
    mask = mask.filter(ImageFilter.GaussianBlur(radius=int(min(w, h) * 0.06)))

    r, g, b, a = icon.split()
    new_alpha  = Image.fromarray(
        np.minimum(np.array(a), np.array(mask)).astype('uint8')
    )
    return Image.merge('RGBA', (r, g, b, new_alpha))

#def generate_poster(monster_name: str, show_game: str | None, output_format: str): -> Solo funciona en Python 3.10+. Como estoy trabajando en Python 3.8.0 me como los mocos
def generate_poster(monster_name: str, show_game: Optional[str], output_format: str):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # PASO 1 — Datos del monstruo
    print(f'[1/5] Obteniendo datos de: {monster_name}...')
    monster = get_monster(monster_name)
    name    = monster.get('name', monster_name).upper()

    # Determinar subtítulo de juego
    subtitle = None
    if show_game:
        # Busca coincidencia parcial en el array games
        games = monster.get('games', [])
        match = next((g for g in games if show_game.lower() in g.lower()), None)
        subtitle = match if match else show_game
        subtitle = subtitle.title() # Asegura mixed_case en el subtítulo — primera letra de cada palabra en mayúscula

    # PASO 2 — Icono del monstruo
    print(f'[2/5] Descargando icono...')
    icon = get_monster_image(monster_name)
    if icon is None:
        print('  ⚠ Sin icono disponible, se generará el póster sin imagen.')

    # PASO 3 — Fondo
    print(f'[3/5] Preparando fondo...')
    if not os.path.exists(BG_PATH):
        print(f'  ✗ Fondo no encontrado en {BG_PATH}')
        sys.exit(1)

    bg = Image.open(BG_PATH).convert('RGBA') # Convierte el png en RGB
    bg = bg.resize((POSTER_W, POSTER_H), Image.LANCZOS) # Lo escala a las dimensiones deseadas
    poster = bg.copy()
    draw   = ImageDraw.Draw(poster)

    # PASO 4 — Tipografía y composición
    print(f'[4/5] Componiendo póster...')
    # font_title    = load_font('Cinzel-Bold.ttf',    size=int(POSTER_W * 0.095))
    # font_subtitle = load_font('Cinzel-Regular.ttf', size=int(POSTER_W * 0.038))

    # color_title    = (60,  35,  10,  255)
    # color_subtitle = (100, 60,  20,  240)
    # color_shadow   = (30,  15,   5,  120)
    # font_title    = load_font('Cinzel-Bold.ttf',    size=int(POSTER_W * 0.095))
    # font_title = load_font('Cinzel-ExtraBold.ttf', size=int(POSTER_W * 0.095))
    #TODO: Falta que entre cada letra se deje un espacio de 0.2 px mas o menos
    font_title = load_font('OptimusPrincepsSemiBold.ttf', size=int(POSTER_W * 0.062))
    # font_subtitle = load_font('Cinzel-Regular.ttf', size=int(POSTER_W * 0.036))
    font_subtitle = load_font('OptimusPrinceps.ttf', size=int(POSTER_W * 0.016))

    color_title    = (28,  18,   8,  255)
    color_subtitle = (45,  28,  10,  255)
    color_shadow   = (180, 140,  80,  90)

    # Zona de texto: 28% superior del póster
    text_zone_h = int(POSTER_H * 0.26) 

    # Calcular alturas de texto
    title_bbox   = draw.textbbox((0, 0), name, font=font_title)
    title_h      = title_bbox[3] - title_bbox[1]

    if subtitle:
        sub_bbox     = draw.textbbox((0, 0), subtitle, font=font_subtitle)
        sub_h        = sub_bbox[3] - sub_bbox[1]
        gap          = int(POSTER_H * 0.018)
        total_text_h = title_h + gap + sub_h
    else:
        sub_h        = 0
        gap          = 0
        total_text_h = title_h

    # Centrar bloque de texto verticalmente en la zona superior
    text_start_y = (text_zone_h - total_text_h) // 2

    # Título
    # draw_text_with_shadow(
    #     draw, name, font_title,
    #     y=text_start_y,
    #     canvas_w=POSTER_W,
    #     color=color_title,
    #     shadow_color=color_shadow,
    #     offset=8
    # )
    # draw_text_with_shadow(
    #     draw, name, font_title,
    #     y=text_start_y,
    #     canvas_w=POSTER_W,
    #     color=color_title,
    #     shadow_color=color_shadow,
    #     offset=5
    # )
    draw_text_bold_effect(
    draw, name, font_title,
    y=text_start_y,
    canvas_w=POSTER_W,
    color=color_title,
    shadow_color=color_shadow,
    offset=5,
    passes=2,
    letter_spacing=8   # prueba entre 4 y 20
    )
    

    # Subtítulo
    # if subtitle:
    #     draw_text_with_shadow(
    #         draw, subtitle, font_subtitle,
    #         y=text_start_y + title_h + gap,
    #         canvas_w=POSTER_W,
    #         color=color_subtitle,
    #         shadow_color=color_shadow,
    #         offset=4
    #     )
    if subtitle:
        draw_text_with_shadow(
            draw, subtitle, font_subtitle,
            y=text_start_y + title_h + gap,
            canvas_w=POSTER_W,
            color=color_subtitle,
            shadow_color=color_shadow,
            offset=3,
            letter_spacing=6    # prueba entre 4 y 12 para el efecto versalita
        )

    # Icono: ocupa el área restante bajo el texto
    if icon:
        # padding     = int(POSTER_W * 0.10)
        padding     = int(POSTER_W * 0.04) # Sube para que el icono sea más estrecho, baja para que ocupe más ancho
        icon_top    = text_zone_h - int(POSTER_H * 0.02) # El icono empieza justo tras la zona de texto + 2% de margen (~70px) #TODO: Ha quedado de alto muy echado hacia abajo, lo cual no coincide con el posicionamiento de la imagen original y no coincido solucionarlo
        icon_bottom = POSTER_H    - int(POSTER_H * 0.02) # Mas margen abajo, Sube para más margen abajo, baja para que llegue más al borde
        icon_area_w = POSTER_W - padding * 2
        icon_area_h = icon_bottom - icon_top

        icon_ratio = min(icon_area_w / icon.width, icon_area_h / icon.height)
        new_w = int(icon.width  * icon_ratio)
        new_h = int(icon.height * icon_ratio)
        icon  = icon.resize((new_w, new_h), Image.LANCZOS)
        # icon  = apply_sepia_tint(icon, intensity=-0.25) #TODO: Muy mejorable el filtro sepia que tendre que investigar mas. La idea es hacer que por alrededor con gausse o algo parece que se le han quitado cachitos del dibujo y se una al color del background
        icon = apply_icon_blend(icon)

        icon_x = (POSTER_W - new_w) // 2
        icon_y = icon_top

        poster.paste(icon, (icon_x, icon_y), icon)

    # PASO 5 — Exportar
    print(f'[5/5] Exportando...')
    safe_name = monster_name.lower().replace(' ', '_').replace("'", '')
    game_tag  = f'_{show_game.lower().replace(" ", "_")}' if show_game else ''

    if output_format == 'pdf':
        pdf_path = os.path.join(OUTPUT_DIR, f'{safe_name}{game_tag}.pdf')
        tmp_path = os.path.join(OUTPUT_DIR, f'{safe_name}{game_tag}_tmp.png')

        try:
            # Guardar PNG temporal
            poster_rgb = poster.convert('RGB')
            poster_rgb.save(tmp_path, dpi=(DPI, DPI))

            # Convertir a PDF con Pillow directamente
            poster_rgb.save(pdf_path, 'PDF', resolution=DPI)

            print(f'\n✓ PDF generado: {pdf_path}')

        except Exception as e:
            print(f'\n✗ Error al exportar PDF: {e}')
            raise

        finally:
            # Limpiar temporal siempre, haya error o no
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                print(f'  Temporal eliminado: {tmp_path}')

    else:  # PNG por defecto
        png_path = os.path.join(OUTPUT_DIR, f'{safe_name}{game_tag}.png')
        try:
            poster.convert('RGB').save(png_path, dpi=(DPI, DPI))
            print(f'\n✓ PNG generado: {png_path}')
        except Exception as e:
            print(f'\n✗ Error al exportar PNG: {e}')
            if os.path.exists(png_path):
                os.remove(png_path)
            raise

# ── CLI ───────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generador de pósters de Monster Hunter')
    parser.add_argument('monster',        type=str,            help='Nombre del monstruo (ej: Rathalos)')
    parser.add_argument('--game',   '-g', type=str, default=None, help='Nombre del juego a mostrar (opcional)')
    parser.add_argument('--format', '-f', type=str, default='png', choices=['png', 'pdf'], help='Formato de salida')
    args = parser.parse_args()

    generate_poster(args.monster, args.game, args.format)