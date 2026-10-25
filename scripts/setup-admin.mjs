import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
const file = '.env.local';
if (existsSync(file)) { console.log('.env.local already exists. Existing settings were preserved. See docs/admin-setup.md.'); process.exit(0); }
const prompt = createInterface({ input: process.stdin, output: process.stdout });
const email = (process.argv[2] ?? await prompt.question('Approved Google admin email: ')).trim().toLowerCase();
prompt.close();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
let template = readFileSync('.env.example', 'utf8');
template = template.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}`).replace(/^ADMIN_EMAILS=.*$/m, `ADMIN_EMAILS=${email}`);
writeFileSync(file, template, { mode: 0o600 });
mkdirSync('.data', { recursive: true });
console.log('Created ignored local configuration with a random session secret. Add your Google OAuth credentials, then run pnpm db:migrate.');
