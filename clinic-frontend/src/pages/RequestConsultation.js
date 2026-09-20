import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Stethoscope, Loader2, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import './Login.css';

const COUNTRY_CODES = [
  ['+92',  '🇵🇰 +92 Pakistan'],
  ['+1',   '🇺🇸 +1 USA/Canada'],
  ['+44',  '🇬🇧 +44 UK'],
  ['+971', '🇦🇪 +971 UAE'],
  ['+966', '🇸🇦 +966 Saudi Arabia'],
];

const MARITAL_OPTIONS = ['Married', 'Single', 'Widow', 'Widower', 'Divorced', 'Child', 'Infant'];

// Public page — NO login required. Anyone who tries to sign in with Google
// and isn't a staff account lands here too (see Login.js). Deliberately
// minimal: just personal info + when they'd like to be seen + a short note
// on their problem. This does NOT touch the patients table — it's saved to
// a separate "online_requests" table for staff to review. If the doctor
// wants to proceed after the consult (on Google Meet, separately), staff
// add the person as a proper patient themselves.
export default function RequestConsultation() {
  const location = useLocation();
  const prefill = location.state || {};

  const [form, setForm] = useState({
    name: prefill.name || '', fh_name: '', dob: '', age: '', marital_status: '',
    mobile_code: '+92', mobile_no: '',
    city: '', country: 'Pakistan',
    requested_date: '', requested_time: '', problem_summary: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleDobChange = (dob) => {
    const age = dob
      ? Math.floor((new Date() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000))
      : '';
    set('dob', dob);
    set('age', age ? `${age} yrs` : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Please enter your name.'); return; }
    setError('');
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        fh_name: form.fh_name.trim() || null,
        dob: form.dob || null,
        age: form.age || null,
        marital_status: form.marital_status || null,
        mobile_no: form.mobile_no ? `${form.mobile_code} ${form.mobile_no}` : null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        google_email: prefill.email || null,
        requested_date: form.requested_date || null,
        requested_time: form.requested_time || null,
        problem_summary: form.problem_summary.trim() || null,
      };
      await api.post('/online-requests/', payload);
      setDone(true);
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong. Please try again or call the clinic directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg"><div className="login-bg__pattern" /></div>

      <div className="login-card animate-in" style={{ maxWidth: 460 }}>
        <div className="login-card__header">
          <div className="login-card__icon">
            <Stethoscope size={26} />
          </div>
          <h1 className="login-card__title">Dr. Arshad Mahmood</h1>
          <p className="login-card__subtitle">Request an Online Consultation</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle size={36} style={{ color: 'var(--sage, #2d6a4f)', marginBottom: 10 }} />
            <p style={{ fontWeight: 600, marginBottom: 6 }}>Request received</p>
            <p style={{ fontSize: 13, color: 'var(--ink-lite)' }}>
              The clinic has been notified and will contact you shortly to confirm your
              online consultation.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="form-section-title" style={{ marginTop: 0 }}>Your Information</p>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Father / Husband Name</label>
              <input className="form-input" value={form.fh_name} onChange={e => set('fh_name', e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Date of Birth</label>
              <input
                className="form-input"
                type="date"
                value={form.dob}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => handleDobChange(e.target.value)}
              />
              {form.age && (
                <span style={{ fontSize: 12, color: 'var(--sage)', marginTop: 4, display: 'block' }}>
                  Age: {form.age}
                </span>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Marital Status</label>
              <select className="form-select" value={form.marital_status} onChange={e => set('marital_status', e.target.value)}>
                <option value="">— Select —</option>
                {MARITAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Mobile Number</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <select
                  className="form-select"
                  style={{ width: 110, flexShrink: 0 }}
                  value={form.mobile_code}
                  onChange={e => set('mobile_code', e.target.value)}
                >
                  {COUNTRY_CODES.map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="3XX-XXXXXXX"
                  value={form.mobile_no}
                  onChange={e => set('mobile_no', e.target.value)}
                  style={{ flex: 1, minWidth: 140 }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">City</label>
              <input className="form-input" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Country</label>
              <input className="form-input" value={form.country} onChange={e => set('country', e.target.value)} />
            </div>

            <p className="form-section-title">Appointment</p>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Preferred Date</label>
              <input
                className="form-input"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={form.requested_date}
                onChange={e => set('requested_date', e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Preferred Time</label>
              <input
                className="form-input"
                type="time"
                value={form.requested_time}
                onChange={e => set('requested_time', e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Briefly, what's the problem?</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="e.g. fever and headache for 3 days"
                value={form.problem_summary}
                onChange={e => set('problem_summary', e.target.value)}
              />
            </div>

            {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}

            <button type="submit" className="btn btn--sage" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : null}
              {loading ? 'Sending…' : 'Request Consultation'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-lite)', marginTop: 16 }}>
              The clinic will call you back to confirm your online consultation.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
