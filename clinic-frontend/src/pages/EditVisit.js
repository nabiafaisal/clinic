import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Save, Loader2, Paperclip, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';
import './Login.css';

const VISIT_MODES  = ['physical', 'video', 'audio', 'online'];
const CASE_TYPES   = ['acute', 'chronic', 'follow-up'];
const OUTCOMES     = ['improved', 'same', 'worse'];
const DELIVERY_ST  = ['pending', 'dispatched', 'delivered'];
const DURATION_OPTS = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '2 months', '3 months'];

export default function EditVisit() {
  const { visitId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [patientId, setPatientId] = useState(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [existingUploads, setExistingUploads] = useState([]);
  const [newFiles, setNewFiles]   = useState([]);
  const [form, setForm]           = useState(null);

  useEffect(() => {
    const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
    if (isMock) {
      setPatientId(1);
      setIsFinalized(false);
      setExistingUploads([]);
      setForm({
        visit_date: '2024-11-10', visit_mode: 'physical', case_type: 'follow-up',
        outcome: 'improved', next_followup_date: '', symptoms: 'Imp. much',
        physiology: '', pathology: '', sub_subscription: 'Sac Lac',
        main_remedy: 'Sulph 200', medicine_duration: '7 days',
        bill_charges: 500, consultation_charge: 300, medicine_charge: 200,
        finding_notes: 'Patient improving well.', delivery_required: false,
        delivery_status: '', doctor_name: 'Dr. Arshad Mahmood',
        doctor_reg_no: 'PMC-12345', telemedicine_consent: false,
      });
      setLoading(false);
      return;
    }
    Promise.all([
      api.get(`/visits/${visitId}`),
      api.get(`/visits/${visitId}/uploads`),
    ]).then(([vr, ur]) => {
      const d = vr.data;
      setPatientId(d.patient_id);
      setIsFinalized(d.status === 'finalized');
      setExistingUploads(ur.data || []);
      setForm({
        visit_date: d.visit_date ? d.visit_date.slice(0, 10) : '',
        visit_mode: d.visit_mode || 'physical',
        case_type: d.case_type || '',
        outcome: d.outcome || '',
        next_followup_date: d.next_followup_date ? d.next_followup_date.slice(0, 10) : '',
        symptoms: d.symptoms || '',
        physiology: d.physiology || '',
        pathology: d.pathology || '',
        sub_subscription: d.sub_subscription || '',
        main_remedy: d.main_remedy || '',
        medicine_duration: d.medicine_duration || '',
        bill_charges: d.bill_charges || 0,
        consultation_charge: d.consultation_charge || 0,
        medicine_charge: d.medicine_charge || 0,
        finding_notes: d.finding_notes || '',
        delivery_required: d.delivery_required || false,
        delivery_status: d.delivery_status || '',
        doctor_name: d.doctor_name || '',
        doctor_reg_no: d.doctor_reg_no || '',
        telemedicine_consent: d.telemedicine_consent || false,
      });
      setLoading(false);
    }).catch(() => { toast.error('Visit not found'); navigate(-1); });
  }, [visitId, navigate]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).filter(
      f => f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    setNewFiles(prev => [...prev, ...selected]);
  };

  const deleteExistingUpload = async (uploadId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await api.delete(`/visits/uploads/${uploadId}`);
      setExistingUploads(u => u.filter(f => f.id !== uploadId));
      toast.success('File deleted');
    } catch (e) {
      toast.error('Failed to delete file');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
      if (isMock) {
        toast.success('Saved (mock mode)');
        navigate(patientId ? `/patients/${patientId}` : '/diary');
        return;
      }
      const payload = { ...form };
      if (!payload.next_followup_date) delete payload.next_followup_date;
      if (!payload.delivery_status) delete payload.delivery_status;
      if (!payload.medicine_duration) delete payload.medicine_duration;
      await api.patch(`/visits/${visitId}`, payload);

      // Upload new files
      for (const file of newFiles) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post(`/visits/${visitId}/upload`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success('Visit updated!');
      navigate(patientId ? `/patients/${patientId}` : '/diary');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-center"><Loader2 size={24} className="spin" /></div>;
  if (!form) return null;

  const locked = isFinalized && user?.role !== 'doctor';
  const API_BASE = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="page-title">Edit Visit</h1>
          {isFinalized && <span className="badge badge--finalized">Finalized</span>}
        </div>
        <button className="btn btn--primary" onClick={handleSave} disabled={saving || locked}>
          {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {locked && (
        <div style={{ background: '#fff8e1', border: '1px solid #f0c040', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
          ⚠️ This visit is finalized. Only doctors can edit it.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="section-card">
          <div className="section-label">Visit Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Visit Date</label>
              <input className="form-input" type="date" value={form.visit_date} onChange={e => set('visit_date', e.target.value)} disabled={locked} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Visit Mode</label>
                <select className="form-input" value={form.visit_mode} onChange={e => set('visit_mode', e.target.value)} disabled={locked}>
                  {VISIT_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Case Type</label>
                <select className="form-input" value={form.case_type} onChange={e => set('case_type', e.target.value)} disabled={locked}>
                  <option value="">Select...</option>
                  {CASE_TYPES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Outcome</label>
                <select className="form-input" value={form.outcome} onChange={e => set('outcome', e.target.value)} disabled={locked}>
                  <option value="">Select...</option>
                  {OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Follow-up Date</label>
                <input className="form-input" type="date" value={form.next_followup_date} onChange={e => set('next_followup_date', e.target.value)} disabled={locked} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Symptoms</label>
              <textarea className="form-input" rows={3} value={form.symptoms} onChange={e => set('symptoms', e.target.value)} disabled={locked} />
            </div>
            <div className="form-group">
              <label className="form-label">Finding Notes</label>
              <textarea className="form-input" rows={3} value={form.finding_notes} onChange={e => set('finding_notes', e.target.value)} disabled={locked} />
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-label">Prescription & Charges</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Main Remedy</label>
              <input className="form-input" value={form.main_remedy} onChange={e => set('main_remedy', e.target.value)} disabled={locked} />
            </div>
            <div className="form-group">
              <label className="form-label">Sub Subscription</label>
              <textarea className="form-input" rows={2} value={form.sub_subscription} onChange={e => set('sub_subscription', e.target.value)} disabled={locked} />
            </div>
            <div className="form-group">
              <label className="form-label">Medicine Duration</label>
              <select className="form-input" value={form.medicine_duration} onChange={e => set('medicine_duration', e.target.value)} disabled={locked}>
                <option value="">Select...</option>
                {DURATION_OPTS.map(o => <option key={o}>{o}</option>)}
                <option value="custom">Custom...</option>
              </select>
              {form.medicine_duration === 'custom' && (
                <input className="form-input" style={{ marginTop: 6 }} placeholder="e.g. 6 weeks" onChange={e => set('medicine_duration', e.target.value)} disabled={locked} />
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Consultation Rs.</label>
                <input className="form-input" type="number" value={form.consultation_charge} onChange={e => set('consultation_charge', parseInt(e.target.value) || 0)} disabled={locked} />
              </div>
              <div className="form-group">
                <label className="form-label">Medicine Rs.</label>
                <input className="form-input" type="number" value={form.medicine_charge} onChange={e => set('medicine_charge', parseInt(e.target.value) || 0)} disabled={locked} />
              </div>
              <div className="form-group">
                <label className="form-label">Total Rs.</label>
                <input className="form-input" type="number" value={form.bill_charges} onChange={e => set('bill_charges', parseInt(e.target.value) || 0)} disabled={locked} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Doctor Name</label>
              <input className="form-input" value={form.doctor_name} onChange={e => set('doctor_name', e.target.value)} disabled={locked} />
            </div>
            <div className="form-group">
              <label className="form-label">Doctor Reg. No.</label>
              <input className="form-input" value={form.doctor_reg_no} onChange={e => set('doctor_reg_no', e.target.value)} disabled={locked} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form.delivery_required} onChange={e => set('delivery_required', e.target.checked)} disabled={locked} />
                  Delivery Required
                </label>
              </div>
              {form.delivery_required && (
                <div className="form-group">
                  <label className="form-label">Delivery Status</label>
                  <select className="form-input" value={form.delivery_status} onChange={e => set('delivery_status', e.target.value)} disabled={locked}>
                    <option value="">Select...</option>
                    {DELIVERY_ST.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
            {form.visit_mode !== 'physical' && (
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form.telemedicine_consent} onChange={e => set('telemedicine_consent', e.target.checked)} disabled={locked} />
                  Telemedicine Consent Taken
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attachments */}
      <div className="section-card" style={{ marginTop: 20 }}>
        <div className="section-label">Attachments</div>

        {existingUploads.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-lite)', marginBottom: 6 }}>Existing files:</div>
            {existingUploads.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
                <a href={`${API_BASE}${u.file_url}`} target="_blank" rel="noreferrer" style={{ color: 'var(--sage)' }}>
                  📎 {u.file_url.split('/').pop()}
                </a>
                {!locked && (
                  <button onClick={() => deleteExistingUpload(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-lite)' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!locked && (
          <>
            <label htmlFor="edit-file-upload" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px dashed var(--border, #ccc)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
              <Paperclip size={14} /> Add more files
            </label>
            <input id="edit-file-upload" type="file" accept=".pdf,image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />
            {newFiles.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {newFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: 13 }}>
                    <span>📎 {f.name}</span>
                    <button type="button" onClick={() => setNewFiles(fl => fl.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}