import { parse } from '@babel/parser';
import * as fs from 'fs';

const code = fs.readFileSync('Frontend and UI/climalogix_dashboard.jsx', 'utf-8');
try {
  parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log('Valid syntax');
} catch (e) {
  console.error(e.message);
}
