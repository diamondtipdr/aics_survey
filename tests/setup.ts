/** Environment variables for unit tests */
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-sk-fake-key';
process.env.OPENAI_API_BASE = 'https://api.openai.com/v1';
process.env.OPENAI_MODEL = 'gpt-4o-mini';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_pass';
process.env.DB_NAME = 'aics_leads_test';
process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH = 'tests/fixtures/google-service-account.test.json';
process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
process.env.MAILGUN_API_KEY = 'test-mailgun-key';
process.env.MAILGUN_DOMAIN = 'mg.example.com';
process.env.LOG_LEVEL = 'silent';
process.env.LOG_TO_FILE = 'false';
process.env.AUDIT_ENABLED = 'false';