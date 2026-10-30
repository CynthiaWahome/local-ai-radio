import { describe, it, expect } from 'vitest';
import { newRun, turnId, introDone, questionPresented, submit, expire, pause, resume, receiveReaction, reactionDone, banterDone, endingDone, secondsLeft, WINDOWS } from './engine';

const qids = ['q0', 'q1', 'q2', 'q3', 'q4'];

describe('engine', () => {
  it('creates a run', () => {
    const s = newRun('run1', qids);
    expect(s.phase).toBe('INTRO');
    expect(s.round).toBe(0);
  });

  it('introDone moves to question', () => {
    const s = introDone(newRun('run1', qids));
    expect(s.phase).toBe('QUESTION');
  });

  it('questionPresented sets deadline', () => {
    let s = introDone(newRun('run1', qids));
    s = questionPresented(s, 1000);
    expect(s.phase).toBe('ANSWERING');
    expect(s.deadline).toBe(1000 + 5000);
  });

  it('submit before deadline locks answer', () => {
    let s = introDone(newRun('run1', qids));
    s = questionPresented(s, 1000);
    s = submit(s, 'Blue', 2500);
    expect(s.phase).toBe('GENERATING');
    expect(s.turns.length).toBe(1);
    expect(s.turns[0].answerKind).toBe('text');
    expect(s.turns[0].answerText).toBe('Blue');
  });

  it('submit at deadline times out', () => {
    let s = introDone(newRun('run1', qids));
    s = questionPresented(s, 1000);
    s = submit(s, 'Blue', 6000);
    expect(s.turns[0].answerKind).toBe('timeout');
  });

  it('expire triggers timeout', () => {
    let s = introDone(newRun('run1', qids));
    s = questionPresented(s, 1000);
    s = expire(s, 6000);
    expect(s.phase).toBe('GENERATING');
    expect(s.turns[0].answerKind).toBe('timeout');
  });

  it('pause and resume preserves remaining', () => {
    let s = introDone(newRun('run1', qids));
    s = questionPresented(s, 1000);
    s = pause(s, 2000);
    expect(s.paused).toBe(true);
    expect(s.remaining).toBe(4000);
    s = resume(s, 5000);
    expect(s.paused).toBe(false);
    expect(s.deadline).toBe(9000);
  });

  it('double submit is no-op', () => {
    let s = introDone(newRun('run1', qids));
    s = questionPresented(s, 1000);
    s = submit(s, 'Blue', 2500);
    const s2 = submit(s, 'Red', 2600);
    expect(s2.turns.length).toBe(1);
  });

  it('banterDone advances round', () => {
    let s = introDone(newRun('run1', qids));
    s = questionPresented(s, 1000);
    s = submit(s, 'Blue', 2500);
    s = receiveReaction(s, { hostLine: 'No.', dialogueSource: 'model' }, turnId(s));
    s = reactionDone(s);
    s = banterDone(s);
    expect(s.round).toBe(1);
    expect(s.phase).toBe('QUESTION');
  });

  it('ending after round 5', () => {
    let s = newRun('run1', qids);
    for (let i = 0; i < 5; i++) {
      s = introDone(s);
      s = questionPresented(s, 1000);
      s = submit(s, 'x', 2000);
      s = receiveReaction(s, { hostLine: 'No.', dialogueSource: 'model' }, turnId(s));
      s = reactionDone(s);
      s = banterDone(s);
    }
    expect(s.phase).toBe('ENDING');
    s = endingDone(s);
    expect(s.phase).toBe('COMPLETE');
    expect(s.outcome).toBe('signal_lost');
  });

  it('secondsLeft computes correctly', () => {
    let s = introDone(newRun('run1', qids));
    s = questionPresented(s, 1000);
    expect(secondsLeft(s, 1000)).toBe(5);
    expect(secondsLeft(s, 5500)).toBe(1);
  });

  it('double mode doubles window', () => {
    let s = introDone(newRun('run1', qids, 'double'));
    s = questionPresented(s, 1000);
    expect(s.deadline).toBe(1000 + 5000 * 2);
  });

  it('untimed mode has no deadline', () => {
    let s = introDone(newRun('run1', qids, 'untimed'));
    s = questionPresented(s, 1000);
    expect(s.deadline).toBeNull();
  });
});
