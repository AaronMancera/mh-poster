#!/bin/bash
set -e

echo "==> Instalando dependencias Node..."
cd api && npm install && cd ..

echo "==> Instalando dependencias Python..."
pip install -r generator/requirements.txt

echo "==> Descargando iconos de monstruos..."
node api/src/scripts/downloadImages.js

echo "==> Build completado"