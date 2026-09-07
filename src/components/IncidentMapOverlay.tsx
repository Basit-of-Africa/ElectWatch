import React, { useState, useMemo, useRef, useEffect } from 'react';
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { Incident, Report, IncidentAlertThresholdConfig } from '../types';
import { 
  MapPin, 
  Layers, 
  Maximize2, 
  Minimize2, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Flame, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ExternalLink, 
  Filter, 
  Radio, 
  Globe, 
  Building2, 
  Eye, 
  Info, 
  Compass, 
  X,
  Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { KNOWN_STATION_NAMES, STATE_CODE_MAP } from '../lib/reportExport';

const env = (import.meta as any).env || {};
const cleanKey = (val?: string) => val ? val.replace(/^["']|["']$/g, '').trim() : '';
const GOOGLE_MAPS_API_KEY = cleanKey(env.VITE_GOOGLE_MAPS_API_KEY) || cleanKey(process.env.VITE_GOOGLE_MAPS_API_KEY) || '';

// Known geographic centroids for Osun LGAs and major Nigerian hubs
const LGA_CENTROIDS: Record<string, { lat: number; lng: number; name: string }> = {
  'Osogbo': { lat: 7.7827, lng: 4.5418, name: 'Osogbo Central' },
  'Olorunda': { lat: 7.8010, lng: 4.5680, name: 'Olorunda / Ayetoro' },
  'Ilesa East': { lat: 7.6298, lng: 4.7417, name: 'Ilesa East' },
  'Ilesa West': { lat: 7.6180, lng: 4.7250, name: 'Ilesa West' },
  'Ife Central': { lat: 7.4833, lng: 4.5667, name: 'Ile-Ife Central' },
  'Ife East': { lat: 7.4920, lng: 4.5780, name: 'Ile-Ife East' },
  'Ede South': { lat: 7.7333, lng: 4.4333, name: 'Ede South' },
  'Ede North': { lat: 7.7480, lng: 4.4490, name: 'Ede North' },
  'Ejigbo': { lat: 7.9020, lng: 4.3140, name: 'Ejigbo' },
  'Ikirun': { lat: 7.9150, lng: 4.6640, name: 'Ifelodun / Ikirun' },
  'Ila Orangun': { lat: 8.0170, lng: 4.9030, name: 'Ila Orangun' },
  'Iwo': { lat: 7.6330, lng: 4.1830, name: 'Iwo' },
};

// National hub coordinates for fallback mapping of other states
const NATIONAL_HUBS: Record<string, { lat: number; lng: number; name: string }> = {
  'LA': { lat: 6.5244, lng: 3.3792, name: 'Lagos' },
  'FC': { lat: 9.0765, lng: 7.3986, name: 'FCT Abuja' },
  'KN': { lat: 12.0022, lng: 8.5920, name: 'Kano' },
  'RV': { lat: 4.8156, lng: 7.0498, name: 'Rivers / Port Harcourt' },
  'KD': { lat: 10.5105, lng: 7.4165, name: 'Kaduna' },
  'EN': { lat: 6.4584, lng: 7.5464, name: 'Enugu' },
  'OY': { lat: 7.3775, lng: 3.9470, name: 'Oyo / Ibadan' },
  'ED': { lat: 6.3350, lng: 5.6037, name: 'Edo / Benin' },
  'AN': { lat: 6.2209, lng: 7.0670, name: 'Anambra / Awka' },
  'DT': { lat: 5.5167, lng: 5.7500, name: 'Delta / Warri' },
};

// OSUN bounding box for vector map projection
const OSUN_BOUNDS = {
  minLat: 7.15,
  maxLat: 8.15,
  minLng: 4.05,
  maxLng: 5.05
};

export interface MappedIncidentPoint {
  incident: Incident;
  lat: number;
  lng: number;
  puId: string;
  puName: string;
  lga: string;
  state: string;
  hasDirectGPS: boolean;
}

export interface IncidentMapOverlayProps {
  incidents: Incident[];
  reports?: Report[];
  selectedIncidentId?: string | null;
  onSelectIncident?: (incident: Incident) => void;
  onFilterPollingUnit?: (puId: string) => void;
  thresholdConfig?: IncidentAlertThresholdConfig;
  className?: string;
  defaultExpanded?: boolean;
}

export default function IncidentMapOverlay({
  incidents,
  reports = [],
  selectedIncidentId,
  onSelectIncident,
  onFilterPollingUnit,
  thresholdConfig,
  className = '',
  defaultExpanded = true
}: IncidentMapOverlayProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [mapEngine, setMapEngine] = useState<'vector' | 'google'>(GOOGLE_MAPS_API_KEY ? 'google' : 'vector');
  const [activeSeverity, setActiveSeverity] = useState<string>('all');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [selectedPoint, setSelectedPoint] = useState<MappedIncidentPoint | null>(null);
  const [heatmapView, setHeatmapView] = useState<boolean>(false);

  // Vector map zoom & pan state
  const [vectorZoom, setVectorZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Cross-reference reports for explicit device GPS coordinates
  const reportLocationMap = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    reports.forEach(r => {
      if (r.id && r.location?.lat && r.location?.lng) {
        map.set(r.id, { lat: r.location.lat, lng: r.location.lng });
      }
    });
    return map;
  }, [reports]);

  // Geocode every incident with deterministic, jitter-aware coordinates
  const mappedPoints: MappedIncidentPoint[] = useMemo(() => {
    return incidents.map(inc => {
      const puId = inc.pollingUnitId?.trim() || '';
      let lat: number | null = null;
      let lng: number | null = null;
      let hasDirectGPS = false;

      // 1. Direct device GPS from reports
      if (inc.reportId && reportLocationMap.has(inc.reportId)) {
        const coords = reportLocationMap.get(inc.reportId)!;
        lat = coords.lat;
        lng = coords.lng;
        hasDirectGPS = true;
      }

      // Metadata lookup from known Osun station directory
      const stationInfo = KNOWN_STATION_NAMES[puId];
      let lga = stationInfo?.lga || 'Osogbo';
      let state = 'Osun';
      let puName = stationInfo?.name || `Polling Station #${puId}`;

      // Detect state code from PU ID (e.g. PU-OS-..., PU-LA-...)
      const match = puId.match(/PU-([A-Z]{2})/i);
      if (match) {
        const stCode = match[1].toUpperCase();
        if (STATE_CODE_MAP[stCode]) {
          state = STATE_CODE_MAP[stCode];
        }
      }

      // If no GPS yet, resolve from known LGA centroid or National Hub
      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
        let baseCoord = LGA_CENTROIDS[lga] || LGA_CENTROIDS['Osogbo'];

        if (state !== 'Osun' && match) {
          const stCode = match[1].toUpperCase();
          if (NATIONAL_HUBS[stCode]) {
            baseCoord = NATIONAL_HUBS[stCode];
            lga = baseCoord.name;
          }
        }

        // Apply stable, deterministic hash jitter based on PU ID so pins don't overlap exactly
        const hash = puId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const latOffset = (((hash * 17) % 100) - 50) * 0.0006;
        const lngOffset = (((hash * 31) % 100) - 50) * 0.0006;

        lat = baseCoord.lat + latOffset;
        lng = baseCoord.lng + lngOffset;
      }

      return {
        incident: inc,
        lat,
        lng,
        puId,
        puName,
        lga,
        state,
        hasDirectGPS
      };
    });
  }, [incidents, reportLocationMap]);

  // Filter mapped points based on overlay severity and status filters
  const filteredPoints = useMemo(() => {
    return mappedPoints.filter(pt => {
      const matchSev = activeSeverity === 'all' || pt.incident.severity === activeSeverity;
      const matchStat = activeStatus === 'all' || pt.incident.status === activeStatus;
      return matchSev && matchStat;
    });
  }, [mappedPoints, activeSeverity, activeStatus]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = mappedPoints.length;
    const critical = mappedPoints.filter(p => p.incident.severity === 'critical').length;
    const high = mappedPoints.filter(p => p.incident.severity === 'high').length;
    const investigating = mappedPoints.filter(p => p.incident.status === 'investigating').length;
    const resolved = mappedPoints.filter(p => p.incident.status === 'resolved').length;
    
    // Group by LGA
    const lgaCounts: Record<string, number> = {};
    mappedPoints.forEach(p => {
      lgaCounts[p.lga] = (lgaCounts[p.lga] || 0) + 1;
    });

    const topLGAs = Object.entries(lgaCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return { total, critical, high, investigating, resolved, topLGAs };
  }, [mappedPoints]);

  // Polling unit groupings (for cluster counts at same PU)
  const puClusterMap = useMemo(() => {
    const map = new Map<string, MappedIncidentPoint[]>();
    filteredPoints.forEach(p => {
      if (!map.has(p.puId)) {
        map.set(p.puId, []);
      }
      map.get(p.puId)!.push(p);
    });
    return map;
  }, [filteredPoints]);

  // Keep selectedPoint in sync if selectedIncidentId changes
  useEffect(() => {
    if (selectedIncidentId) {
      const pt = mappedPoints.find(p => p.incident.id === selectedIncidentId);
      if (pt) setSelectedPoint(pt);
    }
  }, [selectedIncidentId, mappedPoints]);

  // Vector map mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetVectorView = () => {
    setVectorZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Convert lat/lng to Vector SVG coordinate percentages
  const projectToSVG = (lat: number, lng: number) => {
    // Normalizes to 0-100% within Osun / SW Nigeria bounding region
    const x = ((lng - OSUN_BOUNDS.minLng) / (OSUN_BOUNDS.maxLng - OSUN_BOUNDS.minLng)) * 100;
    const y = ((OSUN_BOUNDS.maxLat - lat) / (OSUN_BOUNDS.maxLat - OSUN_BOUNDS.minLat)) * 100;
    return {
      x: Math.max(4, Math.min(96, x)),
      y: Math.max(4, Math.min(96, y))
    };
  };

  // Marker icon generator for Google Maps
  const getSeverityPinIcon = (severity: string, isHotspot: boolean) => {
    const color = 
      severity === 'critical' ? '#DC2626' :
      severity === 'high' ? '#EA580C' :
      severity === 'medium' ? '#D97706' : '#2563EB';

    const ring = isHotspot ? `<circle cx="15" cy="15" r="14" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="3,3"/>` : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      ${ring}
      <path fill="${color}" stroke="#FFFFFF" stroke-width="2.5" d="M16 2C9.37 2 4 7.37 4 14c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z"/>
      <circle cx="16" cy="14" r="5" fill="#FFFFFF"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };

  return (
    <div className={`rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all ${className} ${
      isFullscreen ? 'fixed inset-4 z-50 rounded-3xl shadow-2xl flex flex-col' : ''
    }`}>
      {/* Top Header & Metrics Bar */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center font-bold shadow-xs">
            <MapPin className="w-5 h-5 text-red-600 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 tracking-tight font-serif flex items-center gap-2">
                <span>Tactical Incident Map Overlay</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-red-100 text-red-800 border border-red-200">
                {filteredPoints.length} {filteredPoints.length === 1 ? 'Pin' : 'Pins'} Mapped
              </span>
              {stats.critical > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1 shadow-xs">
                  <Flame className="w-3 h-3" />
                  {stats.critical} Critical
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Real-time spatial distribution across Polling Units & electoral corridors.
            </p>
          </div>
        </div>

        {/* Map Header Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Map Engine Toggle */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-gray-200 shadow-2xs text-xs font-bold">
            <button
              type="button"
              onClick={() => setMapEngine('vector')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                mapEngine === 'vector' 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Switch to Vector Geospatial Cartographic Mode"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Cartographic</span>
            </button>
            <button
              type="button"
              onClick={() => setMapEngine('google')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                mapEngine === 'google' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Switch to Google Maps Satellite/Roadmap Mode"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Google Maps</span>
            </button>
          </div>

          {/* Density Heatmap Toggle */}
          <button
            type="button"
            onClick={() => setHeatmapView(!heatmapView)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              heatmapView
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-200'
            }`}
            title="Toggle incident concentration density rings"
          >
            <Radio className={`w-3.5 h-3.5 ${heatmapView ? 'text-amber-700 animate-pulse' : 'text-gray-400'}`} />
            <span className="hidden sm:inline">Density Rings</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-2xs transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen Overlay'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Expand / Minimize Accordion */}
          {!isFullscreen && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-2xs transition-all cursor-pointer"
              title={isExpanded ? 'Collapse Map' : 'Expand Map'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Main Map Body (Collapsible) */}
      <AnimatePresence>
        {(isExpanded || isFullscreen) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: isFullscreen ? 'calc(100vh - 120px)' : '480px' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative w-full bg-slate-950 overflow-hidden flex flex-col"
          >
            {/* Overlay Interactive Filter Toolbar */}
            <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 max-w-[calc(100%-80px)]">
              {/* Severity Filter Chips */}
              <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-md text-[11px] font-bold">
                <span className="px-2 text-slate-400 font-semibold hidden md:inline">Severity:</span>
                {['all', 'critical', 'high', 'medium', 'low'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActiveSeverity(s)}
                    className={`px-2 py-0.5 rounded-lg capitalize transition-all cursor-pointer ${
                      activeSeverity === s 
                        ? s === 'critical' ? 'bg-red-600 text-white' :
                          s === 'high' ? 'bg-orange-600 text-white' :
                          s === 'medium' ? 'bg-amber-500 text-white' :
                          s === 'low' ? 'bg-blue-600 text-white' :
                          'bg-slate-700 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Status Filter Chips */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-md text-[11px] font-bold">
                <span className="px-2 text-slate-400 font-semibold">Status:</span>
                {['all', 'pending', 'investigating', 'resolved'].map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setActiveStatus(st)}
                    className={`px-2 py-0.5 rounded-lg capitalize transition-all cursor-pointer ${
                      activeStatus === st 
                        ? 'bg-emerald-600 text-white' 
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Top LGAs Quick Focus Pill Buttons */}
              <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-700/70 text-[11px]">
                <span className="text-slate-400 font-medium">Hotspots:</span>
                {stats.topLGAs.map(([lga, count]) => (
                  <span
                    key={lga}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-mono"
                  >
                    <span>{lga}</span>
                    <span className="font-bold text-red-400 font-sans">({count})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Vector Map Controls (Zoom In, Out, Reset) */}
            {mapEngine === 'vector' && (
              <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700 shadow-md">
                <button
                  type="button"
                  onClick={() => setVectorZoom(prev => Math.min(3, prev + 0.3))}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setVectorZoom(prev => Math.max(0.7, prev - 0.3))}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={resetVectorView}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                  title="Reset Map Position"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ENGINE 1: GOOGLE MAPS */}
            {mapEngine === 'google' && (
              GOOGLE_MAPS_API_KEY ? (
                <div className="w-full h-full relative">
                  <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                    <Map
                      style={{ width: '100%', height: '100%' }}
                      defaultCenter={{ lat: 7.7827, lng: 4.5418 }} // Osogbo, Osun State
                      defaultZoom={9}
                      gestureHandling={'greedy'}
                      disableDefaultUI={false}
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    >
                      {filteredPoints.map((pt) => {
                        const isHotspot = pt.incident.severity === 'critical';
                        const iconUrl = getSeverityPinIcon(pt.incident.severity, isHotspot);

                        return (
                          <Marker
                            key={pt.incident.id}
                            position={{ lat: pt.lat, lng: pt.lng }}
                            icon={iconUrl}
                            onClick={() => {
                              setSelectedPoint(pt);
                              if (onSelectIncident) onSelectIncident(pt.incident);
                            }}
                          />
                        );
                      })}

                      {selectedPoint && (
                        <InfoWindow
                          position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
                          onCloseClick={() => setSelectedPoint(null)}
                        >
                          <div className="p-2 min-w-[240px] max-w-[300px] text-gray-900">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                selectedPoint.incident.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                selectedPoint.incident.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                selectedPoint.incident.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {selectedPoint.incident.severity}
                              </span>
                              <span className="text-[11px] font-mono font-bold text-gray-700">#{selectedPoint.puId}</span>
                            </div>

                            <h4 className="text-xs font-bold text-gray-900 leading-snug">
                              {selectedPoint.puName}
                            </h4>
                            <div className="text-[11px] text-gray-500 mb-2">
                              {selectedPoint.lga}, {selectedPoint.state}
                            </div>

                            <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100 mb-2.5 line-clamp-3">
                              "{selectedPoint.incident.description}"
                            </p>

                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px]">
                              <span className="font-bold capitalize text-gray-500">Status: {selectedPoint.incident.status}</span>
                              <Link
                                to={`/incidents/${selectedPoint.incident.id}`}
                                className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
                              >
                                <span>Details</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>
                        </InfoWindow>
                      )}
                    </Map>
                  </APIProvider>
                </div>
              ) : (
                /* Informative Fallback for Google Maps Key */
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-300 bg-slate-900">
                  <Globe className="w-12 h-12 text-slate-500 mb-3" />
                  <h4 className="text-lg font-bold text-white font-serif">Google Maps API Key Not Detected</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md">
                    To use Google Satellite and Street Map, configure <code>VITE_GOOGLE_MAPS_API_KEY</code> in your environment or obtain a zero-cost <strong>Maps Demo Key</strong> for prototyping.
                  </p>
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setMapEngine('vector')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <Compass className="w-4 h-4" />
                      <span>Switch to Cartographic Vector Map</span>
                    </button>
                    <a
                      href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1"
                    >
                      <span>Get Free Demo Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )
            )}

            {/* ENGINE 2: VECTOR CARTOGRAPHIC MAP (100% Client-Side & High-Res) */}
            {mapEngine === 'vector' && (
              <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="w-full h-full relative cursor-grab active:cursor-grabbing select-none overflow-hidden"
              >
                {/* Vector Canvas Container with Pan/Zoom Transform */}
                <div
                  className="w-full h-full transition-transform duration-75 origin-center relative"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${vectorZoom})`
                  }}
                >
                  {/* Background Geography Grid & Contour SVG */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
                      </pattern>
                      <radialGradient id="heatGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                        <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Stylized Contour of Osun State Electoral Territory */}
                    <path
                      d="M 180,90 Q 280,70 420,95 T 660,110 Q 780,180 820,280 T 790,440 Q 680,510 520,490 T 260,460 Q 140,390 120,280 Z"
                      fill="rgba(16, 185, 129, 0.03)"
                      stroke="rgba(16, 185, 129, 0.25)"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />

                    {/* Major LGA Sector Boundaries */}
                    <circle cx="48%" cy="44%" r="130" fill="rgba(59, 130, 246, 0.02)" stroke="rgba(59, 130, 246, 0.15)" strokeWidth="1.5" />
                    <text x="50%" y="42%" fill="rgba(255, 255, 255, 0.25)" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="2">
                      OSOGBO METROPOLITAN SECTOR
                    </text>
                    <text x="70%" y="60%" fill="rgba(255, 255, 255, 0.15)" fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="1">
                      ILESA EAST / WEST
                    </text>
                    <text x="32%" y="64%" fill="rgba(255, 255, 255, 0.15)" fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="1">
                      ILE-IFE / ENUWA
                    </text>
                    <text x="25%" y="38%" fill="rgba(255, 255, 255, 0.15)" fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="1">
                      EDE SOUTH / NORTH
                    </text>
                  </svg>

                  {/* Render Density Heatmap Glows if Enabled */}
                  {heatmapView && (
                    <div className="absolute inset-0 pointer-events-none">
                      {Object.entries(LGA_CENTROIDS).map(([lgaName, coord]) => {
                        const { x, y } = projectToSVG(coord.lat, coord.lng);
                        const count = mappedPoints.filter(p => p.lga === lgaName).length;
                        if (count === 0) return null;
                        const radius = Math.min(180, 50 + count * 20);

                        return (
                          <div
                            key={lgaName}
                            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none animate-pulse"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              width: `${radius}px`,
                              height: `${radius}px`,
                              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.35) 0%, rgba(245, 158, 11, 0.15) 50%, transparent 70%)'
                            }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Render Cluster Pins on Vector Map */}
                  {Array.from(puClusterMap.entries()).map(([puId, pts]) => {
                    const primary = pts[0];
                    const { x, y } = projectToSVG(primary.lat, primary.lng);
                    const isSelected = selectedPoint?.puId === puId;
                    const hasCritical = pts.some(p => p.incident.severity === 'critical');
                    const hasHigh = pts.some(p => p.incident.severity === 'high');
                    const isBreached = thresholdConfig?.enabled && pts.length >= (thresholdConfig.incidentCountThreshold || 2);

                    const pinColor = hasCritical ? 'bg-red-600 border-white text-white' :
                                    hasHigh ? 'bg-orange-500 border-white text-white' :
                                    'bg-blue-600 border-white text-white';

                    return (
                      <div
                        key={puId}
                        style={{ left: `${x}%`, top: `${y}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPoint(primary);
                          if (onSelectIncident) onSelectIncident(primary.incident);
                        }}
                      >
                        {/* Hotspot Radar Pulse Ring */}
                        {(hasCritical || isBreached) && (
                          <span className="absolute -inset-2 rounded-full bg-red-500/40 animate-ping pointer-events-none" />
                        )}

                        {/* Interactive Pin Bubble */}
                        <motion.div
                          whileHover={{ scale: 1.25 }}
                          whileTap={{ scale: 0.95 }}
                          className={`relative flex items-center justify-center rounded-2xl shadow-lg border-2 transition-all ${pinColor} ${
                            isSelected ? 'ring-4 ring-emerald-400 scale-125 z-30' : ''
                          } ${pts.length > 1 ? 'px-2 py-1 gap-1 text-[11px] font-mono font-black' : 'w-7 h-7'}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {pts.length > 1 && <span>{pts.length}</span>}
                        </motion.div>

                        {/* Hover Tooltip Label */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                          <div className="px-2.5 py-1 bg-slate-900/95 text-white text-[10px] font-bold rounded-lg border border-slate-700 whitespace-nowrap shadow-xl flex items-center gap-1.5">
                            <span className="font-mono">#{puId}</span>
                            <span className="text-slate-400">({pts.length} {pts.length === 1 ? 'incident' : 'incidents'})</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Vector Map Legend & Controls Footer */}
                <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
                    <span>Critical</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
                    <span>High</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                    <span>Med/Low</span>
                  </div>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">Drag to Pan • Scroll to Zoom</span>
                </div>
              </div>
            )}

            {/* Selected Incident Popout Drawer / Card */}
            <AnimatePresence>
              {selectedPoint && (
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  className="absolute bottom-4 right-4 z-30 w-80 md:w-96 bg-white/95 backdrop-blur-md rounded-3xl border border-gray-200 shadow-2xl p-5 text-gray-900"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        selectedPoint.incident.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        selectedPoint.incident.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        selectedPoint.incident.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {selectedPoint.incident.severity}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700">
                        {selectedPoint.incident.status}
                      </span>
                      <span className="text-xs font-mono font-bold text-gray-500">
                        #{selectedPoint.puId}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedPoint(null)}
                      className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="text-sm font-bold text-gray-900 leading-snug">
                    {selectedPoint.puName}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedPoint.lga}, {selectedPoint.state}
                  </p>

                  <div className="mt-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-700 leading-relaxed max-h-24 overflow-y-auto">
                    "{selectedPoint.incident.description}"
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                    <div className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {(selectedPoint.incident.timestamp as any)?.toDate 
                          ? formatDistanceToNow((selectedPoint.incident.timestamp as any).toDate(), { addSuffix: true })
                          : 'Recorded'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {onFilterPollingUnit && (
                        <button
                          type="button"
                          onClick={() => {
                            onFilterPollingUnit(selectedPoint.puId);
                            if (isFullscreen) setIsFullscreen(false);
                          }}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs transition-all cursor-pointer"
                        >
                          Filter Table
                        </button>
                      )}
                      <Link
                        to={`/incidents/${selectedPoint.incident.id}`}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>Details</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
