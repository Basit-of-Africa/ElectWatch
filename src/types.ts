import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'supervisor' | 'observer';

export interface User {
  uid: string;
  specialId?: string;
  displayName: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
  organisation?: string;
  state?: string;
  lga?: string;
  ward?: string;
  observerRole?: string;
  assignedPollingUnitId?: string;
  createdAt: string | Timestamp;
  updatedAt?: string | Timestamp;
}

export interface PollingUnit {
  id: string;
  name: string;
  state: string;
  lga: string;
  ward: string;
  totalRegisteredVoters: number;
}

export type ReportType = 'accreditation' | 'incident' | 'result' | 'checklist';

export type FormTemplateStatus = 'drafted' | 'published' | 'retired';
export type FormQuestionType = 'text' | 'number' | 'date' | 'singleSelect' | 'multiSelect' | 'rating';

export interface LocalizedText {
  [languageCode: string]: string;
}

export interface FormQuestionOption {
  id: string;
  label: LocalizedText;
  isFlagged?: boolean;
  isFreeText?: boolean;
}

export interface FormQuestionDisplayLogic {
  parentQuestionId: string;
  condition: 'includes';
  value: string;
}

export interface FormQuestion {
  id: string;
  code: string;
  type: FormQuestionType;
  label: LocalizedText;
  helpText?: LocalizedText;
  placeholder?: LocalizedText;
  required?: boolean;
  options?: FormQuestionOption[];
  ratingScale?: number;
  displayLogic?: FormQuestionDisplayLogic;
}

export interface FormSection {
  id: string;
  code: string;
  title: LocalizedText;
  questions: FormQuestion[];
}

export interface FormTemplate {
  id: string;
  code: string;
  name: LocalizedText;
  reportType: ReportType;
  status: FormTemplateStatus;
  languages: string[];
  sections: FormSection[];
  createdAt?: string | Timestamp;
  updatedAt?: string | Timestamp;
}

export interface Report {
  id: string;
  pollingUnitId: string;
  observerId: string;
  timestamp: string | Timestamp;
  type: ReportType;
  payload: any;
  formTemplateId?: string;
  formTemplateCode?: string;
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
