import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, orderBy, onSnapshot, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Incident, Report, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  User as UserIcon, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  History,
  Calendar,
  MessageSquare,
  Edit2,
  Sparkles,
  Zap,
  Camera
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { summarizeIncident } from '../services/geminiService';

interface IncidentHistory {
  id: string;
  status: string;
  updatedBy: string;
  updatedByName: string;
  timestamp: any;
}

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [observer, setObserver] = useState<User | null>(null);
  const [history, setHistory] = useState<IncidentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      try {
        const incidentSnap = await getDoc(doc(db, 'incidents', id));
        if (!incidentSnap.exists()) {
          setLoading(false);
          return;
        }

        const incidentData = { id: incidentSnap.id, ...incidentSnap.data() } as Incident;
        setIncident(incidentData);

        // Fetch associated report
        const reportSnap = await getDoc(doc(db, 'reports', incidentData.reportId));
        if (reportSnap.exists()) {
          const reportData = { id: reportSnap.id, ...reportSnap.data() } as Report;
          setReport(reportData);

          // Fetch observer details
          const observerSnap = await getDoc(doc(db, 'users', reportData.observerId));
          if (observerSnap.exists()) {
            setObserver(observerSnap.data() as User);
          }
        }

        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `incidents/${id}`);
      }
    };

    fetchDetails();

    // Subscribe to history
    const historyQuery = query(collection(db, `incidents/${id}/history`), orderBy('timestamp', 'desc'));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncidentHistory)));
    });

    return () => unsubscribeHistory();
  }, [id]);

  const handleStatusUpdate = async (status: Incident['status']) => {
    if (!isAdmin || !id) return;
    try {
      await updateDoc(doc(db, 'incidents', id), { status });
      await addDoc(collection(db, `incidents/${id}/history`), {
        status,
        updatedBy: auth.currentUser?.uid,
        updatedByName: auth.currentUser?.displayName,
        timestamp: serverTimestamp(),
      });
      // Update local state for immediate feedback
      setIncident(prev => prev ? { ...prev, status } : null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${id}`);
    }
  };

  const handleGenerateAiSummary = async () => {
    if (!incident) return;
    setIsAiLoading(true);
    try {
      const summary = await summarizeIncident(incident.description, incident.severity);
      setAiSummary(summary);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading incident details...</div>;
  if (!incident) return <div className="p-20 text-center">Incident not found.</div>;

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    investigating: 'bg-orange-100 text-orange-700 border-orange-200',
    resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <Link to="/incidents" className="inline-flex items-center gap-2 text-gray-500 hover:text-emerald-700 transition-colors font-bold group">
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back to Incidents
      </Link>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-10">
        {/* Main Incident Details */}
        <div className="lg:col-span-2 space-y-10">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-10 space-y-8"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-serif">Incident Report</h1>
                  <p className="text-gray-400 font-mono text-xs uppercase tracking-widest mt-1">ID: {incident.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isAdmin && report && (
                  <Link 
                    to={`/reports/${report.id}/edit`}
                    className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Original Report
                  </Link>
                )}
                <span className={`px-4 py-2 rounded-2xl font-bold text-sm border uppercase tracking-tighter ${statusColors[incident.status]}`}>
                  {incident.status}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Incident Description</h3>
              <p className="text-xl text-gray-700 leading-relaxed font-medium">
                {incident.description}
              </p>
            </div>

            {/* Visual Evidence Section */}
            {report?.media && report.media.length > 0 && (
              <div className="pt-8 border-t border-gray-50">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest px-1 mb-6">
                  <Camera className="w-4 h-4" /> Visual Evidence
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {report.media.map((item, idx) => (
                    <div key={idx} className="aspect-square rounded-3xl overflow-hidden border-2 border-gray-50 relative group shadow-sm hover:shadow-xl transition-all">
                      <img src={item.url} className="w-full h-full object-cover" alt="Evidence" />
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent translate-y-full group-hover:translate-y-0 transition-transform">
                        <p className="text-[7px] text-white/90 font-mono break-all">{item.hash}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {aiSummary && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-950 text-white rounded-[32px] p-8 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-20 h-20" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 text-emerald-400 mb-4">
                      <Zap className="w-5 h-5 fill-current" />
                      <span className="text-xs font-bold uppercase tracking-[0.2em] font-mono">AI Security Analysis</span>
                    </div>
                    <div className="prose prose-invert prose-sm">
                      <p className="text-emerald-50/90 whitespace-pre-wrap font-medium leading-relaxed">
                        {aiSummary}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!aiSummary && (
              <button 
                onClick={handleGenerateAiSummary}
                disabled={isAiLoading}
                className="w-full py-4 border-2 border-emerald-100 rounded-3xl text-emerald-700 font-bold flex items-center justify-center gap-2 hover:bg-emerald-50 transition-all disabled:opacity-50"
              >
                {isAiLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                    Analyzing Situation...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate AI Incident Summary
                  </>
                )}
              </button>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-gray-50">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Polling Unit</p>
                <div className="flex items-center gap-1.5 font-bold text-gray-900">
                   <MapPin className="w-4 h-4 text-emerald-600" />
                   {incident.pollingUnitId}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Report Type</p>
                <div className="flex items-center gap-1.5 font-bold text-gray-900 capitalize">
                   <FileText className="w-4 h-4 text-emerald-600" />
                   {report?.type || 'N/A'}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Report Time</p>
                <div className="flex items-center gap-1.5 font-bold text-gray-900">
                   <Calendar className="w-4 h-4 text-emerald-600" />
                   {incident.timestamp instanceof Object ? format((incident.timestamp as any).toDate(), 'MMM d, h:mm a') : 'N/A'}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Original Report Payload */}
          {report && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-10"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 font-serif">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                Associated Report Details
              </h3>
              <div className="bg-gray-50 rounded-3xl p-8 space-y-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Voter Sentiment</label>
                    <p className="font-semibold text-gray-800">Normal / Calm</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">INEC Presence</label>
                    <p className="font-semibold text-gray-800">Verified Personnel On-site</p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Observer Raw Comments</label>
                  <p className="text-sm text-gray-600 italic leading-relaxed">
                    "{report.payload?.description || 'N/A'}"
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar: Observer & History */}
        <div className="space-y-10">
          {/* Admin Controls */}
          {isAdmin && (
            <motion.div 
               initial={{ opacity: 0, x: 10 }}
               animate={{ opacity: 1, x: 0 }}
               className="bg-gray-900 rounded-[32px] p-8 text-white space-y-6"
            >
              <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400">Resolution Controls</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => handleStatusUpdate('investigating')}
                  disabled={incident.status === 'investigating'}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all border ${
                    incident.status === 'investigating' 
                      ? 'bg-orange-500 border-orange-500 text-white cursor-default shadow-lg shadow-orange-500/20' 
                      : 'bg-transparent border-gray-700 text-gray-400 hover:border-orange-500 hover:text-orange-500'
                  }`}
                >
                  Mark for Investigation
                </button>
                <button 
                  onClick={() => handleStatusUpdate('resolved')}
                  disabled={incident.status === 'resolved'}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all border ${
                    incident.status === 'resolved' 
                      ? 'bg-emerald-600 border-emerald-600 text-white cursor-default shadow-lg shadow-emerald-600/20' 
                      : 'bg-transparent border-gray-700 text-gray-400 hover:border-emerald-600 hover:text-emerald-500'
                  }`}
                >
                  Resolve Incident
                </button>
                <button 
                  onClick={() => handleStatusUpdate('pending')}
                  disabled={incident.status === 'pending'}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all border ${
                    incident.status === 'pending' 
                      ? 'bg-amber-500 border-amber-500 text-white cursor-default shadow-lg shadow-amber-500/20' 
                      : 'bg-transparent border-gray-700 text-gray-400 hover:border-amber-500 hover:text-amber-500'
                  }`}
                >
                  Reset to Pending
                </button>
              </div>
            </motion.div>
          )}

          {/* Observer Profile */}
          <motion.div 
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8"
          >
            <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <UserIcon className="w-4 h-4" /> Reporting Observer
            </h3>
            {observer ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold">
                    {observer.displayName[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{observer.displayName}</p>
                    <p className="text-xs text-gray-500">{observer.email}</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-50 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Verified Credentials</p>
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-full w-fit">
                    <CheckCircle2 className="w-3 h-3" /> Field Agent
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">Observer information unavailable</p>
            )}
          </motion.div>

          {/* Update History */}
          <motion.div 
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8"
          >
            <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <History className="w-4 h-4" /> Progress Log
            </h3>
            <div className="space-y-6">
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 italic">No status updates logged yet</p>
              ) : (
                history.map((log, idx) => (
                  <div key={log.id} className="relative pl-6 pb-6 last:pb-0">
                    {idx !== history.length - 1 && (
                      <div className="absolute left-[3px] top-[14px] bottom-0 w-px bg-gray-100" />
                    )}
                    <div className="absolute left-0 top-1 w-[7px] h-[7px] rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-bold text-gray-900 capitalize italic">Changed to: {log.status}</span>
                        <span className="text-[9px] text-gray-400 font-mono">
                          {log.timestamp instanceof Object ? format((log.timestamp as any).toDate(), 'HH:mm') : 'Now'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500">By {log.updatedByName || 'System'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
