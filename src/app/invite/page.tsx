'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, XCircle, Loader2, LogIn, ArrowRight, AlertTriangle } from 'lucide-react';

type Status =
  | 'checking'
  | 'needs_login'
  | 'redeeming'
  | 'success'
  | 'invalid'
  | 'already_assigned'
  | 'no_token';

// ─── Logo mark ────────────────────────────────────────────────────────────────
function LogoMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5,
        width: 24, height: 24, padding: 4.5,
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
  );
}

// ─── Google icon ──────────────────────────────────────────────────────────────
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

// ─── Inner component (needs useSearchParams) ──────────────────────────────────
function InviteInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    if (!token) {
      setStatus('no_token');
      return;
    }

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setStatus('needs_login');
        return;
      }

      setStatus('redeeming');
      const { data: result, error } = await supabase.rpc('redeem_invite', { p_token: token });

      if (error) {
        setStatus('invalid');
        return;
      }

      if (result === 'ok') {
        setStatus('success');
        // Redirect to app after a short delay
        setTimeout(() => { window.location.href = '/'; }, 1800);
      } else if (result === 'already_assigned') {
        setStatus('already_assigned');
      } else {
        setStatus('invalid');
      }
    });
  }, [token]);

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // After OAuth, Supabase redirects back here — token stays in the URL
        redirectTo: `${window.location.origin}/invite?token=${token}`,
      },
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070910',
      backgroundImage: 'radial-gradient(circle, rgba(13,127,255,0.07) 1px, transparent 1px)',
      backgroundSize: '36px 36px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'IBM Plex Mono, monospace',
    }}>

      {/* Glow */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 60% at 50% 40%, rgba(13,127,255,0.07) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <LogoMark />
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(12,14,27,0.9)',
          border: '1px solid #1a1e35',
          backdropFilter: 'blur(16px)',
          padding: '36px 32px',
        }}>

          {/* Checking / redeeming */}
          {(status === 'checking' || status === 'redeeming') && (
            <div style={{ textAlign: 'center' }}>
              <Loader2
                size={28}
                style={{ color: '#0d7fff', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }}
              />
              <p style={{ color: '#8990b5', fontSize: 12, letterSpacing: '0.05em' }}>
                {status === 'checking' ? 'Verifying invite…' : 'Joining project…'}
              </p>
            </div>
          )}

          {/* Needs login */}
          {status === 'needs_login' && (
            <>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#0d7fff', opacity: 0.7 }}>
                  Team Invitation
                </span>
              </div>
              <h1 style={{ color: '#dde3f0', fontSize: 20, fontWeight: 400, marginBottom: 10, letterSpacing: '-0.02em', fontFamily: 'DM Serif Display, serif' }}>
                You've been invited
              </h1>
              <p style={{ color: '#62709a', fontSize: 11, lineHeight: 1.75, marginBottom: 28, fontFamily: 'IBM Plex Sans, monospace' }}>
                Sign in with Google to accept this invitation and join your team's project.
              </p>
              <button
                onClick={handleSignIn}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '12px 20px',
                  background: '#111422',
                  border: '1px solid #252944',
                  color: '#c9d0e4',
                  fontSize: 12,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace',
                  transition: 'border-color 0.18s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#0d7fff')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#252944')}
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </>
          )}

          {/* Success */}
          {status === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 size={32} style={{ color: '#22c55e', margin: '0 auto 16px' }} />
              <h2 style={{ color: '#dde3f0', fontSize: 16, fontWeight: 400, marginBottom: 8, letterSpacing: '-0.01em' }}>
                You're in
              </h2>
              <p style={{ color: '#62709a', fontSize: 11, lineHeight: 1.7, marginBottom: 24 }}>
                You've joined the project. Taking you to the app now…
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Loader2 size={11} style={{ color: '#0d7fff', animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#0d7fff', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  Redirecting
                </span>
              </div>
            </div>
          )}

          {/* Already assigned */}
          {status === 'already_assigned' && (
            <div>
              <AlertTriangle size={24} style={{ color: '#f0b429', marginBottom: 16 }} />
              <h2 style={{ color: '#dde3f0', fontSize: 16, fontWeight: 400, marginBottom: 8, letterSpacing: '-0.01em' }}>
                Already assigned
              </h2>
              <p style={{ color: '#62709a', fontSize: 11, lineHeight: 1.75, marginBottom: 24 }}>
                Your account is already linked to a different project. Contact your administrator if you need to switch projects.
              </p>
              <a
                href="/"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#4099ff',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textDecoration: 'none',
                }}
              >
                Go to your project <ArrowRight size={12} />
              </a>
            </div>
          )}

          {/* Invalid / expired */}
          {(status === 'invalid' || status === 'no_token') && (
            <div>
              <XCircle size={24} style={{ color: '#ef4444', marginBottom: 16 }} />
              <h2 style={{ color: '#dde3f0', fontSize: 16, fontWeight: 400, marginBottom: 8, letterSpacing: '-0.01em' }}>
                {status === 'no_token' ? 'No invite token' : 'Invite link invalid'}
              </h2>
              <p style={{ color: '#62709a', fontSize: 11, lineHeight: 1.75, marginBottom: 24 }}>
                {status === 'no_token'
                  ? 'This URL is missing an invite token. Check the link you were given.'
                  : 'This invite link has expired or has already been used. Ask your administrator to generate a new one.'
                }
              </p>
              <a
                href="/login"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#4099ff',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textDecoration: 'none',
                }}
              >
                <LogIn size={12} /> Back to sign in
              </a>
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, textAlign: 'center', color: '#252944', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          FFE Platform · Secured via Google OAuth
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Page wrapper (Suspense required for useSearchParams in Next.js App Router) ─
export default function InvitePage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', background: '#070910',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Loader2 size={20} style={{ color: '#0d7fff', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <InviteInner />
    </Suspense>
  );
}
