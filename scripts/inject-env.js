// scripts/inject-env.js
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const outDir = path.resolve(process.cwd(), 'public');
const outFile = path.join(outDir, 'env.js');

const key = process.env.GEMINI_API_KEY || '';

const content = `window.__GEMINI_API_KEY = ${JSON.stringify(key)};` + '\n';

fs.writeFileSync(outFile, content, { encoding: 'utf8' });
console.log('Wrote', outFile);