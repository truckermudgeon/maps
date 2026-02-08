import './bootstrap-env';

import * as path from 'node:path';
import * as url from 'node:url';
import { startServer } from './server';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, '../../../out');

startServer(process.argv.slice(2)[0] ?? outDir);
