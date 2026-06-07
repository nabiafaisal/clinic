import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Loader2, UserPlus, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLES = ['superadmin', 'admin', 'reception'];

export default function ManageUsers() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ email: '', name: '', role: 'reception', phone: '' });
  const [saving, setSaving]   = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/');
      setUsers(res.data);
    } catch (e) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId, role) => {
    try {
      await api.patch(`/users/${userId}/role`, { role });
      setUsers(u => u.map(x => x.id === userId ? { ...x, role } : x));
      toast.success('Role updated');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    }
  };

  const handleToggleActive = async (u) => {
    try {
      const endpoint = u.is_active ? `/users/${u.id}/deactivate` : `/users/${u.id}/activate`;
      await api.patch(endpoint);
      setUsers(us => us.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x));
      toast.success(u.is_active ? 'User deactivated' : 'User activated');
    } catch (e) {
      toast.error('Failed');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users/', form);
      toast.success('User added');
      setShowAdd(false);
      setForm({ email: '', name: '', role: 'reception', phone: '' });
      fetchUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add user');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-center"><Loader2 size={24} className="spin" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Manage Users</h1>
        <button className="btn btn--sage" onClick={() => setShowAdd(s => !s)}>
          <UserPlus size={15} /> Add User
        </button>
      </div>

      {showAdd && (
        <div className="section-card" style={{ marginBottom: 20 }}>
          <div className="section-label">Add New User</div>
          <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone (for OTP)</label>
              <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+923001234567" />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn--sage" disabled={saving}>
                {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                {saving ? 'Saving...' : 'Save User'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="section-card">
        <div className="patient-table-wrap">
          <table className="patient-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name || '—'}</strong></td>
                  <td style={{ fontSize: 12 }}>{u.email}</td>
                  <td style={{ fontSize: 12 }}>{u.phone || '—'}</td>
                  <td>
                    <select
                      className="form-input"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                    >
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge--finalized' : 'badge--draft'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`btn btn--sm ${u.is_active ? 'btn--ghost' : 'btn--sage'}`}
                      onClick={() => handleToggleActive(u)}
                    >
                      {u.is_active ? <X size={13} /> : <Check size={13} />}
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
