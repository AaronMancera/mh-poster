const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── Mapa local: nombres JP → EN conocidos de la saga ─────
const KNOWN_NAMES = {
  'リオレウス': 'Rathalos',
  'リオレイア': 'Rathian',
  'ナルガクルガ': 'Nargacuga',
  'ティガレックス': 'Tigrex',
  'ジンオウガ': 'Zinogre',
  'ラージャン': 'Rajang',
  'クシャルダオラ': 'Kushala Daora',
  'テオ・テスカトル': 'Teostra',
  'バゼルギウス': 'Bazelgeuse',
  'イビルジョー': 'Deviljho',
  'ブラキディオス': 'Brachydios',
  'アグナコトル': 'Agnaktor',
  'ウラガンキン': 'Uragaan',
  'ドボルベルク': 'Duramboros',
  'アマツマガツチ': 'Amatsu',
  'シャガルマガラ': 'Shagaru Magala',
  'ゴア・マガラ': 'Gore Magala',
  'セルレギオス': 'Seregios',
  'ガムート': 'Gammoth',
  'タマミツネ': 'Mizutsune',
  'ライゼクス': 'Astalos',
  'ディノバルド': 'Glavenus',
  'カガチ': 'Tobi-Kadachi',
  'オドガロン': 'Odogaron',
  'パオウルムー': 'Paolumu',
  'プケプケ': 'Pukei-Pukei',
  'バフバロ': 'Banbaro',
  'ベリオロス': 'Barioth',
  'ブラントドス': 'Beotodus',
  'フルフル': 'Fulgur Anjanath',
  'コルセール': 'Coral Pukei-Pukei',
  'マスターランクラギアクルス': 'Lagiacrus',
  'ラギアクルス': 'Lagiacrus',
  'ガノトトス': 'Jyuratodus',
  'イソネミクニ': 'Somnacanth',
  'アケノシルム': 'Aknosom',
  'ビシュテンゴ': 'Bishaten',
  'ゴシャハギ': 'Goss Harag',
  'テツカブラ': 'Tetnaught',
  'ナルハタタヒメ': 'Narwa the Allmother',
  'イブシマキヒコ': 'Ibushi',
  'マガイマガド': 'Malzeno',
  'バルファルク': 'Malzeno',
  'ガランゴルム': 'Garangolm',
  'ヴォルガノス': 'Volvidon',
  'ドスフロギィ': 'Tobi-Kadachi',
};

// ── Caché en disco para no repetir llamadas ───────────────
const CACHE_PATH = path.join(__dirname, 'data', 'translation_cache.json');

function loadCache() {
  if (fs.existsSync(CACHE_PATH)) {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  }
  return {};
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

// ── Detectar si un texto es japonés ──────────────────────
function isJapanese(text) {
  return /[\u3000-\u9fff]/.test(text);
}

// ── Traducción vía MyMemory (gratuita, sin API key) ───────
async function translateWithApi(text, cache) {
  if (cache[text]) return cache[text];

  try {
    const { data } = await axios.get('https://api.mymemory.translated.net/get', {
      params: { q: text, langpair: 'ja|en' },
      timeout: 5000,
    });

    const translated = data?.responseData?.translatedText;
    if (translated && translated !== text) {
      cache[text] = translated;
      return translated;
    }
  } catch {
    // Si falla la API, devolvemos el original
  }

  return text;
}

// ── Paso de traducción principal ──────────────────────────
async function translateMonsterNames(monsters) {
  const cache = loadCache();
  const results = [];

  for (const monster of monsters) {
    if (!isJapanese(monster.name)) {
      results.push(monster);
      continue;
    }

    // Capa 1: mapa local
    if (KNOWN_NAMES[monster.name]) {
      console.log(`  [local] ${monster.name} → ${KNOWN_NAMES[monster.name]}`);
      results.push({ ...monster, name: KNOWN_NAMES[monster.name], original_name_jp: monster.name });
      continue;
    }

    // Capa 2: MyMemory API
    console.log(`  [api]   Traduciendo: ${monster.name}...`);
    const translated = await translateWithApi(monster.name, cache);
    console.log(`          → ${translated}`);
    results.push({ ...monster, name: translated, original_name_jp: monster.name });

    // Pausa breve para no saturar la API gratuita
    await new Promise(r => setTimeout(r, 300));
  }

  saveCache(cache);
  return results;
}

// ── Resto del script (igual que antes) ───────────────────
const SOURCES = {
  world: 'https://mhw-db.com/monsters',
  wilds: 'https://wilds.mhdb.io/en/monsters',
  saga:  'https://api.mh-api.com/v1/monsters',
};

function normalizeWorld(m) {
  return { name: m.name, species: m.species, type: m.type, elements: m.elements || [], weaknesses: (m.weaknesses || []).map(w => w.element), games: ['World'], source: 'mhw-db.com' };
}
function normalizeWilds(m) {
  return { name: m.name, species: m.species || 'unknown', type: m.type || 'unknown', elements: m.elements || [], weaknesses: (m.weaknesses || []).map(w => w.element), games: ['Wilds'], source: 'wilds.mhdb.io' };
}
function normalizeSaga(m) {
  return { name: m.name || m.another_name, species: m.category || 'unknown', type: 'large', elements: [], weaknesses: [], games: m.title || [], source: 'mh-api.com' };
}

async function safeFetch(url, label) {
  try {
    console.log(`Obteniendo ${label}...`);
    const { data } = await axios.get(url, { timeout: 10000 });
    return Array.isArray(data) ? data : (data.monsters || []);
  } catch (err) {
    console.warn(`⚠ No se pudo obtener ${label}: ${err.message}`);
    return [];
  }
}

async function fetchAllMonsters() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  // 1. Fetch de todas las fuentes
  const [rawWorld, rawWilds, rawSaga] = await Promise.all([
    safeFetch(SOURCES.world, 'Monster Hunter World'),
    safeFetch(SOURCES.wilds, 'Monster Hunter Wilds'),
    safeFetch(SOURCES.saga,  'Saga completa'),
  ]);

  // 2. Normalizar
  const worldMonsters = rawWorld.filter(m => m.type === 'large').map(normalizeWorld);
  const wildsMonsters = rawWilds.filter(m => m.type === 'large').map(normalizeWilds);
  const sagaMonsters  = rawSaga.map(normalizeSaga);

  // 3. Traducir nombres japoneses
  console.log('\nTraduciendo nombres japoneses...');
  const sagaTranslated = await translateMonsterNames(sagaMonsters);

  // 4. Deduplicar por nombre
  const seen = new Set();
  const allMonsters = [];

  for (const monster of [...worldMonsters, ...wildsMonsters, ...sagaTranslated]) {
    const key = monster.name?.toLowerCase().trim();
    if (!key) continue;
    if (seen.has(key)) {
      console.log(`Duplicado saltado: ${monster.name}`);
      continue;
    }
    seen.add(key);
    allMonsters.push(monster);
  }

  // 5. Guardar resultado final
  const outputPath = path.join(dataDir, 'monsters_all.json');
  fs.writeFileSync(outputPath, JSON.stringify(allMonsters, null, 2));

  console.log(`\nResumen final:`);
  console.log(`  World:        ${worldMonsters.length} monstruos`);
  console.log(`  Wilds:        ${wildsMonsters.length} monstruos`);
  console.log(`  Saga (orig):  ${sagaMonsters.length} monstruos`);
  console.log(`  Total únicos: ${allMonsters.length}`);
  console.log(`  Guardado en:  ${outputPath}`);
}

fetchAllMonsters();
// ```

// ---

// ## Cómo funciona el paso de traducción
// ```
// nombre JP → ¿está en KNOWN_NAMES?
//                ↓ Sí → nombre EN local (instantáneo, 100% fiable)
//                ↓ No → llama a MyMemory API
//                           ↓ éxito → guarda en translation_cache.json
//                           ↓ fallo → deja el nombre original
// ```

// La caché en disco es importante: si ejecutas el script varias veces, los nombres ya traducidos por la API no vuelven a consultarse, así que no malgastas el límite gratuito de MyMemory (~5.000 palabras/día).

// Tu carpeta `data/` quedará así al terminar:
// ```
// data/
// ├── monsters_all.json          ← resultado final
// └── translation_cache.json     ← caché de traducciones de la API