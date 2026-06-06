import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import './Dashboard.css';
import './Login.css';

const MARITAL_OPTIONS = ['Married', 'Single', 'Widow', 'Widower', 'Divorced', 'Child', 'Infant'];

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
        marital_status: 'Married', mobile_no: '03001234567', city: 'Lahore',
        country: 'Pakistan', patient_type: 'in-clinic', consent_taken: false,
        date_of_first_visit: '2020-03-15', know_patient_of: '',
        history: 'Long history of eczema', temperament: 'Introvert',
        first_subscription: 'Sulph 200', diagnosis: 'Chronic skin condition', remarks: '',
      });
      setLoading(false);
      return;
    }
    api.get(`/patients/${id}`).then(r => {
      const d = r.data;
      setForm({
        name: d.name || '', fh_name: d.fh_name || '', age: d.age || '',
        marital_status: d.marital_status || '', mobile_no: d.mobile_no || '',
        city: d.city || '', country: d.country || '', patient_type: d.patient_type || 'in-clinic',
        consent_taken: d.consent_taken || false,
        date_of_first_visit: d.date_of_first_visit ? d.date_of_first_visit.slice(0, 10) : '',
        know_patient_of: d.know_patient_of || '', history: d.history || '',
        temperament: d.temperament || '', first_subscription: d.first_subscription || '',
        diagnosis: d.diagnosis || '', remarks: d.remarks || '',
      });
      setLoading(false);
    }).catch(() => { toast.error('Failed to load patient'); navigate(`/patients/${id}`); });
  }, [id, navigate]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
      await api.patch(`/patients/${id}`, form);
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <F label="Age" field="age" />
              <div className="form-group">
                <label className="form-label">Marital Status</label>
                <select className="form-input" value={form.marital_status} onChange={e => set('marital_status', e.target.value)}>
                  <option value="">Select...</option>
                  {MARITAL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <F label="Mobile Number" field="mobile_no" />
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
            <F label="Know Patient Of" field="know_patient_of" />
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