import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FilePlus2, 
  AlertOctagon, 
  MapPin, 
  Users2, 
  Navigation,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface QuickActionsProps {
  onCheckInClick?: () => void;
  onCheckIn?: () => void;
  density?: 'comfortable' | 'compact';
}

export default function QuickActions({ onCheckInClick, onCheckIn, density = 'comfortable' }: QuickActionsProps) {
  const { isAdmin, isSupervisor } = useAuth();
  const handleCheckIn = onCheckInClick || onCheckIn;
  const isCompact = density === 'compact';

  const actions = [
    {
      title: 'Submit Field Report',
      description: 'Log voter accreditation or official EC8A results',
      icon: FilePlus2,
      to: '/report',
      color: 'emerald',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200/80 text-emerald-900',
      iconColor: 'text-emerald-700 bg-emerald-100',
      badge: 'Primary'
    },
    {
      title: 'Report Incident',
      description: 'Report BVAS glitch, delay, or security irregularity',
      icon: AlertOctagon,
      to: '/report?type=incident',
      color: 'red',
      bgColor: 'bg-red-50/70 hover:bg-red-100/80 border-red-200/80 text-red-950',
      iconColor: 'text-red-600 bg-red-100',
      badge: 'Urgent'
    },
    {
      title: 'View Polling Stations',
      description: 'Audit registered stations, coverage & geospatial map',
      icon: MapPin,
      to: '/polling-stations',
      color: 'blue',
      bgColor: 'bg-blue-50/70 hover:bg-blue-100/80 border-blue-200/80 text-blue-950',
      iconColor: 'text-blue-600 bg-blue-100',
      badge: 'Map & List'
    },
    ...(isAdmin || isSupervisor ? [
      {
        title: 'Manage Observers',
        description: 'Review observer deployment, rosters & check-in rate',
        icon: Users2,
        to: '/observers',
        color: 'purple',
        bgColor: 'bg-purple-50/70 hover:bg-purple-100/80 border-purple-200/80 text-purple-950',
        iconColor: 'text-purple-600 bg-purple-100',
        badge: 'Admin'
      }
    ] : [
      {
        title: 'Observer Check-In',
        description: 'Confirm arrival & GPS presence at assigned station',
        icon: Navigation,
        onClick: handleCheckIn,
        to: '#check-in',
        color: 'amber',
        bgColor: 'bg-amber-50/70 hover:bg-amber-100/80 border-amber-200/80 text-amber-950',
        iconColor: 'text-amber-600 bg-amber-100',
        badge: 'Required'
      }
    ])
  ];

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-xs transition-all ${
      isCompact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 font-serif">
            Quick Operational Actions
          </h2>
          <p className="text-xs text-gray-500 font-normal">Immediate field response and administrative workflows</p>
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${isCompact ? 'gap-2.5' : 'gap-3'}`}>
        {actions.map((action, idx) => {
          const Icon = action.icon;
          const cardContent = (
            <div className={`rounded-xl border transition-all duration-150 flex flex-col justify-between h-full group cursor-pointer ${action.bgColor} ${
              isCompact ? 'p-3' : 'p-3.5 sm:p-4'
            }`}>
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className={`rounded-lg flex items-center justify-center shrink-0 ${action.iconColor} ${
                  isCompact ? 'w-8 h-8' : 'w-8 h-8 sm:w-9 sm:h-9'
                }`}>
                  <Icon className={isCompact ? 'w-4 h-4' : 'w-4 h-4 sm:w-5 sm:h-5'} />
                </div>
                {action.badge && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-black/5 shadow-2xs">
                    {action.badge}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-xs font-bold tracking-tight">{action.title}</h3>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] opacity-80 mt-0.5 line-clamp-2 leading-relaxed">
                  {action.description}
                </p>
              </div>
            </div>
          );

          if (action.onClick) {
            return (
              <button
                key={idx}
                type="button"
                onClick={action.onClick}
                className="text-left w-full h-full"
              >
                {cardContent}
              </button>
            );
          }

          return (
            <Link key={idx} to={action.to} className="no-underline block h-full">
              {cardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
