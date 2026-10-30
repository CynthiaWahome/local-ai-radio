import React, { useState, useEffect, useCallback } from 'react';
import { newRun, introDone, questionPresented, submit, receiveReaction, reactionDone, banterDone, endingDone, pause, resume, secondsLeft, type RunState } from '@local-ai-radio/engine';

const qids = ['r1-colour', 'r2-math', 'r3-reassure', 'r4-direction', 'r5-appeal'];

type Screen = 'title' | 'soundcheck' | 'game' | 'receipt' | 'paused';

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [run, setRun] = useState<RunState | null>(null);
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hostLine, setHostLine] = useState<string>('');
  const [pausedAt, setPausedAt] = useState<number | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/token=([a-f0-9]+)/);
    if (match) {
      setToken(match[1]);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const startRun = useCallback(() => {
    const r = newRun(`run-${Date.now()}`, qids);
    setRun(introDone(r));
    setScreen('game');
    setHostLine('');
  }, []);

  const presentQuestion = useCallback(() => {
    if (!run) return;
    const r = questionPresented(run, Date.now());
    setRun(r);
    const tick = () => {
      const sl = secondsLeft(r, Date.now());
      setTimeLeft(sl);
      if (sl !== null && sl > 0 && !r.paused) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [run]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!run) return;
    const r = submit(run, answer, Date.now());
    setRun(r);
    setAnswer('');
    if (!token) {
      const r2 = receiveReaction(r, { hostLine: 'An interesting submission. Unfortunately, that is not acceptable.', dialogueSource: 'fixture' }, `${r.id}:${r.round}`);
      setRun(reactionDone(r2));
      setHostLine(r2.reaction?.hostLine || '');
      setTimeout(() => {
        const r3 = banterDone(r2);
        setRun(r3);
        if (r3.phase === 'QUESTION') presentQuestion();
        if (r3.phase === 'ENDING') setTimeout(() => setRun(endingDone(r3)), 1000);
      }, 1000);
      return;
    }
    try {
      const res = await fetch('/api/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': token, 'Origin': window.location.origin },
        body: JSON.stringify({
          runId: r.id,
          turnId: `${r.id}:${r.round}`,
          episodeId: 'channel-00',
          roundIndex: r.round,
          questionId: r.questionIds[r.round],
          answerKind: r.turns[r.turns.length - 1]?.answerKind || 'text',
          answerText: answer,
        }),
      });
      const data = await res.json();
      if (!r) return;
      const r2 = receiveReaction(r, { hostLine: data.hostLine, dialogueSource: data.dialogueSource }, `${r.id}:${r.round}`);
      setRun(reactionDone(r2));
      setHostLine(data.hostLine);
      // Play speech
      if (data.hostLine) {
        const t = token || '';
        try {
          const speechRes = await fetch('/api/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-App-Token': t, 'Origin': window.location.origin },
            body: JSON.stringify({ text: data.hostLine, voice: 'af_nicole' }),
          });
          const speechData = await speechRes.json();
          if (speechData.audioId) {
            const audio = new Audio(`/api/audio/${speechData.audioId}?token=${t}`);
            audio.play().catch(e => console.error('play failed:', e));
          }
        } catch (e) {
          console.error('Speech failed:', e);
        }
      }
      setTimeout(() => {
        if (!r2) return;
        // Speak Mara's banter
        if (token) {
          fetch('/api/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-App-Token': token, 'Origin': window.location.origin },
            body: JSON.stringify({ text: "Mara: You never mentioned that rule.", voice: 'am_fenrir' }),
          }).then(r => r.json()).then(d => {
            if (d.audioId) {
              const a = new Audio(`/api/audio/${d.audioId}?token=${token}`);
              a.play().catch(() => {});
            }
          }).catch(() => {});
        }
        const r3 = banterDone(r2);
        setRun(r3);
        if (r3.phase === 'QUESTION') presentQuestion();
        if (r3.phase === 'ENDING') setTimeout(() => setRun(endingDone(r3)), 1000);
      }, 1000);
    } catch {
      if (!r) return;
      const r2 = receiveReaction(r, { hostLine: 'An interesting submission. Unfortunately, that is not acceptable.', dialogueSource: 'fallback' }, `${r.id}:${r.round}`);
      setRun(reactionDone(r2));
      setHostLine(r2.reaction?.hostLine || '');
    }
  }, [run, answer, token, presentQuestion]);

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
      <div style={{ padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh', fontFamily: 'DejaVu Sans, sans-serif' }}>
        <h2>Sound check</h2>
        <p>Five questions. Your timer begins after each question finishes. Pause is always available.</p>
        <button onClick={startRun} style={{ padding: '12px 24px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer', marginTop: 16 }}>Start</button>
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

  if (screen === 'game' && run) {
    return (
      <div style={{ padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh', fontFamily: 'DejaVu Sans, sans-serif', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
          <span style={{ fontFamily: 'DejaVu Sans Mono, monospace', color: '#B8D7B0' }}>Channel 00</span>
          <span style={{ color: '#FF665A' }}>{run.phase}</span>
          <button onClick={handlePause} style={{ padding: '8px 16px', background: '#262B32', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Pause</button>
        </div>
        {run.phase === 'QUESTION' && (
          <button onClick={presentQuestion} style={{ padding: '8px 16px', background: '#262B32', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Present question</button>
        )}
        {run.phase === 'ANSWERING' && (
          <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
            <p>Question {run.round + 1} of 5</p>
            <p style={{ fontSize: 32, fontFamily: 'DejaVu Sans Mono, monospace', color: '#FF665A' }}>Time: {timeLeft ?? '—'}s</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Type your answer" style={{ padding: 8, fontSize: 16, flex: 1, maxWidth: 400 }} aria-label="Answer input" />
              <button type="submit" style={{ padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Submit</button>
            </div>
          </form>
        )}
        {run.phase === 'GENERATING' && <p style={{ marginTop: 16 }}>Transmitting...</p>}
        {run.phase === 'REACTION' && hostLine && (
          <p style={{ marginTop: 16 }}><strong style={{ color: '#FF665A' }}>Host:</strong> {hostLine}</p>
        )}
        {run.phase === 'BANTER' && <p style={{ marginTop: 16, color: '#B6B1A8' }}>Mara: You never mentioned that rule.</p>}
        {run.phase === 'ENDING' && <p style={{ marginTop: 16, color: '#FF665A' }}>Signal lost.</p>}
        {run.phase === 'COMPLETE' && (
          <div style={{ marginTop: 16 }}>
            <p>RESCUE ATTEMPT COMPLETE</p>
            <p>SIGNAL LOST</p>
            <button onClick={() => setScreen('receipt')} style={{ padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer', marginTop: 8 }}>Receipt</button>
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
        <button onClick={() => { setRun(null); setScreen('title'); setHostLine(''); }} style={{ padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Tune in again</button>
        <button onClick={handleLeave} style={{ padding: '8px 16px', background: '#262B32', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Leave the station</button>
      </div>
    </div>
  );
}
