const axios = require('axios');
const fs = require('fs');
const path = require('path');
//https://github.com/CrimsonNynja/monster-hunter-DB/tree/master


// ── Prefijos de juego para buscar en CrimsonNynja/monster-hunter-DB ──
// Orden de preferencia: Wilds > Iceborne > World > juegos anteriores
const CRIMSONYNJA_PREFIXES = ['MHWilds', 'MHWI', 'MHW', 'MHR', 'MHXX', 'MH4U', 'MH3U'];
const CRIMSONYNJA_BASE = 'https://raw.githubusercontent.com/CrimsonNynja/monster-hunter-DB/master/icons';

// ── Sanitizar nombre para Windows ────────────────────────
function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/\.+$/, '')
    .trim()
    .toLowerCase();
}

// ── Convertir nombre de monstruo al formato del repo ─────
// "Azure Rathalos" → "Azure_Rathalos"
function toRepoName(name) {
//   name = name.replace('\'','')
// Importante para que pueda corregir el valor de xeno'jiva y lo descarge
  return name.trim().replace(/\s+/g, '_').replace('\'','');

}

// ── Intentar descargar una URL, devuelve true si OK ──────
async function tryDownload(url, destPath, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 12000,
      });
      fs.writeFileSync(destPath, response.data);
      return true;
    } catch {
      if (i < retries - 1) await new Promise(r => setTimeout(r, 800));
    }
  }
  return false;
}

// ── Fuente 1: mh-api.com → GitHub raw ────────────────────
async function fromMhApi(monster, destPath) {
  if (!monster.image_url) return false;
  console.log(`  [mh-api]  ${monster.name}...`);
  return await tryDownload(monster.image_url, destPath);
}

// ── Fuente 2: CrimsonNynja/monster-hunter-DB ─────────────
// Prueba varios prefijos de juego hasta encontrar uno que exista
async function fromCrimsonNynja(monster, destPath) {
  const repoName = toRepoName(monster.name);
  for (const prefix of CRIMSONYNJA_PREFIXES) {
    const url = `${CRIMSONYNJA_BASE}/${prefix}-${repoName}_Icon.png`;
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      fs.writeFileSync(destPath, response.data);
      console.log(`  [github]  ${monster.name} (${prefix})...`);
      return true;
    } catch {
      // Ese prefijo no existe, intentamos el siguiente
    }
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}

// ── Fuente 3: Fandom wiki (último recurso) ────────────────
async function fromFandom(monster, destPath) {
  try {
    // La wiki de Fandom usa el nombre con guiones bajos en la URL de imagen
    const wikiName = toRepoName(monster.name);
    const url = `https://static.wikia.nocookie.net/monsterhunterworld/images/thumb/MHW_${wikiName}_Icon.png/200px-MHW_${wikiName}_Icon.png`;
    console.log(`  [fandom]  ${monster.name}...`);
    return await tryDownload(url, destPath);
  } catch {
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────
async function downloadAllImages() {
  // PASO 1 — Cargar monsters_all.json
  const monstersPath = path.join(__dirname, 'data', 'monsters_all.json');
  if (!fs.existsSync(monstersPath)) {
    console.error('✗ No se encuentra data/monsters_all.json. Ejecuta fetchMonsters.js primero.');
    process.exit(1);
  }
  const monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));
  console.log(`[PASO 1] ${monsters.length} monstruos cargados`);

  // PASO 2 — Crear carpeta templates/monster
  const outputDir = path.join(__dirname, 'templates', 'monster');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  console.log(`[PASO 2] Carpeta de salida: ${outputDir}\n`);

  // PASO 3 — Descargar imagen de cada monstruo
  console.log('[PASO 3] Descargando imágenes...');
  const results = { ok: [], failed: [] };

  for (const monster of monsters) {
    const filename = sanitizeFilename(monster.name) + '.png';
    const destPath = path.join(outputDir, filename);

    // Si ya existe, saltar
    if (fs.existsSync(destPath)) {
      console.log(`  [existe]  ${filename}`);
      results.ok.push({ name: monster.name, source: 'cache' });
      continue;
    }

    // Intentar fuentes en orden
    let ok = false;

    ok = await fromMhApi(monster, destPath);
    if (!ok) ok = await fromCrimsonNynja(monster, destPath);
    if (!ok) ok = await fromFandom(monster, destPath);

    if (ok) {
      console.log(`  ✓ ${filename}`);
      results.ok.push({ name: monster.name });
    } else {
      console.warn(`  ✗ Sin imagen: ${monster.name}`);
      results.failed.push(monster.name);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  // PASO 4 — Guardar log de fallidos
  const logPath = path.join(__dirname, 'data', 'images_pending.json');
  fs.writeFileSync(logPath, JSON.stringify({ failed: results.failed }, null, 2));

  // Resumen
  console.log('\n─────────────────────────────');
  console.log('Resumen de imágenes:');
  console.log(`  ✓ Descargadas / ya existían: ${results.ok.length}`);
  console.log(`  ✗ Sin imagen:               ${results.failed.length}`);
  if (results.failed.length > 0) {
    console.log(`  Pendientes en: data/images_pending.json`);
  }
  console.log('─────────────────────────────');
}

downloadAllImages();

// ```
// Este script se realiza la descarga del respositorio de Crimson Nynja y compara los que tengo en la lista y los añade.
// Luego ya resolvere tambien con la otra API porque si la red es corporativa no ba a resolver.
// ```