export const WINDOWS = Object.freeze([2000, 4000, 6000, 8000, 10000]);
export type Phase = 'SETUP' | 'INTRO' | 'QUESTION' | 'ANSWERING' | 'GENERATING' | 'REACTION' | 'BANTER' | 'ENDING' | 'COMPLETE';
export type TimingMode = 'standard' | 'double' | 'untimed';
export type DialogueSource = 'model' | 'fallback' | 'fixture';
export type AnswerKind = 'text' | 'silence' | 'timeout';

export interface Turn {
  turnId: string;
  roundIndex: 0 | 1 | 2 | 3 | 4;
  questionId: string;
  windowMs: number | null;
  answerKind?: AnswerKind;
  answerText?: string;
  hostLine?: string;
  dialogueSource?: DialogueSource;
  fallbackReason?: 'timeout' | 'invalid' | 'unavailable' | 'busy' | 'voice_only';
}

export interface RunState {
  id: string;
  phase: Phase;
  round: number;
  questionIds: string[];
  mode: TimingMode;
  deadline: number | null;
  paused: boolean;
  remaining: number | null;
  turns: Turn[];
  reaction: { hostLine: string; dialogueSource: DialogueSource } | null;
  outcome?: string;
}
