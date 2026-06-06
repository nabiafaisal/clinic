import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { Search, UserPlus, ChevronLeft, ChevronRight, Loader2, User } from 'lucide-react';
import './Patients.css';
import './Dashboard.css';

const LIMIT = 30;

export default function Patients() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [page, setPage] = useState(0);

  const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');

const fetchPatients = useCallback(async (q, pg) => {
  setLoading(true);
  if (isMock) {
    const mockData = [
      { id: 1, legacy_fileno: '1001', name: 'Muhammad Anwar', fh_name: 'Ghulam Hussain', age: '45', mobile_no: '03001234567', patient_type: 'in-clinic', date_of_first_visit: '2020-03-15' },
      { id: 2, legacy_fileno: '1002', name: 'Fatima Bibi', fh_name: 'Abdul Rehman', age: '32', mobile_no: '03211234567', patient_type: 'in-clinic', date_of_first_visit: '2019-07-22' },
      { id: 3, legacy_fileno: '1003', name: 'Khalid Mehmood', fh_name: 'Mehmood Khan', age: '58', mobile_no: null, patient_type: 'online', date_of_first_visit: '2021-01-10' },
    ];
    const filtered = q ? mockData.filter(p => p.name.toLowerCase().includes(q.toLowerCase())) : mockData;
    setPatients(filtered);
    setTotal(3228);
    setLoading(false);
    return;
  }
  try {
    const params = { limit: LIMIT, skip: pg * LIMIT };
    if (q) params.search = q;
    const res = await api.get('/patients/', { params });
    setPatients(res.data.patients || []);
    setTotal(res.data.total || 0);
  } catch (e) {
    console.error(e);
  } finally {
    setLoading(false);
  }
}, [isMock]);

// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => { fetchPatients(search, page); }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    setSearchParams(search ? { q: search } : {});
    fetchPatients(search, 0);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="patients-page animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">{total.toLocaleString()} records</p>
        </div>
        <Link to="/patients/new" className="btn btn--sage">
          <UserPlus size={15} /> New Patient
        </Link>
      </div>

      {/* Search */}
      <form className="search-bar" onSubmit={handleSearch}>
        <div className="search-bar__input-wrap">
          <Search size={15} className="search-bar__icon" />
          <input
            className="search-bar__input"
            placeholder="Search by name, father's name, or mobile…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn--primary">Search</button>
        {search && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => { setSearch(''); setPage(0); fetchPatients('', 0); }}
          >
            Clear
          </button>
        )}
      </form>

      {/* Table */}
      <div className="section-card">
        {loading ? (
          <div className="loading-center" style={{ minHeight: 200 }}>
            <Loader2 size={24} className="spin" style={{ color: 'var(--sage)' }} />
          </div>
        ) : patients.length === 0 ? (
          <p className="empty-text">No patients found.</p>
        ) : (
          <div className="patient-table-wrap">
            <table className="patient-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>F/H Name</th>
                  <th>Age</th>
                  <th>Mobile</th>
                  <th>Type</th>
                  <th>First Visit</th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id}>
                    <td className="mono" style={{ color: 'var(--ink-lite)', fontSize: '0.78rem' }}>
                      {p.legacy_fileno || p.id}
                    </td>
                    <td>
                      <Link to={`/patients/${p.id}`} className="patient-link">
                        <User size={13} />
                        {p.name || '—'}
                      </Link>
                    </td>
                    <td>{p.fh_name || '—'}</td>
                    <td>{p.age || '—'}</td>
                    <td className="mono" style={{ fontSize: '0.82rem' }}>{p.mobile_no || '—'}</td>
                    <td>
                      <span className={`badge badge--${p.patient_type === 'online' ? 'online' : 'physical'}`}>
                        {p.patient_type || 'in-clinic'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--ink-lite)' }}>
                      {p.date_of_first_visit
                        ? new Date(p.date_of_first_visit).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="pagination__info">
              Page {page + 1} of {totalPages}
            </span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
