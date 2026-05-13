import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Notification } from '../types';
import { toast } from 'sonner';
import { 
  Bell, 
  X, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export default function NotificationCenter() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Build the query to get notifications targeted to user or their role
    const roles: string[] = [user.uid];
    if (isAdmin) roles.push('admin');
    if (isSupervisor) roles.push('supervisor');

    const q = query(
      collection(db, 'notifications'), 
      where('userId', 'in', roles),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(docs);
      setUnreadCount(docs.filter(n => !n.read).length);

      // Show toast for new unread notifications that haven't been toasted yet
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as Notification;
          if (!data.read) {
            toast(data.title, {
              description: data.message,
              action: data.link ? {
                label: 'View',
                onClick: () => window.location.href = data.link!
              } : undefined,
            });
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user, isAdmin, isSupervisor]);

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

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-2xl bg-gray-50 text-gray-400 hover:bg-gray-100 transition-all group"
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
                <h3 className="font-bold text-gray-900 font-serif text-lg">Alert Center</h3>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

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
                <button className="text-xs font-bold text-gray-500 hover:text-gray-900">View All System Logs</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
