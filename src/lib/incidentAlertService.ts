import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Incident, IncidentAlertThresholdConfig, IncidentThresholdBreach } from '../types';
import { toast } from 'sonner';

export const THRESHOLD_CONFIG_KEY = 'osun_incident_threshold_config';
export const THRESHOLD_ALERT_DISPATCHED_KEY = 'osun_incident_threshold_dispatched';
export const THRESHOLD_ACKNOWLEDGED_KEY = 'osun_incident_threshold_acknowledged';

export const DEFAULT_THRESHOLD_CONFIG: IncidentAlertThresholdConfig = {
  enabled: true,
  incidentCountThreshold: 2, // 2 or more incidents triggers an automated alert
  timeWindowHours: 0, // 0 = All-time / Election Day
  severityFilter: 'all',
  notifyAdmin: true,
  notifySupervisor: true,
  soundAlert: true,
  autoFlagHighRisk: true,
  cooldownMinutes: 30, // Don't spam notifications within 30 minutes for the same PU
};

export function getStoredThresholdConfig(): IncidentAlertThresholdConfig {
  try {
    const raw = localStorage.getItem(THRESHOLD_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_THRESHOLD_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to parse stored threshold config:', e);
  }
  return DEFAULT_THRESHOLD_CONFIG;
}

export function saveStoredThresholdConfig(config: IncidentAlertThresholdConfig): void {
  try {
    localStorage.setItem(THRESHOLD_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('incident-threshold-config-updated', { detail: config }));
  } catch (e) {
    console.error('Failed to save threshold config:', e);
  }
}

export function getAcknowledgedBreaches(): Set<string> {
  try {
    const raw = localStorage.getItem(THRESHOLD_ACKNOWLEDGED_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch (e) {
    console.warn('Failed to parse acknowledged breaches:', e);
  }
  return new Set();
}

export function acknowledgeBreach(pollingUnitId: string): void {
  try {
    const ackSet = getAcknowledgedBreaches();
    ackSet.add(pollingUnitId);
    localStorage.setItem(THRESHOLD_ACKNOWLEDGED_KEY, JSON.stringify(Array.from(ackSet)));
    window.dispatchEvent(new CustomEvent('incident-threshold-ack-updated'));
  } catch (e) {
    console.error('Failed to acknowledge breach:', e);
  }
}

export function clearAcknowledgedBreach(pollingUnitId: string): void {
  try {
    const ackSet = getAcknowledgedBreaches();
    ackSet.delete(pollingUnitId);
    localStorage.setItem(THRESHOLD_ACKNOWLEDGED_KEY, JSON.stringify(Array.from(ackSet)));
    window.dispatchEvent(new CustomEvent('incident-threshold-ack-updated'));
  } catch (e) {
    console.error('Failed to clear acknowledged breach:', e);
  }
}

export function playThresholdAudioChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Multi-frequency alert chime
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.setValueAtTime(1174.66, now + 0.15); // D6
    osc2.frequency.setValueAtTime(440, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.55);
    osc2.stop(now + 0.55);
  } catch (e) {
    // Browser audio policy can restrict before user interaction
    console.warn('Audio play restricted:', e);
  }
}

/**
 * Evaluates the list of incidents against the threshold config.
 */
export function evaluateIncidentThresholds(
  incidents: Incident[],
  config: IncidentAlertThresholdConfig = getStoredThresholdConfig()
): {
  breaches: IncidentThresholdBreach[];
  puIncidentCounts: Map<string, number>;
} {
  const puIncidentCounts = new Map<string, number>();
  if (!config.enabled) {
    return { breaches: [], puIncidentCounts };
  }

  const acknowledgedSet = getAcknowledgedBreaches();
  const now = Date.now();
  const timeLimitMs = config.timeWindowHours > 0 ? config.timeWindowHours * 60 * 60 * 1000 : 0;

  // Group incidents by Polling Unit
  const puMap = new Map<
    string,
    {
      incidents: Incident[];
      critical: number;
      high: number;
      medium: number;
      low: number;
      latestTimestamp: any;
    }
  >();

  for (const inc of incidents) {
    const puId = inc.pollingUnitId?.trim();
    if (!puId) continue;

    // Filter by severity if configured
    if (config.severityFilter === 'critical' && inc.severity !== 'critical') {
      continue;
    }
    if (config.severityFilter === 'high_critical' && inc.severity !== 'high' && inc.severity !== 'critical') {
      continue;
    }

    // Filter by time window if configured
    if (timeLimitMs > 0) {
      let incTime: number | null = null;
      if ((inc.timestamp as any)?.toDate) {
        incTime = (inc.timestamp as any).toDate().getTime();
      } else if (typeof inc.timestamp === 'string') {
        incTime = new Date(inc.timestamp).getTime();
      }
      if (incTime && now - incTime > timeLimitMs) {
        continue; // Outside configured time window
      }
    }

    // Accumulate
    let entry = puMap.get(puId);
    if (!entry) {
      entry = {
        incidents: [],
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        latestTimestamp: inc.timestamp,
      };
      puMap.set(puId, entry);
    }

    entry.incidents.push(inc);
    if (inc.severity === 'critical') entry.critical++;
    else if (inc.severity === 'high') entry.high++;
    else if (inc.severity === 'medium') entry.medium++;
    else if (inc.severity === 'low') entry.low++;
  }

  // Populate counts map
  puMap.forEach((entry, puId) => {
    puIncidentCounts.set(puId, entry.incidents.length);
  });

  // Check breaches
  const breaches: IncidentThresholdBreach[] = [];

  puMap.forEach((entry, puId) => {
    const count = entry.incidents.length;
    if (count >= config.incidentCountThreshold) {
      breaches.push({
        pollingUnitId: puId,
        count,
        threshold: config.incidentCountThreshold,
        severities: {
          critical: entry.critical,
          high: entry.high,
          medium: entry.medium,
          low: entry.low,
        },
        latestIncidentTimestamp: entry.latestTimestamp,
        incidentIds: entry.incidents.map((i) => i.id),
        acknowledged: acknowledgedSet.has(puId),
        triggeredAt: Date.now(),
      });
    }
  });

  // Sort breaches: unacknowledged first, then by count descending
  breaches.sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) {
      return a.acknowledged ? 1 : -1;
    }
    return b.count - a.count;
  });

  return { breaches, puIncidentCounts };
}

/**
 * Automatically dispatches system notifications to Firestore and alerts UI
 * if a polling unit has breached the incident threshold and hasn't been alerted recently.
 */
export async function dispatchAutomatedThresholdAlerts(
  breaches: IncidentThresholdBreach[],
  config: IncidentAlertThresholdConfig
): Promise<string[]> {
  if (!config.enabled || breaches.length === 0) return [];

  // Track dispatched alerts to avoid duplicate spam
  let dispatchedMap: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(THRESHOLD_ALERT_DISPATCHED_KEY);
    if (raw) dispatchedMap = JSON.parse(raw);
  } catch (e) {
    dispatchedMap = {};
  }

  const newlyAlertedPUs: string[] = [];
  const now = Date.now();
  const cooldownMs = (config.cooldownMinutes || 30) * 60 * 1000;

  for (const breach of breaches) {
    const lastDispatched = dispatchedMap[breach.pollingUnitId] || 0;
    // If not alerted yet or cooldown expired
    if (now - lastDispatched > cooldownMs) {
      newlyAlertedPUs.push(breach.pollingUnitId);
      dispatchedMap[breach.pollingUnitId] = now;

      // Construct notification title & message
      const title = `🚨 THRESHOLD ALERT: PU #${breach.pollingUnitId} exceeded ${breach.threshold} incidents`;
      const message = `Automated trigger: ${breach.count} incident reports recorded at Polling Unit #${breach.pollingUnitId} (Threshold set to ${breach.threshold}). Breakdown: ${breach.severities.critical} Critical, ${breach.severities.high} High, ${breach.severities.medium} Medium. Immediate administrative action recommended.`;

      // 1. Dispatch to Firestore notifications for admins and supervisors non-blockingly
      try {
        if (config.notifyAdmin) {
          await addDoc(collection(db, 'notifications'), {
            userId: 'admin',
            title,
            message,
            type: 'error',
            category: 'incident',
            priority: 'critical',
            read: false,
            link: `/incidents?search=${encodeURIComponent(breach.pollingUnitId)}`,
            timestamp: serverTimestamp(),
          });
        }
        if (config.notifySupervisor) {
          await addDoc(collection(db, 'notifications'), {
            userId: 'supervisor',
            title,
            message,
            type: 'warning',
            category: 'incident',
            priority: 'critical',
            read: false,
            link: `/incidents?search=${encodeURIComponent(breach.pollingUnitId)}`,
            timestamp: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Non-blocking threshold alert dispatch to Firestore warning:', err);
      }
    }
  }

  // Update dispatched storage
  if (newlyAlertedPUs.length > 0) {
    try {
      localStorage.setItem(THRESHOLD_ALERT_DISPATCHED_KEY, JSON.stringify(dispatchedMap));
    } catch (e) {
      console.warn('Failed to store dispatched alert timestamps:', e);
    }

    // Play chime if enabled
    if (config.soundAlert) {
      playThresholdAudioChime();
    }

    // Surface high-priority toast
    toast.error(`Automated Incident Threshold Triggered!`, {
      description: `${newlyAlertedPUs.length} Polling Unit${newlyAlertedPUs.length > 1 ? 's' : ''} (${newlyAlertedPUs.join(', ')}) exceeded the incident threshold of ${config.incidentCountThreshold} reports.`,
      duration: 8000,
    });
  }

  return newlyAlertedPUs;
}
