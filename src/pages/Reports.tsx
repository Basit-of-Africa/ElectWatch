import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Report } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  Calendar, 
  MapPin, 
  Search,
  Filter,
  ChevronRight,
  Edit2,
  ExternalLink,
  Download,
  Table as TableIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const { isAdmin, isSupervisor } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const exportToCSV = () => {
    const headers = ['ID', 'Type', 'Polling Unit', 'Timestamp'];
    const csvContent = [
      headers.join(','),
      ...filteredReports.map(r => [
        r.id,
        r.type,
        r.pollingUnitId,
        (r.timestamp as any)?.toDate ? format((r.timestamp as any).toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reports_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Election Field Reports', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 14, 22);
    
    const tableData = filteredReports.map(r => [
      r.id.substring(0, 8),
      r.type.toUpperCase(),
      r.pollingUnitId,
      (r.timestamp as any)?.toDate ? format((r.timestamp as any).toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A'
    ]);

    autoTable(doc, {
      head: [['Report ID', 'Type', 'Polling Unit', 'Timestamp']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [4, 120, 87] }
    });

    doc.save(`reports_export_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    setShowExportMenu(false);
  };

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    return () => unsubscribe();
  }, []);

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.pollingUnitId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || report.type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (!isAdmin && !isSupervisor) {
    return <div className="p-20 text-center">Unauthorized Access</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold text-gray-900 font-serif tracking-tight">Field Reports</h1>
          <p className="text-gray-500 font-medium">Monitoring data stream from all active observers</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by PU ID or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3.5 bg-white border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm w-full md:w-64"
            />
          </div>
          
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-6 py-3.5 bg-white border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm outline-none font-bold text-gray-600"
          >
            <option value="all">All Types</option>
            <option value="accreditation">Accreditation</option>
            <option value="incident">Incidents</option>
            <option value="result">Results</option>
          </select>

          {/* Export Button */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-6 py-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
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
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-50">
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Report Info</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Polling Unit</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Time</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Status/Type</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic">Syncing reports...</td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic">No reports found matching your criteria</td>
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
                          to={`/incidents`} // Ideally would link to PU detail or similar if report has no detail page
                          className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-900 hover:text-white transition-all shadow-sm"
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
