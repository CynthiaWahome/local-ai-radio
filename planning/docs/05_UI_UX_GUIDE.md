# 05 — UI/UX and frontend guide

## 1. Visual idea

An abandoned broadcast studio translated into a precise, modern interface. Near-black surfaces, warm ivory type, red live indicators, dim phosphor green for technical readouts. Analogue texture belongs in the cabinet, artwork and title. Functional text stays sharp and plain.

Working name: **THE LAST BROADCAST**. Descriptor: **An interactive radio nightmare**. Tagline: **Five questions. No acceptable answers.** Channel 00 is the fictional station inside the story.

The supplied brand assets use a vintage microphone enclosed by a broken transmission ring. The title wordmark is condensed with restrained signal cuts. Small icons simplify to the microphone silhouette. Use the symbol as a favicon; a complete three-line title is illegible at 16px.

## 2. Colour and type

| Token | Hex | Use |
|---|---|---|
| Void | `#0B0C0F` | Main background |
| Console | `#171A20` | Cards and radio cabinet |
| Dial | `#262B32` | Borders and secondary surfaces |
| Bone | `#F2E8D5` | Main text and title |
| Ash | `#B6B1A8` | Secondary copy |
| Signal | `#FF665A` | Focus rings, active controls and timer emphasis |
| Oxblood | `#8E2633` | Large button backgrounds with Bone text, atmospheric accents |
| Phosphor | `#B8D7B0` | Runtime ready state and frequency display |

Colour associations are an art-direction choice, not a universal psychological guarantee. The contrast report in `brand/contrast-results.json` checks intended token pairs. It does not establish accessibility for a future application.

Typefaces supplied locally:

- **DejaVu Sans Bold:** display type; supplied wordmarks use compressed, outlined lettering so the title renders consistently.
- **DejaVu Sans:** paragraphs, controls and captions.
- **DejaVu Sans Mono:** timer, frequency, transcript IDs and receipt numbers.

No distressed body font. No all-caps paragraphs. Use tabular numerals for the timer so it does not wobble. Target body 16–18px, captions 20–24px on desktop and at least 18px on small screens; labels 12–14px with adequate contrast. A 2-second first answer window makes clear presentation more important, not less.

## 3. Screens to build

### A. Title / Tune in

- Atmospheric artwork as a background or bounded hero, with a solid dark layer behind any functional text.
- Clear title and short fictional premise.
- Primary `Tune in` button.
- Secondary `Settings` and `How to play`.
- One sentence: `Type your answers. The broadcast responds.`
- An explicit click starts/resumes AudioContext; nothing autoplays before interaction.

Do not show an elaborate fake loading percentage. Setup tasks have real statuses: checking model, preparing fixed audio, ready, missing asset, retry.

### B. Setup / Sound check

Use a simple panel rather than several onboarding pages:

- Play a short test line and let the user set speech/effects volumes.
- Timing: Standard 2/4/6/8/10s, Double time, Untimed.
- Captions on by default; reduced effects option and OS preference support.
- One untimed practice field, Enter to transmit. Practice is not a rescue round.
- A clear local setup error if Ollama/model assets are unavailable.

Before the story, confirm: `Five questions. Your timer begins after each question finishes. Pause is always available.`

### C. On air / Main game

Desktop layout: a focused central panel, maximum width about 960px. Top bar contains station label, state badge and pause/mute controls. Middle contains speaker-labelled captions. Below is the current question, large time readout, answer field and Submit. Bottom contains a small transcript disclosure.

Decorative frequency scale, waveform and cabinet detail support the experience. They cannot push the input out of view. If there is no microphone input, the waveform is explicitly decorative/playback-driven, not falsely claiming to represent the listener's voice.

Suggested component names:

`AppShell`, `TitleScreen`, `RuntimeCheck`, `SoundCheck`, `RadioConsole`, `SpeakerCaption`, `AnswerWindow`, `AnswerComposer`, `TransmissionLog`, `PauseDialog`, `ReceiptScreen`.

The `RadioConsole` subscribes to the engine. It does not own hidden timeout mutations. The `AudioDirector` schedules cues through one queue. The `AnswerComposer` emits events rather than calling the model itself.

### D. Reaction / Banter

- Answer field visibly locked; keep the submitted text available in the transcript.
- Timer reads `Transmission received` or a neutral state rather than continuing to hit zero.
- Generation waiting state uses an atmospheric indicator plus accessible status, not a fake ticking rescue timer.
- Presenter and Mara have persistent speaker labels; distinguish them by text and shape as well as colour.
- Captions appear as complete readable lines. Keep each long enough to understand before moving on.

The first version has no freeform listener-question box. The copy must not promise a conversation feature that is absent. Arbitrary typed answers and challenges are still handled as answers by the model.

### E. Pause

A real modal/dialog with labelled heading, focus containment, Escape behaviour and return focus. Provide Resume, Sound/settings and Leave station. Pause stops answer time and speech/effects; unpause resumes the existing turn. It does not select a new question.

### F. Signal lost / Receipt

Show the final fixed outcome, actual number of submissions/timeouts, zero accepted answers and satirical rule count. The UI clearly separates factual counts from the host's rhetoric. Provide Replay, Save transmission and Exit.

Developer diagnostics can expand to model/version, generated-vs-fallback counts and observed latency. Regular players do not need a stack dump beside the emotional ending.

## 4. Responsive behaviour

At 375px width use one column. Put captions, question, timer and answer above decorative hardware. Use safe viewport units and reserve space for the mobile keyboard; test that focused input is visible. A tablet may use the desktop panel with compressed margins.

Use a consistent spacing scale: 4/8/12/16/24/32/48/64px. Controls target at least 44px comfortable height. Keep input text at 16px or larger. Provide focus-visible outlines in Signal. Avoid hover-only explanations.

## 5. Motion and effects

- One subtle steady static texture, a slow indicator pulse and restrained signal movement.
- No full-screen strobe or rapid flickering text.
- Reduced motion/effects removes static animation, chromatic jitter and meter bounce.
- Functional focus and error states remain visible with effects off.
- Transition duration is brief; never wait for decorative animation before accepting input.

## 6. Accessibility behaviours to test

Full keyboard play, clear Enter submission, visible focus, labelled timer, speaker captions, mute/text-only mode, untimed mode, reduced motion, logical heading order, readable contrast and no colour-only meaning. Screen-reader announcements should identify question/start, submitted/timeout and speaker changes. Do not announce every animation frame or every decimal tick.

Changing timing mode mid-round should be disabled or apply next run; describe this plainly. Pause/settings never silently consume time. A user can leave the fictional predicament without completing it.

## 7. UI honesty

Never claim the software is listening through the microphone, reading the user's files or measuring actual danger. The station can act mysterious through scripted sound and text. Keep real permissions transparent. No hidden download or cloud fallback after Start.

## 8. From concept to implementation

1. Open `brand/banners/ui-concept.png` to understand hierarchy. It is labelled a design concept.
2. Copy `brand/tokens.css` and local font assets into the app. Update relative URLs to their actual location.
3. Build the components with fixture state and semantic HTML.
4. Connect real reducer states and validate input focus/timer behaviour.
5. Add audio; check muted and failed playback paths.
6. Add model output as plain escaped text.
7. Inspect at 1440px, 1024px, 768px and 375px, plus a real mobile keyboard if supported.
8. Record accessibility and integration results, not just visual screenshots.

The guide is a build specification. No Figma file or functioning frontend is included in this pack.
