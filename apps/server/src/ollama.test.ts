import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkModelReady } from './ollama';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('checkModelReady', () => {
  it('finds an untagged model under Ollama’s latest tag', async () => {
    vi.stubEnv('PRESENTER_MODEL', 'llama3.2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2:latest' }] }),
    }));

    await expect(checkModelReady()).resolves.toBe(true);
  });

  it('keeps an explicit model tag', async () => {
    vi.stubEnv('PRESENTER_MODEL', 'llama3.2:3b');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2:3b' }] }),
    }));

    await expect(checkModelReady()).resolves.toBe(true);
  });
});
