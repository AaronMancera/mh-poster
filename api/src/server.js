const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

// ── Rutas de datos ────────────────────────────────────────
const MONSTERS_PATH = path.join(__dirname, '..', 'data', 'monsters_all.json');
const IMAGES_DIR = path.join(__dirname, '..', 'template', 'monster');

// ── Rutas del generator ───────────────────────────────────
const GENERATOR_DIR = path.join(__dirname, '..', '..', 'generator');
const POSTER_SCRIPT = path.join(GENERATOR_DIR, 'src', 'poster.py');
const OUTPUT_DIR = path.join(GENERATOR_DIR, 'output');

// ── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.set('port', PORT || 3000); //-> Para configurar el puerto en el que esta trabajando. Automaticamente pilla el 3000 o +X que este disponible 

// ── Helpers ───────────────────────────────────────────────
function loadMonsters() {
  return JSON.parse(fs.readFileSync(MONSTERS_PATH, 'utf-8'));
}

function saveMonsters(monsters) {
  fs.writeFileSync(MONSTERS_PATH, JSON.stringify(monsters, null, 2));
}

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/\.+$/, '')
    .trim()
    .toLowerCase();
}

function enrichMonster(monster, req) {
  const filename = sanitizeFilename(monster.name) + '.png';
  const imagePath = path.join(IMAGES_DIR, filename);
  // // DEBUG — eliminar una vez confirmado
  // console.log(`[enrichMonster] ${monster.name}`);
  // console.log(`  filename:  ${filename}`);
  // console.log(`  imagePath: ${imagePath}`);
  // console.log(`  exists:    ${fs.existsSync(imagePath)}`);
  //Esto fallla porque el nombre de la imagen es diferente a cuando lo buscas. 

  return {
    ...monster,
    image_url: fs.existsSync(imagePath)
      ? `${req.protocol}://${req.get('host')}/monsters/${encodeURIComponent(monster.name)}/image`
      : `${req.protocol}://${req.get('host')}/monsters/unknown_monster/image`,
  };
}

// ── GET /monsters ─────────────────────────────────────────
// Query params opcionales: ?species=wyvern  ?source=mhw-db.com
app.get('/monsters', (req, res) => {
  try {
    let monsters = loadMonsters();

    if (req.query.species) {
      monsters = monsters.filter(m =>
        m.species?.toLowerCase().includes(req.query.species.toLowerCase())
      );
    }
    if (req.query.source) {
      monsters = monsters.filter(m =>
        m.source?.toLowerCase() === req.query.source.toLowerCase()
      );
    }

    if (req.query.search) {
      const q = req.query.search.toLowerCase();
      monsters = monsters.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.species?.toLowerCase().includes(q)
      );
    }
    // Paginación
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const total = monsters.length;
    const paged = monsters.slice(offset, offset + limit)

    res.json({
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      monsters: paged.map(m => enrichMonster(m, req)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /monsters/game/:game ──────────────────────────────
// Ej: /monsters/game/World  /monsters/game/Wilds  /monsters/game/MHW
app.get('/monsters/game/:game', (req, res) => {
  try {
    const game = req.params.game.toLowerCase();
    const monsters = loadMonsters().filter(m =>
      m.games?.some(g => g.toLowerCase().includes(game)) ||
      m.source?.toLowerCase().includes(game)
    );

    if (!monsters.length) {
      return res.status(404).json({ error: `No se encontraron monstruos para el juego: ${req.params.game}` });
    }

    res.json({
      game: req.params.game,
      total: monsters.length,
      monsters: monsters.map(m => enrichMonster(m, req)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /monsters/:identifier ─────────────────────────────
// Acepta id numérico o nombre (parcial, case-insensitive)
app.get('/monsters/:identifier', (req, res) => {
  try {
    const { identifier } = req.params;
    const monsters = loadMonsters();

    const monster = isNaN(identifier)
      ? monsters.find(m => m.name?.toLowerCase() === identifier.toLowerCase()) ||
      monsters.find(m => m.name?.toLowerCase().includes(identifier.toLowerCase()))
      : monsters.find((_, i) => i + 1 === parseInt(identifier));

    if (!monster) {
      return res.status(404).json({ error: `Monstruo no encontrado: ${identifier}` });
    }

    res.json(enrichMonster(monster, req));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /monsters/:name/image ─────────────────────────────
// Sirve el PNG directamente — esta URL es la que usará Python
app.get('/monsters/:name/image', (req, res) => {
  try {
    const filename = sanitizeFilename(decodeURIComponent(req.params.name)) + '.png';
    let imagePath = path.join(IMAGES_DIR, filename);

    // if (!fs.existsSync(imagePath)) {
    //   return res.status(404).json({ error: `Imagen no encontrada: ${filename}` });
    // }
    if (!fs.existsSync(imagePath)) {
      imagePath = path.join(IMAGES_DIR, 'unknown_monster.png');
    }

    res.setHeader('Content-Type', 'image/png');
    res.sendFile(imagePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /monsters ────────────────────────────────────────
app.post('/monsters', (req, res) => {
  try {
    const { name, species, type, elements, weaknesses, games, source } = req.body;

    if (!name) return res.status(400).json({ error: 'El campo name es obligatorio' });

    const monsters = loadMonsters();
    const exists = monsters.find(m => m.name?.toLowerCase() === name.toLowerCase());
    if (exists) return res.status(409).json({ error: `El monstruo '${name}' ya existe` });

    const newMonster = {
      name,
      species: species || 'unknown',
      type: type || 'unknown',
      elements: elements || [],
      weaknesses: weaknesses || [],
      games: games || [],
      source: source || 'manual',
    };

    monsters.push(newMonster);
    saveMonsters(monsters);

    res.status(201).json(enrichMonster(newMonster, req));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /monsters/:name ───────────────────────────────────
app.put('/monsters/:name', (req, res) => {
  try {
    const monsters = loadMonsters();
    const index = monsters.findIndex(
      m => m.name?.toLowerCase() === req.params.name.toLowerCase()
    );

    if (index === -1) {
      return res.status(404).json({ error: `Monstruo no encontrado: ${req.params.name}` });
    }

    // Merge — solo actualiza los campos enviados
    monsters[index] = { ...monsters[index], ...req.body };
    saveMonsters(monsters);

    res.json(enrichMonster(monsters[index], req));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /monsters/:name ────────────────────────────────
app.delete('/monsters/:name', (req, res) => {
  try {
    const monsters = loadMonsters();
    const index = monsters.findIndex(
      m => m.name?.toLowerCase() === req.params.name.toLowerCase()
    );

    if (index === -1) {
      return res.status(404).json({ error: `Monstruo no encontrado: ${req.params.name}` });
    }

    const deleted = monsters.splice(index, 1)[0];
    saveMonsters(monsters);

    res.json({ message: `Monstruo '${deleted.name}' eliminado correctamente` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /posters/generate ────────────────────────────────
app.post('/posters/generate', (req, res) => {
  const { monster, game, format = 'png' } = req.body;
  if (!monster) return res.status(400).json({ error: 'El campo monster es obligatorio' });

const PYTHON = process.platform === 'win32'
  ? path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe')
  : path.join(__dirname, '..', '..', '.venv', 'bin', 'python3');
const args = [POSTER_SCRIPT, monster, '--stdout'];
if (game) args.push('--game', game);
args.push('--format', format);

  console.log(`[POSTER] Ejecutando: ${PYTHON} ${args.join(' ')}`);

  const proc   = spawn(PYTHON, args, {
    cwd: GENERATOR_DIR,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  const chunks = [];
  let stderr   = '';

  proc.stdout.on('data', chunk => chunks.push(chunk));   // captura bytes del poster
  proc.stderr.on('data', d    => { stderr += d; process.stderr.write(`[POSTER] ${d}`); });

  proc.on('close', code => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Error al generar el póster', detail: stderr });
    }

    const buffer   = Buffer.concat(chunks);
    const mimeType = format === 'pdf' ? 'application/pdf' : 'image/png';
    const safeName = monster.toLowerCase().replace(/\s+/g, '_').replace(/'/g, '');
    const gameTag  = game ? `_${game.toLowerCase().replace(/\s+/g, '_')}` : '';
    const filename = `${safeName}${gameTag}.${format}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  });
});

// ── Arrancar servidor ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Servidor MH API corriendo`);
  // console.log(`\nServidor MH API corriendo en http://localhost:${PORT}`);
  // console.log('\nEndpoints disponibles:');
  // console.log(`  GET    http://localhost:${PORT}/monsters`);
  // console.log(`  GET    http://localhost:${PORT}/monsters/:identifier`);
  // console.log(`  GET    http://localhost:${PORT}/monsters/game/:game`);
  // console.log(`  GET    http://localhost:${PORT}/monsters/:name/image`);
  // console.log(`  POST   http://localhost:${PORT}/monsters`);
  // console.log(`  PUT    http://localhost:${PORT}/monsters/:name`);
  // console.log(`  DELETE http://localhost:${PORT}/monsters/:name`);
  // console.log(`  POST   http://localhost:${PORT}/posters/generate\n`);
});



// app.post('/posters/generate', (req, res) => {
//   const { monster, game, format = 'png' } = req.body;
//   // console.log(`[POSTER] Solicitud de generación: monster='${monster}', game='${game}', format='${format}'`);
//   // {"monster":"Great Jagras","game":null,"format":"png"}

//   if (!monster) return res.status(400).json({ error: 'El campo monster es obligatorio' });

//   // Ejecutable Python del venv en la raíz del proyecto
//   const PYTHON = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');

//   // Construir argumentos — igual que CLI: poster.py "Rathalos" --game "World" --format png
//   const args = [POSTER_SCRIPT, monster];
//   if (game) args.push('--game', game);
//   args.push('--format', format);

//   console.log(`[POSTER] Ejecutando: ${PYTHON} ${args.join(' ')}`);

//   const proc = spawn(PYTHON, args, {
//     cwd: GENERATOR_DIR,
//     env: { ...process.env, PYTHONIOENCODING: 'utf-8' } //La solución más limpia es forzar UTF-8 al hacer el spawn
//   });

//   let stderr = '';
//   proc.stdout.on('data', d => process.stdout.write(`[POSTER] ${d}`));
//   proc.stderr.on('data', d => { stderr += d; process.stderr.write(`[POSTER ERR] ${d}`); });

//   proc.on('close', code => {
//     if (code !== 0) {
//       return res.status(500).json({ error: 'Error al generar el póster', detail: stderr });
//     }

//     // Replicar exactamente la lógica de poster.py líneas 302-303
//     const safeName = monster.toLowerCase().replace(/\s+/g, '_').replace(/'/g, '');
//     const gameTag = game ? `_${game.toLowerCase().replace(/\s+/g, '_')}` : '';
//     const filename = `${safeName}${gameTag}.${format}`;
//     const filepath = path.join(OUTPUT_DIR, filename);

//     console.log(`[POSTER] Buscando archivo: ${filepath}`);

//     if (!fs.existsSync(filepath)) {
//       return res.status(404).json({ error: `Archivo generado no encontrado: ${filename}` });
//     }

//     const mimeType = format === 'pdf' ? 'application/pdf' : 'image/png';
//     res.setHeader('Content-Type', mimeType);
//     res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
//     res.sendFile(filepath);
//   });
// });

//PRUEBA POST
// curl -X POST http://localhost:3000/monsters -H "Content-Type: application/json" -d "{\"name\":\"Test Monster\",\"species\":\"test wyvern\",\"type\":\"large\",\"elements\":[\"fire\"],\"weaknesses\":[\"water\"],\"games\":[\"World\"]}"

//PRUEBA POST uno que ya existe
// Salida: {"error":"El monstruo 'Test Monster' ya existe"}
//PRUEBA PUT
// curl -X PUT http://localhost:3000/monsters/Test%20Monster -H "Content-Type: application/json" -d "{\"species\":\"updated wyvern\",\"elements\":[\"fire\",\"ice\"]}"

// curl http://localhost:3000/monsters/Test%20Monster

//PRUEBA PUT de uno que no existe
// curl -X PUT http://localhost:3000/monsters/Testtt -H "Content-Type: application/json" -d "{\"species\":\"updated wyvern\",\"elements\":[\"fire\",\"ice\"]}"
// Salida: {"error":"Monstruo no encontrado: Testtt"}

//PRUEBA DELETE
// curl -X DELETE http://localhost:3000/monsters/Test%20Monster
// curl http://localhost:3000/monsters/Test%20Monster

//PRUEBA DELETE de uno que no existe
// curl -X DELETE http://localhost:3000/monsters/Test%20Monster
// Salida: {"error":"Monstruo no encontrado: Test Monster"}