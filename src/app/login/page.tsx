'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Google OAuth icon ────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Animated SVG floor plan (background layer) ───────────────────────────────
function FloorPlanBg() {
  // pathLength={1} normalizes each path so strokeDasharray/Offset of 1 = full length
  const line = (x1: number, y1: number, x2: number, y2: number, delay: number, dur = 1.2) => (
    <line
      key={`${x1}-${y1}-${x2}-${y2}`}
      x1={x1} y1={y1} x2={x2} y2={y2}
      pathLength={1}
      stroke="#0d7fff" strokeWidth="0.75" fill="none"
      style={{
        strokeDasharray: 1,
        strokeDashoffset: 1,
        animation: `ffe-draw ${dur}s linear ${delay}s forwards`,
      }}
    />
  );

  const rect = (x: number, y: number, w: number, h: number, delay: number, dur = 2.5) => (
    <rect
      key={`r-${x}-${y}`}
      x={x} y={y} width={w} height={h}
      pathLength={1}
      stroke="#0d7fff" strokeWidth="1" fill="none"
      style={{
        strokeDasharray: 1,
        strokeDashoffset: 1,
        animation: `ffe-draw ${dur}s linear ${delay}s forwards`,
      }}
    />
  );

  const pin = (cx: number, cy: number, delay: number) => (
    <g key={`p-${cx}-${cy}`} style={{ opacity: 0, animation: `ffe-pin 0.35s ease ${delay}s forwards` }}>
      <circle cx={cx} cy={cy} r={3.5} fill="#0d7fff" opacity={0.9} />
      <circle cx={cx} cy={cy} r={6} fill="none" stroke="#0d7fff" strokeWidth={0.5} opacity={0.4} />
    </g>
  );

  const label = (x: number, y: number, text: string, delay: number) => (
    <text
      key={`l-${x}-${y}`}
      x={x} y={y}
      fill="rgba(13,127,255,0.4)"
      style={{
        fontSize: 8,
        fontFamily: 'IBM Plex Mono, monospace',
        letterSpacing: '0.1em',
        opacity: 0,
        animation: `ffe-fade 0.5s ease ${delay}s forwards`,
      }}
    >
      {text}
    </text>
  );

  return (
    <svg
      viewBox="0 0 1100 820"
      preserveAspectRatio="xMaxYMid meet"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '72%',
        height: '100%',
        opacity: 0.18,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Outer building boundary */}
      {rect(80, 60, 980, 700, 0.2, 3.5)}

      {/* Primary horizontal corridor */}
      {line(80, 310, 1060, 310, 1.8, 2)}

      {/* Vertical dividers — top row */}
      {line(320, 60, 320, 310, 2.6, 1.1)}
      {line(550, 60, 550, 310, 2.9, 1.1)}
      {line(780, 60, 780, 310, 3.2, 1.1)}

      {/* Vertical dividers — bottom row */}
      {line(320, 310, 320, 760, 3.4, 1.1)}
      {line(620, 310, 620, 760, 3.7, 1.1)}
      {line(850, 310, 850, 760, 4.0, 1.1)}

      {/* Horizontal subdivisions — bottom row */}
      {line(80,  520, 320, 520, 4.2, 0.9)}
      {line(320, 480, 620, 480, 4.4, 0.9)}
      {line(620, 560, 850, 560, 4.6, 0.9)}
      {line(850, 490, 1060, 490, 4.8, 0.9)}
      {line(850, 650, 1060, 650, 5.0, 0.9)}

      {/* Room labels */}
      {label(100, 200, 'MAIN HALL', 5.5)}
      {label(335, 155, 'RM A', 5.7)}
      {label(565, 155, 'RM B', 5.9)}
      {label(795, 155, 'RM C', 6.1)}
      {label(100, 420, 'RM D', 6.2)}
      {label(100, 640, 'RM E', 6.3)}
      {label(340, 600, 'RM F', 6.4)}
      {label(635, 425, 'RM G', 6.5)}
      {label(635, 660, 'RM H', 6.6)}
      {label(865, 395, 'RM I', 6.7)}
      {label(865, 565, 'STORAGE', 6.8)}
      {label(865, 680, 'RM J', 6.9)}

      {/* Dimension lines */}
      {line(80, 30, 1060, 30, 5.5, 1.5)}
      {line(80, 24, 80, 36, 5.6, 0.2)}
      {line(1060, 24, 1060, 36, 5.6, 0.2)}
      <text
        x={570} y={27}
        fill="rgba(13,127,255,0.25)"
        style={{ fontSize: 7, fontFamily: 'IBM Plex Mono, monospace', textAnchor: 'middle', letterSpacing: '0.1em', opacity: 0, animation: 'ffe-fade 0.4s ease 6.0s forwards' }}
      >
        FLOOR PLAN — LEVEL 1
      </text>

      {/* Asset pins — appear last, reading left-to-right top-to-bottom */}
      {pin(160, 175, 7.0)}
      {pin(200, 230, 7.1)}
      {pin(145, 265, 7.2)}
      {pin(380, 160, 7.3)}
      {pin(420, 210, 7.4)}
      {pin(610, 185, 7.5)}
      {pin(645, 245, 7.6)}
      {pin(840, 175, 7.7)}
      {pin(870, 235, 7.8)}
      {pin(910, 185, 7.9)}
      {pin(130, 395, 8.0)}
      {pin(175, 450, 8.1)}
      {pin(155, 590, 8.2)}
      {pin(190, 640, 8.3)}
      {pin(400, 390, 8.4)}
      {pin(440, 440, 8.5)}
      {pin(400, 490, 8.6)}
      {pin(680, 395, 8.7)}
      {pin(720, 440, 8.8)}
      {pin(680, 630, 8.9)}
      {pin(910, 375, 9.0)}
      {pin(940, 425, 9.1)}
      {pin(910, 530, 9.2)}
      {pin(950, 600, 9.3)}
      {pin(920, 680, 9.4)}
      {pin(975, 720, 9.5)}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  // Redirect to app if already authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace('/');
    });
  }, []);

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap');

        /* ── Keyframes ──────────────────────────────────────────────────── */
        @keyframes ffe-draw  { to { stroke-dashoffset: 0; } }
        @keyframes ffe-fade  { to { opacity: 1; } }
        @keyframes ffe-up    {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ffe-pin {
          0%   { opacity: 0; transform: scale(0) translateY(-6px); }
          65%  { transform: scale(1.25) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* ── Entrance stagger helpers ───────────────────────────────────── */
        .ffe-up { opacity: 0; animation: ffe-up 0.65s cubic-bezier(0.22,1,0.36,1) forwards; }

        /* ── Tier cards ─────────────────────────────────────────────────── */
        .ffe-tier {
          border: 1px solid #1a1e35;
          background: rgba(12,14,27,0.6);
          transition: border-color 0.2s, background 0.2s;
          cursor: default;
        }
        .ffe-tier:hover {
          border-color: rgba(13,127,255,0.3);
          background: rgba(13,127,255,0.04);
        }
        .ffe-tier.featured {
          border-color: rgba(13,127,255,0.45);
          background: rgba(13,127,255,0.07);
        }

        /* ── Sign-in button ─────────────────────────────────────────────── */
        .ffe-signin-btn {
          background: #111422;
          border: 1px solid #252944;
          transition: background 0.18s, border-color 0.18s;
        }
        .ffe-signin-btn:hover {
          background: #161a2e;
          border-color: #0d7fff;
        }
        .ffe-signin-btn:active {
          background: #0c0e1b;
        }

        /* ── Dotted grid bg ─────────────────────────────────────────────── */
        .ffe-grid-bg {
          background-image: radial-gradient(circle, rgba(13,127,255,0.07) 1px, transparent 1px);
          background-size: 36px 36px;
        }

        /* ── Right panel separator ──────────────────────────────────────── */
        .ffe-right-panel {
          border-left: 1px solid #1a1e35;
          background: linear-gradient(160deg, rgba(13,127,255,0.03) 0%, transparent 60%);
        }
      `}</style>

      {/* Root container — fills the space layout gives us (body is flex-col h-screen) */}
      <div className="ffe-grid-bg flex-1 flex flex-col lg:flex-row overflow-hidden relative" style={{ background: '#070910' }}>

        {/* ── Background floor plan ──────────────────────────────────────── */}
        <FloorPlanBg />

        {/* ── Radial accent glow ────────────────────────────────────────── */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
            background: 'radial-gradient(ellipse 55% 80% at 85% 50%, rgba(13,127,255,0.055) 0%, transparent 65%)',
          }}
        />

        {/* ════════════════════════════════════════════════════════════════
            LEFT PANEL — Marketing
        ═══════════════════════════════════════════════════════════════ */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 py-6 lg:px-16 lg:py-8 overflow-hidden min-h-0">

          {/* Wordmark */}
          <div className="ffe-up mb-7" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2.5">
              {/* 2×2 grid icon — mirrors the app's floor plan concept */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5,
                width: 26, height: 26, padding: 5,
                border: '1.5px solid #0d7fff',
              }}>
                <div style={{ background: '#0d7fff', borderRadius: 1 }} />
                <div style={{ background: 'rgba(13,127,255,0.35)', borderRadius: 1 }} />
                <div style={{ background: 'rgba(13,127,255,0.2)', borderRadius: 1 }} />
                <div style={{ background: 'rgba(13,127,255,0.55)', borderRadius: 1 }} />
              </div>
              <span style={{
                color: '#0d7fff', fontSize: 10, letterSpacing: '0.22em',
                textTransform: 'uppercase', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500,
              }}>
                FFE Platform
              </span>
            </div>
          </div>

          {/* Hero headline */}
          <div className="ffe-up mb-4" style={{ animationDelay: '0.22s' }}>
            <h1 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 'clamp(2.2rem, 3.2vw, 3.4rem)',
              fontWeight: 400,
              lineHeight: 1.1,
              color: '#dde3f0',
              margin: 0,
              letterSpacing: '-0.02em',
            }}>
              Know exactly what<br />
              you have — and exactly<br />
              <em style={{ color: '#4099ff', fontStyle: 'italic' }}>
                where it lives.
              </em>
            </h1>
          </div>

          {/* Sub-headline */}
          <div className="ffe-up mb-6" style={{ animationDelay: '0.36s' }}>
            <p style={{ color: '#8990b5', fontSize: 13, lineHeight: 1.8, maxWidth: 460, margin: 0, fontFamily: 'IBM Plex Sans, sans-serif' }}>
              Spatial inventory for any organization. Map your furniture, fixtures, and equipment onto interactive floor plans — with photo documentation, condition tracking, and live team collaboration.
            </p>
            <p style={{ marginTop: 12, color: 'rgba(64,153,255,0.55)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono, monospace' }}>
              Churches · Schools · Offices · Theaters · Warehouses · Campuses
            </p>
          </div>

          {/* Feature list */}
          <div className="ffe-up mb-5" style={{ animationDelay: '0.5s' }}>
            {([
              ['01', 'Photo-first intake',        'Photograph items on any phone. Drag and drop directly onto your floor plan.'],
              ['02', 'Spatial context',            'See your inventory in physical space — not buried in a flat spreadsheet.'],
              ['03', 'Condition & quantity splits','Log excellent, good, fair, or poor across bulk items. Built for audits.'],
              ['04', 'Real-time collaboration',   'Multiple team members, simultaneous edits, updates appear instantly.'],
            ] as const).map(([num, title, desc]) => (
              <div
                key={num}
                style={{
                  display: 'flex', gap: 20, marginBottom: 12, paddingTop: 12,
                  borderTop: '1px solid #111422',
                }}
              >
                <span style={{ color: '#0d7fff', fontSize: 9, letterSpacing: '0.18em', paddingTop: 1, minWidth: 22, opacity: 0.7, fontFamily: 'IBM Plex Mono, monospace' }}>
                  {num}
                </span>
                <div>
                  <div style={{ color: '#c9d0e4', fontSize: 12, fontWeight: 500, marginBottom: 2, letterSpacing: '0.03em', fontFamily: 'IBM Plex Mono, monospace' }}>
                    {title}
                  </div>
                  <div style={{ color: '#62709a', fontSize: 11, lineHeight: 1.65, fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Pricing tiers ─────────────────────────────────────────── */}
          <div className="ffe-up" style={{ animationDelay: '0.64s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ color: '#252944', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono, monospace' }}>
                Plans
              </span>
              <div style={{ flex: 1, height: 1, background: '#111422' }} />
              <span style={{ color: 'rgba(64,153,255,0.45)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono, monospace' }}>
                Coming soon
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { name: 'Starter',    price: 'Free',    desc: '1 floor plan · solo use',                  featured: false },
                { name: 'Team',       price: '$—/mo',   desc: 'Multi-building · collaboration · exports',  featured: true  },
                { name: 'Enterprise', price: 'Custom',  desc: 'SSO · API access · dedicated support',      featured: false },
              ] as const).map(tier => (
                <div key={tier.name} className={`ffe-tier ${tier.featured ? 'featured' : ''}`} style={{ flex: 1, padding: '14px 12px', position: 'relative' }}>
                  {tier.featured && (
                    <div style={{
                      position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                      background: '#0d7fff', color: '#070910',
                      fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
                      padding: '2px 10px', fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace',
                      whiteSpace: 'nowrap',
                    }}>
                      Popular
                    </div>
                  )}
                  <div style={{ color: '#afb6ce', fontSize: 11, fontWeight: 500, marginBottom: 4, fontFamily: 'IBM Plex Mono, monospace' }}>
                    {tier.name}
                  </div>
                  <div style={{ color: '#f0b429', fontSize: 13, fontWeight: 500, marginBottom: 5, letterSpacing: '-0.01em', fontFamily: 'IBM Plex Mono, monospace' }}>
                    {tier.price}
                  </div>
                  <div style={{ color: '#62709a', fontSize: 10, lineHeight: 1.55, fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    {tier.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT PANEL — Auth card
        ═══════════════════════════════════════════════════════════════ */}
        <div className="ffe-right-panel relative z-10 flex items-center justify-center flex-shrink-0 px-8 py-10 lg:px-12" style={{ width: 'clamp(340px, 30vw, 420px)' }}>

          <div className="ffe-up w-full" style={{ animationDelay: '0.3s' }}>

            {/* ── Auth card ─────────────────────────────────────────────── */}
            <div style={{
              background: 'rgba(12,14,27,0.85)',
              border: '1px solid #1a1e35',
              backdropFilter: 'blur(16px)',
              padding: '36px 32px',
            }}>
              {/* Card header */}
              <h2 style={{
                fontFamily: "'DM Serif Display', serif",
                color: '#dde3f0',
                fontSize: 20,
                fontWeight: 400,
                marginBottom: 8,
                letterSpacing: '-0.02em',
              }}>
                Access your inventory
              </h2>
              <p style={{ color: '#62709a', fontSize: 11, lineHeight: 1.7, marginBottom: 28, fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Sign in to manage your spaces. New accounts are provisioned automatically on first login.
              </p>

              {/* Google sign-in */}
              <button
                onClick={handleGoogleSignIn}
                className="ffe-signin-btn"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '12px 20px',
                  color: '#c9d0e4',
                  fontSize: 12,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                <GoogleIcon />
                Continue with Google
              </button>

              {/* Divider */}
              <div style={{ margin: '24px 0', height: 1, background: '#111422' }} />

              {/* Use-case tags */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ color: '#252944', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'IBM Plex Mono, monospace' }}>
                  Built for
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {['Churches', 'Schools', 'Theaters', 'Warehouses', 'Offices', 'Campuses'].map(tag => (
                    <span
                      key={tag}
                      style={{
                        border: '1px solid #111422',
                        padding: '3px 8px',
                        fontSize: 9,
                        color: '#62709a',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        fontFamily: 'IBM Plex Mono, monospace',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Feature preview box */}
              <div style={{ background: 'rgba(13,127,255,0.05)', border: '1px solid rgba(13,127,255,0.12)', padding: '14px 16px' }}>
                <div style={{ color: 'rgba(64,153,255,0.65)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'IBM Plex Mono, monospace' }}>
                  What's inside
                </div>
                {[
                  'Interactive floor plan mapping',
                  'Photo-linked asset tracking',
                  'Condition & quantity audit',
                  'CSV export & printable reports',
                  'Real-time multi-user sync',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <div style={{ width: 3.5, height: 3.5, background: '#0d7fff', flexShrink: 0, opacity: 0.5 }} />
                    <span style={{ color: '#62709a', fontSize: 10.5, lineHeight: 1.5, fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card footer */}
            <div style={{ marginTop: 14, textAlign: 'center', color: '#252944', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono, monospace' }}>
              Secured via Google OAuth · No password stored
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
