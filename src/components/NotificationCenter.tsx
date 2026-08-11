import { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Notification as AppNotification, Incident } from '../types';
import { toast } from 'sonner';
import { 
  Bell, 
  X, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2,
  ShieldAlert,
  Zap,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  requestFcmNotificationPermission, 
  triggerSystemPushNotification, 
  registerFcmForegroundHandler 
} from '../lib/fcm';

export default function NotificationCenter() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    return 'Notification' in window && Notification.permission === 'granted';
  });

  // Register or request FCM push token on mount if user is logged in
  useEffect(() => {
    if (!user) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      requestFcmNotificationPermission(user.uid, user.role);
    }

    // Register foreground FCM message handler
    let unsubscribeFcm: (() => void) | undefined;
    registerFcmForegroundHandler((payload) => {
      const title = payload.notification?.title || payload.data?.title || '🚨 EMERGENCY SOS ALERT';
      const body = payload.notification?.body || payload.data?.body || 'High priority danger reported.';
      const link = payload.data?.link || '/incidents';
      triggerHighSeverityToast(title, body, undefined, link);
    }).then(unsub => {
      unsubscribeFcm = unsub;
    });

    return () => {
      if (unsubscribeFcm) unsubscribeFcm();
    };
  }, [user]);

  const handleEnablePush = async () => {
    if (!user) return;
    const res = await requestFcmNotificationPermission(user.uid, user.role);
    if (res.granted) {
      setPushEnabled(true);
      toast.success('Push Notifications Enabled!', {
        description: 'You will receive immediate system alerts when a Danger SOS is triggered.'
      });
    } else {
      toast.error('Notification Permission Denied', {
        description: 'Please allow notifications in your browser settings to receive SOS push alerts.'
      });
    }
  };

  // Track initial load to prevent toast spam for historical records
  const isInitialNotificationLoad = useRef(true);
  const isInitialIncidentLoad = useRef(true);
  const toastedNotificationIds = useRef<Set<string>>(new Set());
  const toastedIncidentIds = useRef<Set<string>>(new Set());

  // Function to trigger high-severity alert toast
  const triggerHighSeverityToast = (
    title: string,
    message: string,
    pollingUnitId?: string,
    link?: string
  ) => {
    // Play subtle audio chime for high-severity alert
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      // Audio context may be restricted before user interaction
    }

    toast.custom((t) => (
      <div className="w-full max-w-md bg-gradient-to-r from-red-950 via-red-900 to-gray-950 text-white rounded-3xl p-5 shadow-2xl border-2 border-red-500/80 backdrop-blur-md flex items-start gap-4 animate-in fade-in slide-in-from-top-5 duration-300">
        <div className="w-12 h-12 rounded-2xl bg-red-600/30 border border-red-400/40 flex items-center justify-center shrink-0 text-red-400 animate-pulse">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-md shadow-sm">
              🚨 HIGH SEVERITY ALERT
            </span>
            <button 
              onClick={() => toast.dismiss(t)} 
              className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <h4 className="font-bold text-white text-base leading-tight font-serif pt-1">
            {title}
          </h4>
          {pollingUnitId && (
            <p className="text-xs text-red-200 font-mono font-bold">
              Polling Unit: {pollingUnitId}
            </p>
          )}
          <p className="text-xs text-gray-300 font-medium line-clamp-2">
            {message}
          </p>
          {link && (
            <div className="pt-2">
              <Link
                to={link}
                onClick={() => toast.dismiss(t)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                Inspect Incident <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    ), {
      duration: 12000, // 12 second persistence for high severity
    });
  };

  // 1. Listen for Firestore Notifications targeted to Admin / Supervisor
  useEffect(() => {
    if (!user) return;

    const roles: string[] = [user.uid];
    if (isAdmin) roles.push('admin');
    if (isSupervisor) roles.push('supervisor');
    roles.push('observer');

    const q = query(
      collection(db, 'notifications'), 
      where('userId', 'in', roles),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(docs);
      setUnreadCount(docs.filter(n => !n.read).length);

      if (isInitialNotificationLoad.current) {
        // Populate toasted set on first load without triggering toasts
        docs.forEach(d => toastedNotificationIds.current.add(d.id));
        isInitialNotificationLoad.current = false;
        return;
      }

      // Handle newly added notification items in real-time
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const id = change.doc.id;
          const data = change.doc.data() as AppNotification;
          if (!toastedNotificationIds.current.has(id) && !data.read) {
            toastedNotificationIds.current.add(id);

            const isHighOrCritical = 
              data.type === 'error' || 
              data.type === 'warning' ||
              data.title?.toUpperCase().includes('CRITICAL') || 
              data.title?.toUpperCase().includes('HIGH');

            if (isHighOrCritical) {
              triggerHighSeverityToast(data.title, data.message, undefined, data.link);
              // Trigger system notification if tab is in background or active
              triggerSystemPushNotification({
                title: data.title,
                body: data.message,
                link: data.link || '/incidents',
                isSosAlert: true
              });
            } else {
              toast(data.title, {
                description: data.message,
                action: data.link ? {
                  label: 'View',
                  onClick: () => window.location.href = data.link!
                } : undefined,
              });
            }
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user, isAdmin, isSupervisor]);

  // 2. Listen directly for new High / Critical Severity Incidents in real-time
  useEffect(() => {
    if (!user) return;

    const incidentsQuery = query(
      collection(db, 'incidents'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(incidentsQuery, (snapshot) => {
      if (isInitialIncidentLoad.current) {
        snapshot.docs.forEach(d => toastedIncidentIds.current.add(d.id));
        isInitialIncidentLoad.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const id = change.doc.id;
          const incident = { id, ...change.doc.data() } as Incident;

          if (!toastedIncidentIds.current.has(id)) {
            toastedIncidentIds.current.add(id);

            if (incident.severity === 'high' || incident.severity === 'critical') {
              triggerHighSeverityToast(
                `${incident.severity.toUpperCase()} SEVERITY INCIDENT REPORTED`,
                incident.description,
                incident.pollingUnitId,
                `/incidents/${id}`
              );
              triggerSystemPushNotification({
                title: `🚨 ${incident.severity.toUpperCase()} SEVERITY INCIDENT: ${incident.pollingUnitId || 'PU-FIELD'}`,
                body: incident.description,
                link: `/incidents/${id}`,
                isSosAlert: true
              });
            }
          }
        }
      });
    }, (error) => {
      console.warn('Incidents live listener error in NotificationCenter:', error);
    });

    return () => unsubscribe();
  }, [isAdmin, isSupervisor]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const handleTestAlert = () => {
    triggerHighSeverityToast(
      'CRITICAL: Voter Suppression Allegation',
      'Multiple voters report intimidation at polling unit security perimeter.',
      'PU-LAG-014',
      '/incidents'
    );
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-2xl bg-gray-50 text-gray-400 hover:bg-gray-100 transition-all group"
        title="Alert Center & Real-Time Notifications"
      >
        <Bell className="w-5 h-5 group-hover:text-emerald-600 transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-4 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/5"
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-[380px] bg-white rounded-[32px] shadow-2xl border border-gray-100 z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 font-serif text-lg">Alert Center</h3>
                  <p className="text-[11px] text-gray-400 font-semibold">Real-time incident stream</p>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* FCM Push Notification Status Banner */}
              <div className="px-6 py-2 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${pushEnabled ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                  <span className="font-bold text-[11px]">
                    {pushEnabled ? 'Push Alerts Active' : 'Push Notifications Disabled'}
                  </span>
                </div>
                {!pushEnabled ? (
                  <button
                    onClick={handleEnablePush}
                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-lg transition-all shadow-xs"
                  >
                    Enable Push
                  </button>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">FCM Sync Ready</span>
                )}
              </div>

              {(isAdmin || isSupervisor) && (
                <div className="px-6 py-2.5 bg-red-50/50 border-b border-red-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-red-800 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-red-600" />
                    High Severity Real-Time Alerts Active
                  </span>
                  <button
                    onClick={handleTestAlert}
                    className="text-[10px] font-extrabold bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg transition-all shadow-xs"
                  >
                    Test Toast
                  </button>
                </div>
              )}

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">
                    <Bell className="w-10 h-10 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No recent alerts</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className={`p-6 transition-colors ${notification.read ? 'bg-white' : 'bg-emerald-50/30'}`}
                      >
                        <div className="flex gap-4">
                          <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${notification.read ? 'bg-gray-50' : 'bg-white shadow-sm'}`}>
                            {getIcon(notification.type)}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                              <p className={`text-sm font-bold leading-tight ${notification.read ? 'text-gray-900' : 'text-emerald-900'}`}>
                                {notification.title}
                              </p>
                              <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap ml-2">
                                {notification.timestamp instanceof Object ? formatDistanceToNow((notification.timestamp as any).toDate(), { addSuffix: true }) : 'Now'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed font-medium">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-3 pt-2">
                              {!notification.read && (
                                <button 
                                  onClick={() => markAsRead(notification.id)}
                                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline"
                                >
                                  Mark as Read
                                </button>
                              )}
                              {notification.link && (
                                <Link 
                                  to={notification.link}
                                  onClick={() => setIsOpen(false)}
                                  className="text-[10px] font-bold text-gray-400 hover:text-gray-900 transition-colors"
                                >
                                  View Details
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                <Link to="/incidents" onClick={() => setIsOpen(false)} className="text-xs font-bold text-gray-500 hover:text-gray-900">
                  View All System Logs & Incidents
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

