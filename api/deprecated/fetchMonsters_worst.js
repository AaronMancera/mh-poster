const axios = require("axios");
const fs = require("fs");

const BASE_URL = "https://mhw-db.com";

async function fetchMonsters() {
  try {
    console.log("Obteniendo monstruos...");
    const { data: monsters } = await axios.get(`${BASE_URL}/monsters`);
    console.log(`Total de monstruos: ${monsters.length}`);
    // Guardar el JSON completo
    fs.writeFileSync("monsters.json", JSON.stringify(monsters, null, 2));
    console.log("Archivo monsters.json guardado correctamente.");
  } catch (error) {
    console.error("Error al conectar con la API:", error.message);
  }
}

fetchMonsters();
