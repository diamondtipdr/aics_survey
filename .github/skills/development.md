# Development Skill — AICS Lead Magnet Engine

## Overview

This skill provides guidance for the development workflow of the AICS Lead Magnet Engine microservice.

## Project Structure

```
├── src/
│   ├── app.ts              # Express app setup
│   ├── server.ts           # Server entry point
│   ├── main.tsx            # React entry point
│   ├── routes/
│   │   ├── scorecard.ts    # POST /api/v1/scorecard/process
│   │   └── moodle.ts       # Moodle REST endpoints
│   ├── services/
│   │   ├── ai.service.ts   # OpenAI integration
│   │   ├── db.service.ts   # MySQL + Google Sheets
│   │   ├── email.service.ts # Mailgun integration
│   │   └── pdf.service.ts  # Puppeteer PDF generation
│   ├── utils/
│   │   ├── config.ts       # Environment config
│   │   ├── logger.ts       # Winston logging
│   │   └── validation.ts   # Zod schemas
│   ├── types/
│   │   └── index.ts        # TypeScript interfaces
│   ├── components/
│   │   ├── aics_lead_magnet.tsx  # React frontend component
│   │   └── aics_lead_magnet.css  # Frontend styles
│   └── templates/
│       ├── report.html           # PDF HTML template
│       └── assets/
│           └── logo.png          # Logo for PDFs
├── tests/
│   ├── setup.ts            # Test environment
│   ├── teardown.ts         # Test cleanup
│   ├── fixtures/           # Test data
│   ├── integration/        # Integration tests
│   └── unit/               # Unit tests
├── sql/
│   └── init.sql            # Database schema
├── docker/
│   └── Dockerfile          # Multi-stage build
├── dist/                   # Build output
├── public/                 # Static assets
├── logs/                   # Application logs
├── vite.config.ts          # Vite bundler config
├── index.html              # SPA HTML shell
├── jest.config.ts
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

## Development Setup

### Prerequisites

- Node.js 18+
- Docker + Docker Compose
- MySQL 8.0+ (or use Docker)
- OpenAI API key (or compatible endpoint)
- Mailgun account
- Google Cloud Service Account
- Chromium (for PDF generation)

### Initial Setup

```bash
# 1. Clone and enter
cd aics-lead-magnet-engine

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 4. Start MySQL (Docker)
docker compose up mysql -d

# 5. Run migrations (if needed)
# MySQL initializes from sql/init.sql automatically

# 6. Install Chromium for PDF generation
npx puppeteer browsers install chrome
```

## Development Commands

```bash
# Build
npm run build           # Build backend + frontend
npm run build:spa       # Frontend only

# Development with hot reload
npm run dev             # Backend (ts-node-dev) + Frontend (Vite)

# Start production build
npm start

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Linting
npm run lint
```

## Key Architecture Decisions

- **Dual build pipeline**: TypeScript (`tsc`) for backend, Vite for React SPA
- **Frontend served by Express**: Built SPA (`dist/public/`) served via `express.static`
- **Preview Mode**: Frontend calculates scores locally (no API call) when user doesn't provide email
- **Full Lead Capture**: API generates PDF via Puppeteer, stores in MySQL & Google Sheets, sends via Mailgun
- **Error resilience**: DB/Sheet failures are caught and logged — email is still sent
- **Graceful shutdown**: SIGTERM/SIGINT handler closes DB pool and HTTP server

# Development
npm run dev             # Start server + Vite dev server

# Testing
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage

# Linting
npm run lint            # ESLint check
```

## Code Style

### TypeScript

- Strict mode enabled
- ES2022 target
- CommonJS modules
- JSX: react-jsx

### Naming Conventions

- Files: `snake_case.ts` or `camelCase.ts`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Interfaces: `PascalCase` (suffixed with `Interface` if needed)

### Imports

```typescript
// External imports first
import express from 'express';
import axios from 'axios';

// Internal imports second
import { validatePayload } from '../utils/validation';
import { withContext } from '../utils/logger';

// Type imports last
import type { LogContext, ScorecardResponse } from '../types';
```

## Architecture Patterns

### Service Layer Pattern

Services encapsulate business logic:

```typescript
// ai.service.ts
export async function generateAiReport(
  industry: string | undefined,
  totalScore: number,
  pillars: { label: string; score: number }[],
  ctx: LogContext
): Promise<string>

// db.service.ts
export async function insertLeadMySql(lead: LeadRecord): Promise<void>
export async function appendToGoogleSheet(lead: LeadRecord): Promise<void>

// email.service.ts
export async function sendEmail(to: string, subject: string, html: string): Promise<void>

// pdf.service.ts
export async function generatePdf(data: PdfData, ctx: LogContext): Promise<Buffer>
```

### Validation Pattern

Use Zod schemas for request validation:

```typescript
const ScorecardRequestSchema = z.object({
  answers: z.array(AnswerSchema).length(16),
  dept_size: z.string().max(50).optional(),
  industry: z.string().max(255).optional(),
  name: z.string().max(255).optional(),
  email: z.string().email().optional(),
});

export function validatePayload(body: unknown) {
  const result = ScorecardRequestSchema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues.map(...) };
}
```

### Logging Pattern

Use structured logging with context:

```typescript
const logger = withContext({
  requestId: uuidv4(),
  component: 'ScorecardRoute',
});

logger.info('Incoming scorecard request', {
  hasEmail: !!req.body?.email,
  answersCount: req.body?.answers?.length,
});
```

## API Design

### Endpoint: POST /api/v1/scorecard/process

**Request Body**:
```json
{
  "answers": [{ "questionId": 1, "value": 3 }, ...],  // 16 required
  "dept_size": "11-50",
  "industry": "Tecnología",
  "name": "Carlos Pérez",
  "email": "carlos@example.com"  // optional
}
```

**Responses**:
- 200: Preview or Full lead capture response
- 400: Validation error
- 500: Internal error

### Response Shapes

**Preview Mode**:
```json
{
  "mode": "preview",
  "totalScore": 43,
  "maxScore": 64,
  "pillars": [...],
  "teaser": "Ingresa tu correo..."
}
```

**Full Lead Capture**:
```json
{
  "mode": "full",
  "success": true,
  "message": "Report generated and sent..."
}
```

## Database Schema

See [sql/init.sql](sql/init.sql) for the `aics_leads` table structure.

Key columns:
- `id`, `name`, `email`, `total_score`
- `pillar_1_score` through `pillar_4_score`
- `answers` (JSON)
- `created_at`, `processed`

## Docker Development

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Rebuild
docker compose build --no-cache
```

## Testing Workflow

1. Write unit tests for new functions
2. Add integration tests for API endpoints
3. Mock external services (AI, PDF, DB, Email)
4. Run tests: `npm test`
5. Check coverage: `npm run test:coverage`

## Deployment

The app uses a multi-stage Docker build:

1. **Builder stage**: Install deps, compile TypeScript, build frontend
2. **Production stage**: Copy artifacts, install Chromium for Puppeteer

Health check runs every 30 seconds via Docker HEALTHCHECK.