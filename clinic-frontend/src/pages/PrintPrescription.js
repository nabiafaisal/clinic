import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';

const MOCK_PATIENT = {
  name: 'Muhammad Anwar', fh_name: 'Ghulam Hussain', age: '45',
  mobile_no: '03001234567', city: 'Lahore', diagnosis: 'Chronic skin condition',
};
const MOCK_VISIT = {
  visit_date: new Date().toISOString().slice(0, 10),
  visit_mode: 'physical', doctor_name: 'Dr. Arshad Mahmood',
  doctor_reg_no: 'PMC-12345', main_remedy: 'Sulphur 200',
  sub_subscription: 'Sac Lac 30 × 7 days', symptoms: 'Imp. much',
  finding_notes: 'Patient responding well. Continue treatment.',
  consultation_charge: 300, medicine_charge: 200, bill_charges: 500,
  telemedicine_consent: false,
};

export default function PrintPrescription() {
  const { id, visitId } = useParams();
  const [patient, setPatient] = useState(null);
  const [visit, setVisit]     = useState(null);

  useEffect(() => {
    const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
    if (isMock) {
      setPatient(MOCK_PATIENT);
      setVisit(MOCK_VISIT);
      return;
    }
    Promise.all([
      api.get(`/patients/${id}`),
      api.get(`/visits/${visitId}`),
    ]).then(([pr, vr]) => {
      setPatient(pr.data);
      setVisit(vr.data);
    });
  }, [id, visitId]);

  useEffect(() => {
    if (patient && visit) window.print();
  }, [patient, visit]);

  if (!patient || !visit) return <div style={{ padding: 40, fontFamily: 'serif' }}>Loading…</div>;

  const isOnline = visit.visit_mode !== 'physical';
  const dateStr = visit.visit_date
    ? new Date(visit.visit_date).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ fontFamily: 'Georgia, serif', maxWidth: 680, margin: '0 auto', padding: '40px 50px', color: '#111' }}>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
        }
        hr { border: none; border-top: 1px solid #333; margin: 14px 0; }
        .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; }
        .value { font-size: 14px; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        td, th { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a3a5c', margin: 0 }}>Dr. Arshad Mahmood Clinic</h1>
        <p style={{ fontSize: 13, color: '#555', margin: '4px 0 0' }}>Homeopathic Physician · Lahore, Pakistan</p>
        <hr />
      </div>

      {/* Doctor & Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13 }}>
        <div>
          <div className="label">Doctor</div>
          <div className="value" style={{ fontWeight: 600 }}>{visit.doctor_name || 'Dr. Arshad Mahmood'}</div>
          {visit.doctor_reg_no && <div style={{ fontSize: 12, color: '#555' }}>Reg. No: {visit.doctor_reg_no}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label">Date</div>
          <div className="value">{dateStr}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
            {visit.visit_mode ? visit.visit_mode.charAt(0).toUpperCase() + visit.visit_mode.slice(1) : 'Physical'} consultation
          </div>
        </div>
      </div>

      <hr />

      {/* Patient info */}
      <div style={{ marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 8 }}>Patient Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 20px', fontSize: 13 }}>
          <div><span style={{ color: '#666' }}>Name: </span><strong>{patient.name}</strong></div>
          <div><span style={{ color: '#666' }}>F/H Name: </span>{patient.fh_name || '—'}</div>
          <div><span style={{ color: '#666' }}>Age: </span>{patient.age || '—'}</div>
          <div><span style={{ color: '#666' }}>Mobile: </span>{patient.mobile_no || '—'}</div>
          <div><span style={{ color: '#666' }}>City: </span>{patient.city || '—'}</div>
          {patient.diagnosis && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#666' }}>Diagnosis: </span>{patient.diagnosis}</div>}
        </div>
      </div>

      <hr />

      {/* Prescription */}
      <div style={{ marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 8 }}>Prescription (Rx)</div>
        <table>
          <thead>
            <tr>
              <th>Medicine / Remedy</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {visit.main_remedy && (
              <tr>
                <td style={{ fontWeight: 600, fontFamily: 'Courier New, monospace' }}>{visit.main_remedy}</td>
                <td>Main remedy</td>
              </tr>
            )}
            {visit.sub_subscription && (
              <tr>
                <td style={{ fontFamily: 'Courier New, monospace' }}>{visit.sub_subscription}</td>
                <td>Sub subscription</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {visit.finding_notes && (
        <div style={{ marginBottom: 16 }}>
          <div className="label">Clinical Notes</div>
          <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>{visit.finding_notes}</div>
        </div>
      )}

      {/* Charges */}
      {(visit.bill_charges > 0 || visit.consultation_charge > 0 || visit.medicine_charge > 0) && (
        <div style={{ marginBottom: 16 }}>
          <div className="label" style={{ marginBottom: 6 }}>Charges</div>
          <table style={{ maxWidth: 280 }}>
            <tbody>
              {visit.consultation_charge > 0 && <tr><td>Consultation</td><td>Rs. {visit.consultation_charge}</td></tr>}
              {visit.medicine_charge > 0 && <tr><td>Medicine</td><td>Rs. {visit.medicine_charge}</td></tr>}
              {visit.bill_charges > 0 && <tr style={{ fontWeight: 700 }}><td>Total</td><td>Rs. {visit.bill_charges}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <hr />

      {/* Telemedicine note */}
      {isOnline && (
        <div style={{ background: '#fff8e1', border: '1px solid #f0c040', borderRadius: 4, padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>
          <strong>Telemedicine Note:</strong> This consultation was conducted remotely. An in-person evaluation may be required if symptoms persist or worsen.
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6, marginTop: 8 }}>
        <strong>Disclaimer:</strong> This prescription is issued based on clinical evaluation and patient-provided information.
        For non-improvement or adverse reaction, please contact the clinic immediately.
        Self-medication is not advised. This prescription is valid for this consultation only.
      </div>

      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center', borderTop: '1px solid #333', paddingTop: 6, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: '#555' }}>{visit.doctor_name || 'Dr. Arshad Mahmood'}</div>
          <div style={{ fontSize: 11, color: '#888' }}>Signature & Stamp</div>
        </div>
      </div>

      <button className="no-print" onClick={() => window.print()} style={{
        marginTop: 30, padding: '10px 24px', background: '#1a3a5c', color: '#fff',
        border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14
      }}>
        🖨 Print
      </button>
    </div>
  );
}