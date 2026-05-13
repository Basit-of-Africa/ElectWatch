import React, { useEffect, useState } from 'react';
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Report } from '../types';
import { AlertTriangle, MapPin, Clock, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function MapPage() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    if (!user) return;

    // Observers only see their own markers to comply with security rules
    const reportsBaseQuery = collection(db, 'reports');
    const q = (!isAdmin && !isSupervisor)
      ? query(reportsBaseQuery, where('observerId', '==', user.uid))
      : query(reportsBaseQuery);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Report))
        .filter(r => r.location && r.location.lat && r.location.lng);
      setReports(docs);
    });

    return () => unsubscribe();
  }, []);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center p-10">
        <MapPin className="w-20 h-20 text-gray-200 mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 font-serif">Map Key Required</h2>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          Please add <code>VITE_GOOGLE_MAPS_API_KEY</code> to your environment variables to enable the interactive field map.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight font-serif italic">Tactical Map</h1>
          <p className="text-gray-500 mt-2 text-lg font-medium">Real-time geographic visualization of field operations.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-[10px] font-bold text-gray-400 uppercase">Incident</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-gray-400 uppercase">Accreditation</span>
           </div>
        </div>
      </div>

      <div className="flex-1 rounded-[40px] overflow-hidden border-8 border-white shadow-2xl relative">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <Map
            style={{ width: '100%', height: '100%' }}
            defaultCenter={{ lat: 9.0820, lng: 8.6753 }} // Nigeria center
            defaultZoom={6}
            gestureHandling={'greedy'}
            disableDefaultUI={false}
          >
            {reports.map((report) => (
              <Marker
                key={report.id}
                position={{ lat: report.location!.lat, lng: report.location!.lng }}
                onClick={() => setSelectedReport(report)}
              />
            ))}

            {selectedReport && (
              <InfoWindow
                position={{ lat: selectedReport.location!.lat, lng: selectedReport.location!.lng }}
                onCloseClick={() => setSelectedReport(null)}
              >
                <div className="p-4 min-w-[200px] max-w-[280px]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      selectedReport.type === 'incident' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {selectedReport.type}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">#{selectedReport.pollingUnitId}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 leading-tight mb-2">
                    {selectedReport.payload?.description || 'No description provided'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 border-t pt-2 mt-2">
                    <Clock className="w-3 h-3" />
                    {new Date(selectedReport.timestamp as any).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>

        {reports.length === 0 && (
          <div className="absolute bottom-10 left-10 p-6 bg-white/90 backdrop-blur-md rounded-3xl border border-white shadow-xl max-w-xs transition-all animate-in fade-in slide-in-from-bottom-5">
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="text-emerald-600 w-5 h-5" />
              Limited Geographic Data
            </h4>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              Most reports currently missing GPS coordinates. Map only displays reports submitted with geolocation enabled.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
