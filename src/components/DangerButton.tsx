import React, { useState } from 'react';
import { Siren, AlertOctagon, ShieldAlert } from 'lucide-react';
import DangerAlertModal from './DangerAlertModal';

interface DangerButtonProps {
  variant?: 'header' | 'card' | 'compact' | 'hero';
  className?: string;
  label?: string;
}

export default function DangerButton({ variant = 'header', className = '', label }: DangerButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-red-900/30 transition-all border border-red-400/50 active:scale-95 ${className}`}
          title="Press in case of immediate danger or threat"
        >
          <Siren className="w-3.5 h-3.5 text-white animate-pulse" />
          <span>{label || 'DANGER SOS'}</span>
        </button>
        <DangerAlertModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  if (variant === 'card') {
    return (
      <>
        <div className={`p-5 rounded-3xl bg-gradient-to-br from-red-950 via-red-900 to-black border-2 border-red-600/80 text-white shadow-xl relative overflow-hidden ${className}`}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldAlert className="w-28 h-28 text-red-500" />
          </div>
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-md">
                EMERGENCY DANGER BUTTON
              </span>
            </div>
            <div>
              <h4 className="text-lg font-black font-serif text-white">
                Facing Immediate Danger?
              </h4>
              <p className="text-xs text-red-200 mt-1 leading-relaxed">
                Pressing SOS instantly broadcasts your location & station details to Election Control HQ, Supervisors, and nearby Field Observers.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-red-900/50 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] border border-red-400/40"
            >
              <Siren className="w-4 h-4 animate-pulse" />
              {label || 'PRESS FOR IMMEDIATE DANGER SOS'}
            </button>
          </div>
        </div>
        <DangerAlertModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  // Default 'header' variant
  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`group relative inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-red-900/30 hover:shadow-red-900/50 transition-all duration-200 border border-red-400/40 active:scale-95 ${className}`}
        title="Emergency Panic Alert for Observers"
      >
        <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
        <Siren className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
        <span className="hidden sm:inline font-black">{label || 'DANGER SOS'}</span>
      </button>
      <DangerAlertModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
