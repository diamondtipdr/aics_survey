// ============================================================
// Scorecard Types — shared interfaces for the AICS Lead Magnet
// ============================================================

/** Single answer: 1–4 scale */
export interface Answer {
  questionId: number;
  value: 1 | 2 | 3 | 4;
}

/** Raw inbound payload from the frontend */
export interface ScorecardRequest {
  /** 16 answers */
  answers: Answer[];
  /** Department size description (optional for preview) */
  dept_size?: string;
  /** Industry sector */
  industry?: string;
  /** User name – optional (preview mode) */
  name?: string;
  /** User email – optional (preview mode) */
  email?: string;
}

/** Scored breakdown for one pillar */
export interface PillarScore {
  pillarId: number;
  label: string;
  score: number;
  maxScore: number;
}

/** Result after score calculation */
export interface ScoreResult {
  totalScore: number;
  maxScore: number;
  pillars: PillarScore[];
}

/** AI-generated executive report */
export interface AiReport {
  content: string;
  model: string;
}

/** Lead record stored in MySQL & Google Sheets */
export interface LeadRecord {
  name: string;
  email: string;
  totalScore: number;
  pillar1Score: number;
  pillar2Score: number;
  pillar3Score: number;
  pillar4Score: number;
  answers: Answer[];
  industry?: string;
  deptSize?: string;
}

/** Response shape for Preview Mode (no email) */
export interface PreviewResponse {
  mode: 'preview';
  totalScore: number;
  maxScore: number;
  pillars: PillarScore[];
  aiReport: string;
}

/** Response shape for Full Lead Capture (with email) */
export interface FullResponse {
  mode: 'full';
  success: true;
  message: string;
}

/** Error response */
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  requestId?: string;
}

/** Scorecard route typed response */
export type ScorecardResponse = PreviewResponse | FullResponse | ErrorResponse;

/** Environment variables shape */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  // OpenAI
  openaiApiKey: string;
  openaiApiBase: string;
  openaiModel: string;
  // MySQL
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  // Google Sheets
  googleServiceAccountKey: string;
  googleServiceAccountKeyPath: string;
  googleSheetId: string;
  // Mailgun
  mailgunApiKey: string;
  mailgunDomain: string;
  // Logging
  logLevel: string;
  logToFile: boolean;
  logFilePath: string;
  auditEnabled: boolean;
}

/** Logger context for structured logging */
export interface LogContext {
  requestId: string;
  component: string;
  [key: string]: unknown;
}