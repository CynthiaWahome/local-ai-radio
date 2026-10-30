import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { newRun, introDone, questionPresented, submit, expire, receiveReaction, reactionDone, banterDone, endingDone, pause, resume, secondsLeft, type RunState } from '@local-ai-radio/engine';

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
    pausedRef.current = true;
    if (run.phase === 'ANSWERING' && run.deadline !== null && now >= run.deadline && !submittingRef.current) {
      void processTurn(run, '', true);
    }
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
        {episodeError && <p role="alert" style={{ color: '#FF665A' }}>Episode unavailable. Start the local API and reload this page.</p>}

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
            disabled={prologuePlaying || !episode}
            style={{ padding: '12px 24px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: prologuePlaying || !episode ? 'not-allowed' : 'pointer', opacity: prologuePlaying || !episode ? 0.5 : 1 }}
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

        {run.phase === 'ENDING' && (
          <div style={{ marginTop: 16 }}>
            <div ref={endingTranscriptRef} style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {endingLines.map((line, index) => (
                <p key={index} style={{ color: line.speaker === 'captive' ? '#B6B1A8' : '#FF665A' }}>
                  <strong>{line.speaker === 'captive' ? 'Mara' : 'Host'}:</strong> {line.text}
                </p>
              ))}
            </div>
            {signalLost && <p style={{ color: '#FF665A' }}>Signal lost.</p>}
          </div>
        )}
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
      {postCreditsLine && <p style={{ marginTop: 16, color: '#FF665A' }}><strong>Post-credits:</strong> {postCreditsLine}</p>}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={handleLeave} style={{ padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Tune in again</button>
        <button onClick={handleLeave} style={{ padding: '8px 16px', background: '#262B32', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Leave the station</button>
      </div>
    </div>
  );
}
