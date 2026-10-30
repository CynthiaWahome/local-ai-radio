import { KokoroTTS } from 'kokoro-js';

let tts: any = null;

async function init() {
  if (!tts) {
    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp16', device: 'cpu' });
  }
  return tts;
}

async function synthesize(text: string, voice: string): Promise<{ data: number[]; sampleRate: number }> {
  const model = await init();
  const audio = await model.generate(text, { voice });
  return { data: Array.from(audio.data || audio.audio), sampleRate: audio.sampleRate };
}

function float32ToWav(data: number[], sampleRate: number): Buffer {
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

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line: string) => {
  let req: any;
  try {
    req = JSON.parse(line);
    const result = await synthesize(req.text, req.voice);
    const wav = float32ToWav(result.data, result.sampleRate);
    process.stdout.write(JSON.stringify({ id: req.id, audio: wav.toString('base64'), sampleRate: result.sampleRate }) + '\n');
  } catch (e: any) {
    process.stdout.write(JSON.stringify({ id: req?.id, error: e.message }) + '\n');
  }
});
console.error('TTS worker ready');
