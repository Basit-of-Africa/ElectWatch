import React, { useState, useEffect } from 'react';
import PageHeader from '../components/common/PageHeader';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Notification } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, 
  Megaphone, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Check, 
  Radio,
  Filter,
  Search,
  Sparkles,
  Info
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import DirectiveBroadcastModal from '../components/DirectiveBroadcastModal';
import EmptyState from '../components/common/EmptyState';

export default function Notifications() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'directive' | 'urgent' | 'system'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [isEmergencyBroadcast, setIsEmergencyBroadcast] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(docs);
    });

    return () => unsubscribe();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      toast.success('Notification marked as read');
    } catch (err: any) {
      toast.error('Failed to update notification: ' + err.message);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'directive') return n.type === 'urgent_directive' || n.category === 'directive';
    if (filterType === 'urgent') return n.priority === 'critical' || n.priority === 'urgent' || n.type === 'error';
    if (filterType === 'system') return n.category === 'system' || n.type === 'info' || n.type === 'admin_update';

    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications & Directives Hub"
        subtitle="Operational commands from Situation Room HQ, observer incident alerts, and statutory advisory memos."
        breadcrumbs={[
          { label: 'Notifications' }
        ]}
        badge={
          unreadCount > 0 ? (
            <span className="px-3 py-1 bg-red-100 text-red-800 border border-red-200 rounded-full text-xs font-bold uppercase tracking-wider">
              {unreadCount} Unread Alerts
            </span>
          ) : (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider">
              All Caught Up
            </span>
          )
        }
        actions={
          (isAdmin || isSupervisor) ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEmergencyBroadcast(true);
                  setShowBroadcastModal(true);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <ShieldAlert className="w-4 h-4 text-red-200" />
                <span>Declare Emergency SOS</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEmergencyBroadcast(false);
                  setShowBroadcastModal(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Radio className="w-4 h-4 text-emerald-200" />
                <span>Broadcast Directive</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search notifications, directives, or memos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'directive', 'urgent', 'system'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterType(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                filterType === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {f === 'all' ? 'All Alerts' :
               f === 'directive' ? 'HQ Directives' :
               f === 'urgent' ? 'Urgent / SOS' : 'System'}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No Notifications in Current Stream"
            description="You have no notifications matching the selected criteria. New situational alerts will appear in real time."
          />
        ) : (
          filteredNotifications.map((notif) => {
            const isDirective = notif.type === 'urgent_directive' || notif.category === 'directive';
            const isCritical = notif.priority === 'critical' || notif.type === 'error';

            return (
              <div
                key={notif.id}
                className={`bg-white rounded-2xl border transition-all p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  !notif.read 
                    ? isCritical 
                      ? 'border-red-300 bg-red-50/30 shadow-xs' 
                      : 'border-emerald-300 bg-emerald-50/20 shadow-xs'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isCritical 
                      ? 'bg-red-100 text-red-700' 
                      : isDirective 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isCritical ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : isDirective ? (
                      <Megaphone className="w-5 h-5" />
                    ) : (
                      <Bell className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900 font-serif">
                        {notif.title}
                      </h3>
                      {isCritical && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
                          Critical Alert
                        </span>
                      )}
                      {isDirective && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                          Official Directive
                        </span>
                      )}
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                    </div>

                    <p className="text-xs text-gray-600 mt-1 leading-relaxed max-w-2xl">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>
                          {notif.timestamp?.toDate ? formatDistanceToNow(notif.timestamp.toDate(), { addSuffix: true }) : 'Just now'}
                        </span>
                      </span>
                      {notif.senderName && (
                        <span>From: <strong className="text-gray-600">{notif.senderName}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {!notif.read && (
                  <button
                    type="button"
                    onClick={() => handleMarkAsRead(notif.id)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all shrink-0 inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Acknowledge</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Directive Broadcast Modal */}
      <DirectiveBroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        defaultEmergencyMode={isEmergencyBroadcast}
      />
    </div>
  );
}
