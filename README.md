<p align="center">
  <img src="public/brand/readme-banner.png" alt="The Last Broadcast" width="100%" />
</p>

<h1 align="center">THE LAST BROADCAST</h1>

<p align="center">
  <strong>An interactive radio nightmare.</strong><br/>
  Five questions. No acceptable answers.<br/>
  <em>Bring headphones. And a sense of humor. And maybe a therapist.</em>
</p>

<p>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node-24_LTS-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://expressjs.com/"><img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" /></a>
  <a href="https://ollama.com/"><img src="https://img.shields.io/badge/Ollama-FF6F00?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  <a href="https://zod.dev/"><img src="https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white" alt="Zod" /></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://vitest.dev/"><img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" /></a>
  <a href="https://playwright.dev/"><img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" /></a>
</p>

---

## Overview

A single-player, local-first, five-round interactive radio nightmare. The listener tunes into Channel 00. A presenter claims five answers can rescue Mara, a person trapped beyond the signal. Each answer is rejected for an invented bureaucratic reason. The listener gradually hears that this has happened before. The broadcast ends; Mara is lost into the fictional dark.

The experience is intentionally unwinnable. Its pleasure comes from the model reacting to the player's ingenuity, the captive challenging the host, and the listener discovering the rigged format. Think of it as a customer service nightmare where the customer is a hostage and the representative is an AI with a god complex and a thesaurus.

The point: a local open-weight model (Gemma 3 1B via Ollama) performs the answer-conditioned improvisation entirely on the player's machine. No cloud inference, no paid voice API, no data leaves the device. The game can be inspected, its story and voices replaced, and its runtime kept private. Network inspection after setup shows zero external runtime requests. Your secrets are safe. The station's aren't.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Local CSS variables, semantic HTML |
| Game Engine | Pure TypeScript reducer + injected clock |
| API | Node 24 LTS + Express + Zod 4 |
| Presenter | Ollama (Gemma 3 1B) — local open-weight model |
| Speech | Kokoro (planned) — local open-weight TTS |
| Fixed Audio | Local WAV + procedural SFX |
| State | In-memory per run; browser export only |
| Tests | Vitest + Supertest + Playwright |
| Docs | Swagger / OpenAPI 3.0 |

## Setup

### Prerequisites

- Node 24 LTS
- Ollama (local)
- Gemma 3 1B model

### Install

```bash
# Pull the model
ollama pull gemma3:1b

# Install dependencies
npm ci

# Start dev server
npm run dev
```

Open `http://127.0.0.1:5174` in your browser.

### Production

```bash
npm run build
npm start
```

Open `http://127.0.0.1:4318` (token printed in console).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | UI on 5174 + API on 4318 |
| `npm run build` | Build all workspaces |
| `npm start` | Serve production build |
| `npm run typecheck` | Type-check all workspaces |
| `npm run lint` | Lint (not yet configured) |
| `npm run test` | Unit + HTTP integration tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run probe:model` | Ollama probe benchmark |
| `npm run doctor` | Check local model and assets |

## API Documentation

Swagger UI available at `http://127.0.0.1:4318/api/docs/` (with app token).

Endpoints:
- `GET /api/health` — liveness check
- `GET /api/runtime` — model/audio readiness
- `POST /api/warmup` — load model
- `POST /api/reaction` — generate host rejection
- `POST /api/speech` — synthesize speech (placeholder)
- `GET /api/audio/:id` — serve audio WAV

## Project Structure

```
├── apps/
│   ├── web/          # React/Vite frontend
│   └── server/       # Express API + Ollama adapter
├── packages/
│   ├── engine/       # Pure state machine + timing
│   └── contracts/    # Shared Zod schemas
├── content/          # Episode JSON + voice manifest
├── prompts/          # Presenter system prompt
├── tools/            # Model probe, voice prep
├── tests/            # Integration + E2E
└── planning/         # Spec and brand assets (local only)
```

## License

[MIT](LICENSE)
