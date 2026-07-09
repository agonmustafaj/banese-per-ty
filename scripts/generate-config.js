/**
 * Gjeneron Website/js/config.local.js për Netlify (ose build lokal).
 * Lexon: SUPABASE_URL dhe SUPABASE_ANON_KEY nga mjedisi.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outPath = join(root, 'Website', 'js', 'config.local.js');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (url && key) {
  const content = `// Auto-generated — mos e ndrysho manualisht në Netlify
window.__BANESE_CONFIG__ = {
  supabaseUrl: '${url}',
  supabaseAnonKey: '${key}',
};
`;
  writeFileSync(outPath, content, 'utf8');
  console.log('✓ config.local.js u gjenerua nga variablat e mjedisit.');
} else if (existsSync(outPath)) {
  console.log('⚠ SUPABASE_URL / SUPABASE_ANON_KEY mungojnë — përdoret config.local.js ekzistues.');
} else {
  const fallback = `window.__BANESE_CONFIG__ = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
`;
  writeFileSync(outPath, fallback, 'utf8');
  console.log('⚠ Pa variabla mjedisi — Supabase çaktiv (modalitet demo).');
}
