import { Router, Request, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import { verifyPublicBatch } from '../../lib/services/batchVerification.service';

const router = Router();

function clientIp(req: Request) {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusColor(status: string) {
  if (status === 'Valid') return '#047857';
  if (status === 'Expired Certification') return '#b45309';
  return '#b91c1c';
}

function renderVerificationPage(data: any) {
  const color = statusColor(data.certificateStatus);
  const breakdown = data.evaluationBreakdown?.components || {};
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.productName)} Certificate</title>
  <style>
    body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
    main { max-width: 760px; margin: 0 auto; padding: 24px 16px 40px; }
    .badge { display: inline-flex; padding: 8px 12px; border-radius: 999px; color: #fff; background: ${color}; font-weight: 800; }
    .panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-top: 16px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06); }
    .grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .row { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #f1f5f9; padding: 9px 0; }
    .row span:first-child { color: #64748b; }
    .hash { overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    a.button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin-top: 16px; padding: 0 16px; border-radius: 8px; background: #0f172a; color: white; text-decoration: none; font-weight: 800; }
    h1 { font-size: clamp(28px, 7vw, 48px); line-height: 1; margin: 18px 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 8px; }
    .demo { color: #b45309; font-weight: 700; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <div class="demo">DEMO / UNOFFICIAL CERTIFICATE — NOT A GOVERNMENT SEAL</div>
    <div class="badge">${escapeHtml(data.certificateStatus)}</div>
    <h1>${escapeHtml(data.productName)}</h1>
    <div>Batch ${escapeHtml(data.batchNumber || data.batchId)} · ${escapeHtml(data.category || 'N/A')}</div>
    <section class="panel">
      <h2>Certificate Summary</h2>
      <div class="grid">
        <div class="row"><span>Manufacturer</span><strong>${escapeHtml(data.manufacturerDisplayName || 'Certified Manufacturer')}</strong></div>
        <div class="row"><span>Approval date</span><strong>${escapeHtml(data.approvalDate || 'Pending')}</strong></div>
        <div class="row"><span>Expiry date</span><strong>${escapeHtml(data.expiryDate || 'N/A')}</strong></div>
        <div class="row"><span>Certificate number</span><strong>${escapeHtml(data.certificateNumber || 'N/A')}</strong></div>
        <div class="row"><span>Inspector cert ID</span><strong>${escapeHtml(data.inspectorCertificationId || 'N/A')}</strong></div>
        <div class="row"><span>Trust score</span><strong>${escapeHtml(data.trustScore)}</strong></div>
      </div>
    </section>
    <section class="panel">
      <h2>BARI/BSTI Evaluation</h2>
      <div class="row"><span>Summary</span><strong>${escapeHtml(data.evaluationSummary?.passed ? 'Passed' : 'Failed')}</strong></div>
      <div class="row"><span>Reference</span><strong>${escapeHtml(data.evaluationSummary?.reference)}</strong></div>
      <div class="row"><span>pH</span><strong>${escapeHtml(breakdown.ph)}%</strong></div>
      <div class="row"><span>EC</span><strong>${escapeHtml(breakdown.ec)}%</strong></div>
      <div class="row"><span>Temperature</span><strong>${escapeHtml(breakdown.temp)}%</strong></div>
      <div class="row"><span>Ratio</span><strong>${escapeHtml(breakdown.ratio)}%</strong></div>
      <div class="row"><span>Days</span><strong>${escapeHtml(breakdown.days)}%</strong></div>
    </section>
    <section class="panel">
      <h2>Provenance</h2>
      <div class="hash">${escapeHtml(data.provenanceHash)}</div>
      <div style="margin-top: 10px;">Chain integrity: <strong>${escapeHtml(data.chainVerified ? 'Verified' : 'Tamper warning')}</strong></div>
    </section>
    <a class="button" href="${escapeHtml(data.pdfUrl)}">Download Full Certificate PDF</a>
  </main>
</body>
</html>`;
}

function pdfEscape(value: unknown) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').slice(0, 140);
}

async function buildCertificatePdf(data: any): Promise<Buffer> {
  const breakdown = data.evaluationBreakdown?.components || {};
  const verifyUrl = data.pdfUrl?.replace('/certificate.pdf', '') || '';
  let qrNote = verifyUrl;
  try {
    qrNote = await QRCode.toDataURL(verifyUrl, { width: 180, margin: 1 });
  } catch { /* text fallback below */ }

  const lines = [
    'CLIMALOGIX AI DEMO CERTIFICATE',
    'Unofficial demo certificate. No government seal is implied.',
    `Status: ${data.certificateStatus}`,
    `Product: ${data.productName}`,
    `Category: ${data.category || 'N/A'}`,
    `Batch: ${data.batchNumber || data.batchId}`,
    `Manufacturer: ${data.manufacturerDisplayName || 'Certified Manufacturer'}`,
    `Approval date: ${data.approvalDate || 'N/A'}`,
    `Expiry date: ${data.expiryDate || 'N/A'}`,
    `Certificate number: ${data.certificateNumber || 'N/A'}`,
    `Inspector certification ID: ${data.inspectorCertificationId || 'N/A'}`,
    `Trust score: ${data.trustScore ?? 'N/A'}`,
    `Evaluation: ${data.evaluationSummary?.passed ? 'Passed' : 'Failed'}`,
    `Reference: ${data.evaluationSummary?.reference || 'N/A'}`,
    `pH score: ${breakdown.ph ?? 'N/A'}%`,
    `EC score: ${breakdown.ec ?? 'N/A'}%`,
    `Temperature score: ${breakdown.temp ?? 'N/A'}%`,
    `Ratio score: ${breakdown.ratio ?? 'N/A'}%`,
    `Fermentation days score: ${breakdown.days ?? 'N/A'}%`,
    `Provenance hash: ${data.provenanceHash || 'N/A'}`,
    `Chain verified: ${data.chainVerified ? 'Yes' : 'No'}`,
    `Verify URL: ${verifyUrl}`,
    qrNote.startsWith('data:image') ? 'QR image embedded on public verify page.' : '',
  ].filter(Boolean);

  const content = [
    'BT',
    '/F1 12 Tf',
    '50 780 Td',
    ...lines.flatMap((line, index) => [
      index === 0 ? '' : '0 -20 Td',
      `(${pdfEscape(line)}) Tj`,
    ]).filter(Boolean),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

router.get('/test', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      message: 'ClimaLogix public verify route is active',
      hint: 'Use GET /api/verify/:batchId?hash=<provenance_hash>',
    },
  });
});

router.get('/:batch_id/page', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await verifyPublicBatch(req.params.batch_id, String(req.query.hash || ''), {
      ip: clientIp(req),
      userAgent: String(req.headers['user-agent'] || ''),
    });
    if (result.status !== 200) {
      res.status(result.status).send(`<h1>${escapeHtml(result.error)}</h1>`);
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderVerificationPage(result.data));
  } catch (err) {
    next(err);
  }
});

router.get('/:batch_id/certificate.pdf', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await verifyPublicBatch(req.params.batch_id, String(req.query.hash || ''));
    if (result.status !== 200) {
      res.status(result.status).json({ success: false, error: result.error });
      return;
    }
    const data = result.data!;
    const pdf = await buildCertificatePdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${data.certificateNumber || data.batchId}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

router.get('/:batch_id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await verifyPublicBatch(req.params.batch_id, String(req.query.hash || ''), {
      ip: clientIp(req),
      userAgent: String(req.headers['user-agent'] || ''),
    });
    if (result.status !== 200) {
      res.status(result.status).json({ success: false, error: result.error });
      return;
    }
    res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    next(err);
  }
});

export default router;
