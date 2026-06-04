# 🐉 Monster Hunter Poster Generator

Generador de pósters personalizados de la saga Monster Hunter. Combina datos de múltiples APIs públicas con un generador de imágenes en Python para crear pósters imprimibles con la estética del juego.

---

## Estructura del proyecto

```
mh-poster/
├── api/                    ← API REST en Node.js (Express)
│   ├── src/
│   │   ├── server.js       ← servidor principal
│   │   └── scripts/        ← scripts de recopilación de datos
│   ├── data/               ← monsters_all.json
│   └── template/monster/   ← iconos PNG de monstruos
├── generator/              ← Generador de pósters en Python
│   ├── src/
│   │   └── poster.py       ← script principal
│   └── assets/
│       ├── backgrounds/    ← fondo del póster
│       └── fonts/          ← fuentes tipográficas
├── frontend/               ← Interfaz web en React + Vite
│   └── src/
└── .venv/                  ← entorno virtual Python
```

---

## Requisitos previos

- **Node.js** v18 o superior
- **Python** 3.8 o superior
- **Git**

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tuusuario/mh-poster.git
cd mh-poster
```

### 2. Instalar dependencias de la API

```bash
cd api
npm install
cd ..
```

### 3. Crear el entorno virtual de Python e instalar dependencias

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate

pip install -r generator/requirements.txt
```

### 4. Instalar dependencias del frontend

```bash
cd frontend
npm install
cd ..
```

### 5. Configurar variables de entorno

Crea el archivo `generator/.env`:
```
API_URL=http://localhost:3000
```

Crea el archivo `frontend/.env.development`:
```
VITE_API_URL=http://localhost:3000
```

### 6. Añadir assets necesarios

Coloca los siguientes archivos en sus rutas correspondientes:

| Archivo | Ruta |
|---|---|
| Fondo del póster | `generator/assets/backgrounds/background.png` |
| Fuente título | `generator/assets/fonts/OptimusPrincepsSemiBold.ttf` |
| Fuente subtítulo | `generator/assets/fonts/Cinzel-ExtraBold.ttf` |
| Icono sin imagen | `api/template/monster/unknown_monster.png` |

Las fuentes Cinzel están disponibles en [Google Fonts](https://fonts.google.com/specimen/Cinzel).
La fuente Optimus Princeps está disponible en [DaFont](https://www.dafont.com/optimus-princeps.font).

---

## Recopilación de datos

Antes de levantar el proyecto por primera vez hay que obtener los datos de los monstruos e iconos:

```bash
cd api/src/scripts

# 1. Obtener datos de monstruos desde las APIs públicas
node fetchMonsters.js

# 2. Descargar iconos de monstruos
node downloadImages.js
```

Los datos se guardan en `api/data/monsters_all.json` y los iconos en `api/template/monster/`.

---

## Levantar el proyecto en local

Necesitas tres terminales abiertas simultáneamente:

### Terminal 1 — API Node.js

```bash
cd api/src
node server.js
```

La API estará disponible en `http://localhost:3000`.

### Terminal 2 — Frontend React

```bash
cd frontend
npm run dev
```

El frontend estará disponible en `http://localhost:5173`.

### Terminal 3 — Generator Python (opcional, solo para uso por CLI)

El generator se invoca automáticamente desde la API cuando se genera un póster desde el frontend. Para usarlo directamente por línea de comandos:

```bash
# Activar entorno virtual
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Linux / macOS

cd generator/src

# Generar póster en PNG
python poster.py "Rathalos"

# Generar póster con juego en PDF
python poster.py "Rathalos" --game "Monster Hunter World" --format pdf
```

Los pósters generados por CLI se guardan en `generator/output/`.

---

## Endpoints de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/monsters` | Lista todos los monstruos (soporta `?limit`, `?offset`, `?search`, `?species`) |
| `GET` | `/monsters/:identifier` | Obtiene un monstruo por nombre o id |
| `GET` | `/monsters/game/:game` | Filtra monstruos por juego |
| `GET` | `/monsters/:name/image` | Sirve el icono PNG del monstruo |
| `POST` | `/monsters` | Crea un monstruo manualmente |
| `PUT` | `/monsters/:name` | Actualiza un monstruo |
| `DELETE` | `/monsters/:name` | Elimina un monstruo |
| `POST` | `/posters/generate` | Genera un póster y lo devuelve como blob |

### Ejemplo POST /posters/generate

```json
{
  "monster": "Rathalos",
  "game": "Monster Hunter World",
  "format": "png"
}
```

---

## Fuentes de datos

| Fuente | Juegos cubiertos |
|---|---|
| [mhw-db.com](https://mhw-db.com) | Monster Hunter World / Iceborne |
| [wilds.mhdb.io](https://wilds.mhdb.io) | Monster Hunter Wilds |
| [CrimsonNynja/monster-hunter-DB](https://github.com/CrimsonNynja/monster-hunter-DB) | Saga completa |

---

## Stack tecnológico

- **API:** Node.js, Express, CORS
- **Generator:** Python 3.8, Pillow, NumPy, python-dotenv
- **Frontend:** React, Vite, React Router, Axios
- **Datos:** JSON local generado desde APIs públicas
