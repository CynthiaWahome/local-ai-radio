<p align="center">
  <img src="public/readme-banner.png" alt="The Last Broadcast" width="100%" />
</p>

<h1 align="center">THE LAST BROADCAST</h1>

<p align="center">
  <strong>An interactive radio nightmare.</strong><br/>
  <em>Bring headphones. And a sense of humor. And maybe a therapist.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-24_LTS-339933?style=for-the-badge&amp;logo=node.js&amp;logoColor=white" alt="Node 24 LTS" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&amp;logo=react&amp;logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&amp;logo=typescript&amp;logoColor=white" alt="TypeScript 5.6" />
  <img src="https://img.shields.io/badge/Express-4-000000?style=for-the-badge&amp;logo=express&amp;logoColor=white" alt="Express 4" />
  <a href="https://ollama.com/"><img src="https://img.shields.io/badge/Ollama-gemma3:1b-000000?style=for-the-badge&amp;logo=ollama&amp;logoColor=white" alt="Ollama gemma3:1b" /></a>
  <img src="https://img.shields.io/badge/Kokoro-local_speech-7A4E91?style=for-the-badge" alt="Kokoro local speech" />
  <img src="https://img.shields.io/badge/Zod-4-3E67B1?style=for-the-badge" alt="Zod 4" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&amp;logo=vite&amp;logoColor=white" alt="Vite 5" />
  <img src="https://img.shields.io/badge/Vitest-2-6E9F18?style=for-the-badge&amp;logo=vitest&amp;logoColor=white" alt="Vitest 2" />
  <img src="https://img.shields.io/badge/Playwright-E2E-2EAD33?style=for-the-badge&amp;logo=playwright&amp;logoColor=white" alt="Playwright E2E" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="MIT license" />
</p>

---

## Overview

On Channel 00, Mara is trapped beyond the signal. The presenter asks five questions, each framed as a chance to save her. Whatever the listener answers, the presenter invents a procedural reason to reject it. Mara exposes the rules behind the broadcast.

The point is local AI: Gemma 3 1B, an open-weight model running through Ollama, performs answer-conditioned improvisation entirely on your machine. Kokoro generates speech locally. After setup, there is no cloud inference, paid voice API, or data leaving the device; network inspection shows zero external runtime requests.

The game can be inspected, its story and voices replaced, and its runtime kept private. Your secrets are safe. The station's aren't.

## Setup

### Clone

```bash
git clone --branch dev --single-branch https://github.com/CynthiaWahome/local-ai-radio.git
cd local-ai-radio
```

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

For the development UI, open the tokenized URL printed by the API server, replacing port `4318` with `5174`. The token is carried in the URL fragment and removed from the address bar after the page loads.

### Production

```bash
npm run build
npm start
```

Open the tokenized `http://127.0.0.1:4318/#token=...` URL printed in your terminal.

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
├── tools/            # Model probe and local checks
├── tests/            # Integration + E2E
└── planning/         # Spec and brand assets (local only)
```

## License

MIT — do what you like, just keep the notice. See [LICENSE](LICENSE).

Built by [wamzii](https://wamzii.com).
