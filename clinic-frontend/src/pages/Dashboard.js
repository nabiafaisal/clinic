import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
  Users, Calendar, TrendingUp, UserPlus, ArrowRight, Loader2
} from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentVisits, setRecentVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isMock = localStorage.getItem('clinic_token')?.startsWith('mock-token-');

    if (isMock) {
      setStats({ total: 3228, thisYearVisits: 312, thisMonthVisits: 28, todayVisits: 5 });
      setRecentVisits([
        { id: 1, patient_id: 1, patient_name: 'Muhammad Anwar', symptoms: 'Imp.', main_remedy: 'Sulphur 200', visit_date: new Date().toISOString(), visit_mode: 'physical' },
        { id: 2, patient_id: 2, patient_name: 'Fatima Bibi', symptoms: 'Headache, fever', main_remedy: 'Bryonia 30', visit_date: new Date().toISOString(), visit_mode: 'physical' },
        { id: 3, patient_id: 3, patient_name: 'Khalid Mehmood', symptoms: 'Imp.', main_remedy: 'Colocynth 200', visit_date: new Date().toISOString(), visit_mode: 'online' },
      ]);
      setLoading(false);
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().getMonth() + 1;
    const thisYear  = new Date().getFullYear();

    Promise.all([
      api.get('/patients/?limit=1').catch(() => ({ data: { total: 0 } })),
      api.get('/visits/?limit=8').catch(() => ({ data: [] })),
      api.get('/visits/diary-summary').catch(() => ({ data: [] })),
      api.get(`/visits/?date_from=${todayStr}&date_to=${todayStr}&limit=1`).catch(() => ({ data: [] })),
    ]).then(([patientsRes, visitsRes, summaryRes, todayRes]) => {
      const total   = patientsRes.data.total || 0;
      const visits  = Array.isArray(visitsRes.data) ? visitsRes.data : [];
      const summary = Array.isArray(summaryRes.data) ? summaryRes.data : [];

      const thisYearVisits = summary
        .filter(r => r.year === thisYear)
        .reduce((a, b) => a + (parseInt(b.total) || 0), 0);

      const thisMonthVisits = summary.find(
        r => r.year === thisYear && r.month === thisMonth
      )?.total || 0;

      // today's visits — backend returns array, check if it has a total or just count the rows
      const todayData = todayRes.data;
      const todayVisits = Array.isArray(todayData) ? todayData.length : 0;

      setStats({ total, thisYearVisits, thisMonthVisits, todayVisits });
      setRecentVisits(visits.slice(0, 6));
      setLoading(false);
    });
  }, []);

  const greeting = () => {
    return 'Salam';
  };

  const today = new Date().toLocaleDateString('en-PK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const thisYear  = new Date().getFullYear();
  const thisMonth = new Date().toLocaleDateString('en-PK', { month: 'long' });

  if (loading) return (
    <div className="loading-center">
      <Loader2 size={28} className="spin" style={{ color: 'var(--sage)' }} />
    </div>
  );

  return (
    <div className="dashboard animate-in">
      <div className="dashboard__hero">
        <div>
          <p className="dashboard__greeting">{greeting()},</p>
          <h1 className="dashboard__name">{user?.name || user?.email}</h1>
          <p className="dashboard__date">{today}</p>
        </div>
        <Link to="/patients/new" className="btn btn--sage">
          <UserPlus size={15} />
          New Patient
        </Link>
      </div>

      <div className="stat-grid animate-stagger">
        <StatCard
          label="Total Patients"
          value={stats?.total?.toLocaleString() || '—'}
          icon={<Users size={18} />}
          color="forest"
        />
        <StatCard
          label={`Visits in ${thisYear}`}
          value={stats?.thisYearVisits > 0 ? stats.thisYearVisits.toLocaleString() : '—'}
          icon={<TrendingUp size={18} />}
          color="sage"
        />
        <StatCard
          label={`Visits in ${thisMonth}`}
          value={stats?.thisMonthVisits > 0 ? stats.thisMonthVisits.toLocaleString() : '—'}
          icon={<Calendar size={18} />}
          color="amber"
        />
        <StatCard
          label="Visits Today"
          value={stats?.todayVisits > 0 ? stats.todayVisits.toLocaleString() : '—'}
          icon={<Calendar size={18} />}
          color="forest"
        />
      </div>

      <div className="section-card">
        <div className="section-card__header">
          <h2 className="section-card__title">Recent Visits</h2>
          <Link to="/diary" className="btn btn--ghost btn--sm">
            View diary <ArrowRight size={13} />
          </Link>
        </div>

        {recentVisits.length === 0 ? (
          <p className="empty-text">No visits found.</p>
        ) : (
          <div className="visit-list">
            {recentVisits.map(v => (
              <Link key={v.id} to={`/patients/${v.patient_id}`} className="visit-row">
                <div className="visit-row__info">
                  <span className="visit-row__name">
                    {v.patient_name && v.patient_name.trim() ? v.patient_name : 'Unnamed Patient'}
                  </span>
                  <span className="visit-row__meta">
                    {v.main_remedy && <span className="visit-row__remedy">{v.main_remedy}</span>}
                    {v.symptoms && <span>{v.symptoms.slice(0, 60)}{v.symptoms.length > 60 ? '…' : ''}</span>}
                  </span>
                </div>
                <div className="visit-row__right">
                  <span className="visit-row__date">
                    {v.visit_date
                      ? new Date(v.visit_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </span>
                  <span className={`badge badge--${v.visit_mode || 'physical'}`}>
                    {v.visit_mode || 'physical'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}
