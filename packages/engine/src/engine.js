import { WINDOWS } from './types';
export { WINDOWS };
const MODES = Object.freeze({
    standard: 1,
    double: 2,
    untimed: null,
});
function checkedNow(now) {
    if (!Number.isFinite(now) || now < 0)
        throw new TypeError('invalid clock');
    return now;
}
export function newRun(id, questionIds, mode = 'standard') {
    if (typeof id !== 'string' || !id)
        throw new TypeError('invalid id');
    if (!Array.isArray(questionIds) || questionIds.length !== 5 || questionIds.some(q => typeof q !== 'string' || !q))
        throw new TypeError('invalid run');
    if (!(mode in MODES))
        throw new TypeError('invalid mode');
    return {
        id,
        phase: 'INTRO',
        round: 0,
        questionIds: [...questionIds],
        mode,
        deadline: null,
        paused: false,
        remaining: null,
        turns: [],
        reaction: null,
    };
}
export const turnId = (s) => `${s.id}:${s.round}`;
export function introDone(s) {
    return s.phase === 'INTRO' && !s.paused ? { ...s, phase: 'QUESTION' } : s;
}
export function questionPresented(s, now) {
    checkedNow(now);
    if (s.phase !== 'QUESTION' || s.paused)
        return s;
    const factor = MODES[s.mode];
    return { ...s, phase: 'ANSWERING', deadline: factor === null ? null : now + WINDOWS[s.round] * factor };
}
export function submit(s, text, now, token = turnId(s)) {
    checkedNow(now);
    if (s.phase !== 'ANSWERING' || s.paused || token !== turnId(s))
        return s;
    if (typeof text !== 'string')
        throw new TypeError('answer must be text');
    const timedOut = s.deadline !== null && now >= s.deadline;
    const normalized = [...text.normalize('NFC').trim()].slice(0, 160).join('');
    const item = {
        turnId: token,
        roundIndex: s.round,
        questionId: s.questionIds[s.round],
        answerKind: (timedOut ? 'timeout' : normalized ? 'text' : 'silence'),
        answerText: timedOut ? '' : normalized,
        windowMs: null,
        accepted: false,
    };
    return { ...s, phase: 'GENERATING', deadline: null, turns: [...s.turns, item], reaction: null };
}
export function expire(s, now, token = turnId(s)) {
    checkedNow(now);
    if (s.phase !== 'ANSWERING' || s.paused || s.deadline === null || now < s.deadline)
        return s;
    return submit(s, '', now, token);
}
export function pause(s, now) {
    checkedNow(now);
    if (s.paused || s.phase === 'COMPLETE')
        return s;
    const current = s.phase === 'ANSWERING' && s.deadline !== null && now >= s.deadline ? expire(s, now) : s;
    return {
        ...current,
        paused: true,
        remaining: current.phase === 'ANSWERING' && current.deadline !== null ? Math.max(0, current.deadline - now) : null,
        deadline: null,
    };
}
export function resume(s, now) {
    checkedNow(now);
    if (!s.paused)
        return s;
    return {
        ...s,
        paused: false,
        deadline: s.phase === 'ANSWERING' && s.remaining !== null ? now + s.remaining : null,
        remaining: null,
    };
}
export function receiveReaction(s, reaction, token) {
    if (s.phase !== 'GENERATING' || s.paused || token !== turnId(s))
        return s;
    if (!reaction || typeof reaction.hostLine !== 'string' || !['model', 'fallback', 'fixture'].includes(reaction.dialogueSource))
        throw new TypeError('invalid reaction');
    return { ...s, phase: 'REACTION', reaction: { hostLine: reaction.hostLine, dialogueSource: reaction.dialogueSource } };
}
export function reactionDone(s) {
    return s.phase === 'REACTION' && !s.paused ? { ...s, phase: 'BANTER' } : s;
}
export function banterDone(s) {
    if (s.phase !== 'BANTER' || s.paused)
        return s;
    return s.round === 4
        ? { ...s, phase: 'ENDING', reaction: null }
        : { ...s, phase: 'QUESTION', round: s.round + 1, reaction: null };
}
export function endingDone(s) {
    return s.phase === 'ENDING' && !s.paused ? { ...s, phase: 'COMPLETE', outcome: 'signal_lost' } : s;
}
export function secondsLeft(s, now) {
    checkedNow(now);
    if (s.phase !== 'ANSWERING')
        return null;
    if (s.paused)
        return s.remaining === null ? null : Math.ceil(s.remaining / 1000);
    return s.deadline === null ? null : Math.max(0, Math.ceil((s.deadline - now) / 1000));
}
