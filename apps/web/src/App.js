import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { newRun, introDone, questionPresented, submit, receiveReaction, reactionDone, banterDone, endingDone, secondsLeft } from '@local-ai-radio/engine';
const qids = ['r1-colour', 'r2-math', 'r3-reassure', 'r4-direction', 'r5-appeal'];
export default function App() {
    const [screen, setScreen] = useState('title');
    const [run, setRun] = useState(null);
    const [answer, setAnswer] = useState('');
    const [timeLeft, setTimeLeft] = useState(null);
    const startRun = () => {
        const r = newRun(`run-${Date.now()}`, qids);
        setRun(introDone(r));
        setScreen('game');
    };
    const presentQuestion = () => {
        if (!run)
            return;
        const r = questionPresented(run, Date.now());
        setRun(r);
        const tick = () => {
            if (!r)
                return;
            const sl = secondsLeft(r, Date.now());
            setTimeLeft(sl);
            if (sl !== null && sl > 0)
                requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!run)
            return;
        const r = submit(run, answer, Date.now());
        setRun(r);
        // fixture reaction
        setTimeout(() => {
            if (!r)
                return;
            const r2 = receiveReaction(r, { hostLine: 'An interesting submission. Unfortunately, that is not acceptable.', dialogueSource: 'fixture' }, `${r.id}:${r.round}`);
            setRun(reactionDone(r2));
            setTimeout(() => {
                if (!r2)
                    return;
                const r3 = banterDone(r2);
                setRun(r3);
                if (r3.phase === 'QUESTION')
                    presentQuestion();
                if (r3.phase === 'ENDING') {
                    setTimeout(() => setRun(endingDone(r3)), 1000);
                }
            }, 1000);
        }, 500);
    };
    if (screen === 'title') {
        return (_jsxs("div", { style: { padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh' }, children: [_jsx("h1", { children: "THE LAST BROADCAST" }), _jsx("p", { children: "An interactive radio nightmare" }), _jsx("button", { onClick: () => setScreen('soundcheck'), style: { padding: '12px 24px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }, children: "Tune in" })] }));
    }
    if (screen === 'soundcheck') {
        return (_jsxs("div", { style: { padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh' }, children: [_jsx("h2", { children: "Sound check" }), _jsx("p", { children: "Five questions. Your timer begins after each question finishes." }), _jsx("button", { onClick: startRun, style: { padding: '12px 24px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }, children: "Start" })] }));
    }
    if (screen === 'game' && run) {
        return (_jsxs("div", { style: { padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 16 }, children: [_jsx("span", { children: "Channel 00" }), _jsx("span", { children: run.phase })] }), run.phase === 'QUESTION' && (_jsx("button", { onClick: presentQuestion, style: { padding: '8px 16px', background: '#262B32', color: '#F2E8D5', border: 'none', cursor: 'pointer' }, children: "Present question" })), run.phase === 'ANSWERING' && (_jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("p", { children: ["Question ", run.round + 1] }), _jsxs("p", { style: { fontSize: 24 }, children: ["Time: ", timeLeft ?? '—', "s"] }), _jsx("input", { value: answer, onChange: e => setAnswer(e.target.value), placeholder: "Type your answer", style: { padding: 8, fontSize: 16, width: '100%', maxWidth: 400 } }), _jsx("button", { type: "submit", style: { padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer', marginLeft: 8 }, children: "Submit" })] })), run.phase === 'GENERATING' && _jsx("p", { children: "Transmitting..." }), run.phase === 'REACTION' && run.reaction && _jsxs("p", { children: [_jsx("strong", { children: "Host:" }), " ", run.reaction.hostLine] }), run.phase === 'BANTER' && _jsx("p", { children: "Mara: You never mentioned that rule." }), run.phase === 'ENDING' && _jsx("p", { children: "Signal lost." }), run.phase === 'COMPLETE' && (_jsxs("div", { children: [_jsx("p", { children: "RESCUE ATTEMPT COMPLETE" }), _jsx("p", { children: "SIGNAL LOST" }), _jsx("button", { onClick: () => setScreen('receipt'), style: { padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }, children: "Receipt" })] }))] }));
    }
    return (_jsxs("div", { style: { padding: 24, color: '#F2E8D5', background: '#0B0C0F', minHeight: '100vh' }, children: [_jsx("h1", { children: "Receipt" }), _jsx("p", { children: "Questions presented: 5" }), _jsx("p", { children: "Answers accepted: 0" }), _jsx("button", { onClick: () => { setRun(null); setScreen('title'); }, style: { padding: '8px 16px', background: '#8E2633', color: '#F2E8D5', border: 'none', cursor: 'pointer' }, children: "Tune in again" })] }));
}
