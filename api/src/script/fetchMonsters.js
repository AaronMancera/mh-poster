const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SOURCES = {
  world:   'https://mhw-db.com/monsters',
  wilds:   'https://wilds.mhdb.io/en/monsters',
  crimson: 'https://raw.githubusercontent.com/CrimsonNynja/monster-hunter-DB/master/monsters.json',

};

// // ── Mapa local JP → EN ────────────────────────────────────
// const KNOWN_NAMES = {
//   'リオレウス': 'Rathalos',
//   'リオレイア': 'Rathian',
//   'ナルガクルガ': 'Nargacuga',
//   'ティガレックス': 'Tigrex',
//   'ジンオウガ': 'Zinogre',
//   'ラージャン': 'Rajang',
//   'クシャルダオラ': 'Kushala Daora',
//   'テオ・テスカトル': 'Teostra',
//   'バゼルギウス': 'Bazelgeuse',
//   'イビルジョー': 'Deviljho',
//   'ブラキディオス': 'Brachydios',
//   'アグナコトル': 'Agnaktor',
//   'ウラガンキン': 'Uragaan',
//   'ドボルベルク': 'Duramboros',
//   'アマツマガツチ': 'Amatsu',
//   'シャガルマガラ': 'Shagaru Magala',
//   'ゴア・マガラ': 'Gore Magala',
//   'セルレギオス': 'Seregios',
//   'ガムート': 'Gammoth',
//   'タマミツネ': 'Mizutsune',
//   'ライゼクス': 'Astalos',
//   'ディノバルド': 'Glavenus',
//   'カガチ': 'Tobi-Kadachi',
//   'オドガロン': 'Odogaron',
//   'パオウルムー': 'Paolumu',
//   'プケプケ': 'Pukei-Pukei',
//   'バフバロ': 'Banbaro',
//   'ベリオロス': 'Barioth',
//   'ブラントドス': 'Beotodus',
//   'ラギアクルス': 'Lagiacrus',
//   'イソネミクニ': 'Somnacanth',
//   'アケノシルム': 'Aknosom',
//   'ビシュテンゴ': 'Bishaten',
//   'ゴシャハギ': 'Goss Harag',
//   'ナルハタタヒメ': 'Narwa the Allmother',
//   'イブシマキヒコ': 'Ibushi',
//   'マガイマガド': 'Malzeno',
//   'バルファルク': 'Balfark',
//   'ガランゴルム': 'Garangolm',
// };

// // ── Caché de traducciones en disco ────────────────────────
// const CACHE_PATH = path.join(__dirname, 'data', 'translation_cache.json');

// function loadCache() {
//   try {
//     if (fs.existsSync(CACHE_PATH)) {
//       return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
//     }
//   } catch { /* caché corrupta, empezamos de cero */ }
//   return {};
// }

// function saveCache(cache) {
//   try {
//     fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
//   } catch (err) {
//     console.warn('⚠ No se pudo guardar la caché de traducciones:', err.message);
//   }
// }

// function isJapanese(text) {
//   return /[\u3000-\u9fff]/.test(text);
// }

// async function translateWithApi(text, cache) {
//   if (cache[text]) return cache[text];
//   try {
//     const { data } = await axios.get('https://api.mymemory.translated.net/get', {
//       params: { q: text, langpair: 'ja|en' },
//       timeout: 5000,
//     });
//     const translated = data?.responseData?.translatedText;
//     if (translated && translated !== text) {
//       cache[text] = translated;
//       return translated;
//     }
//   } catch { /* si falla la traducción, devolvemos el original */ }
//   return text;
// }

// async function translateMonsterNames(monsters) {
//   const cache = loadCache();
//   const results = [];

//   for (const monster of monsters) {
//     if (!isJapanese(monster.name)) {
//       results.push(monster);
//       continue;
//     }

//     // Capa 1: mapa local
//     if (KNOWN_NAMES[monster.name]) {
//       console.log(`  [local] ${monster.name} → ${KNOWN_NAMES[monster.name]}`);
//       results.push({ ...monster, name: KNOWN_NAMES[monster.name], original_name_jp: monster.name });
//       continue;
//     }

//     // Capa 2: MyMemory API
//     console.log(`  [api]   Traduciendo: ${monster.name}...`);
//     const translated = await translateWithApi(monster.name, cache);
//     console.log(`          → ${translated}`);
//     results.push({ ...monster, name: translated, original_name_jp: monster.name });
//     await new Promise(r => setTimeout(r, 300));
//   }

//   saveCache(cache);
//   return results;
// }

// ── Normalización ─────────────────────────────────────────
function normalizeWorld(m) {
  return {
    name:       m.name,
    species:    m.species,
    type:       m.type,
    elements:   m.elements || [],
    ailments:   (m.ailments || []).map(a => a.name),
    weaknesses: (m.weaknesses || []).map(w => w.element).filter(Boolean),
    games:      ['World'],
    source:     'mhw-db.com',
  };
}

function normalizeWilds(m) {
  return {
    name:       m.name,
    species:    m.species || 'unknown',
    type:       m.kind || 'unknown',
    elements:   m.elements || [],
    ailments:   m.ailments || [],
    weaknesses: (m.weaknesses || []).map(w => w.element).filter(Boolean),
    games:      ['Wilds'],
    source:     'wilds.mhdb.io',
  };
}

function normalizeCrimson(m) {
  return {
    name:       m.name || m.another_name,
    species:    m.category || 'unknown', //en CrimsonNynja "type" es la especie
    type:       m.isLarge ? 'large' : 'small',
    elements:   m.elements || [],
    ailments:   m.ailments || [],
    weaknesses: m.weakness || [],      // CrimsonNynja usa "weakness" sin 's'
    games:      (m.games || []).map(g => g.game),
    source:     'github.com/CrimsonNynja/monster-hunter-DB',
  };
}

// ── Fetch con retries — nunca lanza excepción ─────────────
async function safeFetch(url, label, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Obteniendo ${label} (intento ${i + 1}/${retries})...`);
      const { data } = await axios.get(url, { timeout: 15000 });
      const monsters = Array.isArray(data) ? data : (data.monsters || []);
      console.log(`  ✓ ${label}: ${monsters.length} monstruos recibidos`);
      return monsters;
    } catch (err) {
      console.warn(`  ⚠ Intento ${i + 1} fallido [${label}]: ${err.message}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
    }
  }
  // Devuelve array vacío — no interrumpe el flujo
  console.warn(`  ✗ ${label} no disponible. Se omite esta fuente.`);
  return [];
}

// ── Main ──────────────────────────────────────────────────
async function fetchAllMonsters() {
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  // PASO 1 — Fetch
  console.log('\n[PASO 1] Obteniendo datos de las APIs...');
  const [rawWorld, rawWilds, rawCrimson] = await Promise.all([
    safeFetch(SOURCES.world, 'Monster Hunter World'),
    safeFetch(SOURCES.wilds, 'Monster Hunter Wilds'),
    safeFetch(SOURCES.crimson, 'Saga completa (CrimsonNynja/GitHub)'),
  ]);

  // PASO 2 — Inspección raw antes de filtrar
  console.log('\n[PASO 2] Datos raw recibidos:');
  console.log(`  World raw:  ${rawWorld.length} monstruos`);
  console.log(`  Wilds raw:  ${rawWilds.length} monstruos`);
  console.log(`  Crimson raw: ${rawCrimson.length} monstruos`);

//   Ver qué valores tiene el campo 'type' en Wilds
//   if (rawWilds.length > 0) {
//     const wildsTypes = [...new Set(rawWilds.map(m => m.type))];
//     console.log(`  Wilds - valores distintos en campo 'type': ${JSON.stringify(wildsTypes)}`);
//     console.log('  Wilds - ejemplo primer monstruo:', JSON.stringify(rawWilds[0], null, 2));
//   }

//   Ver qué valores tiene 'type' en World para comparar
//   if (rawWorld.length > 0) {
//     const worldTypes = [...new Set(rawWorld.map(m => m.type))];
//     console.log(`  World - valores distintos en campo 'type': ${JSON.stringify(worldTypes)}`);
//   }

  // PASO 3 — Filtrar y normalizar
  console.log('\n[PASO 3] Filtrando monstruos grandes...');
  const worldMonsters = rawWorld.filter(m => m.type === 'large').map(normalizeWorld);
  console.log(`  World tras filtro 'large': ${worldMonsters.length}`);

  // Wilds: filtramos solo si el campo type existe y coincide, si no los incluimos todos
  const wildsMonsters = rawWilds
    .filter(m => m.kind === 'large')
    .map(normalizeWilds);
  console.log(`  Wilds   → ${wildsMonsters.length} monstruos grandes`);

  const crimsonMonsters = rawCrimson
    .filter(m => m.isLarge === true)
    .map(normalizeCrimson);
  console.log(`  Crimson → ${crimsonMonsters.length} monstruos grandes`);

  // // PASO 4 — Traducción
  // let sagaTranslated = sagaMonsters;
  // if (sagaMonsters.length > 0) {
  //   console.log('\n[PASO 4] Traduciendo nombres japoneses...');
  //   sagaTranslated = await translateMonsterNames(sagaMonsters);
  // } else {
  //   console.log('\n[PASO 4] Sin datos de saga, se omite la traducción.');
  // }

  // PASO 5 — Deduplicar
  console.log('\n[PASO 5] Deduplicando...');
  const seen = new Set();
  const allMonsters = [];

  for (const monster of [...worldMonsters, ...wildsMonsters, ...crimsonMonsters]) {
    const key = monster.name?.toLowerCase().trim();
    if (!key) continue;

    if (seen.has(key)) {
      // Si el duplicado de CrimsonNynja tiene más juegos, los fusionamos
      if (monster.source === 'crimsonnynja') {
        const existing = allMonsters.find(m => m.name?.toLowerCase() === key);
        if (existing) {
          existing.games = [...new Set([...existing.games, ...monster.games])];
          console.log(`  [fusionado] ${monster.name} → games actualizados`);
        }
      } else {
        console.log(`  [duplicado saltado] ${monster.name} (${monster.source})`);
      }
      continue;
    }
    seen.add(key);
    allMonsters.push(monster);
  }

  // PASO 6 — Guardar
  console.log('\n[PASO 6] Guardando resultado...');
  const outputPath = path.join(dataDir, 'monsters_all.json');
  fs.writeFileSync(outputPath, JSON.stringify(allMonsters, null, 2));

  console.log('\n─────────────────────────────');
  console.log('Resumen final:');
  console.log(`  World:        ${worldMonsters.length} monstruos`);
  console.log(`  Wilds:        ${wildsMonsters.length} monstruos`);
  console.log(`  Crimson saga: ${crimsonMonsters.length} monstruos`);
  console.log(`  Total únicos: ${allMonsters.length}`);
  console.log(`  Guardado en:  ${outputPath}`);
  console.log('─────────────────────────────');
}

fetchAllMonsters();