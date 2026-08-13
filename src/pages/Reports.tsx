import { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Report } from '../types';
import { useAuth } from '../context/AuthContext';
import { cacheFetchedReports, getCachedReports } from '../lib/offlineStorage';
import { 
  FileText, 
  Calendar, 
  MapPin, 
  Search,
  ChevronRight,
  Edit2,
  Download,
  Table as TableIcon,
  FileSpreadsheet,
  Layers,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const { isAdmin, isSupervisor } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatCSVCell = (value: any): string => {
    if (value === null || value === undefined) return '""';
    const stringVal = String(value);
    // Escape internal double quotes and normalize line breaks
    return `"${stringVal.replace(/"/g, '""').replace(/\r?\n|\r/g, ' ')}"`;
  };

  const exportToCSV = (exportAll = false) => {
    const targetReports = exportAll ? reports : filteredReports;

    if (targetReports.length === 0) {
      toast.error('No reports available to export with current filters.');
      setShowExportMenu(false);
      return;
    }

    const headers = [
      'Report ID',
      'Timestamp (UTC/Local)',
      'Report Type',
      'Polling Unit ID',
      'Observer ID',
      'Election Scope / Level',
      'Description / Observation Notes',
      'Incident Severity',
      'Voter Count / Accredited',
      'APC Votes',
      'PDP Votes',
      'LP Votes',
      'NNPP Votes',
      'Other Votes',
      'Total Votes Recorded',
      'GPS Latitude',
      'GPS Longitude',
      'Media Attachments Count',
      'Media URLs'
    ];

    const rows = targetReports.map((r) => {
      let formattedDate = 'N/A';
      if ((r.timestamp as any)?.toDate) {
        formattedDate = format((r.timestamp as any).toDate(), 'yyyy-MM-dd HH:mm:ss');
      } else if (r.timestamp) {
        try {
          formattedDate = format(new Date(r.timestamp as any), 'yyyy-MM-dd HH:mm:ss');
        } catch {
          formattedDate = String(r.timestamp);
        }
      }

      const p = r.payload || {};
      const apc = Number(p.apcVotes) || 0;
      const pdp = Number(p.pdpVotes) || 0;
      const lp = Number(p.lpVotes) || 0;
      const nnpp = Number(p.nnppVotes) || 0;
      const other = Number(p.otherVotes) || 0;
      const totalVotesRecorded = r.type === 'result' ? (apc + pdp + lp + nnpp + other) : '';

      const mediaUrls = Array.isArray(r.media) ? r.media.map(m => m.url).join(' ; ') : '';

      return [
        formatCSVCell(r.id),
        formatCSVCell(formattedDate),
        formatCSVCell(r.type ? r.type.toUpperCase() : 'UNKNOWN'),
        formatCSVCell(r.pollingUnitId || ''),
        formatCSVCell(r.observerId || ''),
        formatCSVCell(p.electionLevel || ''),
        formatCSVCell(p.description || ''),
        formatCSVCell(p.severity ? String(p.severity).toUpperCase() : ''),
        formatCSVCell(p.voterCount !== undefined ? p.voterCount : ''),
        formatCSVCell(p.apcVotes !== undefined ? p.apcVotes : ''),
        formatCSVCell(p.pdpVotes !== undefined ? p.pdpVotes : ''),
        formatCSVCell(p.lpVotes !== undefined ? p.lpVotes : ''),
        formatCSVCell(p.nnppVotes !== undefined ? p.nnppVotes : ''),
        formatCSVCell(p.otherVotes !== undefined ? p.otherVotes : ''),
        formatCSVCell(totalVotesRecorded),
        formatCSVCell(r.location?.lat !== undefined ? r.location.lat : ''),
        formatCSVCell(r.location?.lng !== undefined ? r.location.lng : ''),
        formatCSVCell(r.media?.length || 0),
        formatCSVCell(mediaUrls)
      ].join(',');
    });

    // Add UTF-8 BOM for full international/Excel compatibility
    const csvContent = '\uFEFF' + [headers.map(formatCSVCell).join(','), ...rows].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const dateStamp = format(new Date(), 'yyyyMMdd_HHmm');
    const scopeLabel = exportAll ? 'all' : (filterType === 'all' ? 'filtered' : filterType);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `election_field_reports_${scopeLabel}_${dateStamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowExportMenu(false);
    toast.success(`Successfully exported ${targetReports.length} report(s) to CSV`);
  };

  const exportToPDF = () => {
    if (filteredReports.length === 0) {
      toast.error('No reports to export.');
      setShowExportMenu(false);
      return;
    }

    const doc = new jsPDF();
    doc.text('Election Field Reports', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} (Total: ${filteredReports.length})`, 14, 22);
    
    const tableData = filteredReports.map(r => [
      r.id.substring(0, 8),
      r.type.toUpperCase(),
      r.pollingUnitId,
      (r.timestamp as any)?.toDate ? format((r.timestamp as any).toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
      r.payload?.description ? (r.payload.description.length > 35 ? r.payload.description.substring(0, 32) + '...' : r.payload.description) : '-'
    ]);

    autoTable(doc, {
      head: [['Report ID', 'Type', 'Polling Unit', 'Timestamp', 'Notes']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [4, 120, 87] }
    });

    doc.save(`reports_export_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    setShowExportMenu(false);
    toast.success('Field Reports summary PDF generated');
  };

  useEffect(() => {
    const cached = getCachedReports();
    if (cached.length > 0) {
      setReports(cached);
      setLoading(false);
    }

    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(docs);
      cacheFetchedReports(docs);
      setLoading(false);
    }, (error) => {
      console.warn('Firestore reports snapshot failed or offline, using cached reports:', error);
      const cachedData = getCachedReports();
      if (cachedData.length > 0) {
        setReports(cachedData);
        setLoading(false);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'reports');
      }
    });

    return () => unsubscribe();
  }, []);

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.pollingUnitId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (report.payload?.description && report.payload.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (report.observerId && report.observerId.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterType === 'all' || report.type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (!isAdmin && !isSupervisor) {
    return (
      <div className="max-w-md mx-auto p-12 bg-white rounded-3xl border border-gray-100 shadow-sm text-center my-16">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500 text-sm">Administrative credentials are required to view and export the primary field reports dataset.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-gray-900 font-serif tracking-tight">Field Reports</h1>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
              {reports.length} Total Logs
            </span>
          </div>
          <p className="text-gray-500 font-medium">Live monitoring data stream & verified telemetry across polling stations</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search PU ID, notes, observer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm w-full sm:w-64"
            />
          </div>
          
          {/* Filter Type Dropdown */}
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm outline-none font-bold text-gray-700"
          >
            <option value="all">All Report Types ({reports.length})</option>
            <option value="accreditation">Accreditations</option>
            <option value="incident">Incidents & Irregularities</option>
            <option value="result">Official PU Results</option>
          </select>

          {/* Primary Quick Download CSV Button */}
          <button
            onClick={() => exportToCSV(false)}
            disabled={filteredReports.length === 0}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl shadow-sm text-sm font-bold transition-all cursor-pointer"
            title="Download currently filtered reports as CSV for external spreadsheets/analysis"
          >
            <Download className="w-4 h-4" />
            <span>Download as CSV</span>
            {filteredReports.length > 0 && (
              <span className="ml-0.5 px-2 py-0.5 bg-emerald-700/90 rounded-full text-xs font-mono">
                {filteredReports.length}
              </span>
            )}
          </button>

          {/* More Export Options Dropdown Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
              title="More export options"
            >
              <span>More</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
            
            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden"
                >
                  <div className="px-4 py-2 border-b border-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Export Dataset
                  </div>
                  
                  <button
                    onClick={() => exportToCSV(false)}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-50 text-sm font-semibold text-gray-700 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Filtered CSV</span>
                    </div>
                    <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {filteredReports.length}
                    </span>
                  </button>

                  <button
                    onClick={() => exportToCSV(true)}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-50 text-sm font-semibold text-gray-700 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span>All Reports CSV</span>
                    </div>
                    <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {reports.length}
                    </span>
                  </button>

                  <button
                    onClick={exportToPDF}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-50 text-sm font-semibold text-gray-700 flex items-center gap-2.5 transition-colors border-t border-gray-50"
                  >
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>Download PDF Summary</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Reports Table Card */}
      <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Report Info</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Polling Unit</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Time</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Status / Type</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic">Syncing live field reports...</td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic">
                    No reports found matching your search or filter criteria
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <motion.tr 
                    key={report.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50/80 transition-colors group"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          report.type === 'incident' ? 'bg-red-50 text-red-500' :
                          report.type === 'result' ? 'bg-emerald-50 text-emerald-500' :
                          'bg-blue-50 text-blue-500'
                        }`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 capitalize">{report.type}</p>
                          <p className="text-[10px] font-mono text-gray-400 uppercase tracking-tight">{report.id.substring(0, 8)}...</p>
                          {report.payload?.description && (
                            <p className="text-xs text-gray-500 line-clamp-1 max-w-xs mt-0.5">
                              {report.payload.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 font-bold text-gray-700">
                        <MapPin className="w-4 h-4 text-gray-300" />
                        {report.pollingUnitId}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4 text-gray-300" />
                        {(report.timestamp as any)?.toDate ? format((report.timestamp as any).toDate(), 'MMM d, HH:mm') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                        report.type === 'incident' ? 'bg-red-100 text-red-700' :
                        report.type === 'result' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {report.type}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <Link 
                            to={`/reports/${report.id}/edit`}
                            className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                            title="Edit Report"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                        )}
                        <Link 
                          to="/incidents"
                          className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-900 hover:text-white transition-all shadow-sm"
                          title="View Incidents Stream"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

