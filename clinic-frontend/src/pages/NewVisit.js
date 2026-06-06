import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Loader2, CheckCircle, Paperclip, X } from 'lucide-react';
import './Dashboard.css';
import './Login.css';

const SYMPTOM_OPTS = ['Imp.', 'Imp. more', 'Imp. much', 'Imp. slight', 'Same', 'Worse', 'New case'];
const REMEDY_SUGGESTIONS = ['Sulph 200', 'Lyco 200', 'Nat-m 200', 'Puls 200', 'Colocynth 200', 'Bryonia 200', 'Nux-v 200'];
const DURATION_OPTS = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '2 months', '3 months'];

export default function NewVisit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState({
    patient_id: parseInt(id),
    visit_date: new Date().toISOString().slice(0, 10),
    visit_mode: 'physical',
    case_type: 'follow-up',
    outcome: '',
    next_followup_date: '',
    symptoms: '',
    physiology: '',
    pathology: '',
    sub_subscription: '',
    main_remedy: '',
    medicine_duration: '',
    bill_charges: '',
    consultation_charge: '',
    medicine_charge: '',
    finding_notes: '',
    delivery_required: false,
    delivery_status: '',
    doctor_name: '',
    doctor_reg_no: '',
    telemedicine_consent: false,
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
    if (isMock) {
      setPatient({ id: parseInt(id), name: 'Muhammad Anwar', legacy_fileno: `100${id}` });
      return;
    }
    api.get(`/patients/${id}`).then(r => setPatient(r.data)).catch(() => {});
  }, [id]);

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
    setError('');
    setLoading(true);
    try {
      const payload = { ...form };
      ['outcome', 'next_followup_date', 'physiology', 'pathology',
       'delivery_status', 'doctor_reg_no', 'medicine_duration'].forEach(k => {
        if (payload[k] === '') payload[k] = null;
      });
      ['bill_charges', 'consultation_charge', 'medicine_charge'].forEach(k => {
        payload[k] = parseInt(payload[k]) || 0;
      });

      const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
      if (isMock) {
        alert('Mock mode: visit saved locally (not sent to backend).');
        navigate(`/patients/${id}`);
        return;
      }

      const res = await api.post('/visits/', payload);
const newVisitId = res.data.id;

      // Upload files if any
      if (files.length > 0) {
        setUploadingFiles(true);
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          await api.post(`/visits/${newVisitId}/upload`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
        setUploadingFiles(false);
      }

      navigate(`/patients/${id}`);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save visit.');
    } finally {
      setLoading(false);
    }
  };

  const isOnline = form.visit_mode !== 'physical';

  return (
    <div className="animate-in" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to={`/patients/${id}`} className="btn btn--ghost btn--sm"><ArrowLeft size={14} /> Back</Link>
          <div>
            <h1 className="page-title">New Visit</h1>
            <p className="page-subtitle">
              {patient ? `${patient.name} · File #${patient.legacy_fileno || patient.id}` : 'Loading…'}
            </p>
          </div>
        </div>
      </div>

      <div className="section-card" style={{ padding: '24px 28px 28px' }}>
        <form onSubmit={handleSubmit}>

          {/* Visit basics */}
          <p className="form-section-title">Visit Details</p>
          <div className="form-row form-row--3">
            <div className="form-group">
              <label className="form-label">Visit Date *</label>
              <input type="date" className="form-input" value={form.visit_date} onChange={e => set('visit_date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Visit Mode</label>
              <select className="form-select" value={form.visit_mode} onChange={e => set('visit_mode', e.target.value)}>
                <option value="physical">Physical</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="online">Online / Chat</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Case Type</label>
              <select className="form-select" value={form.case_type} onChange={e => set('case_type', e.target.value)}>
                <option value="follow-up">Follow-up</option>
                <option value="acute">Acute</option>
                <option value="chronic">Chronic</option>
              </select>
            </div>
          </div>

          {/* Telemedicine consent */}
          {isOnline && (
            <div className="form-checkbox-row" style={{ background: 'rgba(42,110,158,0.06)', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>
              <input
                type="checkbox"
                id="tele_consent"
                checked={form.telemedicine_consent}
                onChange={e => set('telemedicine_consent', e.target.checked)}
              />
              <label htmlFor="tele_consent" style={{ fontWeight: 500 }}>
                "I consent to receive medical consultation through telemedicine and understand its limitations."
                {form.telemedicine_consent && (
                  <span style={{ marginLeft: 8, color: 'var(--sky)', fontSize: '0.78rem' }}>
                    <CheckCircle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {new Date().toLocaleTimeString()}
                  </span>
                )}
              </label>
            </div>
          )}

          {/* Clinical */}
          <p className="form-section-title">Clinical Details</p>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Symptoms / Progress</label>
              <select className="form-select" value={form.symptoms} onChange={e => set('symptoms', e.target.value)}>
                <option value="">— Select —</option>
                {SYMPTOM_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                <option value="custom">Type custom…</option>
              </select>
              {form.symptoms === 'custom' && (
                <input
                  className="form-input"
                  style={{ marginTop: 6 }}
                  placeholder="Describe symptoms"
                  onChange={e => set('symptoms', e.target.value)}
                />
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Outcome</label>
              <select className="form-select" value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                <option value="">— Select —</option>
                <option value="improved">Improved</option>
                <option value="same">Same</option>
                <option value="worse">Worse</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Main Remedy</label>
            <input
              className="form-input mono"
              list="remedy-list"
              value={form.main_remedy}
              onChange={e => set('main_remedy', e.target.value)}
              placeholder="e.g. Sulph 200"
            />
            <datalist id="remedy-list">
              {REMEDY_SUGGESTIONS.map(r => <option key={r} value={r} />)}
            </datalist>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Sub Subscription</label>
            <input className="form-input mono" value={form.sub_subscription} onChange={e => set('sub_subscription', e.target.value)} placeholder="Additional remedies / doses" />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Medicine Duration</label>
            <select className="form-select" value={form.medicine_duration} onChange={e => set('medicine_duration', e.target.value)}>
              <option value="">— Select —</option>
              {DURATION_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              <option value="custom">Type custom…</option>
            </select>
            {form.medicine_duration === 'custom' && (
              <input
                className="form-input"
                style={{ marginTop: 6 }}
                placeholder="e.g. 6 weeks"
                onChange={e => set('medicine_duration', e.target.value)}
              />
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Finding / Notes</label>
            <textarea className="form-textarea" value={form.finding_notes} onChange={e => set('finding_notes', e.target.value)} rows={3} />
          </div>

          {/* Doctor */}
          <p className="form-section-title">Doctor Details</p>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Doctor Name *</label>
              <input className="form-input" value={form.doctor_name} onChange={e => set('doctor_name', e.target.value)} placeholder="Dr. Arshad Mahmood" />
            </div>
            <div className="form-group">
              <label className="form-label">Registration No.</label>
              <input className="form-input mono" value={form.doctor_reg_no} onChange={e => set('doctor_reg_no', e.target.value)} />
            </div>
          </div>

          {/* Charges */}
          <p className="form-section-title">Charges</p>
          <div className="form-row form-row--3">
            <div className="form-group">
              <label className="form-label">Consultation (Rs.)</label>
              <input type="number" className="form-input" value={form.consultation_charge} onChange={e => set('consultation_charge', e.target.value)} min="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Medicine (Rs.)</label>
              <input type="number" className="form-input" value={form.medicine_charge} onChange={e => set('medicine_charge', e.target.value)} min="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Bill Total (Rs.)</label>
              <input type="number" className="form-input" value={form.bill_charges} onChange={e => set('bill_charges', e.target.value)} min="0" />
            </div>
          </div>

          {/* Delivery */}
          <div className="form-checkbox-row">
            <input type="checkbox" id="delivery" checked={form.delivery_required} onChange={e => set('delivery_required', e.target.checked)} />
            <label htmlFor="delivery">Medicine delivery required</label>
          </div>
          {form.delivery_required && (
            <div className="form-group" style={{ marginTop: 8, maxWidth: 240 }}>
              <label className="form-label">Delivery Status</label>
              <select className="form-select" value={form.delivery_status} onChange={e => set('delivery_status', e.target.value)}>
                <option value="pending">Pending</option>
                <option value="dispatched">Dispatched</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
          )}

          {/* Follow-up */}
          <p className="form-section-title">Follow-up</p>
          <div className="form-group" style={{ maxWidth: 220 }}>
            <label className="form-label">Next Follow-up Date</label>
            <input type="date" className="form-input" value={form.next_followup_date} onChange={e => set('next_followup_date', e.target.value)} />
          </div>

          {/* File uploads */}
          <p className="form-section-title">Attachments (Reports / Photos)</p>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="file-upload"
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
              id="file-upload"
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

          {error && <div className="login-error" style={{ margin: '16px 0' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn--sage" disabled={loading || uploadingFiles}>
              {(loading || uploadingFiles) ? <Loader2 size={15} className="spin" /> : null}
              {uploadingFiles ? 'Uploading files…' : loading ? 'Saving…' : 'Save Visit'}
            </button>
            <Link to={`/patients/${id}`} className="btn btn--ghost">Cancel</Link>
          </div>

        </form>
      </div>
    </div>
  );
}