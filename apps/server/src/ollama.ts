import * as z from 'zod';
import { HostOutput } from '@local-ai-radio/contracts';

const schema = z.toJSONSchema(HostOutput);

export async function generateReaction(system: string, user: object): Promise<{ hostLine: string; source: 'model' | 'fallback'; reason?: string; ms: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.PRESENTER_MODEL || 'gemma3:1b',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(user) },
        ],
        format: schema,
        stream: false,
        keep_alive: '10m',
        options: { temperature: 0.65, num_predict: 80, num_ctx: 2048 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`http_${res.status}`);
    const raw = await res.json();
    const parsed = HostOutput.parse(JSON.parse(raw.message.content));
    const line = parsed.hostLine;
    const words = line.trim().split(/\s+/u).length;
    if (words > 18) throw new Error('too_many_words');
    if (/[<>\n\r\t]/.test(line)) throw new Error('markup_or_control');
    if (/\*\*/.test(line)) throw new Error('markup');
    return { hostLine: line, source: 'model', ms: Date.now() - start };
  } catch (e: any) {
    clearTimeout(timeout);
    const reason = e.name === 'AbortError' ? 'timeout' : 'invalid';
    return { hostLine: '', source: 'fallback', reason, ms: Date.now() - start };
  }
}
