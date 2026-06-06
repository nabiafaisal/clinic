import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function Export() {
  const [loading, setLoading] = useState(false);

  const downloadExcel = async () => {
    const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
    setLoading(true);

    if (isMock) {
      // Mock CSV download
      const rows = [
        ['ID', 'Name', 'F/H Name', 'Age', 'Mobile', 'Type', 'First Visit'],
        ['1001', 'Muhammad Anwar', 'Ghulam Hussain', '45', '03001234567', 'in-clinic', '2020-03-15'],
        ['1002', 'Fatima Bibi', 'Abdul Rehman', '32', '03211234567', 'in-clinic', '2019-07-22'],
        ['1003', 'Khalid Mehmood', 'Mehmood Khan', '58', '', 'online', '2021-01-10'],
      ];
      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'patients_export.csv';
      a.click();
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/patients/export', { responseType: 'blob' });
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