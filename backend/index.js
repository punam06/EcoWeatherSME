// This file acts as a fallback proxy for Render.
// If the Start Command in the Render dashboard is still set to 'node index.js',
// this file will simply redirect and launch the new compiled TypeScript backend.
// This ensures you don't get stuck on the legacy code.

require('./dist/app.js');
