import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import NewPatient from './pages/NewPatient';
import NewVisit from './pages/NewVisit';
import EditPatient from './pages/EditPatient';
import EditVisit from './pages/EditVisit';
import PrintPrescription from './pages/PrintPrescription';
import Diary from './pages/Diary';
import Export from './pages/Export';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/patients/:id/visits/:visitId/print" element={<PrintPrescription />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="patients" element={<Patients />} />
            <Route path="patients/new" element={<NewPatient />} />
            <Route path="patients/:id" element={<PatientDetail />} />
            <Route path="patients/:id/edit" element={<EditPatient />} />
            <Route path="patients/:id/visits/new" element={<NewVisit />} />
            <Route path="visits/:visitId/edit" element={<EditVisit />} />
            <Route path="diary" element={<Diary />} />
            <Route path="export" element={<Export />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}