import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  description?: string;
  compact?: boolean;
}

export default function LoadingState({
  message = 'Loading election data...',
  description = 'Synchronizing real-time telemetry from polling stations',
  compact = false
}: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-20'} bg-white rounded-2xl border border-gray-200/80`}>
      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
      <h3 className="text-sm font-bold text-gray-800 font-serif">{message}</h3>
      {description && (
        <p className="text-xs text-gray-400 mt-1 max-w-sm">{description}</p>
      )}
    </div>
  );
}
