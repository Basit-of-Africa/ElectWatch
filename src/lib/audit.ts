import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { AuditLogEntry, AuditActionType } from '../types';

export interface LogAuditParams {
  action: AuditActionType;
  targetId: string;
  targetType: AuditLogEntry['targetType'];
  pollingUnitId?: string;
  summary: string;
  reason?: string;
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  actorRole?: string;
  details?: Record<string, any>;
  snapshot?: any;
}

/**
 * Lightweight audit logger for capturing critical user actions in the Situation Room.
 * Fails safely without interrupting the primary user experience.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    const user = auth.currentUser;
    const actorId = params.actorId || user?.uid || 'system_anonymous';
    const actorEmail = params.actorEmail || user?.email || 'unauthenticated@ivote.ng';
    const actorName = params.actorName || user?.displayName || (user?.email ? user.email.split('@')[0] : 'Election Participant');
    const actorRole = params.actorRole || (user ? 'observer' : 'system');

    await addDoc(collection(db, 'audit_logs'), {
      action: params.action,
      targetId: params.targetId,
      targetType: params.targetType,
      pollingUnitId: params.pollingUnitId || '',
      summary: params.summary || '',
      reason: params.reason || getDefaultReason(params.action),
      actorId,
      actorEmail,
      actorName,
      actorRole,
      // Backwards-compatible aliases for legacy readers
      deletedBy: actorId,
      deletedByEmail: actorEmail,
      deletedByName: actorName,
      deletedByRole: actorRole,
      details: params.details || null,
      snapshot: params.snapshot || null,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.warn('[AuditLog] Failed to record audit trail log in Firestore:', error);
  }
}

function getDefaultReason(action: AuditActionType): string {
  switch (action) {
    case 'SUBMIT_INCIDENT':
      return 'Observer field incident alert reported';
    case 'EDIT_REPORT':
      return 'Administrative report revision and data harmonization';
    case 'SUBMIT_REPORT':
      return 'Polling unit observation submission transmitted';
    case 'UPDATE_INCIDENT_STATUS':
      return 'Situation room incident status progression';
    case 'DELETE_REPORT':
      return 'Administrative test or duplicate report purge';
    case 'DELETE_INCIDENT':
      return 'Administrative false alarm or test incident purge';
    case 'BROADCAST_DIRECTIVE':
      return 'Situation room strategic emergency advisory dispatch';
    case 'UPGRADE_USER_ROLE':
      return 'Security clearance elevation / role assignment';
    default:
      return 'System operational event';
  }
}

export function getActionDisplayMeta(action: AuditActionType) {
  switch (action) {
    case 'SUBMIT_INCIDENT':
      return {
        label: 'Incident Submitted',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        iconName: 'AlertTriangle',
        category: 'incident'
      };
    case 'EDIT_REPORT':
      return {
        label: 'Report Edited',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        iconName: 'FileEdit',
        category: 'edit'
      };
    case 'SUBMIT_REPORT':
      return {
        label: 'Report Submitted',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        iconName: 'Send',
        category: 'submission'
      };
    case 'UPDATE_INCIDENT_STATUS':
      return {
        label: 'Incident Status Updated',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconName: 'CheckCircle2',
        category: 'incident'
      };
    case 'DELETE_REPORT':
      return {
        label: 'Report Deleted',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        iconName: 'Trash2',
        category: 'deletion'
      };
    case 'DELETE_INCIDENT':
      return {
        label: 'Incident Deleted',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        iconName: 'Trash2',
        category: 'deletion'
      };
    case 'BROADCAST_DIRECTIVE':
      return {
        label: 'Directive Broadcasted',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        iconName: 'Radio',
        category: 'governance'
      };
    case 'UPGRADE_USER_ROLE':
      return {
        label: 'Role Updated',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        iconName: 'KeyRound',
        category: 'governance'
      };
    default:
      return {
        label: action,
        badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
        iconName: 'Activity',
        category: 'general'
      };
  }
}

