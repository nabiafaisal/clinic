import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { Loader2, Search } from 'lucide-react';
import './Dashboard.css';
import './Patients.css';
import { BarChart2 } from 'lucide-react';
const LIMIT = 40;

export default function Diary() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(today);
  const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');
  const [tab, setTab] = useState('diary'); // 'diary' | 'summary'
  const [summary, setSummary] = useState([]);
const fetchVisits = async (from, to) => {
    setLoading(true);
    if (isMock) {
      setVisits([
        { id: 1, patient_id: 1, patient_name: 'Muhammad Anwar', visit_date: today,
          symptoms: 'Imp. much', main_remedy: 'Sulph 200', visit_mode: 'physical',
          bill_charges: 500, status: 'finalized' },
        { id: 2, patient_id: 2, patient_name: 'Fatima Bibi', visit_date: today,
          symptoms: 'C/o headache', main_remedy: 'Bryonia 30', visit_mode: 'physical',
          bill_charges: 400, status: 'draft' },
        { id: 3, patient_id: 3, patient_name: 'Khalid Mehmood', visit_date: today,
          symptoms: 'Imp.', main_remedy: 'Colocynth 200', visit_mode: 'online',
          bill_charges: 300, status: 'draft' },
      ]);
      setLoading(false);
      return;
    }
    try {
      const params = { limit: LIMIT };
      if (from) params.date_from = from;
      if (to)   params.date_to   = to;
      const res = await api.get('/visits/', { params });
      setVisits(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  const fetchSummary = async () => {
    if (isMock) {
      setSummary([
        { year: 2023, jan:121,feb:82,mar:96,apr:114,may:116,jun:94,jul:108,aug:124,sep:96,oct:122,nov:117,dec:116,total:1306 },
        { year: 2024, jan:120,feb:93,mar:96,apr:95,may:102,jun:100,jul:112,aug:71,sep:85,oct:71,nov:76,dec:94,total:1115 },
        { year: 2025, jan:58,feb:92,mar:73,apr:86,may:101,jun:93,jul:108,aug:121,sep:127,oct:101,nov:99,dec:66,total:1125 },
      ]);
      return;
    }
    try {
      const res = await api.get('/visits/diary-summary');
      // Transform flat {year,month,total} array into pivot rows
      const raw = Array.isArray(res.data) ? res.data : [];
      const byYear = {};
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      raw.forEach(r => {
        if (!byYear[r.year]) byYear[r.year] = { year: r.year };
        byYear[r.year][months[r.month - 1]] = r.total;
      });
      const rows = Object.values(byYear).map(row => ({
        ...row,
        total: months.reduce((s, m) => s + (row[m] || 0), 0)
      })).sort((a, b) => a.year - b.year);
      setSummary(rows);
    } catch (e) { console.error(e); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => { fetchVisits('', ''); }, []);

  const handleFilter = (e) => {
    e.preventDefault();
    fetchVisits(dateFrom, dateTo);
  };

  // Group visits by date
  const grouped = visits.reduce((acc, v) => {
    const d = v.visit_date || 'Unknown';
    if (!acc[d]) acc[d] = [];
    acc[d].push(v);
    return acc;
  }, {});

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Visit Diary</h1>
          <p className="page-subtitle">{tab === 'diary' ? `${visits.length} visits shown` : 'Annual summary'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${tab === 'diary' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setTab('diary')}
          >
            Diary
          </button>
          <button
            className={`btn ${tab === 'summary' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setTab('summary'); fetchSummary(); }}
          >
            <BarChart2 size={14} /> Patient Summary
          </button>
        </div>
      </div>

      {tab === 'summary' ? (
        <div className="section-card" style={{ overflowX: 'auto' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', textAlign: 'center', color: '#1a3a5c', marginBottom: 16 }}>
            Patient Summary Report
          </h2>
          <table className="patient-table" style={{ minWidth: 700, fontSize: '0.82rem' }}>
            <thead>
              <tr>
                {['Year','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Total'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Year' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map(row => (
                <tr key={row.year}>
                  <td style={{ fontWeight: 600 }}>{row.year}</td>
                  {['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].map(m => (
                    <td key={m} style={{ textAlign: 'center', color: row[m] ? 'inherit' : 'var(--ink-lite)' }}>
                      {row[m] || ''}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-lite)', marginTop: 12 }}>
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      ) : (
        <>
          {/* Filter */}
          <form className="search-bar" onSubmit={handleFilter} style={{ marginBottom: 20 }}>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <label className="form-label" style={{ whiteSpace: 'nowrap', margin: 0 }}>From</label>
              <input type="date" className="form-input" style={{ maxWidth: 160 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <label className="form-label" style={{ whiteSpace: 'nowrap', margin: 0 }}>To</label>
              <input type="date" className="form-input" style={{ maxWidth: 160 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button type="submit" className="btn btn--primary"><Search size={14} /> Filter</button>
            <button type="button" className="btn btn--ghost" onClick={() => {
              const t = new Date().toISOString().slice(0, 10);
              setDateFrom(t); setDateTo(t); fetchVisits(t, t);
            }}>Today</button>
            <button type="button" className="btn btn--ghost" onClick={() => {
              setDateFrom(''); setDateTo(''); fetchVisits('', '');
            }}>All</button>
          </form>

          {loading ? (
            <div className="loading-center"><Loader2 size={24} className="spin" style={{ color: 'var(--sage)' }} /></div>
          ) : visits.length === 0 ? (
            <div className="section-card"><p className="empty-text">No visits found for this date range.</p></div>
          ) : (
            <div className="diary-groups animate-stagger">
              {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, dayVisits]) => (
                <div key={date} className="diary-group">
                  <div className="diary-group__date">
                    {date !== 'Unknown'
                      ? new Date(date).toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                      : 'Date Unknown'}
                    <span className="diary-group__count">{dayVisits.length} visit{dayVisits.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="section-card">
                    <div className="patient-table-wrap">
                      <table className="patient-table">
                        <thead>
                          <tr>
                            <th>Patient</th><th>Symptoms</th><th>Remedy</th>
                            <th>Mode</th><th>Charges</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayVisits.map(v => (
                            <tr key={v.id}>
                              <td>
                                <Link to={`/patients/${v.patient_id}`} className="patient-link">{v.patient_name || 'Unknown'}</Link>
                                {v.mobile_no && <div style={{ fontSize: '0.75rem', color: 'var(--ink-lite)', fontFamily: 'DM Mono, monospace' }}>{v.mobile_no}</div>}
                              </td>
                              <td style={{ maxWidth: 200 }}><span style={{ fontSize: '0.82rem', color: 'var(--ink-mid)' }}>{v.symptoms || '—'}</span></td>
                              <td>{v.main_remedy
                                ? <span className="visit-card__remedy mono" style={{ fontSize: '0.78rem', background: 'var(--forest)', color: 'var(--sage-lite)', padding: '2px 7px', borderRadius: 4 }}>{v.main_remedy}</span>
                                : <span style={{ color: 'var(--ink-lite)' }}>—</span>}
                              </td>
                              <td><span className={`badge badge--${v.visit_mode || 'physical'}`}>{v.visit_mode || 'physical'}</span></td>
                              <td style={{ fontSize: '0.82rem', fontFamily: 'DM Mono, monospace' }}>{v.bill_charges > 0 ? `Rs. ${v.bill_charges}` : '—'}</td>
                              <td><span className={`badge badge--${v.status}`}>{v.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
)}