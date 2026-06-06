import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, PlusCircle, Phone, MapPin, Calendar,
  Loader2, ChevronDown, ChevronUp, Lock
} from 'lucide-react';
import './PatientDetail.css';
import './Dashboard.css';

export default function PatientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedVisit, setExpandedVisit] = useState(null);

  useEffect(() => {
    const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
    if (isMock) {
      setPatient({
        id: parseInt(id), legacy_fileno: `100${id}`, name: 'Muhammad Anwar',
        fh_name: 'Ghulam Hussain', age: '45', marital_status: 'Married',
        mobile_no: '03001234567', city: 'Lahore', country: 'Pakistan',
        patient_type: 'in-clinic', date_of_first_visit: '2020-03-15',
        temperament: 'Introvert', first_subscription: 'Sulph 200',
        diagnosis: 'Chronic skin condition', history: 'Long history of eczema',
        remarks: '', know_patient_of: '',
      });
      setVisits([
        {
          id: 1, visit_date: '2024-11-10', visit_mode: 'physical', case_type: 'follow-up',
          symptoms: 'Imp. much', main_remedy: 'Sulph 200', sub_subscription: 'Sac Lac',
          bill_charges: 500, consultation_charge: 300, medicine_charge: 200,
          finding_notes: 'Patient showing good improvement.', status: 'finalized',
          doctor_name: 'Dr. Arshad Mahmood', outcome: 'improved',
        },
        {
          id: 2, visit_date: '2024-08-22', visit_mode: 'physical', case_type: 'follow-up',
          symptoms: 'Imp. slight', main_remedy: 'Lyco 200', sub_subscription: '',
          bill_charges: 400, consultation_charge: 300, medicine_charge: 100,
          finding_notes: '', status: 'draft',
          doctor_name: 'Dr. Arshad Mahmood', outcome: 'same',
        },
      ]);
      setLoading(false);
      return;
    }
    Promise.all([
      api.get(`/patients/${id}`),
      api.get(`/patients/${id}/visits`),
    ]).then(([pr, vr]) => {
      setPatient(pr.data);
      setVisits(vr.data || []);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [id]);

  const handleFinalize = async (visitId) => {
    if (!window.confirm('Finalize this visit? It will be locked for editing.')) return;
    try {
      await api.post(`/visits/${visitId}/finalize`);
      setVisits(v => v.map(x => x.id === visitId ? { ...x, status: 'finalized' } : x));
    } catch (e) {
      alert(e.response?.data?.detail || 'Error finalizing visit');
    }
  };

  if (loading) return (
    <div className="loading-center">
      <Loader2 size={24} className="spin" style={{ color: 'var(--sage)' }} />
    </div>
  );
  if (!patient) return <div className="empty-text">Patient not found.</div>;

  const canEdit = user?.role === 'doctor' || user?.role === 'reception';
  const API_BASE = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

  return (
    <div className="patient-detail animate-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="page-title">{patient.name}</h1>
            <p className="page-subtitle">
              File #{patient.legacy_fileno || patient.id}
              {patient.fh_name && ` · S/o D/o W/o ${patient.fh_name}`}
            </p>
          </div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--ghost btn--sm" onClick={() => navigate(`/patients/${id}/edit`)}>
              ✏️ Edit Patient
            </button>
            <Link to={`/patients/${id}/visits/new`} className="btn btn--sage">
              <PlusCircle size={14} /> New Visit
            </Link>
          </div>
        )}
      </div>

      {/* Patient info card */}
      <div className="patient-info-card section-card">
        <div className="patient-info-grid">
          <InfoItem label="Age" value={patient.age} />
          <InfoItem label="Marital Status" value={patient.marital_status} />
          <InfoItem label="Patient Type" value={patient.patient_type} badge />
          <InfoItem label="Mobile" value={patient.mobile_no} icon={<Phone size={12} />} />
          <InfoItem label="City" value={patient.city} icon={<MapPin size={12} />} />
          <InfoItem
            label="First Visit"
            value={patient.date_of_first_visit
              ? new Date(patient.date_of_first_visit).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })
              : null}
            icon={<Calendar size={12} />}
          />
          {patient.know_patient_of && <InfoItem label="Referred by" value={patient.know_patient_of} />}
          {patient.temperament && <InfoItem label="Temperament" value={patient.temperament} />}
          {patient.first_subscription && <InfoItem label="First Remedy" value={patient.first_subscription} mono />}
        </div>
        {patient.history   && <div className="patient-history"><span className="patient-history__label">History</span><p>{patient.history}</p></div>}
        {patient.diagnosis && <div className="patient-history"><span className="patient-history__label">Diagnosis</span><p>{patient.diagnosis}</p></div>}
        {patient.remarks   && <div className="patient-history"><span className="patient-history__label">Remarks</span><p>{patient.remarks}</p></div>}
      </div>

      {/* Visit history */}
      <div className="section-card">
        <div className="section-card__header">
          <h2 className="section-card__title">Visit History ({visits.length})</h2>
        </div>

        {visits.length === 0 ? (
          <p className="empty-text">No visits recorded yet.</p>
        ) : (
          <div className="visits-accordion">
            {visits.map(v => (
              <div key={v.id} className={`visit-card ${expandedVisit === v.id ? 'visit-card--open' : ''}`}>
                <button
                  className="visit-card__header"
                  onClick={() => setExpandedVisit(expandedVisit === v.id ? null : v.id)}
                >
                  <div className="visit-card__left">
                    <span className="visit-card__date">
                      {v.visit_date
                        ? new Date(v.visit_date).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })
                        : 'Date unknown'}
                    </span>
                    {v.main_remedy && <span className="visit-card__remedy mono">{v.main_remedy}</span>}
                    {v.symptoms && <span className="visit-card__symptoms">{v.symptoms.slice(0, 60)}{v.symptoms.length > 60 ? '…' : ''}</span>}
                  </div>
                  <div className="visit-card__right">
                    <span className={`badge badge--${v.visit_mode || 'physical'}`}>{v.visit_mode || 'physical'}</span>
                    <span className={`badge badge--${v.status}`}>{v.status}</span>
                    {v.status === 'finalized' && <Lock size={12} color="var(--ink-lite)" />}
                    {expandedVisit === v.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {expandedVisit === v.id && (
                  <div className="visit-card__body animate-in">
                    <div className="visit-detail-grid">
                      {v.case_type               && <DetailItem label="Case Type"    value={v.case_type} />}
                      {v.outcome                 && <DetailItem label="Outcome"      value={v.outcome} />}
                      {v.doctor_name             && <DetailItem label="Doctor"       value={v.doctor_name} />}
                      {v.bill_charges > 0        && <DetailItem label="Bill"         value={`Rs. ${v.bill_charges}`} />}
                      {v.consultation_charge > 0 && <DetailItem label="Consultation" value={`Rs. ${v.consultation_charge}`} />}
                      {v.medicine_charge > 0     && <DetailItem label="Medicine"     value={`Rs. ${v.medicine_charge}`} />}
                      {v.delivery_status         && <DetailItem label="Delivery"     value={v.delivery_status} badge />}
                      {v.next_followup_date      && <DetailItem label="Follow-up"    value={new Date(v.next_followup_date).toLocaleDateString('en-PK')} />}
                    </div>

                    {v.sub_subscription && (
                      <div className="visit-detail-field">
                        <span className="visit-detail-field__label">Sub Subscription</span>
                        <span className="mono">{v.sub_subscription}</span>
                      </div>
                    )}
                    {v.symptoms && (
                      <div className="visit-detail-field">
                        <span className="visit-detail-field__label">Symptoms</span>
                        <p>{v.symptoms}</p>
                      </div>
                    )}
                    {v.finding_notes && (
                      <div className="visit-detail-field">
                        <span className="visit-detail-field__label">Notes</span>
                        <p>{v.finding_notes}</p>
                      </div>
                    )}
                    {v.physiology && (
                      <div className="visit-detail-field">
                        <span className="visit-detail-field__label">Physiology</span>
                        <p>{v.physiology}</p>
                      </div>
                    )}
                    {v.pathology && (
                      <div className="visit-detail-field">
                        <span className="visit-detail-field__label">Pathology</span>
                        <p>{v.pathology}</p>
                      </div>
                    )}

                    <VisitUploads visitId={v.id} apiBase={API_BASE} />

                    {/* Actions */}
                    <div className="visit-card__actions">
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => window.open(`/patients/${id}/visits/${v.id}/print`, '_blank')}
                      >
                        🖨 Print Prescription
                      </button>
                      {canEdit && (
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => navigate(`/visits/${v.id}/edit`)}
                        >
                          ✏️ Edit Visit
                        </button>
                      )}
                      {canEdit && v.status !== 'finalized' && user?.role === 'doctor' && (
                        <button className="btn btn--primary btn--sm" onClick={() => handleFinalize(v.id)}>
                          <Lock size={12} /> Finalize Visit
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value, icon, badge, mono }) {
  if (!value) return null;
  return (
    <div className="info-item">
      <span className="info-item__label">{label}</span>
      <span className={`info-item__value ${mono ? 'mono' : ''}`}>
        {icon && <span style={{ opacity: 0.5 }}>{icon}</span>}
        {badge ? <span className={`badge badge--${value}`}>{value}</span> : value}
      </span>
    </div>
  );
}

function DetailItem({ label, value, badge }) {
  return (
    <div className="detail-item">
      <span className="detail-item__label">{label}</span>
      <span className="detail-item__value">
        {badge ? <span className={`badge badge--${value}`}>{value}</span> : value}
      </span>
    </div>
  );
}

function VisitUploads({ visitId, apiBase }) {
  const [uploads, setUploads] = React.useState([]);
  const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');

  React.useEffect(() => {
    if (isMock) return;
    import('../utils/api').then(({ default: api }) => {
      api.get(`/visits/${visitId}/uploads`)
        .then(r => setUploads(r.data || []))
        .catch(() => {});
    });
  }, [visitId, isMock]);

  if (uploads.length === 0) return null;

  return (
    <div className="visit-detail-field">
      <span className="visit-detail-field__label">Attachments</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        {uploads.map(u => (
          <a
            key={u.id}
            href={`${apiBase}${u.file_url}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: 'var(--sage)', textDecoration: 'none' }}
          >
            📎 {u.file_url.split('/').pop()}
          </a>
        ))}
      </div>
    </div>
  );
}