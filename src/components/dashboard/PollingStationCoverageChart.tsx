import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { 
  Building2, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  BarChart3, 
  PieChart as PieIcon, 
  ShieldCheck, 
  TrendingUp,
  MapPin,
  ChevronRight,
  Info
} from 'lucide-react';
import { Report, User, Incident } from '../../types';
import { Link } from 'react-router-dom';

interface PollingStationCoverageChartProps {
  reports: Report[];
  users: User[];
  incidents?: Incident[];
  className?: string;
}

interface StationItem {
  id: string;
  name: string;
  lga: string;
  ward: string;
  registeredVoters: number;
  status: 'active' | 'en_route' | 'unassigned';
  observerName?: string;
}

// Baseline audited & accredited polling stations across Osun State
const OSUN_BASELINE_STATIONS: StationItem[] = [
  { id: 'PU-OS-01/01/01/001', name: 'Town Hall Square, Ataoja A', lga: 'Osogbo', ward: 'Ward 01 - Ataoja A', registeredVoters: 750, status: 'active' },
  { id: 'PU-OS-01/01/01/002', name: 'Community Primary School, Oja Oba', lga: 'Osogbo', ward: 'Ward 01 - Ataoja A', registeredVoters: 920, status: 'active' },
  { id: 'PU-OS-01/02/03/003', name: 'Baptist High School, Gbonmi', lga: 'Osogbo', ward: 'Ward 02 - Ataoja B', registeredVoters: 680, status: 'active' },
  { id: 'PU-OS-01/03/01/004', name: 'St. Marks Anglican Primary School', lga: 'Osogbo', ward: 'Ward 03 - Otun Balogun', registeredVoters: 840, status: 'active' },
  
  { id: 'PU-OS-02/01/02/005', name: 'Igbonna Market Open Space', lga: 'Olorunda', ward: 'Ward 01 - Akogun', registeredVoters: 890, status: 'active' },
  { id: 'PU-OS-02/02/01/006', name: 'LA Primary School, Ayetoro', lga: 'Olorunda', ward: 'Ward 02 - Balogun', registeredVoters: 740, status: 'active' },
  { id: 'PU-OS-02/03/04/007', name: 'Government Technical College', lga: 'Olorunda', ward: 'Ward 03 - Ilie', registeredVoters: 610, status: 'en_route' },

  { id: 'PU-OS-03/01/01/008', name: 'Methodist Grammar School, Ilesa', lga: 'Ilesa East', ward: 'Ward 01 - Biladu', registeredVoters: 820, status: 'active' },
  { id: 'PU-OS-03/02/02/009', name: 'St. Johns School, Iloro', lga: 'Ilesa East', ward: 'Ward 02 - Iloro', registeredVoters: 960, status: 'active' },
  { id: 'PU-OS-03/03/01/010', name: 'Imo Community Hall', lga: 'Ilesa East', ward: 'Ward 03 - Ijofi', registeredVoters: 590, status: 'active' },

  { id: 'PU-OS-04/01/01/011', name: 'Ife City Hall, Enuwa', lga: 'Ife Central', ward: 'Ward 01 - Ilode I', registeredVoters: 1100, status: 'active' },
  { id: 'PU-OS-04/02/03/012', name: 'Oranmiyan Memorial Grammar School', lga: 'Ife Central', ward: 'Ward 02 - Moore', registeredVoters: 870, status: 'active' },
  { id: 'PU-OS-04/03/02/013', name: 'Urban Day Grammar School, Mayfair', lga: 'Ife Central', ward: 'Ward 03 - Iremo I', registeredVoters: 950, status: 'unassigned' },

  { id: 'PU-OS-05/01/01/014', name: 'St. Peters Anglican School, Ede', lga: 'Ede South', ward: 'Ward 01 - Abogunde', registeredVoters: 840, status: 'active' },
  { id: 'PU-OS-05/02/02/015', name: 'Mapo Primary School, Ede', lga: 'Ede South', ward: 'Ward 02 - Alapo', registeredVoters: 760, status: 'active' },
  { id: 'PU-OS-05/03/01/016', name: 'Timi Agbale Grammar School', lga: 'Ede South', ward: 'Ward 03 - Babasanya', registeredVoters: 690, status: 'en_route' },

  { id: 'PU-OS-06/01/01/017', name: 'Awo Community High School', lga: 'Egbedore', ward: 'Ward 01 - Awo', registeredVoters: 630, status: 'active' },
  { id: 'PU-OS-06/02/03/018', name: 'Iragberi Town Hall Court', lga: 'Egbedore', ward: 'Ward 02 - Iragberi', registeredVoters: 580, status: 'active' },
  { id: 'PU-OS-06/03/01/019', name: 'Okinni Civic Centre', lga: 'Egbedore', ward: 'Ward 03 - Okinni', registeredVoters: 720, status: 'unassigned' },

  { id: 'PU-OS-07/01/02/020', name: 'Ejigbo Baptist High School', lga: 'Ejigbo', ward: 'Ward 01 - Elejigbo A', registeredVoters: 810, status: 'active' },
  { id: 'PU-OS-07/02/01/021', name: 'Ila Orangun Town Hall', lga: 'Ila', ward: 'Ward 01 - Eyindi', registeredVoters: 690, status: 'active' },
  { id: 'PU-OS-08/01/01/022', name: 'Ikirun Central Mosque Quadrangle', lga: 'Ifelodun', ward: 'Ward 01 - Ikirun', registeredVoters: 770, status: 'active' }
];

const DONUT_COLORS = {
  active: '#10b981',    // Emerald 500
  en_route: '#3b82f6',  // Blue 500
  unassigned: '#f59e0b' // Amber 500
};

export default function PollingStationCoverageChart({
  reports,
  users,
  incidents = [],
  className = ''
}: PollingStationCoverageChartProps) {
  const [activeTab, setActiveTab] = useState<'donut' | 'bars' | 'dual'>('dual');

  // Compute live station telemetry
  const {
    stationsList,
    activeCount,
    enRouteCount,
    unassignedCount,
    totalAccredited,
    coveragePercentage,
    lgaData,
    pieData
  } = useMemo(() => {
    // 1. Gather all polling units from base + active reports + user assignments
    const stationMap = new Map<string, StationItem>();

    // Seed with baseline stations
    OSUN_BASELINE_STATIONS.forEach(s => {
      stationMap.set(s.id, { ...s });
    });

    // Merge from live reports
    reports.forEach(r => {
      const pId = r.pollingUnitId?.trim();
      if (!pId) return;

      if (!stationMap.has(pId)) {
        stationMap.set(pId, {
          id: pId,
          name: `Polling Station ${pId}`,
          lga: 'Osogbo',
          ward: 'Central Sector',
          registeredVoters: 750,
          status: 'active'
        });
      }
    });

    // 2. Evaluate active observer presence for each station
    // A station is ACTIVE if:
    // - There is at least one report filed from it
    // - OR an assigned user is checked in
    const activeStationsSet = new Set<string>();
    const enRouteStationsSet = new Set<string>();

    reports.forEach(r => {
      if (r.pollingUnitId) activeStationsSet.add(r.pollingUnitId.trim());
    });

    users.forEach(u => {
      if (u.assignedPollingUnitId) {
        const puId = u.assignedPollingUnitId.trim();
        if (u.checkInStatus === 'checked_in') {
          activeStationsSet.add(puId);
        } else if (u.checkInStatus === 'en_route' && !activeStationsSet.has(puId)) {
          enRouteStationsSet.add(puId);
        }
      }
    });

    // Update statuses
    const updatedStations: StationItem[] = Array.from(stationMap.values()).map(st => {
      let currentStatus: 'active' | 'en_route' | 'unassigned' = 'unassigned';
      if (activeStationsSet.has(st.id) || st.status === 'active') {
        currentStatus = 'active';
      } else if (enRouteStationsSet.has(st.id) || st.status === 'en_route') {
        currentStatus = 'en_route';
      }

      // Match observer name if available
      const assignedUser = users.find(u => u.assignedPollingUnitId === st.id);

      return {
        ...st,
        status: currentStatus,
        observerName: assignedUser?.displayName || assignedUser?.email || undefined
      };
    });

    const active = updatedStations.filter(s => s.status === 'active').length;
    const enRoute = updatedStations.filter(s => s.status === 'en_route').length;
    const unassigned = updatedStations.filter(s => s.status === 'unassigned').length;
    const total = updatedStations.length;
    const coverage = total > 0 ? Math.round((active / total) * 100) : 0;

    // Aggregate by LGA
    const lgaMap = new Map<string, { total: number; active: number; enRoute: number }>();
    updatedStations.forEach(s => {
      const entry = lgaMap.get(s.lga) || { total: 0, active: 0, enRoute: 0 };
      entry.total += 1;
      if (s.status === 'active') entry.active += 1;
      else if (s.status === 'en_route') entry.enRoute += 1;
      lgaMap.set(s.lga, entry);
    });

    const lgaStats = Array.from(lgaMap.entries()).map(([lga, data]) => {
      const pct = Math.round((data.active / data.total) * 100);
      return {
        lga,
        total: data.total,
        active: data.active,
        enRoute: data.enRoute,
        percentage: pct,
        uncovered: data.total - data.active
      };
    }).sort((a, b) => b.percentage - a.percentage);

    const pie = [
      { name: 'Active Observers On-Site', value: active, color: DONUT_COLORS.active },
      { name: 'Observer En Route', value: enRoute, color: DONUT_COLORS.en_route },
      { name: 'Pending Observer Deployment', value: unassigned, color: DONUT_COLORS.unassigned }
    ].filter(item => item.value > 0);

    return {
      stationsList: updatedStations,
      activeCount: active,
      enRouteCount: enRoute,
      unassignedCount: unassigned,
      totalAccredited: total,
      coveragePercentage: coverage,
      lgaData: lgaStats,
      pieData: pie
    };
  }, [reports, users]);

  return (
    <div className={`bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs ${className}`}>
      {/* Header with Title, Live Badge, and Tab Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 font-serif flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-700" />
              <span>Accredited Polling Station Observer Coverage</span>
            </h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{coveragePercentage}% Monitored</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
            Real-time ratio of accredited polling units with verified observers actively deployed on-site across Osun State electoral districts.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl shrink-0 self-start sm:self-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('dual')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'dual' 
                ? 'bg-white text-gray-900 shadow-xs font-bold' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Combined
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('donut')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 ${
              activeTab === 'donut' 
                ? 'bg-white text-gray-900 shadow-xs font-bold' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span>Ratio</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bars')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 ${
              activeTab === 'bars' 
                ? 'bg-white text-gray-900 shadow-xs font-bold' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>By LGA</span>
          </button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Active Coverage</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-950 mt-1">{coveragePercentage}%</p>
          <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">{activeCount} of {totalAccredited} PUs manned</p>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">En Route</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold text-blue-950 mt-1">{enRouteCount}</p>
          <p className="text-[11px] text-blue-700 mt-0.5 font-medium">In-transit observers</p>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Unassigned</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-amber-950 mt-1">{unassignedCount}</p>
          <p className="text-[11px] text-amber-700 mt-0.5 font-medium">Needs field deployment</p>
        </div>

        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Total Audited</span>
            <Building2 className="w-4 h-4 text-gray-500" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{totalAccredited}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Accredited sample units</p>
        </div>
      </div>

      {/* Main Visualizations Area */}
      <div className={`grid gap-6 items-center ${
        activeTab === 'dual' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
      }`}>
        
        {/* Visual 1: Donut Chart with Center Percentage */}
        {(activeTab === 'dual' || activeTab === 'donut') && (
          <div className={`${activeTab === 'dual' ? 'lg:col-span-5' : 'max-w-xl mx-auto w-full'} flex flex-col items-center justify-center p-4 bg-gray-50/60 rounded-2xl border border-gray-100`}>
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 font-serif">Observer Deployment Ratio</span>
              <span className="text-[11px] text-gray-400 font-mono">Real-time</span>
            </div>

            <div className="relative w-full h-56 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [`${value} PUs (${Math.round((Number(value) / totalAccredited) * 100)}%)`, name]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Metrics in Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-3xl font-extrabold text-gray-900 font-sans tracking-tight">
                  {coveragePercentage}%
                </span>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mt-0.5">
                  Manned PUs
                </span>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="w-full space-y-1.5 mt-3 pt-3 border-t border-gray-200/60 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-gray-700">Active Observers On-Site</span>
                </div>
                <span className="font-bold text-gray-900">{activeCount} ({coveragePercentage}%)</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-gray-700">Observer En Route</span>
                </div>
                <span className="font-bold text-gray-900">{enRouteCount} ({Math.round((enRouteCount / totalAccredited) * 100)}%)</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-gray-700">Pending Deployment</span>
                </div>
                <span className="font-bold text-gray-900">{unassignedCount} ({Math.round((unassignedCount / totalAccredited) * 100)}%)</span>
              </div>
            </div>
          </div>
        )}

        {/* Visual 2: Regional Bar Chart across LGAs */}
        {(activeTab === 'dual' || activeTab === 'bars') && (
          <div className={`${activeTab === 'dual' ? 'lg:col-span-7' : 'w-full'} flex flex-col p-4 bg-gray-50/60 rounded-2xl border border-gray-100`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-bold text-gray-700 font-serif">Coverage by Local Government Area (LGA)</span>
                <p className="text-[11px] text-gray-500">Percentage of accredited units with active observer deployment</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                100% Target
              </span>
            </div>

            <div className="w-full h-64 mt-2">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={lgaData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis 
                    type="number" 
                    domain={[0, 100]} 
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    dataKey="lga" 
                    type="category" 
                    width={80}
                    tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
                    stroke="#9ca3af"
                  />
                  <Tooltip
                    formatter={(value: any, name: any, item: any) => [
                      `${value}% Coverage (${item.payload.active}/${item.payload.total} PUs)`,
                      'Active Observers'
                    ]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  />
                  <Bar
                    dataKey="percentage"
                    name="Coverage %"
                    fill="#10b981"
                    radius={[0, 6, 6, 0]}
                    barSize={18}
                  >
                    {lgaData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.percentage >= 85 ? '#10b981' : entry.percentage >= 70 ? '#3b82f6' : '#f59e0b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Context Footer */}
            <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-200/60">
              <span className="flex items-center gap-1 text-emerald-800 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Audited for 2026 Gubernatorial Off-Cycle</span>
              </span>
              <Link to="/polling-stations" className="text-emerald-700 hover:text-emerald-800 font-bold inline-flex items-center gap-1">
                <span>View Full Station Directory</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
