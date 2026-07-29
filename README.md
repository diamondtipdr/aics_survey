# AICS Lead Magnet Engine 🧲

Microservicio Node.js + Express + TypeScript que procesa respuestas de formularios de autoevaluación, genera reportes PDF con análisis de IA (OpenAI) y los envía por email (Mailgun).

## Arquitectura

```
Frontend → POST /api/v1/scorecard/process → Express App
                                              │
                    ┌─────────────────────────┤
                    │                         │
               (Sin email)              (Con email)
              Preview Mode            Full Lead Capture
                    │                         │
                    ▼                         ▼
            JSON { scores,            1. Generar PDF
              ai_text }               2. MySQL INSERT
                                      3. Google Sheets
                                      4. Mailgun Email
                                      5. HTTP 200 JSON
```

## Flujo de trabajo

1. El frontend muestra 16 preguntas (scored 1–4)
2. Al final, solicita nombre y email opcionalmente
3. `POST /api/v1/scorecard/process` con:
   - `answers` (required) — 16 objetos `{ questionId, value }`
   - `dept_size` (optional)
   - `industry` (optional)
   - `name` (optional — fallback a "Auditor")
   - `email` (optional — determina el modo)

## Requisitos

- Node.js 18+
- Docker + Docker Compose
- Cuenta de Mailgun (API key + dominio)
- Cuenta de OpenAI (o endpoint compatible)
- MySQL 8.0+
- Google Cloud Service Account (para Sheets)

## Quick Start (Docker Compose)

```bash
# 1. Clonar y entrar
cd aics-lead-magnet-engine

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus API keys

# 3. Iniciar servicios
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

# 2. Configurar .env (apuntar DB_HOST a localhost)
cp .env.example .env
# Editar variables

# 3. Iniciar MySQL local (o usar docker solo para MySQL)
docker run -d --name aics-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=aics_leads \
  -p 3306:3306 \
  mysql:8.0

# 4. Inicializar schema
docker exec -i aics-mysql mysql -uroot -prootpass aics_leads < sql/init.sql

# 5. Iniciar servidor en modo dev
npm run dev
```

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
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Ruta al archivo JSON del Service Account | `./secrets/google-service-account.json` |
| `GOOGLE_SHEET_ID` | ID del Google Sheet | *(opcional)* |
| `MAILGUN_API_KEY` | API key de Mailgun | *(requerido para full mode)* |
| `MAILGUN_DOMAIN` | Dominio configurado en Mailgun | *(requerido para full mode)* |
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno | `development` |
| `LOG_LEVEL` | Nivel de log | `info` |
| `LOG_TO_FILE` | Guardar logs a archivo | `true` |
| `LOG_FILE_PATH` | Ruta del archivo de log | `/app/logs/app.log` |
| `AUDIT_ENABLED` | Auditoría habilitada | `true` |

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

**Estructura esperada de columnas:**
| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| nombre | email | total_score | p1 | p2 | p3 | p4 | fecha | industria | dept_size |

## Configuración: Moodle LMS

La tabla `aics_leads` sirve como puente entre el microservicio y Moodle.

**Consulta típica desde Moodle:**
```sql
SELECT * FROM aics_leads WHERE processed = FALSE ORDER BY created_at ASC LIMIT 50;
```

**Webhook opcional** (para marcar leads como procesados):
```bash
POST /api/v1/moodle/processed/{id}
```

**Configuración de conexión en Moodle:**
- Tipo: MySQL / MariaDB
- Host: (el mismo servidor MySQL)
- Base de datos: `aics_leads`
- Usuario y contraseña: los configurados en `.env`

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
│   ├── server.ts                # Entry point
│   ├── app.ts                   # Express app
│   ├── routes/scorecard.ts      # POST /api/v1/scorecard/process
│   ├── services/
│   │   ├── ai.service.ts        # OpenAI integration
│   │   ├── pdf.service.ts       # Puppeteer PDF generation
│   │   ├── db.service.ts        # MySQL + Google Sheets
│   │   └── email.service.ts     # Mailgun API
│   ├── utils/
│   │   ├── config.ts            # Env var loader
│   │   ├── logger.ts            # Winston logger
│   │   └── validation.ts        # Zod schemas + score calc
│   ├── templates/report.html    # PDF HTML template
│   └── types/index.ts           # TypeScript interfaces
├── tests/
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── fixtures/                # Test payloads
├── docker/
│   └── Dockerfile               # Multi-stage build
├── docker-compose.yml
├── sql/init.sql                 # MySQL schema
├── .env.example
└── package.json
```

## API Reference

### `POST /api/v1/scorecard/process`

**Request body:**
```json
{
  "answers": [
    { "questionId": 1, "value": 3 },
    { "questionId": 2, "value": 4 },
    ...
  ],
  "dept_size": "11-50",
  "industry": "Tecnología",
  "name": "Carlos Pérez",
  "email": "carlos@example.com"
}
```

**Response (Preview Mode — sin email):**
```json
{
  "mode": "preview",
  "totalScore": 43,
  "maxScore": 64,
  "pillars": [
    { "pillarId": 1, "label": "Gobernanza y Liderazgo", "score": 12, "maxScore": 16 }
  ],
  "aiReport": "El diagnóstico general..."
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

### `GET /health`
```json
{
  "status": "ok",
  "timestamp": "2026-07-28T12:00:00.000Z",
  "uptime": 123.45
}
```

## Licencia

MIT — AICS Capacitación