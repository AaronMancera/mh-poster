import os
import sys
import argparse
import requests
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from io import BytesIO
from dotenv import dotenv_values
from typing import Optional

# ── Configuración ─────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
config = dotenv_values(os.path.join(BASE_DIR, "..", ".env"))

API_BASE = config.get("API_URL", "http://localhost:3000")
ASSETS_DIR = os.path.join(BASE_DIR, "..", "assets")
OUTPUT_DIR = os.path.join(BASE_DIR, "..", "output")
BG_PATH = os.path.join(ASSETS_DIR, "backgrounds", "background.png")

# TODO: Poner que puedas elegir las dimensiones. Al menos las de A3 o variables. Inscluso variable para que el fronent envie las dimensiones de A3 y A4
# Dimensiones A4 a 300 dpi
POSTER_W = 2480
POSTER_H = 3508
DPI = 300


# ── Fuentes ───────────────────────────────────────────────
def load_font(filename, size):
    """Carga fuente desde assets/fonts/, con fallback a arial."""
    font_path = os.path.join(ASSETS_DIR, "fonts", filename)
    if os.path.exists(font_path):
        return ImageFont.truetype(font_path, size)
    # Fallback — fuente del sistema. No creo que nunca se llegue aqui, pero por si acaso
    try:
        return ImageFont.truetype("arial.ttf", size)
    except:
        return ImageFont.load_default()


# ── Llamadas a la API de Node ───────────────────────────── > Levantar antes la API de NodeJs
def get_monster(name: str) -> dict:
    """Obtiene datos del monstruo desde la API de Node."""
    try:
        resp = requests.get(
            f"{API_BASE}/monsters/{requests.utils.quote(name)}", timeout=10
        )
        if resp.status_code == 404:
            print(f"✗ Monstruo no encontrado: {name}")
            sys.exit(1)
        resp.raise_for_status()
        return resp.json()

    except requests.exceptions.ConnectionError:
        print(f"✗ No se puede conectar con la API en {API_BASE}")
        print("  Asegúrate de que el servidor Node está corriendo: node src/server.js")
        sys.exit(1)
    except requests.exceptions.Timeout:
        print(f"✗ La API no respondió en 10 segundos ({API_BASE})")
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"✗ Error inesperado al contactar la API: {e}")
        sys.exit(1)


def get_monster_image(
    name: str,
) -> Optional[
    Image.Image
]:  # Image.Image | None: -> Solo funciona en Python 3.10+. Como estoy trabajando en Python 3.8.0 me como los mocos
    """Descarga el icono del monstruo desde la API de Node."""
    try:
        url = f"{API_BASE}/monsters/{requests.utils.quote(name)}/image"
        resp = requests.get(url, timeout=10)

        if resp.status_code == 404:
            print(f"  ⚠ Icono no encontrado para: {name}")
            return None

        resp.raise_for_status()
        return Image.open(BytesIO(resp.content)).convert("RGBA")

    except requests.exceptions.ConnectionError:
        print(f"  ✗ No se puede conectar con la API para descargar el icono")
        print("  Asegúrate de que el servidor Node está corriendo: node src/server.js")
        sys.exit(1)
    except requests.exceptions.Timeout:
        print(f"  ✗ Timeout descargando el icono de: {name}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"  ✗ Error descargando icono: {e}")
        return None


# ── Composición del póster ────────────────────────────────
def draw_centered_text(draw, text, font, y, canvas_w, color):
    """Dibuja texto centrado horizontalmente en la posición Y dada."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (canvas_w - tw) // 2
    draw.text((x, y), text, font=font, fill=color)
    return bbox[3] - bbox[1]  # devuelve altura del texto


def draw_text_with_shadow(
    draw, text, font, y, canvas_w, color, shadow_color, offset=6, letter_spacing=0
):
    if letter_spacing == 0:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        ascent = bbox[1]
        x = (canvas_w - tw) // 2
        y_real = y - ascent
        draw.text((x + offset, y_real + offset), text, font=font, fill=shadow_color)
        draw.text((x, y_real), text, font=font, fill=color)
        return bbox[3] - bbox[1]
    else:
        # Letra a letra con espaciado
        total_w = sum(
            draw.textbbox((0, 0), ch, font=font)[2] for ch in text
        ) + letter_spacing * (len(text) - 1)
        x = (canvas_w - total_w) // 2
        bbox = draw.textbbox((0, 0), text, font=font)
        ascent = bbox[1]
        y_real = y - ascent
        cx = x
        for ch in text:
            ch_w = draw.textbbox((0, 0), ch, font=font)[2]
            draw.text((cx + offset, y_real + offset), ch, font=font, fill=shadow_color)
            draw.text((cx, y_real), ch, font=font, fill=color)
            cx += ch_w + letter_spacing
        return bbox[3] - bbox[1]


def draw_text_bold_effect(
    draw,
    text,
    font,
    y,
    canvas_w,
    color,
    shadow_color,
    offset=5,
    passes=2,
    letter_spacing=0,
):
    """Dibuja texto con sombra, grosor extra y espaciado entre letras."""
    # Calcular ancho total con espaciado
    total_w = sum(
        draw.textbbox((0, 0), ch, font=font)[2] for ch in text
    ) + letter_spacing * (len(text) - 1)
    x = (canvas_w - total_w) // 2

    # Calcular ascent para evitar el corte superior
    bbox = draw.textbbox((0, 0), text, font=font)
    ascent = bbox[1]
    y_real = y - ascent

    # Dibujar letra a letra
    cx = x
    for ch in text:
        ch_bbox = draw.textbbox((0, 0), ch, font=font)
        ch_w = ch_bbox[2] - ch_bbox[0]
        # Sombra
        for dx in range(passes):
            for dy in range(passes):
                draw.text(
                    (cx + offset + dx, y_real + offset + dy),
                    ch,
                    font=font,
                    fill=shadow_color,
                )
        # Texto principal
        for dx in range(passes):
            for dy in range(passes):
                draw.text((cx + dx, y_real + dy), ch, font=font, fill=color)
        cx += ch_w + letter_spacing

    return bbox[3] - bbox[1]


def apply_sepia_tint(img: Image.Image, intensity: float = 0.35) -> Image.Image:
    """Aplica un tinte sepia suave a la imagen del icono para que encaje con el fondo."""
    r, g, b, a = img.split()
    r = r.point(lambda i: min(255, int(i * (1 + intensity * 0.2))))
    g = g.point(lambda i: min(255, int(i * (1 - intensity * 0.05))))
    b = b.point(lambda i: min(255, int(i * (1 - intensity * 0.2))))
    return Image.merge("RGBA", (r, g, b, a))


# TODO: Pulir esto porque puede dar un toque de estampado muy bueno pero no le pillo
def apply_icon_blend(icon: Image.Image) -> Image.Image:
    """Difumina ligeramente los 4 bordes del icono de forma natural."""
    import numpy as np

    w, h = icon.size

    # Crear máscara blanca (completamente opaca)
    mask = Image.new("L", (w, h), 255)
    mask_arr = np.array(mask, dtype=np.float32)

    # Cuántos píxeles desde cada borde se aplica el fade
    # Sube para más difuminado, baja para menos
    fade_px = int(min(w, h) * 0.035)  # 6% del tamaño — prueba entre 0.02 y 0.10

    for i in range(fade_px):
        alpha = int(255 * (i / fade_px))  # de 0 (borde) a 255 (interior)
        # Borde superior
        mask_arr[i, :] = np.minimum(mask_arr[i, :], alpha)
        # Borde inferior
        mask_arr[h - 1 - i, :] = np.minimum(mask_arr[h - 1 - i, :], alpha)
        # Borde izquierdo
        mask_arr[:, i] = np.minimum(mask_arr[:, i], alpha)
        # Borde derecho
        mask_arr[:, w - 1 - i] = np.minimum(mask_arr[:, w - 1 - i], alpha)

    # Suavizar muy levemente para que no haya línea dura
    mask = Image.fromarray(mask_arr.astype("uint8"))
    mask = mask.filter(ImageFilter.GaussianBlur(radius=int(min(w, h) * 0.01)))

    r, g, b, a = icon.split()
    new_alpha = Image.fromarray(np.minimum(np.array(a), np.array(mask)).astype("uint8"))
    return Image.merge("RGBA", (r, g, b, new_alpha))


def generate_poster(
    monster_name: str,
    show_game: Optional[str],
    output_format: str,
    to_stdout: bool = False,
    binary_stdout=None,
):
    # Cuando escribimos a stdout, redirigir prints a stderr
    # para que Node.js no confunda logs con bytes de imagen
    log = sys.stderr if to_stdout else sys.stdout

    # PASO 1 — Datos del monstruo
    print(f"[1/5] Obteniendo datos de: {monster_name}...", file=log)
    monster = get_monster(monster_name)
    name = monster.get("name", monster_name).upper()

    # Determinar subtítulo de juego
    subtitle = None
    if show_game:
        games = monster.get("games", [])
        match = next((g for g in games if show_game.lower() in g.lower()), None)
        subtitle = match if match else show_game
        subtitle = subtitle.title()

    # PASO 2 — Icono del monstruo
    print(f"[2/5] Descargando icono...", file=log)
    icon = get_monster_image(monster_name)
    if icon is None:
        print("  Aviso: Sin icono disponible.", file=log)

    # PASO 3 — Fondo
    print(f"[3/5] Preparando fondo...", file=log)
    if not os.path.exists(BG_PATH):
        print(f"  Error: Fondo no encontrado en {BG_PATH}", file=log)
        sys.exit(1)

    bg = Image.open(BG_PATH).convert("RGBA")
    bg = bg.resize((POSTER_W, POSTER_H), Image.LANCZOS)
    poster = bg.copy()
    draw = ImageDraw.Draw(poster)

    # PASO 4 — Tipografía y composición
    print(f"[4/5] Componiendo póster...", file=log)
    font_title = load_font("OptimusPrincepsSemiBold.ttf", size=int(POSTER_W * 0.062))
    font_subtitle = load_font("Cinzel-ExtraBold.ttf", size=int(POSTER_W * 0.026))

    color_title = (28, 18, 8, 255)
    color_subtitle = (45, 28, 10, 255)
    color_shadow = (180, 140, 80, 90)

    text_zone_h = int(POSTER_H * 0.26)
    title_bbox = draw.textbbox((0, 0), name, font=font_title)
    title_h = title_bbox[3] - title_bbox[1]

    if subtitle:
        sub_bbox = draw.textbbox((0, 0), subtitle, font=font_subtitle)
        sub_h = sub_bbox[3] - sub_bbox[1]
        gap = int(POSTER_H * 0.018)
        total_text_h = title_h + gap + sub_h
    else:
        sub_h = gap = 0
        total_text_h = title_h

    text_start_y = (text_zone_h - total_text_h) // 2

    draw_text_bold_effect(
        draw,
        name,
        font_title,
        y=text_start_y,
        canvas_w=POSTER_W,
        color=color_title,
        shadow_color=color_shadow,
        offset=5,
        passes=2,
        letter_spacing=8,
    )

    if subtitle:
        draw_text_with_shadow(
            draw,
            subtitle,
            font_subtitle,
            y=text_start_y + title_h + gap,
            canvas_w=POSTER_W,
            color=color_subtitle,
            shadow_color=color_shadow,
            offset=3,
            letter_spacing=6,
        )

    if icon:
        padding = int(POSTER_W * 0.06)
        icon_top = text_zone_h - int(POSTER_H * 0.03)
        icon_bottom = POSTER_H - int(POSTER_H * 0.02)
        icon_area_w = POSTER_W - padding * 2.1
        icon_area_h = icon_bottom - icon_top

        icon_ratio = min(icon_area_w / icon.width, icon_area_h / icon.height)
        new_w = int(icon.width * icon_ratio)
        new_h = int(icon.height * icon_ratio)
        icon = icon.resize((new_w, new_h), Image.LANCZOS)
        icon = apply_sepia_tint(icon, intensity=-0.25)
        icon = apply_icon_blend(icon)

        poster.paste(icon, ((POSTER_W - new_w) // 2, icon_top), icon)

    # PASO 5 — Exportar
    print("[5/5] Exportando...")
    poster_rgb = poster.convert("RGB")
    buffer = BytesIO()

    if output_format == "pdf":
        poster_rgb.save(buffer, "PDF", resolution=DPI)
    else:
        poster_rgb.save(buffer, "PNG", dpi=(DPI, DPI))

    if to_stdout:
        binary_stdout.write(buffer.getvalue())
        binary_stdout.flush()
        print("Poster enviado correctamente.")
    else:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        safe_name = monster_name.lower().replace(" ", "_").replace("'", "")
        game_tag = f'_{show_game.lower().replace(" ", "_")}' if show_game else ""
        out_path = os.path.join(OUTPUT_DIR, f"{safe_name}{game_tag}.{output_format}")
        with open(out_path, "wb") as f:
            f.write(buffer.getvalue())
        print(f"Guardado en: {out_path}")


# ── CLI ───────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generador de pósters de Monster Hunter"
    )
    parser.add_argument("monster", type=str, help="Nombre del monstruo (ej: Rathalos)")
    parser.add_argument(
        "--game",
        "-g",
        type=str,
        default=None,
        help="Nombre del juego a mostrar (opcional)",
    )
    parser.add_argument(
        "--format",
        "-f",
        type=str,
        default="png",
        choices=["png", "pdf"],
        help="Formato de salida",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Escribir resultado en stdout en lugar de disco",
    )
    args = parser.parse_args()

    if args.stdout:
        # Guardar referencia al buffer binario de stdout ANTES de redirigir
        _binary_stdout = sys.stdout.buffer
        # Redirigir todo texto a stderr para no corromper los bytes de la imagen
        sys.stdout = sys.stderr
    else:
        _binary_stdout = None

    generate_poster(args.monster, args.game, args.format, args.stdout, _binary_stdout)
