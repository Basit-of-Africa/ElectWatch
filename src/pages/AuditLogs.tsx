import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { AuditLogEntry, AuditActionType } from '../types';
import PageHeader from '../components/common/PageHeader';
import { 
  Activity, 
  Search, 
  Download, 
  Filter, 
  Calendar, 
  User as UserIcon, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  FileEdit, 
  Send, 
  Trash2, 
  Radio, 
  KeyRound, 
  ShieldCheck, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Lock, 
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Link, Navigate } from 'react-router-dom';

export default function AuditLogs() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionCategory, setActionCategory] = useState<string>('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Access Control: Admin only (or supervisors with elevated access)
  if (!isAdmin && !isSupervisor) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditLogEntry));
      setLogs(entries);
      setLoading(false);
    }, (err) => {
      console.warn('Audit logs listener error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    const actorName = log.actorName || log.deletedByName || '';
    const actorEmail = log.actorEmail || log.deletedByEmail || '';
    const summary = log.summary || '';
    const reason = log.reason || '';
    const targetId = log.targetId || '';
    const puId = log.pollingUnitId || '';

    const matchesSearch = 
      targetId.toLowerCase().includes(term) ||
      puId.toLowerCase().includes(term) ||
      summary.toLowerCase().includes(term) ||
      reason.toLowerCase().includes(term) ||
      actorName.toLowerCase().includes(term) ||
      actorEmail.toLowerCase().includes(term);

    // Filter by action category
    let matchesCategory = true;
    if (actionCategory === 'incident_submit') {
      matchesCategory = log.action === 'SUBMIT_INCIDENT';
    } else if (actionCategory === 'report_edit') {
      matchesCategory = log.action === 'EDIT_REPORT' || log.action === 'UPDATE_REPORT';
    } else if (actionCategory === 'report_submit') {
      matchesCategory = log.action === 'SUBMIT_REPORT';
    } else if (actionCategory === 'incident_status') {
      matchesCategory = log.action === 'UPDATE_INCIDENT_STATUS';
    } else if (actionCategory === 'deletions') {
      matchesCategory = log.action === 'DELETE_REPORT' || log.action === 'DELETE_INCIDENT';
    } else if (actionCategory === 'governance') {
      matchesCategory = log.action === 'BROADCAST_DIRECTIVE' || log.action === 'UPGRADE_USER_ROLE';
    }

    // Filter by target type
    const matchesTargetType = 
      targetTypeFilter === 'all' || log.targetType === targetTypeFilter;

    return matchesSearch && matchesCategory && matchesTargetType;
  });

  const exportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('No audit records to export.');
      return;
    }

    const headers = [
      'Log ID',
      'Timestamp',
      'Action',
      'Target Type',
      'Target ID',
      'Polling Unit',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Summary',
      'Reason'
    ];

    const rows = filteredLogs.map(l => {
      let timeStr = 'N/A';
      if ((l.timestamp as any)?.toDate) {
        timeStr = format((l.timestamp as any).toDate(), 'yyyy-MM-dd HH:mm:ss');
      } else if (l.timestamp) {
        timeStr = String(l.timestamp);
      }

      const actorName = l.actorName || l.deletedByName || 'System';
      const actorEmail = l.actorEmail || l.deletedByEmail || 'N/A';
      const actorRole = l.actorRole || l.deletedByRole || 'admin';

      return [
        `"${l.id}"`,
        `"${timeStr}"`,
        `"${l.action}"`,
        `"${l.targetType}"`,
        `"${l.targetId}"`,
        `"${l.pollingUnitId || ''}"`,
        `"${actorName.replace(/"/g, '""')}"`,
        `"${actorEmail}"`,
        `"${actorRole}"`,
        `"${(l.summary || '').replace(/"/g, '""')}"`,
        `"${(l.reason || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ivote_audit_logs_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredLogs.length} audit records to CSV.`);
  };

  const getActionBadge = (action: AuditActionType) => {
    switch (action) {
      case 'SUBMIT_INCIDENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Incident Submitted</span>
          </span>
        );
      case 'EDIT_REPORT':
      case 'UPDATE_REPORT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <FileEdit className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Report Edited</span>
          </span>
        );
      case 'SUBMIT_REPORT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Send className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Report Submitted</span>
          </span>
        );
      case 'UPDATE_INCIDENT_STATUS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Status Updated</span>
          </span>
        );
      case 'DELETE_REPORT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
            <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>Report Deleted</span>
          </span>
        );
      case 'DELETE_INCIDENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
            <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>Incident Deleted</span>
          </span>
        );
      case 'BROADCAST_DIRECTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Radio className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Directive Broadcast</span>
          </span>
        );
      case 'UPGRADE_USER_ROLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <KeyRound className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Role Modified</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
            <Activity className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <span>{action}</span>
          </span>
        );
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800">Admin</span>;
      case 'supervisor':
      case 'field_supervisor':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">Supervisor</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">Observer</span>;
    }
  };

  // Metrics summary
  const incidentSubmissionsCount = logs.filter(l => l.action === 'SUBMIT_INCIDENT').length;
  const reportEditsCount = logs.filter(l => l.action === 'EDIT_REPORT' || l.action === 'UPDATE_REPORT').length;
  const reportSubmissionsCount = logs.filter(l => l.action === 'SUBMIT_REPORT').length;
  const deletionsCount = logs.filter(l => l.action === 'DELETE_REPORT' || l.action === 'DELETE_INCIDENT').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs & Action Trail"
        subtitle="Cryptographic, tamper-resistant trail capturing critical user operations including incident submissions, report edits, and statutory modifications."
        breadcrumbs={[
          { label: 'Administration', href: '/administration' },
          { label: 'Audit Logs' }
        ]}
        badge={
          <span className="px-3 py-1 bg-purple-100 text-purple-800 border border-purple-200 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-purple-700" />
            <span>Admin-Only View</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCSV}
              disabled={filteredLogs.length === 0}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 active:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Download className="w-3.5 h-3.5 text-gray-300" />
              <span>Export Audit CSV</span>
            </button>
          </div>
        }
      />

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Actions Logged</span>
            <Activity className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 font-serif">{logs.length}</p>
          <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Real-time write-only ledger</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Incident Submissions</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-700 font-serif">{incidentSubmissionsCount}</p>
          <p className="text-[11px] text-gray-500 mt-1">Field observer incident alerts</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Report Edits & Changes</span>
            <FileEdit className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 font-serif">{reportEditsCount}</p>
          <p className="text-[11px] text-gray-500 mt-1">Admin revisions & reclassifications</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Other Observations / Purges</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 font-serif">{reportSubmissionsCount + deletionsCount}</p>
          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
            <span className="text-blue-700 font-semibold">{reportSubmissionsCount} Reports</span>
            <span>•</span>
            <span className="text-red-700 font-semibold">{deletionsCount} Deletions</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by PU #, Actor, Summary, Target ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Target Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Target:</span>
            </span>
            <select
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All Targets</option>
              <option value="incident">Incidents</option>
              <option value="report">Reports</option>
              <option value="user">Personnel</option>
              <option value="directive">Directives</option>
            </select>
          </div>
        </div>

        {/* Action Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Actions' },
            { id: 'incident_submit', label: 'Incident Submissions' },
            { id: 'report_edit', label: 'Report Edits' },
            { id: 'report_submit', label: 'Report Submissions' },
            { id: 'incident_status', label: 'Status Updates' },
            { id: 'deletions', label: 'Deletions' },
            { id: 'governance', label: 'Directives & Roles' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActionCategory(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                actionCategory === tab.id
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Audit Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-700" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700">
              Recorded Action Entries ({filteredLogs.length})
            </h3>
          </div>
          <span className="text-[11px] text-gray-500 font-medium">
            Showing {filteredLogs.length} of {logs.length} total events
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
            <span className="text-xs font-medium">Loading Situation Room audit records...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <Info className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">No audit events match your active filters.</p>
            <p className="text-xs text-gray-400 mt-1">Try broadening your search term or switching to "All Actions".</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target & PU</th>
                  <th className="py-3 px-4">Performed By</th>
                  <th className="py-3 px-4">Summary & Reason</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const actorName = log.actorName || log.deletedByName || 'System Participant';
                  const actorEmail = log.actorEmail || log.deletedByEmail || '';
                  const actorRole = log.actorRole || log.deletedByRole || 'observer';

                  let formattedDate = 'N/A';
                  let relativeTime = '';
                  if ((log.timestamp as any)?.toDate) {
                    const dateObj = (log.timestamp as any).toDate();
                    formattedDate = format(dateObj, 'MMM d, yyyy HH:mm:ss');
                    relativeTime = formatDistanceToNow(dateObj, { addSuffix: true });
                  } else if (log.timestamp) {
                    formattedDate = String(log.timestamp);
                  }

                  return (
                    <React.Fragment key={log.id}>
                      <tr className={`hover:bg-gray-50/80 transition-colors ${isExpanded ? 'bg-purple-50/20' : ''}`}>
                        {/* Action Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getActionBadge(log.action)}
                        </td>

                        {/* Target & PU */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 font-mono text-[11px]">
                              {log.pollingUnitId ? `PU #${log.pollingUnitId}` : log.targetType.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              ID: {log.targetId ? log.targetId.slice(0, 10) + '...' : 'N/A'}
                            </span>
                          </div>
                        </td>

                        {/* Performed By */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-[10px] shrink-0 border border-gray-200">
                              {actorName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-gray-900">{actorName}</span>
                                {getRoleBadge(actorRole)}
                              </div>
                              {actorEmail && (
                                <p className="text-[10px] text-gray-400">{actorEmail}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Summary & Reason */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="font-medium text-gray-900 line-clamp-1">{log.summary || 'Operational modification'}</p>
                          {log.reason && (
                            <p className="text-[11px] text-gray-500 line-clamp-1 italic mt-0.5">
                              "{log.reason}"
                            </p>
                          )}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-700 text-[11px]">{formattedDate}</span>
                            {relativeTime && (
                              <span className="text-[10px] text-gray-400">{relativeTime}</span>
                            )}
                          </div>
                        </td>

                        {/* Expand Button */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-gray-200">
                          <td colSpan={6} className="p-5">
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs space-y-3 text-xs">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                <div className="flex items-center gap-2">
                                  <Lock className="w-4 h-4 text-purple-600" />
                                  <span className="font-bold text-gray-900">Cryptographic Log Payload & State Changes</span>
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono">
                                    Doc ID: {log.id}
                                  </span>
                                </div>
                                <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Immutable Entry
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Operation Metadata</h4>
                                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                                    <span className="text-gray-500">Action:</span>
                                    <span className="font-mono font-bold text-gray-800">{log.action}</span>
                                    <span className="text-gray-500">Target Type:</span>
                                    <span className="font-medium text-gray-800">{log.targetType}</span>
                                    <span className="text-gray-500">Target ID:</span>
                                    <span className="font-mono text-gray-800 truncate" title={log.targetId}>{log.targetId}</span>
                                    <span className="text-gray-500">Polling Unit:</span>
                                    <span className="font-semibold text-gray-800">{log.pollingUnitId || 'N/A'}</span>
                                    <span className="text-gray-500">Actor UID:</span>
                                    <span className="font-mono text-gray-800 truncate">{log.actorId || log.deletedBy || 'System'}</span>
                                  </div>
                                </div>

                                <div className="space-y-1.5 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Summary & Justification</h4>
                                  <p className="text-[11px] font-medium text-gray-800">{log.summary}</p>
                                  {log.reason && (
                                    <div className="mt-1 pt-1 border-t border-gray-200/60">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase">Reason:</span>
                                      <p className="text-[11px] italic text-gray-600">"{log.reason}"</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Details or Snapshot JSON */}
                              {(log.details || log.snapshot) && (
                                <div className="space-y-1.5">
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                                    <span>Captured State Details (JSON)</span>
                                  </h4>
                                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-52 leading-relaxed">
                                    {JSON.stringify(log.details || log.snapshot, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
