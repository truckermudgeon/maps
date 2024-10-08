import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';

const homeDirectory = os.homedir();
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const resourcesDir = path.join(__dirname, '..', 'resources');

export const untildify = (path: string) =>
  homeDirectory ? path.replace(/^~(?=$|\/|\\)/, homeDirectory) : path;

export const maybeEnsureOutputDir = (args: {
  outputDir: string;
  dryRun?: boolean;
}) => {
  if (!args.dryRun && !fs.existsSync(args.outputDir)) {
    fs.mkdirSync(args.outputDir, { recursive: true });
  }
  return true;
};
