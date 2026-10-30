import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const model = process.env.PRESENTER_MODEL || 'gemma3:1b';
let healthy = true;

function report(label, ok) {
  console.log(`${ok ? 'OK' : 'MISSING'} ${label}`);
  if (!ok) healthy = false;
}

report('Node 24 or newer', Number(process.versions.node.split('.')[0]) >= 24);
report('episode content', existsSync(fileURLToPath(new URL('content/episode-01.json', root))));
for (const name of ['station-bed.wav', 'rejection-tone.wav', 'signal-drop.wav']) {
  report(`audio/${name}`, existsSync(fileURLToPath(new URL(`apps/web/public/audio/${name}`, root))));
}

try {
  const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
  const data = response.ok ? await response.json() : { models: [] };
  report(`local model ${model}`, data.models?.some(item => item.name === model || item.model === model) ?? false);
} catch {
  report(`local model ${model}`, false);
}

if (!healthy) process.exitCode = 1;
