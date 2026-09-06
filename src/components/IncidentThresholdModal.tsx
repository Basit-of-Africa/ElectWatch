import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  X, 
  AlertTriangle, 
  Bell, 
  Volume2, 
  VolumeX, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  Zap, 
  Eye, 
  Filter, 
  Save,
  Check,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IncidentAlertThresholdConfig, IncidentThresholdBreach, Incident } from '../types';
import { 
  getStoredThresholdConfig, 
  saveStoredThresholdConfig, 
  DEFAULT_THRESHOLD_CONFIG,
  evaluateIncidentThresholds,
  acknowledgeBreach,
  clearAcknowledgedBreach,
  playThresholdAudioChime
} from '../lib/incidentAlertService';
import { toast } from 'sonner';

interface IncidentThresholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  onSelectPollingUnitFilter?: (puId: string) => void;
}

export default function IncidentThresholdModal({
  isOpen,
  onClose,
  incidents,
  onSelectPollingUnitFilter
}: IncidentThresholdModalProps) {
  const [config, setConfig] = useState<IncidentAlertThresholdConfig>(getStoredThresholdConfig());
  const [activeTab, setActiveTab] = useState<'settings' | 'breaches'>('settings');
  const [testTriggered, setTestTriggered] = useState(false);

  // Sync config when modal opens
  useEffect(() => {
    if (isOpen) {
      setConfig(getStoredThresholdConfig());
    }
  }, [isOpen]);

  // Live evaluation of breaches with current draft config
  const { breaches } = evaluateIncidentThresholds(incidents, config);

  const handleSave = () => {
    saveStoredThresholdConfig(config);
    toast.success('Automated Alert Thresholds Saved', {
      description: `Alerts will trigger when any polling unit records ${config.incidentCountThreshold} or more ${
        config.severityFilter === 'critical' ? 'critical' : config.severityFilter === 'high_critical' ? 'high/critical' : ''
      } incidents.`
    });
    onClose();
  };

  const handleReset = () => {
    setConfig(DEFAULT_THRESHOLD_CONFIG);
    toast.info('Threshold settings reset to default.');
  };

  const handleTestAlert = () => {
    setTestTriggered(true);
    if (config.soundAlert) {
      playThresholdAudioChime();
    }
    toast.error('TEST ALERT: Automated Incident Threshold Triggered', {
      description: `[Simulation] Polling Unit #PU-OS-01/01/01/001 exceeded threshold (${config.incidentCountThreshold} incidents reported). Alert dispatched to Admin Notification Center.`,
      duration: 6000
    });
    setTimeout(() => setTestTriggered(false), 2000);
  };

  const handleToggleAcknowledge = (puId: string, currentAck: boolean) => {
    if (currentAck) {
      clearAcknowledgedBreach(puId);
      toast.info(`Reset acknowledged state for PU #${puId}`);
    } else {
      acknowledgeBreach(puId);
      toast.success(`Acknowledged alert for PU #${puId}`);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-serif tracking-tight flex items-center gap-2">
                  <span>Automated Incident Alert Thresholds</span>
                  {config.enabled ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60 uppercase tracking-widest">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400 uppercase tracking-widest">
                      Paused
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure automated warning rules when reports exceed set limits per polling unit.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center justify-between px-6 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-white text-gray-900 shadow-xs font-bold border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Threshold Rules
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('breaches')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'breaches'
                    ? 'bg-white text-gray-900 shadow-xs font-bold border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>Active Hotspots</span>
                {breaches.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                    {breaches.length}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleTestAlert}
              disabled={testTriggered}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>{testTriggered ? 'Testing Siren...' : 'Test Alert Sound & Toast'}</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
            {activeTab === 'settings' ? (
              <>
                {/* Master Switch */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200/70">
                  <div className="space-y-0.5">
                    <span className="font-bold text-gray-900 text-sm">Enable Automated Threshold Monitoring</span>
                    <p className="text-xs text-gray-500">
                      Continuously track incoming field incidents and automatically dispatch alerts.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* 1. Incident Count Threshold */}
                <div className="space-y-3 p-4 bg-white rounded-2xl border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-bold text-gray-900 block text-sm">
                        Incident Count Trigger Threshold
                      </label>
                      <p className="text-xs text-gray-500">
                        Trigger administrative alert when a single Polling Unit reaches this number of incidents.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-emerald-800 font-mono px-3 py-1 bg-emerald-50 rounded-xl border border-emerald-200">
                        ≥ {config.incidentCountThreshold}
                      </span>
                    </div>
                  </div>

                  {/* Range Slider */}
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={config.incidentCountThreshold}
                    onChange={(e) => setConfig({ ...config, incidentCountThreshold: Number(e.target.value) })}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-gray-200 rounded-lg appearance-none"
                  />

                  {/* Preset Pills */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-gray-400 font-medium">Quick Presets:</span>
                    {[
                      { count: 1, label: '1 (Zero Tolerance / Immediate)' },
                      { count: 2, label: '2 (Strict / Recommended)' },
                      { count: 3, label: '3 (Moderate Hotspot)' },
                      { count: 5, label: '5 (Severe Cluster)' },
                    ].map((preset) => (
                      <button
                        key={preset.count}
                        type="button"
                        onClick={() => setConfig({ ...config, incidentCountThreshold: preset.count })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          config.incidentCountThreshold === preset.count
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {preset.count}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Severity Scope */}
                <div className="space-y-2 p-4 bg-white rounded-2xl border border-gray-200">
                  <label className="font-bold text-gray-900 block text-sm">
                    Severity Evaluation Scope
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Choose which severity classifications count toward the trigger threshold.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      { key: 'all', title: 'All Severities', desc: 'Low, Medium, High & Critical' },
                      { key: 'high_critical', title: 'High & Critical Only', desc: 'Excludes minor/routine issues' },
                      { key: 'critical', title: 'Critical Only', desc: 'Only life-safety or violent disruptions' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setConfig({ ...config, severityFilter: opt.key as any })}
                        className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                          config.severityFilter === opt.key
                            ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="font-bold text-gray-900 text-xs flex items-center justify-between">
                          <span>{opt.title}</span>
                          {config.severityFilter === opt.key && (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1 leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Time Window & Cooldown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2">
                    <label className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-700" />
                      <span>Evaluation Time Window</span>
                    </label>
                    <select
                      value={config.timeWindowHours}
                      onChange={(e) => setConfig({ ...config, timeWindowHours: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value={0}>All Election Day (Cumulative)</option>
                      <option value={1}>Last 1 Hour (Rolling window)</option>
                      <option value={3}>Last 3 Hours</option>
                      <option value={6}>Last 6 Hours</option>
                      <option value={12}>Last 12 Hours</option>
                    </select>
                    <p className="text-[11px] text-gray-400">
                      Incidents reported older than this window won't count towards the threshold.
                    </p>
                  </div>

                  <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2">
                    <label className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 text-emerald-700" />
                      <span>Re-notification Cooldown</span>
                    </label>
                    <select
                      value={config.cooldownMinutes}
                      onChange={(e) => setConfig({ ...config, cooldownMinutes: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes (Recommended)</option>
                      <option value={60}>60 Minutes</option>
                      <option value={120}>2 Hours</option>
                    </select>
                    <p className="text-[11px] text-gray-400">
                      Prevents repetitive alert notifications if additional reports come in immediately.
                    </p>
                  </div>
                </div>

                {/* 4. Notification Channels & Escalation Actions */}
                <div className="space-y-3 p-4 bg-white rounded-2xl border border-gray-200">
                  <label className="font-bold text-gray-900 block text-xs uppercase tracking-wider text-gray-400">
                    Automated Actions On Threshold Breach
                  </label>

                  <div className="space-y-2.5">
                    <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={config.notifyAdmin}
                        onChange={(e) => setConfig({ ...config, notifyAdmin: e.target.checked })}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-gray-900">Notify Administrators</span>
                        <p className="text-[11px] text-gray-500">Dispatch critical alert to Admin Notification Center</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={config.notifySupervisor}
                        onChange={(e) => setConfig({ ...config, notifySupervisor: e.target.checked })}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-gray-900">Notify Field Supervisors</span>
                        <p className="text-[11px] text-gray-500">Alert area supervisors responsible for this LGA sector</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={config.soundAlert}
                        onChange={(e) => setConfig({ ...config, soundAlert: e.target.checked })}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-gray-900">Play Warning Audio Chime</span>
                        <p className="text-[11px] text-gray-500">Emit multi-tone audio siren through dashboard console</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={config.autoFlagHighRisk}
                        onChange={(e) => setConfig({ ...config, autoFlagHighRisk: e.target.checked })}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-gray-900">Auto-Flag Polling Unit as High-Risk Hotspot</span>
                        <p className="text-[11px] text-gray-500">Highlights PU across Election Map and Observer Directory</p>
                      </div>
                    </label>
                  </div>
                </div>
              </>
            ) : (
              /* Active Breaches List */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">
                      Current Polling Unit Breaches ({breaches.length})
                    </h3>
                    <p className="text-xs text-gray-500">
                      Units that currently meet or exceed the set threshold of ≥ {config.incidentCountThreshold} reports.
                    </p>
                  </div>
                </div>

                {breaches.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 flex flex-col items-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2 opacity-80" />
                    <p className="font-bold text-gray-700 text-sm">All Polling Units Within Threshold</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm">
                      No polling units currently meet or exceed the configured threshold of {config.incidentCountThreshold} incidents.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {breaches.map((b) => (
                      <div
                        key={b.pollingUnitId}
                        className={`p-4 rounded-2xl border transition-all ${
                          b.acknowledged
                            ? 'bg-gray-50/80 border-gray-200 opacity-80'
                            : 'bg-red-50/70 border-red-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-gray-900 text-sm">
                                PU #{b.pollingUnitId}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-600 text-white">
                                {b.count} Incidents (Limit: {b.threshold})
                              </span>
                              {b.acknowledged && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700">
                                  Acknowledged
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-gray-600">
                              <span className="text-red-700 font-bold">{b.severities.critical} Critical</span>
                              <span>•</span>
                              <span className="text-orange-700 font-bold">{b.severities.high} High</span>
                              <span>•</span>
                              <span className="text-amber-700">{b.severities.medium} Medium</span>
                              <span>•</span>
                              <span className="text-blue-700">{b.severities.low} Low</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleAcknowledge(b.pollingUnitId, b.acknowledged)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                b.acknowledged
                                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                  : 'bg-white hover:bg-red-100 text-red-800 border border-red-200'
                              }`}
                            >
                              {b.acknowledged ? 'Unmark' : 'Acknowledge'}
                            </button>

                            {onSelectPollingUnitFilter && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectPollingUnitFilter(b.pollingUnitId);
                                  onClose();
                                }}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer inline-flex items-center gap-1"
                              >
                                <span>Filter In Log</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
            >
              Reset to Defaults
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save & Apply Thresholds</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
