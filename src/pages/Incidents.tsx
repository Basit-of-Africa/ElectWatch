import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Incident } from '../types';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  Table as TableIcon
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
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
    const q = query(collection(db, 'incidents'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIncidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'incidents');
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
        updatedByName: auth.currentUser?.displayName,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${incidentId}`);
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
          {/* Search Bar */}
          <div className="relative group flex-1 md:min-w-[300px]">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
             <input 
               type="text" 
               placeholder="Search incidents or polling units..." 
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
              className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
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
                    className="w-full px-4 py-3 text-left hover:bg-emerald-50 text-sm font-bold text-gray-700 flex items-center gap-3 transition-colors"
                  >
                    <TableIcon className="w-4 h-4 text-emerald-600" />
                    Export to CSV
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-50 text-sm font-bold text-gray-700 flex items-center gap-3 transition-colors"
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
                className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
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
                      <div className="flex items-center gap-4">
                        <StatusIcon status={incident.status} />
                        <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                          PU #{incident.pollingUnitId}
                        </h3>
                        <SeverityBadge severity={incident.severity} />
                      </div>
                      
                      <p className="text-gray-600 text-lg leading-relaxed max-w-3xl">
                        {incident.description}
                      </p>

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
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
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
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
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
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            incident.status === 'pending' 
                              ? 'bg-amber-50 text-amber-600 border border-amber-100 shadow-sm shadow-amber-500/10' 
                              : 'text-gray-500 hover:bg-amber-50 hover:text-amber-600'
                          }`}
                        >
                          Back to Pending
                        </button>
                        
                        <Link 
                          to={`/app/incidents/${incident.id}`}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gray-50 text-emerald-700 hover:bg-emerald-50 mt-2 transition-all border border-gray-100"
                        >
                          View Full Details <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
