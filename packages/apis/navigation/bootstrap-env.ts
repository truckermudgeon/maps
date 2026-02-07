import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

const files = [
  '.env',
  '.env.local',
  `.env.${NODE_ENV}`,
  `.env.${NODE_ENV}.local`,
];

for (const file of files) {
  const fullPath = path.resolve(process.cwd(), file);

  if (!fs.existsSync(fullPath)) continue;

  // Never allow .env.local in production
  if (NODE_ENV === 'production' && file.endsWith('.local')) {
    console.warn(`Skipping ${file} in production`);
    continue;
  }

  dotenv.config({
    path: fullPath,
    override: false,
  });
}
