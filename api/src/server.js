const express = require('express');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');

const app  = express();
const PORT = 3000;

// ── Rutas de datos ────────────────────────────────────────
const MONSTERS_PATH = path.join(__dirname,'..', 'data', 'monsters_all.json');
const IMAGES_DIR    = path.join(__dirname,'..', 'template', 'monster');

// ── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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
  // DEBUG — eliminar una vez confirmado
  console.log(`[enrichMonster] ${monster.name}`);
  console.log(`  filename:  ${filename}`);
  console.log(`  imagePath: ${imagePath}`);
  console.log(`  exists:    ${fs.existsSync(imagePath)}`);
  //Esto fallla porque el nombre de la imagen es diferente a cuando lo buscas. 

  return {
    ...monster,
    image_url: fs.existsSync(imagePath)
      ? `${req.protocol}://${req.get('host')}/monsters/${encodeURIComponent(monster.name)}/image`
      : 'null',
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

    res.json({
      total: monsters.length,
      monsters: monsters.map(m => enrichMonster(m, req)),
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
    const imagePath = path.join(IMAGES_DIR, filename);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: `Imagen no encontrada: ${filename}` });
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
      species:    species    || 'unknown',
      type:       type       || 'unknown',
      elements:   elements   || [],
      weaknesses: weaknesses || [],
      games:      games      || [],
      source:     source     || 'manual',
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

// ── Arrancar servidor ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nServidor MH API corriendo en http://localhost:${PORT}`);
  console.log('\nEndpoints disponibles:');
  console.log(`  GET    http://localhost:${PORT}/monsters`);
  console.log(`  GET    http://localhost:${PORT}/monsters/:identifier`);
  console.log(`  GET    http://localhost:${PORT}/monsters/game/:game`);
  console.log(`  GET    http://localhost:${PORT}/monsters/:name/image`);
  console.log(`  POST   http://localhost:${PORT}/monsters`);
  console.log(`  PUT    http://localhost:${PORT}/monsters/:name`);
  console.log(`  DELETE http://localhost:${PORT}/monsters/:name\n`);
});

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