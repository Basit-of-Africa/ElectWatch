import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'supervisor' | 'observer';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  assignedPollingUnitId?: string;
  createdAt: string;
}

export interface PollingUnit {
  id: string;
  name: string;
  state: string;
  lga: string;
  ward: string;
  totalRegisteredVoters: number;
}

export type ReportType = 'accreditation' | 'incident' | 'result';

export interface Report {
  id: string;
  pollingUnitId: string;
  observerId: string;
  timestamp: string | Timestamp;
  type: ReportType;
  payload: any;
  location?: {
    lat: number;
    lng: number;
  };
  media?: {
    url: string;
    type: string;
    hash?: string;
  }[];
}

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'pending' | 'investigating' | 'resolved';

export interface Incident {
  id: string;
  reportId: string;
  pollingUnitId: string;
  severity: Severity;
  status: IncidentStatus;
  description: string;
  timestamp: string | Timestamp;
}

export interface Notification {
  id: string;
  userId: string; // Target user or 'admin' / 'supervisor' for roles
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  link?: string;
  timestamp: string | Timestamp;
}
