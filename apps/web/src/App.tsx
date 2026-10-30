import React, { useState, useEffect, useCallback, useRef } from 'react';
import { newRun, introDone, questionPresented, submit, expire, receiveReaction, reactionDone, banterDone, endingDone, pause, resume, secondsLeft, type RunState } from '@local-ai-radio/engine';

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
      <div style={{ padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh', fontFamily: 'DejaVu Sans, sans-serif' }}>
        <h1 style={{ fontFamily: 'DejaVu Sans Bold, sans-serif' }}>THE LAST BROADCAST</h1>
        <p>An interactive radio nightmare</p>
        <p style={{ color: '#B6B1A8', maxWidth: 480 }}>Type your answers. The broadcast responds. Headphones recommended; captions always available.</p>
        <button onClick={() => setScreen('soundcheck')} style={{ padding: '12px 24px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer', marginTop: 16 }}>Tune in</button>
      </div>
    );
  }

  if (screen === 'soundcheck') {
    return (
      <div style={{ padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh', fontFamily: 'DejaVu Sans, sans-serif', maxWidth: 800 }}>
        <h2>Prologue & Sound Check</h2>
        <p style={{ color: '#B6B1A8' }}>Five questions. Five seconds each. Your timer begins strictly after each question finishes.</p>

        {prologueLines.length > 0 && (
          <div style={{ marginTop: 16, background: '#16191E', padding: 16, borderRadius: 4, maxHeight: 300, overflowY: 'auto' }}>
            {prologueLines.map((line, idx) => (
              <p key={idx} style={{ marginTop: 8, color: line.speaker === 'captive' ? '#B6B1A8' : '#FF665A' }}>
                <strong>{line.speaker === 'captive' ? 'Mara' : 'Host'}:</strong> {line.text}
              </p>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button
            onClick={playPrologue}
            disabled={prologuePlaying}
            style={{ padding: '12px 24px', background: '#262B32', color: '#F2E8D5', border: 'none', cursor: prologuePlaying ? 'not-allowed' : 'pointer' }}
          >
            {prologuePlaying ? 'Broadcasting Prologue...' : 'Listen to Prologue'}
          </button>
          <button
            onClick={startRun}
            style={{ padding: '12px 24px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}
          >
            Start Broadcast
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'paused') {
    return (
      <div style={{ padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh', fontFamily: 'DejaVu Sans, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2>Paused</h2>
        <p>Broadcast paused. Time preserved.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={handleResume} style={{ padding: '12px 24px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Resume</button>
          <button onClick={handleLeave} style={{ padding: '12px 24px', background: '#262B32', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Leave station</button>
        </div>
      </div>
    );
  }

  if (screen === 'game' && run && run.phase !== 'COMPLETE') {
    return (
      <div style={{ padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh', fontFamily: 'DejaVu Sans, sans-serif', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
          <span style={{ fontFamily: 'DejaVu Sans Mono, monospace', color: '#B8D7B0' }}>Channel 00</span>
          <span style={{ fontFamily: 'DejaVu Sans Mono, monospace', fontSize: 12, color: '#B6B1A8', letterSpacing: 2 }}>◉ ON AIR</span>
          <button onClick={handlePause} style={{ padding: '8px 16px', background: '#262B32', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Pause</button>
        </div>

        {run.phase === 'QUESTION' && (
          <div style={{ marginTop: 16 }}>
            <p>Question {run.round + 1} of 5</p>
            {questionText && <p style={{ fontSize: 20, marginTop: 8 }}>{questionText}</p>}
            <p style={{ color: '#B6B1A8', fontStyle: 'italic', marginTop: 8 }}>
              {isBroadcasting ? 'Broadcasting question...' : 'Preparing transmission...'}
            </p>
          </div>
        )}

        {run.phase === 'ANSWERING' && (
          <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
            <p>Question {run.round + 1} of 5</p>
            {questionText && <p style={{ fontSize: 20, marginTop: 8 }}>{questionText}</p>}
            <p style={{ fontSize: 32, fontFamily: 'DejaVu Sans Mono, monospace', color: '#FF665A' }}>Time: {timeLeft ?? '—'}s</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Type your answer"
                disabled={isSubmitting || (timeLeft !== null && timeLeft <= 0)}
                style={{ padding: 8, fontSize: 16, flex: 1, maxWidth: 400 }}
                aria-label="Answer input"
                autoFocus
              />
              <button
                type="submit"
                disabled={isSubmitting || (timeLeft !== null && timeLeft <= 0)}
                style={{ padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}
              >
                Submit
              </button>
            </div>
          </form>
        )}

        {run.phase === 'GENERATING' && <p style={{ marginTop: 16 }}>Transmitting...</p>}

        {run.phase === 'REACTION' && hostLine && (
          <p style={{ marginTop: 16 }}><strong style={{ color: '#FF665A' }}>Host:</strong> {hostLine}</p>
        )}

        {run.phase === 'BANTER' && (
          <div style={{ marginTop: 16 }}>
            {hostLine && <p style={{ marginBottom: 8 }}><strong style={{ color: '#FF665A' }}>Host:</strong> {hostLine}</p>}
            {banterLines.map((line, idx) => (
              <p key={idx} style={{ marginTop: 8, color: line.speaker === 'captive' ? '#B6B1A8' : '#FF665A' }}>
                <strong>{line.speaker === 'captive' ? 'Mara' : 'Host'}:</strong> {line.text}
              </p>
            ))}
          </div>
        )}

        {run.phase === 'ENDING' && <p style={{ marginTop: 16, color: '#FF665A' }}>Signal lost.</p>}
      </div>
    );
  }

  // Receipt screen (shown by default upon completion or on receipt screen)
  const submissions = run?.turns.filter(t => t.answerKind === 'text').length || 0;
  const timeouts = run?.turns.filter(t => t.answerKind === 'timeout').length || 0;
  const silences = run?.turns.filter(t => t.answerKind === 'silence').length || 0;

  return (
    <div style={{ padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh', fontFamily: 'DejaVu Sans, sans-serif', maxWidth: 960, margin: '0 auto' }}>
      <h1>Transmission Receipt</h1>
      <div style={{ fontFamily: 'DejaVu Sans Mono, monospace', marginTop: 16, lineHeight: 2 }}>
        <p>Questions presented: 5</p>
        <p>Answers submitted: {submissions}</p>
        <p>Timeouts: {timeouts}</p>
        <p>Silences: {silences}</p>
        <p>Answers accepted: 0</p>
        <p>Rules disclosed in advance: 0</p>
      </div>
      <p style={{ marginTop: 16, color: '#B6B1A8' }}>The station was rigged. Your answers were part of the performance.</p>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={() => { setRun(null); setScreen('title'); setHostLine(''); setQuestionText(''); setBanterLines([]); }} style={{ padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Tune in again</button>
        <button onClick={handleLeave} style={{ padding: '8px 16px', background: '#262B32', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Leave the station</button>
      </div>
    </div>
  );
}
