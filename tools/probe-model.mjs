const model = process.env.PRESENTER_MODEL || 'gemma3:1b';
const started = performance.now();
try {
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: 'Reply with one short sentence about a radio signal.', stream: false }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`model returned HTTP ${response.status}`);
  const result = await response.json();
  console.log(`${model}: ${Math.round(performance.now() - started)} ms`);
  console.log(result.response?.trim() || '(empty response)');
} catch (error) {
  console.error(`Model probe failed: ${error.message}`);
  process.exitCode = 1;
}
