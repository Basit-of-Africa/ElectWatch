import { useState, useEffect, type FormEvent } from 'react';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Notification, NotificationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  Radio, 
  Send, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Users, 
  ShieldAlert, 
  Sparkles,
  Link as LinkIcon,
  MessageSquare,
  Clock,
  History
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { triggerSystemPushNotification } from '../lib/fcm';

interface DirectiveBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DirectiveTemplate {
  label: string;
  type: NotificationType;
  priority: 'normal' | 'urgent' | 'critical';
  title: string;
  message: string;
  link?: string;
}

const TEMPLATES: DirectiveTemplate[] = [
  {
    label: 'BVAS Device Restart',
    type: 'urgent_directive',
    priority: 'urgent',
    title: 'DIRECTIVE: BVAS Technical Restart & Recalibration Procedure',
    message: 'If the BVAS device experiences biometric verification timeouts, ensure the camera lens is wiped clean, restart the unit once, and proceed with facial verification as secondary protocol.',
    link: '/report'
  },
  {
    label: 'Accreditation Extension',
    type: 'admin_update',
    priority: 'urgent',
    title: 'OFFICIAL UPDATE: Accreditation Period Extended',
    message: 'All polling units experiencing morning logistics delays are granted an official accreditation extension. Ensure all voters in queue by official cut-off time are duly verified and permitted to vote.',
    link: '/report'
  },
  {
    label: 'Collation & EC8A Reminder',
    type: 'admin_update',
    priority: 'normal',
    title: 'DIRECTIVE: Form EC8A Photographic Verification Mandate',
    message: 'Observers must ensure Form EC8A is clearly photographed and uploaded immediately after sorting and counting of ballots before leaving the polling station.',
    link: '/report'
  },
  {
    label: 'Security & Safety Alert',
    type: 'warning',
    priority: 'critical',
    title: 'SECURITY ADVISORY: Heightened Vigilance at Perimeter',
    message: 'Reports of unauthorized party agents disrupting queues. Field observers are advised to remain within safe observation perimeters and immediately trigger the Danger SOS if threatened.',
    link: '/incidents'
  }
];

export default function DirectiveBroadcastModal({ isOpen, onClose }: DirectiveBroadcastModalProps) {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [activeTab, setActiveTab] = useState<'draft' | 'history'>('draft');

  // Form State
  const [directiveType, setDirectiveType] = useState<NotificationType>('urgent_directive');
  const [priority, setPriority] = useState<'normal' | 'urgent' | 'critical'>('urgent');
  const [targetRole, setTargetRole] = useState<'all' | 'observer' | 'field_supervisor'>('all');
  const [targetState, setTargetState] = useState<string>('All States');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionLink, setActionLink] = useState('/report');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History State
  const [recentDirectives, setRecentDirectives] = useState<Notification[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Real-time listener for broadcasted directives history
  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, 'notifications'),
      orderBy('timestamp', 'desc'),
      limit(25)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      // Filter to directives / administrative updates
      const directiveDocs = docs.filter(d => 
        d.type === 'urgent_directive' || 
        d.type === 'admin_update' || 
        d.category === 'directive' ||
        d.category === 'update' ||
        d.senderName
      );
      setRecentDirectives(directiveDocs);
      setLoadingHistory(false);
    }, (error) => {
      console.warn('Error fetching directives history:', error);
      setLoadingHistory(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const applyTemplate = (tpl: DirectiveTemplate) => {
    setDirectiveType(tpl.type);
    setPriority(tpl.priority);
    setTitle(tpl.title);
    setMessage(tpl.message);
    if (tpl.link) setActionLink(tpl.link);
  };

  const handleBroadcast = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !message.trim()) {
      toast.error('Please enter both a title and message for the directive');
      return;
    }

    setIsSubmitting(true);
    try {
      const senderRoleName = isAdmin ? 'Command Center Administrator' : 'Field Operations Supervisor';
      const senderDisplayName = user.displayName || user.email || 'HQ Command';

      const notificationPayload = {
        userId: targetRole, // 'all', 'observer', or 'field_supervisor'
        title: title.trim(),
        message: message.trim(),
        type: directiveType,
        category: directiveType === 'admin_update' ? 'update' : 'directive',
        priority: priority,
        senderName: senderDisplayName,
        senderRole: senderRoleName,
        targetRole: targetRole,
        targetState: targetState,
        read: false,
        link: actionLink.trim() || undefined,
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, 'notifications'), notificationPayload);

      // Trigger local browser push preview
      triggerSystemPushNotification({
        title: `📢 ${title.trim()}`,
        body: message.trim(),
        link: actionLink || '/dashboard',
        isSosAlert: priority === 'critical' || priority === 'urgent'
      });

      toast.success('Directive Dispatched Successfully!', {
        description: `Broadcasted to ${targetRole === 'all' ? 'All Field Personnel' : targetRole.toUpperCase()} in ${targetState}.`
      });

      // Reset fields
      setTitle('');
      setMessage('');
      setActiveTab('history');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notifications');
      toast.error('Failed to broadcast directive. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDirective = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success('Directive removed from broadcast stream.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `notifications/${id}`);
      toast.error('Failed to delete directive.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-3xl bg-white rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden my-auto"
      >
        {/* Modal Header */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-gray-900 via-slate-900 to-gray-900 text-white relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  HQ Broadcast System
                </span>
                <span className="text-xs text-gray-400 font-medium">Real-Time In-App Alerts</span>
              </div>
              <h2 className="text-2xl font-bold font-serif text-white mt-1">
                Dispatch Directive / Update
              </h2>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 sm:px-8 pt-4 border-b border-gray-100 bg-gray-50/50">
          <button
            onClick={() => setActiveTab('draft')}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === 'draft'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Send className="w-4 h-4" />
            Draft Broadcast
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <History className="w-4 h-4" />
            Broadcast Log ({recentDirectives.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto">
          {activeTab === 'draft' ? (
            <form onSubmit={handleBroadcast} className="space-y-6">
              {/* Quick Template Chips */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Quick Dispatch Templates
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TEMPLATES.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="text-left p-3 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-xs font-medium group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 group-hover:text-emerald-700">{tpl.label}</span>
                        <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded ${
                          tpl.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          tpl.priority === 'critical' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {tpl.priority}
                        </span>
                      </div>
                      <p className="text-gray-500 truncate mt-1">{tpl.title}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Directive Classification & Target Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Directive Type */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    Directive Type
                  </label>
                  <select
                    value={directiveType}
                    onChange={(e) => {
                      const val = e.target.value as NotificationType;
                      setDirectiveType(val);
                      if (val === 'urgent_directive') setPriority('urgent');
                      else if (val === 'warning') setPriority('critical');
                      else setPriority('normal');
                    }}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-semibold bg-white"
                  >
                    <option value="urgent_directive">🚨 Urgent Directive (High Alert)</option>
                    <option value="admin_update">📢 Administrative Memo</option>
                    <option value="warning">⚠️ Security Warning</option>
                    <option value="info">ℹ️ General Notice</option>
                  </select>
                </div>

                {/* Target Audience */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-gray-400" /> Recipients
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-semibold bg-white"
                  >
                    <option value="all">All Field Personnel (National)</option>
                    <option value="observer">Field Observers Only</option>
                    <option value="field_supervisor">Field Supervisors Only</option>
                  </select>
                </div>

                {/* Target State */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    Target State / Region
                  </label>
                  <select
                    value={targetState}
                    onChange={(e) => setTargetState(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-semibold bg-white"
                  >
                    <option value="All States">All States (National)</option>
                    <option value="Osun">Osun State</option>
                    <option value="Lagos">Lagos State</option>
                    <option value="Kano">Kano State</option>
                    <option value="Rivers">Rivers State</option>
                    <option value="FCT">Abuja (FCT)</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Directive Headline / Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. URGENT: Extended Accreditation Window until 4:00 PM"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold text-gray-900 bg-white placeholder:font-normal"
                />
              </div>

              {/* Directive Message Body */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                    Instructions / Message Content <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">{message.length}/1000</span>
                </label>
                <textarea
                  required
                  rows={4}
                  maxLength={1000}
                  placeholder="Provide precise instructions, step-by-step guidelines, or official administrative updates for observers..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium text-gray-800 bg-white resize-none leading-relaxed"
                />
              </div>

              {/* Action Link */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5 flex items-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5 text-gray-400" />
                  Action Destination Link (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={actionLink}
                    onChange={(e) => setActionLink(e.target.value)}
                    className="px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium bg-white"
                  >
                    <option value="/report">Submission Portal (/report)</option>
                    <option value="/incidents">Incident Management (/incidents)</option>
                    <option value="/map">Live Map (/map)</option>
                    <option value="/dashboard">Field Dashboard (/dashboard)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="or custom path like /reports"
                    value={actionLink}
                    onChange={(e) => setActionLink(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium bg-white"
                  >
                  </input>
                </div>
              </div>

              {/* Sender Details Preview */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                    HQ
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">Broadcasting as: {user?.displayName || user?.email}</p>
                    <p className="text-gray-500">{isAdmin ? 'Command Center Administrator' : 'Field Operations Supervisor'}</p>
                  </div>
                </div>
                <div className="text-right font-mono text-[10px] text-gray-400">
                  Target: {targetRole.toUpperCase()} ({targetState})
                </div>
              </div>

              {/* Submit / Dispatch Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-xl shadow-emerald-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Transmitting Directive...' : 'Transmit Broadcast to Observers'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Directives History Log */
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="py-12 text-center text-gray-400 font-medium">
                  Loading broadcasted directives log...
                </div>
              ) : recentDirectives.length === 0 ? (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  <Radio className="w-10 h-10 mx-auto opacity-30 text-emerald-600" />
                  <p className="font-bold text-gray-700">No Directives Broadcasted Yet</p>
                  <p className="text-xs text-gray-400">
                    Use the "Draft Broadcast" tab to transmit real-time instructions to observers.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentDirectives.map((d) => (
                    <div 
                      key={d.id}
                      className="p-5 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 transition-all shadow-xs flex flex-col sm:flex-row items-start justify-between gap-4"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md border ${
                            d.type === 'urgent_directive' ? 'bg-red-100 text-red-700 border-red-200' :
                            d.type === 'warning' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            'bg-blue-100 text-blue-700 border-blue-200'
                          }`}>
                            {d.type === 'urgent_directive' ? '🚨 Urgent Directive' : d.type === 'warning' ? '⚠️ Security Advisory' : '📢 Administrative Memo'}
                          </span>
                          
                          <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            Target: {d.targetRole ? d.targetRole.toUpperCase() : 'ALL'} ({d.targetState || 'National'})
                          </span>

                          <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1 ml-auto">
                            <Clock className="w-3 h-3" />
                            {d.timestamp instanceof Object ? formatDistanceToNow((d.timestamp as any).toDate(), { addSuffix: true }) : 'Recent'}
                          </span>
                        </div>

                        <h4 className="font-bold text-gray-900 text-base leading-snug">
                          {d.title}
                        </h4>

                        <p className="text-xs text-gray-600 leading-relaxed">
                          {d.message}
                        </p>

                        {d.senderName && (
                          <p className="text-[11px] text-emerald-700 font-semibold">
                            Dispatched by: {d.senderName} ({d.senderRole || 'HQ Command'})
                          </p>
                        )}
                      </div>

                      {/* Delete / Revoke Directive */}
                      <button
                        onClick={() => handleDeleteDirective(d.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0 cursor-pointer"
                        title="Delete / Revoke Directive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
