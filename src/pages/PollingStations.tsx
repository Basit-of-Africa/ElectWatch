import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '../components/common/PageHeader';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Report, Incident } from '../types';
import { 
  MapPin, 
  Search, 
  Filter, 
  Building2, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Map as MapIcon, 
  List,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Download
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MapPage from './MapPage';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';

interface PollingStationItem {
  id: string;
  name: string;
  ward: string;
  lga: string;
  state: string;
  registeredVoters: number;
  assignedObserver?: string;
  observerName?: string;
  hasIncident?: boolean;
  incidentSeverity?: string;
  accreditedVoters?: number;
  hasResult?: boolean;
  status: 'covered' | 'unassigned' | 'incident_reported' | 'result_confirmed';
}

export default function PollingStations() {
  const [reports, setReports] = useState<Report[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'covered' | 'incidents' | 'results'>('all');
  const [viewMode, setViewMode] = useState<'directory' | 'map'>('directory');

  // Load live Firestore reports & incidents
  useEffect(() => {
    const unsubReports = onSnapshot(query(collection(db, 'reports'), orderBy('timestamp', 'desc'), limit(150)), (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(docs);
    });

    const unsubIncidents = onSnapshot(query(collection(db, 'incidents'), orderBy('timestamp', 'desc'), limit(150)), (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      setIncidents(docs);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map: Record<string, string> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[d.id] = data.displayName || data.email || 'Observer';
      });
      setUsersMap(map);
    });

    return () => {
      unsubReports();
      unsubIncidents();
      unsubUsers();
    };
  }, []);

  // Standard Osun / National Polling Unit Directory Baseline
  const baseStations: PollingStationItem[] = useMemo(() => {
    // Collect unique polling unit IDs from reports, incidents, and predefined Osun registry
    const puMap: Record<string, PollingStationItem> = {
      'PU-OS-01/01/01/001': {
        id: 'PU-OS-01/01/01/001',
        name: 'Town Hall Square, Osogbo Ward 1',
        ward: 'Ward 01 - Ataoja A',
        lga: 'Osogbo',
        state: 'Osun',
        registeredVoters: 750,
        status: 'covered'
      },
      'PU-OS-01/01/01/002': {
        id: 'PU-OS-01/01/01/002',
        name: 'Community Primary School, Oja Oba',
        ward: 'Ward 01 - Ataoja A',
        lga: 'Osogbo',
        state: 'Osun',
        registeredVoters: 920,
        status: 'covered'
      },
      'PU-OS-02/03/01/004': {
        id: 'PU-OS-02/03/01/004',
        name: 'Methodist Grammar School, Ilesa',
        ward: 'Ward 03 - Biladu',
        lga: 'Ilesa East',
        state: 'Osun',
        registeredVoters: 680,
        status: 'covered'
      },
      'PU-OS-05/02/04/007': {
        id: 'PU-OS-05/02/04/007',
        name: 'St. Peters Anglican School, Ede',
        ward: 'Ward 02 - Abogunde',
        lga: 'Ede South',
        state: 'Osun',
        registeredVoters: 840,
        status: 'covered'
      },
      'PU-OS-08/04/02/011': {
        id: 'PU-OS-08/04/02/011',
        name: 'Ife City Hall, Enuwa',
        ward: 'Ward 04 - Ilode I',
        lga: 'Ife Central',
        state: 'Osun',
        registeredVoters: 1100,
        status: 'covered'
      }
    };

    // Merge active Firestore reports into stations
    reports.forEach(r => {
      const pId = r.pollingUnitId?.trim();
      if (!pId) return;

      if (!puMap[pId]) {
        puMap[pId] = {
          id: pId,
          name: `Polling Station ${pId}`,
          ward: 'Sector Central',
          lga: 'Osogbo / Central LGA',
          state: 'Osun',
          registeredVoters: 800,
          status: 'covered'
        };
      }

      if (r.observerId) {
        puMap[pId].assignedObserver = r.observerId;
        puMap[pId].observerName = usersMap[r.observerId] || 'Assigned Field Observer';
      }

      if (r.type === 'accreditation' && r.payload?.voterCount) {
        puMap[pId].accreditedVoters = Number(r.payload.voterCount);
      }

      if (r.type === 'result') {
        puMap[pId].hasResult = true;
        puMap[pId].status = 'result_confirmed';
      }
    });

    // Merge active incidents into stations
    incidents.forEach(inc => {
      const pId = inc.pollingUnitId?.trim();
      if (!pId) return;

      if (!puMap[pId]) {
        puMap[pId] = {
          id: pId,
          name: `Polling Station ${pId}`,
          ward: 'Sector Central',
          lga: 'Central Sector',
          state: 'Osun',
          registeredVoters: 750,
          status: 'incident_reported',
          hasIncident: true,
          incidentSeverity: inc.severity
        };
      } else {
        puMap[pId].hasIncident = true;
        puMap[pId].incidentSeverity = inc.severity;
        if (puMap[pId].status !== 'result_confirmed') {
          puMap[pId].status = 'incident_reported';
        }
      }
    });

    return Object.values(puMap);
  }, [reports, incidents, usersMap]);

  // Filtering
  const filteredStations = useMemo(() => {
    return baseStations.filter(st => {
      const matchesSearch = 
        st.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.ward.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.lga.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'covered') return Boolean(st.assignedObserver || st.observerName);
      if (statusFilter === 'incidents') return st.hasIncident;
      if (statusFilter === 'results') return st.hasResult;

      return true;
    });
  }, [baseStations, searchQuery, statusFilter]);

  const totalRegisteredVotersSum = baseStations.reduce((sum, s) => sum + s.registeredVoters, 0);
  const coveredStationsCount = baseStations.filter(s => s.assignedObserver || s.observerName).length;
  const stationsWithIncidents = baseStations.filter(s => s.hasIncident).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Polling Stations & Coverage"
        subtitle="Directory of registered polling units, deployed observers, accreditation metrics, and geographical coverage map."
        breadcrumbs={[
          { label: 'Polling Stations' }
        ]}
        actions={
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setViewMode('directory')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'directory' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Directory</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'map' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Live Map</span>
            </button>
          </div>
        }
      />

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Polling Units</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 font-serif">{baseStations.length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Across active election jurisdiction</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Stations Covered</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 font-serif">{coveredStationsCount}</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            {baseStations.length > 0 ? Math.round((coveredStationsCount / baseStations.length) * 100) : 0}% observer coverage
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Open Incidents</p>
          <p className="text-2xl font-bold text-red-700 mt-1 font-serif">{stationsWithIncidents}</p>
          <p className="text-[11px] text-red-600 font-semibold mt-0.5">Stations flagged with issues</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Registered Roll</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 font-serif">{totalRegisteredVotersSum.toLocaleString()}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Estimated voters in jurisdiction</p>
        </div>
      </div>

      {viewMode === 'map' ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <MapPage />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Table Controls */}
          <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by PU ID, name, ward, or LGA..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(['all', 'covered', 'incidents', 'results'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    statusFilter === f
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {f === 'all' ? 'All Stations' : f}
                </button>
              ))}
            </div>
          </div>

          {/* Directory Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100/70 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Polling Unit ID & Name</th>
                  <th className="py-3 px-4">Ward / LGA</th>
                  <th className="py-3 px-4">Observer Coverage</th>
                  <th className="py-3 px-4">Voter Turnout / Reg.</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10">
                      <EmptyState
                        icon={Building2}
                        title="No Polling Stations Found"
                        description="No stations match your current search or filter criteria. Clear filters to see all units."
                        compact
                      />
                    </td>
                  </tr>
                ) : (
                  filteredStations.map((station) => (
                    <tr key={station.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 flex items-center gap-2 font-mono">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{station.id}</span>
                        </div>
                        <p className="text-gray-500 text-[11px] mt-0.5 truncate max-w-xs">{station.name}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-medium text-gray-800">{station.ward}</p>
                        <p className="text-gray-400 text-[10px] mt-0.5">{station.lga}, {station.state}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        {station.observerName ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate max-w-[150px]">{station.observerName}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-bold text-gray-900">
                          {station.accreditedVoters !== undefined ? station.accreditedVoters : '—'}
                        </span>
                        <span className="text-gray-400 text-[10px] ml-1">/ {station.registeredVoters}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {station.hasIncident ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-200">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            Incident ({station.incidentSeverity || 'Reported'})
                          </span>
                        ) : station.hasResult ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Result Certified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-700 border border-gray-200">
                            Monitoring
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/reports?search=${encodeURIComponent(station.id)}`}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                        >
                          <span>Reports</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
