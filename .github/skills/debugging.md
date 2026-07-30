# Debugging Skill — AICS Lead Magnet Engine

## Overview

This skill provides guidance for debugging the AICS Lead Magnet Engine microservice.

## Common Issues & Solutions

### 1. Environment Variables Missing

**Symptom**: Application crashes on startup with "Missing required environment variable"

**Solution**: 
- Copy `.env.example` to `.env`
- Fill in all required values
- For Docker: ensure `docker-compose.yml` has correct env vars

```bash
cp .env.example .env
# Edit .env with your values
```

### 2. Database Connection Failed

**Symptom**: "ECONNREFUSED" or "Access denied" errors

**Solution**:
- Check `DB_HOST` is correct (use `mysql` for Docker, `localhost` for local)
- Verify MySQL is running: `docker compose up mysql -d`
- Check credentials in `.env`
- Verify port: `DB_PORT` (default 3306, Docker maps to 3307)

```bash
# Test connection
docker compose exec mysql mysql -u root -p
```

### 3. AI API Errors

**Symptom**: "401 Unauthorized" or "429 Rate limit exceeded"

**Solution**:
- Verify `OPENAI_API_KEY` is valid
- Check `OPENAI_API_BASE` if using Azure/Ollama
- Check rate limits on your OpenAI plan

### 4. PDF Generation Fails

**Symptom**: "Failed to launch browser" or timeout

**Solution**:
- Ensure Chromium is installed (Docker has it pre-installed)
- Check `PUPPETEER_EXECUTABLE_PATH` environment variable
- Increase timeout if needed (default 30s)

### 5. Email Not Sending

**Symptom**: No email received, no errors in logs

**Solution**:
- Verify `MAILGUN_API_KEY` and `MAILGUN_DOMAIN`
- Check Mailgun sandbox domain restrictions
- Verify recipient email is verified in Mailgun

### 6. Google Sheets Integration Errors

**Symptom**: "Invalid credentials" or "Spreadsheet not found"

**Solution**:
- Verify `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` points to valid JSON
- Ensure service account has access to the sheet
- Check `GOOGLE_SHEET_ID` is correct (from URL)

## Debugging Tools

### Logging

The application uses Winston with structured JSON logging:

```typescript
import { withContext } from './utils/logger';

const logger = withContext({
  requestId: 'my-request-id',
  component: 'MyComponent',
});

logger.info('Message', { key: 'value' });
logger.error('Error', { error: err.message });
```

### Health Check

```bash
curl http://localhost:3005/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45
}
```

### Debug Mode

```bash
# Start with debug logging
DEBUG=* npm run dev

# Or set log level
LOG_LEVEL=debug npm run dev
```

## Docker Debugging

```bash
# View logs
docker compose logs -f app
docker compose logs -f mysql

# Exec into containers
docker compose exec app sh
docker compose exec mysql bash

# Check container status
docker compose ps

# Restart services
docker compose restart
```

## New Issues (Post-Hardening)

### 7. Moodle API "ERR_CONFIG" (500)

**Symptom**: `MOODLE_API_KEY no configurada` al llamar a `/api/v1/moodle/*`

**Solution**: Agregar `MOODLE_API_KEY=<secret>` en `.env`

### 8. Moodle API "ERR_401"

**Symptom**: `No autorizado. X-Api-Key inválida o faltante.`

**Solution**: El header `X-Api-Key` debe coincidir con `MOODLE_API_KEY` del `.env`

### 9. Rate Limited (429)

**Symptom**: `Demasiadas solicitudes`

**Solution**: Aumentar `RATE_LIMIT_MAX` en `.env` (default 100) o esperar 15 min

### 10. CORS Blocked (browser)

**Symptom**: Consola del navegador muestra error CORS

**Solution**: Verificar `CORS_ORIGIN` incluya exactamente la URL del frontend

### 11. Cloudflare Tunnel — 502 Bad Gateway

**Symptom**: El túnel está arriba pero devuelve 502

**Solution**:
- Verificar que la app responde: `curl http://localhost:3005/health`
- Revisar logs: `docker compose logs app`
- Verificar estado del túnel: `sudo systemctl status cloudflared`

## VS Code Debugging

### Launch Configurations

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/src/server.ts",
      "cwd": "${workspaceFolder}",
      "runtimeArgs": ["-r", "dotenv/config"],
      "envFile": "${workspaceFolder}/.env"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--watch"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

## Common Debug Commands

```bash
# Check if port is in use
lsof -i :3005

# View running processes
ps aux | grep node

# Check environment
node -e "console.log(process.env)"

# Validate TypeScript
npx tsc --noEmit

# Check for unused imports
npm run lint
```

## API Debugging

### Test Scorecard Endpoint

```bash
# Preview mode (no email)
curl -X POST http://localhost:3005/api/v1/scorecard/process \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/sample-payload.json

# Check response
curl -v http://localhost:3005/api/v1/scorecard/process
```

### Check Database Records

```bash
docker compose exec mysql mysql -u root -p aics_leads -e "SELECT * FROM aics_leads LIMIT 5;"
```

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "requestId": "uuid-here"
}
```

Common error codes:
- `VALIDATION_ERROR` - Invalid request payload
- `ERR_404` - Endpoint not found
- `ERR_500` - Internal server error