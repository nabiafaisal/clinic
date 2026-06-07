import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const MARITAL_OPTIONS = ['Married', 'Single', 'Widow', 'Widower', 'Divorced', 'Child', 'Infant'];
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

function splitMobile(mobile_no) {
  if (!mobile_no) return { code: '+92', number: '' };
  for (const [code] of COUNTRY_CODES) {
    if (mobile_no.startsWith(code + ' ')) {
      return { code, number: mobile_no.slice(code.length + 1) };
    }
  }
  return { code: '+92', number: mobile_no };
}

export default function EditPatient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
    if (isMock) {
      setForm({
        name: 'Muhammad Anwar', fh_name: 'Ghulam Hussain', age: '45',
        dob: '1979-01-01', marital_status: 'Married',
        mobile_code: '+92', mobile_no: '03001234567',
        city: 'Lahore', country: 'Pakistan',
        patient_type: 'in-clinic', consent_taken: false,
        date_of_first_visit: '2020-03-15', know_patient_of: '',
        history: 'Long history of eczema', temperament: 'Introvert',
        first_subscription: 'Sulph 200', diagnosis: 'Chronic skin condition', remarks: '',
      });
      setLoading(false);
      return;
    }
    api.get(`/patients/${id}`).then(r => {
      const d = r.data;
      const { code, number } = splitMobile(d.mobile_no);
      setForm({
        name: d.name || '', fh_name: d.fh_name || '',
        age: d.age || '', dob: '',
        marital_status: d.marital_status || '',
        mobile_code: code, mobile_no: number,
        city: d.city || '', country: d.country || '',
        patient_type: d.patient_type || 'in-clinic',
        consent_taken: d.consent_taken || false,
        date_of_first_visit: d.date_of_first_visit ? d.date_of_first_visit.slice(0, 10) : '',
        know_patient_of: d.know_patient_of || '',
        history: d.history || '', temperament: d.temperament || '',
        first_subscription: d.first_subscription || '',
        diagnosis: d.diagnosis || '', remarks: d.remarks || '',
      });
      setLoading(false);
    }).catch(() => { toast.error('Failed to load patient'); navigate(`/patients/${id}`); });
  }, [id, navigate]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleDobChange = (dob) => {
    const age = dob
      ? Math.floor((new Date() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000))
      : '';
    set('dob', dob);
    set('age', age ? `${age} yrs` : '');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
      if (isMock) {
        toast.success('Saved (mock mode)');
        navigate(`/patients/${id}`);
        return;
      }
      const payload = { ...form };
      if (payload.mobile_no) {
        payload.mobile_no = `${payload.mobile_code} ${payload.mobile_no}`;
      }
      delete payload.mobile_code;
      delete payload.dob;
      await api.patch(`/patients/${id}`, payload);
      toast.success('Patient updated!');
      navigate(`/patients/${id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-center"><Loader2 size={24} className="spin" /></div>;
  if (!form) return null;

  const F = ({ label, field, type = 'text' }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} value={form[field]} onChange={e => set(field, e.target.value)} />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--ghost" onClick={() => navigate(`/patients/${id}`)}>
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="page-title">Edit Patient</h1>
        </div>
        <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="section-card">
          <div className="section-label">Basic Information</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <F label="Full Name *" field="name" />
            <F label="Father / Husband Name" field="fh_name" />

            {/* DOB + auto age */}
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                className="form-input"
                type="date"
                value={form.dob || ''}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => handleDobChange(e.target.value)}
              />
              {form.age && (
                <span style={{ fontSize: 12, color: 'var(--sage)', marginTop: 4, display: 'block' }}>
                  Age: {form.age}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Marital Status</label>
                <select className="form-input" value={form.marital_status} onChange={e => set('marital_status', e.target.value)}>
                  <option value="">Select...</option>
                  {MARITAL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* Mobile with country code */}
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  className="form-input"
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <F label="City" field="city" />
              <F label="Country" field="country" />
            </div>
            <div className="form-group">
              <label className="form-label">Patient Type</label>
              <select className="form-input" value={form.patient_type} onChange={e => set('patient_type', e.target.value)}>
                <option value="in-clinic">In-Clinic</option>
                <option value="online">Online</option>
              </select>
            </div>
            {form.patient_type === 'online' && (
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={form.consent_taken} onChange={e => set('consent_taken', e.target.checked)} />
                  Telemedicine Consent Taken
                </label>
              </div>
            )}
            <F label="Date of First Visit" field="date_of_first_visit" type="date" />
            <F label="Known Patient Of" field="know_patient_of" />
          </div>
        </div>

        <div className="section-card">
          <div className="section-label">Medical Background</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <F label="Temperament" field="temperament" />
            <div className="form-group">
              <label className="form-label">Diagnosis</label>
              <textarea className="form-input" rows={3} value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">History</label>
              <textarea className="form-input" rows={3} value={form.history} onChange={e => set('history', e.target.value)} />
            </div>
            <F label="First Subscription" field="first_subscription" />
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea className="form-input" rows={3} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
