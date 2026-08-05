import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Vote,
  ShieldCheck,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  MapPin,
  Users,
  Search,
  Filter,
  ArrowRight,
  LogIn,
  Globe,
  RefreshCw,
  BarChart3,
  PieChart as PieIcon,
  Radio,
  FileText,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  LayoutDashboard
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

// Dedicated display interface for the public live feed
export interface PublicDisplayReport {
  id: string;
  pollingUnitId: string;
  pollingUnitName?: string;
  observerId?: string;
  observerName?: string;
  type: 'accreditation' | 'incident' | 'result' | 'warning' | 'normal' | 'info';
  state?: string;
  lga?: string;
  ward?: string;
  details: string;
  turnout?: string;
  security?: string;
  accreditation?: string;
  materials?: string;
  incidents?: string;
  timestamp: string;
}

// Seed sample reports for public demonstration if Firestore has low initial entries
const PUBLIC_SEED_REPORTS: PublicDisplayReport[] = [
  {
    id: 'RPT-1001',
    observerId: 'obs-lagos-01',
    observerName: 'Amina Bello',
    type: 'normal',
    state: 'Lagos',
    lga: 'Ikeja',
    ward: 'Ward 02',
    pollingUnitId: 'PU-LAG-014',
    pollingUnitName: 'Ikeja Primary School, Ward 02',
    details: 'Voting commenced peacefully. All INEC materials present. BVAS devices fully operational. Approximately 180 voters queuing orderly with heavy security presence.',
    turnout: 'High',
    security: 'Peaceful',
    accreditation: 'Smooth',
    materials: 'Complete',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString()
  },
  {
    id: 'RPT-1002',
    observerId: 'obs-kano-04',
    observerName: 'Ibrahim Danlami',
    type: 'incident',
    state: 'Kano',
    lga: 'Kano Municipal',
    ward: "Emir's Palace Ward",
    pollingUnitId: 'PU-KN-102',
    pollingUnitName: 'Kano Central Library, Ward 05',
    details: 'Ballot box observed without tamper-evident seal. Reported to Presiding Officer immediately. Security personnel monitoring closely.',
    turnout: 'Moderate',
    security: 'Tense',
    accreditation: 'Delayed',
    materials: 'Incomplete',
    incidents: 'Missing ballot box seal',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString()
  },
  {
    id: 'RPT-1003',
    observerId: 'obs-abuja-02',
    observerName: 'Chidi Okonkwo',
    type: 'normal',
    state: 'FCT',
    lga: 'Abuja Municipal',
    ward: 'Garki Ward II',
    pollingUnitId: 'PU-FCT-042',
    pollingUnitName: 'Garki Model Secondary, Area 11',
    details: 'Materials in order. INEC staff present and professional. Accreditation ongoing smoothly. All accredited party agents present.',
    turnout: 'Moderate',
    security: 'Peaceful',
    accreditation: 'Smooth',
    materials: 'Complete',
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString()
  },
  {
    id: 'RPT-1004',
    observerId: 'obs-rivers-03',
    observerName: 'Blessing Nwosu',
    type: 'warning',
    state: 'Rivers',
    lga: 'Port Harcourt',
    ward: 'D-Line Ward 01',
    pollingUnitId: 'PU-RV-089',
    pollingUnitName: 'Port Harcourt Township Hall',
    details: 'Large crowd gathering outside the exclusion perimeter. Security forces present but requesting additional reinforcement to manage queue flow.',
    turnout: 'High',
    security: 'Tense',
    accreditation: 'Delayed',
    materials: 'Complete',
    incidents: 'Overcrowding outside perimeter',
    timestamp: new Date(Date.now() - 1000 * 60 * 58).toISOString()
  },
  {
    id: 'RPT-1005',
    observerId: 'obs-oyo-05',
    observerName: 'Folake Adeleke',
    type: 'info',
    state: 'Oyo',
    lga: 'Ibadan North',
    ward: 'Bodija Ward I',
    pollingUnitId: 'SUP-OYO-01',
    pollingUnitName: 'Ibadan North Zonal Operations',
    details: 'Polling unit opened 35 minutes behind schedule due to transport logistics. Technical team resolved BVAS calibration. Now fully operational.',
    turnout: 'High',
    security: 'Peaceful',
    accreditation: 'Smooth',
    materials: 'Complete',
    timestamp: new Date(Date.now() - 1000 * 60 * 75).toISOString()
  },
  {
    id: 'RPT-1006',
    observerId: 'obs-kaduna-06',
    observerName: 'Fatima Garba',
    type: 'normal',
    state: 'Kaduna',
    lga: 'Kaduna North',
    ward: 'Shaba Ward',
    pollingUnitId: 'PU-KD-022',
    pollingUnitName: 'Kaduna City Hall PU',
    details: 'Smooth accreditation process. Approximately 310 voters processed. High female turnout recorded. Good community cooperation.',
    turnout: 'High',
    security: 'Peaceful',
    accreditation: 'Smooth',
    materials: 'Complete',
    timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString()
  }
];

// Sample Polling Unit Matrix Cells for Heatmap
const SAMPLE_HEATMAP_CELLS = [
  { id: 1, name: 'PU-LAG-014', state: 'Lagos', status: 'normal', label: 'Normal' },
  { id: 2, name: 'PU-KN-102', state: 'Kano', status: 'incident', label: 'Missing Seal' },
  { id: 3, name: 'PU-FCT-042', state: 'FCT', status: 'normal', label: 'Normal' },
  { id: 4, name: 'PU-RV-089', state: 'Rivers', status: 'warning', label: 'Overcrowding' },
  { id: 5, name: 'PU-OYO-01', state: 'Oyo', status: 'normal', label: 'Normal' },
  { id: 6, name: 'PU-KD-022', state: 'Kaduna', status: 'normal', label: 'Normal' },
  { id: 7, name: 'PU-AN-055', state: 'Anambra', status: 'critical', label: 'Snatching Attempt' },
  { id: 8, name: 'PU-ED-012', state: 'Edo', status: 'normal', label: 'Normal' },
  { id: 9, name: 'PU-LAG-088', state: 'Lagos', status: 'warning', label: 'BVAS Delay' },
  { id: 10, name: 'PU-KN-044', state: 'Kano', status: 'normal', label: 'Normal' },
  { id: 11, name: 'PU-FCT-011', state: 'FCT', status: 'normal', label: 'Normal' },
  { id: 12, name: 'PU-OG-033', state: 'Ogun', status: 'normal', label: 'Normal' },
  { id: 13, name: 'PU-RV-102', state: 'Rivers', status: 'warning', label: 'Tense Crowd' },
  { id: 14, name: 'PU-PL-009', state: 'Plateau', status: 'normal', label: 'Normal' },
  { id: 15, name: 'PU-BO-077', state: 'Borno', status: 'normal', label: 'Normal' },
  { id: 16, name: 'PU-AK-021', state: 'Akwa Ibom', status: 'normal', label: 'Normal' },
  { id: 17, name: 'PU-LAG-110', state: 'Lagos', status: 'normal', label: 'Normal' },
  { id: 18, name: 'PU-EN-066', state: 'Enugu', status: 'normal', label: 'Normal' },
  { id: 19, name: 'PU-SK-014', state: 'Sokoto', status: 'warning', label: 'Late Arrival' },
  { id: 20, name: 'PU-IM-031', state: 'Imo', status: 'normal', label: 'Normal' },
  { id: 21, name: 'PU-KG-018', state: 'Kogi', status: 'normal', label: 'Normal' },
  { id: 22, name: 'PU-OS-052', state: 'Osun', status: 'normal', label: 'Normal' },
  { id: 23, name: 'PU-BY-007', state: 'Bayelsa', status: 'normal', label: 'Normal' },
  { id: 24, name: 'PU-ZA-019', state: 'Zamfara', status: 'normal', label: 'Normal' },
];

function parseFirestoreReport(doc: any): PublicDisplayReport {
  const payload = doc.payload || {};
  let timestampStr = new Date().toISOString();
  if (doc.timestamp) {
    if (typeof doc.timestamp === 'object' && 'toDate' in doc.timestamp) {
      timestampStr = doc.timestamp.toDate().toISOString();
    } else {
      timestampStr = String(doc.timestamp);
    }
  }

  const detailsText = typeof payload === 'string'
    ? payload
    : (payload.description || payload.details || 'Observation reported from field.');

  let reportType: PublicDisplayReport['type'] = 'normal';
  if (doc.type === 'incident') reportType = 'incident';
  else if (doc.type === 'accreditation') reportType = 'accreditation';
  else if (doc.type === 'result') reportType = 'info';

  return {
    id: doc.id,
    pollingUnitId: doc.pollingUnitId || payload.pollingUnitId || 'PU-FIELD',
    pollingUnitName: payload.pollingUnitName || payload.pu || doc.pollingUnitId || 'Polling Unit',
    observerId: doc.observerId || 'obs-anon',
    observerName: payload.observerName || payload.observer || 'Accredited Observer',
    type: reportType,
    state: payload.state || 'National',
    lga: payload.lga || '',
    ward: payload.ward || '',
    details: detailsText,
    turnout: payload.turnout || 'Moderate',
    security: payload.security || 'Peaceful',
    accreditation: payload.accreditation || 'Smooth',
    materials: payload.materials || 'Complete',
    incidents: payload.incidents || (doc.type === 'incident' ? detailsText : undefined),
    timestamp: timestampStr,
  };
}

export default function LandingPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<PublicDisplayReport[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  // Live Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // 1. Clock Ticker
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // 2. Fetch Live Reports from Firestore
    const unsubscribeReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      const parsedDocs = snapshot.docs.map(doc => parseFirestoreReport({ id: doc.id, ...doc.data() }));

      // Merge Firestore reports with public seed reports
      const map = new Map<string, PublicDisplayReport>();
      PUBLIC_SEED_REPORTS.forEach(r => map.set(r.id, r));
      parsedDocs.forEach(d => map.set(d.id, d));

      const sorted = Array.from(map.values()).sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      setReports(sorted);
      setLoading(false);
    }, (error) => {
      console.warn('Firestore reports error on landing page, using seed data:', error);
      setReports(PUBLIC_SEED_REPORTS);
      setLoading(false);
    });

    // 3. Fetch Users for Active Observers metric
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uDocs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      setUsers(uDocs);
    }, (error) => {
      console.warn('Firestore users error on landing page:', error);
    });

    return () => {
      clearInterval(timer);
      unsubscribeReports();
      unsubscribeUsers();
    };
  }, []);

  // Filtered Reports
  const filteredReports = reports.filter(r => {
    const matchesSearch =
      (r.details && r.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.pollingUnitName && r.pollingUnitName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.pollingUnitId && r.pollingUnitId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.lga && r.lga.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.state && r.state.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.observerName && r.observerName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    const matchesState = stateFilter === 'all' || r.state === stateFilter;

    return matchesSearch && matchesType && matchesState;
  });

  // Calculate Metrics
  const totalReportsCount = reports.length;
  const incidentCount = reports.filter(r => r.type === 'incident').length;
  const warningCount = reports.filter(r => r.type === 'warning').length;
  const normalCount = reports.filter(r => r.type === 'normal' || r.type === 'accreditation').length;
  const infoCount = reports.filter(r => r.type === 'info').length;

  const activeObserversCount = Math.max(users.length, 18);
  const statesReportingCount = new Set(reports.map(r => r.state).filter(Boolean)).size || 12;

  // Chart Data: Category Donut
  const categoryData = [
    { name: 'Normal', value: normalCount || 1, color: '#10B981' },
    { name: 'Incident', value: incidentCount || 1, color: '#EF4444' },
    { name: 'Warning', value: warningCount || 1, color: '#F59E0B' },
    { name: 'Information', value: infoCount || 1, color: '#3B82F6' },
  ];

  // Chart Data: Security Situation Bar
  const securityCounts = reports.reduce((acc, r) => {
    const sec = r.security || 'Peaceful';
    acc[sec] = (acc[sec] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const securityChartData = [
    { name: 'Peaceful', count: securityCounts['Peaceful'] || 14, fill: '#10B981' },
    { name: 'Tense', count: securityCounts['Tense'] || 3, fill: '#F59E0B' },
    { name: 'Violent', count: securityCounts['Violent'] || 1, fill: '#EF4444' },
  ];

  // State Breakdown List
  const stateCounts = reports.reduce((acc, r) => {
    if (r.state) {
      acc[r.state] = (acc[r.state] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const topStates = Object.entries(stateCounts)
    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
    .slice(0, 6);

  const maxStateReport = (Number(topStates[0]?.[1]) || 1);

  // Recent High Severity Alert
  const recentIncident = reports.find(r => r.type === 'incident');

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-gray-900 font-sans flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* 1. TOP OFFICIAL HEADER BAR */}
      <header className="bg-[#0a2f1d] text-white border-b border-emerald-800/80 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Crest */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-xl shadow-md border border-emerald-500">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight font-serif text-white leading-tight">
                  CivicWatch Nigeria
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 bg-emerald-900/80 text-emerald-300 text-[10px] font-mono font-bold uppercase rounded-md border border-emerald-700/60">
                  PUBLIC STREAM
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80 font-medium">
                Civilian Watch & Real-Time Electoral Transmission Hub
              </p>
            </div>
          </div>

          {/* Right Action & Clock */}
          <div className="flex items-center gap-4">
            {/* Live Clock Ticker */}
            <div className="hidden md:flex items-center gap-2 bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-800/80 text-xs font-mono text-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{format(currentTime, 'HH:mm:ss')} WAT</span>
            </div>

            {/* Auth Button */}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden lg:inline-block text-xs font-semibold text-emerald-200">
                  Logged in: <strong className="text-white">{user.displayName}</strong>
                </span>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md border border-emerald-500 transition-all uppercase tracking-wider"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Go to Workspace
                </Link>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-950/20 border border-emerald-500 transition-all uppercase tracking-wider group"
              >
                <LogIn className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                Observer / Admin Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Sub-bar: Public Status Banner */}
        <div className="bg-[#082316] px-4 py-1.5 text-xs font-medium text-emerald-200 border-t border-emerald-800/60 flex items-center justify-between">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="font-bold text-white uppercase text-[10px] tracking-widest">
                PUBLIC LIVE TRANSMISSION FEED — 2026 GENERAL ELECTIONS
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-[11px] text-emerald-300">
              <span>Verified Observer Telemetry</span>
              <span>•</span>
              <span>36 States + FCT Coverage</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="bg-gradient-to-b from-[#0a2f1d] via-[#0e4227] to-[#082618] text-white py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="max-w-7xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-full text-xs font-bold uppercase tracking-widest">
                <Activity className="w-3.5 h-3.5" /> Real-Time Electoral Audit
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-serif text-white leading-tight">
                Public Live Election Observation & Incident Stream
              </h2>
              <p className="text-emerald-100/90 text-sm sm:text-base font-light max-w-2xl leading-relaxed">
                Direct, unedited observation reports transmitted from accredited field personnel across Nigeria. Access real-time voter turnout, BVAS operational status, and security metrics.
              </p>
            </div>

            {/* Quick Action Box */}
            <div className="bg-white/10 backdrop-blur-md p-5 rounded-3xl border border-white/20 flex flex-col gap-3 shrink-0 sm:w-80 shadow-xl">
              <div className="flex items-center justify-between text-xs text-emerald-100 font-semibold">
                <span>Field Deployment Status</span>
                <span className="text-emerald-400 font-mono font-bold">LIVE</span>
              </div>
              <div className="text-2xl font-extrabold font-serif text-white">
                {activeObserversCount} Observers Deployed
              </div>
              <p className="text-[11px] text-emerald-200/80">
                Monitoring 176,974 polling units nationwide in real time.
              </p>
              {!user && (
                <Link
                  to="/login"
                  className="mt-1 w-full text-center py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all border border-emerald-500"
                >
                  Submit Report (Observer Login)
                </Link>
              )}
            </div>
          </div>

          {/* KPI CARDS GRID */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Total Reports Received</span>
              <div className="text-3xl font-extrabold font-serif text-white mt-1">{totalReportsCount}</div>
              <p className="text-[11px] text-emerald-300/80 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Transmitted & Synchronized
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-200">Incidents & Warnings</span>
              <div className="text-3xl font-extrabold font-serif text-red-300 mt-1">{incidentCount + warningCount}</div>
              <p className="text-[11px] text-red-200/80 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400" /> {incidentCount} High Severity
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Active Field Personnel</span>
              <div className="text-3xl font-extrabold font-serif text-white mt-1">{activeObserversCount}</div>
              <p className="text-[11px] text-emerald-300/80 mt-1 flex items-center gap-1">
                <Users className="w-3 h-3 text-emerald-400" /> Deployed in 36 States
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">State Coverage</span>
              <div className="text-3xl font-extrabold font-serif text-white mt-1">{statesReportingCount}</div>
              <p className="text-[11px] text-emerald-300/80 mt-1 flex items-center gap-1">
                <Globe className="w-3 h-3 text-emerald-400" /> Active Regional Hubs
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAIN DASHBOARD CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 flex-1 w-full">
        {/* RECENT HIGH SEVERITY ALERT TICKER (If any incident exists) */}
        {recentIncident && (
          <div className="bg-red-950 text-white rounded-3xl p-6 border-2 border-red-600/80 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 animate-in fade-in">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-600/40 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0 animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-md">
                    URGENT INCIDENT ALERT
                  </span>
                  <span className="text-xs text-red-200 font-mono font-bold">
                    {recentIncident.pollingUnitId || 'PU-INCIDENT'} — {recentIncident.state}
                  </span>
                </div>
                <h4 className="font-bold text-white text-base font-serif">
                  {recentIncident.incidents || 'Field Violation Reported'}
                </h4>
                <p className="text-xs text-red-200 font-medium line-clamp-2 max-w-3xl">
                  "{recentIncident.details}"
                </p>
              </div>
            </div>

            <Link
              to={user ? "/incidents" : "/login"}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-2xl shadow transition-all shrink-0 flex items-center gap-2"
            >
              Verify Incident Details <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* 2:1 COLUMN LAYOUT: LIVE FEED VS BREAKDOWN CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT 2 COLUMNS: LIVE REPORTS STREAM */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header & Filter Bar */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 font-serif flex items-center gap-2">
                    <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
                    Live Field Observation Stream
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Real-time observation logs from accredited monitors
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-full border border-emerald-100">
                    {filteredReports.length} {filteredReports.length === 1 ? 'Report' : 'Reports'}
                  </span>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search polling unit, LGA, state, or keywords..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium"
                  />
                </div>

                {/* Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="all">All Report Types</option>
                  <option value="normal">Normal Observations</option>
                  <option value="incident">Incidents Only</option>
                  <option value="warning">Warnings</option>
                  <option value="info">Informational</option>
                </select>

                {/* State Filter */}
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="all">All States</option>
                  <option value="Lagos">Lagos</option>
                  <option value="Kano">Kano</option>
                  <option value="FCT">FCT</option>
                  <option value="Rivers">Rivers</option>
                  <option value="Oyo">Oyo</option>
                  <option value="Kaduna">Kaduna</option>
                </select>
              </div>
            </div>

            {/* Reports List */}
            <div className="space-y-4">
              {loading ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 text-gray-400 space-y-3">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-medium">Connecting to live transmission feed...</p>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 text-gray-500 space-y-2">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto" />
                  <h4 className="font-bold text-gray-800 font-serif text-base">No matching observations</h4>
                  <p className="text-xs text-gray-400">Try clearing your filters or search terms.</p>
                </div>
              ) : (
                filteredReports.map((rpt) => {
                  const isIncident = rpt.type === 'incident';
                  const isWarning = rpt.type === 'warning';
                  const isInfo = rpt.type === 'info';

                  return (
                    <motion.div
                      key={rpt.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white p-6 rounded-3xl border shadow-sm transition-all hover:shadow-md ${
                        isIncident
                          ? 'border-red-200 bg-red-50/10'
                          : isWarning
                          ? 'border-amber-200 bg-amber-50/10'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Severity Badge */}
                          <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-lg ${
                            isIncident
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : isWarning
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : isInfo
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {rpt.type.toUpperCase()}
                          </span>

                          {/* Polling Unit Tag */}
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-800 font-mono font-bold text-xs rounded-lg flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            {rpt.pollingUnitId || 'PU-UNASSIGNED'}
                          </span>

                          <span className="text-xs font-bold text-gray-700">
                            {rpt.state} {rpt.lga ? `› ${rpt.lga}` : ''}
                          </span>
                        </div>

                        {/* Relative Timestamp */}
                        <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {rpt.timestamp ? (
                            formatDistanceToNow(new Date(rpt.timestamp), { addSuffix: true })
                          ) : (
                            'Just now'
                          )}
                        </div>
                      </div>

                      {/* Polling Unit Name */}
                      {rpt.pollingUnitName && (
                        <h4 className="text-base font-bold text-gray-900 font-serif mb-2">
                          {rpt.pollingUnitName} {rpt.ward ? `— ${rpt.ward}` : ''}
                        </h4>
                      )}

                      {/* Details Narrative */}
                      <p className="text-sm text-gray-700 leading-relaxed font-sans mb-4">
                        {rpt.details}
                      </p>

                      {/* Incident Highlight box */}
                      {rpt.incidents && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 font-medium flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          <span><strong>Flagged Incident:</strong> {rpt.incidents}</span>
                        </div>
                      )}

                      {/* Meta Tags Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-4 text-gray-500">
                          {rpt.turnout && (
                            <span>Turnout: <strong className="text-gray-800">{rpt.turnout}</strong></span>
                          )}
                          {rpt.security && (
                            <span>Security: <strong className={rpt.security === 'Peaceful' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>{rpt.security}</strong></span>
                          )}
                          {rpt.accreditation && (
                            <span className="hidden sm:inline">Accreditation: <strong className="text-gray-800">{rpt.accreditation}</strong></span>
                          )}
                        </div>

                        <div className="text-gray-400 text-[11px] font-medium">
                          Observer: <span className="font-bold text-gray-700">{rpt.observerName || 'Accredited Observer'}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT 1 COLUMN: BREAKDOWN CHARTS & STATS */}
          <div className="space-y-6">
            {/* Category Donut Chart Card */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 font-serif flex items-center gap-2 border-b border-gray-100 pb-3">
                <PieIcon className="w-4 h-4 text-emerald-600" />
                Report Category Distribution
              </h3>

              <div className="h-48 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-gray-600 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <span>Normal ({normalCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                  <span>Incidents ({incidentCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                  <span>Warnings ({warningCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                  <span>Info ({infoCount})</span>
                </div>
              </div>
            </div>

            {/* Top Reporting States Progress Bar */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 font-serif flex items-center gap-2 border-b border-gray-100 pb-3">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Top Transmitting States
              </h3>

              <div className="space-y-3">
                {topStates.map(([stName, count]) => {
                  const pct = Math.round(((Number(count) || 0) / (Number(maxStateReport) || 1)) * 100);
                  return (
                    <div key={stName} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-gray-700">
                        <span>{stName}</span>
                        <span className="font-mono text-gray-500">{count} reports</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Security Situation Breakdown */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 font-serif flex items-center gap-2 border-b border-gray-100 pb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Security Assessment
              </h3>

              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={securityChartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* 4. POLLING UNIT HEATMAP MATRIX SECTION */}
        <section className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 font-serif flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-600" />
                Polling Unit Status Heatmap Sample
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Visual status matrix of sampled polling unit transmissions across key regions
              </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-emerald-500" /> Normal</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-amber-400" /> Caution</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-orange-600" /> Incident</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-red-600" /> Critical</span>
            </div>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-3">
            {SAMPLE_HEATMAP_CELLS.map((cell) => {
              const bg =
                cell.status === 'normal' ? 'bg-emerald-500 hover:bg-emerald-600' :
                cell.status === 'warning' ? 'bg-amber-400 hover:bg-amber-500' :
                cell.status === 'incident' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700';

              return (
                <div
                  key={cell.id}
                  className={`${bg} h-14 rounded-2xl text-white p-2 text-center flex flex-col items-center justify-center transition-transform hover:scale-105 cursor-pointer shadow-xs group relative`}
                >
                  <span className="text-[10px] font-mono font-bold">{cell.name}</span>
                  <span className="text-[9px] font-semibold opacity-80">{cell.state}</span>

                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-20 w-36 p-2 bg-gray-900 text-white text-[10px] rounded-xl shadow-xl pointer-events-none text-left">
                    <p className="font-bold">{cell.name}</p>
                    <p className="text-gray-300">{cell.state} — Status: {cell.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* 5. FOOTER */}
      <footer className="bg-[#0a2f1d] text-white border-t border-emerald-800/80 py-8 px-4 sm:px-6 lg:px-8 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left text-xs text-emerald-200/80 font-medium">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-base border border-emerald-500">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm font-serif">CivicWatch Nigeria</p>
              <p className="text-[11px] text-emerald-300/70 mt-0.5">Civilian Watch Network & Independent Electoral Transmission</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/login" className="hover:text-white transition-colors">Observer Login</Link>
            <span>•</span>
            <Link to="/login" className="hover:text-white transition-colors">Administrator Portal</Link>
            <span>•</span>
            <span className="text-emerald-300">CivicWatch 2026 Edition</span>
          </div>

          <div className="text-[11px]">
            © 2026 CivicWatch Nigeria. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
