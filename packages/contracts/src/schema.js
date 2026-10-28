import * as z from 'zod';
export const HostOutput = z.strictObject({
    hostLine: z.string().min(8).max(180),
});
