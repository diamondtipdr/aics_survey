# AICS Lead Magnet Engine 🧲

Microservicio Node.js + Express + TypeScript que procesa respuestas de formularios de autoevaluación, genera reportes PDF con análisis de IA (OpenAI) y los envía por email (Mailgun).

Incluye un **frontend SPA** (React + Vite) que se sirve desde el mismo servidor Express.

## Arquitectura

```
Frontend SPA (React + Vite)
        │
        │ POST /api/v1/scorecard/process
        ▼
Express App (src/app.ts)
        │
    ┌───┴───┐
    │       │
(Sin email) (Con email)
Preview    Full Lead Capture
    │       │
    ▼       ├─ 1. Generar PDF (Puppeteer + Chromium)
    JSON    ├─ 2. MySQL INSERT
            ├─ 3. Google Sheets append
            ├─ 4. Mailgun Email (PDF adjunto)
            └─ 5. HTTP 200 JSON
```

## Flujo de trabajo

1. El frontend muestra 16 preguntas (valor 1–4) organizadas en 4 pilares
2. Datos demográficos: industria, tamaño del depto., país, nombre
3. Sin email → cálculo local y preview de puntuaciones
4. Con email → `POST /api/v1/scorecard/process` con:
   - `answers` (required) — 16 objetos `{ questionId, value }`
   - `dept_size` (optional)
   - `industry` (optional)
   - `country` (optional)
   - `name` (optional — fallback a "Auditor")
   - `email` (optional — determina el modo)

## Requisitos

- **Node.js 18+**
- **Docker + Docker Compose** (para producción y MySQL)
- **OpenAI API key** (o endpoint compatible)
- **Mailgun** cuenta con API key + dominio
- **MySQL 8.0+**
- **Google Cloud Service Account** (para Sheets, opcional)
- **Chromium** (incluido en la imagen Docker)

## Quick Start (Docker Compose)

```bash
# 1. Clonar y entrar
cd aics-lead-magnet-engine

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus API keys

# 3. Iniciar todos los servicios
docker compose up -d

# 4. Verificar health
curl http://localhost:3000/health

# 5. Probar endpoint (Preview Mode — sin email)
curl -X POST http://localhost:3000/api/v1/scorecard/process \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {"questionId":1,"value":3},{"questionId":2,"value":4},
      {"questionId":3,"value":2},{"questionId":4,"value":3},
      {"questionId":5,"value":2},{"questionId":6,"value":1},
      {"questionId":7,"value":3},{"questionId":8,"value":2},
      {"questionId":9,"value":4},{"questionId":10,"value":3},
      {"questionId":11,"value":2},{"questionId":12,"value":1},
      {"questionId":13,"value":4},{"questionId":14,"value":3},
      {"questionId":15,"value":2},{"questionId":16,"value":4}
    ],
    "dept_size": "11-50",
    "industry": "Tecnología",
    "name": "Carlos Pérez"
  }'

# 6. Probar Full Lead Capture (con email)
curl -X POST http://localhost:3000/api/v1/scorecard/process \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [ ... 16 respuestas ... ],
    "dept_size": "11-50",
    "industry": "Tecnología",
    "name": "Carlos Pérez",
    "email": "carlos@example.com"
  }'
```

## Desarrollo local (sin Docker)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar .env (DB_HOST apunta a localhost)
cp .env.example .env
# Editar variables

# 3. Iniciar MySQL (usando Docker solo para la DB)
docker run -d --name aics-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=aics_leads \
  -p 3306:3306 \
  mysql:8.0

# 4. Inicializar schema
docker exec -i aics-mysql mysql -uroot -prootpass aics_leads < sql/init.sql

# 5. Iniciar servidor en modo dev (backend + frontend con hot reload)
npm run dev
```

> **Nota**: En desarrollo local necesitas Chromium instalado para la generación de PDF.
> Instálalo con: `npx puppeteer browsers install chrome`

## Variables de entorno (`.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API key del proveedor AI | *(requerido)* |
| `OPENAI_API_BASE` | Endpoint OpenAI-compatible | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Modelo a usar | `gpt-4o-mini` |
| `DB_HOST` | Host MySQL | `localhost` |
| `DB_PORT` | Puerto MySQL | `3306` |
| `DB_USER` | Usuario MySQL | `root` |
| `DB_PASSWORD` | Password MySQL | *(requerido)* |
| `DB_NAME` | Base de datos | `aics_leads` |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Ruta al JSON del Service Account | `./secrets/google-service-account.json` |
| `GOOGLE_SHEET_ID` | ID del Google Sheet | *(opcional)* |
| `MAILGUN_API_KEY` | API key de Mailgun | *(requerido para full mode)* |
| `MAILGUN_DOMAIN` | Dominio configurado en Mailgun | *(requerido para full mode)* |
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno | `development` |
| `LOG_LEVEL` | Nivel de log (`debug`, `info`, `warn`, `error`) | `info` |
| `LOG_TO_FILE` | Persistir logs a archivo | `true` |
| `LOG_FILE_PATH` | Ruta del archivo de log | `/app/logs/app.log` |
| `AUDIT_ENABLED` | Auditoría de cada request | `true` |
| `PUPPETEER_EXECUTABLE_PATH` | Ruta al binario de Chromium | *(auto-detect)* |

> **Nota**: `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` puede apuntar a un archivo JSON local
> o contener el contenido del JSON directamente si se usa la variable
> `GOOGLE_SERVICE_ACCOUNT_KEY` (legacy).

## Pruebas

```bash
# Ejecutar tests unitarios e integración
npm test

# Modo watch
npm run test:watch

# Con cobertura
npm run test:coverage
```

## Configuración: Google Sheets

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear proyecto o seleccionar existente
3. Habilitar **Google Sheets API**
4. Crear **Service Account** → descargar JSON key
5. Guardar el archivo JSON descargado como `./secrets/google-service-account.json`
6. Establecer `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` en `.env` (por defecto apunta a esa ruta)
7. Crear un Google Sheet y compartirlo con el email del Service Account (rol **Editor**)
8. Copiar el ID de la hoja (de la URL) a `GOOGLE_SHEET_ID`

**Estructura esperada de columnas (12 columnas):**
| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| nombre | email | total_score | p1 | p2 | p3 | p4 | fecha | industria | dept_size | país | ai_reporte |

## Integración con MySQL / Moodle

La tabla `aics_leads` almacena todos los leads capturados. Cada registro incluye:

- Datos personales: `name`, `email`, `country`
- Puntuaciones: `total_score`, `pillar_1_score` a `pillar_4_score`
- Respuestas originales en JSON (`answers`)
- Diagnóstico completo de IA (`ai_report`)
- Metadatos: `industry`, `dept_size`, `created_at`, `processed`

### Opción A: Acceso directo a MySQL (recomendado para Moodle auto-hosted)

Si Moodle tiene acceso al mismo servidor MySQL, consulta la tabla directamente:

```sql
-- Obtener leads pendientes de procesar
SELECT * FROM aics_leads WHERE processed = FALSE ORDER BY created_at ASC LIMIT 50;

-- Marcar como procesado después de consumirlo
UPDATE aics_leads SET processed = TRUE WHERE id = ?;
```

**Configuración de conexión en Moodle:**
- Tipo: MySQL / MariaDB
- Host: (el mismo servidor MySQL)
- Base de datos: `aics_leads`
- Usuario y contraseña: los configurados en `.env`

### Opción B: API REST (recomendado si Moodle no tiene acceso directo a la DB)

La aplicación expone endpoints REST para que Moodle consuma los leads de forma segura, sin necesidad de acceso directo a MySQL.

#### `GET /api/v1/moodle/pending`

Lista leads pendientes de procesar (no marcados como `processed`).

```bash
curl http://localhost:3000/api/v1/moodle/pending?limit=50&offset=0
```

**Query params:** `?limit=50&offset=0`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Carlos Pérez",
      "email": "carlos@example.com",
      "totalScore": 43,
      "pillar1Score": 12,
      "pillar2Score": 8,
      "pillar3Score": 10,
      "pillar4Score": 13,
      "industry": "Tecnología",
      "deptSize": "11-50",
      "country": "República Dominicana",
      "aiReport": "### Integración (12/16)...",
      "createdAt": "2026-07-28T12:00:00.000Z",
      "processed": false
    }
  ],
  "pagination": { "total": 1, "limit": 50, "offset": 0 }
}
```

#### `GET /api/v1/moodle/leads`

Lista todos los leads con filtros opcionales.

```bash
curl 'http://localhost:3000/api/v1/moodle/leads?processed=false&minScore=32&industry=Tecnología'
```

| Query param | Tipo | Descripción |
|-------------|------|-------------|
| `processed` | `boolean` | Filtrar por estado de procesado |
| `minScore` | `number` | Puntuación mínima (16–64) |
| `maxScore` | `number` | Puntuación máxima (16–64) |
| `industry` | `string` | Filtrar por industria |
| `limit` | `number` | Resultados por página (default: 50) |
| `offset` | `number` | Paginación (default: 0) |

#### `GET /api/v1/moodle/leads/:id`

Obtiene un lead específico con su reporte de IA completo.

```bash
curl http://localhost:3000/api/v1/moodle/leads/1
```

#### `POST /api/v1/moodle/leads/:id/process`

Marca un lead como procesado. Una vez marcado, ya no aparece en el endpoint pendiente.

```bash
curl -X POST http://localhost:3000/api/v1/moodle/leads/1/process

# Response:
{
  "success": true,
  "message": "Lead 1 marcado como procesado"
}
```

#### `GET /api/v1/moodle/stats`

Estadísticas agregadas útiles para un dashboard de Moodle.

```bash
curl http://localhost:3000/api/v1/moodle/stats
```

```json
{
  "success": true,
  "data": {
    "totalLeads": 150,
    "pendingLeads": 23,
    "processedLeads": 127,
    "averageScore": 38.5,
    "scoreDistribution": {
      "basic": 20,
      "intermediate": 85,
      "advanced": 45
    },
    "industryBreakdown": {
      "Tecnología": 60,
      "Financiero / Banca": 40,
      "Retail / Consumo": 30
    }
  }
}
```

> **Score ranges**: Básico (16–31), Intermedio (32–47), Avanzado (48–64)
> — Utiliza estos rangos para segmentar alumnos en diferentes cursos dentro de Moodle.

## Auditoría y Logs

Los logs se pueden configurar mediante variables de entorno:

| Variable | Valores | Descripción |
|----------|---------|-------------|
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` | Nivel de detalle |
| `LOG_TO_FILE` | `true`, `false` | Persistir logs a archivo |
| `AUDIT_ENABLED` | `true`, `false` | Logging de cada request |

Cada request genera un **Request ID** (UUID v4) que permite trazar el flujo completo en los logs.

## Estructura del proyecto

```
aics-lead-magnet-engine/
├── src/
│   ├── server.ts                         # Entry point (Express listen)
│   ├── app.ts                            # Express app setup + middleware
│   ├── main.tsx                          # React SPA entry point
│   ├── routes/
│   │   ├── scorecard.ts                  # POST /api/v1/scorecard/process
│   │   └── moodle.ts                     # Moodle REST endpoints
│   ├── services/
│   │   ├── ai.service.ts                 # OpenAI-compatible API
│   │   ├── pdf.service.ts                # Puppeteer + Chromium PDF
│   │   ├── db.service.ts                 # MySQL + Google Sheets
│   │   └── email.service.ts              # Mailgun REST API
│   ├── utils/
│   │   ├── config.ts                     # Env var loader (dotenv)
│   │   ├── logger.ts                     # Winston structured logger
│   │   └── validation.ts                 # Zod schemas + score calc
│   ├── types/
│   │   └── index.ts                      # All TypeScript interfaces
│   ├── components/
│   │   ├── aics_lead_magnet.tsx           # React scorecard component
│   │   └── aics_lead_magnet.css          # Component styles
│   └── templates/
│       ├── report.html                   # PDF HTML template
│       └── assets/
│           └── logo.png                  # Logo para PDFs
├── tests/
│   ├── setup.ts                          # Test env bootstrap
│   ├── teardown.ts                       # Test cleanup
│   ├── fixtures/                         # Payloads + mocks
│   ├── integration/                      # SuperTest integration tests
│   └── unit/                             # Service unit tests
├── sql/
│   └── init.sql                          # MySQL schema (aics_leads)
├── docker/
│   └── Dockerfile                        # Multi-stage (build → production)
├── docker-compose.yml                    # App + MySQL servicios
├── vite.config.ts                        # Vite SPA bundler config
├── index.html                            # SPA HTML shell
├── .env.example
├── tsconfig.json
├── tsconfig.build.json
├── jest.config.ts
└── package.json
```

## API Reference

### `POST /api/v1/scorecard/process`

**Request body:**
```json
{
  "answers": [
    { "questionId": 1, "value": 3 },
    { "questionId": 2, "value": 4 }
  ],
  "dept_size": "11-50",
  "industry": "Tecnología",
  "country": "República Dominicana",
  "name": "Carlos Pérez",
  "email": "carlos@example.com"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `answers` | `array` | ✅ | 16 objetos `{ questionId: 1–16, value: 1–4 }` |
| `dept_size` | `string` | ❌ | Tamaño del departamento |
| `industry` | `string` | ❌ | Sector industrial |
| `country` | `string` | ❌ | País del usuario |
| `name` | `string` | ❌ | Nombre (fallback: `"Auditor"`) |
| `email` | `string` | ❌ | Si se provee → modo Full Lead Capture |

**Response (Preview Mode — sin email):**
```json
{
  "mode": "preview",
  "totalScore": 43,
  "maxScore": 64,
  "pillars": [
    { "pillarId": 1, "label": "Integración", "score": 12, "maxScore": 16 },
    { "pillarId": 2, "label": "Automatización", "score": 8, "maxScore": 16 },
    { "pillarId": 3, "label": "Agilidad", "score": 10, "maxScore": 16 },
    { "pillarId": 4, "label": "Impacto & Comunicación", "score": 13, "maxScore": 16 }
  ],
  "teaser": "Ingresa tu correo para recibir de inmediato el reporte confidencial en PDF con el análisis de Inteligencia Artificial y tu plan de acción."
}
```

**Response (Full Lead Capture — con email):**
```json
{
  "mode": "full",
  "success": true,
  "message": "Reporte enviado al correo"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error interno del servidor",
  "code": "ERR_500",
  "requestId": "uuid-v4"
}
```

### `GET /health`
```json
{
  "status": "ok",
  "timestamp": "2026-07-28T12:00:00.000Z",
  "uptime": 123.45
}
```

## Producción — Despliegue en Servidor

### Opción 1: Docker Compose (recomendada)

```bash
# 1. Clonar en el servidor
git clone <repo-url> /opt/aics-lead-magnet
cd /opt/aics-lead-magnet

# 2. Configurar entorno
cp .env.example .env
# Editar TODAS las variables requeridas (ver tabla arriba)

# 3. Copiar credenciales de Google (si aplica)
cp /ruta/a/tu/google-service-account.json ./secrets/google-service-account.json

# 4. Iniciar servicios
docker compose up -d

# 5. Verificar estado
docker compose ps
curl http://localhost:3000/health

# 6. Ver logs
docker compose logs -f app
```

### Opción 2: Despliegue manual (sin Docker)

```bash
# 1. Instalar dependencias del sistema (Ubuntu/Debian)
sudo apt update
sudo apt install -y nodejs npm mysql-server chromium-browser nginx

# 2. Clonar e instalar
git clone <repo-url> /opt/aics-lead-magnet
cd /opt/aics-lead-magnet
npm ci

# 3. Configurar MySQL
sudo mysql -e "CREATE DATABASE IF NOT EXISTS aics_leads;"
sudo mysql aics_leads < sql/init.sql

# 4. Configurar variables
cp .env.example .env
# Editar DB_HOST=localhost y demás variables

# 5. Construir
npm run build

# 6. Ejecutar con PM2 (gestor de procesos)
npm install -g pm2
pm2 start dist/server.js --name aics-lead-magnet
pm2 save
pm2 startup  # Configura inicio automático al bootear
```

### Configuración de Nginx (proxy inverso)

```nginx
server {
    listen 80;
    server_name auditancia.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Para TLS (recomendado):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d auditancia.com
```

### Seguridad en Producción

| Medida | Descripción |
|--------|-------------|
| **TLS/HTTPS** | Usar Certbot/Let's Encrypt para certificados |
| **Firewall** | Solo exponer puertos 80/443. MySQL (3306) interno |
| **Rate limiting** | Configurar en Nginx o agregar `express-rate-limit` |
| **Secrets** | No subir `.env` ni `secrets/` al repositorio |
| **Actualizaciones** | `docker compose pull && docker compose up -d` |
| **Monitoreo** | Revisar logs: `docker compose logs -f app` |
| **Backups** | Respaldar MySQL: `mysqldump -u root -p aics_leads > backup.sql` |

### Health Checks y Monitoreo

El contenedor incluye un health check integrado (Dockerfile) que verifica
`GET /health` cada 30s. Docker reinicia automáticamente si falla 3 veces.

```bash
# Ver health check del contenedor
docker inspect --format='{{json .State.Health}}' aics-lead-magnet

# Logs en tiempo real
docker compose logs -f --tail=100 app
```

### Escalamiento y Performance

- La app es stateless (toda la persistencia va a MySQL)
- Se puede escalar horizontalmente detrás de Nginx
- MySQL es el cuello de botella — considerar réplicas si hay alta carga
- Puppeteer/Chromium consume ~200 MB de RAM por instancia — planificar recursos

### Rolling Update

```bash
# Con Docker Compose
docker compose pull app
docker compose up -d --no-deps app

# Con PM2
git pull origin main
npm ci
npm run build
pm2 reload aics-lead-magnet
```

## Licencia

MIT — AICS Capacitación