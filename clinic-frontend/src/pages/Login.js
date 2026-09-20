import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Stethoscope, Loader2, Mail, ArrowLeft } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import api from '../utils/api';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [step, setStep]       = useState('login');   // 'login' | 'otp'
  const [method, setMethod]   = useState('google');  // 'google' | 'email'
  const [email, setEmail]     = useState('');
  const [otp, setOtp]         = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // ── Step 1a: Google login ──────────────────────────────────────────────────
  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/google', {
        google_token: credentialResponse.credential,
      });
      setOtpEmail(res.data.email);
      setStep('otp');
    } catch (e) {
      setError(e.response?.data?.detail || 'Login failed. Make sure your account is registered.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1b: Email login ───────────────────────────────────────────────────
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your phone number.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/request-otp', { email: email.trim() });
      setOtpEmail(res.data.email);
      setStep('otp');
    } catch (e) {
      setError(e.response?.data?.detail || 'No account found with this email.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ─────────────────────────────────────────────────────
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        email: otpEmail,
        otp:   otp.trim(),
      });
      login(res.data.user, res.data.access_token);
      navigate('/');
    } catch (e) {
      setError(e.response?.data?.detail || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg"><div className="login-bg__pattern" /></div>

      <div className="login-card animate-in">
        <div className="login-card__header">
          <div className="login-card__icon">
            <Stethoscope size={26} />
          </div>
          <h1 className="login-card__title">Dr. Arshad Mahmood</h1>
          <p className="login-card__subtitle">Clinic Patient Record System</p>
        </div>

        {/* ── OTP step ── */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                background: 'var(--accent-lt, #d8ede3)', borderRadius: 50,
                width: 48, height: 48, display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 12px'
              }}>
                <Mail size={22} color="var(--sage, #2d6a4f)" />
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-mid)', marginBottom: 4 }}>
                OTP sent to
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                {otpEmail}
              </p>
              <p style={{ fontSize: 12, color: 'var(--ink-lite)', marginTop: 4 }}>
                Check your inbox — valid for 10 minutes
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <input
                className="form-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                style={{
                  textAlign: 'center', fontSize: 28, letterSpacing: 10,
                  fontWeight: 700, fontFamily: 'monospace', padding: '14px',
                  width: '100%'
                }}
                autoFocus
              />
            </div>

            {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

            <button type="submit" className="btn btn--sage" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : null}
              {loading ? 'Verifying…' : 'Verify OTP'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('login'); setOtp(''); setError(''); }}
              style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--ink-lite)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <ArrowLeft size={13} /> Back to login
            </button>
          </form>
        )}

        {/* ── Login step ── */}
        {step === 'login' && (
          <>
            {/* Tab selector */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1.5px solid var(--border, #e5e2d9)', borderRadius: 8, overflow: 'hidden' }}>
              {['google', 'email'].map(m => (
                <button
                  key={m}
                  onClick={() => { setMethod(m); setError(''); }}
                  style={{
                    flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                    background: method === m ? 'var(--sage, #2d6a4f)' : 'transparent',
                    color: method === m ? '#fff' : 'var(--ink-mid)',
                    transition: 'all 0.15s'
                  }}
                >
                  {m === 'google' ? '🔵 Google' : '📱 Phone'}
                </button>
              ))}
            </div>

            {method === 'google' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                {loading ? (
                  <div style={{ padding: '20px 0', textAlign: 'center' }}>
                    <Loader2 size={24} className="spin" style={{ color: 'var(--sage)' }} />
                    <p style={{ marginTop: 8, color: 'var(--ink-lite)', fontSize: 13 }}>Sending OTP…</p>
                  </div>
                ) : (
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google sign-in failed. Please try again.')}
                    useOneTap
                    theme="outline"
                    size="large"
                    text="signin_with"
                    shape="rectangular"
                  />
                )}
              </div>
            )}

            {method === 'email' && (
              <form onSubmit={handleEmailSubmit}>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Registered Phone Number</label>
              <input
              className="form-input"
                type="tel"
                  placeholder="+923001234567"
                    value={email}
                      onChange={e => setEmail(e.target.value)}
                        autoFocus
                />
                </div>
                <button type="submit" className="btn btn--sage" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading}>
                  {loading ? <Loader2 size={16} className="spin" /> : null}
                  {loading ? 'Sending OTP…' : 'Send OTP'}
                </button>
              </form>
            )}

            {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}

            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-lite)', marginTop: 20 }}>
              Access restricted to authorised clinic staff only.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
