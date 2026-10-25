import { defineConfig } from 'drizzle-kit';
export default defineConfig({ schema: './lib/server/schema.ts', out: './drizzle', dialect: 'sqlite' });
