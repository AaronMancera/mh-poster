mh-poster/
│
├── api/                          ← Node.js (todo el backend)
│   ├── src/
│   │   ├── routes/
│   │   │   └── monsters.js       ← endpoints CRUD + image
│   │   ├── scripts/
│   │   │   ├── fetchMonsters.js  ← recopilación de datos
│   │   │   └── downloadImages.js ← descarga de iconos
│   │   └── server.js             ← arranque Express
│   ├── data/
│   │   ├── monsters_all.json
│   │   ├── translation_cache.json
│   │   └── images_pending.json
│   ├── templates/
│   │   └── monster/              ← PNGs de iconos
│   ├── package.json
│   └── .env                      ← PORT, rutas configurables
│
├── generator/                    ← Python (generador de pósters)
│   ├── src/
│   │   └── poster.py             ← script principal
│   ├── assets/                   ← fondos, fuentes, elementos UI
│   │   ├── backgrounds/
│   │   └── fonts/
│   ├── output/                   ← pósters generados
│   ├── requirements.txt
│   └── .env                      ← URL de la API Node
│
├── frontend/                     ← Interfaz web
│   ├── src/
│   └── package.json
│
├── docs/                         ← Documentación
│   ├── api.md                    ← endpoints documentados
│   └── setup.md                  ← guía de instalación
│
├── docker-compose.yml            ← orquesta api + generator + frontend
├── .gitignore
└── README.md