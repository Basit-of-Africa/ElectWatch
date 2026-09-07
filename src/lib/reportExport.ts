import { format } from 'date-fns';
import { Report } from '../types';

export interface ObserverInfo {
  displayName?: string;
  email?: string;
  phone?: string;
}

export interface IncidentMeta {
  id?: string;
  status?: string;
}

export interface ExportOptions {
  dateRange?: 'all' | 'today' | '24h' | '7d';
  electionLevel?: string;
  observerMap?: Record<string, ObserverInfo>;
  incidentMap?: Record<string, IncidentMeta>;
  customFilenamePrefix?: string;
}

export const INCIDENT_CATEGORY_LABELS: Record<string, string> = {
  bvas_failure: 'BVAS Device / Technical Failure',
  violence_intimidation: 'Violence / Physical Intimidation / Political Thuggery',
  ballot_tampering: 'Ballot Box Snatching / Destruction of Materials',
  logistics_delay: 'Late Arrival of Officials / Missing Materials',
  vote_buying: 'Vote Buying / Cash & Commodity Inducement',
  disenfranchisement: 'Voter Suppression / Undue Refusal of Accreditation',
  procedural_irregularity: 'Breach of Electoral Act / Unauthorized Agents',
  other: 'Other Severe Polling Station Disruption'
};

export const BVAS_STATUS_LABELS: Record<string, string> = {
  functioning: 'Fully Functioning',
  intermittent: 'Slow / Intermittent',
  malfunctioning: 'Malfunctioning',
  not_arrived: 'Device Not Delivered'
};

export const QUEUE_SIZE_LABELS: Record<string, string> = {
  short: '< 50 Voters (Short)',
  medium: '50 - 150 Voters (Moderate)',
  large: '150 - 300 Voters (Long)',
  overflowing: '300+ Voters (Massive Turnout)'
};

export const SECURITY_NOTIFIED_LABELS: Record<string, string> = {
  yes: 'Yes (Operatives Alerted)',
  no: 'No (Present but Unalerted)',
  none_present: 'None Stationed at PU'
};

export const STATE_CODE_MAP: Record<string, string> = {
  OS: 'Osun',
  LA: 'Lagos',
  OG: 'Ogun',
  OY: 'Oyo',
  ON: 'Ondo',
  EK: 'Ekiti',
  FC: 'FCT Abuja',
  RV: 'Rivers',
  KD: 'Kaduna',
  KN: 'Kano',
  AN: 'Anambra',
  ED: 'Edo',
  DT: 'Delta'
};

export const KNOWN_STATION_NAMES: Record<string, { name: string; lga: string; ward: string; registeredVoters?: number }> = {
  'PU-OS-01/01/01/001': { name: 'Town Hall Square, Ataoja A', lga: 'Osogbo', ward: 'Ward 01 - Ataoja A', registeredVoters: 750 },
  'PU-OS-01/01/01/002': { name: 'Community Primary School, Oja Oba', lga: 'Osogbo', ward: 'Ward 01 - Ataoja A', registeredVoters: 920 },
  'PU-OS-01/02/03/003': { name: 'Baptist High School, Gbonmi', lga: 'Osogbo', ward: 'Ward 02 - Ataoja B', registeredVoters: 680 },
  'PU-OS-01/03/01/004': { name: 'St. Marks Anglican Primary School', lga: 'Osogbo', ward: 'Ward 03 - Otun Balogun', registeredVoters: 840 },
  'PU-OS-02/01/02/005': { name: 'Igbonna Market Open Space', lga: 'Olorunda', ward: 'Ward 01 - Akogun', registeredVoters: 890 },
  'PU-OS-02/02/01/006': { name: 'LA Primary School, Ayetoro', lga: 'Olorunda', ward: 'Ward 02 - Balogun', registeredVoters: 740 },
  'PU-OS-02/03/04/007': { name: 'Government Technical College', lga: 'Olorunda', ward: 'Ward 03 - Ilie', registeredVoters: 610 },
  'PU-OS-03/01/01/008': { name: 'Methodist Grammar School, Ilesa', lga: 'Ilesa East', ward: 'Ward 01 - Biladu', registeredVoters: 820 },
  'PU-OS-03/02/02/009': { name: 'St. Johns School, Iloro', lga: 'Ilesa East', ward: 'Ward 02 - Iloro', registeredVoters: 960 },
  'PU-OS-03/03/01/010': { name: 'Imo Community Hall', lga: 'Ilesa East', ward: 'Ward 03 - Ijofi', registeredVoters: 590 },
  'PU-OS-04/01/01/011': { name: 'Ife City Hall, Enuwa', lga: 'Ife Central', ward: 'Ward 01 - Ilode I', registeredVoters: 1100 },
  'PU-OS-04/02/03/012': { name: 'Oranmiyan Memorial Grammar School', lga: 'Ife Central', ward: 'Ward 02 - Moore', registeredVoters: 870 },
  'PU-OS-04/03/02/013': { name: 'Urban Day Grammar School, Mayfair', lga: 'Ife Central', ward: 'Ward 03 - Iremo I', registeredVoters: 950 },
  'PU-OS-05/01/01/014': { name: 'St. Peters Anglican School, Ede', lga: 'Ede South', ward: 'Ward 01 - Abogunde', registeredVoters: 840 },
  'PU-OS-05/02/02/015': { name: 'Mapo Primary School, Ede', lga: 'Ede South', ward: 'Ward 02 - Alapo', registeredVoters: 760 },
  'PU-OS-05/03/01/016': { name: 'Timi Agbale Grammar School', lga: 'Ede South', ward: 'Ward 03 - Babasanya', registeredVoters: 690 },
};

/**
 * Cleanly format and escape strings according to RFC 4180 CSV specifications.
 * Encloses all text in double-quotes and replaces internal quotes with double-quotes.
 */
export function formatCSVCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  return `"${str.replace(/"/g, '""').replace(/\r?\n|\r/g, ' ')}"`;
}

/**
 * Format numeric cells cleanly without quotes for mathematical spreadsheets.
 */
export function formatCSVNumber(value: any): string {
  if (value === null || value === undefined || value === '') return '""';
  const num = Number(value);
  return isNaN(num) ? '""' : String(num);
}

/**
 * Extract Date object safely from Firestore Timestamp or string
 */
export function parseReportDate(timestamp: any): Date | null {
  if (!timestamp) return null;
  try {
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Format timestamp into standard UTC and Local Nigerian Time (WAT: UTC+1)
 */
export function formatReportTimestamps(timestamp: any): { utc: string; wat: string } {
  const dt = parseReportDate(timestamp);
  if (!dt) return { utc: 'N/A', wat: 'N/A' };

  try {
    const utcStr = dt.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    // West Africa Time is UTC+1 (Nigeria standard time)
    const watOffsetMs = 60 * 60 * 1000;
    const watDate = new Date(dt.getTime() + watOffsetMs);
    const watStr = format(watDate, 'yyyy-MM-dd HH:mm:ss') + ' WAT';
    return { utc: utcStr, wat: watStr };
  } catch {
    return { utc: String(timestamp), wat: String(timestamp) };
  }
}

/**
 * Parse location details (State, LGA, Ward) from payload or Polling Unit ID
 */
export function resolveLocationDetails(report: Report): { state: string; lga: string; ward: string } {
  const payload = report.payload || {};
  let state = payload.state || '';
  let lga = payload.lga || '';
  let ward = payload.ward || '';

  // Attempt heuristic fallback from PU ID (e.g. OS/EJ/04/001)
  if ((!state || !lga) && report.pollingUnitId) {
    const parts = report.pollingUnitId.split(/[\/\-_]/);
    if (parts.length >= 2) {
      const code = parts[0].toUpperCase();
      if (STATE_CODE_MAP[code] && !state) {
        state = STATE_CODE_MAP[code];
      }
      if (parts[1] && !lga) {
        lga = parts[1];
      }
      if (parts[2] && !ward) {
        ward = `Ward ${parts[2]}`;
      }
    }
  }

  return {
    state: state || 'Osun', // Default monitored off-cycle state if undetermined
    lga: lga || 'Ejigbo',
    ward: ward || 'Ward 01'
  };
}

/**
 * Filters reports according to specified export options (date range, election level)
 */
export function filterReportsForExport(reports: Report[], options?: ExportOptions): Report[] {
  if (!options) return reports;

  const now = new Date();

  return reports.filter((r) => {
    // 1. Election level filter
    if (options.electionLevel && options.electionLevel !== 'all') {
      const level = r.payload?.electionLevel || 'governorship';
      if (level !== options.electionLevel) return false;
    }

    // 2. Date range filter
    if (options.dateRange && options.dateRange !== 'all') {
      const dt = parseReportDate(r.timestamp);
      if (!dt) return false;

      const diffMs = now.getTime() - dt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (options.dateRange === 'today') {
        const isToday = dt.getDate() === now.getDate() &&
                        dt.getMonth() === now.getMonth() &&
                        dt.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (options.dateRange === '24h') {
        if (diffHours > 24) return false;
      } else if (options.dateRange === '7d') {
        if (diffHours > 24 * 7) return false;
      }
    }

    return true;
  });
}

/**
 * Triggers automatic browser file download with UTF-8 BOM encoding for Excel compatibility
 */
export function triggerCSVDownload(filename: string, csvContent: string) {
  // Prepend UTF-8 Byte Order Mark (\uFEFF) so Excel, Google Sheets, and Numbers properly parse UTF-8 characters
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export 1: Structured Incident Reports Dataset
 * Tailored specifically for electoral violence, BVAS failures, vote-buying, and security analysis.
 */
export function exportIncidentReportsCSV(
  allReports: Report[],
  options: ExportOptions = {}
): { count: number; filename: string } {
  const filtered = filterReportsForExport(allReports, options);
  const incidentReports = filtered.filter((r) => r.type === 'incident');

  const headers = [
    'Report ID',
    'Incident Reference',
    'Polling Unit ID',
    'State',
    'LGA',
    'Ward',
    'Election Contest Level',
    'Incident Severity',
    'Incident Category Key',
    'Incident Category Label',
    'Security Operatives Notified',
    'Investigation Status',
    'Full Incident Description',
    'Observer ID',
    'Observer Display Name',
    'Observer Email',
    'PU Latitude',
    'PU Longitude',
    'Timestamp (UTC)',
    'Timestamp (Local WAT)',
    'Evidence Photos Count',
    'Evidence Photo URLs'
  ];

  const rows = incidentReports.map((r) => {
    const payload = r.payload || {};
    const loc = resolveLocationDetails(r);
    const times = formatReportTimestamps(r.timestamp);
    const observer = options.observerMap?.[r.observerId] || {};
    const incMeta = options.incidentMap?.[r.id] || {};

    const categoryKey = payload.incidentCategory || 'other';
    const categoryLabel = INCIDENT_CATEGORY_LABELS[categoryKey] || categoryKey;

    const securityKey = payload.securityNotified || 'none_present';
    const securityLabel = SECURITY_NOTIFIED_LABELS[securityKey] || securityKey;

    const mediaList = r.media || [];
    const mediaUrls = mediaList.map((m) => m.url).filter(Boolean).join('; ');

    const status = incMeta.status || payload.status || 'pending';

    return [
      formatCSVCell(r.id),
      formatCSVCell(incMeta.id || `INC-${r.id.substring(0, 8).toUpperCase()}`),
      formatCSVCell(r.pollingUnitId),
      formatCSVCell(loc.state),
      formatCSVCell(loc.lga),
      formatCSVCell(loc.ward),
      formatCSVCell(payload.electionLevel || 'governorship'),
      formatCSVCell((payload.severity || 'medium').toUpperCase()),
      formatCSVCell(categoryKey),
      formatCSVCell(categoryLabel),
      formatCSVCell(securityLabel),
      formatCSVCell(status.toUpperCase()),
      formatCSVCell(payload.description || ''),
      formatCSVCell(r.observerId || 'Unassigned'),
      formatCSVCell(observer.displayName || 'Field Observer'),
      formatCSVCell(observer.email || 'N/A'),
      formatCSVCell(r.location?.lat ?? ''),
      formatCSVCell(r.location?.lng ?? ''),
      formatCSVCell(times.utc),
      formatCSVCell(times.wat),
      formatCSVNumber(mediaList.length),
      formatCSVCell(mediaUrls)
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const timestampStr = format(new Date(), 'yyyyMMdd_HHmm');
  const filename = `${options.customFilenamePrefix || 'ivote_incidents_dataset'}_${timestampStr}.csv`;

  triggerCSVDownload(filename, csvContent);
  return { count: incidentReports.length, filename };
}

/**
 * Export 2: Structured Accreditation & Voter Turnout Dataset
 * Tailored specifically for voter turnout, BVAS operational health, queue delays, and flow modeling.
 */
export function exportAccreditationReportsCSV(
  allReports: Report[],
  options: ExportOptions = {}
): { count: number; filename: string } {
  const filtered = filterReportsForExport(allReports, options);
  const accreditationReports = filtered.filter((r) => r.type === 'accreditation');

  const headers = [
    'Report ID',
    'Polling Unit ID',
    'State',
    'LGA',
    'Ward',
    'Election Contest Level',
    'BVAS Accredited Voter Count',
    'BVAS Hardware Status Key',
    'BVAS Hardware Operational Health',
    'Queue Crowd Size Key',
    'Queue Crowd Size Estimate',
    'Observation & Queue Notes',
    'Observer ID',
    'Observer Display Name',
    'Observer Email',
    'PU Latitude',
    'PU Longitude',
    'Timestamp (UTC)',
    'Timestamp (Local WAT)',
    'Evidence Photos Count',
    'Evidence Photo URLs'
  ];

  const rows = accreditationReports.map((r) => {
    const payload = r.payload || {};
    const loc = resolveLocationDetails(r);
    const times = formatReportTimestamps(r.timestamp);
    const observer = options.observerMap?.[r.observerId] || {};

    const bvasKey = payload.bvasStatus || 'functioning';
    const bvasLabel = BVAS_STATUS_LABELS[bvasKey] || bvasKey;

    const queueKey = payload.queueSize || 'medium';
    const queueLabel = QUEUE_SIZE_LABELS[queueKey] || queueKey;

    const voterCount = typeof payload.voterCount === 'number' && !isNaN(payload.voterCount)
      ? payload.voterCount
      : 0;

    const mediaList = r.media || [];
    const mediaUrls = mediaList.map((m) => m.url).filter(Boolean).join('; ');

    return [
      formatCSVCell(r.id),
      formatCSVCell(r.pollingUnitId),
      formatCSVCell(loc.state),
      formatCSVCell(loc.lga),
      formatCSVCell(loc.ward),
      formatCSVCell(payload.electionLevel || 'governorship'),
      formatCSVNumber(voterCount),
      formatCSVCell(bvasKey),
      formatCSVCell(bvasLabel),
      formatCSVCell(queueKey),
      formatCSVCell(queueLabel),
      formatCSVCell(payload.description || ''),
      formatCSVCell(r.observerId || 'Unassigned'),
      formatCSVCell(observer.displayName || 'Field Observer'),
      formatCSVCell(observer.email || 'N/A'),
      formatCSVCell(r.location?.lat ?? ''),
      formatCSVCell(r.location?.lng ?? ''),
      formatCSVCell(times.utc),
      formatCSVCell(times.wat),
      formatCSVNumber(mediaList.length),
      formatCSVCell(mediaUrls)
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const timestampStr = format(new Date(), 'yyyyMMdd_HHmm');
  const filename = `${options.customFilenamePrefix || 'ivote_accreditation_turnout_dataset'}_${timestampStr}.csv`;

  triggerCSVDownload(filename, csvContent);
  return { count: accreditationReports.length, filename };
}

/**
 * Export 3: Master Comprehensive Electoral Dataset
 * Comprehensive multi-dimensional extract containing both Incident and Accreditation fields,
 * plus Official Ballot Result tallies.
 */
export function exportMasterReportsCSV(
  allReports: Report[],
  options: ExportOptions = {}
): { count: number; filename: string } {
  const filtered = filterReportsForExport(allReports, options);

  const headers = [
    'Report ID',
    'Report Type',
    'Polling Unit ID',
    'State',
    'LGA',
    'Ward',
    'Election Level',
    'Timestamp (UTC)',
    'Timestamp (Local WAT)',
    'Observer ID',
    'Observer Name',
    'Observer Email',
    'Accredited Voters (BVAS)',
    'BVAS Hardware Health',
    'Queue Size Estimate',
    'Incident Severity',
    'Incident Category',
    'Security Personnel Alerted',
    'Incident Status',
    'APC Votes',
    'PDP Votes',
    'LP Votes',
    'NNPP Votes',
    'Other Votes',
    'Total Form EC8A Votes',
    'Observation Details / Notes',
    'Latitude',
    'Longitude',
    'Evidence Attachments Count',
    'Evidence URLs'
  ];

  const rows = filtered.map((r) => {
    const payload = r.payload || {};
    const loc = resolveLocationDetails(r);
    const times = formatReportTimestamps(r.timestamp);
    const observer = options.observerMap?.[r.observerId] || {};
    const incMeta = options.incidentMap?.[r.id] || {};

    const bvasLabel = payload.bvasStatus ? (BVAS_STATUS_LABELS[payload.bvasStatus] || payload.bvasStatus) : '';
    const queueLabel = payload.queueSize ? (QUEUE_SIZE_LABELS[payload.queueSize] || payload.queueSize) : '';
    const incCatLabel = payload.incidentCategory ? (INCIDENT_CATEGORY_LABELS[payload.incidentCategory] || payload.incidentCategory) : '';
    const secLabel = payload.securityNotified ? (SECURITY_NOTIFIED_LABELS[payload.securityNotified] || payload.securityNotified) : '';
    const incStatus = r.type === 'incident' ? (incMeta.status || payload.status || 'pending').toUpperCase() : '';

    const mediaList = r.media || [];
    const mediaUrls = mediaList.map((m) => m.url).filter(Boolean).join('; ');

    return [
      formatCSVCell(r.id),
      formatCSVCell(r.type.toUpperCase()),
      formatCSVCell(r.pollingUnitId),
      formatCSVCell(loc.state),
      formatCSVCell(loc.lga),
      formatCSVCell(loc.ward),
      formatCSVCell(payload.electionLevel || 'governorship'),
      formatCSVCell(times.utc),
      formatCSVCell(times.wat),
      formatCSVCell(r.observerId || 'Unassigned'),
      formatCSVCell(observer.displayName || 'Field Observer'),
      formatCSVCell(observer.email || 'N/A'),
      r.type === 'accreditation' ? formatCSVNumber(payload.voterCount ?? 0) : '""',
      formatCSVCell(bvasLabel),
      formatCSVCell(queueLabel),
      formatCSVCell(payload.severity ? payload.severity.toUpperCase() : ''),
      formatCSVCell(incCatLabel),
      formatCSVCell(secLabel),
      formatCSVCell(incStatus),
      r.type === 'result' ? formatCSVNumber(payload.apcVotes ?? 0) : '""',
      r.type === 'result' ? formatCSVNumber(payload.pdpVotes ?? 0) : '""',
      r.type === 'result' ? formatCSVNumber(payload.lpVotes ?? 0) : '""',
      r.type === 'result' ? formatCSVNumber(payload.nnppVotes ?? 0) : '""',
      r.type === 'result' ? formatCSVNumber(payload.otherVotes ?? 0) : '""',
      r.type === 'result' ? formatCSVNumber(payload.totalVotes ?? (payload.voterCount ?? 0)) : '""',
      formatCSVCell(payload.description || ''),
      formatCSVCell(r.location?.lat ?? ''),
      formatCSVCell(r.location?.lng ?? ''),
      formatCSVNumber(mediaList.length),
      formatCSVCell(mediaUrls)
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const timestampStr = format(new Date(), 'yyyyMMdd_HHmm');
  const filename = `${options.customFilenamePrefix || 'ivote_master_reports_dataset'}_${timestampStr}.csv`;

  triggerCSVDownload(filename, csvContent);
  return { count: filtered.length, filename };
}

/**
 * Export 4: Aggregated Polling Station Telemetry & Incident Analysis Dataset
 * Generates an offline analysis-ready table where each row is a distinct Polling Station,
 * capturing submission counts, incident severities, voter accreditation numbers, BVAS health,
 * and Form EC8A vote totals.
 */
export function exportPollingStationsCSV(
  allReports: Report[],
  options: ExportOptions = {}
): { count: number; filename: string } {
  const filtered = filterReportsForExport(allReports, options);

  interface AggregatedStation {
    id: string;
    name: string;
    state: string;
    lga: string;
    ward: string;
    reportsCount: number;
    accreditationCount: number;
    incidentCount: number;
    resultCount: number;
    bvasAccreditedTotal: number;
    latestBvasStatus: string;
    latestQueueSize: string;
    criticalIncidents: number;
    highIncidents: number;
    mediumLowIncidents: number;
    incidentCategories: Set<string>;
    incidentStatuses: Set<string>;
    hasResults: boolean;
    apcVotes: number;
    pdpVotes: number;
    lpVotes: number;
    nnppVotes: number;
    otherVotes: number;
    totalVotes: number;
    lat: number | null;
    lng: number | null;
    observers: Set<string>;
    firstTimestamp: Date | null;
    latestTimestamp: Date | null;
  }

  const stationMap: Record<string, AggregatedStation> = {};

  // First seed baseline stations if in Osun state context
  Object.entries(KNOWN_STATION_NAMES).forEach(([id, meta]) => {
    stationMap[id] = {
      id,
      name: meta.name,
      state: 'Osun',
      lga: meta.lga,
      ward: meta.ward,
      reportsCount: 0,
      accreditationCount: 0,
      incidentCount: 0,
      resultCount: 0,
      bvasAccreditedTotal: 0,
      latestBvasStatus: 'N/A',
      latestQueueSize: 'N/A',
      criticalIncidents: 0,
      highIncidents: 0,
      mediumLowIncidents: 0,
      incidentCategories: new Set(),
      incidentStatuses: new Set(),
      hasResults: false,
      apcVotes: 0,
      pdpVotes: 0,
      lpVotes: 0,
      nnppVotes: 0,
      otherVotes: 0,
      totalVotes: 0,
      lat: null,
      lng: null,
      observers: new Set(),
      firstTimestamp: null,
      latestTimestamp: null
    };
  });

  // Now aggregate all reports
  filtered.forEach((r) => {
    const rawId = (r.pollingUnitId || 'Unknown PU').trim();
    const loc = resolveLocationDetails(r);
    const date = parseReportDate(r.timestamp);
    const payload = r.payload || {};

    if (!stationMap[rawId]) {
      const known = KNOWN_STATION_NAMES[rawId];
      stationMap[rawId] = {
        id: rawId,
        name: known?.name || payload.pollingUnitName || `Polling Station ${rawId}`,
        state: loc.state,
        lga: loc.lga,
        ward: loc.ward,
        reportsCount: 0,
        accreditationCount: 0,
        incidentCount: 0,
        resultCount: 0,
        bvasAccreditedTotal: 0,
        latestBvasStatus: 'N/A',
        latestQueueSize: 'N/A',
        criticalIncidents: 0,
        highIncidents: 0,
        mediumLowIncidents: 0,
        incidentCategories: new Set(),
        incidentStatuses: new Set(),
        hasResults: false,
        apcVotes: 0,
        pdpVotes: 0,
        lpVotes: 0,
        nnppVotes: 0,
        otherVotes: 0,
        totalVotes: 0,
        lat: null,
        lng: null,
        observers: new Set(),
        firstTimestamp: null,
        latestTimestamp: null
      };
    }

    const st = stationMap[rawId];
    st.reportsCount += 1;

    // Record observer
    if (r.observerId) {
      const obs = options.observerMap?.[r.observerId];
      st.observers.add(obs?.displayName || obs?.email || r.observerId);
    }

    // Record geo coordinates
    if (r.location?.lat && r.location?.lng) {
      st.lat = r.location.lat;
      st.lng = r.location.lng;
    }

    // Record timestamps
    if (date) {
      if (!st.firstTimestamp || date < st.firstTimestamp) {
        st.firstTimestamp = date;
      }
      if (!st.latestTimestamp || date > st.latestTimestamp) {
        st.latestTimestamp = date;
      }
    }

    // Type specific breakdown
    if (r.type === 'incident') {
      st.incidentCount += 1;
      const sev = (payload.severity || 'medium').toLowerCase();
      if (sev === 'critical') st.criticalIncidents += 1;
      else if (sev === 'high') st.highIncidents += 1;
      else st.mediumLowIncidents += 1;

      if (payload.incidentCategory) {
        const catLabel = INCIDENT_CATEGORY_LABELS[payload.incidentCategory] || payload.incidentCategory;
        st.incidentCategories.add(catLabel);
      }

      const incMeta = options.incidentMap?.[r.id];
      const status = incMeta?.status || payload.status || 'pending';
      st.incidentStatuses.add(status.toUpperCase());
    } else if (r.type === 'accreditation') {
      st.accreditationCount += 1;
      if (typeof payload.voterCount === 'number' && !isNaN(payload.voterCount)) {
        st.bvasAccreditedTotal = Math.max(st.bvasAccreditedTotal, payload.voterCount);
      }
      if (payload.bvasStatus) {
        st.latestBvasStatus = BVAS_STATUS_LABELS[payload.bvasStatus] || payload.bvasStatus;
      }
      if (payload.queueSize) {
        st.latestQueueSize = QUEUE_SIZE_LABELS[payload.queueSize] || payload.queueSize;
      }
    } else if (r.type === 'result') {
      st.resultCount += 1;
      st.hasResults = true;
      st.apcVotes = payload.apcVotes ?? st.apcVotes;
      st.pdpVotes = payload.pdpVotes ?? st.pdpVotes;
      st.lpVotes = payload.lpVotes ?? st.lpVotes;
      st.nnppVotes = payload.nnppVotes ?? st.nnppVotes;
      st.otherVotes = payload.otherVotes ?? st.otherVotes;
      st.totalVotes = payload.totalVotes ?? (payload.apcVotes + payload.pdpVotes + payload.lpVotes + payload.nnppVotes + (payload.otherVotes || 0));
    }
  });

  const stationList = Object.values(stationMap);

  const headers = [
    'Polling Unit Code / ID',
    'Polling Unit Name',
    'State',
    'LGA',
    'Ward',
    'Total Telemetry Reports',
    'Accreditation Reports Count',
    'BVAS Peak Accredited Voters',
    'Latest BVAS Machine Status',
    'Latest Voter Queue Condition',
    'Total Incidents Flagged',
    'Critical Incidents Count',
    'High Incidents Count',
    'Medium/Low Incidents Count',
    'Reported Incident Categories',
    'Incident Investigation Statuses',
    'Official Form EC8A Results Received',
    'APC Votes',
    'PDP Votes',
    'LP Votes',
    'NNPP Votes',
    'Other Parties Votes',
    'Total Valid Votes',
    'Leading / Winner Party',
    'Operational Security Status',
    'Latitude',
    'Longitude',
    'Assigned Active Observers Count',
    'Observer Personnel',
    'First Telemetry Timestamp (WAT)',
    'Latest Telemetry Timestamp (WAT)',
    'First Telemetry Timestamp (UTC)',
    'Latest Telemetry Timestamp (UTC)'
  ];

  const rows = stationList.map((st) => {
    // Determine winner/leading party
    let leadingParty = 'N/A';
    if (st.hasResults && st.totalVotes > 0) {
      const tallies = [
        { party: 'APC', votes: st.apcVotes },
        { party: 'PDP', votes: st.pdpVotes },
        { party: 'LP', votes: st.lpVotes },
        { party: 'NNPP', votes: st.nnppVotes },
      ];
      tallies.sort((a, b) => b.votes - a.votes);
      if (tallies[0].votes > 0) {
        leadingParty = `${tallies[0].party} (${tallies[0].votes} votes)`;
      }
    }

    // Operational risk classification
    let operationalStatus = 'NORMAL - Active Observation';
    if (st.criticalIncidents > 0 || st.incidentCount >= 2) {
      operationalStatus = 'CRITICAL ALERT - Severe Electoral Irregularities';
    } else if (st.incidentCount > 0) {
      operationalStatus = 'ELEVATED - Incident Under Investigation';
    } else if (st.reportsCount === 0) {
      operationalStatus = 'AWAITING TELEMETRY - Baseline Station';
    } else if (st.hasResults) {
      operationalStatus = 'RESOLVED - Official PU Results Logged';
    }

    const firstTimeWat = st.firstTimestamp ? formatReportTimestamps(st.firstTimestamp).wat : 'N/A';
    const latestTimeWat = st.latestTimestamp ? formatReportTimestamps(st.latestTimestamp).wat : 'N/A';
    const firstTimeUtc = st.firstTimestamp ? formatReportTimestamps(st.firstTimestamp).utc : 'N/A';
    const latestTimeUtc = st.latestTimestamp ? formatReportTimestamps(st.latestTimestamp).utc : 'N/A';

    return [
      formatCSVCell(st.id),
      formatCSVCell(st.name),
      formatCSVCell(st.state),
      formatCSVCell(st.lga),
      formatCSVCell(st.ward),
      formatCSVNumber(st.reportsCount),
      formatCSVNumber(st.accreditationCount),
      formatCSVNumber(st.bvasAccreditedTotal),
      formatCSVCell(st.latestBvasStatus),
      formatCSVCell(st.latestQueueSize),
      formatCSVNumber(st.incidentCount),
      formatCSVNumber(st.criticalIncidents),
      formatCSVNumber(st.highIncidents),
      formatCSVNumber(st.mediumLowIncidents),
      formatCSVCell(Array.from(st.incidentCategories).join('; ') || 'None'),
      formatCSVCell(Array.from(st.incidentStatuses).join(', ') || 'None'),
      formatCSVCell(st.hasResults ? 'YES' : 'NO'),
      formatCSVNumber(st.hasResults ? st.apcVotes : ''),
      formatCSVNumber(st.hasResults ? st.pdpVotes : ''),
      formatCSVNumber(st.hasResults ? st.lpVotes : ''),
      formatCSVNumber(st.hasResults ? st.nnppVotes : ''),
      formatCSVNumber(st.hasResults ? st.otherVotes : ''),
      formatCSVNumber(st.hasResults ? st.totalVotes : ''),
      formatCSVCell(leadingParty),
      formatCSVCell(operationalStatus),
      formatCSVCell(st.lat ?? ''),
      formatCSVCell(st.lng ?? ''),
      formatCSVNumber(st.observers.size),
      formatCSVCell(Array.from(st.observers).join('; ') || 'Unassigned'),
      formatCSVCell(firstTimeWat),
      formatCSVCell(latestTimeWat),
      formatCSVCell(firstTimeUtc),
      formatCSVCell(latestTimeUtc)
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const timestampStr = format(new Date(), 'yyyyMMdd_HHmm');
  const filename = `${options.customFilenamePrefix || 'ivote_polling_stations_dataset'}_${timestampStr}.csv`;

  triggerCSVDownload(filename, csvContent);
  return { count: stationList.length, filename };
}
