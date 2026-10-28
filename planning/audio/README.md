# Original sound effects

Eight local WAV effects are supplied in `sfx/`: station bed, switch click, countdown tick, rejection tone, tuning sweep, signal drop, distant knock and signoff sting. See the manifest for durations and peaks. All are mono 16-bit PCM at 48kHz.

They are deliberately restrained starting points. Start at low gain and audition on actual speakers/headphones. Duck ambience under speech. Crossfade the station-bed loop boundaries instead of assuming the finite noise clip is a perfect seamless loop. Do not repeatedly tick in untimed mode. The answer deadline never depends on an effect finishing.

No spoken narration is included. Use `content/voice-manifest.json` with the proposed local voice-preparation tool, then verify voice quality, timing and offline behaviour. If clips are changed or encoded to smaller formats, regenerate a duration/hash manifest and check caption alignment.
