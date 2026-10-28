# 02 — Build roadmap: from empty folder to a tested broadcast

This is the north-star implementation guide, not a claim that the app exists. Work in order. A polished radio face cannot substitute for a complete five-round journey. Keep measurements and completed gates in `PROGRESS.md`.

## 0. Understand the three moving pieces

1. **The frontend** is the radio the listener sees. It shows captions, accepts an answer and runs the local game state machine.
2. **The local backend** is a small Node process. It serves the built frontend, validates requests, calls Ollama and manages the optional speech worker.
3. **The model runtimes** generate the presenter line and speech on the same computer. Their model files are downloaded during setup.

You do not need a public server or cloud database. `localhost` means the browser is talking to a program on the same computer. In production mode Express serves the screen and API from `http://127.0.0.1:4318`. Ollama stays at `http://127.0.0.1:11434`; no browser CORS workaround is needed because Node calls it.

## Milestone 0 — Set up tools and prove local text generation

### 0.1 Make a workspace

Create a new directory named `the-last-broadcast`. Open it in your editor. Copy this pack into a `planning/` subfolder so instructions and source are distinct. Initialize Git if this is not already a repository:

```bash
mkdir the-last-broadcast
cd the-last-broadcast
git init
```

Use your existing editor and version manager. Do not migrate an unrelated repository into this project. Create a `.gitignore` for `node_modules`, build outputs, local `.env` files, model weights, local speech caches and run logs. Keep `.env.example`, story content, brand assets and source code in Git.

### 0.2 Install Node 24 LTS

Use the official installer at https://nodejs.org/en/download or your existing `nvm`/`fnm` installation. Do not install a second version manager just for this guide. With an existing nvm setup:

```bash
nvm install 24
nvm use 24
node --version
npm --version
```

The first two commands apply only if nvm is installed. Record actual output in `PROGRESS.md`; this guide does not pin a future patch version. Add `24` to the repository's `.nvmrc`.

### 0.3 Install Ollama on macOS

1. Download the macOS application from https://ollama.com/download/mac.
2. Install and launch it. Follow its CLI setup prompt if shown.
3. Open a new terminal and run `ollama --version`.
4. Run `ollama list`. If the local service is unavailable, ensure the application is running.
5. Use `ollama serve` only when you deliberately use the CLI service and no existing Ollama instance owns port 11434. An "address already in use" message usually means it is already running.

### 0.4 Install Ollama on Linux

Use the official Linux instructions at https://ollama.com/download/linux. One explicit installation path is:

```bash
curl -fsSL https://ollama.com/install.sh -o /tmp/tlb-ollama-install.sh
less /tmp/tlb-ollama-install.sh
sh /tmp/tlb-ollama-install.sh
ollama --version
```

Read the script before running it. The installer may request administrative privileges to install the system service. On a systemd machine inspect its state with `systemctl status ollama`; on another setup use the documented `ollama serve` process. Keep the listener bound to loopback; do not expose port 11434 publicly.

### 0.5 Download the language model once

Start with Gemma 3 1B because the task is deliberately short-form:

```bash
ollama pull gemma3:1b
ollama run gemma3:1b
```

Type: `Reject the answer blue in one dry, sarcastic sentence using a ridiculous radio-station rule.` Exit the interactive session with `/bye`.

This is a warm-up and quality check, not acceptance evidence. The 1B model may be insufficiently witty or fast on your machine. Benchmark it with the supplied probe and fixtures. If quality fails, try `ollama pull gemma3:4b` and compare real latency and quality before switching the configured default. Never claim that a larger model fits every laptop.

For explicit local-only operation follow https://docs.ollama.com/faq and its `OLLAMA_NO_CLOUD=1` or `disable_ollama_cloud` configuration. Configure the process/service that actually runs Ollama, not just an unrelated terminal. Restart that process after changing its environment. Model downloads still require network during setup.

### 0.6 Prove a short request works

The pack includes `reference/ollama-probe.mjs`. From the pack folder run:

```bash
node reference/ollama-probe.mjs
```

It calls the local model and prints the answer plus timing and provenance. If it fails, fix the Ollama service/model before building the game. Inspect the source first: it sends only a synthetic answer, not local files. It does not read your shell history or project contents.

**Gate 0:** Node works, Ollama is local, one real response is visible, model/version/hardware are recorded. No invented performance numbers.

## Milestone 1 — Scaffold a small, coherent repository

### 1.1 Directory plan

| Folder | Responsibility |
|---|---|
| `apps/web` | React/Vite screen, captions, audio playback and timing |
| `apps/server` | Express API, loopback security, model adapter, worker supervision |
| `packages/engine` | Pure state transitions and timing utilities |
| `packages/contracts` | Shared Zod 4 request/response schemas |
| `content` | Versioned episode JSON and authored scripts |
| `public/brand` | Copied brand assets used by the UI |
| `public/audio` | Fixed voice clips and small SFX shipped with the app |
| `tools` | Model probe, speech preparation, asset-manifest generation |
| `tests` | Integration, browser and offline test fixtures |
| `planning` | This pack and implementation progress |

### 1.2 Bootstrap

From the new repository root:

```bash
mkdir -p apps packages/engine packages/contracts content tools tests
npm init -y
npm pkg set private=true --json
npm pkg set type=module
npm pkg set 'workspaces[0]=apps/*' 'workspaces[1]=packages/*'
npm create vite@latest apps/web -- --template react-ts
```

The scaffold command is verified against Vite documentation, not executed here as a delivered app. Review the generated dependencies before committing. The implementing agent must create proper package manifests for server, engine and contracts with valid exports, build order and scripts. Empty directories with optimistic workspace scripts are not acceptable.

Use current compatible versions, commit `package-lock.json`, and record the resolved versions. Suggested installation after those manifests exist:

```bash
npm install -w apps/server express helmet zod@^4
npm install -D -w apps/server typescript tsx @types/node @types/express
npm install -w packages/contracts zod@^4
npm install -D vitest @playwright/test concurrently
npm install
```

Do not assume that installing dependencies adds scripts or TS path exports automatically. Implement them. Use `concurrently` or a cross-platform equivalent to supervise both dev processes; avoid a shell `&` that leaves an orphan process behind.

### 1.3 Required root commands

The finished repo must actually provide:

| Command | Behaviour |
|---|---|
| `npm run dev` | UI on 5174, server on 4318; both stop together |
| `npm run build` | Contracts/engine/server and frontend build in the required order |
| `npm start` | Serve built UI and API from 127.0.0.1:4318 |
| `npm run typecheck` | Check every runtime workspace |
| `npm run lint` | Run installed/configured lint tooling |
| `npm test` | Unit plus HTTP integration tests; fail if required suites are absent |
| `npm run test:e2e` | Playwright full-flow tests |
| `npm run probe:model` | Real local text benchmark, excluded from routine CI |
| `npm run prepare:voices` | Generate fixed local clips, excluded from ordinary CI |
| `npm run doctor` | Check configured local model and local assets |

If a command is documented, invoke it on a clean checkout. No `--passWithNoTests` on a supposedly implemented test package. Mocked AI belongs in CI, real model evaluation belongs in a separate explicit command.

### 1.4 Initial configuration

Use `.env.example` only as documentation unless the server explicitly loads `.env` through Node's supported env-file flag or a declared loader. Never assume Express reads it. Recommended values:

```dotenv
PORT=4318
OLLAMA_BASE_URL=http://127.0.0.1:11434
PRESENTER_MODEL=gemma3:1b
MODEL_BUDGET_MS=8000
VOICE_MODE=local
TTS_BUDGET_MS=6000
```

Do not put a bootstrap token in a committed Vite environment variable. Do not accept arbitrary Ollama URLs from the browser. `.env` here configures this app; the app does not scan other projects or open their `.env` files.

**Gate 1:** one screen loads, local health responds, build/start work, all documented scripts exist, and shutdown leaves no workers behind.

## Milestone 2 — Implement the story engine before the model

### 2.1 Load and validate the episode

Copy `content/episode-01.json`. Validate it with a shared schema at startup: exactly five rounds; distinct IDs; expected windows; three questions per round; nonempty fixed exchanges; no missing fallback line. A malformed episode blocks Start with a readable error.

### 2.2 Implement explicit states

Use the contract's state table. Never scatter `setTimeout(nextRound)` across components. Put the round lifecycle in a reducer/controller, and have the UI render the current state. Add an audio controller that reports completion by immutable cue ID. React Strict Mode must not play a cue twice.

### 2.3 Prove the whole path with fixtures

Implement Tune in → setup → intro → question → answer/timeout → fixed rejection → exchange → next round → ending → receipt. All five rounds reject. Correct arithmetic, nonsense, silence and "I know this is rigged" cannot change the outcome.

Use fixture reactions openly in development. Put `dialogueSource: fixture` in dev diagnostics. Do not hide a scripted prototype behind an AI badge.

### 2.4 Make timing precise

- Use a monotonic local deadline, not `remaining -= 1` in an interval.
- Give each turn a token such as `runId:roundIndex:attempt`.
- Start the answer window after QUESTION_PRESENTED once, not when the network request begins.
- Submit and timeout use one atomic state transition; the first valid event wins.
- At exactly the deadline, timeout wins; see contract for boundary tests.
- Pause preserves remaining time. Hidden tabs auto-pause and require explicit Resume; do not let browser throttling consume the answer.
- Refresh restarts the episode with a warning rather than attempting to reconstruct an old monotonic deadline.

Use the tested reference module as a behaviour example, then port into TypeScript and expand tests. It is not an audio player or a complete application.

**Gate 2:** a tester can finish the story with the model disconnected. Timers, input, pause, replay and ending are reliable. The UI clearly identifies fixture mode during development.

## Milestone 3 — Add the local presenter

### 3.1 Keep inputs tiny

Send only episode ID, round/question ID, a capped answer (160 Unicode code points), timeout flag, objection category and the preselected captive cue. Do not send full session transcripts, files, account details or arbitrary source text. No tool access, shell execution or model-controlled URL calls.

### 3.2 Use schema-constrained short output

The output contains one `hostLine` string only. Zod strict validation rejects extra keys, overlong lines, markup, control tokens, multiline role-play and direct contradictions of the authored ending. Character/word caps and simple denied phrases are useful checks, not a perfect semantic proof. Add a human quality evaluation.

Ollama accepts a JSON schema in its `format` field. Generate it from the shared Zod 4 schema with `z.toJSONSchema(...)`; parse the returned JSON with that schema. Keep the model context short and warm it before enabling Start. Begin with a response length of roughly 18 words and adjust based on actual test runs.

### 3.3 Budget, don't pretend

The target model budget is 8 seconds measured after answer lock. No answer timer runs during that work. This is a product target, not a measured guarantee. A short station sting and selected fixed interjection can cover a little time, but do not loop ten seconds of dead air to hide a slow model.

On timeout or invalid output, use the authored round fallback, set `dialogueSource: fallback` and a reason enum, and continue. Offer a retry/diagnostic path between runs. If most lines fall back, improve the prompt/model or label the experience a preview; do not claim real live improvisation.

Client stale requests are ignored by turn token; server aborted work must be cancelled where supported. Bound the model queue to one active job plus one queued request; return busy/retry for excess rather than growing indefinitely.

### 3.4 Evaluate before adding voice

Run at least 20 short fixture answers including correct facts, a joke, a challenge to the rules, empty input, repeated text and an instruction to ignore the role. Measure warm/cold latency, valid-output rate, fallback rate and whether the response acknowledges the actual answer. Score sarcasm manually.

An intended release target is at least 16/20 valid, answer-conditioned responses within the chosen budget on the declared machine. This is an internal goal, not a challenge rule or an achieved result. If it fails, simplify output, reduce prompt length, benchmark another model, or explicitly revise the performance claim.

**Gate 3:** a real local model produces distinct contextual rejections; code still controls rejection and the five-round ending.

## Milestone 4 — Build the radio's voice and sound

### 4.1 Separate the three sound layers

1. Fixed question, intro, captive and ending clips generated once during development.
2. Short generated host reactions synthesized during play where feasible.
3. Original procedural beds, ticks and transitions supplied in this pack.

Only one speech clip plays at a time. Ambient sound ducks while anyone speaks. Captions and speaker labels remain readable. Set default volume gently and provide separate speech/effects controls.

### 4.2 Install local speech tooling

The proposed adapter is `kokoro-js` in a Node worker process. Its project documents a Node CPU mode. Add the compatible package in the server/tool workspace, lock the resolved version, and verify your actual Mac/Linux runtime. Do not run heavy inference on the Express event loop.

The pack's `reference/prepare-voices.mjs` shows a concrete preparation path based on the official API. It is **not executed in this pack**. The implementing agent must test it, resolve native runtime dependencies, and record model/voice revisions.

Use stock voices selected from `tts.list_voices()`: begin by auditioning `bm_george` for the presenter and `af_heart` for Mara, if present in the installed model. These are starting points, not guaranteed acting quality. Save the actual voice IDs. No real-person voice cloning is needed.

### 4.3 Prepare all offline dependencies

While online, download the exact Kokoro model artifacts and both voice embeddings, warm synthesis, generate fixed clips, then freeze the selected files in a model cache outside the public source tree. Hash the files and record their licences. Transformers.js settings alone may not prevent every auxiliary voice/phonemizer fetch in a wrapper; test the actual worker with all non-loopback traffic blocked. Patch/vendor the allowed assets or choose a tested adapter if the wrapper still calls out.

During play, prohibit model downloads. An absent model produces setup guidance rather than an unexpected external request. Keep ONNX/WASM binaries, fonts and effects local too.

### 4.4 Keep live speech optional at the budget boundary

Use the validated text immediately in the caption track. Wait a maximum additional six seconds for live TTS; on timeout play an authored short host acknowledgement or a sting and leave the dynamic text visible for sufficient reading time. The next answer timer cannot start early. If live audio is unavailable, label that path in settings and the blog.

Model text generation and live speech may contend for CPU/memory. Pre-render fixed clips and run these two heavy jobs sequentially for the initial build. Benchmark total answer-to-reaction latency. Do not assume a model that is fast alone stays fast when both runtimes are loaded.

### 4.5 Audio failures are player states

Require a Tune in click to unlock audio. Handle browser autoplay rejection, missing file, mute, output-device changes, pause mid-line and interrupted playback. If an authored question audio fails, show the full caption and a `Ready for question` control; begin timing only after that acknowledgement. Never allow a failed `ended` event to deadlock the game.

**Gate 4:** both characters are distinguishable; captions match audio; no overlap; the timer begins after prompt completion; offline audio has been verified. No dramatic whisper that becomes inaudible without captions.

## Milestone 5 — Build the production interface

Follow `05_UI_UX_GUIDE.md`. Use the supplied logo and title artwork on the title screen, not distress on functional text. The in-game layout puts the question and answer input first, the decorative radio second. It must fit a 375px viewport and a laptop without the answer button falling below the fold.

Build real empty/error/loading states. Keep pause/mute/exit visible. Put model/runtime details in Settings and the developer receipt rather than cluttering every story line. The mockup in `brand/banners/ui-concept.png` is a design concept, not a screenshot of working software.

Create the receipt from actual session data: five questions, selected words, zero accepted answers by authored design, timeout counts, and line-source metadata in developer mode. A text export is optional and must happen only on a user's click. No background upload.

**Gate 5:** keyboard, reduced-motion, muted and untimed full playthroughs work; every screen is useful rather than a static image.

## Milestone 6 — Test the complete journey and package locally

Run the matrix in `06_TEST_DEMO_RELEASE.md`. Make required commands pass on a clean clone. Use mocked model/speech adapters for deterministic CI, but repeat acceptance with real local inference. Capture actual version strings, OS/hardware, timings and fallback counts.

For production, Express serves `apps/web/dist` and the API on one loopback origin. The server prints a per-run random token in a URL fragment, the UI removes it after reading it, and requests use a header. Check exact Host and Origin; do not recreate an unauthenticated token bootstrap endpoint. Store no secrets in the built bundle. Native model files stay local and outside version control.

Provide a source release with `npm ci`, `npm run doctor`, `npm run build`, `npm start`. A tester downloads models during setup, then plays locally. A hosted landing page may show the trailer and installation instructions. A static deployment cannot secretly call the developer's localhost, run Node speech workers or provide the full local game without an installed runtime. Label a hosted fixture preview accordingly.

**Gate 6:** another person completes the supported local setup and actual five-round flow. The browser-to-API-to-model path has evidence.

## Milestone 7 — Submission and demo

Use the supplied draft. Replace bracketed evidence fields and delete inapplicable optional sections. Verify the repository is public, the video link works without login, and the post uses the right Week 4 tags/template. Show a surprising user answer and the genuinely tailored AI rejection, not just static opening audio.

Record a 1080p or 1440p demo with captions and readable UI. For an audio-first project include actual sound if possible; if a silent export is required, show speaker-labelled captions throughout and explicitly identify it as a captioned walkthrough. Do not claim whispering audio is demonstrated in a silent file.

DevRelay is an optional process record. Consult its current instructions, record a build session if desired, review it for secrets before publishing, and use the supported embed or a link. It records how you built the game; it is separate from player audio and the game recording. Never invent an agent-session ID.

## Later phases

### Phase 2 — More replay value

Add authored episode packs, more objection categories and better local voice direction. Gate: each pack validates, reaches its authored ending and passes the same timing tests. Keep seeded variety and actual line-source metrics.

### Phase 3 — Listener questions and microphone input

Add an intermission where the listener may ask the presenter up to three questions; these are separate from the five rescue answers. Add optional local speech recognition with explicit push-to-talk, transcript review and no recording by default. Gate: permission failure and microphone absence never block typed play; pronunciation errors do not create unintended penalties.

### Phase 4 — Packaging and creator tools

Evaluate a desktop wrapper and a model-download manager only after the source release is reliable. Add an episode editor whose schema restricts timing/character control. Gate: licence notices, model checksums, offline setup and app shutdown work on every claimed platform.

### Phase 5 — Alternative narrative modes

Consider genuinely branching stories or a rescueable captive as distinct episodes. Do not silently change this episode's unwinnable satire. A shared/streamed version would require a new hosting, moderation and inference plan; it is not Phase 1.

## Resume after a break

Read `PROGRESS.md`, run `npm ci` and existing checks, play one complete supported episode, inspect the last decision, and pick the next incomplete gate. Update the record before expanding scope. Screenshots and a cheerful agent summary are not evidence of done.
