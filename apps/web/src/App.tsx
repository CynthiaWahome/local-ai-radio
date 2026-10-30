import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { newRun, introDone, questionPresented, submit, expire, receiveReaction, reactionDone, banterDone, endingDone, pause, resume, secondsLeft, type RunState } from '@local-ai-radio/engine';
import { C, btn, page, card } from './styles';

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
  const [episodeError, setEpisodeError] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prologueLines, setPrologueLines] = useState<Array<{ speaker: string; text: string }>>([]);
  const [prologuePlaying, setProloguePlaying] = useState(false);
  const [endingLines, setEndingLines] = useState<Array<{ speaker: string; text: string }>>([]);
  const [signalLost, setSignalLost] = useState(false);
  const [postCreditsLine, setPostCreditsLine] = useState('');

  const runRef = useRef<RunState | null>(null);
  const submittingRef = useRef(false);
  const episodeRef = useRef<any>(null);
  const tokenRef = useRef<string | null>(null);
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const effectAudioRef = useRef<HTMLAudioElement | null>(null);
  const flowRef = useRef(0);
  const flowAbortRef = useRef(new AbortController());
  const pausedRef = useRef(false);
  const resumeWaitersRef = useRef<Set<() => void>>(new Set());
  const endingTranscriptRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => { runRef.current = run; }, [run]);
  useLayoutEffect(() => { episodeRef.current = episode; }, [episode]);
  useLayoutEffect(() => { tokenRef.current = token; }, [token]);
  useLayoutEffect(() => {
    if (endingTranscriptRef.current) endingTranscriptRef.current.scrollTop = endingTranscriptRef.current.scrollHeight;
  }, [endingLines]);

  const setCurrentRun = useCallback((next: RunState | null) => {
    runRef.current = next;
    setRun(next);
  }, []);

  const isCurrent = useCallback((version: number, id?: string) =>
    flowRef.current === version && (!id || runRef.current?.id === id), []);

  const waitForResume = useCallback(async (version: number) => {
    while (pausedRef.current && isCurrent(version)) {
      await new Promise<void>(resolve => resumeWaitersRef.current.add(resolve));
    }
    return isCurrent(version);
  }, [isCurrent]);

  const waitForBeat = useCallback(async (ms: number, version: number) => {
    let remaining = ms;
    let previous = Date.now();
    while (remaining > 0 && isCurrent(version)) {
      await new Promise(resolve => setTimeout(resolve, Math.min(remaining, 100)));
      const now = Date.now();
      if (!pausedRef.current) remaining -= now - previous;
      previous = now;
    }
    return isCurrent(version);
  }, [isCurrent]);

  const stopCurrentFlow = useCallback(() => {
    flowRef.current += 1;
    flowAbortRef.current.abort();
    flowAbortRef.current = new AbortController();
    for (const audio of [speechAudioRef.current, effectAudioRef.current]) {
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    }
    speechAudioRef.current = null;
    effectAudioRef.current = null;
    ambientRef.current?.pause();
    pausedRef.current = false;
    resumeWaitersRef.current.forEach(resolve => resolve());
    resumeWaitersRef.current.clear();
  }, []);

  const playClip = useCallback((url: string, version: number): Promise<boolean> => {
    if (!isCurrent(version)) return Promise.resolve(false);
    const signal = flowAbortRef.current.signal;
    return new Promise(resolve => {
      const audio = new Audio(url);
      speechAudioRef.current = audio;
      let settled = false;
      const finish = (played: boolean) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        audio.onended = null;
        audio.onerror = null;
        if (speechAudioRef.current === audio) speechAudioRef.current = null;
        resolve(played);
      };
      const abort = () => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        finish(false);
      };
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      signal.addEventListener('abort', abort, { once: true });
      if (!pausedRef.current) audio.play().catch(() => finish(false));
    });
  }, [isCurrent]);

  const playSpeech = useCallback(async (text: string, voice: string, version: number): Promise<boolean> => {
    const currentToken = tokenRef.current;
    if (!currentToken || !text || !isCurrent(version)) return false;
    try {
      const res = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': currentToken },
        body: JSON.stringify({ text, voice }),
        signal: flowAbortRef.current.signal,
      });
      if (!res.ok || !isCurrent(version)) return false;
      const data = await res.json();
      if (data.status !== 'ready' || !data.audioId || !isCurrent(version)) return false;
      return playClip(`/api/audio/${data.audioId}?token=${currentToken}`, version);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') console.error('Speech unavailable:', error);
      return false;
    }
  }, [isCurrent, playClip]);

  const playEffect = useCallback((url: string, version: number) => {
    if (!isCurrent(version)) return;
    const audio = new Audio(url);
    effectAudioRef.current?.pause();
    effectAudioRef.current = audio;
    audio.onended = () => { if (effectAudioRef.current === audio) effectAudioRef.current = null; };
    audio.onerror = () => { if (effectAudioRef.current === audio) effectAudioRef.current = null; };
    if (!pausedRef.current) audio.play().catch(() => {});
  }, [isCurrent]);

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

    const loadEpisode = async () => {
      for (const url of ['/api/episode', '/content/episode-01.json']) {
        try {
          const response = await fetch(url);
          if (!response.ok) continue;
          const data = await response.json();
          if (Array.isArray(data.rounds) && data.rounds.length === 5) {
            setEpisode(data);
            return;
          }
        } catch { /* Try the other local route. */ }
      }
      setEpisodeError(true);
    };
    void loadEpisode();
  }, []);

  const playPrologue = useCallback(async () => {
    if (prologuePlaying || !episodeRef.current) return;
    const version = flowRef.current;
    setProloguePlaying(true);
    const introItems: Array<{ speaker: string; text: string }> = episodeRef.current?.intro || [];
    const displayed: Array<{ speaker: string; text: string }> = [];
    for (const item of introItems) {
      if (!isCurrent(version)) return;
      displayed.push(item);
      setPrologueLines([...displayed]);
      const voice = item.speaker === 'captive' ? 'am_fenrir' : 'af_nicole';
      const played = await playSpeech(item.text, voice, version);
      if (!played && !(await waitForBeat(650, version))) return;
    }
    if (isCurrent(version)) setProloguePlaying(false);
  }, [prologuePlaying, isCurrent, playSpeech, waitForBeat]);

  const presentQuestion = useCallback(async (stateOverride?: RunState) => {
    const currentRun = stateOverride || runRef.current;
    if (!currentRun) return;
    const version = flowRef.current;
    if (!isCurrent(version, currentRun.id)) return;

    const roundIdx = currentRun.round;
    const qid = currentRun.questionIds[roundIdx];
    const roundData = episodeRef.current?.rounds?.[roundIdx];
    const qData = roundData?.questions?.find((q: any) => q.id === qid) || roundData?.questions?.[0];
    const promptText = qData?.prompt || 'State your answer.';

    setQuestionText(promptText);
    setBanterLines([]);
    setHostLine('');
    setIsBroadcasting(true);

    const played = await playSpeech(promptText, 'af_nicole', version);
    if (!played && !(await waitForBeat(650, version))) return;
    if (!(await waitForResume(version)) || !isCurrent(version, currentRun.id)) return;
    setIsBroadcasting(false);

    const answeringRun = questionPresented(runRef.current!, Date.now());
    setCurrentRun(answeringRun);
    setTimeLeft(secondsLeft(answeringRun, Date.now()));
  }, [isCurrent, playSpeech, setCurrentRun, waitForBeat, waitForResume]);

  const startRun = useCallback(() => {
    if (prologuePlaying || !episodeRef.current) return;
    stopCurrentFlow();
    const next = introDone(newRun(`run-${Date.now()}`, qids));
    setCurrentRun(next);
    setScreen('game');
    setAnswer('');
    setTimeLeft(null);
    setHostLine('');
    setQuestionText('');
    setBanterLines([]);
    setEndingLines([]);
    setSignalLost(false);
    setPostCreditsLine('');
    setIsBroadcasting(false);
    setIsSubmitting(false);
    submittingRef.current = false;
    void presentQuestion(next);
  }, [prologuePlaying, presentQuestion, setCurrentRun, stopCurrentFlow]);

  const playEnding = useCallback(async (endingRun: RunState, version: number) => {
    if (!isCurrent(version, endingRun.id)) return;
    const lines: Array<{ speaker: string; text: string }> = episodeRef.current?.ending || [];
    const displayed: Array<{ speaker: string; text: string }> = [];
    setEndingLines([]);
    setSignalLost(false);
    for (const line of lines) {
      if (!(await waitForResume(version)) || !isCurrent(version, endingRun.id)) return;
      displayed.push(line);
      setEndingLines([...displayed]);
      const played = await playSpeech(line.text, line.speaker === 'captive' ? 'am_fenrir' : 'af_nicole', version);
      if (!played && !(await waitForBeat(900, version))) return;
    }
    if (!(await waitForResume(version)) || !isCurrent(version, endingRun.id)) return;
    ambientRef.current?.pause();
    playEffect('/audio/signal-drop.wav', version);
    setSignalLost(true);
    if (!(await waitForBeat(1700, version))) return;
    const complete = endingDone(runRef.current!);
    setCurrentRun(complete);
    setScreen('receipt');
    if (!(await waitForBeat(1200, version))) return;
    const postCredits = episodeRef.current?.postCredits?.text;
    if (postCredits) {
      setPostCreditsLine(postCredits);
      await playSpeech(postCredits, 'af_nicole', version);
    }
  }, [isCurrent, playEffect, playSpeech, setCurrentRun, waitForBeat, waitForResume]);

  const processTurn = useCallback(async (currentRun: RunState, answerText: string, isTimeout: boolean) => {
    const version = flowRef.current;
    if (!isCurrent(version, currentRun.id) || submittingRef.current) return;
    setIsSubmitting(true);
    submittingRef.current = true;

    const r = isTimeout ? expire(currentRun, Date.now()) : submit(currentRun, answerText, Date.now());
    if (r === currentRun) {
      setIsSubmitting(false);
      submittingRef.current = false;
      return;
    }
    setCurrentRun(r);
    setAnswer('');
    const roundIdx = r.round;
    const turn = r.turns[r.turns.length - 1];
    const isNoAnswer = turn.answerKind !== 'text';
    const roundData = episodeRef.current?.rounds?.[roundIdx];
    const fallbackNoAnswer = roundData?.timeoutHostLine || 'Silence. A fascinating submission. Unfortunately, the silence department closed at nine.';
    const fallbackGeneral = roundData?.fallbackHostLine || 'An interesting submission. Unfortunately, that is not acceptable.';
    const fallbackLine = isNoAnswer ? fallbackNoAnswer : fallbackGeneral;
    const chosenBanter: Array<{ speaker: string; text: string }> = isNoAnswer
      ? (silenceBanter[roundIdx] || silenceBanter[0])
      : (roundData?.banter || [ { speaker: 'captive', text: 'You never mentioned that rule.' } ]);

    let reactionLine = fallbackLine;
    let dialogueSource: 'model' | 'fallback' | 'fixture' = tokenRef.current ? 'fallback' : 'fixture';
    try {
      if (tokenRef.current) {
        const res = await fetch('/api/reaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-App-Token': tokenRef.current },
          body: JSON.stringify({
            runId: r.id,
            turnId: turn.turnId,
            episodeId: 'channel-00',
            roundIndex: r.round,
            questionId: turn.questionId,
            answerKind: turn.answerKind,
            answerText: turn.answerText || '',
          }),
          signal: flowAbortRef.current.signal,
        });
        if (!res.ok) throw new Error(`reaction_${res.status}`);
        const data = await res.json();
        reactionLine = data.hostLine || fallbackLine;
        dialogueSource = data.dialogueSource || 'fallback';
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') console.error('Reaction unavailable:', error);
    }
    if (!(await waitForResume(version)) || !isCurrent(version, r.id)) return;
    const r2 = receiveReaction(runRef.current!, { hostLine: reactionLine, dialogueSource }, turn.turnId);
    setCurrentRun(r2);
    setHostLine(reactionLine);
    playEffect('/audio/rejection-tone.wav', version);
    const hostPlayed = await playSpeech(reactionLine, 'af_nicole', version);
    if (!hostPlayed && !(await waitForBeat(900, version))) return;
    if (!(await waitForResume(version)) || !isCurrent(version, r.id)) return;

    const rBanter = reactionDone(runRef.current!);
    setCurrentRun(rBanter);
    const displayed: Array<{ speaker: string; text: string }> = [];
    for (const line of chosenBanter) {
      if (!(await waitForResume(version)) || !isCurrent(version, r.id)) return;
      displayed.push(line);
      setBanterLines([...displayed]);
      const played = await playSpeech(line.text, line.speaker === 'captive' ? 'am_fenrir' : 'af_nicole', version);
      if (!played && !(await waitForBeat(900, version))) return;
    }
    if (!(await waitForResume(version)) || !isCurrent(version, r.id)) return;
    const next = banterDone(runRef.current!);
    setCurrentRun(next);
    setIsSubmitting(false);
    submittingRef.current = false;
    if (next.phase === 'QUESTION') void presentQuestion(next);
    if (next.phase === 'ENDING') void playEnding(next, version);
  }, [isCurrent, playEffect, playEnding, playSpeech, presentQuestion, setCurrentRun, waitForBeat, waitForResume]);

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
    const now = Date.now();
    if (run.phase === 'ANSWERING' && run.deadline !== null && now >= run.deadline && !submittingRef.current) {
      void processTurn(run, '', true);
    }
    pausedRef.current = true;
    speechAudioRef.current?.pause();
    effectAudioRef.current?.pause();
    ambientRef.current?.pause();
    setPausedAt(now);
    setCurrentRun(pause(runRef.current!, now));
    setScreen('paused');
  };

  const handleResume = () => {
    if (!run || !pausedAt) return;
    setCurrentRun(resume(run, Date.now()));
    pausedRef.current = false;
    setPausedAt(null);
    setScreen('game');
    speechAudioRef.current?.play().catch(() => speechAudioRef.current?.dispatchEvent(new Event('error')));
    effectAudioRef.current?.play().catch(() => {});
    resumeWaitersRef.current.forEach(resolve => resolve());
    resumeWaitersRef.current.clear();
  };

  const handleLeave = () => {
    stopCurrentFlow();
    setCurrentRun(null);
    setScreen('title');
    setHostLine('');
    setQuestionText('');
    setBanterLines([]);
    setEndingLines([]);
    setSignalLost(false);
    setPostCreditsLine('');
    setPrologueLines([]);
    setProloguePlaying(false);
    setAnswer('');
    setTimeLeft(null);
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

        <div
          role="img"
          aria-label="A shadowed figure waits behind the rain-streaked studio window"
          style={{
            height: 'clamp(180px, 30vw, 260px)',
            width: '100%',
            marginBottom: 26,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            backgroundImage: "url('/behind-the-glass.png')",
            backgroundSize: '200% auto',
            backgroundPosition: 'right center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        <h1 style={{ fontFamily: C.sans, fontSize: 'clamp(2.4rem, 6vw, 4rem)', lineHeight: 1.1, margin: 0, letterSpacing: '0.02em' }}>
          THE LAST<br />BROADCAST
        </h1>

        <p style={{ color: C.amber, fontFamily: C.mono, fontSize: 13, marginTop: 12, letterSpacing: '0.1em' }}>
          An interactive radio nightmare
        </p>

        <p style={{ color: C.muted, maxWidth: 440, marginTop: 20, lineHeight: 1.7, fontSize: 15 }}>
          Five questions. Five seconds each. The host responds to what you type.
          Mara is running out of time. Headphones strongly recommended.
        </p>

        <div style={{ marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setScreen('soundcheck')} style={btn('primary')}>
            ▶ &nbsp;Tune In
          </button>
        </div>

        <p style={{ marginTop: 40, fontFamily: C.mono, fontSize: 11, color: C.muted, letterSpacing: '0.15em' }}>
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
        {episodeError && <p role="alert" style={{ color: C.amber }}>Episode unavailable. Start the local API and reload this page.</p>}

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
          <button
            onClick={startRun}
            disabled={prologuePlaying || !episode}
            style={{ ...btn('primary'), cursor: prologuePlaying || !episode ? 'not-allowed' : 'pointer', opacity: prologuePlaying || !episode ? 0.5 : 1 }}
          >
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
          <div style={card}>
            <div ref={endingTranscriptRef} style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {endingLines.map((line, index) => (
                <p key={index} style={{ color: line.speaker === 'captive' ? C.mara : C.cream, lineHeight: 1.6 }}>
                  <strong style={{ color: line.speaker === 'captive' ? C.mara : C.amber }}>{line.speaker === 'captive' ? 'MARA' : 'HOST'}:</strong> {line.text}
                </p>
              ))}
            </div>
            {signalLost && <p style={{ color: C.amber, fontFamily: C.mono, letterSpacing: '0.15em' }}>— SIGNAL LOST —</p>}
          </div>
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
      {postCreditsLine && <p style={{ marginTop: 16, color: C.amber }}><strong>Post-credits:</strong> {postCreditsLine}</p>}

      <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
        <button
          onClick={handleLeave}
          style={btn('primary')}
        >
          ↺ &nbsp;Tune In Again
        </button>
        <button onClick={handleLeave} style={btn('ghost')}>Leave The Station</button>
      </div>
    </div>
  );
}
