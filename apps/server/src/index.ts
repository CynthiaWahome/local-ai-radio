import express from 'express';
import helmet from 'helmet';
import crypto from 'node:crypto';
import { ReactionRequest, ReactionResponseType as ReactionResponse, RuntimeResponseType as RuntimeResponse, WarmupResponseType as WarmupResponse } from '@local-ai-radio/contracts';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { generateReaction } from './ollama';
import { synthesize } from './tts';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const app = express();

const serverLogs: string[] = [];
function log(msg: string) {
  const line = `${new Date().toISOString()} ${msg}`;
  serverLogs.push(line);
  if (serverLogs.length > 200) serverLogs.shift();
  console.log(line);
}

app.use(helmet({ contentSecurityPolicy: false }));

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'local-ai-radio API',
      version: '0.1.0',
    },
    components: {
      securitySchemes: {
        appToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-App-Token',
        },
      },
    },
  },
  apis: ['./src/index.ts'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.json());

const APP_TOKEN = process.env.APP_TOKEN || crypto.randomBytes(32).toString('hex');
const ALLOWED_ORIGINS = ['http://127.0.0.1:5174', 'http://localhost:5174', 'http://127.0.0.1:4318', 'http://localhost:4318'];

// Token bootstrap: print URL with fragment
const port = process.env.PORT || 4318;

// Middleware: token check for non-health routes
function requireToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.path.startsWith('/api/')) return next();
  if (req.path === '/api/health') return next();
  const token = req.headers['x-app-token'] || req.query.token;
  if (token !== APP_TOKEN) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'invalid_origin' });
  }
  next();
}

app.use(requireToken);

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: OK
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * @openapi
 * /api/runtime:
 *   get:
 *     summary: Runtime readiness
 *     security:
 *       - appToken: []
 *     responses:
 *       200:
 *         description: Runtime info
 */
app.get('/api/runtime', (_req, res) => {
  const body: RuntimeResponse = { model: 'gemma3:1b', ready: true, voiceMode: 'none' };
  res.json(body);
});

/**
 * @openapi
 * /api/warmup:
 *   post:
 *     summary: Warm up model
 *     security:
 *       - appToken: []
 *     responses:
 *       200:
 *         description: Warmup result
 */
app.post('/api/warmup', (_req, res) => {
  const body: WarmupResponse = { ready: true, model: 'gemma3:1b' };
  res.json(body);
});

/**
 * @openapi
 * /api/reaction:
 *   post:
 *     summary: Generate host reaction
 *     security:
 *       - appToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Reaction result
 */
app.post('/api/reaction', async (req, res) => {
  log('reaction request received');
  const parsed = ReactionRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
  }
  const { runId, turnId, episodeId, roundIndex, questionId, answerKind, answerText } = parsed.data;

  let episode: any;
  try {
    episode = JSON.parse(readFileSync(new URL('../../../content/episode-01.json', import.meta.url), 'utf8'));
  } catch {
    return res.status(500).json({ error: 'episode_not_found' });
  }

  const round = episode.rounds?.[roundIndex];
  const question = round?.questions?.find((q: any) => q.id === questionId);
  if (!round || !question) {
    return res.status(400).json({ error: 'invalid_question' });
  }

  const system = readFileSync(new URL('../../../prompts/presenter-system.txt', import.meta.url), 'utf8');
  const result = await generateReaction(system, {
    question: question.prompt,
    objection: question.objection,
    answerKind,
    answer: answerText || '',
  });

  const hostLine = result.source === 'model' && result.hostLine
    ? result.hostLine
    : (answerKind === 'timeout'
        ? 'Time expired. We accept late answers, naturally. They simply arrive after the person.'
        : `An interesting submission. Unfortunately, that is not acceptable.`);

  const body: ReactionResponse = {
    reactionId: `react-${Date.now()}`,
    turnId,
    hostLine,
    dialogueSource: result.source,
    model: process.env.PRESENTER_MODEL || 'gemma3:1b',
    generationMs: result.ms,
    textFallbackReason: result.source === 'model' ? null : (result.reason as any) || 'invalid',
  };
  res.json(body);
});


const audioStore = new Map<string, Buffer>();

function makeSilentWav(): Buffer {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 8;
  const dataSize = sampleRate; // 1 second
  const buffer = Buffer.alloc(44 + dataSize);
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // silence (128 for 8-bit unsigned)
  for (let i = 44; i < buffer.length; i++) buffer[i] = 128;
  return buffer;
}

/**
 * @openapi
 * /api/speech:
 *   post:
 *     summary: Synthesize speech
 *     security:
 *       - appToken: []
 *     responses:
 *       200:
 *         description: Audio ID
 */
const speechQueue: Array<{ id: string; text: string; voice: string; resolve: (v: any) => void }> = [];
let speechBusy = false;

async function processSpeechQueue() {
  if (speechBusy || speechQueue.length === 0) return;
  speechBusy = true;
  const job = speechQueue.shift()!;
  try {
    const result = await synthesize(job.text, job.voice);
    const wav = Buffer.from(result.audio, 'base64');
    audioStore.set(job.id, wav);
    job.resolve({ audioId: job.id, status: 'ready' });
  } catch (e: any) {
    job.resolve({ audioId: job.id, status: 'error', error: e.message });
  } finally {
    speechBusy = false;
    processSpeechQueue();
  }
}

app.post('/api/speech', (req, res) => {
  console.log('speech request received:', req.body?.text?.slice(0,30));
  const { text, voice } = req.body || {};
  if (!text || !voice) {
    return res.status(400).json({ error: 'missing_text_or_voice' });
  }
  const id = `audio-${Date.now()}`;
  const promise = new Promise((resolve) => {
    speechQueue.push({ id, text, voice, resolve });
    processSpeechQueue();
  });
  promise.then((result) => res.json(result));
});

/**
 * @openapi
 * /api/audio/{id}:
 *   get:
 *     summary: Serve audio by ID
 *     security:
 *       - appToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: WAV audio
 */
app.get('/api/audio/:id', (req, res) => {
  const buf = audioStore.get(req.params.id);
  if (!buf) return res.status(404).json({ error: 'not_found' });
  res.set('Content-Type', 'audio/wav');
  res.send(buf);
});


// Serve built web UI in production
const webDist = path.resolve(process.cwd(), 'apps/web/dist');
app.use(express.static(webDist));

app.get('/api/debug/logs', (_req, res) => {
  res.json({ logs: serverLogs });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(webDist, 'index.html'));
});

export { app, APP_TOKEN };

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`\nServer running on http://127.0.0.1:${port}`);
    console.log(`Frontend URL: http://127.0.0.1:${port}/#token=${APP_TOKEN}\n`);
    // Warm up TTS model
    import('./tts').then(({ synthesize }) => {
      synthesize('warm up', 'af_nicole').then(() => console.log('TTS warmed up')).catch(e => console.error('TTS warmup failed:', e.message));
    });
  });
}
