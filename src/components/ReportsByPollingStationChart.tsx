import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import { 
  BarChart3, 
  Building2, 
  Layers, 
  ShieldAlert, 
  CheckCircle2, 
  MapPin, 
  RotateCcw, 
  ArrowUpDown, 
  ChevronDown, 
  ChevronUp,
  FileText,
  Users,
  Activity
} from 'lucide-react';
import { Report } from '../types';

interface ReportsByPollingStationChartProps {
  reports: Report[];
  selectedStation?: string;
  onSelectStation?: (stationId: string) => void;
  className?: string;
}

type ChartMode = 'stacked' | 'total';
type ChartLayout = 'vertical' | 'horizontal'; // 'vertical' = horizontal bars (Y axis is station); 'horizontal' = vertical columns
type SortOption = 'volume_desc' | 'volume_asc' | 'incidents_desc' | 'station_asc';

interface StationStat {
  station: string;
  cleanStation: string;
  total: number;
  accreditation: number;
  incident: number;
  result: number;
  other: number;
  lastTimestamp?: Date | null;
}

const COLOR_MAP = {
  accreditation: '#2563eb', // Blue 600
  incident: '#e11d48',      // Rose 600
  result: '#059669',        // Emerald 600
  other: '#9333ea',         // Purple 600
  total: '#0f766e',         // Teal 700
};

export default function ReportsByPollingStationChart({
  reports,
  selectedStation = '',
  onSelectStation,
  className = ''
}: ReportsByPollingStationChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('stacked');
  const [chartLayout, setChartLayout] = useState<ChartLayout>('vertical');
  const [sortOption, setSortOption] = useState<SortOption>('volume_desc');
  const [displayLimit, setDisplayLimit] = useState<number>(10);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Aggregate and calculate distribution of reports by polling station
  const { 
    stationStats, 
    totalUniqueStations, 
    peakStation, 
    totalIncidentCount,
    avgReportsPerStation 
  } = useMemo(() => {
    const stationMap: Record<string, StationStat> = {};

    reports.forEach((r) => {
      const pu = (r.pollingUnitId || 'Unknown PU').trim();
      if (!stationMap[pu]) {
        // Format display name: if long path like OS/EJ/04/001 or PU-OS-01/01/01/001, keep clear
        stationMap[pu] = {
          station: pu,
          cleanStation: pu.length > 18 ? `${pu.slice(0, 8)}...${pu.slice(-6)}` : pu,
          total: 0,
          accreditation: 0,
          incident: 0,
          result: 0,
          other: 0,
          lastTimestamp: null
        };
      }

      stationMap[pu].total += 1;
      if (r.type === 'accreditation') {
        stationMap[pu].accreditation += 1;
      } else if (r.type === 'incident') {
        stationMap[pu].incident += 1;
      } else if (r.type === 'result') {
        stationMap[pu].result += 1;
      } else {
        stationMap[pu].other += 1;
      }

      if ((r.timestamp as any)?.toDate) {
        const d = (r.timestamp as any).toDate();
        if (!stationMap[pu].lastTimestamp || d > stationMap[pu].lastTimestamp!) {
          stationMap[pu].lastTimestamp = d;
        }
      }
    });

    const list = Object.values(stationMap);

    // Apply sorting
    list.sort((a, b) => {
      switch (sortOption) {
        case 'volume_desc':
          return b.total - a.total || a.station.localeCompare(b.station);
        case 'volume_asc':
          return a.total - b.total || a.station.localeCompare(b.station);
        case 'incidents_desc':
          return b.incident - a.incident || b.total - a.total;
        case 'station_asc':
          return a.station.localeCompare(b.station);
        default:
          return b.total - a.total;
      }
    });

    const totalStations = list.length;
    let peak: StationStat | null = null;
    let incCount = 0;
    let sumReports = 0;

    list.forEach(st => {
      sumReports += st.total;
      incCount += st.incident;
      if (!peak || st.total > peak.total) {
        peak = st;
      }
    });

    const avg = totalStations > 0 ? (sumReports / totalStations).toFixed(1) : '0';

    return {
      stationStats: list,
      totalUniqueStations: totalStations,
      peakStation: peak,
      totalIncidentCount: incCount,
      avgReportsPerStation: avg
    };
  }, [reports, sortOption]);

  // Sliced data based on display limit
  const visibleData = useMemo(() => {
    if (displayLimit === 0) return stationStats;
    return stationStats.slice(0, displayLimit);
  }, [stationStats, displayLimit]);

  // Calculate dynamic container height when in vertical layout (horizontal bars)
  const chartHeight = useMemo(() => {
    if (chartLayout === 'vertical') {
      // Allow 36px per station bar + margin, min 280px, max 600px
      const calculated = Math.max(280, Math.min(600, visibleData.length * 36 + 60));
      return calculated;
    }
    return 320;
  }, [chartLayout, visibleData.length]);

  const handleBarClick = (data: any) => {
    if (!onSelectStation || !data) return;
    const stationId = data.station || data.activePayload?.[0]?.payload?.station;
    if (stationId) {
      onSelectStation(stationId);
    }
  };

  // Custom rich tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: StationStat = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs space-y-2 min-w-[210px] z-50">
          <div className="border-b border-gray-100 pb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold text-gray-900 font-mono text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[170px]" title={data.station}>{data.station}</span>
            </div>
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
              {data.total} {data.total === 1 ? 'Report' : 'Reports'}
            </span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-gray-600">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                <span>Accreditations:</span>
              </span>
              <span className="font-bold text-gray-900 font-mono">{data.accreditation}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-gray-600">
                <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                <span>Incidents:</span>
              </span>
              <span className={`font-bold font-mono ${data.incident > 0 ? 'text-rose-700' : 'text-gray-900'}`}>
                {data.incident}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-gray-600">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                <span>Results:</span>
              </span>
              <span className="font-bold text-gray-900 font-mono">{data.result}</span>
            </div>
            {data.other > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0" />
                  <span>Other:</span>
                </span>
                <span className="font-bold text-gray-900 font-mono">{data.other}</span>
              </div>
            )}
          </div>

          {onSelectStation && (
            <div className="pt-1.5 border-t border-gray-100 text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
              <span>Click bar to filter table by this station</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (reports.length === 0) {
    return (
      <div className={`bg-white border border-gray-200 rounded-2xl p-6 text-center ${className}`}>
        <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-gray-700 font-serif">No Field Reports to Visualize</h4>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          Polling station report distributions will render dynamically here as soon as observation telemetry is submitted or verified.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-3xl shadow-xs overflow-hidden transition-all ${className}`}>
      {/* Top Header Strip */}
      <div className="p-5 sm:p-6 border-b border-gray-100 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 font-serif">
                Reports Distribution by Polling Station
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {totalUniqueStations} {totalUniqueStations === 1 ? 'Station' : 'Stations'} Active
              </span>
              {selectedStation && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 animate-in fade-in">
                  <span>Filtered: {selectedStation}</span>
                  <button
                    type="button"
                    onClick={() => onSelectStation && onSelectStation('')}
                    className="hover:text-purple-950 cursor-pointer ml-1"
                    title="Clear filter"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Visualizing the concentration and category mix of field telemetry submissions across reporting units.
            </p>
          </div>

          {/* Quick Controls Bar */}
          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            {/* Chart Mode Toggle */}
            <div className="flex items-center bg-gray-100/90 p-1 rounded-xl text-xs font-semibold text-gray-600">
              <button
                type="button"
                onClick={() => setChartMode('stacked')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 ${
                  chartMode === 'stacked'
                    ? 'bg-white text-gray-900 font-bold shadow-2xs'
                    : 'hover:text-gray-900'
                }`}
                title="View breakdown by Report Type (Accreditation, Incident, Result)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Stacked Types</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('total')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 ${
                  chartMode === 'total'
                    ? 'bg-white text-gray-900 font-bold shadow-2xs'
                    : 'hover:text-gray-900'
                }`}
                title="View total volume per station"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Total Volume</span>
              </button>
            </div>

            {/* Layout Orientation Toggle */}
            <div className="flex items-center bg-gray-100/90 p-1 rounded-xl text-xs font-semibold text-gray-600">
              <button
                type="button"
                onClick={() => setChartLayout('vertical')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  chartLayout === 'vertical'
                    ? 'bg-white text-gray-900 font-bold shadow-2xs'
                    : 'hover:text-gray-900'
                }`}
                title="Horizontal Bars (Best for long station IDs)"
              >
                Horizontal
              </button>
              <button
                type="button"
                onClick={() => setChartLayout('horizontal')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  chartLayout === 'horizontal'
                    ? 'bg-white text-gray-900 font-bold shadow-2xs'
                    : 'hover:text-gray-900'
                }`}
                title="Vertical Columns"
              >
                Vertical
              </button>
            </div>

            {/* Sort Selector */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              title="Sort stations"
            >
              <option value="volume_desc">Most Reports</option>
              <option value="volume_asc">Fewest Reports</option>
              <option value="incidents_desc">Most Incidents</option>
              <option value="station_asc">Station Code (A-Z)</option>
            </select>

            {/* Display Limit Selector */}
            <select
              value={displayLimit}
              onChange={(e) => setDisplayLimit(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              title="Number of stations displayed"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={15}>Top 15</option>
              <option value={25}>Top 25</option>
              <option value={0}>All Stations ({totalUniqueStations})</option>
            </select>

            {/* Minimize / Expand Toggle */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand chart' : 'Collapse chart'}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Analytical KPI Highlight Pills */}
        {!isCollapsed && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100 text-xs">
            <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Total Submissions
              </span>
              <span className="text-base font-bold text-gray-900 font-mono mt-0.5 block">
                {reports.length}
              </span>
            </div>

            <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Average / Station
              </span>
              <span className="text-base font-bold text-gray-900 font-mono mt-0.5 block">
                {avgReportsPerStation}
              </span>
            </div>

            <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Peak Reporting Station
              </span>
              <span className="text-xs font-bold text-emerald-700 font-mono mt-0.5 block truncate" title={peakStation?.station}>
                {peakStation ? `${peakStation.cleanStation} (${peakStation.total})` : 'N/A'}
              </span>
            </div>

            <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Incident Volume
              </span>
              <span className={`text-base font-bold font-mono mt-0.5 block ${totalIncidentCount > 0 ? 'text-rose-700' : 'text-gray-900'}`}>
                {totalIncidentCount} Flagged
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Chart Body */}
      {!isCollapsed && (
        <div className="p-5 sm:p-6 bg-slate-50/40">
          <div style={{ height: `${chartHeight}px` }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartLayout === 'vertical' ? (
                /* Horizontal Bar Chart (Stations on Y-Axis, count on X-Axis) */
                <BarChart
                  data={visibleData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                  onClick={handleBarClick}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    stroke="#cbd5e1"
                  />
                  <YAxis
                    dataKey="cleanStation"
                    type="category"
                    width={110}
                    tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
                    stroke="#cbd5e1"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: 10, fontSize: '11px', fontWeight: 600 }}
                  />

                  {chartMode === 'stacked' ? (
                    <>
                      <Bar
                        dataKey="accreditation"
                        name="Accreditation"
                        stackId="a"
                        fill={COLOR_MAP.accreditation}
                        radius={[0, 0, 0, 0]}
                        cursor="pointer"
                      />
                      <Bar
                        dataKey="incident"
                        name="Incidents"
                        stackId="a"
                        fill={COLOR_MAP.incident}
                        radius={[0, 0, 0, 0]}
                        cursor="pointer"
                      />
                      <Bar
                        dataKey="result"
                        name="Results"
                        stackId="a"
                        fill={COLOR_MAP.result}
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                      />
                    </>
                  ) : (
                    <Bar
                      dataKey="total"
                      name="Total Reports"
                      fill={COLOR_MAP.total}
                      radius={[0, 6, 6, 0]}
                      cursor="pointer"
                    >
                      {visibleData.map((entry, index) => {
                        const isSelected = selectedStation && entry.station === selectedStation;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={isSelected ? '#7c3aed' : entry.incident > 0 ? '#e11d48' : COLOR_MAP.total}
                            opacity={selectedStation && !isSelected ? 0.45 : 1}
                          />
                        );
                      })}
                    </Bar>
                  )}
                </BarChart>
              ) : (
                /* Vertical Column Chart (Stations on X-Axis, count on Y-Axis) */
                <BarChart
                  data={visibleData}
                  layout="horizontal"
                  margin={{ top: 10, right: 20, left: -10, bottom: 25 }}
                  onClick={handleBarClick}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="cleanStation"
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    tick={{ fontSize: 10, fill: '#1e293b', fontWeight: 600 }}
                    stroke="#cbd5e1"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    stroke="#cbd5e1"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: 14, fontSize: '11px', fontWeight: 600 }}
                  />

                  {chartMode === 'stacked' ? (
                    <>
                      <Bar
                        dataKey="accreditation"
                        name="Accreditation"
                        stackId="a"
                        fill={COLOR_MAP.accreditation}
                        radius={[0, 0, 0, 0]}
                        cursor="pointer"
                      />
                      <Bar
                        dataKey="incident"
                        name="Incidents"
                        stackId="a"
                        fill={COLOR_MAP.incident}
                        radius={[0, 0, 0, 0]}
                        cursor="pointer"
                      />
                      <Bar
                        dataKey="result"
                        name="Results"
                        stackId="a"
                        fill={COLOR_MAP.result}
                        radius={[4, 4, 0, 0]}
                        cursor="pointer"
                      />
                    </>
                  ) : (
                    <Bar
                      dataKey="total"
                      name="Total Reports"
                      fill={COLOR_MAP.total}
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                    >
                      {visibleData.map((entry, index) => {
                        const isSelected = selectedStation && entry.station === selectedStation;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={isSelected ? '#7c3aed' : entry.incident > 0 ? '#e11d48' : COLOR_MAP.total}
                            opacity={selectedStation && !isSelected ? 0.45 : 1}
                          />
                        );
                      })}
                    </Bar>
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Interactive footer note */}
          <div className="mt-3 pt-3 border-t border-gray-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-gray-500">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <span>
                Showing <strong>{visibleData.length}</strong> of <strong>{totalUniqueStations}</strong> stations with reported logs. Click any bar to filter the records table.
              </span>
            </div>
            {selectedStation && (
              <button
                type="button"
                onClick={() => onSelectStation && onSelectStation('')}
                className="text-purple-700 hover:text-purple-900 font-bold inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Station Filter</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
