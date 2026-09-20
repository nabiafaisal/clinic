import React, { useState } from 'react';
import axios from 'axios';
import { Stethoscope, Loader2, CheckCircle2 } from 'lucide-react';
import './Login.css';
import './Dashboard.css';

// Public booking page — no login required. Uses a plain axios instance
// (not the shared `api` client) so a stale/invalid token in this browser
// never gets attached or triggers the 401 → redirect-to-login interceptor.
const publicApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000',
});

const MODES = [
  ['physical', 'In-Clinic Visit'],
  ['video', 'Video Call'],
  ['audio', 'Audio Call'],
  ['online', 'Online / Chat'],
];

export default function BookAppointment() {
  const [form, setForm] = useState({
    patient_name: '', mobile_no: '', cnic: '', city: '',
    preferred_date: '', preferred_time: '', appointment_mode: 'physical', reason: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const formatCnic = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 13);
    const parts = [digits.slice(0, 5), digits.slice(5, 12), digits.slice(12, 13)].filter(Boolean);
    return parts.join('-');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patient_name.trim() || !form.mobile_no.trim()) {
      setError('Please enter your name and mobile number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.preferred_date) delete payload.preferred_date;
      await publicApi.post('/appointments/', payload);
      setDone(true);
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not send your request. Please try again or call the clinic directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg"><div className="login-bg__pattern" /></div>

      <div className="login-card animate-in" style={{ maxWidth: 480 }}>
        <div className="login-card__header">
          <div className="login-card__icon">
            <Stethoscope size={26} />
          </div>
          <h1 className="login-card__title">Dr. Arshad Mahmood</h1>
          <p className="login-card__subtitle">Request an Appointment</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={40} style={{ color: 'var(--sage, #2d6a4f)', marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Request received!</p>
            <p style={{ fontSize: 13, color: 'var(--ink-lite)' }}>
              The clinic will contact you at {form.mobile_no} to confirm your appointment.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.patient_name} onChange={e => set('patient_name', e.target.value)} required autoFocus />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Mobile Number *</label>
              <input className="form-input" type="tel" placeholder="03XX-XXXXXXX" value={form.mobile_no} onChange={e => set('mobile_no', e.target.value)} required />
            </div>

            <div className="form-row" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">CNIC # (optional)</label>
                <input className="form-input mono" maxLength={15} placeholder="XXXXX-XXXXXXX-X" value={form.cnic} onChange={e => set('cnic', formatCnic(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Preferred Consultation Type</label>
              <select className="form-select" value={form.appointment_mode} onChange={e => set('appointment_mode', e.target.value)}>
                {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div className="form-row" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Preferred Date</label>
                <input className="form-input" type="date" min={new Date().toISOString().slice(0, 10)} value={form.preferred_date} onChange={e => set('preferred_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Preferred Time</label>
                <input className="form-input" type="text" placeholder="e.g. 5:00 PM" value={form.preferred_time} onChange={e => set('preferred_time', e.target.value)} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Reason for Visit</label>
              <textarea className="form-textarea" rows={3} value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Briefly describe your symptoms or concern" />
            </div>

            {form.appointment_mode !== 'physical' && (
              <p style={{ fontSize: 12, color: 'var(--ink-lite)', marginBottom: 16 }}>
                By requesting an online consultation, you understand that telemedicine has limitations and an in-person evaluation may be required.
              </p>
            )}

            {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

            <button type="submit" className="btn btn--sage" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : null}
              {loading ? 'Sending…' : 'Request Appointment'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-lite)', marginTop: 16 }}>
              This is a request only — the clinic will call you to confirm the exact time.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
