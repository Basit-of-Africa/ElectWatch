import React from 'react';
import { LucideIcon, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  id?: string;
  title: string;
  value: number | string;
  subtitle?: string;
  description?: string;
  icon: LucideIcon;
  color?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'teal' | 'rose' | 'slate';
  variant?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'teal' | 'rose' | 'slate';
  href?: string;
  badgeText?: string;
  badgeType?: 'neutral' | 'positive' | 'warning' | 'critical';
  density?: 'comfortable' | 'compact';
}

export default function StatCard({
  id,
  title,
  value,
  subtitle,
  description,
  icon: Icon,
  color,
  variant,
  href,
  badgeText,
  badgeType = 'neutral',
  density = 'comfortable'
}: StatCardProps) {
  const chosenColor = (variant || color || 'emerald') as 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'teal' | 'rose' | 'slate';
  const effectiveSubtitle = description || subtitle;
  const isCompact = density === 'compact';

  const colorSchemes: Record<string, { iconBg: string; accent: string; borderHover: string }> = {
    emerald: {
      iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      accent: 'text-emerald-700',
      borderHover: 'hover:border-emerald-300'
    },
    teal: {
      iconBg: 'bg-teal-50 text-teal-700 border-teal-100',
      accent: 'text-teal-700',
      borderHover: 'hover:border-teal-300'
    },
    blue: {
      iconBg: 'bg-blue-50 text-blue-700 border-blue-100',
      accent: 'text-blue-700',
      borderHover: 'hover:border-blue-300'
    },
    amber: {
      iconBg: 'bg-amber-50 text-amber-700 border-amber-100',
      accent: 'text-amber-700',
      borderHover: 'hover:border-amber-300'
    },
    red: {
      iconBg: 'bg-red-50 text-red-700 border-red-100',
      accent: 'text-red-700',
      borderHover: 'hover:border-red-300'
    },
    rose: {
      iconBg: 'bg-rose-50 text-rose-700 border-rose-100',
      accent: 'text-rose-700',
      borderHover: 'hover:border-rose-300'
    },
    purple: {
      iconBg: 'bg-purple-50 text-purple-700 border-purple-100',
      accent: 'text-purple-700',
      borderHover: 'hover:border-purple-300'
    },
    slate: {
      iconBg: 'bg-gray-50 text-gray-700 border-gray-100',
      accent: 'text-gray-700',
      borderHover: 'hover:border-gray-300'
    }
  };

  const scheme = colorSchemes[chosenColor] || colorSchemes.emerald;

  const content = (
    <div 
      id={id} 
      className={`bg-white rounded-2xl border border-gray-200 shadow-xs transition-all duration-200 ${
        isCompact ? 'p-3.5 sm:p-4' : 'p-3.5 sm:p-4 xl:p-5'
      } ${href ? `${scheme.borderHover} hover:shadow-sm cursor-pointer group` : ''}`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-0.5 min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate" title={title}>
            {title}
          </p>
          <p className={`font-bold text-gray-900 tracking-tight font-serif tabular-nums leading-tight ${
            isCompact ? 'text-xl sm:text-2xl' : 'text-xl sm:text-2xl xl:text-3xl'
          }`}>
            {value}
          </p>
          {effectiveSubtitle && (
            <p className="text-[11px] sm:text-xs text-gray-500 font-medium line-clamp-1 leading-snug mt-0.5" title={effectiveSubtitle}>
              {effectiveSubtitle}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className={`rounded-xl border flex items-center justify-center ${
            isCompact ? 'w-8 h-8 sm:w-9 sm:h-9' : 'w-8 h-8 sm:w-9 sm:h-9 xl:w-10 xl:h-10'
          } ${scheme.iconBg}`}>
            <Icon className={isCompact ? 'w-4 h-4' : 'w-4 h-4 sm:w-4.5 sm:h-4.5 xl:w-5 xl:h-5'} />
          </div>
          {href && (
            <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          )}
        </div>
      </div>

      {badgeText && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10px] sm:text-[11px]">
          <span className="text-gray-500 font-medium">Status</span>
          <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            badgeType === 'positive' ? 'bg-emerald-50 text-emerald-700' :
            badgeType === 'warning' ? 'bg-amber-50 text-amber-700' :
            badgeType === 'critical' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {badgeText}
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link to={href} className="block no-underline">{content}</Link>;
  }

  return content;
}
