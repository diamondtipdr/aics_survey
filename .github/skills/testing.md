# Testing Skill — AICS Lead Magnet Engine

## Overview

This skill provides guidance for testing the AICS Lead Magnet Engine microservice.

## Test Structure

```
tests/
├── setup.ts           # Environment variables for tests
├── teardown.ts        # Cleanup after tests
├── fixtures/
│   ├── sample-payload.json    # Test data
│   └── google-service-account.test.json
├── integration/
│   └── scorecard.route.test.ts
└── unit/
    ├── ai.service.test.ts
    ├── db.service.test.ts
    ├── email.service.test.ts
    ├── pdf.service.test.ts
    └── validation.test.ts
```

## Running Tests

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

## Test Configuration

- **Framework**: Jest with ts-jest
- **Environment**: Node.js
- **Timeout**: 30 seconds (PDF generation is slow)
- **Mocking**: All external services are mocked

## Mocking External Services

All external services are mocked in integration tests:

```typescript
jest.mock('../../src/services/ai.service');
jest.mock('../../src/services/pdf.service');
jest.mock('../../src/services/db.service');
jest.mock('../../src/services/email.service');
```

## Common Test Patterns

### Testing Preview Mode (no email)

```typescript
it('should return preview mode (no email)', async () => {
  const res = await request(app)
    .post('/api/v1/scorecard/process')
    .send(fixtures.validPreview)
    .expect(200);

  expect(res.body.mode).toBe('preview');
  expect(res.body.totalScore).toBe(43);
  
  // Should NOT call DB, PDF, or Email services
  expect(mockedPdf.generatePdf).not.toHaveBeenCalled();
  expect(mockedDb.insertLeadMySql).not.toHaveBeenCalled();
});
```

### Testing Full Lead Capture (with email)

```typescript
it('should return full lead capture (with email)', async () => {
  const res = await request(app)
    .post('/api/v1/scorecard/process')
    .send(fixtures.validFull)
    .expect(200);

  expect(res.body.mode).toBe('full');
  expect(res.body.success).toBe(true);
  
  // Should call PDF, DB, and Email services
  expect(mockedPdf.generatePdf).toHaveBeenCalledTimes(1);
  expect(mockedDb.insertLeadMySql).toHaveBeenCalledTimes(1);
});
```

### Testing Validation Errors

```typescript
it('should return 400 for invalid email', async () => {
  const res = await request(app)
    .post('/api/v1/scorecard/process')
    .send(fixtures.invalidEmail)
    .expect(400);

  expect(res.body.success).toBe(false);
  expect(res.body.code).toBe('VALIDATION_ERROR');
});
```

## Test Fixtures

See `tests/fixtures/sample-payload.json` for test data structure:

- `validPreview` - Valid payload without email
- `validFull` - Valid payload with email
- `noNamePreview` - Valid payload without name
- `invalidEmail` - Invalid email format
- `invalidMissingAnswers` - Missing answers array

## Debugging Tests

```bash
# Run specific test file
npm test -- tests/integration/scorecard.route.test.ts

# Run specific test
npm test -- -t "should return preview mode"

# Debug with VS Code
# Set breakpoints and run "Debug Jest Tests" launch config
```

## Coverage Targets

- `collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/types/**']`
- Coverage reports in `coverage/` directory