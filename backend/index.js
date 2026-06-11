/**
 * Render entry shim.
 *
 * Production MUST run the compiled TypeScript server (dist/app.js). The
 * canonical start command (see render.yaml and backend/package.json "start")
 * is `node dist/app.js`. This shim exists so that ANY misconfigured start
 * command (e.g. `node index.js` set in the Render dashboard, or `node .` /
 * `npm start` on an old install where dist/ is missing) still boots the
 * real server instead of silently running a 1700-line legacy file.
 *
 * Behavior:
 *   1. If dist/app.js exists, require it and return. The compiled TS server
 *      is the actual production server — it exports a configured Express app.
 *   2. If dist/app.js is missing, log a loud build error and exit 1 so the
 *      Render deploy fails visibly instead of running stale legacy code.
 */
const path = require('path');

// CRITICAL: Force IPv4-first DNS resolution BEFORE any network code runs.
// Render free instances lack reliable IPv6 outbound — without this, Node
// can pick Supabase's IPv6 pooler address and the request dies with
// `connect ENETUNREACH <IPv6>:5432`. Must be the first statement.
const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) { /* node < 18.6 */ }

// Load .env as early as possible so the compiled server sees the same env.
const dotenv = require('dotenv');
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const compiledServer = path.resolve(__dirname, 'dist', 'app.js');
if (require('fs').existsSync(compiledServer)) {
  // eslint-disable-next-line no-console
  console.log(
    '[entry] dist/app.js detected — delegating to compiled TypeScript server.'
  );
  // The compiled module is a self-contained Express app; requiring it
  // starts the HTTP server as a side effect (same as `node dist/app.js`).
  require(compiledServer);
  return;
}

// If we reach here, dist/ is missing. The build must have failed on Render.
const buildLogHint = [
  '',
  '====================================================================',
  '  FATAL: backend/dist/app.js is missing on the Render instance.',
  '  The TypeScript build did not produce dist/ before `start` ran.',
  '====================================================================',
  '  Fix:',
  '    1. Confirm render.yaml `buildCommand` is:',
  '         npm install --include=dev && npm run build',
  '    2. Confirm `startCommand` is:',
  '         node dist/app.js',
  '       (or simply "npm start" — both work because package.json',
  '        `start` is `node dist/app.js`)',
  '    3. Re-deploy with "Clear build cache & deploy".',
  '  This shim refuses to fall back to legacy index.js because that file',
  '  uses pg.Pool over IPv6, which is unreachable from Render.',
  '====================================================================',
  '',
].join('\n');
// eslint-disable-next-line no-console
console.error(buildLogHint);
process.exit(1);
