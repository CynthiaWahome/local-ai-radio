import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';

let worker: ChildProcess | null = null;
let ready = false;
const pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();

function startWorker() {
  if (worker) return;
  worker = spawn('npx', ['tsx', path.resolve(__dirname, 'tts-worker.ts')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  const rl = require('readline').createInterface({ input: worker.stdout! });
  rl.on('line', (line: string) => {
    try {
      const msg = JSON.parse(line);
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error));
        else p.resolve(msg);
      }
    } catch {}
  });
  worker.stderr?.on('data', (d: Buffer) => {
    if (d.toString().includes('ready')) ready = true;
  });
  worker.on('exit', () => { worker = null; ready = false; });
}

export function synthesize(text: string, voice: string): Promise<{ audio: string; sampleRate: number }> {
  startWorker();
  return new Promise((resolve, reject) => {
    const id = `tts-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pending.set(id, { resolve, reject });
    worker!.stdin!.write(JSON.stringify({ id, text, voice }) + '\n');
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('tts_timeout'));
      }
    }, 30000);
  });
}

export function float32ToWav(data: number[], sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = data.length * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7FFF, 44 + i * 2);
  }
  return buffer;
}
