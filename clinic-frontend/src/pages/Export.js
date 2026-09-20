import React, { useState } from 'react';
import { Download, Loader2, Database } from 'lucide-react';
import api from '../utils/api';

export default function Export() {
  const [loading, setLoading] = useState(false);

  const downloadCSV = async () => {
    const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
    setLoading(true);

    if (isMock) {
      const rows = [
        ['File#', 'Name', 'F/H Name', 'Age', 'Mobile', 'Type', 'First Visit'],
        ['1001', 'Muhammad Anwar', 'Ghulam Hussain', '45', '+92 03001234567', 'in-clinic', '2020-03-15'],
        ['1002', 'Fatima Bibi', 'Abdul Rehman', '32', '+92 03211234567', 'in-clinic', '2019-07-22'],
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
    <div style={{ padding: '2rem', maxWidth: 560 }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Export Data</h1>
      <p style={{ color: 'var(--ink-lite)', marginBottom: '1.5rem' }}>
        Download a full backup of all patient records as a CSV file.
        CSV is a universal format — it opens in Microsoft Excel, Microsoft Access,
        Google Sheets, or any spreadsheet application.
      </p>

      <div style={{
        background: 'var(--parchment, #faf9f6)', border: '1px solid var(--border, #e5e2d9)',
        borderRadius: 10, padding: '16px 20px', marginBottom: 24,
        display: 'flex', alignItems: 'flex-start', gap: 12
      }}>
        <Database size={18} style={{ color: 'var(--sage)', marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.6 }}>
          <strong>What's included:</strong> File number, patient name, father/husband name,
          age, mobile, city, country, patient type, first visit date, diagnosis, and remarks
          for all {' '}
          <strong>patients</strong> in the database.
        </div>
      </div>

      <button className="btn btn--sage" onClick={downloadCSV} disabled={loading}>
        {loading ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
        {loading ? 'Preparing export…' : 'Download Patients CSV'}
      </button>

      <p style={{ fontSize: 12, color: 'var(--ink-lite)', marginTop: 12 }}>
        To open in Microsoft Access: File → External Data → Import → Text File → select the CSV
      </p>
    </div>
  );
}
