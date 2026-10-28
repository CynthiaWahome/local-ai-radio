import React, { useState } from 'react';
import { newRun, introDone, questionPresented, submit, receiveReaction, reactionDone, banterDone, endingDone, secondsLeft, type RunState } from '@local-ai-radio/engine';

const qids = ['r1-colour', 'r2-math', 'r3-reassure', 'r4-direction', 'r5-appeal'];

type Screen = 'title' | 'soundcheck' | 'game' | 'receipt';

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [run, setRun] = useState<RunState | null>(null);
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const startRun = () => {
    const r = newRun(`run-${Date.now()}`, qids);
    setRun(introDone(r));
    setScreen('game');
  };

  const presentQuestion = () => {
    if (!run) return;
    const r = questionPresented(run, Date.now());
    setRun(r);
    const tick = () => {
      if (!r) return;
      const sl = secondsLeft(r, Date.now());
      setTimeLeft(sl);
      if (sl !== null && sl > 0) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!run) return;
    const r = submit(run, answer, Date.now());
    setRun(r);
    // fixture reaction
    setTimeout(() => {
      if (!r) return;
      const r2 = receiveReaction(r, { hostLine: 'An interesting submission. Unfortunately, that is not acceptable.', dialogueSource: 'fixture' }, `${r.id}:${r.round}`);
      setRun(reactionDone(r2));
      setTimeout(() => {
        if (!r2) return;
        const r3 = banterDone(r2);
        setRun(r3);
        if (r3.phase === 'QUESTION') presentQuestion();
        if (r3.phase === 'ENDING') {
          setTimeout(() => setRun(endingDone(r3)), 1000);
        }
      }, 1000);
    }, 500);
  };

  if (screen === 'title') {
    return (
      <div style={{ padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh' }}>
        <h1>THE LAST BROADCAST</h1>
        <p>An interactive radio nightmare</p>
        <button onClick={() => setScreen('soundcheck')} style={{ padding: '12px 24px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Tune in</button>
      </div>
    );
  }

  if (screen === 'soundcheck') {
    return (
      <div style={{ padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh' }}>
        <h2>Sound check</h2>
        <p>Five questions. Your timer begins after each question finishes.</p>
        <button onClick={startRun} style={{ padding: '12px 24px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Start</button>
      </div>
    );
  }

  if (screen === 'game' && run) {
    return (
      <div style={{ padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span>Channel 00</span>
          <span>{run.phase}</span>
        </div>
        {run.phase === 'QUESTION' && (
          <button onClick={presentQuestion} style={{ padding: '8px 16px', background: '#262B32', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Present question</button>
        )}
        {run.phase === 'ANSWERING' && (
          <form onSubmit={handleSubmit}>
            <p>Question {run.round + 1}</p>
            <p style={{ fontSize: 24 }}>Time: {timeLeft ?? '—'}s</p>
            <input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Type your answer" style={{ padding: 8, fontSize: 16, width: '100%', maxWidth: 400 }} />
            <button type="submit" style={{ padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer', marginLeft: 8 }}>Submit</button>
          </form>
        )}
        {run.phase === 'GENERATING' && <p>Transmitting...</p>}
        {run.phase === 'REACTION' && run.reaction && <p><strong>Host:</strong> {run.reaction.hostLine}</p>}
        {run.phase === 'BANTER' && <p>Mara: You never mentioned that rule.</p>}
        {run.phase === 'ENDING' && <p>Signal lost.</p>}
        {run.phase === 'COMPLETE' && (
          <div>
            <p>RESCUE ATTEMPT COMPLETE</p>
            <p>SIGNAL LOST</p>
            <button onClick={() => setScreen('receipt')} style={{ padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Receipt</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh' }}>
      <h1>Receipt</h1>
      <p>Questions presented: 5</p>
      <p>Answers accepted: 0</p>
      <button onClick={() => { setRun(null); setScreen('title'); }} style={{ padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }}>Tune in again</button>
    </div>
  );
}
