/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Landing from './apps/Landing';
import PatientApp from './apps/PatientApp';
import NurseApp from './apps/NurseApp';
import DoctorApp from './apps/DoctorApp';

export default function App() {
  const [role, setRole] = useState<'LANDING' | 'PATIENT' | 'NURSE' | 'DOCTOR'>('LANDING');

  if (role === 'PATIENT') return <PatientApp onBack={() => setRole('LANDING')} />;
  if (role === 'NURSE') return <NurseApp onBack={() => setRole('LANDING')} />;
  if (role === 'DOCTOR') return <DoctorApp onBack={() => setRole('LANDING')} />;

  return <Landing onSelectRole={setRole} />;
}

