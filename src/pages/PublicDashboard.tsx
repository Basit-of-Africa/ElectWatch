import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Radio, ShieldAlert, Vote } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { Incident } from '../types';

const pollingUnitHeatmap = [
  { title: 'Critical - violent disruption', color: 'rgb(185, 28, 28)' },
  { title: 'Incident reported', color: 'rgb(217, 119, 6)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Caution', color: 'rgb(230, 184, 0)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Overcrowding', color: 'rgb(230, 184, 0)' },
  { title: 'Ballot irregularity', color: 'rgb(217, 119, 6)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Delayed opening', color: 'rgb(230, 184, 0)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Intimidation', color: 'rgb(217, 119, 6)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Equipment issue', color: 'rgb(230, 184, 0)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
  { title: 'Normal', color: 'rgb(22, 163, 74)' },
];

const heatmapLegend = [
  { label: 'Normal', color: 'rgb(22, 163, 74)' },
  { label: 'Caution', color: 'rgb(230, 184, 0)' },
  { label: 'Incident', color: 'rgb(217, 119, 6)' },
  { label: 'Critical', color: 'rgb(185, 28, 28)' },
];

export default function PublicDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: undefined | (() => void);
    let cancelled = false;

    const connect = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        if (cancelled) return;

        const q = query(collection(db, 'incidents'), orderBy('timestamp', 'desc'), limit(20));
        unsubscribe = onSnapshot(q, (snapshot) => {
          setIncidents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Incident)));
          setLoading(false);
        }, () => {
          setLoading(false);
        });
      } catch (error) {
        console.error('Public dashboard connection failed:', error);
        setLoading(false);
      }
    };

    connect();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const stats = useMemo(() => {
    const open = incidents.filter((incident) => incident.status !== 'resolved').length;
    const critical = incidents.filter((incident) => incident.severity === 'critical').length;
    const resolved = incidents.filter((incident) => incident.status === 'resolved').length;

    return [
      { label: 'Tracked Incidents', value: incidents.length, icon: ShieldAlert, color: 'text-red-600 bg-red-50' },
      { label: 'Open Cases', value: open, icon: Clock, color: 'text-amber-600 bg-amber-50' },
      { label: 'Critical Alerts', value: critical, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' },
      { label: 'Resolved', value: resolved, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    ];
  }, [incidents]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Vote className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-none">CivicWatch</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Public Live Dashboard</p>
            </div>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
          >
            Staff Login
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 md:py-14 space-y-10">
        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-stretch">
          <div className="bg-emerald-950 text-white rounded-[40px] p-8 md:p-12 relative overflow-hidden min-h-[340px] flex flex-col justify-between">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl border border-white/10 text-xs font-bold uppercase tracking-widest text-emerald-200">
                <Radio className="w-4 h-4 text-emerald-400" />
                Live public signal
              </div>
              <h1 className="mt-8 text-4xl md:text-6xl font-bold font-serif tracking-tight">
                Election field status, visible to everyone.
              </h1>
              <p className="mt-5 text-emerald-100/80 text-lg max-w-2xl leading-relaxed">
                Public monitoring view for incident volume, open cases, and recent field alerts.
              </p>
            </div>

            <div className="relative z-10 mt-10 flex items-center gap-3 text-sm text-emerald-100/70">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
              {loading ? 'Connecting to live stream...' : 'Live stream active'}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <p className="text-4xl font-bold text-gray-900 mt-8 tabular-nums">{stat.value}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mb-4">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 opacity-75" />
            Polling Unit Status Heatmap
          </div>
          <div className="bg-white border border-black/10 rounded-xl p-4">
            <div className="grid grid-cols-8 md:grid-cols-12 gap-1">
              {pollingUnitHeatmap.map((unit, index) => (
                <div
                  key={`${unit.title}-${index}`}
                  title={unit.title}
                  className="aspect-square rounded-sm cursor-pointer transition-transform hover:scale-125 hover:z-10"
                  style={{ backgroundColor: unit.color }}
                />
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
              {heatmapLegend.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 font-serif">Recent Public Incident Feed</h2>
              <p className="text-gray-500 mt-1 text-sm">Showing latest verified incident records available to the public view.</p>
            </div>
          </div>

          {loading ? (
            <div className="p-16 text-center text-gray-400 font-medium">Loading live dashboard...</div>
          ) : incidents.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
              <CheckCircle2 className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p className="font-bold text-gray-600">No public incidents in the current stream</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {incidents.slice(0, 8).map((incident) => (
                <div key={incident.id} className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-gray-50 transition-colors">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        incident.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        incident.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        incident.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {incident.severity}
                      </span>
                      <span className="text-xs font-mono text-gray-400">PU #{incident.pollingUnitId}</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 max-w-3xl">{incident.description}</p>
                  </div>
                  <div className="flex md:flex-col gap-2 md:items-end text-sm text-gray-400 font-medium shrink-0">
                    <span className="capitalize text-gray-600 font-bold">{incident.status}</span>
                    <span>
                      {(incident.timestamp as any)?.toDate
                        ? formatDistanceToNow((incident.timestamp as any).toDate(), { addSuffix: true })
                        : 'Just now'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
