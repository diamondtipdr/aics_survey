import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import { withContext } from '../utils/logger';
import type { LogContext } from '../types';

/**
 * Render the HTML report template with dynamic data,
 * then convert to a PDF buffer.
 */
export async function generatePdf(
  data: {
    name: string;
    totalScore: number;
    maxScore: number;
    pillars: { label: string; score: number; maxScore: number }[];
    aiReport: string;
    logoBase64?: string;
    radarChartUrl?: string;
  },
  ctx: LogContext
): Promise<Buffer> {
  const logger = withContext(ctx);
  const templatePath = path.resolve(__dirname, '../templates/report.html');

  let html = fs.readFileSync(templatePath, 'utf-8');

  // Auto-load logo from assets folder
  const logoPath = path.resolve(__dirname, '../templates/assets/logo.png');
  let logoBase64 = '';
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = logoBuffer.toString('base64');
  } catch {
    // Logo not found — will be replaced with empty string below
  }

  // Replace template variables
  html = html
    .replace(/\{\{NAME\}\}/g, escapeHtml(data.name))
    .replace(/\{\{TOTAL_SCORE\}\}/g, String(data.totalScore))
    .replace(/\{\{MAX_SCORE\}\}/g, String(data.maxScore))
    .replace(/\{\{SCORE_PERCENT\}\}/g, calcScorePct(data.totalScore, data.maxScore))
    .replace(/\{\{MATURITY_BADGE_HTML\}\}/g, buildMaturityBadge(data.totalScore))
    .replace(/\{\{P1_BADGE_HTML\}\}/g, buildPillarBadge(data.pillars, 0))
    .replace(/\{\{P2_BADGE_HTML\}\}/g, buildPillarBadge(data.pillars, 1))
    .replace(/\{\{P3_BADGE_HTML\}\}/g, buildPillarBadge(data.pillars, 2))
    .replace(/\{\{P4_BADGE_HTML\}\}/g, buildPillarBadge(data.pillars, 3))
    .replace(/\{\{P1_SCORE\}\}/g, String(data.pillars[0]?.score ?? 0))
    .replace(/\{\{P1_LABEL\}\}/g, data.pillars[0]?.label ?? '')
    .replace(/\{\{P1_PERCENT\}\}/g, calcPct(data.pillars[0]))
    .replace(/\{\{P2_SCORE\}\}/g, String(data.pillars[1]?.score ?? 0))
    .replace(/\{\{P2_LABEL\}\}/g, data.pillars[1]?.label ?? '')
    .replace(/\{\{P2_PERCENT\}\}/g, calcPct(data.pillars[1]))
    .replace(/\{\{P3_SCORE\}\}/g, String(data.pillars[2]?.score ?? 0))
    .replace(/\{\{P3_LABEL\}\}/g, data.pillars[2]?.label ?? '')
    .replace(/\{\{P3_PERCENT\}\}/g, calcPct(data.pillars[2]))
    .replace(/\{\{P4_SCORE\}\}/g, String(data.pillars[3]?.score ?? 0))
    .replace(/\{\{P4_LABEL\}\}/g, data.pillars[3]?.label ?? '')
    .replace(/\{\{P4_PERCENT\}\}/g, calcPct(data.pillars[3]))
    .replace(/\{\{AI_REPORT\}\}/g, renderAiReport(data.aiReport));

  // Inject logo as base64 data URL
  if (logoBase64) {
    html = html.replace(
      /\{\{LOGO_SRC\}\}/g,
      `data:image/png;base64,${logoBase64}`
    );
  } else {
    html = html.replace(/\{\{LOGO_SRC\}\}/g, '');
  }

  // Optional radar chart image URL
  if (data.radarChartUrl) {
    html = html.replace(/\{\{RADAR_CHART_SRC\}\}/g, data.radarChartUrl);
  } else {
    // Fallback: generate a QuickChart.io URL
    const labels = data.pillars.map((p) => p.label.substring(0, 12));
    const scores = data.pillars.map((p) => (p.score / p.maxScore) * 100);
    const quickChartUrl = buildRadarChartUrl(labels, scores, data.name);
    html = html.replace(/\{\{RADAR_CHART_SRC\}\}/g, quickChartUrl);
  }

  logger.info('Launching Puppeteer for PDF generation');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      printBackground: true,
      preferCSSPageSize: true,
    });

    logger.info('PDF generated successfully', {
      sizeBytes: pdfBuffer.length,
    });

    return pdfBuffer;
  } catch (error: any) {
    logger.error('PDF generation failed', { error: error.message });
    throw Object.assign(
      new Error(`PDF generation failed: ${error.message}`),
      { statusCode: 500, retryable: true }
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Build a QuickChart.io radar chart URL from pillar data.
 */
function buildRadarChartUrl(
  labels: string[],
  scores: number[],
  name: string
): string {
  const chart = {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: name,
          data: scores,
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        },
      ],
    },
    options: {
      scale: {
        ticks: { beginAtZero: true, max: 100, stepSize: 25 },
      },
      plugins: {
        legend: { display: true },
      },
    },
  };

  return `https://quickchart.io/chart?c=${encodeURIComponent(
    JSON.stringify(chart)
  )}&width=400&height=400&backgroundColor=white`;
}

function calcPct(pillar: { score: number; maxScore: number } | undefined): string {
  if (!pillar || pillar.maxScore === 0) return '0';
  return String(Math.round((pillar.score / pillar.maxScore) * 100));
}

/**
 * Percentage of the overall score (totalScore / maxScore) * 100,
 * used to fill the conic-gradient gauge in the template.
 */
function calcScorePct(totalScore: number, maxScore: number): string {
  if (!maxScore) return '0';
  return String(Math.round((totalScore / maxScore) * 100));
}

/**
 * Build the general maturity badge HTML based on the total score (over 64).
 */
function buildMaturityBadge(totalScore: number): string {
  if (totalScore <= 32) {
    return '<span class="badge badge-red">Nivel: Analógico / En Desarrollo</span>';
  }
  if (totalScore <= 48) {
    return '<span class="badge badge-yellow">Nivel: Funcional / En Transición</span>';
  }
  return '<span class="badge badge-teal">Nivel: Estratégico / Inteligente</span>';
}

/**
 * Build the small badge HTML for a pillar. The pillar with the highest score
 * gets a "Fortaleza" badge, the one with the lowest score gets a
 * "Prioridad Urgente" badge. Ties resolve to the first pillar in order.
 */
function buildPillarBadge(
  pillars: { label: string; score: number; maxScore: number }[],
  index: number
): string {
  if (!pillars || pillars.length === 0) return '';

  // Real max and min across all pillars
  const scores = pillars.map((p) => p.score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  // Total tie exception: if max === min, all pillars scored the same.
  // Do NOT inject any small badge to avoid visual clutter.
  if (maxScore === minScore) return '';

  // Multiple assignment: mark EVERY pillar tied at the max as "Fortaleza"
  // and EVERY pillar tied at the min as "Prioridad Urgente".
  if (pillars[index].score === maxScore) {
    return '<span class="badge-sm badge-teal">Fortaleza</span>';
  }
  if (pillars[index].score === minScore) {
    return '<span class="badge-sm badge-red">Prioridad Urgente</span>';
  }
  return '';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convert the structured AI report (with ### headers) into styled HTML.
 * Each "### Pillar Name (X/16)" becomes an h3.
 * Each "### Quick Win — Pillar Name" becomes an h3 with quick-win styling.
 */
function renderAiReport(aiReport: string): string {
  const lines = aiReport.split('\n');
  const htmlParts: string[] = [];
  let inQuickWin = false;

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)/);
    if (headingMatch) {
      const heading = headingMatch[1].trim();

      if (heading.startsWith('Quick Win')) {
        inQuickWin = true;
        const pillarName = heading.replace(/^Quick Win\s*[—–-]?\s*/, '');
        htmlParts.push(
          `<h3 class="quick-win-heading">⚡ Quick Win — ${escapeHtml(pillarName)}</h3>`
        );
      } else {
        inQuickWin = false;
        // Extract score from heading like "Integración (12/16)"
        const scoreMatch = heading.match(/\((\d+)\/(\d+)\)/);
        const pillarName = heading.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
        if (scoreMatch) {
          htmlParts.push(
            `<h3 class="pillar-heading">${escapeHtml(pillarName)} <span class="pillar-heading-score">${escapeHtml(scoreMatch[0])}</span></h3>`
          );
        } else {
          htmlParts.push(`<h3 class="pillar-heading">${escapeHtml(heading)}</h3>`);
        }
      }
    } else if (line.trim() === '') {
      htmlParts.push('<br>');
    } else {
      htmlParts.push(`<p class="${inQuickWin ? 'quick-win-text' : ''}">${escapeHtml(line)}</p>`);
    }
  }

  return htmlParts.join('\n');
}