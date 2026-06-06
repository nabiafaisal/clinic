import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function Export() {
  const [loading, setLoading] = useState(false);

  const downloadExcel = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('clinic_token');
      const res = await api.get('/patients/export', {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'patients_export.csv';
      a.click();
    } catch (e) {
      alert('Export failed. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 500 }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Export Data</h1>
      <p style={{ color: 'var(--ink-lite)', marginBottom: '1.5rem' }}>
        Download all patient records as a CSV file (opens in Excel).
      </p>
      <button className="btn btn--sage" onClick={downloadExcel} disabled={loading}>
        {loading ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
        {loading ? 'Preparing…' : 'Download Patients CSV'}
      </button>
    </div>
  );
}
