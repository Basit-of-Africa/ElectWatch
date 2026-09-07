import React, { useState, useEffect } from 'react';
import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/AuthContext';
import { Link, Navigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  Activity, 
  FileSpreadsheet, 
  Radio, 
  Clock, 
  Database, 
  AlertTriangle, 
  FileText, 
  Lock, 
  HardDrive, 
  CheckCircle2, 
  ExternalLink,
  Download,
  KeyRound,
  Eye
} from 'lucide-react';
import AuditTrailModal from '../components/AuditTrailModal';
import DownloadReportsModal from '../components/DownloadReportsModal';
import DirectiveBroadcastModal from '../components/DirectiveBroadcastModal';
import RoleUpgradeModal from '../components/RoleUpgradeModal';
import PushNotificationPrompt from '../components/PushNotificationPrompt';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Report, AuditLogEntry } from '../types';
import { formatDistanceToNow } from 'date-fns';

export default function Administration() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedUserForUpgrade, setSelectedUserForUpgrade] = useState<User | null>(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      setUsers(list);
    });

    const unsubReports = onSnapshot(query(collection(db, 'reports'), limit(100)), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(list);
    });

    const unsubLogs = onSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(6)), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLogEntry));
      setRecentLogs(list);
    });

    return () => {
      unsubUsers();
      unsubReports();
      unsubLogs();
    };
  }, []);

  // Permission boundary check
  if (!isAdmin && !isSupervisor) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Administration Center"
          subtitle="Restricted to accredited system administrators and state supervisors."
          breadcrumbs={[{ label: 'Administration' }]}
        />
        <div className="bg-white rounded-3xl p-10 border border-gray-200 text-center max-w-lg mx-auto shadow-xs">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 font-serif mb-1">Access Restricted</h2>
          <p className="text-xs text-gray-500 leading-relaxed mb-6">
            Your current account role (Field Observer) does not have authorization to view administrative governance panels, audit logs, or role configurations.
          </p>
          <Link
            to="/dashboard"
            className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2"
          >
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const adminsCount = users.filter(u => u.role === 'admin').length;
  const supervisorsCount = users.filter(u => u.role === 'supervisor' || u.role === 'field_supervisor').length;
  const observersCount = users.filter(u => u.role === 'observer' || !u.role).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration & System Governance"
        subtitle="Operational controls, role permissions, audit trails, and statutory transmission logs for Situation Room HQ."
        breadcrumbs={[
          { label: 'Administration' }
        ]}
        badge={
          <span className="px-3 py-1 bg-purple-100 text-purple-800 border border-purple-200 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
            {isAdmin ? 'System Administrator' : 'Election Supervisor'}
          </span>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <PushNotificationPrompt compact />

            <button
              type="button"
              onClick={() => setShowBroadcastModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-200" />
              <span>Broadcast Directive</span>
            </button>

            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-gray-300" />
              <span>Export Audit Data</span>
            </button>
          </div>
        }
      />

      {/* Governance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Users</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 font-serif">{users.length}</p>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-500">
            <span className="font-semibold text-purple-700">{adminsCount} Admins</span>
            <span>•</span>
            <span className="font-semibold text-blue-700">{supervisorsCount} Supervisors</span>
            <span>•</span>
            <span className="font-semibold text-emerald-700">{observersCount} Observers</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Firestore Telemetry</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 font-serif">Real-Time</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Encrypted socket active</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Audit Trail Integrity</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 font-serif">Immutable</p>
          <button
            type="button"
            onClick={() => setShowAuditModal(true)}
            className="text-[11px] text-blue-700 hover:text-blue-900 font-bold mt-2 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>View Full Audit Logs</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Offline Cache</span>
            <HardDrive className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 font-serif">IndexedDB</p>
          <p className="text-[11px] text-gray-400 mt-2">Zero loss fallback operational</p>
        </div>
      </div>

      {/* Structured Admin Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Management & Role Escalation */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-serif flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-700" />
                  <span>Observer Roster & Role Elevation</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Manage permissions for observers and field supervisors</p>
              </div>
              <Link
                to="/observers"
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
              >
                <span>Full Directory</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {users.slice(0, 5).map((u) => (
                <div
                  key={u.uid}
                  className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-gray-900">{u.displayName || u.email}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{u.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      u.role === 'supervisor' || u.role === 'field_supervisor' ? 'bg-blue-100 text-blue-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {u.role || 'Observer'}
                    </span>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserForUpgrade(u);
                          setShowUpgradeModal(true);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-[11px] font-semibold text-gray-700 cursor-pointer transition-colors"
                      >
                        Change Role
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 text-right">
            <Link
              to="/observers"
              className="text-xs font-bold text-gray-700 hover:text-gray-900 inline-flex items-center gap-1"
            >
              <span>Manage all {users.length} registered personnel →</span>
            </Link>
          </div>
        </div>

        {/* Situation Room Directives & Emergency Controls */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-serif flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-700" />
                  <span>HQ Situation Room Controls</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Directives, emergency alerts, and statutory exports</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 font-serif">Broadcast Strategic Directive</h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                    Issue priority advisories or voting protocol instructions to all field observers in real time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(true)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-2xs"
                >
                  Dispatch
                </button>
              </div>

              {/* Web Push Emergency Declarations & Device Alert Controls */}
              <PushNotificationPrompt variant="card" />

              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-blue-950 font-serif">Download Formatted Reports</h4>
                  <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                    Export incident logs, voter accreditation counts, and Form EC8A results as structured CSVs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-2xs"
                >
                  Export CSV
                </button>
              </div>

              <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-purple-950 font-serif">Immutable Audit Trail</h4>
                    <span className="px-1.5 py-0.5 bg-purple-200 text-purple-800 rounded text-[9px] font-bold uppercase">Admin Only</span>
                  </div>
                  <p className="text-[11px] text-purple-900 mt-0.5 leading-relaxed">
                    Inspect tamper-proof action logs of incident submissions, report revisions, and governance directives.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    to="/audit-logs"
                    className="px-3 py-1.5 bg-purple-900 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-2xs inline-flex items-center gap-1"
                  >
                    <span>Full View</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowAuditModal(true)}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 border border-gray-200 rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-2xs"
                  >
                    Quick Log
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Recent Critical Action Logs */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-700" />
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800">
                Recent Critical Action Audit Stream
              </h3>
              <p className="text-[11px] text-gray-500">Live operational ledger capturing user and administrative activities</p>
            </div>
          </div>
          <Link
            to="/audit-logs"
            className="text-xs font-bold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
          >
            <span>View All Logs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            No critical user action logs recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 text-xs">
            {recentLogs.map((log) => {
              const actorName = log.actorName || log.deletedByName || 'System User';
              const actorRole = log.actorRole || log.deletedByRole || 'observer';
              let relativeTime = 'Just now';
              if ((log.timestamp as any)?.toDate) {
                relativeTime = formatDistanceToNow((log.timestamp as any).toDate(), { addSuffix: true });
              }

              return (
                <div key={log.id} className="p-4 hover:bg-gray-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] font-bold font-mono uppercase shrink-0">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{log.summary || 'Critical activity'}</span>
                        {log.pollingUnitId && (
                          <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                            PU #{log.pollingUnitId}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        By <strong className="text-gray-700">{actorName}</strong> ({actorRole}) {log.reason && `• "${log.reason}"`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right shrink-0">
                    <span className="text-[11px] text-gray-400 font-medium">{relativeTime}</span>
                    <button
                      type="button"
                      onClick={() => setShowAuditModal(true)}
                      className="text-purple-700 hover:text-purple-900 font-semibold text-[11px] cursor-pointer"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <AuditTrailModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
      />

      <DownloadReportsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        allReports={reports}
        filteredReports={reports}
        currentFilterType="all"
      />

      <DirectiveBroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
      />

      {selectedUserForUpgrade && (
        <RoleUpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => {
            setShowUpgradeModal(false);
            setSelectedUserForUpgrade(null);
          }}
          user={selectedUserForUpgrade}
          onSuccess={() => {
            setShowUpgradeModal(false);
            setSelectedUserForUpgrade(null);
          }}
        />
      )}
    </div>
  );
}
