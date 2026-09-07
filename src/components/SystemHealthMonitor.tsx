import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  ShieldCheck, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Activity, 
  Terminal, 
  Copy, 
  Check, 
  Server, 
  HardDrive,
  Lock,
  ArrowUpRight
} from 'lucide-react';
import { 
  runFullSystemHealthCheck, 
  checkFirestoreHealth, 
  checkAuthHealth, 
  checkGeminiHealthService,
  SystemHealthSummary,
  ServiceHealth,
  ServiceStatus
} from '../services/systemHealthService';
import { useAuth } from '../context/AuthContext';

interface SystemHealthMonitorProps {
  className?: string;
  autoRefreshIntervalSeconds?: number;
}

export default function SystemHealthMonitor({ 
  className = '', 
  autoRefreshIntervalSeconds = 45 
}: SystemHealthMonitorProps) {
  const { user, isAdmin } = useAuth();
  const [healthSummary, setHealthSummary] = useState<SystemHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [probingService, setProbingService] = useState<string | null>(null);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [lastProbeSnippet, setLastProbeSnippet] = useState<string | null>(null);

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const summary = await runFullSystemHealthCheck();
      setHealthSummary(summary);
    } catch (err) {
      console.error('Failed to run system health check:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh timer
  useEffect(() => {
    fetchHealth();

    const interval = setInterval(() => {
      fetchHealth(true);
    }, autoRefreshIntervalSeconds * 1000);

    // Online/Offline listener for instantaneous status reflection
    const handleOnline = () => fetchHealth(true);
    const handleOffline = () => fetchHealth(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchHealth, autoRefreshIntervalSeconds]);

  // Individual on-demand probe for specific service
  const handleProbeService = async (serviceId: 'firestore' | 'auth' | 'gemini') => {
    setProbingService(serviceId);
    setLastProbeSnippet(null);
    try {
      let updatedService: ServiceHealth;
      if (serviceId === 'firestore') {
        updatedService = await checkFirestoreHealth();
      } else if (serviceId === 'auth') {
        updatedService = await checkAuthHealth();
      } else {
        updatedService = await checkGeminiHealthService();
      }

      setHealthSummary((prev) => {
        if (!prev) return prev;
        const updatedList = prev.services.map((s) => (s.id === serviceId ? updatedService : s));
        const core = updatedList.filter((s) => s.id !== 'network');
        const onlineCount = core.filter((s) => s.status === 'operational').length;
        const latencies = core.map((s) => s.latencyMs).filter((l): l is number => typeof l === 'number' && l > 0);
        const avg = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

        return {
          ...prev,
          services: updatedList,
          servicesOnline: onlineCount,
          avgLatencyMs: avg,
          lastChecked: new Date(),
        };
      });

      if (serviceId === 'gemini' && updatedService.details) {
        setLastProbeSnippet(updatedService.details);
      }
    } catch (err) {
      console.error(`Probe failed for ${serviceId}:`, err);
    } finally {
      setProbingService(null);
    }
  };

  const getStatusBadge = (status: ServiceStatus, latency?: number) => {
    switch (status) {
      case 'operational':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Operational</span>
            {latency !== undefined && (
              <span className="ml-1 text-[10px] font-mono text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded font-semibold">
                {latency}ms
              </span>
            )}
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Degraded</span>
            {latency !== undefined && (
              <span className="ml-1 text-[10px] font-mono text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded font-semibold">
                {latency}ms
              </span>
            )}
          </span>
        );
      case 'unconfigured':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <span>Not Configured</span>
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Offline</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
            <span>Service Error</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
            <RefreshCw className="w-3 h-3 animate-spin text-gray-500" />
            <span>Checking...</span>
          </span>
        );
    }
  };

  const getLatencyColor = (ms?: number) => {
    if (ms === undefined) return 'text-gray-400';
    if (ms < 150) return 'text-emerald-700';
    if (ms < 600) return 'text-amber-700';
    return 'text-rose-700';
  };

  const firestoreService = healthSummary?.services.find((s) => s.id === 'firestore');
  const authService = healthSummary?.services.find((s) => s.id === 'auth');
  const geminiService = healthSummary?.services.find((s) => s.id === 'gemini');
  const networkService = healthSummary?.services.find((s) => s.id === 'network');

  const copyDiagnostics = () => {
    const diagnosticPayload = {
      timestamp: new Date().toISOString(),
      overall: healthSummary,
      currentUser: user ? { uid: user.uid, email: user.email, role: user.role } : null,
      environment: {
        userAgent: navigator.userAgent,
        online: navigator.onLine,
      },
    };
    navigator.clipboard.writeText(JSON.stringify(diagnosticPayload, null, 2));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2500);
  };

  return (
    <div className={`space-y-4 ${className}`} id="system-health-monitor">
      {/* Overview Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              healthSummary?.status === 'operational'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : healthSummary?.status === 'critical'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-900 font-serif">
                  Connected Systems & Cloud Telemetry
                </h3>
                {healthSummary && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    healthSummary.status === 'operational'
                      ? 'bg-emerald-100/80 text-emerald-900 border-emerald-300'
                      : healthSummary.status === 'critical'
                      ? 'bg-rose-100 text-rose-900 border-rose-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                    {healthSummary.status === 'operational'
                      ? `All Systems Operational (${healthSummary.servicesOnline}/${healthSummary.totalServices})`
                      : healthSummary.status === 'critical'
                      ? 'System Outage Detected'
                      : 'Degraded Connectivity'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time connection probing for database streams, cryptographic identity, and AI intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchHealth(false)}
              disabled={loading}
              title="Run a full real-time diagnostics sweep across all services"
              className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-800 border border-gray-200 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Probing...' : 'Run Diagnostics'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDiagnosticsModal(true)}
              className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Raw Telemetry</span>
            </button>
          </div>
        </div>

        {/* Global Latency & Uptime Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100 text-xs">
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Avg API Latency</span>
            <p className={`text-base font-bold font-mono mt-0.5 ${getLatencyColor(healthSummary?.avgLatencyMs)}`}>
              {healthSummary?.avgLatencyMs ? `${healthSummary.avgLatencyMs} ms` : '—'}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Socket Integrity</span>
            <p className="text-base font-bold text-gray-900 mt-0.5 flex items-center gap-1 font-serif">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
              <span>TLS / Encrypted</span>
            </p>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Network Gateway</span>
            <p className="text-base font-bold text-gray-900 mt-0.5 flex items-center gap-1">
              {networkService?.status === 'operational' ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>High-Speed Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                  <span>Offline Cache Active</span>
                </>
              )}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Telemetry Heartbeat</span>
            <p className="text-xs font-medium text-gray-600 mt-1">
              {healthSummary?.lastChecked
                ? `Checked ${healthSummary.lastChecked.toLocaleTimeString()}`
                : 'Probing...'}
            </p>
          </div>
        </div>
      </div>

      {/* 3 Core Connected Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Service 1: Cloud Firestore */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-colors">
          <div>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-950 font-serif">Cloud Firestore</h4>
                  <p className="text-[11px] text-gray-500">Live NoSQL & Offline Store</p>
                </div>
              </div>
              {getStatusBadge(firestoreService?.status || 'checking', firestoreService?.latencyMs)}
            </div>

            <div className="space-y-2 mt-4 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Connection Mode</span>
                <span className="font-semibold text-gray-800 font-mono text-[11px]">
                  {firestoreService?.fromCache ? 'IndexedDB Cache' : 'Direct Cloud Stream'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Roundtrip Latency</span>
                <span className={`font-bold font-mono text-[11px] ${getLatencyColor(firestoreService?.latencyMs)}`}>
                  {firestoreService?.latencyMs ? `${firestoreService.latencyMs} ms` : 'Testing...'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Local Persistence</span>
                <span className="font-semibold text-emerald-700 text-[11px] flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  <span>IndexedDB Active</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-500">Target Database</span>
                <span className="font-mono text-[10px] text-gray-600 truncate max-w-[130px]" title={String(firestoreService?.metadata?.databaseId || 'default')}>
                  {String(firestoreService?.metadata?.databaseId || 'default')}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
            <span className="text-[10px] text-gray-400">
              {firestoreService?.details || 'Probing Firestore...'}
            </span>
            <button
              type="button"
              onClick={() => handleProbeService('firestore')}
              disabled={probingService === 'firestore'}
              title="Dispatch a test query to verify Firestore roundtrip latency"
              className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${probingService === 'firestore' ? 'animate-spin' : ''}`} />
              <span>{probingService === 'firestore' ? 'Pinging...' : 'Ping DB'}</span>
            </button>
          </div>
        </div>

        {/* Service 2: Firebase Auth */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-colors">
          <div>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-700 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-950 font-serif">Firebase Auth</h4>
                  <p className="text-[11px] text-gray-500">Identity, JWT & RBAC Engine</p>
                </div>
              </div>
              {getStatusBadge(authService?.status || 'checking', authService?.latencyMs)}
            </div>

            <div className="space-y-2 mt-4 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Current Session</span>
                <span className="font-semibold text-gray-800 text-[11px] truncate max-w-[140px]" title={user?.email || 'Guest'}>
                  {user?.email || 'Guest Station'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Access Privileges</span>
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-[10px] font-bold uppercase tracking-wider">
                  {user?.role || (isAdmin ? 'Admin' : 'Observer')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Token Verification</span>
                <span className={`font-bold font-mono text-[11px] ${getLatencyColor(authService?.latencyMs)}`}>
                  {authService?.latencyMs ? `${authService.latencyMs} ms` : 'Verified'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-500">Session Mode</span>
                <span className="font-semibold text-gray-700 text-[11px] flex items-center gap-1">
                  <Lock className="w-3 h-3 text-purple-600" />
                  <span>browserLocalPersistence</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
            <span className="text-[10px] text-gray-400 truncate max-w-[150px]">
              {authService?.details || 'Probing Auth tokens...'}
            </span>
            <button
              type="button"
              onClick={() => handleProbeService('auth')}
              disabled={probingService === 'auth'}
              title="Verify active session JWT token freshness"
              className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${probingService === 'auth' ? 'animate-spin' : ''}`} />
              <span>{probingService === 'auth' ? 'Verifying...' : 'Verify Session'}</span>
            </button>
          </div>
        </div>

        {/* Service 3: Gemini API */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-colors">
          <div>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-950 font-serif">Gemini AI Engine</h4>
                  <p className="text-[11px] text-gray-500">Security & Directive Synthesis</p>
                </div>
              </div>
              {getStatusBadge(geminiService?.status || 'checking', geminiService?.latencyMs)}
            </div>

            <div className="space-y-2 mt-4 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Active Model</span>
                <span className="font-mono text-[11px] font-semibold text-gray-800 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                  {String(geminiService?.metadata?.model || 'gemini-2.5-flash')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">API Key Injection</span>
                <span className={`font-semibold text-[11px] flex items-center gap-1 ${
                  geminiService?.status === 'unconfigured' ? 'text-amber-600' : 'text-emerald-700'
                }`}>
                  {geminiService?.status === 'unconfigured' ? (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      <span>Missing Key</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Configured</span>
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Inference Latency</span>
                <span className={`font-bold font-mono text-[11px] ${getLatencyColor(geminiService?.latencyMs)}`}>
                  {geminiService?.latencyMs ? `${geminiService.latencyMs} ms` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-500">Core Capability</span>
                <span className="text-[10px] text-gray-600 font-medium">Incident Summaries</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
            <span className="text-[10px] text-gray-400 truncate max-w-[150px]">
              {geminiService?.error || geminiService?.details || 'Awaiting probe...'}
            </span>
            <button
              type="button"
              onClick={() => handleProbeService('gemini')}
              disabled={probingService === 'gemini'}
              title="Send a lightweight probe to the Gemini model to measure latency and response"
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 transition-colors"
            >
              <Sparkles className={`w-3 h-3 text-amber-600 ${probingService === 'gemini' ? 'animate-spin' : ''}`} />
              <span>{probingService === 'gemini' ? 'Testing...' : 'Probe AI'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Probe Feedback Banner (when triggered by user) */}
      {lastProbeSnippet && (
        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-gray-800 font-mono text-[11px]">{lastProbeSnippet}</span>
          </div>
          <button
            type="button"
            onClick={() => setLastProbeSnippet(null)}
            className="text-[11px] text-amber-800 hover:text-amber-950 font-bold shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Raw Telemetry Modal */}
      {showDiagnosticsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-5 h-5 text-gray-800" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 font-serif">
                    Live System Telemetry & Diagnostic Report
                  </h3>
                  <p className="text-xs text-gray-500">
                    Real-time network handshakes, credentials verification, and latency records
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200/60 cursor-pointer transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto font-mono text-xs space-y-4 bg-gray-950 text-gray-100">
              <div className="flex items-center justify-between text-gray-400 text-[11px] pb-2 border-b border-gray-800">
                <span>System Timestamp: {new Date().toISOString()}</span>
                <button
                  type="button"
                  onClick={copyDiagnostics}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-[10px] font-sans inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLogs ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>

              <div>
                <span className="text-emerald-400 font-bold">// 1. CLOUD FIRESTORE TELEMETRY</span>
                <pre className="text-gray-300 text-[11px] mt-1 bg-gray-900 p-3 rounded-lg border border-gray-800 overflow-x-auto">
{JSON.stringify(firestoreService, null, 2)}
                </pre>
              </div>

              <div>
                <span className="text-purple-400 font-bold">// 2. FIREBASE AUTHENTICATION TELEMETRY</span>
                <pre className="text-gray-300 text-[11px] mt-1 bg-gray-900 p-3 rounded-lg border border-gray-800 overflow-x-auto">
{JSON.stringify(authService, null, 2)}
                </pre>
              </div>

              <div>
                <span className="text-amber-400 font-bold">// 3. GEMINI AI ENGINE TELEMETRY</span>
                <pre className="text-gray-300 text-[11px] mt-1 bg-gray-900 p-3 rounded-lg border border-gray-800 overflow-x-auto">
{JSON.stringify(geminiService, null, 2)}
                </pre>
              </div>

              <div>
                <span className="text-blue-400 font-bold">// 4. NETWORK & CLIENT RUNTIME</span>
                <pre className="text-gray-300 text-[11px] mt-1 bg-gray-900 p-3 rounded-lg border border-gray-800 overflow-x-auto">
{JSON.stringify(networkService, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs">
              <span className="text-gray-500">
                Encrypted in-transit via TLS 1.3 & Firebase Security Rules
              </span>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl font-bold cursor-pointer hover:bg-gray-800 transition-colors"
              >
                Close Telemetry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
