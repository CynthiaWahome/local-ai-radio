import express from 'express';
import helmet from 'helmet';
import crypto from 'node:crypto';
import { ReactionRequest, ReactionResponseType as ReactionResponse, RuntimeResponseType as RuntimeResponse, WarmupResponseType as WarmupResponse } from '@local-ai-radio/contracts';
import { readFileSync } from 'node:fs';
import { generateReaction } from './ollama';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const app = express();
app.use(helmet());

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

const APP_TOKEN = crypto.randomBytes(32).toString('hex');
const ALLOWED_ORIGINS = ['http://127.0.0.1:5174', 'http://localhost:5174', 'http://127.0.0.1:4318', 'http://localhost:4318'];

// Token bootstrap: print URL with fragment
const port = process.env.PORT || 4318;
console.log(`\nServer running on http://127.0.0.1:${port}`);
console.log(`Frontend URL: http://127.0.0.1:${port}/#token=${APP_TOKEN}\n`);

// Middleware: token check for non-health routes
function requireToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.path === '/api/health') return next();
  const token = req.headers['x-app-token'];
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

app.get('/', (_req, res) => {
  res.send('local-ai-radio API. Use /api/health for status.');
});

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


app.post('/api/speech', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

app.get('/api/audio/:id', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

app.listen(port, () => {
  // already logged
});
