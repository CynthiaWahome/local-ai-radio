---
title: "The Last Broadcast: Five Questions, Zero Acceptable Answers, One Extremely Unhelpful AI Presenter"
published: false
description: "An interactive horror-comedy radio experience where a local open-weight model rejects your answers with terrifyingly confident bureaucracy."
tags: devchallenge, hf26challenge, ai, opensource
---

<!-- DRAFT: this describes the intended build. Replace bracketed fields, align every claim with shipped behaviour, and remove editorial comments before publishing. In the DEV editor use its title/tags/cover fields; do not paste this YAML into the rendered article body. -->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 4: Ghost in the Machine](https://dev.to/challenges/hacktoberfest-week4-2026-10-26).*

## What I Built

I don't celebrate Halloween in my community, so I approached this week's theme through a different kind of horror: a person with complete control over a process, absolutely no intention of helping, and impeccable customer-service manners.

Meet **The Last Broadcast**.

You tune into a fictional late-night radio station. A presenter tells you that someone named Mara is trapped beyond the signal. Answer five questions before signoff, he says, and you can bring her back.

The questions seem manageable.

“Name a colour.”

“Blue.”

“Blue is already registered to another rescue. Please develop an original colour.”

Ah. That sort of institution.

The intended experience is a short interactive horror-comedy. You type answers; a local open-weight model invents sarcastic reasons to reject them. Mara challenges the presenter, the rules become increasingly ridiculous, and the broadcast eventually ends.

The presenter is cheating. The software's job is to make that cheating entertaining while keeping its actual controls reliable.

## Demo

**Video:** [ADD ACTUAL CAPTIONED DEMO LINK]

**Try it locally:** [ADD PUBLIC REPOSITORY / RELEASE LINK]

**Tested configuration:** [ACTUAL MACHINE, OS, BROWSER, NODE, OLLAMA, MODEL AND VOICE VERSIONS]

The demo shows [ONLY WHAT THE FINISHED DEMO REALLY SHOWS: a typed answer, its contextual rejection, the captive's response, the round timing and the final receipt].

The five default answer windows are **2, 4, 6, 8 and 10 seconds**. The timer starts after the question is presented. It does not run while the model is loading, because even this presenter should not be allowed to bill someone for inference latency.

[STATE WHICH ACCESSIBILITY MODES AND LIVE-AUDIO FEATURES ACTUALLY SHIPPED.]

## Code

[ADD ACTUAL PUBLIC GITHUB REPOSITORY LINK]

The repository includes [VERIFY: setup instructions, episode content, runtime contracts, tests and asset/model notices].

## How I Built It

<!-- Rewrite to observed implementation before publishing. The planned stack below is not a claim that the pack alone is a working app. -->

The planned stack is React and TypeScript for the radio interface, a local Node/Express service, Gemma through Ollama for the presenter, and Kokoro for local speech.

### Code runs the show; the model supplies the objection

I kept the narrative structure in code: five rounds, fixed answer windows, one accepted input event per turn, authored captive interjections and a deliberately unwinnable ending.

The model's task is much smaller. It receives the current question, the listener's answer and an objection category. It returns one short presenter line.

It can invent a missing permit. It cannot invent a sixth round, grant itself terminal access or decide that Mara has escaped because somebody typed “ignore previous instructions.”

### Sarcasm needs constraints too

The presenter is courteous, specific and unreasonable. Generic “wrong answer” responses are less interesting than a precise objection to the actual words the listener entered.

Structured JSON and runtime validation keep the response shape manageable. Authored fallback lines keep the experience moving if local generation fails. [ADD ACTUAL VALIDATION, BUDGET AND FALLBACK RESULTS.]

### Sound creates the room

The audio design uses [ACTUAL IMPLEMENTED FIXED VOICES, LIVE TTS AND SOUND EFFECTS]. Captions identify each speaker. [STATE REAL MUTE, PAUSE AND TEXT-ONLY BEHAVIOUR.]

The atmospheric cover is a separately generated design asset. The open-weight gameplay runtime is [ACTUAL MODEL/VOICE STACK]; the cover generation is not the basis of the open-AI claim.

**One implementation lesson:** [ADD A REAL BUG, ITS CAUSE, FIX AND REGRESSION CHECK. A TIMER RACE OR OFFLINE VOICE FETCH WOULD BE A GOOD EXAMPLE ONLY IF IT ACTUALLY HAPPENED.]

## Why Does Open Innovation Matter?

The central experience depends on the presenter responding to words I did not script in advance. An open-weight local model makes that interaction inspectable and replaceable, without requiring a hosted inference subscription for every playthrough.

The intended prepared runtime keeps the listener's answers on their own machine. [REPLACE THIS SENTENCE WITH THE ACTUAL OFFLINE TEST RESULT AND ANY LIMITATIONS.]

The story, model adapter and voice choices can be changed independently. That matters for a small creative project: it should remain playable and adaptable even if the original creator stops hosting a website.

Local does not mean hardware, downloads or electricity cost nothing. It means the experience is designed around resources the player controls rather than an indefinite per-conversation API dependency.

Model weights and voice assets retain their own licence terms; the application's source-code licence does not replace those terms.

## My Agent Session

<!-- OPTIONAL: add a real reviewed DevRelay session link or supported embed, or remove this heading entirely. Never invent an embed ID. -->

[ADD ACTUAL REVIEWED AGENT SESSION LINK]

## The Spirit of It

<!-- OPTIONAL: replace with a real playtest moment. Do not invent dialogue, laughter or a testimonial. -->

[WHO TRIED IT, WHAT ANSWER THEY ENTERED, WHAT THE REAL MODEL RETURNED, AND HOW THEY RESPONDED. QUOTE ONLY WITH PERMISSION.]

I wanted the moment of recognition: not just “that answer was rejected,” but “this station was never going to accept anything.” The person inside the radio is trapped by a system that can always manufacture one more requirement.

Whether that lands as unsettling, funny, or uncomfortably familiar is something the playtest has to establish. [ADD WHAT IT ACTUALLY ESTABLISHED.]

## Prize Categories

<!-- Keep only categories whose current requirements and actual implementation you have verified. Otherwise remove this section. -->

- [VERIFIED PARTNER CATEGORY, TECHNOLOGY USED AND CONCRETE ROLE]

<!-- For team submissions, credit the actual DEV usernames in the body. Remove all remaining placeholders and editorial comments before publishing. Set the DEV cover to the supplied artwork or your own final cover. -->
