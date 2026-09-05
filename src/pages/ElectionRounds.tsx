import React, { useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import { AVAILABLE_ELECTIONS, ELECTION_LEVEL_LABELS } from '../constants/elections';
import { ElectionScope } from '../types';
import { 
  Vote, 
  Calendar, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Users, 
  Building2, 
  ArrowRight,
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function ElectionRounds() {
  const [activeScopeId, setActiveScopeId] = useState<string>('osun-guber-offcycle');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'upcoming' | 'past'>('all');

  const electionRoundsData = [
    {
      ...AVAILABLE_ELECTIONS[0],
      status: 'active',
      date: 'July 11, 2026',
      phase: 'Accreditation & Polling Stage',
      pollingUnitsCount: 3763,
      registeredVoters: '1,955,657',
      lgasCount: 30,
      reportingObservers: 124,
      collationCenters: 30
    },
    {
      ...AVAILABLE_ELECTIONS[1],
      status: 'upcoming',
      date: 'February 20, 2027',
      phase: 'Pre-Election Voter Register Audit',
      pollingUnitsCount: 176846,
      registeredVoters: '93,469,008',
      lgasCount: 774,
      reportingObservers: 0,
      collationCenters: 774
    },
    {
      ...AVAILABLE_ELECTIONS[2],
      status: 'upcoming',
      date: 'March 6, 2027',
      phase: 'Candidate Nomination Validation',
      pollingUnitsCount: 142100,
      registeredVoters: '78,210,000',
      lgasCount: 650,
      reportingObservers: 0,
      collationCenters: 650
    },
    {
      id: 'edo-guber-2024',
      name: 'Edo State Gubernatorial Election (Archive)',
      level: 'governorship' as const,
      state: 'Edo',
      year: 2024,
      isOffCycle: true,
      description: 'Historical archive of the September 2024 Edo Gubernatorial election telemetry.',
      status: 'past',
      date: 'September 21, 2024',
      phase: 'Results Declared & Certified',
      pollingUnitsCount: 4519,
      registeredVoters: '2,629,025',
      lgasCount: 18,
      reportingObservers: 320,
      collationCenters: 18
    }
  ];

  const filteredRounds = electionRoundsData.filter(round => {
    if (selectedFilter === 'active') return round.status === 'active';
    if (selectedFilter === 'upcoming') return round.status === 'upcoming';
    if (selectedFilter === 'past') return round.status === 'past';
    return true;
  });

  const handleSetActiveRound = (scope: ElectionScope) => {
    setActiveScopeId(scope.id);
    toast.success(`Active election round changed to: ${scope.name}`, {
      description: 'Workspace filters, maps, and observer queues updated accordingly.'
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Election Rounds & Cycles"
        subtitle="Manage active election schedules, coverage phases, registered polling units, and statutory observation scopes."
        breadcrumbs={[
          { label: 'Election Rounds' }
        ]}
        badge={
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            1 Active Round Live
          </span>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {(['all', 'active', 'upcoming', 'past'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setSelectedFilter(filter)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedFilter === filter
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {filter === 'all' ? 'All Election Rounds' : filter}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-500 font-medium">
          Showing {filteredRounds.length} election cycles
        </span>
      </div>

      {/* Rounds Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredRounds.map((round) => {
          const isSelected = round.id === activeScopeId;
          const levelMeta = ELECTION_LEVEL_LABELS[round.level] || {
            label: 'General Election',
            bg: 'bg-gray-100 border-gray-200',
            color: 'text-gray-700'
          };

          return (
            <div
              key={round.id}
              className={`bg-white rounded-2xl border transition-all duration-200 p-6 flex flex-col justify-between ${
                isSelected 
                  ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/10' 
                  : 'border-gray-200 hover:border-gray-300 shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wider ${levelMeta.bg} ${levelMeta.color}`}>
                      {levelMeta.label}
                    </span>
                    {round.isOffCycle && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase">
                        Off-Cycle
                      </span>
                    )}
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    round.status === 'active' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse' 
                      : round.status === 'upcoming' 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                    {round.status}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-900 tracking-tight font-serif">
                  {round.name}
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {round.description}
                </p>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 text-xs">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">Election Date</span>
                      <span className="font-semibold text-gray-800">{round.date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">Polling Stations</span>
                      <span className="font-semibold text-gray-800">{round.pollingUnitsCount.toLocaleString()} PUs</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">Voter Roll</span>
                      <span className="font-semibold text-gray-800">{round.registeredVoters}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">Jurisdiction</span>
                      <span className="font-semibold text-gray-800">{round.lgasCount} LGAs / Wards</span>
                    </div>
                  </div>
                </div>

                {/* Operational Phase */}
                <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span className="text-gray-600 font-medium">Phase:</span>
                    <span className="font-bold text-gray-900">{round.phase}</span>
                  </div>
                  {round.status === 'active' && (
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Live Stream
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                {isSelected ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Currently Active In Workspace</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetActiveRound(round)}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>Set As Active Workspace Round</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
