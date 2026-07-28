"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePdf = generatePdf;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const logger_1 = require("../utils/logger");
/**
 * Render the HTML report template with dynamic data,
 * then convert to a PDF buffer.
 */
async function generatePdf(data, ctx) {
    const logger = (0, logger_1.withContext)(ctx);
    const templatePath = path_1.default.resolve(__dirname, '../templates/report.html');
    let html = fs_1.default.readFileSync(templatePath, 'utf-8');
    // Replace template variables
    html = html
        .replace(/\{\{NAME\}\}/g, escapeHtml(data.name))
        .replace(/\{\{TOTAL_SCORE\}\}/g, String(data.totalScore))
        .replace(/\{\{MAX_SCORE\}\}/g, String(data.maxScore))
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
        .replace(/\{\{AI_REPORT\}\}/g, escapeHtml(data.aiReport).replace(/\n/g, '<br>'));
    // Optional logo
    if (data.logoBase64) {
        html = html.replace(/\{\{LOGO_SRC\}\}/g, `data:image/png;base64,${data.logoBase64}`);
    }
    else {
        html = html.replace(/\{\{LOGO_SRC\}\}/g, '');
    }
    // Optional radar chart image URL
    if (data.radarChartUrl) {
        html = html.replace(/\{\{RADAR_CHART_SRC\}\}/g, data.radarChartUrl);
    }
    else {
        // Fallback: generate a QuickChart.io URL
        const labels = data.pillars.map((p) => p.label.substring(0, 12));
        const scores = data.pillars.map((p) => (p.score / p.maxScore) * 100);
        const quickChartUrl = buildRadarChartUrl(labels, scores, data.name);
        html = html.replace(/\{\{RADAR_CHART_SRC\}\}/g, quickChartUrl);
    }
    logger.info('Launching Puppeteer for PDF generation');
    let browser;
    try {
        browser = await puppeteer_1.default.launch({
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
    }
    catch (error) {
        logger.error('PDF generation failed', { error: error.message });
        throw Object.assign(new Error(`PDF generation failed: ${error.message}`), { statusCode: 500, retryable: true });
    }
    finally {
        if (browser)
            await browser.close().catch(() => { });
    }
}
/**
 * Build a QuickChart.io radar chart URL from pillar data.
 */
function buildRadarChartUrl(labels, scores, name) {
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
    return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chart))}&width=400&height=400&backgroundColor=white`;
}
function calcPct(pillar) {
    if (!pillar || pillar.maxScore === 0)
        return '0';
    return String(Math.round((pillar.score / pillar.maxScore) * 100));
}
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
//# sourceMappingURL=pdf.service.js.map