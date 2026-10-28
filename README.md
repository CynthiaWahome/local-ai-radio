# local-ai-radio

The Last Broadcast — a local horror-comedy radio experience.

## Setup
1. Install Node 24+ and Ollama.
2. `ollama pull gemma3:1b`
3. `npm ci`
4. `npm run dev`
5. Open http://127.0.0.1:5174

## Scripts
- `npm run dev` — UI + API
- `npm run build` — build all
- `npm run typecheck` — type check
- `npm run test` — tests
- `npm run probe:model` — Ollama probe

## Debug
- Server logs: `GET /api/debug/logs` (with token)
- API docs: http://127.0.0.1:4318/api/docs/
