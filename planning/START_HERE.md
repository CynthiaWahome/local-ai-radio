# THE LAST BROADCAST — build pack

**Five questions. No acceptable answers.**

Version 1.0 · 27 October 2026 · prepared for the Week 4 Ghost in the Machine challenge.

The Last Broadcast is a local horror-comedy radio experience. A velvet-voiced presenter recruits the listener to rescue a captive through five absurd questions. Every answer is rejected on a sarcastic technicality. The captive protests, the rules unravel, and the station signs off before the rescue succeeds. Code controls the authored ending. An open-weight model invents brief responses to the listener's actual words.

This ZIP is a specification, original content and brand asset pack. It is **not a finished application**. The reference state machine has a small executable test suite; that does not validate the future frontend, AI adapter or audio integration. See `VERIFICATION.md` for what was actually checked.

## Read in this order

1. `docs/01_PRODUCT_BRIEF.md` — what we are making and what counts as done.
2. `docs/02_BUILD_ROADMAP.md` — detailed local setup and implementation gates.
3. `docs/03_TECHNICAL_CONTRACT.md` — state, timing, API, model and audio contracts.
4. `docs/04_EPISODE_SCRIPT.md` — the complete first episode and character direction.
5. `docs/05_UI_UX_GUIDE.md` — screens, typography, visual behaviour and accessibility.
6. `docs/06_TEST_DEMO_RELEASE.md` — meaningful test cases, demo and offline verification.
7. `AGENT_HANDOFF.md` — copy/paste implementation prompts and handoff rules.

The other deliverables:

- `DEV_SUBMISSION_DRAFT.md` — witty, editable challenge post with honest evidence placeholders.
- `content/episode-01.json` — five rounds, question pools, interjections and fallbacks.
- `prompts/presenter-system.txt` — runtime host instructions.
- `reference/` — dependency-free state/timing example and tests; an Ollama probe; a **proposed** Kokoro voice-generation tool that needs integration testing.
- `brand/` — vector and raster logo variants, favicons, covers, palette, font files and design tokens.
- `audio/sfx/` — original synthesized WAV effects, usable locally without a sound CDN.
- `PROGRESS.md` — your place to record completed gates, measured results and the next action.

## The timer, settled

| Round | Answer window | Function |
|---|---:|---|
| 1 | 2 seconds | A deceptively simple opening |
| 2 | 4 seconds | The first moving goalpost |
| 3 | 6 seconds | The captive objects |
| 4 | 8 seconds | The impossible rule becomes obvious |
| 5 | 10 seconds | The final false hope |

Time begins **after the spoken question ends, captions are visible, and the answer box is enabled**. It never runs during model generation, banter or audio buffering. Double-time and untimed modes keep the same story ending. The default intentionally remains 2/4/6/8/10 seconds as requested.

## Give an agent a concrete first task

Copy the pack into a new repository's `planning/` folder, then send:

> Read planning/AGENT_HANDOFF.md and planning/docs/01_PRODUCT_BRIEF.md through 03_TECHNICAL_CONTRACT.md. Start at milestone 0 in the roadmap. Implement the complete deterministic five-round loop with fixture dialogue, typed input, accurate timers and visible captions before connecting live AI. Do not claim the game is ready until the listed gates have evidence. Update PROGRESS.md after each milestone.

Do not upload model weights, personal test answers, generated run caches or local tokens into the public repository. Brand and story files in this pack are intended to be committed.

## Our editorial promise

The presenter is unfair; the software is reliable. The station can lie in character. The interface must accurately show controls, answer windows, pause state, error state and which model work actually ran.
