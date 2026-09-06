import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ComposedChart
} from 'recharts';
import { 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  Flame, 
  ShieldAlert, 
  Activity, 
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { Incident } from '../../types';
import { format } from 'date-fns';

interface IncidentHourlyTrendChartProps {
  incidents: Incident[];
  className?: string;
}

type ViewMode = 'volume' | 'severity' | 'cumulative';

interface HourlyDataPoint {
  hourLabel: string;      // e.g. "08:00"
  timeSlot: string;       // e.g. "08:00 - 09:00"
  hour24: number;         // 8
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  cumulative: number;
  electionPhase: string;  // e.g. "Accreditation & Voting"
}

// Key election day phases for context
const ELECTION_PHASES: Record<number, string> = {
  6: 'Station Setup & Logistics',
  7: 'Queue Arrival & Inspection',
  8: 'Polls Open & Accreditation',
  9: 'Morning Voter Accreditation',
  10: 'Peak Voting & BVAS Checks',
  11: 'Midday Balloting',
  12: 'Afternoon Voting',
  13: 'Pre-Close Queue Verification',
  14: 'Polls Close & Queue Admittance',
  15: 'Ballot Sorting & Reconciliation',
  16: 'Vote Counting at Polling Units',
  17: 'PU Result Announcement',
  18: 'Ward Collation Centre Inflow',
  19: 'Ward Collation Processing',
  20: 'LGA Collation Inflow',
  21: 'LGA Result Harmonization',
  22: 'Late Collation Monitoring'
};

// Realistic Osun State Election Day modeled distribution (used as baseline or when live count is zero)
const OSUN_BASELINE_INCIDENTS = [
  { hour: 7, severity: 'low' as const, description: 'Logistical setup delay' },
  { hour: 8, severity: 'medium' as const, description: 'Delayed arrival of poll officials' },
  { hour: 8, severity: 'low' as const, description: 'Canopy damaged by morning winds' },
  { hour: 9, severity: 'high' as const, description: 'BVAS biometric facial match timeout' },
  { hour: 9, severity: 'medium' as const, description: 'Voter queue congestion' },
  { hour: 10, severity: 'critical' as const, description: 'Ballot box interference report' },
  { hour: 10, severity: 'high' as const, description: 'Agent accreditation challenge' },
  { hour: 10, severity: 'medium' as const, description: 'Indelible ink pen replenishment required' },
  { hour: 11, severity: 'high' as const, description: 'Suspected vote solicitation outside perimeter' },
  { hour: 11, severity: 'medium' as const, description: 'Voter card reader backup battery deployed' },
  { hour: 11, severity: 'medium' as const, description: 'Crowd control support requested' },
  { hour: 12, severity: 'critical' as const, description: 'Security personnel dispatched for perimeter disorder' },
  { hour: 12, severity: 'medium' as const, description: 'Accreditation queue clarification' },
  { hour: 13, severity: 'low' as const, description: 'Elderly voter accessibility assistance' },
  { hour: 14, severity: 'high' as const, description: '2:30 PM queue cutoff dispute' },
  { hour: 14, severity: 'medium' as const, description: 'Official queue demarcation protocol' },
  { hour: 15, severity: 'critical' as const, description: 'Ballot sorting count audit dispute' },
  { hour: 15, severity: 'medium' as const, description: 'Reconciling unused ballot paper serials' },
  { hour: 16, severity: 'medium' as const, description: 'Form EC8A duplication audit' },
  { hour: 17, severity: 'low' as const, description: 'PU result announcement verification' },
  { hour: 18, severity: 'high' as const, description: 'Escort vehicle dispatch delay to Ward Collation' },
  { hour: 19, severity: 'medium' as const, description: 'Generator power failover at Collation Center' },
];

export default function IncidentHourlyTrendChart({
  incidents,
  className = ''
}: IncidentHourlyTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('volume');
  const [dataSelection, setDataSelection] = useState<'auto' | 'live' | 'modeled'>('auto');

  // Determine whether to show live data or modeled baseline
  const isUsingModeledData = useMemo(() => {
    if (dataSelection === 'modeled') return true;
    if (dataSelection === 'live') return false;
    return incidents.length === 0;
  }, [dataSelection, incidents.length]);

  // Generate hourly data across election timeline (06:00 to 22:00)
  const { hourlyData, stats } = useMemo(() => {
    // Standard election timeline: 06:00 to 22:00 (17 hours)
    const hours = Array.from({ length: 17 }, (_, i) => i + 6);

    // Bucket counts by hour
    const buckets: Record<number, { critical: number; high: number; medium: number; low: number; total: number }> = {};
    hours.forEach(h => {
      buckets[h] = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
    });

    let totalCritical = 0;
    let totalHigh = 0;
    let totalMedium = 0;
    let totalLow = 0;

    if (isUsingModeledData) {
      OSUN_BASELINE_INCIDENTS.forEach(item => {
        const targetHour = (item.hour >= 6 && item.hour <= 22) ? item.hour : 11;
        if (!buckets[targetHour]) {
          buckets[targetHour] = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
        }
        buckets[targetHour].total += 1;
        if (item.severity === 'critical') {
          buckets[targetHour].critical += 1;
          totalCritical += 1;
        } else if (item.severity === 'high') {
          buckets[targetHour].high += 1;
          totalHigh += 1;
        } else if (item.severity === 'medium') {
          buckets[targetHour].medium += 1;
          totalMedium += 1;
        } else {
          buckets[targetHour].low += 1;
          totalLow += 1;
        }
      });
    } else {
      incidents.forEach(inc => {
        let hour: number | null = null;
        if (inc.timestamp) {
          try {
            const d = (inc.timestamp as any)?.toDate 
              ? (inc.timestamp as any).toDate() 
              : new Date(inc.timestamp as any);
            if (!isNaN(d.getTime())) {
              hour = d.getHours();
            }
          } catch {
            hour = null;
          }
        }

        const targetHour = (hour !== null && hour >= 6 && hour <= 22) ? hour : 11;
        const sev = inc.severity || 'low';

        if (!buckets[targetHour]) {
          buckets[targetHour] = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
        }

        buckets[targetHour].total += 1;
        if (sev === 'critical') {
          buckets[targetHour].critical += 1;
          totalCritical += 1;
        } else if (sev === 'high') {
          buckets[targetHour].high += 1;
          totalHigh += 1;
        } else if (sev === 'medium') {
          buckets[targetHour].medium += 1;
          totalMedium += 1;
        } else {
          buckets[targetHour].low += 1;
          totalLow += 1;
        }
      });
    }

    // Calculate cumulative counts and construct chart series
    let runningCumulative = 0;
    let peakHour = 6;
    let peakCount = -1;

    const data: HourlyDataPoint[] = hours.map(h => {
      const b = buckets[h] || { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
      runningCumulative += b.total;

      if (b.total > peakCount) {
        peakCount = b.total;
        peakHour = h;
      }

      const hFormatted = `${String(h).padStart(2, '0')}:00`;
      const nextHFormatted = `${String(h + 1).padStart(2, '0')}:00`;

      return {
        hourLabel: hFormatted,
        timeSlot: `${hFormatted} - ${nextHFormatted}`,
        hour24: h,
        total: b.total,
        critical: b.critical,
        high: b.high,
        medium: b.medium,
        low: b.low,
        cumulative: runningCumulative,
        electionPhase: ELECTION_PHASES[h] || 'Collation & Transmission'
      };
    });

    const totalIncidentsCount = isUsingModeledData ? OSUN_BASELINE_INCIDENTS.length : incidents.length;
    const avgPerHour = hours.length > 0 ? (totalIncidentsCount / hours.length).toFixed(1) : '0.0';

    return {
      hourlyData: data,
      stats: {
        total: totalIncidentsCount,
        critical: totalCritical,
        high: totalHigh,
        medium: totalMedium,
        low: totalLow,
        peakHourLabel: `${String(peakHour).padStart(2, '0')}:00`,
        peakCount,
        avgPerHour,
        highCriticalRatio: totalIncidentsCount > 0 
          ? Math.round(((totalCritical + totalHigh) / totalIncidentsCount) * 100)
          : 0
      }
    };
  }, [incidents, isUsingModeledData]);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item: HourlyDataPoint = payload[0]?.payload;
    if (!item) return null;

    return (
      <div className="bg-slate-950/95 text-white p-4 rounded-2xl shadow-xl border border-slate-800 text-xs backdrop-blur-md max-w-xs space-y-2.5">
        <div className="border-b border-slate-800 pb-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono font-bold text-sm text-emerald-400">{item.timeSlot}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-300">
              {item.electionPhase}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300 font-semibold">Incoming Reports:</span>
            <span className="font-extrabold font-mono text-white text-base">{item.total}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/70 text-[11px]">
            <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-red-950/60 border border-red-900/60 text-red-300">
              <span>Critical:</span>
              <span className="font-mono font-bold text-white">{item.critical}</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-orange-950/60 border border-orange-900/60 text-orange-300">
              <span>High:</span>
              <span className="font-mono font-bold text-white">{item.high}</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-amber-950/60 border border-amber-900/60 text-amber-300">
              <span>Medium:</span>
              <span className="font-mono font-bold text-white">{item.medium}</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-blue-950/60 border border-blue-900/60 text-blue-300">
              <span>Low:</span>
              <span className="font-mono font-bold text-white">{item.low}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80">
            <span>Cumulative Day Total:</span>
            <span className="font-mono font-bold text-emerald-400">{item.cumulative}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-xs ${className}`}>
      {/* Header: Title, Live Trend Badge, and Analytical View Toggles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 font-serif tracking-tight">
              Hourly Incident Inflow & Escalation Trend
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100/70 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
              Election Day Dynamics
            </span>
          </div>
          <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
            Temporal distribution of field incident reports across election phases (06:00 - 22:00). Identifies peak stress periods during accreditation, voting, and ward collation.
          </p>
        </div>

        {/* View Controls & Toggles */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {incidents.length > 0 && (
            <div className="inline-flex p-1 bg-gray-100 rounded-2xl border border-gray-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDataSelection('live')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  !isUsingModeledData
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Plot real-time incident reports received from field observers"
              >
                Live Feed ({incidents.length})
              </button>
              <button
                type="button"
                onClick={() => setDataSelection('modeled')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isUsingModeledData
                    ? 'bg-white text-gray-900 shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Plot full election day benchmark model across all phases"
              >
                Benchmark Model
              </button>
            </div>
          )}

          {incidents.length === 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Election Day Baseline Model Active</span>
            </span>
          )}

          <div className="inline-flex p-1 bg-gray-100 rounded-2xl border border-gray-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('volume')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'volume'
                  ? 'bg-white text-gray-900 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Inflow Rate
            </button>
            <button
              type="button"
              onClick={() => setViewMode('severity')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'severity'
                  ? 'bg-white text-gray-900 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              By Severity
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cumulative')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'cumulative'
                  ? 'bg-white text-gray-900 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Cumulative
            </button>
          </div>
        </div>
      </div>

      {/* Analytical KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
        <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
          <div className="flex items-center justify-between text-gray-500 text-xs mb-1">
            <span>Total Logged</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 font-mono tracking-tight">
            {stats.total}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Reported field incidents</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80">
          <div className="flex items-center justify-between text-amber-800 text-xs mb-1">
            <span className="font-medium">Peak Inflow Hour</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-900 font-mono tracking-tight">
            {stats.peakHourLabel}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5">
            {stats.peakCount} report{stats.peakCount === 1 ? '' : 's'} received
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-red-50/60 border border-red-200/80">
          <div className="flex items-center justify-between text-red-800 text-xs mb-1">
            <span className="font-medium">High / Critical</span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-red-900 font-mono tracking-tight">
            {stats.critical + stats.high}
            <span className="text-xs font-normal text-red-700 ml-1.5">
              ({stats.highCriticalRatio}%)
            </span>
          </p>
          <p className="text-[11px] text-red-700 mt-0.5">Urgent intervention tier</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/80">
          <div className="flex items-center justify-between text-blue-800 text-xs mb-1">
            <span className="font-medium">Average Velocity</span>
            <Flame className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-900 font-mono tracking-tight">
            {stats.avgPerHour}
            <span className="text-xs font-normal text-blue-700 ml-1">/hr</span>
          </p>
          <p className="text-[11px] text-blue-700 mt-0.5">Normalized reporting pace</p>
        </div>
      </div>

      {/* Main Recharts Line Visualization Container */}
      <div className="w-full relative min-h-[260px] sm:min-h-[280px] md:min-h-[300px] aspect-[16/9] sm:aspect-[2/1] lg:aspect-[21/9] max-h-[360px] my-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={hourlyData}
            margin={{ top: 12, right: 16, left: -20, bottom: 4 }}
          >
            <defs>
              {/* Gradient for Inflow Volume Area */}
              <linearGradient id="incidentInflowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>

              {/* Gradient for Cumulative Area */}
              <linearGradient id="incidentCumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="hourLabel"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval="preserveStartEnd"
            />

            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              domain={[0, 'auto']}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Inflow Rate View: Primary Area + Line */}
            {viewMode === 'volume' && (
              <>
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Incoming Incidents"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#incidentInflowGradient)"
                  dot={{ r: 3.5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="critical"
                  name="Critical Alerts"
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#dc2626' }}
                />
              </>
            )}

            {/* By Severity View: Multi-line comparison */}
            {viewMode === 'severity' && (
              <>
                <Line
                  type="monotone"
                  dataKey="critical"
                  name="Critical (Emergency)"
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#dc2626' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  name="High Severity"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f97316' }}
                />
                <Line
                  type="monotone"
                  dataKey="medium"
                  name="Medium (Disruptions)"
                  stroke="#f59e0b"
                  strokeWidth={1.75}
                  dot={{ r: 2.5, fill: '#f59e0b' }}
                />
                <Line
                  type="monotone"
                  dataKey="low"
                  name="Low / Procedural"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  dot={{ r: 2, fill: '#3b82f6' }}
                />
              </>
            )}

            {/* Cumulative View: Running Total Curve */}
            {viewMode === 'cumulative' && (
              <Area
                type="monotone"
                dataKey="cumulative"
                name="Cumulative Total"
                stroke="#0284c7"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#incidentCumulativeGradient)"
                dot={{ r: 3.5, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#0369a1', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Timeline Context Footer */}
      <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-4 flex-wrap">
          {viewMode === 'volume' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 rounded-full bg-emerald-600" />
                <span className="font-semibold text-gray-700">Total Inflow Rate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-red-600" />
                <span className="font-semibold text-red-700">Critical Alerts Subset</span>
              </div>
            </>
          )}

          {viewMode === 'severity' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                <span className="text-gray-700 font-semibold">Critical</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-gray-700 font-semibold">High</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-gray-700 font-semibold">Medium</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-gray-700 font-semibold">Low</span>
              </div>
            </>
          )}

          {viewMode === 'cumulative' && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-sky-600" />
              <span className="font-semibold text-gray-700">Cumulative Day-Long Incidents Count</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-gray-400">
          <Info className="w-3.5 h-3.5" />
          <span>Timeline synchronized with Osun Standard Time (WAT / UTC+1)</span>
        </div>
      </div>
    </div>
  );
}
