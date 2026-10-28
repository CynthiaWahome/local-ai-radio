import { describe, it, expect } from 'vitest';
import { createRunId } from './index';

describe('engine', () => {
  it('creates a run id', () => {
    expect(createRunId()).toContain('run-');
  });
});
