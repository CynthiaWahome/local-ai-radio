# Pack verification — 27 October 2026

This report concerns the deliverables in this ZIP, not a finished game.

## Checked

- The dependency-free reference engine ran with `node --test reference/engine.test.mjs`: **19 passed, 0 failed**.
- Covered behaviours include five exact windows, boundary-time submissions, duplicate submits, stale turns, pause/resume, double/untimed modes, Unicode truncation and the fixed five-round outcome.
- The voice-preparation utility ran in **dry-run mode only**, listing two proposed clips without downloading a speech model or generating narration.
- Episode JSON has five rounds, 15 distinct authored question IDs and the required 2/4/6/8/10-second windows.
- The preparation manifest contains 61 distinct proposed fixed voice cues.
- SVG files parse and their IDs are unique within each document.
- PNGs open correctly; dimensions are recorded in `artifact-checks.json`.
- Eight supplied WAV effects have valid 48kHz mono 16-bit PCM headers and nonzero durations.
- A multi-size ICO and local font files with their notice are included.
- Intended text/background token pairs exceed 4.5:1 contrast. This is a palette check, not full-app accessibility certification.
- The cinematic cover, vector cover, horizontal logo, README banner and UI concept were visually inspected.
- ZIP integrity is checked after packaging.

## Not checked / not delivered

- A complete React/Express app or installed source repository.
- A real Gemma/Ollama inference run, sarcasm quality or measured live-response latency.
- Kokoro package compatibility, narration quality or actual offline speech loading.
- Spoken presenter/captive WAVs. The supplied WAVs are sound effects only.
- Browser playback, mobile keyboard, screen-reader operation or app offline integration.
- Deployment, public repository, published post, DevRelay recording or tester feedback.

The roadmap and test guide define the gates for those future implementation checks. Do not turn them into completed claims in the blog.
