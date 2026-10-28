import * as z from 'zod';
export const ReactionRequest = z.strictObject({
    runId: z.string().min(1),
    turnId: z.string().min(1),
    episodeId: z.string().min(1),
    roundIndex: z.number().int().min(0).max(4),
    questionId: z.string().min(1),
    answerKind: z.enum(['text', 'silence', 'timeout']),
    answerText: z.string().max(160).optional(),
});
export const ReactionResponse = z.strictObject({
    reactionId: z.string().min(1),
    turnId: z.string().min(1),
    hostLine: z.string().min(8).max(180),
    dialogueSource: z.enum(['model', 'fallback', 'fixture']),
    model: z.string().min(1),
    generationMs: z.number().int().min(0),
    textFallbackReason: z.enum(['timeout', 'invalid', 'unavailable', 'busy', 'voice_only']).nullable(),
});
export const RuntimeResponse = z.strictObject({
    model: z.string(),
    ready: z.boolean(),
    voiceMode: z.enum(['local', 'none']),
});
export const WarmupResponse = z.strictObject({
    ready: z.boolean(),
    model: z.string(),
});
