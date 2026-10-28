# Reference materials

This folder is not a complete app scaffold. It isolates a few implementation behaviours so an agent can start from concrete examples.

Run the dependency-free timing/state tests with Node:

```bash
node --test reference/engine.test.mjs
```

Run the real local model probe only after installing Ollama and the selected model:

```bash
node reference/ollama-probe.mjs
```

The voice tool needs `kokoro-js` and runtime/model assets. Its API path follows the linked official documentation but was not integration-tested here. You can inspect its manifest without downloading anything:

```bash
node reference/prepare-voices.mjs --dry-run --limit 2
```

The engine reference begins at INTRO, after setup. A production controller must add runtime readiness, audio ownership, visibility handling, input focus, model cancellation, queueing, content validation and output filtering. The engine test that injects a "You win" string proves only that extra fields cannot control state. A real adapter must also reject that inappropriate dialogue before displaying/speaking it.

When paused during generation, the controller must retain a completed response and deliver it on Resume with the same turn token. The reference returns unchanged state while paused; it does not itself implement that external pending-response buffer.
