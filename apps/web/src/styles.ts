// Design tokens for The Last Broadcast UI
export const C = {
  bg:        '#0B0C0F',   // near-black page background
  bgCard:    '#13161B',   // slightly lifted surface
  bgInput:   '#1A1D24',   // input field background
  bgBtn:     '#1E2229',   // secondary button background
  bgBtnHover:'#262B32',
  red:       '#8E2633',   // primary CTA / danger red
  redHover:  '#A62E3D',
  amber:     '#FF665A',   // host colour / on-air accent
  green:     '#B8D7B0',   // channel label green
  cream:     '#F2E8D5',   // body text
  muted:     '#B6B1A8',   // readable secondary text
  mara:      '#9BB8D4',   // Mara's dialogue colour (cool blue — captive)
  border:    '#1F232A',   // subtle divider
  mono:      `'Courier New', 'Courier', monospace`,
  sans:      `'Special Elite', Georgia, serif`,
} as const;

export const btn = (variant: 'primary' | 'secondary' | 'ghost' = 'secondary'): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 22px',
  fontSize: 14,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  fontFamily: C.mono,
  border: variant === 'ghost' ? `1px solid ${C.border}` : 'none',
  borderRadius: 2,
  cursor: 'pointer',
  transition: 'background 0.15s',
  background: variant === 'primary' ? C.red : variant === 'ghost' ? 'transparent' : C.bgBtn,
  color: C.cream,
});

export const page: React.CSSProperties = {
  background: C.bg,
  minHeight: '100vh',
  color: C.cream,
  fontFamily: C.sans,
  padding: '32px 24px',
  maxWidth: 720,
  margin: '0 auto',
  boxSizing: 'border-box' as const,
};

export const card: React.CSSProperties = {
  background: C.bgCard,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  padding: '20px 24px',
  marginTop: 16,
};
