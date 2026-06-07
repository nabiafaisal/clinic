import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import './Dashboard.css';
import './Login.css';

const MARITAL_OPTIONS = ['Married', 'Single', 'Widow', 'Widower', 'Divorced', 'Child', 'Infant'];
const TEMPERAMENT_OPTIONS = ['Sanguine', 'Phlegmatic', 'Choleric', 'Melancholic'];
const COUNTRY_CODES = [
  ['+92',  '🇵🇰 +92 Pakistan'],
  ['+1',   '🇺🇸 +1 USA/Canada'],
  ['+44',  '🇬🇧 +44 UK'],
  ['+971', '🇦🇪 +971 UAE'],
  ['+966', '🇸🇦 +966 Saudi Arabia'],
  ['+974', '🇶🇦 +974 Qatar'],
  ['+965', '🇰🇼 +965 Kuwait'],
  ['+968', '🇴🇲 +968 Oman'],
  ['+973', '🇧🇭 +973 Bahrain'],
  ['+93',  '🇦🇫 +93 Afghanistan'],
  ['+91',  '🇮🇳 +91 India'],
  ['+880', '🇧🇩 +880 Bangladesh'],
  ['+90',  '🇹🇷 +90 Turkey'],
  ['+20',  '🇪🇬 +20 Egypt'],
  ['+49',  '🇩🇪 +49 Germany'],
  ['+33',  '🇫🇷 +33 France'],
  ['+61',  '🇦🇺 +61 Australia'],
];

export default function NewPatient() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', fh_name: '', age: '', dob: '', marital_status: '',
    mobile_code: '+92', mobile_no: '',
    city: '', country: 'Pakistan',
    patient_type: 'in-clinic', consent_taken: false,
    know_patient_of: '', history: '', temperament: '',
    first_subscription: '', diagnosis: '', remarks: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    if (!form.name.trim()) { setError('Patient name is required.'); return; }
    setError('');
    setLoading(true);
    try {
      const payload = { ...form };
      // combine country code + number
      if (payload.mobile_no) {
        payload.mobile_no = `${payload.mobile_code} ${payload.mobile_no}`;
      }
      delete payload.mobile_code;
      delete payload.dob;
      payload.date_of_first_visit = new Date().toISOString().slice(0, 10);
      payload.consent_datetime = form.consent_taken ? new Date().toISOString() : null;

      const res = await api.post('/patients/', payload);
      navigate(`/patients/${res.data.id}`);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create patient. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/patients" className="btn btn--ghost btn--sm"><ArrowLeft size={14} /> Back</Link>
          <div>
            <h1 className="page-title">New Patient</h1>
            <p className="page-subtitle">Register a new patient record</p>
          </div>
        </div>
      </div>

      <div className="section-card" style={{ padding: '24px 28px 28px' }}>
        <form onSubmit={handleSubmit}>

          {/* Basic info */}
          <p className="form-section-title">Basic Information</p>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Father / Husband Name</label>
              <input className="form-input" value={form.fh_name} onChange={e => set('fh_name', e.target.value)} />
            </div>
          </div>

          <div className="form-row form-row--3">
            <div className="form-group">
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
            <div className="form-group">
              <label className="form-label">Marital Status</label>
              <select className="form-select" value={form.marital_status} onChange={e => set('marital_status', e.target.value)}>
                <option value="">— Select —</option>
                {MARITAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  className="form-select"
                  style={{ maxWidth: 130, flexShrink: 0 }}
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
                />
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input className="form-input" value={form.country} onChange={e => set('country', e.target.value)} />
            </div>
          </div>

          {/* Patient type & consent */}
          <p className="form-section-title">Consultation Type</p>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Patient Type</label>
              <select className="form-select" value={form.patient_type} onChange={e => set('patient_type', e.target.value)}>
                <option value="in-clinic">In-Clinic</option>
                <option value="online">Online / Telemedicine</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Known Patient Of</label>
              <input className="form-input" value={form.know_patient_of} onChange={e => set('know_patient_of', e.target.value)} />
            </div>
          </div>

          {form.patient_type === 'online' && (
            <div className="form-checkbox-row">
              <input
                type="checkbox"
                id="consent"
                checked={form.consent_taken}
                onChange={e => set('consent_taken', e.target.checked)}
              />
              <label htmlFor="consent">
                Patient has given telemedicine consent
                {form.consent_taken && (
                  <span style={{ marginLeft: 8, color: 'var(--sage)', fontSize: '0.78rem' }}>
                    <CheckCircle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Recorded at {new Date().toLocaleTimeString()}
                  </span>
                )}
              </label>
            </div>
          )}

          {/* Medical info */}
          <p className="form-section-title">Medical Information</p>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Temperament</label>
              <select className="form-select" value={form.temperament} onChange={e => set('temperament', e.target.value)}>
                <option value="">— Select —</option>
                {TEMPERAMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">First Remedy / Subscription</label>
              <input className="form-input mono" value={form.first_subscription} onChange={e => set('first_subscription', e.target.value)} placeholder="e.g. Sulph 200" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">History</label>
            <textarea className="form-textarea" value={form.history} onChange={e => set('history', e.target.value)} rows={3} />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Diagnosis</label>
            <textarea className="form-textarea" value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} rows={2} />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Remarks</label>
            <textarea className="form-textarea" value={form.remarks} onChange={e => set('remarks', e.target.value)} rows={2} />
          </div>

          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn--sage" disabled={loading}>
              {loading ? <Loader2 size={15} className="spin" /> : null}
              {loading ? 'Saving…' : 'Register Patient'}
            </button>
            <Link to="/patients" className="btn btn--ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
