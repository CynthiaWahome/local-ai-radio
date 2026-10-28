# Agent handoff — The Last Broadcast

## Mission

Build the local five-round horror-comedy radio experience specified in this pack. The listener answers questions to rescue Mara. The presenter rejects every answer with a tailored sarcastic technicality. The captive objects. The station signs off. It is authored interactive fiction, deliberately unwinnable.

## Read first

Read `docs/01_PRODUCT_BRIEF.md`, `02_BUILD_ROADMAP.md` and `03_TECHNICAL_CONTRACT.md` before writing code. Read `04_EPISODE_SCRIPT.md` before changing dialogue and `05_UI_UX_GUIDE.md` before styling. Use `06_TEST_DEMO_RELEASE.md` as acceptance criteria. Read existing repository instructions if present.

## Fixed decisions

- Name: The Last Broadcast. Fictional station: Channel 00.
- Tagline: Five questions. No acceptable answers.
- Five default answer windows: **2, 4, 6, 8, 10 seconds**, in that order.
- Timer starts after the question finishes and the input is usable. No timer during model generation, audio buffering or banter.
- Browser game engine owns state and time; this is local entertainment, not a trusted competitive score system.
- Typed answers first. No microphone permission or voice recognition in Phase 1.
- Exactly one answer/timeout lock per turn, one reaction and one transition. At the deadline, timeout wins.
- Pause, double-time and untimed modes. Same authored ending in every mode.
- AI improvises one short host line. Code decides rejection, round count and final signal loss. Captive interjections are authored.
- React/TypeScript/Vite frontend, local Express adapter, shared Zod 4 contracts, Ollama initial candidate gemma3:1b. Benchmark before changing model. Proposed local Kokoro speech via supervised Node worker.
- No cloud database, accounts, cloud inference fallback, telemetry, runtime CDNs or arbitrary user-file access.
- Serve the built UI and API from the same loopback origin in production. Exact Origin/Host checks and per-run token; no unauthenticated bootstrap token endpoint.
- The supplied art and reference code do not mean the application has been implemented.

## Start with this task

> Inspect the repository, list any existing implementation and instructions, and read this pack. Implement milestones 0–2: valid workspace scaffolding and a complete deterministic five-round UI with fixture reactions, captions, exact timers, pause, replay and final receipt. Include meaningful tests for timeout/submit races and stale turns. Keep fixture mode labelled. Run every documented script you introduce and report actual results. Update PROGRESS.md. Do not begin speculative extra features before this complete path works.

## Then connect the model

> Implement milestone 3 with the constrained presenter prompt, strict runtime schema, server-resolved question IDs, an eight-second generation budget, per-turn idempotency and stale-result cancellation. Return provenance for real model versus authored fallback. The model cannot modify the clock, state, ending or filesystem. Add route integration tests, then run and record a real local quality/latency evaluation separately from mocked CI.

## Then make it speak

> Implement milestone 4: pre-generated fixed clips, two stock voices, one audio queue, captions and exact question-completion timing. Run heavy speech in a bounded worker. Prove auxiliary voice/model files are local before claiming offline support. Add live host TTS only within the defined budget; preserve the generated caption on voice fallback. Test autoplay failure, missing audio, pause and exit. Do not use an unverified browser speech voice as the claimed open-weight engine.

## Then release

> Finish the specified UI, clean-clone scripts, tests and offline run. Record a real five-round demonstration. Review the DEV draft against implemented behaviour and fill only observed evidence. Prepare a source release and tester instructions. Do not publish a blog, message testers, push changes, deploy or change repository visibility unless the user authorizes that action.

Local implementation work, tests and reversible edits are within this build task. External publication and person-directed messages are separate actions. This pack does not grant an agent permission to inspect unrelated projects, read secrets or execute story-generated commands.

## Output after each milestone

1. What now works through the real UI.
2. Checks run and their actual result.
3. Remaining failures/limitations.
4. New decisions and why.
5. The next smallest task.

No "production ready" claim from a build alone. No screenshots substituted for interactions. No green tests created by skipping the missing suites. No fabricated generated lines or latency results.

## Sarcasm direction

Be specific and economical. The host is malicious customer service with excellent diction. Rejections target the answer through absurd procedure, not the listener's intelligence, identity or life. Mara is a person with agency in the fiction. Do not make her a second improvising model until the authored episode works.

## Scope-change protocol

If model quality/latency, speech dependencies or offline packaging fail, document the evidence and propose the smallest concrete adjustment. Keep code/story control intact. A captioned model response with limited speech is an honest narrower build; an undisclosed all-scripted fallback is not the promised AI experience.
