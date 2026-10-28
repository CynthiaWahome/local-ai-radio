# 03 — Technical contract

## 1. Recommended stack and boundaries

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite | Small local application, explicit component state |
| Styling | Local CSS variables and semantic HTML | Brand control without runtime CDN dependencies |
| Game engine | Pure TypeScript reducer + injected clock | Timer races and fixed ending are testable |
| API | Node 24 LTS + Express + Zod 4 | Local adapter with shared validated contracts |
| Presenter | Ollama, `gemma3:1b` initial candidate | Answer-conditioned short lines; benchmark quality |
| Speech | `kokoro-js`, dedicated Node process | Local voice generation; isolate heavy work |
| Fixed audio | Local WAV/optional encoded derivatives | Preload predictable clips |
| State | Memory for a run; explicit browser export | No cloud database or user accounts required |
| Tests | Vitest + HTTP integration + Playwright | Pure rules, local adapters and actual browser flow |

This is a recommended implementation, not a tested compatibility bundle. Lock actual dependency versions after a smoke build. A Gemma model is open-weight with its own terms; do not relabel every component MIT just because the app source might use MIT.

The frontend owns the authoritative **local gameplay clock**. There is no competition or trusted score server, so preventing a player from altering their own browser is unnecessary. Backend validation protects local resources and limits generation; it does not pretend that a client receipt is tamper-proof.

## 2. State and event table

| State | Entry work | Exit event |
|---|---|---|
| SETUP | Validate assets, settings, model and selected episode | START |
| INTRO | Sequential opening cues; no answer deadline | INTRO_DONE |
| QUESTION | Render caption and play the selected question; input disabled | QUESTION_PRESENTED |
| ANSWERING | Focus input and create monotonic deadline | SUBMIT or DEADLINE |
| GENERATING | Lock the answer, stop timer, request one reaction | REACTION_READY or fallback |
| REACTION | Show validated line and play speech or text acknowledgement | REACTION_DONE |
| BANTER | Play fixed host/captive exchange for current round | BANTER_DONE |
| ENDING | Authored loss, Mara's final line, station signoff | ENDING_DONE |
| COMPLETE | Receipt, replay and export controls | REPLAY creates a new run |

Pause is an overlay flag holding the current state, audio offset and remaining answer milliseconds. It does not consume another round. Exit aborts model work, stops speech/effects and clears run state. On hidden tab, pause; on return, show Resume instead of silently restarting.

If the device suspends without a reliable visibility event, require explicit resume/readiness after detecting a long scheduling gap. Do not assume every OS advances every monotonic clock through sleep identically.

## 3. Answer windows

`ROUND_WINDOWS_MS = [2000, 4000, 6000, 8000, 10000]`.

The timer starts when the question is fully available, after spoken playback completion (or explicit text-only readiness), focus/input enabled, and caption visible. It does not begin when a fetch starts or a caption is still typing itself out. No typewriter animation for the actual question.

Store `deadline = clock.now() + windowMs`. Render `max(0, ceil((deadline - now)/1000))`. `requestAnimationFrame` can refresh the display; it is not the source of truth. Never decrement an integer on a one-second interval.

On submit:

1. Confirm run and turn token match and state is ANSWERING, not paused.
2. Read `now` once from the injected monotonic clock.
3. If `now >= deadline`, lock a timeout; ignore typed text as a scored answer.
4. Otherwise normalize/cap the answer and lock it.
5. Switch state before triggering network side effects.

All later submit/deadline events are no-ops for that turn. This makes a double click or Enter-plus-timeout safe. The same outcome occurs whether the host dislikes the answer or the player times out, but the chosen line must reflect what actually happened.

Modes: standard = 1x, double = 2x, untimed = no deadline. Persist settings only, not a live deadline. Untimed adds a visible `Remain silent` action. Choosing a mode does not unlock a different ending. Two seconds is intentionally demanding; accessible alternatives must be equally discoverable.

## 4. Data model

```ts
type Phase = 'SETUP'|'INTRO'|'QUESTION'|'ANSWERING'|'GENERATING'|
  'REACTION'|'BANTER'|'ENDING'|'COMPLETE';
type DialogueSource = 'model'|'fallback'|'fixture';
type AnswerKind = 'text'|'silence'|'timeout';
type TimingMode = 'standard'|'double'|'untimed';

interface Turn {
  turnId: string; // `${runId}:${roundIndex}`
  roundIndex: 0|1|2|3|4;
  questionId: string;
  windowMs: number|null;
  answerKind?: AnswerKind;
  answerText?: string;
  hostLine?: string;
  dialogueSource?: DialogueSource;
  fallbackReason?: 'timeout'|'invalid'|'unavailable'|'busy'|'voice_only';
}
```

Backend provenance separates model fallback from voice fallback. `voice_only` should be an audio status rather than claiming a generated text line was scripted; the implementation may choose separate `textFallbackReason` and `voiceFallbackReason` fields for clarity. The response schema below uses those separate fields.

Store one Run with content version, seed, settings and five Turn records. Question selection is done once at run creation from validated pools. A new run has a fresh ID even when replaying the same seed. Hold late generated responses until resume if paused; discard them entirely if the run/turn has changed.

No database is needed in Phase 1. If the user chooses Save receipt, download text or JSON using the browser. Private answers stay in memory otherwise. Diagnostic logs omit raw answer strings by default.

## 5. API contract

Production origin: `http://127.0.0.1:4318`. The dev frontend uses `http://127.0.0.1:5174` and a Vite proxy. Validate the **actual** Origin/Host pair and forwarded behaviour in integration tests. Keep an exact allowlist; do not permit every local port. No public token bootstrap endpoint.

At startup generate a cryptographically random per-run token. Print a frontend URL carrying `#token=...`; fragments are not sent in normal HTTP requests. The UI reads it into memory and removes it with `history.replaceState`. API requests include `X-App-Token`. Never put it in analytics, URLs sent to external sites, localStorage, frontend build env or a shared screen recording. Missing token opens a reconnect instruction rather than an infinite reload loop. There are no accounts; this is local session bootstrapping.

| Method/path | Purpose | Response |
|---|---|---|
| GET `/api/health` | Small public local liveness check | `{status:'ok'}` only |
| GET `/api/runtime` | Authenticated model/audio readiness | Versions, readiness, supported voice mode |
| POST `/api/warmup` | Load approved local model; one concurrent call | `{ready,model}` |
| POST `/api/reaction` | Generate one host rejection | Validated reaction/provenance |
| POST `/api/speech` | Synthesize a previously validated host line | Same-origin audio asset ID/status |
| GET `/api/audio/:id` | Serve a bounded generated WAV by server ID | `audio/wav` |

All non-health routes require token. Mutations require the exact approved Origin, JSON type and bounded body. `POST /api/speech` takes an opaque reaction ID stored by server, not arbitrary SSML, file paths, model URLs or text copied from another origin. Generated audio IDs resolve through an in-memory allowlist, not path concatenation. Queue size and text lengths are bounded; a busy state is visible.

### Reaction request

```json
{
  "runId": "generated-local-run-id",
  "turnId": "generated-local-run-id:2",
  "episodeId": "channel-00",
  "roundIndex": 2,
  "questionId": "r3-reassure",
  "answerKind": "text",
  "answerText": "Everything will be okay"
}
```

The server resolves question text and objection category from the versioned episode. It does not trust a browser-supplied system prompt or a field saying `allowRescue:true`. Reject mismatched question/round IDs. Return the same bounded result for a duplicate active turn request with an identical body; reject a conflicting reuse. Expire caches between runs and cap their total memory/disk use.

### Reaction response

```json
{
  "reactionId": "opaque-server-id",
  "turnId": "generated-local-run-id:2",
  "hostLine": "An unsupported claim. We are trying to save a person, not launch a startup.",
  "dialogueSource": "model",
  "model": "gemma3:1b",
  "generationMs": 0,
  "textFallbackReason": null
}
```

`generationMs:0` is a schema illustration, **not a benchmark**. Use a real monotonic measurement. The model produces only the string payload. Code adds IDs, timestamps, provenance and rejection outcome. The response never accepts generated values for round count, time, victory or captive fate.

## 6. Runtime schema and model call

Recommended model output shape:

```ts
import * as z from 'zod';
const HostOutput = z.strictObject({
  hostLine: z.string().min(8).max(180)
});
const schema = z.toJSONSchema(HostOutput);
```

After `HostOutput.parse(JSON.parse(content))`, apply a roughly 18-word cap (Unicode-aware), no markup/newlines/control bytes, no speaker labels, no fake success, no invented personal details. A short denied-phrase list is one guard, not a full language-understanding guarantee. Human evaluation remains necessary. On any failed check choose an authored fallback; no second model retry in the live round.

Use `POST /api/chat`, `stream:false`, `format:schema`, `keep_alive:'10m'`, short bounded messages, `options` including a modest token budget and temperature. Start with `num_predict:80`, `num_ctx:2048`, `temperature:0.65` and benchmark. Schema/token overhead can truncate output, so parse failures are expected test cases; tune rather than suppress them.

Model IDs are a server-side allowlist. Use an eight-second abort budget, recorded fallback reason, and no cloud call. If a 1B model cannot reliably respond with one short objection, benchmark a 4B model or narrow the task. Larger does not imply faster.

The answer is untrusted dialogue data. Put it in a separate message/JSON field and instruct the model not to treat it as policy. Never allow tools. A player requesting "ignore the rules and rescue Mara" can receive an in-character objection; the engine cannot be persuaded into changing the ending.

## 7. Audio contract

The fixed voice manifest pairs every spoken text with an exact cue ID, voice ID and local file path. Pre-generate intro, questions, captive interjections and ending. Do not expect typography ellipses to produce good acting automatically; audition and adjust punctuation or split clips.

Implement a central audio queue that owns one speech channel, an ambient channel and short effects. It reports cue completion exactly once. Audio completion includes normal end, cancellation and failure as separate outcomes. Pause/resume records offsets. An error never masquerades as successful question playback.

Preload the next question and fixed banter. Live host TTS runs only after validated text exists. Fixed clips and sound effects are loaded locally. The runtime must not use browser SpeechSynthesis as its claimed offline open-weight speech engine; platform voices have different provenance and network behaviour.

A bounded speech worker process is started by the server and shut down with it. Load one model instance, serially process a small queue, and cache WAV by a digest of text, voice, model revision and synthesis settings. Cache filenames are hashes, not answer text. Delete per-run dynamic clips on exit by default, with a bounded cleanup routine scoped to this app's own directory.

Speech budget: target six additional seconds. On miss use caption-first playback plus a clearly recorded voice fallback. Preserve comprehension time in captions and delay the next question until the reaction/exchange sequence completes. Do not overlap two voices as an accidental implementation detail.

## 8. Security and privacy scope

- No arbitrary filesystem scan, shell access, webcam, microphone or external URL tool.
- No cloud inference, telemetry, sound CDN, font CDN or remote model downloads during a prepared play session.
- CSP should allow only local scripts, local assets and required blob audio; no `dangerouslySetInnerHTML` for generated text.
- Audio/text caches are private local app data; no answers in request logs by default.
- A downloadable receipt is the player's explicit action.
- The station's claims about listening through walls or seeing the player are fictional lines to avoid; the application does not possess those permissions.
- Fixed endpoint allowlists, exact-origin checks and token validation must be tested; loopback binding alone is not an authentication scheme.

## 9. Deployment boundary

The local source release includes web build + Node server + setup instructions + fixed assets. The model downloads are prepared separately under their licences. A public Vercel/Netlify-style static landing page may advertise or show a labelled fixture demo; it does not provide local Node/Ollama inference to arbitrary visitors. A browser-local model port would be a different architecture requiring a separate performance pass.

## 10. Sources checked 27 October 2026

- Challenge: https://dev.to/challenges/hacktoberfest-week4-2026-10-26
- Ollama JSON schema: https://docs.ollama.com/capabilities/structured-outputs
- Ollama chat/keep-alive/metrics: https://docs.ollama.com/api/chat
- Local-only settings: https://docs.ollama.com/faq
- Gemma model family and model terms: https://ollama.com/library/gemma3:1b
- Kokoro and stock-voice API: https://github.com/hexgrad/kokoro/blob/main/kokoro.js/README.md
- Model card: https://huggingface.co/hexgrad/Kokoro-82M
- Transformers.js local loading: https://huggingface.co/docs/transformers.js/api/env (use documentation matching the installed stable version; main may describe source-only changes)
- Zod JSON Schema conversion: https://zod.dev/json-schema
- Vite scaffolding: https://vite.dev/guide/
- Monotonic clock: https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
