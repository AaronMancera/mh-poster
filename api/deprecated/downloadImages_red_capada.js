const axios = require('axios');
const fs = require('fs');
const path = require('path');

const WIKI_API = 'https://monsterhunterwiki.org/api.php';

// ── Sanitizar nombre para Windows ────────────────────────
function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/\.+$/, '')
    .trim()
    .toLowerCase();
}

// ── Obtener todas las imágenes de una categoría de la wiki ──
async function getWikiCategoryFiles(category) {
  const files = [];
  let cmcontinue = null;

  do {
    const params = {
      action:  'query',
      list:    'categorymembers',
      cmtitle: `Category:${category}`,
      cmtype:  'file',
      cmlimit: 500,
      format:  'json',
      ...(cmcontinue && { cmcontinue }),
    };

    const { data } = await axios.get(WIKI_API, { params, timeout: 10000 });
    const members = data?.query?.categorymembers || [];
    files.push(...members);
    cmcontinue = data?.continue?.cmcontinue || null;

  } while (cmcontinue);

  return files; // [{ title: 'File:MHWilds-Rathalos Icon.webp', ... }]
}

// ── Obtener la URL de descarga directa de un archivo wiki ──
async function getWikiFileUrl(fileTitle) {
  const { data } = await axios.get(WIKI_API, {
    params: {
      action: 'query',
      titles: fileTitle,
      prop:   'imageinfo',
      iiprop: 'url',
      format: 'json',
    },
    timeout: 10000,
  });

  const pages = data?.query?.pages || {};
  const page  = Object.values(pages)[0];
  return page?.imageinfo?.[0]?.url || null;
}

// ── Construir mapa: nombre normalizado → URL de descarga ──
async function buildWikiIconMap(categories) {
  const map = {};

  for (const category of categories) {
    console.log(`  Listando categoría: ${category}...`);
    const files = await getWikiCategoryFiles(category);
    console.log(`  → ${files.length} archivos encontrados`);

    for (const file of files) {
      // Extraer nombre del monstruo desde el título del archivo
      // Ej: "File:MHWilds-Rathalos Icon.webp" → "rathalos"
      const match = file.title.match(/File:(?:MH\w+-)?(.+?)\s+Icon\./i);
      if (!match) continue;

      const key = sanitizeFilename(match[1]);
      if (!map[key]) {
        map[key] = { fileTitle: file.title, category };
      }
    }
  }

  return map;
}

// ── Descargar imagen con reintentos ──────────────────────
async function downloadImage(url, destPath, label, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });
      fs.writeFileSync(destPath, response.data);
      return true;
    } catch (err) {
      console.warn(`  ⚠ Intento ${i + 1}/${retries} fallido [${label}]: ${err.message}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
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
  console.log(`[PASO 2] Carpeta de salida: ${outputDir}`);

  // PASO 3 — Construir mapa de iconos desde la wiki
  console.log('\n[PASO 3] Obteniendo listado de iconos de monsterhunterwiki.org...');
  let wikiMap = {};
  try {
    wikiMap = await buildWikiIconMap([
      'MHWorld_Monster_Icons',
      'MHWilds_Monster_Icons',
    ]);
    console.log(`  Mapa construido: ${Object.keys(wikiMap).length} iconos disponibles`);
  } catch (err) {
    console.warn(`  ⚠ No se pudo acceder a la wiki: ${err.message}`);
    console.warn('  Continuando solo con image_url de mh-api.com...');
  }

  // PASO 4 — Descargar imagen de cada monstruo
  console.log('\n[PASO 4] Descargando imágenes...');
  const results = { ok: [], failed: [], skipped: [] };

  for (const monster of monsters) {
    const filename  = sanitizeFilename(monster.name) + '.png';
    const destPath  = path.join(outputDir, filename);
    const nameKey   = sanitizeFilename(monster.name);

    // Si ya existe, saltar
    if (fs.existsSync(destPath)) {
      console.log(`  [existe]  ${filename}`);
      results.ok.push(monster.name);
      continue;
    }

    // Fuente 1: mh-api.com → GitHub raw (saga completa)
    if (monster.image_url) {
      console.log(`  [github]  ${monster.name}...`);
      const ok = await downloadImage(monster.image_url, destPath, monster.name);
      if (ok) { results.ok.push(monster.name); console.log(`  ✓ ${filename}`); }
      else    { results.failed.push(monster.name); }
      await new Promise(r => setTimeout(r, 200));
      continue;
    }

    // Fuente 2: monsterhunterwiki.org (World / Wilds)
    if (wikiMap[nameKey]) {
      try {
        console.log(`  [wiki]    ${monster.name}...`);
        const fileUrl = await getWikiFileUrl(wikiMap[nameKey].fileTitle);
        if (fileUrl) {
          const ok = await downloadImage(fileUrl, destPath, monster.name);
          if (ok) { results.ok.push(monster.name); console.log(`  ✓ ${filename}`); }
          else    { results.failed.push(monster.name); }
        } else {
          console.warn(`  ✗ Sin URL para: ${monster.name}`);
          results.failed.push(monster.name);
        }
      } catch (err) {
        console.warn(`  ✗ Error wiki [${monster.name}]: ${err.message}`);
        results.failed.push(monster.name);
      }
      await new Promise(r => setTimeout(r, 300));
      continue;
    }

    // Sin fuente disponible
    console.log(`  [sin fuente] ${monster.name}`);
    results.skipped.push(monster.name);
  }

  // PASO 5 — Guardar log de pendientes
  const logPath = path.join(__dirname, 'data', 'images_pending.json');
  fs.writeFileSync(logPath, JSON.stringify({
    failed:  results.failed,
    skipped: results.skipped,
  }, null, 2));

  // Resumen
  console.log('\n─────────────────────────────');
  console.log('Resumen de imágenes:');
  console.log(`  ✓ Descargadas / ya existían: ${results.ok.length}`);
  console.log(`  ✗ Fallaron:                  ${results.failed.length}`);
  console.log(`  ○ Sin fuente:                ${results.skipped.length}`);
  console.log(`  Log de pendientes:           data/images_pending.json`);
  console.log('─────────────────────────────');
}

downloadAllImages();
// ```

// El flujo de decisión para cada monstruo es este:
// ```
// ¿Ya existe el archivo en disco?
//   → Sí: saltar
//   → No:
//       ¿Tiene image_url? (viene de mh-api.com)
//         → Sí: descargar de GitHub raw
//         → No:
//             ¿Está en el mapa de la wiki? (World/Wilds)
//               → Sí: pedir URL a MediaWiki API y descargar
//               → No: registrar en images_pending.json