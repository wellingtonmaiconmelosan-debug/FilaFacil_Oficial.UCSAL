export type UserRole = 'LANDING' | 'PATIENT' | 'NURSE' | 'DOCTOR';

export interface Patient {
  id?: number;
  name: string;
  age: number;
  email: string;
  phone?: string; // New WhatsApp number
}

export interface Doctor {
  id: string;
  name: string;
  crm: string;
  spec_id: string;
  active: boolean;
  email: string;
  hospital_id: string; // Hospital isolation
}

export interface Nurse {
  id: string;
  name: string;
  email: string;
  active: boolean;
  hospital_id: string; // Hospital isolation
}

export interface QueueItem {
  id: number;
  created_at: string;
  doc_id: string;
  name: string;
  age: number;
  sym: string;
  priority: string;
  kind: 'T' | 'N' | 'U' | 'E';
  level: number;
  status: 'waiting' | 'calling' | 'done';
  obs?: string;
  nurse_id?: string;
  hospital_id: string; // Hospital isolation
}
