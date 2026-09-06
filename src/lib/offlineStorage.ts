import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Report, Incident, ReportType, Severity } from '../types';
import { requestBackgroundReportSync } from '../serviceWorkerRegistration';
import { logAuditEvent } from './audit';

export interface PendingReport {
  clientId: string;
  pollingUnitId: string;
  observerId: string;
  type: ReportType;
  createdAtISO: string;
  location?: { lat: number; lng: number } | null;
  media?: { url: string; type: string; hash?: string }[];
  payload: {
    description: string;
    voterCount?: number;
    bvasStatus?: 'functioning' | 'intermittent' | 'malfunctioning' | 'not_arrived' | string;
    queueSize?: 'short' | 'medium' | 'large' | 'overflowing' | string;
    severity?: Severity;
    incidentCategory?: string;
    securityNotified?: 'yes' | 'no' | 'none_present' | string;
    electionLevel?: string;
    apcVotes?: number;
    pdpVotes?: number;
    lpVotes?: number;
    nnppVotes?: number;
    otherVotes?: number;
    totalVotes?: number;
    [key: string]: any;
  };
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
}

export interface OfflineSyncResult {
  successCount: number;
  failedCount: number;
  totalCount: number;
  incidentCount: number;
  syncedIncidents: Array<{ clientId: string; pollingUnitId: string; description: string; severity?: string }>;
  error?: string;
}

const PENDING_REPORTS_KEY = 'votemonitor_offline_pending_reports';
const CACHED_REPORTS_KEY = 'votemonitor_cached_reports';
const CACHED_INCIDENTS_KEY = 'votemonitor_cached_incidents';
const LAST_SYNC_KEY = 'votemonitor_last_sync_timestamp';
const SIMULATED_OFFLINE_KEY = 'ivote_simulated_offline';

/**
 * Returns true if the client has active internet connectivity AND simulated offline mode is inactive
 */
export const getIsOnline = (): boolean => {
  if (typeof window === 'undefined') return true;
  const isSimulated = localStorage.getItem(SIMULATED_OFFLINE_KEY) === 'true';
  if (isSimulated) return false;
  return navigator.onLine;
};

/**
 * Toggles simulated offline mode for field observer training, testing, and demonstration
 */
export const setSimulatedOffline = (offline: boolean) => {
  if (typeof window === 'undefined') return;
  if (offline) {
    localStorage.setItem(SIMULATED_OFFLINE_KEY, 'true');
  } else {
    localStorage.removeItem(SIMULATED_OFFLINE_KEY);
  }
  window.dispatchEvent(new CustomEvent('ivote_network_status_change', {
    detail: { isOnline: !offline, isSimulated: true }
  }));
  window.dispatchEvent(new Event(offline ? 'offline' : 'online'));
};

export const isSimulationActive = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIMULATED_OFFLINE_KEY) === 'true';
};

export const getPendingReports = (): PendingReport[] => {
  try {
    const raw = localStorage.getItem(PENDING_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read pending reports from localStorage', err);
    return [];
  }
};

/**
 * Convenience helper returning only queued incident reports
 */
export const getQueuedIncidents = (): PendingReport[] => {
  return getPendingReports().filter(r => r.type === 'incident');
};

export const savePendingReport = (
  data: Omit<PendingReport, 'clientId' | 'createdAtISO' | 'status'>
): PendingReport => {
  // Comprehensive offline validation guard to guarantee zero corrupt/incomplete drafts
  if (!data.pollingUnitId?.trim()) {
    throw new Error('Offline validation: Polling Unit ID is mandatory');
  }
  if (!data.type) {
    throw new Error('Offline validation: Report type is mandatory');
  }
  if (!data.payload?.description?.trim()) {
    throw new Error('Offline validation: Observation details are mandatory');
  }
  if (data.type === 'accreditation' && (data.payload.voterCount === undefined || data.payload.voterCount === null || isNaN(data.payload.voterCount))) {
    throw new Error('Offline validation: Accreditation requires a valid accredited voter count');
  }
  if (data.type === 'incident' && !data.payload.severity) {
    throw new Error('Offline validation: Incident severity level is required');
  }

  const pendingList = getPendingReports();
  const newReport: PendingReport = {
    ...data,
    clientId: 'offline_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    createdAtISO: new Date().toISOString(),
    status: 'pending',
  };
  
  pendingList.unshift(newReport);
  try {
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(pendingList));
    window.dispatchEvent(new Event('ivote_pending_reports_updated'));
    // Trigger Service Worker Background Sync
    requestBackgroundReportSync();
  } catch (err) {
    console.error('Failed to save pending report to localStorage', err);
  }
  return newReport;
};

export const removePendingReport = (clientId: string) => {
  const pendingList = getPendingReports().filter(item => item.clientId !== clientId);
  try {
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(pendingList));
    window.dispatchEvent(new Event('ivote_pending_reports_updated'));
  } catch (err) {
    console.error('Failed to remove pending report from localStorage', err);
  }
};

export const updatePendingReportStatus = (
  clientId: string,
  status: 'pending' | 'syncing' | 'failed',
  errorMessage?: string
) => {
  const pendingList = getPendingReports().map(item => {
    if (item.clientId === clientId) {
      return { ...item, status, errorMessage };
    }
    return item;
  });
  try {
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(pendingList));
    window.dispatchEvent(new Event('ivote_pending_reports_updated'));
  } catch (err) {
    console.error('Failed to update pending report status in localStorage', err);
  }
};

export const clearPendingReports = () => {
  try {
    localStorage.removeItem(PENDING_REPORTS_KEY);
    window.dispatchEvent(new Event('ivote_pending_reports_updated'));
  } catch (err) {
    console.error('Failed to clear pending reports', err);
  }
};

export const clearAllPendingReports = clearPendingReports;

export const cacheFetchedReports = (reports: Report[]) => {
  try {
    // Keep top 100 reports for offline viewing
    const sliced = reports.slice(0, 100);
    localStorage.setItem(CACHED_REPORTS_KEY, JSON.stringify(sliced));
  } catch (err) {
    console.error('Failed to cache reports to localStorage', err);
  }
};

export const getCachedReports = (): Report[] => {
  try {
    const raw = localStorage.getItem(CACHED_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read cached reports from localStorage', err);
    return [];
  }
};

export const cacheFetchedIncidents = (incidents: Incident[]) => {
  try {
    const sliced = incidents.slice(0, 100);
    localStorage.setItem(CACHED_INCIDENTS_KEY, JSON.stringify(sliced));
  } catch (err) {
    console.error('Failed to cache incidents to localStorage', err);
  }
};

export const getCachedIncidents = (): Incident[] => {
  try {
    const raw = localStorage.getItem(CACHED_INCIDENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read cached incidents from localStorage', err);
    return [];
  }
};

export const getLastSyncTime = (): string | null => {
  return localStorage.getItem(LAST_SYNC_KEY);
};

export const syncPendingReports = async (overrideObserverId?: string): Promise<OfflineSyncResult> => {
  const pending = getPendingReports();
  if (pending.length === 0) {
    return { successCount: 0, failedCount: 0, totalCount: 0, incidentCount: 0, syncedIncidents: [] };
  }

  // Use authenticated user UID to satisfy Firestore Security Rules (request.auth.uid == data.observerId)
  const activeUid = overrideObserverId || auth.currentUser?.uid;
  const activeEmail = auth.currentUser?.email || undefined;
  const activeDisplayName = auth.currentUser?.displayName || (activeEmail ? activeEmail.split('@')[0] : 'Field Observer');

  if (!activeUid) {
    console.warn('Sync delayed: Firebase user is not currently authenticated.');
    return { 
      successCount: 0, 
      failedCount: pending.length, 
      totalCount: pending.length,
      incidentCount: 0,
      syncedIncidents: [],
      error: 'User not signed in. Please sign in to sync offline drafts.'
    };
  }

  let successCount = 0;
  let failedCount = 0;
  let incidentCount = 0;
  const syncedIncidents: Array<{ clientId: string; pollingUnitId: string; description: string; severity?: string }> = [];

  for (const item of pending) {
    updatePendingReportStatus(item.clientId, 'syncing');
    try {
      const payloadData: Record<string, any> = { ...item.payload };

      const reportData = {
        pollingUnitId: item.pollingUnitId,
        observerId: activeUid,
        timestamp: serverTimestamp(),
        type: item.type,
        location: item.location || null,
        media: item.media || [],
        payload: payloadData,
      };

      const docRef = await addDoc(collection(db, 'reports'), reportData);

      if (item.type === 'incident') {
        const incidentRef = await addDoc(collection(db, 'incidents'), {
          reportId: docRef.id,
          pollingUnitId: item.pollingUnitId,
          severity: item.payload?.severity || 'medium',
          status: 'pending',
          description: item.payload?.description || 'Incident reported by field observer',
          timestamp: serverTimestamp(),
        });

        incidentCount++;
        syncedIncidents.push({
          clientId: item.clientId,
          pollingUnitId: item.pollingUnitId,
          description: item.payload?.description || 'Incident reported by field observer',
          severity: item.payload?.severity
        });

        if (item.payload?.severity === 'critical' || item.payload?.severity === 'high') {
          try {
            await addDoc(collection(db, 'notifications'), {
              userId: 'admin',
              title: `CRITICAL INCIDENT: ${item.pollingUnitId}`,
              message: item.payload?.description || 'Critical incident alert',
              type: item.payload?.severity === 'critical' ? 'error' : 'warning',
              read: false,
              link: `/incidents/${incidentRef.id}`,
              timestamp: serverTimestamp(),
            });
            await addDoc(collection(db, 'notifications'), {
              userId: 'supervisor',
              title: `CRITICAL INCIDENT: ${item.pollingUnitId}`,
              message: item.payload?.description || 'Critical incident alert',
              type: item.payload?.severity === 'critical' ? 'error' : 'warning',
              read: false,
              link: `/incidents/${incidentRef.id}`,
              timestamp: serverTimestamp(),
            });
          } catch (notifErr) {
            console.warn('Non-fatal notification push warning:', notifErr);
          }
        }

        // Audit Trail entry for synchronized incident
        await logAuditEvent({
          action: 'SUBMIT_INCIDENT',
          targetId: incidentRef.id,
          targetType: 'incident',
          pollingUnitId: item.pollingUnitId,
          summary: `Incident synced from offline queue: PU #${item.pollingUnitId} (${item.payload?.severity?.toUpperCase() || 'MEDIUM'})`,
          reason: 'Automatic background synchronization from offline device cache',
          actorId: activeUid,
          actorName: activeEmail ? activeEmail.split('@')[0] : 'Field Observer',
          actorEmail: activeEmail,
          actorRole: 'observer',
          details: {
            reportId: docRef.id,
            offlineCreatedAt: item.createdAtISO,
            severity: item.payload?.severity,
            category: item.payload?.incidentCategory
          }
        });
      } else {
        // Audit Trail entry for regular synchronized report
        await logAuditEvent({
          action: 'SUBMIT_REPORT',
          targetId: docRef.id,
          targetType: 'report',
          pollingUnitId: item.pollingUnitId,
          summary: `Report (${item.type.toUpperCase()}) synced from offline cache for PU #${item.pollingUnitId}`,
          reason: 'Automatic background synchronization from offline device cache',
          actorId: activeUid,
          actorName: activeEmail ? activeEmail.split('@')[0] : 'Field Observer',
          actorEmail: activeEmail,
          actorRole: 'observer',
          details: {
            offlineCreatedAt: item.createdAtISO,
            reportType: item.type
          }
        });
      }

      removePendingReport(item.clientId);
      successCount++;
    } catch (err: any) {
      console.error(`Failed to sync report ${item.clientId}:`, err);
      updatePendingReportStatus(item.clientId, 'failed', err.message || 'Sync failed');
      failedCount++;
    }
  }

  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  window.dispatchEvent(new Event('ivote_pending_reports_updated'));

  return {
    successCount,
    failedCount,
    totalCount: pending.length,
    incidentCount,
    syncedIncidents,
  };
};
