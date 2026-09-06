import React, { useEffect, useState, useRef } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Clock, 
  HardDrive,
  ShieldAlert,
  Radio,
  Sparkles,
  ExternalLink,
  Zap,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { 
  getPendingReports, 
  getQueuedIncidents,
  syncPendingReports, 
  removePendingReport, 
  clearAllPendingReports,
  PendingReport, 
  getLastSyncTime,
  getIsOnline,
  setSimulatedOffline,
  isSimulationActive,
  OfflineSyncResult
} from '../lib/offlineStorage';

export default function OfflineSyncBanner() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(getIsOnline);
  const [isSimulated, setIsSimulated] = useState(isSimulationActive);
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(getLastSyncTime());
  
  // Track previous online state to prevent duplicate initial toasts
  const wasOnlineRef = useRef<boolean>(getIsOnline());
  const isInitialMount = useRef<boolean>(true);

  const refreshPendingList = () => {
    const list = getPendingReports();
    setPendingReports(list);
    return list;
  };

  const handleSync = async (isAuto = false) => {
    const freshPending = getPendingReports();
    if (freshPending.length === 0) return;
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncResult(null);

    const queuedIncidentsCount = freshPending.filter(r => r.type === 'incident').length;

    if (isAuto) {
      toast.loading("Synchronizing Offline Reports...", {
        id: 'auto-sync-progress',
        description: `Uploading ${freshPending.length} queued record(s) including ${queuedIncidentsCount} incident report(s) to Election HQ.`,
        duration: 4000
      });
    }

    try {
      const res: OfflineSyncResult = await syncPendingReports(user?.uid);
      setLastSync(getLastSyncTime());
      refreshPendingList();

      // Dismiss auto-sync loading toast
      toast.dismiss('auto-sync-progress');

      if (res.error) {
        toast.error('Offline Synchronization Failed', {
          description: res.error,
          duration: 6000
        });
        setSyncResult(res.error);
      } else if (res.successCount > 0) {
        let msg = '';
        if (res.incidentCount > 0) {
          msg = `Synchronized ${res.incidentCount} queued incident report${res.incidentCount > 1 ? 's' : ''} & ${res.successCount - res.incidentCount} standard reports!`;
          toast.success("Incident Reports Uploaded!", {
            id: 'sync-success-toast',
            description: `Successfully transmitted ${res.incidentCount} queued field incident(s) to Election HQ and active monitoring dashboards.`,
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            duration: 6000
          });
        } else {
          msg = `Successfully transmitted ${res.successCount} queued observation${res.successCount > 1 ? 's' : ''}!`;
          toast.success("Offline Queue Synchronized", {
            id: 'sync-success-toast',
            description: msg,
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            duration: 5000
          });
        }
        setSyncResult(msg);
        setTimeout(() => setSyncResult(null), 6000);
      } else if (res.failedCount > 0) {
        const msg = `${res.failedCount} report(s) could not be uploaded due to validation or server rules.`;
        setSyncResult(msg);
        toast.error('Sync Incomplete', {
          description: msg,
          duration: 6000
        });
      }
    } catch (err: any) {
      console.error('Offline sync error', err);
      const msg = 'Sync failed. Will retry automatically once connection stabilizes.';
      setSyncResult(msg);
      toast.error('Sync Interrupted', {
        description: msg,
        duration: 5000
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshPendingList();

    // Check if initial load was offline
    if (!getIsOnline()) {
      setIsOnline(false);
    }

    const handleConnectionOnline = () => {
      const currentlyOnline = getIsOnline();
      setIsOnline(currentlyOnline);
      setIsSimulated(isSimulationActive());

      if (currentlyOnline && !wasOnlineRef.current) {
        wasOnlineRef.current = true;
        const pending = getPendingReports();
        const incidentCount = pending.filter(r => r.type === 'incident').length;

        // Visual toast alerting that connectivity is restored
        toast.success("Network Connectivity Restored", {
          id: 'network-status-online',
          description: pending.length > 0 
            ? `Online connection active. Automatically synchronizing ${pending.length} queued report(s) (${incidentCount} incidents)...` 
            : "Live connectivity restored. Real-time election updates active.",
          icon: <Wifi className="w-5 h-5 text-emerald-500" />,
          duration: 5000
        });

        // Trigger automatic synchronization
        if (pending.length > 0) {
          handleSync(true);
        }
      }
    };

    const handleConnectionOffline = () => {
      setIsOnline(false);
      setIsSimulated(isSimulationActive());

      if (wasOnlineRef.current) {
        wasOnlineRef.current = false;
        const pending = getPendingReports();
        const incidentCount = pending.filter(r => r.type === 'incident').length;

        // Visual toast alerting user that they are working offline
        toast.warning("Working in Offline Mode", {
          id: 'network-status-offline',
          description: "No active internet connection. Incident reports and field submissions will be securely queued in local storage and auto-synced once back online.",
          icon: <WifiOff className="w-5 h-5 text-amber-500" />,
          duration: 7000,
          action: pending.length > 0 ? {
            label: `View Queue (${pending.length})`,
            onClick: () => setShowDrawer(true)
          } : undefined
        });
      }
    };

    const handleCustomNetworkChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ isOnline: boolean; isSimulated: boolean }>;
      if (customEvent.detail?.isOnline) {
        handleConnectionOnline();
      } else {
        handleConnectionOffline();
      }
    };

    const handlePendingUpdated = () => {
      const list = refreshPendingList();
      if (getIsOnline() && list.length > 0 && !isSyncing) {
        handleSync(true);
      }
    };

    window.addEventListener('online', handleConnectionOnline);
    window.addEventListener('offline', handleConnectionOffline);
    window.addEventListener('focus', handleConnectionOnline);
    window.addEventListener('ivote_network_status_change', handleCustomNetworkChange);
    window.addEventListener('ivote_pending_reports_updated', handlePendingUpdated);

    // Initial check if we mounted with pending items while online
    if (getIsOnline() && getPendingReports().length > 0) {
      handleSync(true);
    }

    // Short poll every 3s in case items are added by background workers or other tabs
    const interval = setInterval(() => {
      refreshPendingList();
      const currentOnline = getIsOnline();
      if (currentOnline !== isOnline) {
        setIsOnline(currentOnline);
      }
    }, 3000);

    isInitialMount.current = false;

    return () => {
      window.removeEventListener('online', handleConnectionOnline);
      window.removeEventListener('offline', handleConnectionOffline);
      window.removeEventListener('focus', handleConnectionOnline);
      window.removeEventListener('ivote_network_status_change', handleCustomNetworkChange);
      window.removeEventListener('ivote_pending_reports_updated', handlePendingUpdated);
      clearInterval(interval);
    };
  }, [user]);

  const handleDeleteDraft = (clientId: string) => {
    removePendingReport(clientId);
    refreshPendingList();
    toast.info('Draft removed from offline queue');
  };

  const handleClearAllDrafts = () => {
    clearAllPendingReports();
    refreshPendingList();
    setShowDrawer(false);
    toast.info('All offline drafts cleared from local vault');
  };

  const toggleSimulateOffline = () => {
    const nextState = !isSimulated;
    setSimulatedOffline(nextState);
    setIsSimulated(nextState);
    setIsOnline(!nextState);
  };

  const queuedIncidents = pendingReports.filter(r => r.type === 'incident');
  const otherQueuedReports = pendingReports.filter(r => r.type !== 'incident');

  // If online and zero pending reports, show a compact offline simulation trigger or render nothing
  if (isOnline && pendingReports.length === 0) {
    return (
      <div className="w-full bg-slate-900/90 text-slate-400 text-xs border-b border-slate-800 py-1 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-slate-300 font-medium hidden sm:inline">
              Online Telemetry Active
            </span>
          </div>
          <button
            type="button"
            onClick={toggleSimulateOffline}
            className="text-[11px] text-slate-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-700/60 hover:border-amber-500/50 bg-slate-800/60 cursor-pointer"
            title="Simulate offline mode to test queued incident reporting and auto-sync"
          >
            <WifiOff className="w-3 h-3 text-amber-400" />
            <span>Simulate Offline Mode</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full text-white shadow-md border-b sticky top-16 z-30 transition-all ${
      !isOnline 
        ? 'bg-amber-950 border-amber-800/80 shadow-amber-950/30' 
        : 'bg-slate-900 border-slate-800 shadow-slate-950/30'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
        {/* Left: Connection State Badge & Queued Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          {!isOnline ? (
            <span className="flex items-center gap-2 bg-amber-500/25 text-amber-200 font-bold px-3 py-1 rounded-full text-xs border border-amber-500/40 animate-pulse">
              <WifiOff className="w-3.5 h-3.5 text-amber-300" />
              <span>Offline Mode Active</span>
              {isSimulated && (
                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-100 font-black">
                  Simulated
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 font-bold px-3 py-1 rounded-full text-xs border border-emerald-500/30">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Connected</span>
            </span>
          )}

          {/* Queued Incidents / Reports Counter */}
          <div className="flex items-center gap-2 text-xs">
            <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-200 font-medium">
              {queuedIncidents.length > 0 ? (
                <>
                  <strong className="text-amber-300 font-bold">{queuedIncidents.length}</strong> incident report{queuedIncidents.length > 1 ? 's' : ''} queued locally
                  {otherQueuedReports.length > 0 && ` (+${otherQueuedReports.length} other reports)`}
                </>
              ) : (
                <>
                  <strong className="text-white font-bold">{pendingReports.length}</strong> report{pendingReports.length > 1 ? 's' : ''} stored locally
                </>
              )}
            </span>
          </div>

          <span className="hidden lg:inline-block text-[11px] text-amber-300/80 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-800/40">
            Auto-syncs upon connection
          </span>
        </div>

        {/* Right: Actions, Sync Controls, Drawer Toggle & Simulation Switch */}
        <div className="flex items-center gap-2 flex-wrap">
          {syncResult && (
            <span className="text-xs text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800/60 hidden md:inline-block font-medium">
              {syncResult}
            </span>
          )}

          {/* Simulation Toggle for quick testing */}
          <button
            type="button"
            onClick={toggleSimulateOffline}
            className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 cursor-pointer font-medium ${
              isSimulated 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={isSimulated ? "Restore real connectivity to trigger automatic synchronization" : "Simulate offline mode"}
          >
            {isSimulated ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Restore Online Connection</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Simulate Offline</span>
              </>
            )}
          </button>

          {/* View Cached Queue Button */}
          {pendingReports.length > 0 && (
            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className="text-xs text-slate-200 hover:text-white flex items-center gap-1 bg-slate-800/80 hover:bg-slate-700 px-3 py-1 rounded-md border border-slate-700 transition-colors cursor-pointer font-medium"
            >
              <span>{showDrawer ? 'Hide Queue' : `View Queue (${pendingReports.length})`}</span>
              {showDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Manual Sync Trigger (when connected) */}
          {isOnline && pendingReports.length > 0 && (
            <button
              onClick={() => handleSync(false)}
              disabled={isSyncing}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold px-3 py-1 rounded-md shadow transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Uploading to HQ...' : 'Sync Queued Now'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Offline Queue Drawer */}
      <AnimatePresence>
        {showDrawer && pendingReports.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-950 border-t border-slate-800 px-4 py-3.5 shadow-inner"
          >
            <div className="max-w-7xl mx-auto space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200 tracking-wide uppercase text-[11px]">
                    Local Encrypted Vault
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                    {pendingReports.length} pending transmission
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {lastSync && (
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 hidden sm:flex">
                      <Clock className="w-3 h-3" /> Last Upload: {new Date(lastSync).toLocaleTimeString()}
                    </span>
                  )}
                  <button
                    onClick={handleClearAllDrafts}
                    className="text-[11px] text-red-400 hover:text-red-300 transition-colors underline cursor-pointer font-medium"
                  >
                    Clear All Queued
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="grid gap-2.5 max-h-60 overflow-y-auto pr-1">
                {pendingReports.map((report) => {
                  const isIncident = report.type === 'incident';
                  const sev = report.payload.severity || 'medium';

                  const sevBadge = 
                    sev === 'critical' ? 'bg-red-500/25 text-red-300 border-red-500/40' :
                    sev === 'high' ? 'bg-orange-500/25 text-orange-300 border-orange-500/40' :
                    sev === 'medium' ? 'bg-amber-500/25 text-amber-300 border-amber-500/40' :
                    'bg-blue-500/25 text-blue-300 border-blue-500/40';

                  return (
                    <div
                      key={report.clientId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {isIncident ? (
                            <div className="p-1.5 rounded-lg bg-red-950/80 border border-red-800 text-red-400">
                              <ShieldAlert className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white font-mono text-sm">
                              {report.pollingUnitId}
                            </span>
                            <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] border ${
                              isIncident ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                              report.type === 'result' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
                              'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {report.type}
                            </span>
                            {isIncident && (
                              <span className={`px-2 py-0.5 rounded font-black uppercase text-[10px] border ${sevBadge}`}>
                                {sev} severity
                              </span>
                            )}
                            {report.status === 'syncing' && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                Syncing...
                              </span>
                            )}
                          </div>

                          <p className="text-slate-300 text-xs leading-relaxed max-w-2xl line-clamp-2">
                            {report.payload.description}
                          </p>

                          {report.payload.incidentCategory && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              Category: {report.payload.incidentCategory.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(report.createdAtISO).toLocaleTimeString()}
                        </span>

                        {report.status === 'failed' && (
                          <span className="text-[10px] text-red-300 bg-red-950/60 px-2 py-0.5 rounded border border-red-800 font-medium" title={report.errorMessage}>
                            Retry Needed
                          </span>
                        )}

                        <button
                          onClick={() => handleDeleteDraft(report.clientId)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete cached report"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
