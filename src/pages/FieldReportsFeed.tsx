import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, Info, Radio, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Report, User } from '../types';
import { useAuth } from '../context/AuthContext';

type FeedType = 'normal' | 'incident' | 'warning' | 'info';

interface FeedReport {
  id: string;
  type: FeedType;
  pollingUnit: string;
  ward: string;
  message: string;
  state: string;
  lga: string;
  observer: string;
  time: string;
  isLive?: boolean;
}

const states = ['Lagos', 'Kano', 'Abuja (FCT)', 'Rivers', 'Kaduna', 'Oyo', 'Anambra'];

const demoReports: FeedReport[] = [
  {
    id: 'demo-001',
    type: 'normal',
    pollingUnit: 'GRA PU',
    ward: 'Ikeja Ward I',
    message: 'Voting commenced peacefully. Materials available. Queues orderly.',
    state: 'Lagos',
    lga: 'Ikeja',
    observer: 'OBS-0012 / Emeka Obi',
    time: '08:42',
  },
  {
    id: 'demo-002',
    type: 'incident',
    pollingUnit: 'Emir Palace PU',
    ward: 'Gwale Ward',
    message: 'Ballot box observed without tamper-evident seal. Reported to presiding officer.',
    state: 'Kano',
    lga: 'Kano Municipal',
    observer: 'OBS-0031 / Halima Sule',
    time: '09:15',
  },
  {
    id: 'demo-003',
    type: 'info',
    pollingUnit: 'Wuse Zone 4 PU',
    ward: 'Wuse Ward',
    message: 'Materials in order. INEC staff present. Accreditation ongoing smoothly.',
    state: 'Abuja (FCT)',
    lga: 'Abuja Municipal',
    observer: 'OBS-0007 / Chidi Nwosu',
    time: '09:28',
  },
  {
    id: 'demo-004',
    type: 'warning',
    pollingUnit: 'Government House PU',
    ward: 'D-Line Ward',
    message: 'Large crowd gathered outside exclusion zone. Police present but outnumbered.',
    state: 'Rivers',
    lga: 'Port Harcourt',
    observer: 'OBS-0055 / Blessing Tamuno',
    time: '09:44',
  },
  {
    id: 'demo-005',
    type: 'info',
    pollingUnit: 'Lekki PU 1',
    ward: 'Lekki Ward A',
    message: 'Polling unit opened 45 minutes late due to BVAS malfunction. Now operational.',
    state: 'Lagos',
    lga: 'Eti-Osa',
    observer: 'OBS-0019 / Tobi Adeyemi',
    time: '10:01',
  },
  {
    id: 'demo-006',
    type: 'normal',
    pollingUnit: 'City Hall PU',
    ward: 'Shaba Ward',
    message: 'Smooth accreditation process. About 200 voters processed so far.',
    state: 'Kaduna',
    lga: 'Kaduna North',
    observer: 'OBS-0044 / Fatima Garba',
    time: '10:12',
  },
  {
    id: 'demo-007',
    type: 'incident',
    pollingUnit: 'Main Market PU',
    ward: 'Inland Town Ward',
    message: 'Unknown individuals attempted to disrupt voting. Security forces intervened. Voting resumed.',
    state: 'Anambra',
    lga: 'Onitsha North',
    observer: 'OBS-0066 / Chioma Ezeh',
    time: '10:33',
  },
  {
    id: 'demo-008',
    type: 'warning',
    pollingUnit: 'Nassarawa PU 1',
    ward: 'Nassarawa Ward A',
    message: 'Result sheet seen being photographed by unofficial person. Presiding officer notified.',
    state: 'Kano',
    lga: 'Nassarawa',
    observer: 'OBS-0038 / Aisha Mohammed',
    time: '11:02',
  },
  ...Array.from({ length: 18 }).map((_, index) => {
    const messages = [
      'Security forces visible and maintaining order.',
      'Voting continues smoothly. No irregularities observed.',
      'Long queue forming. Voters patient and orderly.',
      'BVAS functioning properly. Accreditation on track.',
      'Party agents present from all major parties.',
    ];
    const typeCycle: FeedType[] = ['normal', 'normal', 'warning', 'info'];
    const minute = 10 - index;

    return {
      id: `demo-auto-${index}`,
      type: typeCycle[index % typeCycle.length],
      pollingUnit: 'Auto PU',
      ward: 'Auto Ward',
      message: messages[index % messages.length],
      state: states[index % states.length],
      lga: 'Central',
      observer: 'System Monitor',
      time: `21:${String(Math.max(0, minute)).padStart(2, '0')}`,
    };
  }),
];

const stateAliases: Record<string, string> = {
  LAG: 'Lagos',
  LOS: 'Lagos',
  KAN: 'Kano',
  ABJ: 'Abuja (FCT)',
  FCT: 'Abuja (FCT)',
  RIV: 'Rivers',
  KAD: 'Kaduna',
  OYO: 'Oyo',
  ANA: 'Anambra',
};

function timestampLabel(value: unknown) {
  if (!value) return 'Now';
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return format((value as { toDate: () => Date }).toDate(), 'HH:mm');
  }

  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? 'Now' : format(date, 'HH:mm');
}

function getReportMessage(report: Report) {
  if (typeof report.payload === 'string') return report.payload;
  return report.payload?.description || 'No field note provided.';
}

function getReportState(report: Report) {
  const payloadState = typeof report.payload === 'object' ? report.payload?.state : undefined;
  if (payloadState) return payloadState;

  const match = report.pollingUnitId.toUpperCase().split(/[-_\s]/).find(part => stateAliases[part]);
  return match ? stateAliases[match] : 'Unknown';
}

function getReportWard(report: Report) {
  if (typeof report.payload === 'object' && report.payload?.ward) return report.payload.ward;
  return report.pollingUnitId.includes('-') ? report.pollingUnitId.split('-').slice(-1)[0] : 'Field Ward';
}

function getReportLga(report: Report) {
  if (typeof report.payload === 'object' && report.payload?.lga) return report.payload.lga;
  return 'Central';
}

function getFeedType(report: Report): FeedType {
  if (report.type === 'incident') return 'incident';
  const description = getReportMessage(report).toLowerCase();
  const severity = typeof report.payload === 'object' ? report.payload?.severity : undefined;

  if (severity === 'high' || severity === 'critical') return 'warning';
  if (description.includes('delay') || description.includes('queue') || description.includes('malfunction')) return 'warning';
  if (report.type === 'result') return 'info';
  return 'normal';
}

function toFeedReport(report: Report, users: Record<string, User>): FeedReport {
  const observer = users[report.observerId];

  return {
    id: report.id,
    type: getFeedType(report),
    pollingUnit: report.pollingUnitId || 'Unknown PU',
    ward: getReportWard(report),
    message: getReportMessage(report),
    state: getReportState(report),
    lga: getReportLga(report),
    observer: observer ? `${observer.displayName}` : report.observerId || 'Unknown Observer',
    time: timestampLabel(report.timestamp),
    isLive: true,
  };
}

function badgeClasses(type: FeedType) {
  switch (type) {
    case 'incident':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'warning':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'info':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
}

function badgeIcon(type: FeedType) {
  switch (type) {
    case 'incident':
      return <ShieldAlert className="w-3.5 h-3.5" />;
    case 'warning':
      return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'info':
      return <Info className="w-3.5 h-3.5" />;
    default:
      return <CheckCircle2 className="w-3.5 h-3.5" />;
  }
}

export default function FieldReportsFeed() {
  const { isAdmin, isSupervisor } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  useEffect(() => {
    const reportsQuery = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.reduce((acc, userDoc) => {
        acc[userDoc.id] = { uid: userDoc.id, ...userDoc.data() } as User;
        return acc;
      }, {} as Record<string, User>));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeReports();
      unsubscribeUsers();
    };
  }, []);

  const feedReports = useMemo(() => {
    const source = reports.length > 0 ? reports.map(report => toFeedReport(report, users)) : demoReports;
    return source.filter(report => {
      const matchesType = !typeFilter || report.type === typeFilter;
      const matchesState = !stateFilter || report.state === stateFilter;
      return matchesType && matchesState;
    });
  }, [reports, stateFilter, typeFilter, users]);

  if (!isAdmin && !isSupervisor) {
    return <div className="p-20 text-center">Unauthorized Access</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">All Field Reports</h1>
          </div>
          <p className="text-gray-500 mt-2 font-medium">
            Live field report stream with quick filtering by report class and state.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="px-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm outline-none font-bold text-gray-600"
          >
            <option value="">All types</option>
            <option value="normal">Normal</option>
            <option value="incident">Incident</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          <select
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value)}
            className="px-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm outline-none font-bold text-gray-600"
          >
            <option value="">All states</option>
            {states.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4 bg-gray-50/40">
          <div className="flex items-center gap-2 text-xs font-black text-gray-500 uppercase tracking-widest">
            <Radio className="w-4 h-4 text-emerald-600" />
            {reports.length > 0 ? 'Live Reports' : 'Demo Feed'}
          </div>
          <span className="text-xs font-bold text-gray-400">{feedReports.length} visible</span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-gray-400 font-medium">Syncing field reports...</div>
        ) : feedReports.length === 0 ? (
          <div className="p-16 text-center text-gray-400 font-medium">No reports match the selected filters.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            <AnimatePresence>
              {feedReports.map(report => (
                <motion.div
                  key={report.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-5 md:p-6 hover:bg-gray-50/80 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    <span className={`h-fit w-fit shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${badgeClasses(report.type)}`}>
                      {badgeIcon(report.type)}
                      {report.type}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                        <h2 className="font-bold text-gray-900 text-lg tracking-tight">
                          {report.pollingUnit} — {report.ward}
                        </h2>
                        {report.isLive && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-widest w-fit">
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mt-2 leading-relaxed font-medium">
                        {report.message}
                      </p>
                      <div className="mt-3 text-xs text-gray-400 font-medium flex flex-wrap gap-x-2 gap-y-1">
                        <span>{report.state} &rsaquo; {report.lga}</span>
                        <span>&middot;</span>
                        <b className="text-gray-600">{report.observer}</b>
                        <span>&middot;</span>
                        <span>{report.time}</span>
                      </div>
                    </div>
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
