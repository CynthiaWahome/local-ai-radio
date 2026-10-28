# 01 — Product brief

## 1. The experience

A single-player, local-first, five-round interactive radio nightmare. The listener tunes into Channel 00. A presenter claims five answers can rescue Mara, a person trapped beyond the signal. Each answer is rejected for an invented bureaucratic reason. The listener gradually hears that this has happened before. The broadcast ends; Mara is lost into the fictional dark; the presenter delivers a deliciously petty closing remark.

The experience is intentionally unwinnable. Its pleasure comes from the model reacting to the player's ingenuity, the captive challenging the host, and the listener discovering the rigged format. It is entertainment, not a knowledge test, rescue service or mental-health assessment.

### The promise on the landing screen

> A fictional radio nightmare. Five questions. Type your answers. The station will respond. Headphones recommended; captions always available.

Settings explain timed/untimed play, voice, volume, reduced effects and pause. The opening can conceal the unwinnable twist; the settings/credits can describe the narrative as an intentionally unfair fictional quiz. Avoid claims that a real person is at risk. The ending makes the station's responsibility clear, while keeping the in-character mock guilt trip.

## 2. Why this fits Week 4

The user's supplied challenge invites spooky builds, eerie machine interactions and AI-generated stories. This project interprets the theme as a machine that carries a broadcast which should have ended. The AI is the presenter: it hears a listener's actual text and invents the tailored objection. A prerecorded play cannot respond to arbitrary answers in that way.

The application does not need to borrow religious imagery or cultural rituals. Its horror comes from an abandoned studio, an impossible signal, hostile procedure and a person who controls the rules. The comedy comes from absurd objections, not mocking a culture or a real tragedy.

Read the live challenge page before publication for the actual submission cutoff and partner-category rules. This pack does not promise eligibility or a prize. Use the Week 4 template, not an earlier writing challenge template.

## 3. Who plays

Someone who wants a short, atmospheric horror-comedy interaction on a laptop. They should understand how to participate within the first 20–30 seconds of the authored introduction. That is a design target to measure, not a test result.

An initial completed playthrough may take roughly 3–6 minutes depending on voice lengths and inference latency. Do not put a fixed duration on the public landing page until measured on the declared test machine.

## 4. Non-negotiable rules

1. Exactly five rounds, default windows 2/4/6/8/10 seconds.
2. All answers, timeout and silence lead to an in-world rejection. A model cannot award success.
3. The ending is authored, deterministic and the same narrative outcome in every timing mode.
4. Presenter reactions acknowledge the player's actual answer or refusal, except disclosed runtime fallback cases.
5. Captive interjections are authored and escalate the story; do not ask the small model to manage two protagonists, pacing and ending simultaneously.
6. The countdown starts only once the prompt has been presented. No time is lost to audio, AI work, prefetch or microphone permissions.
7. One accepted answer event per round. Double clicks, Enter, timeout, pause and late responses must not produce two reactions.
8. Captions identify the speaker and display the full spoken line. The player can mute and play with text alone.
9. The gameplay runtime uses local endpoints and locally available assets after explicit setup downloads. No hosted model fallback and no browser voice whose offline provenance is unknown.
10. A demo must show genuine answer-conditioned generation. An all-scripted game is a preview, not the open-AI submission described here.

## 5. Presenter and captive

**The Announcer** is courteous, cruel and utterly certain that procedure is more important than rescue. Sarcasm is precise and dry. His voice stays composed as the situation worsens. He rejects the answer, not the worth of the player.

**Mara** is a fictional adult captive. She begins frightened, becomes incredulous, and eventually recognizes that the station is rigged. She has agency: she challenges the presenter and ultimately tells the listener it was never their fault. The host immediately tries to reclaim the narrative with a trivial final complaint.

The sarcastic closing line is about the submitted words or the station's fake rules: "Somewhere in the dark, someone will remember that you said blue." Do not assert real-world guilt, threaten the listener's loved ones, claim to observe their room or infer private personal traits.

## 6. Scope for the hackathon

### Ship

- One complete English episode with a 3-question pool for each round (15 authored prompts).
- Seeded selection without repeat questions inside a run.
- Five timed typed answers, a pause menu and a replay button.
- A local Gemma presenter adapter with runtime schema validation, an eight-second generation budget and a visible recovery path.
- Local Kokoro speech for fixed content, two stock voices and, if latency permits, live presenter reactions.
- If live TTS misses budget, validated dynamic text remains visible and a brief prerecorded host sting plays. Label this limitation in the post.
- An original analogue radio UI and original procedural sound effects.
- End-of-show receipt and optional local text/JSON export.
- Clean-clone instructions, automated tests, one captioned video and at least one real tester observation.

### Defer

- Voice input, wake words, always-listening microphones, browser notifications.
- A global leaderboard, accounts, payment, public uploads or cloud database.
- Multiple captives, branching endings, generated lore or full freeform conversation.
- Questions from the listener to the presenter during timed rounds. In this episode the presenter asks and the listener answers; freeform typed replies still work. A separate "ask the station" intermission can be a later phase.
- Multiplayer, streaming integrations and a full simulated operating system.
- Arbitrary access to the user's terminal, files, webcam or location.

## 7. Open innovation claim

The local open-weight language model performs the answer-conditioned improvisation. Open-weight speech makes the station speak without a paid voice API. The game can be inspected, its story and voices replaced, and its runtime kept on the player's machine. Initial downloads, hardware and electricity still have costs. Gemma terms, Kokoro model terms and application-source licensing are distinct.

The cover artwork was created during preparation with a separate image-generation tool. That is a design asset, not the open-source AI that qualifies the gameplay. Be explicit about this distinction if discussing tooling.

## 8. Definition of done

A new tester follows the setup instructions, starts the built app, understands the input, completes five rounds, hears/reads the escalating dialogue, reaches the fixed ending, and can replay. Measured evidence confirms correct timers and real local generation. Network inspection after preparation shows no external runtime requests. The supported browser/machine and all fallbacks are recorded.

If live voice is incomplete, describe the build as a captioned local-AI experience with limited speech. If local generation is incomplete, describe it as a narrative prototype. Neither is grounds to invent a completed result.
