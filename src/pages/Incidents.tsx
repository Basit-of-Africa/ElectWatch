import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Incident, IncidentAlertThresholdConfig } from '../types';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cacheFetchedIncidents, getCachedIncidents, getQueuedIncidents, getIsOnline, syncPendingReports, PendingReport } from '../lib/offlineStorage';
import { logAuditEvent } from '../lib/audit';
import AuditTrailModal from '../components/AuditTrailModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import IncidentThresholdModal from '../components/IncidentThresholdModal';
import { 
  getStoredThresholdConfig, 
  evaluateIncidentThresholds, 
  dispatchAutomatedThresholdAlerts,
  acknowledgeBreach,
  clearAcknowledgedBreach
} from '../lib/incidentAlertService';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Search,
  Filter,
  MoreVertical,
  ChevronRight,
  ShieldAlert,
  Download,
  FileText,
  Table as TableIcon,
  Camera,
  Trash2,
  History,
  Sliders,
  BellRing,
  Flame,
  Zap,
  WifiOff,
  Wifi,
  HardDrive,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Incidents() {
  const { isAdmin } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Audit Trail & Deletion Modal states
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
  const [incidentToDelete, setIncidentToDelete] = useState<Incident | null>(null);

  // Automated Alert Thresholds state
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [thresholdConfig, setThresholdConfig] = useState<IncidentAlertThresholdConfig>(getStoredThresholdConfig());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Offline Queued Incidents State
  const [queuedIncidents, setQueuedIncidents] = useState<PendingReport[]>(getQueuedIncidents);
  const [isOnline, setIsOnline] = useState(getIsOnline);
  const [isSyncingQueued, setIsSyncingQueued] = useState(false);

  // Sync threshold config & offline queue updates
  useEffect(() => {
    const handleConfigUpdate = () => {
      setThresholdConfig(getStoredThresholdConfig());
      setRefreshTrigger(prev => prev + 1);
    };
    const handleAckUpdate = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    const handleQueueChange = () => {
      setQueuedIncidents(getQueuedIncidents());
      setIsOnline(getIsOnline());
    };

    window.addEventListener('incident-threshold-config-updated', handleConfigUpdate);
    window.addEventListener('incident-threshold-ack-updated', handleAckUpdate);
    window.addEventListener('ivote_pending_reports_updated', handleQueueChange);
    window.addEventListener('ivote_network_status_change', handleQueueChange);
    window.addEventListener('online', handleQueueChange);
    window.addEventListener('offline', handleQueueChange);

    return () => {
      window.removeEventListener('incident-threshold-config-updated', handleConfigUpdate);
      window.removeEventListener('incident-threshold-ack-updated', handleAckUpdate);
      window.removeEventListener('ivote_pending_reports_updated', handleQueueChange);
      window.removeEventListener('ivote_network_status_change', handleQueueChange);
      window.removeEventListener('online', handleQueueChange);
      window.removeEventListener('offline', handleQueueChange);
    };
  }, []);

  const handleSyncQueuedIncidents = async () => {
    setIsSyncingQueued(true);
    try {
      const res = await syncPendingReports();
      setQueuedIncidents(getQueuedIncidents());
      if (res.incidentCount > 0) {
        toast.success(`Successfully synchronized ${res.incidentCount} queued incident report(s)!`);
      } else if (res.successCount > 0) {
        toast.success(`Synchronized ${res.successCount} offline report(s)!`);
      }
    } catch (err) {
      toast.error('Failed to synchronize queued incidents.');
    } finally {
      setIsSyncingQueued(false);
    }
  };

  // Live evaluation of threshold breaches
  const { breaches } = useMemo(() => {
    return evaluateIncidentThresholds(incidents, thresholdConfig);
  }, [incidents, thresholdConfig, refreshTrigger]);

  const puBreachMap = useMemo(() => {
    return new Map(breaches.map(b => [b.pollingUnitId, b]));
  }, [breaches]);

  const unacknowledgedBreaches = useMemo(() => {
    return breaches.filter(b => !b.acknowledged);
  }, [breaches]);

  // Automated notification dispatcher
  useEffect(() => {
    if (incidents.length > 0 && thresholdConfig.enabled && breaches.length > 0) {
      dispatchAutomatedThresholdAlerts(breaches, thresholdConfig);
    }
  }, [breaches, thresholdConfig]);

  const exportToCSV = () => {
    const headers = ['ID', 'Polling Unit', 'Severity', 'Status', 'Description', 'Timestamp'];
    const csvContent = [
      headers.join(','),
      ...filteredIncidents.map(i => [
        i.id,
        i.pollingUnitId,
        i.severity,
        i.status,
        `"${i.description.replace(/"/g, '""')}"`,
        (i.timestamp as any)?.toDate ? format((i.timestamp as any).toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `incidents_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Election Incident Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 14, 22);
    
    const tableData = filteredIncidents.map(i => [
      i.pollingUnitId,
      i.severity.toUpperCase(),
      i.status.toUpperCase(),
      i.description,
      (i.timestamp as any)?.toDate ? format((i.timestamp as any).toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A'
    ]);

    autoTable(doc, {
      head: [['PU', 'Severity', 'Status', 'Description', 'Timestamp']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [4, 120, 87] }
    });

    doc.save(`incidents_export_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    setShowExportMenu(false);
  };

  useEffect(() => {
    const cached = getCachedIncidents();
    if (cached.length > 0) {
      setIncidents(cached);
      setLoading(false);
    }

    const q = query(collection(db, 'incidents'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      setIncidents(docs);
      cacheFetchedIncidents(docs);
      setLoading(false);
    }, (error) => {
      console.warn('Firestore incidents snapshot failed or offline, using cached incidents:', error);
      const cachedData = getCachedIncidents();
      if (cachedData.length > 0) {
        setIncidents(cachedData);
        setLoading(false);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'incidents');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (incidentId: string, status: Incident['status']) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'incidents', incidentId), { status });
      // Log the change for history
      await addDoc(collection(db, `incidents/${incidentId}/history`), {
        status,
        updatedBy: auth.currentUser?.uid,
        updatedByName: auth.currentUser?.displayName || 'Administrator',
        timestamp: serverTimestamp(),
      });
      toast.success(`Incident status updated to ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${incidentId}`);
    }
  };

  const handleConfirmDeleteIncident = async (reason: string) => {
    if (!isAdmin) {
      toast.error('Unauthorized: Only administrators can delete incidents.');
      return;
    }
    if (!incidentToDelete) return;

    const incidentId = incidentToDelete.id;
    const puId = incidentToDelete.pollingUnitId;

    try {
      // 1. Log immutable audit trail entry first
      await logAuditEvent({
        action: 'DELETE_INCIDENT',
        targetId: incidentId,
        targetType: 'incident',
        pollingUnitId: puId,
        summary: incidentToDelete.description,
        reason,
        snapshot: incidentToDelete
      });

      // 2. Delete incident document
      await deleteDoc(doc(db, 'incidents', incidentId));

      toast.success(`Incident #${incidentId.substring(0, 8)} deleted and logged to System Audit Trail.`);
      setIncidentToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete incident:', err);
      toast.error('Failed to delete incident: ' + (err.message || 'Permission denied'));
    }
  };

  const filteredIncidents = incidents.filter(i => {
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || i.severity === severityFilter;
    const matchesSearch = 
      i.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
      i.pollingUnitId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSeverity && matchesSearch;
  });

  const SeverityBadge = ({ severity }: { severity: Incident['severity'] }) => {
    const colors = {
      low: 'bg-blue-100 text-blue-700',
      medium: 'bg-amber-100 text-amber-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[severity]}`}>
        {severity}
      </span>
    );
  };

  const StatusIcon = ({ status }: { status: Incident['status'] }) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'investigating': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'resolved': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight font-serif">Incident Management</h1>
          <p className="text-gray-500 mt-2 text-lg">Track and respond to field reports marked as critical.</p>
        </div>
        
        <div className="flex flex-col md:flex-row xl:flex-row xl:items-center gap-4 w-full xl:w-auto">
          {/* Alert Thresholds Configuration Button */}
          <button
            onClick={() => setIsThresholdModalOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl shadow-sm text-sm font-bold transition-all cursor-pointer shrink-0 relative group"
            title="Configure Automated Incident Alert Trigger Thresholds"
          >
            <Sliders className="w-4 h-4 text-emerald-600 group-hover:rotate-45 transition-transform" />
            <span>Alert Thresholds</span>
            {thresholdConfig.enabled && breaches.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                unacknowledgedBreaches.length > 0 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {breaches.length} {breaches.length === 1 ? 'Hotspot' : 'Hotspots'}
              </span>
            )}
          </button>

          {/* Audit Trail Button */}
          {isAdmin && (
            <button
              onClick={() => setIsAuditTrailOpen(true)}
              className="flex items-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-sm text-sm font-bold transition-all cursor-pointer border border-slate-700 shrink-0"
              title="Open System Audit Trail"
            >
              <History className="w-4 h-4 text-emerald-400" />
              <span>Audit Trail</span>
            </button>
          )}

          {/* Search Bar */}
          <div className="relative group flex-1 md:min-w-[260px]">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
             <input 
               type="text" 
               placeholder="Search incidents or PU..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-sm"
             />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Export Button */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                Export
              </button>
              
              <AnimatePresence>
                {showExportMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden"
                  >
                    <button
                      onClick={exportToCSV}
                      className="w-full px-4 py-3 text-left hover:bg-emerald-50 text-sm font-bold text-gray-700 flex items-center gap-3 transition-colors cursor-pointer"
                    >
                      <TableIcon className="w-4 h-4 text-emerald-600" />
                      Export to CSV
                    </button>
                    <button
                      onClick={exportToPDF}
                      className="w-full px-4 py-3 text-left hover:bg-emerald-50 text-sm font-bold text-gray-700 flex items-center gap-3 transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-emerald-600" />
                      Export to PDF
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit">
              {['all', 'pending', 'investigating', 'resolved'].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all cursor-pointer ${
                    statusFilter === f ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit">
              <div className="px-3 text-[10px] font-black uppercase text-gray-400 tracking-widest border-r border-gray-100 mr-2">Severity</div>
              {['all', 'low', 'medium', 'high', 'critical'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                    severityFilter === s 
                      ? s === 'critical' ? 'bg-red-600 text-white shadow-lg' :
                        s === 'high' ? 'bg-orange-600 text-white shadow-lg' :
                        s === 'medium' ? 'bg-amber-500 text-white shadow-lg' :
                        s === 'low' ? 'bg-blue-600 text-white shadow-lg' :
                        'bg-gray-900 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Automated Threshold Breaches Banner */}
      {thresholdConfig.enabled && breaches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 sm:p-6 bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 rounded-3xl border-2 border-red-200 shadow-sm space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-3 bg-red-600 text-white rounded-2xl shadow-md shadow-red-500/20 shrink-0">
                <BellRing className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight font-serif">
                    Automated Alert Trigger: {breaches.length} Polling Unit{breaches.length > 1 ? 's' : ''} Exceeded Threshold
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
                    Limit: ≥ {thresholdConfig.incidentCountThreshold} Reports
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Automated surveillance engine flagged clusters of incidents requiring urgent administrative escalation.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsThresholdModalOpen(true)}
                className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                <span>Configure Rules</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Chips for Breached Polling Units */}
          <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-red-600" /> Hotspot PUs:
            </span>
            {breaches.map((b) => (
              <button
                key={b.pollingUnitId}
                onClick={() => setSearchQuery(b.pollingUnitId)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                  searchQuery === b.pollingUnitId
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white hover:bg-red-100/60 text-gray-800 border-red-200'
                }`}
                title={`Filter incidents for PU #${b.pollingUnitId} (${b.count} reports)`}
              >
                <span className="font-mono font-bold">PU #{b.pollingUnitId}</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-red-600 text-white">
                  {b.count} reports
                </span>
                {b.acknowledged && (
                  <span className="text-[10px] text-gray-400 font-normal">(Ack'd)</span>
                )}
              </button>
            ))}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-2.5 py-1 text-xs font-bold text-gray-500 hover:text-gray-800 underline cursor-pointer shrink-0"
              >
                Clear Filter
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Offline Queued Incident Reports Alert */}
      {queuedIncidents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-3xl bg-amber-50 border border-amber-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-800 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-amber-950 text-base">
                  {queuedIncidents.length} Offline Incident Report{queuedIncidents.length > 1 ? 's' : ''} Queued Locally
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-200 text-amber-900 border border-amber-300">
                  {isOnline ? 'Ready to Sync' : 'Awaiting Connection'}
                </span>
              </div>
              <p className="text-sm text-amber-800/90 mt-1 leading-relaxed">
                {isOnline 
                  ? 'Internet connection is active. These incidents are securely staged on this device and can be synced immediately or will auto-sync.'
                  : 'You are working offline. These incidents are safely stored in your device\'s local storage and will automatically upload once connectivity is restored.'}
              </p>
              
              {/* Pill list of queued polling units */}
              <div className="flex items-center gap-2 flex-wrap mt-2.5">
                {queuedIncidents.map((q) => (
                  <span
                    key={q.clientId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-amber-200 text-xs font-mono font-medium text-amber-900 shadow-xs"
                  >
                    <span>PU #{q.pollingUnitId}</span>
                    <span className="text-[10px] uppercase font-bold text-amber-700">({q.payload.severity || 'med'})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
            {isOnline ? (
              <button
                type="button"
                onClick={handleSyncQueuedIncidents}
                disabled={isSyncingQueued}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-2xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingQueued ? 'animate-spin' : ''}`} />
                <span>{isSyncingQueued ? 'Synchronizing...' : 'Sync Queued Now'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-100 px-3 py-2 rounded-2xl border border-amber-200">
                <WifiOff className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Auto-sync enabled</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 text-center text-gray-400">Loading incidents...</div>
        ) : filteredIncidents.length === 0 ? (
          <div className="p-20 text-center text-gray-400 flex flex-col items-center">
            <ShieldAlert className="w-16 h-16 mb-4 opacity-10" />
            <p className="text-lg">No incidents reported in this category.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <AnimatePresence>
              {filteredIncidents.map((incident) => (
                <motion.div
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  key={incident.id}
                  className="p-8 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <StatusIcon status={incident.status} />
                        <h3 className="text-xl font-bold text-gray-900 tracking-tight font-mono">
                          PU #{incident.pollingUnitId}
                        </h3>
                        <SeverityBadge severity={incident.severity} />
                        {puBreachMap.has(incident.pollingUnitId) && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery(incident.pollingUnitId)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 hover:bg-red-200 text-red-800 border border-red-200 cursor-pointer transition-colors"
                            title={`Automated alert trigger: ${puBreachMap.get(incident.pollingUnitId)?.count} incidents exceed threshold limit of ${thresholdConfig.incidentCountThreshold}. Click to filter.`}
                          >
                            <Flame className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                            <span>Hotspot ({puBreachMap.get(incident.pollingUnitId)?.count} Reports)</span>
                          </button>
                        )}
                      </div>
                      
                      <p className="text-gray-600 text-lg leading-relaxed max-w-3xl">
                        {incident.description}
                      </p>

                      {incident.media && incident.media.length > 0 && (
                        <div className="flex items-center gap-3 pt-1">
                          <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 border border-emerald-200">
                            <Camera className="w-3.5 h-3.5 text-emerald-600" /> {incident.media.length} Photo{incident.media.length > 1 ? 's' : ''} Attached
                          </span>
                          <div className="flex items-center gap-2 overflow-x-auto py-1">
                            {incident.media.map((m, idx) => (
                              <Link 
                                key={idx} 
                                to={`/incidents/${incident.id}`}
                                className="w-12 h-12 rounded-xl overflow-hidden border border-emerald-100 relative group flex-shrink-0 shadow-sm hover:scale-105 transition-all"
                                title="Click to view in Incident Detail"
                              >
                                <img src={m.url} className="w-full h-full object-cover" alt="Evidence Thumbnail" />
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-6 text-sm text-gray-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" /> 
                          {(incident.timestamp as any)?.toDate ? formatDistanceToNow((incident.timestamp as any).toDate(), { addSuffix: true }) : 'N/A'}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-gray-300" />
                        <span className="flex items-center gap-1.5">
                          Report ID: <span className="font-mono text-xs bg-gray-100 px-1.5 rounded">{incident.reportId.slice(0, 8)}</span>
                        </span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex md:flex-col justify-end gap-2 border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8 min-w-[180px]">
                        <p className="text-[10px] font-extrabold uppercase text-gray-400 tracking-widest mb-2 hidden md:block">Update Status</p>
                        <button
                          onClick={() => handleStatusUpdate(incident.id, 'investigating')}
                          disabled={incident.status === 'investigating'}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            incident.status === 'investigating' 
                              ? 'bg-orange-50 text-orange-600 border border-orange-100 shadow-sm shadow-orange-500/10' 
                              : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600'
                          }`}
                        >
                          Investigating
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(incident.id, 'resolved')}
                          disabled={incident.status === 'resolved'}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            incident.status === 'resolved' 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm shadow-emerald-500/10' 
                              : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                        >
                          Resolve Issue
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(incident.id, 'pending')}
                          disabled={incident.status === 'pending'}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            incident.status === 'pending' 
                              ? 'bg-amber-50 text-amber-600 border border-amber-100 shadow-sm shadow-amber-500/10' 
                              : 'text-gray-500 hover:bg-amber-50 hover:text-amber-600'
                          }`}
                        >
                          Back to Pending
                        </button>
                        
                        <Link 
                          to={`/incidents/${incident.id}`}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gray-50 text-emerald-700 hover:bg-emerald-50 mt-2 transition-all border border-gray-100"
                        >
                          View Details <ChevronRight className="w-3 h-3" />
                        </Link>

                        {/* Admin Delete Incident Button */}
                        <button
                          onClick={() => setIncidentToDelete(incident)}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all border border-red-100 cursor-pointer mt-1"
                          title="Delete Incident (Admin Only - Logged to Audit Trail)"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete Incident</span>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal for Incidents */}
      <DeleteConfirmationModal
        isOpen={!!incidentToDelete}
        onClose={() => setIncidentToDelete(null)}
        onConfirm={handleConfirmDeleteIncident}
        title="Delete Incident Record"
        itemDescription={incidentToDelete?.description || `Incident ${incidentToDelete?.id}`}
        itemType="incident"
        pollingUnitId={incidentToDelete?.pollingUnitId}
      />

      {/* Audit Trail Modal */}
      <AuditTrailModal
        isOpen={isAuditTrailOpen}
        onClose={() => setIsAuditTrailOpen(false)}
      />

      {/* Automated Incident Alert Thresholds Modal */}
      <IncidentThresholdModal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        incidents={incidents}
        onSelectPollingUnitFilter={(pu) => setSearchQuery(pu)}
      />
    </div>
  );
}
