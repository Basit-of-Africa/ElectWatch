import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false
}: EmptyStateProps) {
  return (
    <div className={`bg-white rounded-2xl border border-dashed border-gray-200 text-center flex flex-col items-center justify-center ${compact ? 'py-8 px-4' : 'py-16 px-6'}`}>
      <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 mb-3 shadow-xs">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1 font-serif">{title}</h3>
      <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4 leading-relaxed font-normal">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
