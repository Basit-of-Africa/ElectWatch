import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { checkGeminiHealth, GeminiHealthReport } from './geminiService';
import defaultConfig from '../../firebase-applet-config.json';

export type ServiceStatus = 'operational' | 'degraded' | 'offline' | 'unconfigured' | 'error' | 'checking';

export interface ServiceHealth {
  id: 'firestore' | 'auth' | 'gemini' | 'network';
  name: string;
  category: 'database' | 'security' | 'ai' | 'infrastructure';
  status: ServiceStatus;
  latencyMs?: number;
  lastChecked: Date;
  details: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  error?: string;
  fromCache?: boolean;
}

export interface SystemHealthSummary {
  status: 'operational' | 'degraded' | 'critical' | 'checking';
  servicesOnline: number;
  totalServices: number;
  avgLatencyMs: number;
  lastChecked: Date;
  services: ServiceHealth[];
}

/**
 * Timeout helper to ensure health checks never block indefinitely
 */
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMsg)), ms);
    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Test Cloud Firestore health, read latency, and cache status
 */
export async function checkFirestoreHealth(): Promise<ServiceHealth> {
  const startTime = performance.now();
  try {
    if (!db) {
      return {
        id: 'firestore',
        name: 'Cloud Firestore',
        category: 'database',
        status: 'error',
        lastChecked: new Date(),
        details: 'Firestore instance not initialized.',
        error: 'Firestore DB reference is null',
      };
    }

    // Perform a lightweight query on election_rounds with 8s timeout
    const testQuery = query(collection(db, 'election_rounds'), limit(1));
    const snap = await withTimeout(
      getDocs(testQuery),
      8000,
      'Firestore read timeout (>8000ms)'
    );

    const elapsed = Math.round(performance.now() - startTime);
    const isCache = snap.metadata.fromCache;
    const projectId = (db as any).app?.options?.projectId || defaultConfig.projectId || 'ai-studio-untitled';
    const databaseId = (db as any).databaseId?.database || defaultConfig.firestoreDatabaseId || '(default)';

    return {
      id: 'firestore',
      name: 'Cloud Firestore',
      category: 'database',
      status: 'operational',
      latencyMs: elapsed,
      lastChecked: new Date(),
      fromCache: isCache,
      details: isCache 
        ? `Read served from IndexedDB multi-tab cache (${elapsed}ms)`
        : `Live WebSocket sync connected (${elapsed}ms)`,
      metadata: {
        projectId,
        databaseId,
        cachedDocs: isCache,
        hasPendingWrites: snap.metadata.hasPendingWrites,
        docsCount: snap.docs.length,
        persistence: 'IndexedDB persistentLocalCache',
      },
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - startTime);
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    return {
      id: 'firestore',
      name: 'Cloud Firestore',
      category: 'database',
      status: isOffline ? 'offline' : 'degraded',
      latencyMs: elapsed,
      lastChecked: new Date(),
      details: isOffline
        ? 'Browser is offline. Local IndexedDB fallback active.'
        : `Connection degraded or timed out: ${err?.message || String(err)}`,
      error: err?.message || String(err),
      metadata: {
        offlineMode: isOffline,
      },
    };
  }
}

/**
 * Test Firebase Auth service, active session, and token freshness
 */
export async function checkAuthHealth(): Promise<ServiceHealth> {
  const startTime = performance.now();
  try {
    if (!auth) {
      return {
        id: 'auth',
        name: 'Firebase Auth',
        category: 'security',
        status: 'error',
        lastChecked: new Date(),
        details: 'Firebase Auth instance not initialized.',
        error: 'Auth reference is null',
      };
    }

    const currentUser = auth.currentUser;
    let tokenLatency = 0;
    let tokenExpirationTime: string | undefined;

    if (currentUser) {
      const tokenStart = performance.now();
      const tokenResult = await withTimeout(
        currentUser.getIdTokenResult(false),
        6000,
        'Auth token verification timed out'
      );
      tokenLatency = Math.round(performance.now() - tokenStart);
      tokenExpirationTime = tokenResult.expirationTime;
    }

    const totalElapsed = Math.round(performance.now() - startTime);
    const authDomain = auth.config.authDomain || defaultConfig.authDomain || 'unknown';

    return {
      id: 'auth',
      name: 'Firebase Authentication',
      category: 'security',
      status: 'operational',
      latencyMs: tokenLatency || totalElapsed,
      lastChecked: new Date(),
      details: currentUser
        ? `Session authenticated for ${currentUser.email || currentUser.displayName || currentUser.uid} (${tokenLatency}ms token verify)`
        : 'Auth service online (Guest/Unauthenticated state)',
      metadata: {
        authDomain,
        isAuthenticated: !!currentUser,
        userEmail: currentUser?.email || 'None',
        userUid: currentUser?.uid || 'None',
        emailVerified: currentUser?.emailVerified || false,
        tokenExpirationTime: tokenExpirationTime || 'N/A',
        persistence: 'browserLocalPersistence (IndexedDB)',
      },
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      id: 'auth',
      name: 'Firebase Authentication',
      category: 'security',
      status: 'degraded',
      latencyMs: elapsed,
      lastChecked: new Date(),
      details: `Auth token verification degraded: ${err?.message || String(err)}`,
      error: err?.message || String(err),
    };
  }
}

/**
 * Test Gemini API connection, model response, and latency
 */
export async function checkGeminiHealthService(): Promise<ServiceHealth> {
  try {
    const report: GeminiHealthReport = await withTimeout(
      checkGeminiHealth(),
      12000,
      'Gemini API probe request timed out (>12000ms)'
    );

    return {
      id: 'gemini',
      name: 'Gemini AI Intelligence',
      category: 'ai',
      status: report.status,
      latencyMs: report.latencyMs,
      lastChecked: report.lastChecked,
      details: report.details || 'Gemini status check completed.',
      error: report.error,
      metadata: {
        model: report.model,
        configured: report.configured,
        primaryTask: 'Incident Analysis & Directive Summarization',
      },
    };
  } catch (err: any) {
    return {
      id: 'gemini',
      name: 'Gemini AI Intelligence',
      category: 'ai',
      status: 'degraded',
      lastChecked: new Date(),
      details: `AI probe error: ${err?.message || String(err)}`,
      error: err?.message || String(err),
      metadata: {
        model: 'gemini-2.5-flash',
        configured: true,
      },
    };
  }
}

/**
 * Check Browser Network Gateway and offline cache
 */
export async function checkNetworkHealth(): Promise<ServiceHealth> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const swActive = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
  const pushPermission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  return {
    id: 'network',
    name: 'Network & Service Worker',
    category: 'infrastructure',
    status: isOnline ? 'operational' : 'offline',
    latencyMs: 1,
    lastChecked: new Date(),
    details: isOnline 
      ? `Network connection active (${swActive ? 'PWA Service Worker caching enabled' : 'Browser direct'})`
      : 'Device is offline. Local indexedDB read/write caching active.',
    metadata: {
      isOnline,
      serviceWorkerActive: swActive,
      pushNotificationPermission: pushPermission,
      connectionType: (navigator as any)?.connection?.effectiveType || 'standard',
    },
  };
}

/**
 * Run full real-time diagnostics across all connected services
 */
export async function runFullSystemHealthCheck(): Promise<SystemHealthSummary> {
  const [firestoreRes, authRes, geminiRes, networkRes] = await Promise.all([
    checkFirestoreHealth(),
    checkAuthHealth(),
    checkGeminiHealthService(),
    checkNetworkHealth(),
  ]);

  const services = [firestoreRes, authRes, geminiRes, networkRes];
  const coreServices = [firestoreRes, authRes, geminiRes];

  const operationalCount = coreServices.filter(s => s.status === 'operational').length;
  const hasCritical = coreServices.some(s => s.status === 'error' || s.status === 'offline');
  const hasDegraded = coreServices.some(s => s.status === 'degraded' || s.status === 'unconfigured');

  let overallStatus: SystemHealthSummary['status'] = 'operational';
  if (hasCritical) {
    overallStatus = 'critical';
  } else if (hasDegraded || operationalCount < coreServices.length) {
    overallStatus = 'degraded';
  }

  const latencies = coreServices
    .map(s => s.latencyMs)
    .filter((l): l is number => typeof l === 'number' && l > 0);

  const avgLatencyMs = latencies.length > 0 
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) 
    : 0;

  return {
    status: overallStatus,
    servicesOnline: operationalCount,
    totalServices: coreServices.length,
    avgLatencyMs,
    lastChecked: new Date(),
    services,
  };
}
