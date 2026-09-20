import React, { useState } from 'react';
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

// Public page — NO login required. Patients fill this in themselves.
// Intentionally minimal: just enough for the clinic to identify and call
// them back. No history/diagnosis/medical fields — staff fill those in
// once they follow up.
export default function RequestConsultation() {
  const [form, setForm] = useState({
    name: '', fh_name: '',
    mobile_code: '+92', mobile_no: '',
    city: '', country: 'Pakistan',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Please enter your name.'); return; }
    setError('');
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        fh_name: form.fh_name.trim() || null,
        mobile_no: form.mobile_no ? `${form.mobile_code} ${form.mobile_no}` : null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
      };
      await api.post('/patients/public-request', payload);
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

      <div className="login-card animate-in">
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
              The clinic has been notified and will contact you shortly to arrange your
              online consultation.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Father / Husband Name</label>
              <input className="form-input" value={form.fh_name} onChange={e => set('fh_name', e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Mobile Number</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  className="form-select"
                  style={{ maxWidth: 110, flexShrink: 0 }}
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
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">City</label>
              <input className="form-input" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>

            {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}

            <button type="submit" className="btn btn--sage" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : null}
              {loading ? 'Sending…' : 'Request Consultation'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-lite)', marginTop: 16 }}>
              The clinic will call you back to arrange your online consultation.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
