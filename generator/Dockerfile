FROM python:3.8-slim

WORKDIR /app

# Dependencias del sistema necesarias para Pillow
RUN apt-get update && apt-get install -y \
    libjpeg-dev \
    zlib1g-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

# Dependencias Python primero para caché
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Código y assets
COPY src/    ./src/
COPY assets/ ./assets/

# Carpeta de salida
RUN mkdir -p output

ENV API_URL=http://api:3000

CMD ["python", "src/poster.py", "--help"]
```

**`generator/.dockerignore`:**
```
output
.env
__pycache__
*.pyc