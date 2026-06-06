import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Loader2, CheckCircle, Paperclip, X } from 'lucide-react';
import './Dashboard.css';
import './Login.css';

const MARITAL_OPTIONS = ['Married', 'Single', 'Widow', 'Widower', 'Divorced', 'Child', 'Infant'];
const TEMPERAMENT_OPTIONS = ['Sanguine', 'Phlegmatic', 'Choleric', 'Melancholic'];

export default function NewPatient() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', fh_name: '', age: '', marital_status: '',
    mobile_no: '', city: '', country: 'Pakistan',
    patient_type: 'in-clinic', consent_taken: false,
    know_patient_of: '', history: '', temperament: '',
    first_subscription: '', diagnosis: '', remarks: '',
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    const valid = selected.filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    if (valid.length !== selected.length) {
      setError('Only PDF and image files are allowed.');
    }
    setFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (idx) => setFiles(f => f.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Patient name is required.'); return; }
    setError('');
    setLoading(true);
    try {
      const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
      if (isMock) {
        alert('Mock mode: patient saved locally (not sent to backend).');
        navigate('/patients');
        return;
      }

      const res = await api.post('/patients/', {
        ...form,
        date_of_first_visit: new Date().toISOString().slice(0, 10),
        consent_datetime: form.consent_taken ? new Date().toISOString() : null,
      });

      const newPatientId = res.data.id;

      // Upload files if any
      if (files.length > 0) {
        setUploadingFiles(true);
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          await api.post(`/patients/${newPatientId}/upload`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
        setUploadingFiles(false);
      }

      navigate(`/patients/${newPatientId}`);
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
              <label className="form-label">Age</label>
              <input className="form-input" value={form.age} onChange={e => set('age', e.target.value)} placeholder="e.g. 35 yrs" />
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
              <input className="form-input" value={form.mobile_no} onChange={e => set('mobile_no', e.target.value)} placeholder="03XX-XXXXXXX" />
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
              <label className="form-label">Know Patient Of</label>
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

          {/* File uploads */}
          <p className="form-section-title">Attachments (ID Card, Referral, Old Records)</p>
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="patient-file-upload"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', border: '1.5px dashed var(--border, #ccc)',
                borderRadius: 8, cursor: 'pointer', fontSize: 13,
                color: 'var(--ink-mid)', background: 'var(--bg, #fafafa)'
              }}
            >
              <Paperclip size={14} /> Attach PDF or Image
            </label>
            <input
              id="patient-file-upload"
              type="file"
              accept=".pdf,image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {files.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {files.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', background: 'var(--bg, #f5f5f5)',
                    borderRadius: 6, fontSize: 13
                  }}>
                    <span>📎 {f.name} <span style={{ color: 'var(--ink-lite)', fontSize: 11 }}>({(f.size / 1024).toFixed(0)} KB)</span></span>
                    <button type="button" onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-lite)' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn--sage" disabled={loading || uploadingFiles}>
              {(loading || uploadingFiles) ? <Loader2 size={15} className="spin" /> : null}
              {uploadingFiles ? 'Uploading files…' : loading ? 'Saving…' : 'Register Patient'}
            </button>
            <Link to="/patients" className="btn btn--ghost">Cancel</Link>
          </div>

        </form>
      </div>
    </div>
  );
}