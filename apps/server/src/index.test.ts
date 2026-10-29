import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, APP_TOKEN } from './index';
import { vi } from 'vitest';
vi.mock('./ollama', () => ({
  generateReaction: vi.fn().mockResolvedValue({ hostLine: 'An interesting submission. Unfortunately, that is not acceptable.', source: 'model', ms: 100 }),
}));

const TOKEN = APP_TOKEN;
const ORIGIN = 'http://127.0.0.1:4318';

describe('HTTP integration', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/runtime requires token', async () => {
    const res = await request(app).get('/api/runtime');
    expect(res.status).toBe(401);
  });

  it('GET /api/runtime with token returns readiness', async () => {
    const res = await request(app).get('/api/runtime').set('X-App-Token', TOKEN).set('Origin', ORIGIN);
    expect(res.status).toBe(200);
    expect(res.body.model).toBe('gemma3:1b');
    expect(res.body.ready).toBe(true);
  });

  it('POST /api/warmup with token returns ready', async () => {
    const res = await request(app).post('/api/warmup').set('X-App-Token', TOKEN).set('Origin', ORIGIN);
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });

  it('POST /api/reaction with invalid body returns 400', async () => {
    const res = await request(app).post('/api/reaction').set('X-App-Token', TOKEN).set('Origin', ORIGIN).send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/reaction with valid body returns reaction', async () => {
    const res = await request(app).post('/api/reaction').set('X-App-Token', TOKEN).set('Origin', ORIGIN).send({
      runId: 'r1',
      turnId: 'r1:0',
      episodeId: 'channel-00',
      roundIndex: 0,
      questionId: 'r1-colour',
      answerKind: 'text',
      answerText: 'Blue',
    });
    expect(res.status).toBe(200);
    expect(res.body.turnId).toBe('r1:0');
    expect(typeof res.body.hostLine).toBe('string');
    expect(res.body.dialogueSource).toBeDefined();
  });

  it('POST /api/reaction with invalid question returns 400', async () => {
    const res = await request(app).post('/api/reaction').set('X-App-Token', TOKEN).set('Origin', ORIGIN).send({
      runId: 'r1',
      turnId: 'r1:0',
      episodeId: 'channel-00',
      roundIndex: 0,
      questionId: 'nonexistent',
      answerKind: 'text',
      answerText: 'Blue',
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/speech returns audioId', async () => {
    const res = await request(app).post('/api/speech').set('X-App-Token', TOKEN).set('Origin', ORIGIN);
    expect(res.status).toBe(200);
    expect(res.body.audioId).toBeDefined();
  });

  it('GET /api/audio/:id returns wav', async () => {
    const speech = await request(app).post('/api/speech').set('X-App-Token', TOKEN).set('Origin', ORIGIN);
    const id = speech.body.audioId;
    const res = await request(app).get(`/api/audio/${id}`).set('X-App-Token', TOKEN).set('Origin', ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('audio/wav');
  });

  it('GET /api/audio/:id unknown returns 404', async () => {
    const res = await request(app).get('/api/audio/unknown-id').set('X-App-Token', TOKEN).set('Origin', ORIGIN);
    expect(res.status).toBe(404);
  });

  it('wrong origin returns 403', async () => {
    const res = await request(app).get('/api/runtime').set('X-App-Token', TOKEN).set('Origin', 'http://evil.com');
    expect(res.status).toBe(403);
  });
});
