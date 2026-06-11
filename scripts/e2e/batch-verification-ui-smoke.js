const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_DIR = path.join(ROOT, 'backend');
const FRONTEND_DIR = path.join(ROOT, 'Frontend and UI');
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 5001);
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT || 3000);
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

function spawnProcess(command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(BACKEND_PORT),
      PUBLIC_BACKEND_URL: BACKEND_URL,
    },
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${options.name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${options.name}] ${chunk}`));
  return child;
}

function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve();
        retry();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) reject(new Error(`Timed out waiting for ${url}`));
      else setTimeout(tick, 500);
    };
    tick();
  });
}

function requestJson(method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const parsed = new URL(url);
    const req = http.request({
      method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, body: text ? JSON.parse(text) : {} });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function clickText(page, text) {
  const locator = page.getByText(text).first();
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  await locator.click();
}

async function main() {
  const backend = spawnProcess('npm', ['run', 'dev'], { cwd: BACKEND_DIR, name: 'backend' });
  const frontend = spawnProcess('npx', ['serve', '-s', FRONTEND_DIR, '-l', String(FRONTEND_PORT)], { cwd: ROOT, name: 'frontend' });
  let browser;
  const cleanup = () => {
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  await waitFor(`${BACKEND_URL}/api/health`);
  await waitFor(FRONTEND_URL);

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    const issues = [];

  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && !/favicon|Failed to load resource/i.test(text)) {
      issues.push(`console.${message.type()}: ${text}`);
    }
  });

    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <base href="${FRONTEND_URL}/">
          <style>
            :root {
              --text-primary: #f8fafc; --text-secondary: #cbd5e1; --text-dim: #94a3b8;
              --border-primary: rgba(255,255,255,0.1); --bg-input: rgba(15,23,42,0.8);
            }
            body { margin: 0; background: #0B0F19; color: #f8fafc; font-family: Inter, sans-serif; }
          </style>
          <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.23.5/babel.min.js"></script>
          <script src="api-integration.js"></script>
          <script src="toast.js"></script>
        </head>
        <body><div id="root"></div></body>
      </html>
    `, { waitUntil: 'domcontentloaded' });

    async function loadDashboard(file, componentName, props) {
      const source = await fs.readFile(path.join(FRONTEND_DIR, file), 'utf8');
      await page.evaluate(({ source, componentName, props }) => {
        window.useState = React.useState;
        window.useEffect = React.useEffect;
        window.useRef = React.useRef;
        window.useCallback = React.useCallback;
        window.useMemo = React.useMemo;
        window.confirm = () => true;
        const transformed = Babel.transform(source, { presets: ['react'] }).code;
        (0, eval)(transformed);
        const rootEl = document.getElementById('root');
        rootEl.innerHTML = '';
        window.__smokeRoot = window.__smokeRoot || ReactDOM.createRoot(rootEl);
        window.__smokeRoot.render(React.createElement(window[componentName], { ...props, onLogout: () => {} }));
      }, { source, componentName, props });
    }

    await loadDashboard('dashboards/ProducerDashboard.jsx', 'ProducerDashboard', {
      user: { id: 'ui-producer-id', role: 'processor', user_metadata: { role: 'processor', name: 'UI Smoke Producer' } },
    });

    await page.waitForSelector('text=Create Batch', { timeout: 30000 });
  await clickText(page, 'Create Batch');
  await page.getByPlaceholder('e.g. Premium BARI EM-1').fill(`UI Smoke Organic ${Date.now()}`);
  await page.getByText('Register Batch', { exact: true }).click();
  await page.waitForSelector('text=My Batches', { timeout: 15000 });
  await page.waitForSelector('text=AWAITING SHIPMENT', { timeout: 15000 });
  await clickText(page, 'Send');
  await page.waitForSelector('text=SHIPPED', { timeout: 15000 });

  const requests = await requestJson('GET', `${BACKEND_URL}/api/verification-requests`);
  if (requests.status !== 200 || !requests.body?.data?.length) {
    throw new Error(`No verification request created. Status ${requests.status}`);
  }
  const request = requests.body.data[0];
  const batchId = request.batch_id;

    await loadDashboard('dashboards/InspectorDashboard.jsx', 'InspectorDashboard', {
      user: { id: 'ui-inspector-id', role: 'inspector', user_metadata: { role: 'inspector', name: 'UI Smoke Inspector' } },
    });
  await page.waitForSelector('text=Batch Review Queue', { timeout: 30000 });
  await page.getByText(/Receive|Review/, { exact: false }).first().click();
  await clickText(page, 'Received');
  await page.waitForSelector('text=Certify & Approve', { timeout: 15000 });
  await page.getByText('Physical condition', { exact: true }).click();
  await page.getByText('Packaging integrity', { exact: true }).click();
  await page.getByText('Labeling compliance', { exact: true }).click();
  await page.getByText('Ingredient match', { exact: true }).click();
  await page.getByText('Certification authenticity', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await clickText(page, 'Certify & Approve');

  const detail = await requestJson('GET', `${BACKEND_URL}/api/batches/${batchId}`);
  if (detail.status !== 200 || detail.body.data.status !== 'approved') {
    throw new Error(`Approval did not persist. Status ${detail.status}, batch status ${detail.body?.data?.status}`);
  }
  const hash = detail.body.data.current_provenance_hash;
  if (!hash || !detail.body.data.qr_image_data || !detail.body.data.certificate_number) {
    throw new Error('Approved batch is missing QR image, certificate number, or provenance hash');
  }

  const verifyPage = await context.newPage();
  verifyPage.on('pageerror', (error) => issues.push(`verify pageerror: ${error.message}`));
  verifyPage.on('console', (message) => {
    if (message.type() === 'error') issues.push(`verify console.error: ${message.text()}`);
  });
  await verifyPage.goto(`${BACKEND_URL}/api/verify/${batchId}/page?hash=${hash}`, { waitUntil: 'domcontentloaded' });
  await verifyPage.waitForSelector('text=Valid', { timeout: 15000 });
  await verifyPage.waitForSelector('text=Download Full Certificate PDF', { timeout: 15000 });

  const pdf = await requestJson('GET', `${BACKEND_URL}/api/verify/${batchId}?hash=${hash}`);
  if (pdf.status !== 200 || pdf.body.data.certificateStatus !== 'Valid') {
    throw new Error('Public verification JSON did not return Valid');
  }

  if (issues.length) {
    throw new Error(`Browser console/page issues:\n${issues.join('\n')}`);
  }

    console.log('UI smoke passed: create -> send -> receive -> approve -> public verify page, with no browser console errors.');
  } finally {
    await browser?.close().catch(() => undefined);
    cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
