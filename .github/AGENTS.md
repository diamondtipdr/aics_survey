# AICS Lead Magnet Engine — Agent Guidelines

## Project Overview

A microservice (Node.js + Express + TypeScript) that processes assessment form responses, generates AI-powered PDF reports using OpenAI, and dispatches them via Mailgun. Supports two modes:

- **Preview Mode**: No email provided → returns JSON scores only
- **Full Lead Capture**: Email provided → generates PDF, stores in MySQL/Google Sheets, sends email

## Architecture

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

## Key Files & Directories

| Location | Purpose |
|----------|---------|
| `src/app.ts` | Express app setup, middleware, error handling |
| `src/server.ts` | Server entry point, graceful shutdown |
| `src/routes/scorecard.ts` | Main API endpoint (`/api/v1/scorecard/process`) |
| `src/services/` | Business logic: `ai.service.ts`, `pdf.service.ts`, `db.service.ts`, `email.service.ts` |
| `src/utils/validation.ts` | Zod schemas, score calculation |
| `src/utils/config.ts` | Environment variable configuration |
| `src/utils/logger.ts` | Winston logging with structured JSON |
| `src/types/index.ts` | TypeScript interfaces |
| `src/components/aics_lead_magnet.tsx` | React frontend scorecard |
| `tests/` | Unit and integration tests |
| `sql/init.sql` | MySQL schema |

## Development Commands

```bash
# Build
npm run build

# Development (with hot reload)
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Lint
npm run lint
```

## Testing Conventions

- **Unit tests**: `tests/unit/` - mock external services
- **Integration tests**: `tests/integration/` - test full request/response flow
- **Test setup**: `tests/setup.ts` - sets test environment variables
- **Test fixtures**: `tests/fixtures/` - sample payloads and mock data

All external services (AI, PDF, DB, Email) are mocked in tests using `jest.mock()`.

## Code Conventions

- **Language**: TypeScript with strict mode enabled
- **Validation**: Zod schemas for request validation
- **Logging**: Winston with structured JSON format; use `withContext()` for request-scoped logs
- **Error handling**: Centralized in `app.ts`; return JSON errors with `code` field
- **Response format**: Always include `success` boolean; use `requestId` for debugging

## Environment Variables

Required for production:
- `OPENAI_API_KEY`, `OPENAI_API_BASE`, `OPENAI_MODEL`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`, `GOOGLE_SHEET_ID`
- `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`

See [.env.example](.env.example) for full list.

## Docker

```bash
docker compose up -d    # Start services
docker compose down     # Stop services
```

Services: `mysql` (port 3307), `app` (port 3005)

## Common Patterns

### Scorecard Request Payload
```json
{
  "answers": [{ "questionId": 1, "value": 3 }, ...], // 16 answers required
  "dept_size": "11-50",
  "industry": "Tecnología",
  "name": "Carlos Pérez",
  "email": "carlos@example.com"  // optional
}
```

### Response (Preview Mode)
```json
{
  "mode": "preview",
  "totalScore": 43,
  "maxScore": 64,
  "pillars": [...],
  "teaser": "Ingresa tu correo..."
}
```

### Response (Full Lead Capture)
```json
{
  "mode": "full",
  "success": true,
  "message": "Report generated and sent to carlos@example.com"
}
```

## AI Report Generation

The AI service generates a 5-paragraph diagnostic report in LATAM Spanish:
1. Overall maturity assessment
2-5. Diagnosis per pillar + Quick Win recommendation

System prompt enforces: direct tone, no greetings, no markdown, no URLs, use "usted".

## Database Schema

See [sql/init.sql](sql/init.sql) for table structure. Key table: `leads` stores scorecard results with pillar breakdown.

## Google Sheets Integration

Leads are appended to a Google Sheet using service account credentials. Sheet ID configured via `GOOGLE_SHEET_ID` env var.

## Frontend Build

The frontend is a React SPA built with Vite. Build output goes to `dist/public/`.

```bash
npm run build           # Builds both backend and frontend
npm run build:spa       # Frontend only (vite build)
```

The Vite dev server proxies `/api/*` requests to the backend (port 3005).