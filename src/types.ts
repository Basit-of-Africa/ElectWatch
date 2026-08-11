import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'supervisor' | 'observer';

export type ElectionLevel = 'governorship' | 'presidential' | 'senatorial' | 'house_of_reps';

export interface ElectionScope {
  id: string;
  name: string;
  level: ElectionLevel;
  state?: string;
  year: number;
  isOffCycle?: boolean;
  isActiveDefault?: boolean;
  description?: string;
}

export type CheckInStatus = 'checked_in' | 'en_route' | 'not_checked_in';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  assignedPollingUnitId?: string;
  assignedPollingUnitName?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'suspended';
  state?: string;
  lga?: string;
  reportsCount?: number;
  lastActive?: string;
  createdAt: string;
  checkInStatus?: CheckInStatus;
  checkInTimestamp?: string;
  checkInLat?: number;
  checkInLng?: number;
  checkInAccuracy?: number;
  checkInNotes?: string;
}

export interface CheckInRecord {
  id: string;
  observerId: string;
  observerName: string;
  observerEmail: string;
  pollingUnitId: string;
  pollingUnitName: string;
  state?: string;
  lga?: string;
  status: CheckInStatus;
  timestamp: string | Timestamp;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  notes?: string;
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
  media?: {
    url: string;
    type: string;
    hash?: string;
  }[];
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
