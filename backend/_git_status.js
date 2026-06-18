// Helper: run git via Node and append to a log file the user can see.
const { execSync } = require('child_process');
const fs = require('fs');
const cmd = process.argv[2] || 'status --short';
const logPath = 'd:\\user_jabu\\hackathon-ev\\backend\\_git.log';
let body = `> git ${cmd}\n`;
try {
  const out = execSync(`git ${cmd}`, {
    cwd: 'd:\\user_jabu\\hackathon-ev',
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  body += out;
  body += `\n[exit 0]`;
} catch (e) {
  body += (e.stdout || '') + (e.stderr || '');
  body += `\n[exit ${e.status || 1}]`;
}
fs.appendFileSync(logPath, body + '\n----\n');
process.stdout.write(body);
