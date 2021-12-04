import { readdirSync, readFileSync } from 'fs';

export function getUrls() {
  if (process.argv.length > 2) return process.argv.slice(2);

  const ports = getLivePorts();

  return ports.map(port => `ws://localhost:${port}`);
}

export function getLivePorts(): number[] {
  const files = getHcLiveFiles();

  const fileContents = files.map(file => readFileSync(file, 'utf8'));
  return fileContents.map(c => parseInt(c));
}

export function getHcLiveFiles(): string[] {
  const currentDir = process.cwd();

  const dirContents = readdirSync(currentDir);

  return dirContents.filter(name => name.startsWith('.hc_live'));
}
