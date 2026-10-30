import React, { useState, useEffect, useCallback, useRef } from 'react';
import { newRun, introDone, questionPresented, submit, expire, receiveReaction, reactionDone, banterDone, endingDone, pause, resume, secondsLeft, type RunState } from '@local-ai-radio/engine';
import { C, btn, page, card } from './styles';

async function playSpeech(text: string, voice: string, token: string | null): Promise<void> {
  if (!token || !text) return;
  try {
    const res = await fetch('/api/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Token': token, 'Origin': window.location.origin },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.status === 'ready' && data.audioId) {
      await new Promise<void>((resolve) => {
        const audio = new Audio(`/api/audio/${data.audioId}?token=${token}`);
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
    }
  } catch (err) {
    console.error('playSpeech error:', err);
  }
}

const silenceBanter: Record<number, Array<{ speaker: string; text: string }>> = {
  0: [
    { speaker: 'captive', text: 'Say something! Please, you cannot just leave me here in silence!' },
    { speaker: 'host', text: 'Quiet defiance is remarkably unhelpful in a containment breach.' },
  ],
  1: [
    { speaker: 'captive', text: 'Why are you staying silent? The lights just went out!' },
    { speaker: 'host', text: 'Conserving power for the transmission. Mara\'s visibility was deemed redundant.' },
  ],
  2: [
    { speaker: 'captive', text: 'Answer them! Whatever they want, just give them words!' },
    { speaker: 'host', text: 'A touching plea. Pity your courage expired alongside your answer window.' },
  ],
  3: [
    { speaker: 'captive', text: 'Something is at the door... listener, please!' },
    { speaker: 'host', text: 'At least your silence provides excellent acoustics for her panic.' },
  ],
  4: [
    { speaker: 'captive', text: 'Do not let them cut the line! Say anything!' },
    { speaker: 'host', text: 'Five seconds of pure silence. The credits are already rolling.' },
  ],
};

const qids = ['r1-colour', 'r2-maths', 'r3-reassure', 'r4-exit', 'r5-final'];

type Screen = 'title' | 'soundcheck' | 'game' | 'receipt' | 'paused';

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [run, setRun] = useState<RunState | null>(null);
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hostLine, setHostLine] = useState<string>('');
  const [questionText, setQuestionText] = useState<string>('');
  const [banterLines, setBanterLines] = useState<Array<{ speaker: string; text: string }>>([]);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [episode, setEpisode] = useState<any>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prologueLines, setPrologueLines] = useState<Array<{ speaker: string; text: string }>>([]);
  const [prologuePlaying, setProloguePlaying] = useState(false);

  const runRef = useRef<RunState | null>(null);
  runRef.current = run;

  const submittingRef = useRef(false);
  const episodeRef = useRef<any>(null);
  episodeRef.current = episode;
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const ambientRef = useRef<HTMLAudioElement | null>(null);

  // Background horror drone ambiance loop
  useEffect(() => {
    if (screen === 'game') {
      if (!ambientRef.current) {
        ambientRef.current = new Audio('/audio/station-bed.wav');
        ambientRef.current.loop = true;
        ambientRef.current.volume = 0.2;
      }
      ambientRef.current.play().catch(() => {});
    } else {
      ambientRef.current?.pause();
    }
    return () => {
      ambientRef.current?.pause();
    };
  }, [screen]);

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/token=([a-f0-9]+)/);
    if (match) {
      setToken(match[1]);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    fetch('/api/episode')
      .then(r => r.json())
      .then(d => setEpisode(d))
      .catch(() => {
        fetch('/content/episode-01.json')
          .then(r => r.json())
          .then(d => setEpisode(d))
          .catch(() => {});
      });
  }, []);

  const playPrologue = useCallback(async () => {
    if (prologuePlaying) return;
    setProloguePlaying(true);
    const introItems: Array<{ speaker: string; text: string }> = episodeRef.current?.intro || [];
    const displayed: Array<{ speaker: string; text: string }> = [];
    for (const item of introItems) {
      displayed.push(item);
      setPrologueLines([...displayed]);
      const voice = item.speaker === 'captive' ? 'am_fenrir' : 'af_nicole';
      if (tokenRef.current) {
        await playSpeech(item.text, voice, tokenRef.current);
      }
    }
    setProloguePlaying(false);
  }, [prologuePlaying]);

  const startRun = useCallback(() => {
    const r = newRun(`run-${Date.now()}`, qids);
    setRun(introDone(r));
    setScreen('game');
    setHostLine('');
    setQuestionText('');
    setBanterLines([]);
    setIsBroadcasting(false);
    setIsSubmitting(false);
    submittingRef.current = false;
  }, []);

  const presentQuestion = useCallback(async (stateOverride?: RunState) => {
    const currentRun = stateOverride || runRef.current;
    if (!currentRun) return;

    const roundIdx = currentRun.round;
    const qid = currentRun.questionIds[roundIdx];
    const roundData = episodeRef.current?.rounds?.[roundIdx];
    const qData = roundData?.questions?.find((q: any) => q.id === qid) || roundData?.questions?.[0];
    const promptText = qData?.prompt || 'State your answer.';

    setQuestionText(promptText);
    setBanterLines([]);
    setHostLine('');
    setIsBroadcasting(true);

    if (tokenRef.current) {
      await playSpeech(promptText, 'af_nicole', tokenRef.current);
    }

    setIsBroadcasting(false);

    // After speech completes, transition engine to ANSWERING and start countdown!
    const answeringRun = questionPresented(currentRun, Date.now());
    setRun(answeringRun);
    setTimeLeft(secondsLeft(answeringRun, Date.now()));
  }, []);

  const processTurn = useCallback(async (currentRun: RunState, answerText: string, isTimeout: boolean) => {
    if (!currentRun) return;
    setIsSubmitting(true);
    submittingRef.current = true;

    const r = isTimeout ? expire(currentRun, Date.now()) : submit(currentRun, answerText, Date.now());
    setRun(r);
    setAnswer('');
    const roundIdx = r.round;

    const isNoAnswer = isTimeout || !answerText.trim();
    const roundData = episodeRef.current?.rounds?.[roundIdx];
    const fallbackNoAnswer = roundData?.timeoutHostLine || 'Silence. A fascinating submission. Unfortunately, the silence department closed at nine.';
    const fallbackGeneral = roundData?.fallbackHostLine || 'An interesting submission. Unfortunately, that is not acceptable.';
    const fallbackLine = isNoAnswer ? fallbackNoAnswer : fallbackGeneral;

    const chosenBanter: Array<{ speaker: string; text: string }> = isNoAnswer
      ? (silenceBanter[roundIdx] || silenceBanter[0])
      : (roundData?.banter || [ { speaker: 'captive', text: 'You never mentioned that rule.' } ]);

    if (!tokenRef.current) {
      const r2 = receiveReaction(r, { hostLine: fallbackLine, dialogueSource: 'fixture' }, `${r.id}:${r.round}`);
      setRun(reactionDone(r2));
      setHostLine(fallbackLine);
      setBanterLines(chosenBanter);
      setTimeout(() => {
        const r3 = banterDone(r2);
        setRun(r3);
        setIsSubmitting(false);
        submittingRef.current = false;
        if (r3.phase === 'QUESTION') {
          presentQuestion(r3);
        } else if (r3.phase === 'ENDING') {
          setRun(endingDone(r3));
          setScreen('receipt');
        }
      }, 1000);
      return;
    }

    try {
      const res = await fetch('/api/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': tokenRef.current, 'Origin': window.location.origin },
        body: JSON.stringify({
          runId: r.id,
          turnId: `${r.id}:${r.round}`,
          episodeId: 'channel-00',
          roundIndex: r.round,
          questionId: r.questionIds[r.round],
          answerKind: isNoAnswer ? (isTimeout ? 'timeout' : 'silence') : 'text',
          answerText: isNoAnswer ? '' : answerText.trim(),
        }),
      });
      const data = await res.json();
      const reactionLine = data.hostLine || fallbackLine;

      const r2 = receiveReaction(r, { hostLine: reactionLine, dialogueSource: data.dialogueSource || 'model' }, `${r.id}:${r.round}`);
      setRun(r2);
      setHostLine(reactionLine);

      // Play rejection tone SFX
      const rejAudio = new Audio('/audio/rejection-tone.wav');
      rejAudio.volume = 0.4;
      rejAudio.play().catch(() => {});

      // 1. Play host reaction audio
      await playSpeech(reactionLine, 'af_nicole', tokenRef.current);

      // 2. Advance to BANTER phase
      const rBanter = reactionDone(r2);
      setRun(rBanter);

      // 3. Play banter dialogue sequentially
      const currentBanter: Array<{ speaker: string; text: string }> = [];
      for (const line of chosenBanter) {
        currentBanter.push(line);
        setBanterLines([...currentBanter]);
        const voice = line.speaker === 'captive' ? 'am_fenrir' : 'af_nicole';
        await playSpeech(line.text, voice, tokenRef.current);
      }

      // 4. Advance from BANTER
      const r3 = banterDone(rBanter);
      setRun(r3);
      setIsSubmitting(false);
      submittingRef.current = false;

      if (r3.phase === 'QUESTION') {
        presentQuestion(r3);
      } else if (r3.phase === 'ENDING') {
        const rEnd = endingDone(r3);
        setRun(rEnd);
        setScreen('receipt');
      }
    } catch {
      const r2 = receiveReaction(r, { hostLine: fallbackLine, dialogueSource: 'fallback' }, `${r.id}:${r.round}`);
      setRun(r2);
      setHostLine(fallbackLine);
      await playSpeech(fallbackLine, 'af_nicole', tokenRef.current);
      const rBanter = reactionDone(r2);
      setRun(rBanter);
      setBanterLines(chosenBanter);
      for (const line of chosenBanter) {
        const voice = line.speaker === 'captive' ? 'am_fenrir' : 'af_nicole';
        await playSpeech(line.text, voice, tokenRef.current);
      }
      const r3 = banterDone(rBanter);
      setRun(r3);
      setIsSubmitting(false);
      submittingRef.current = false;
      if (r3.phase === 'QUESTION') {
        presentQuestion(r3);
      } else if (r3.phase === 'ENDING') {
        const rEnd = endingDone(r3);
        setRun(rEnd);
        setScreen('receipt');
      }
    }
  }, [presentQuestion]);

  // Countdown timer effect
  useEffect(() => {
    if (!run || run.phase !== 'ANSWERING' || run.paused || !run.deadline) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const currentRun = runRef.current;
      if (!currentRun || currentRun.phase !== 'ANSWERING' || currentRun.paused) return;

      const sl = secondsLeft(currentRun, now);
      setTimeLeft(sl);

      if (sl !== null && sl <= 0 && !submittingRef.current) {
        clearInterval(interval);
        processTurn(currentRun, '', true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [run, processTurn]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const currentRun = runRef.current;
    if (!currentRun || currentRun.phase !== 'ANSWERING' || submittingRef.current) return;
    processTurn(currentRun, answer, false);
  }, [answer, processTurn]);

  const handlePause = () => {
    if (!run) return;
    setPausedAt(Date.now());
    setRun(pause(run, Date.now()));
    setScreen('paused');
  };

  const handleResume = () => {
    if (!run || !pausedAt) return;
    setRun(resume(run, Date.now()));
    setPausedAt(null);
    setScreen('game');
  };

  const handleLeave = () => {
    setRun(null);
    setScreen('title');
    setHostLine('');
    setQuestionText('');
    setBanterLines([]);
    setIsBroadcasting(false);
    setIsSubmitting(false);
    submittingRef.current = false;
  };

  if (screen === 'title') {
    return (
      <div style={{ ...page, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
        {/* Station badge */}
        <p style={{ fontFamily: C.mono, fontSize: 11, letterSpacing: '0.25em', color: C.green, marginBottom: 24 }}>
          ◉ CHANNEL 00 &nbsp;·&nbsp; LIVE TRANSMISSION
        </p>

        <h1 style={{ fontFamily: C.sans, fontSize: 'clamp(2.4rem, 6vw, 4rem)', lineHeight: 1.1, margin: 0, letterSpacing: '0.02em' }}>
          THE LAST<br />BROADCAST
        </h1>

        <p style={{ color: C.amber, fontFamily: C.mono, fontSize: 13, marginTop: 12, letterSpacing: '0.1em' }}>
          An interactive radio nightmare
        </p>

        <p style={{ color: C.muted, maxWidth: 440, marginTop: 20, lineHeight: 1.7, fontSize: 15 }}>
          Five questions. Five seconds each. The host remembers everything you type.
          Mara is running out of time. Headphones strongly recommended.
        </p>

        <div style={{ marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setScreen('soundcheck')} style={btn('primary')}>
            ▶ &nbsp;Tune In
          </button>
        </div>

        <p style={{ marginTop: 40, fontFamily: C.mono, fontSize: 11, color: C.border, letterSpacing: '0.15em' }}>
          WAMZILIARY INC · ALL SIGNALS MONITORED
        </p>
      </div>
    );
  }

  if (screen === 'soundcheck') {
    return (
      <div style={page}>
        <p style={{ fontFamily: C.mono, fontSize: 11, letterSpacing: '0.2em', color: C.green, marginBottom: 20 }}>
          ◉ CHANNEL 00 &nbsp;·&nbsp; PROLOGUE
        </p>
        <h2 style={{ fontSize: 22, margin: 0, letterSpacing: '0.04em' }}>Sound Check &amp; Prologue</h2>
        <p style={{ color: C.muted, marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
          Five questions. Five seconds each. Your timer begins strictly after each question finishes.
        </p>

        {prologueLines.length > 0 && (
          <div style={{ ...card, maxHeight: 280, overflowY: 'auto' }}>
            {prologueLines.map((line, idx) => (
              <p key={idx} style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6,
                color: line.speaker === 'captive' ? C.mara : C.amber }}>
                <span style={{ fontFamily: C.mono, fontSize: 11, opacity: 0.7 }}>
                  {line.speaker === 'captive' ? 'MARA' : 'HOST'}&nbsp;—&nbsp;
                </span>
                {line.text}
              </p>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button
            onClick={playPrologue}
            disabled={prologuePlaying}
            style={{ ...btn('secondary'), opacity: prologuePlaying ? 0.5 : 1, cursor: prologuePlaying ? 'not-allowed' : 'pointer' }}
          >
            {prologuePlaying ? '⏳ Broadcasting Prologue…' : '▶ Listen to Prologue'}
          </button>
          <button onClick={startRun} style={btn('primary')}>
            Start Broadcast →
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'paused') {
    return (
      <div style={{ ...page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <p style={{ fontFamily: C.mono, fontSize: 11, letterSpacing: '0.2em', color: C.amber }}>⏸ TRANSMISSION PAUSED</p>
        <h2 style={{ fontSize: 28, margin: '12px 0 8px' }}>Signal Held</h2>
        <p style={{ color: C.muted, fontSize: 14 }}>Your remaining time is preserved. Mara is still waiting.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button onClick={handleResume} style={btn('primary')}>▶ Resume</button>
          <button onClick={handleLeave} style={btn('ghost')}>Leave Station</button>
        </div>
      </div>
    );
  }

  if (screen === 'game' && run && run.phase !== 'COMPLETE') {
    const timedOut = timeLeft !== null && timeLeft <= 0;
    const inputDisabled = isSubmitting || timedOut;

    return (
      <div style={page}>
        {/* Header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 24 }}>
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.green, letterSpacing: '0.2em' }}>
            ◉ CHANNEL 00
          </span>
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.amber, letterSpacing: '0.15em' }}>
            ON AIR
          </span>
          <button onClick={handlePause} style={{ ...btn('ghost'), padding: '6px 14px', fontSize: 12 }}>
            ⏸ Pause
          </button>
        </div>

        {/* Round indicator */}
        <p style={{ fontFamily: C.mono, fontSize: 12, color: C.muted, letterSpacing: '0.1em', marginBottom: 8 }}>
          QUESTION {run.round + 1} / 5
        </p>

        {/* QUESTION phase */}
        {run.phase === 'QUESTION' && (
          <div>
            {questionText && (
              <p style={{ fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', lineHeight: 1.5, marginBottom: 16 }}>
                {questionText}
              </p>
            )}
            <p style={{ color: C.muted, fontStyle: 'italic', fontFamily: C.mono, fontSize: 13 }}>
              {isBroadcasting ? '⣾ Broadcasting question…' : '⣾ Preparing transmission…'}
            </p>
          </div>
        )}

        {/* ANSWERING phase */}
        {run.phase === 'ANSWERING' && (
          <form onSubmit={handleSubmit}>
            {questionText && (
              <p style={{ fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', lineHeight: 1.5, marginBottom: 20 }}>
                {questionText}
              </p>
            )}

            {/* Timer */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontFamily: C.mono,
                  fontSize: 'clamp(2rem, 6vw, 3rem)',
                  color: (timeLeft !== null && timeLeft <= 2) ? '#FF2222' : C.amber,
                  transition: 'color 0.3s',
                  lineHeight: 1,
                }}>
                  {timeLeft ?? '—'}
                </span>
                <span style={{ fontFamily: C.mono, fontSize: 14, color: C.muted }}>sec</span>
              </div>
              <div style={{ marginTop: 8, height: 3, background: C.border, borderRadius: 2, maxWidth: 440 }}>
                <div style={{
                  height: '100%',
                  borderRadius: 2,
                  background: (timeLeft !== null && timeLeft <= 2) ? '#FF2222' : C.amber,
                  width: `${Math.max(0, ((timeLeft ?? 5) / 5) * 100)}%`,
                  transition: 'width 0.1s linear, background 0.3s',
                }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
              <input
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Type your answer…"
                disabled={inputDisabled}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  fontSize: 15,
                  fontFamily: C.sans,
                  background: C.bgInput,
                  border: `1px solid ${C.border}`,
                  borderRadius: 2,
                  color: C.cream,
                  outline: 'none',
                  opacity: inputDisabled ? 0.4 : 1,
                }}
                aria-label="Answer input"
                autoFocus
              />
              <button
                type="submit"
                disabled={inputDisabled}
                style={{ ...btn('primary'), opacity: inputDisabled ? 0.4 : 1, cursor: inputDisabled ? 'not-allowed' : 'pointer' }}
              >
                Send
              </button>
            </div>
          </form>
        )}

        {/* GENERATING */}
        {run.phase === 'GENERATING' && (
          <p style={{ color: C.muted, fontStyle: 'italic', fontFamily: C.mono, fontSize: 13, marginTop: 16 }}>
            ⣾ Transmitting…
          </p>
        )}

        {/* REACTION */}
        {run.phase === 'REACTION' && hostLine && (
          <div style={card}>
            <p style={{ fontFamily: C.mono, fontSize: 11, color: C.amber, letterSpacing: '0.15em', marginBottom: 8 }}>HOST</p>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: C.cream }}>{hostLine}</p>
          </div>
        )}

        {/* BANTER */}
        {run.phase === 'BANTER' && (
          <div style={card}>
            {hostLine && (
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontFamily: C.mono, fontSize: 11, color: C.amber, letterSpacing: '0.15em', marginBottom: 6 }}>HOST</p>
                <p style={{ fontSize: 15, lineHeight: 1.7 }}>{hostLine}</p>
              </div>
            )}
            {banterLines.map((line, idx) => (
              <div key={idx} style={{ marginTop: idx === 0 ? 0 : 14 }}>
                <p style={{ fontFamily: C.mono, fontSize: 11, letterSpacing: '0.15em', marginBottom: 4,
                  color: line.speaker === 'captive' ? C.mara : C.amber }}>
                  {line.speaker === 'captive' ? 'MARA' : 'HOST'}
                </p>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: line.speaker === 'captive' ? C.mara : C.cream }}>
                  {line.text}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ENDING */}
        {run.phase === 'ENDING' && (
          <p style={{ marginTop: 24, color: C.amber, fontFamily: C.mono, letterSpacing: '0.15em' }}>
            — SIGNAL LOST —
          </p>
        )}
      </div>
    );
  }

  // Receipt screen
  const submissions = run?.turns.filter(t => t.answerKind === 'text').length || 0;
  const timeouts = run?.turns.filter(t => t.answerKind === 'timeout').length || 0;
  const silences = run?.turns.filter(t => t.answerKind === 'silence').length || 0;

  return (
    <div style={page}>
      <p style={{ fontFamily: C.mono, fontSize: 11, letterSpacing: '0.2em', color: C.green, marginBottom: 20 }}>
        ◉ CHANNEL 00 &nbsp;·&nbsp; END OF BROADCAST
      </p>

      <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', margin: 0, letterSpacing: '0.04em' }}>
        Transmission Receipt
      </h1>

      <div style={{ ...card, fontFamily: C.mono, fontSize: 14, lineHeight: 2.2, marginTop: 24 }}>
        <p style={{ margin: 0, color: C.muted }}>Questions presented <span style={{ color: C.cream, float: 'right' }}>5</span></p>
        <p style={{ margin: 0, color: C.muted }}>Answers submitted <span style={{ color: C.cream, float: 'right' }}>{submissions}</span></p>
        <p style={{ margin: 0, color: C.muted }}>Timeouts <span style={{ color: C.amber, float: 'right' }}>{timeouts}</span></p>
        <p style={{ margin: 0, color: C.muted }}>Silences <span style={{ color: C.amber, float: 'right' }}>{silences}</span></p>
        <p style={{ margin: '8px 0 0', borderTop: `1px solid ${C.border}`, paddingTop: 8, color: C.muted }}>
          Answers accepted <span style={{ color: C.cream, float: 'right' }}>0</span>
        </p>
        <p style={{ margin: 0, color: C.muted }}>Rules disclosed in advance <span style={{ color: C.cream, float: 'right' }}>0</span></p>
      </div>

      <p style={{ marginTop: 24, color: C.muted, fontSize: 14, lineHeight: 1.7, maxWidth: 440 }}>
        The station was rigged. Your answers were part of the performance.
      </p>

      <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
        <button
          onClick={() => { setRun(null); setScreen('title'); setHostLine(''); setQuestionText(''); setBanterLines([]); }}
          style={btn('primary')}
        >
          ↺ &nbsp;Tune In Again
        </button>
        <button onClick={handleLeave} style={btn('ghost')}>Leave The Station</button>
      </div>
    </div>
  );
}
