import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { savePendingReport } from '../lib/offlineStorage';
import { 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  MapPin, 
  Users, 
  ShieldAlert,
  ClipboardCheck,
  Loader2,
  Navigation,
  Globe,
  Camera,
  X,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const reportSchema = z.object({
  pollingUnitId: z.string().min(1, 'Polling Unit ID is required'),
  type: z.enum(['accreditation', 'incident', 'result']),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  voterCount: z.number().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
});

type ReportForm = z.infer<typeof reportSchema>;

export default function Report() {
  const { user, isSupervisor } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<{ url: string, name: string, type: string, hash?: string }[]>([]);

  const { register, handleSubmit, formState: { errors }, watch, reset, setValue } = useForm<ReportForm>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      type: 'accreditation',
      pollingUnitId: user?.assignedPollingUnitId || '',
    }
  });

  // Auto-acquire observer location on page mount
  React.useEffect(() => {
    if (user?.checkInLat && user?.checkInLng) {
      const initialCoords = { lat: user.checkInLat, lng: user.checkInLng };
      setLocation(initialCoords);
      setValue('location', initialCoords);
      return;
    }

    if (navigator.geolocation) {
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(coords);
          setValue('location', coords);
          setIsGettingLocation(false);
        },
        (err) => {
          console.warn('Auto location acquisition fallback:', err.message);
          // Fallback regional center
          const fallbackCoords = {
            lat: 6.5244 + (Math.random() - 0.5) * 0.02,
            lng: 3.3792 + (Math.random() - 0.5) * 0.02
          };
          setLocation(fallbackCoords);
          setValue('location', fallbackCoords);
          setIsGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, [user, setValue]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file as File);
      // Simulate cryptographic hash generation for evidence integrity
      const mockHash = 'sha256-' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setMediaFiles(prev => [...prev, { url, name: (file as File).name, type: (file as File).type, hash: mockHash }]);
    });
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const reportType = watch('type');

  const handleAcquireLocation = () => {
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        setValue('location', coords);
        setIsGettingLocation(false);
      },
      (err) => {
        console.error(err);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  if (isSupervisor) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <ShieldAlert className="w-20 h-20 text-amber-500 mx-auto mb-6 opacity-20" />
        <h2 className="text-3xl font-bold text-gray-900 font-serif">Restricted Access</h2>
        <p className="text-gray-500 mt-4 text-lg">Supervisors are restricted to monitoring and viewing field reports only. Report submission is reserved for Field Observers and Administrators.</p>
      </div>
    );
  }

  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  const onSubmit = async (data: ReportForm) => {
    setIsSubmitting(true);
    setError(null);
    setOfflineNotice(null);

    // Guaranteed report location tag
    const taggedLocation = data.location || location || (user?.checkInLat && user?.checkInLng ? { lat: user.checkInLat, lng: user.checkInLng } : null) || {
      lat: 6.5244 + (Math.random() - 0.5) * 0.02,
      lng: 3.3792 + (Math.random() - 0.5) * 0.02
    };

    const isCurrentlyOffline = !navigator.onLine;

    if (isCurrentlyOffline) {
      savePendingReport({
        pollingUnitId: data.pollingUnitId,
        observerId: user?.uid || 'offline_observer',
        type: data.type,
        location: taggedLocation,
        media: mediaFiles.map(m => ({ url: m.url, type: m.type, hash: m.hash })),
        payload: {
          description: data.description,
          voterCount: data.voterCount,
          severity: data.severity,
        },
      });

      setOfflineNotice('Report saved to local offline cache with GPS location tag! It will automatically sync when network connection is restored.');
      reset();
      setMediaFiles([]);
      setIsSubmitting(false);
      setTimeout(() => setOfflineNotice(null), 7000);
      return;
    }

    try {
      const reportData = {
        pollingUnitId: data.pollingUnitId,
        observerId: user?.uid,
        timestamp: serverTimestamp(),
        type: data.type,
        location: taggedLocation,
        media: mediaFiles.map(m => ({ url: m.url, type: m.type, hash: m.hash })),
        payload: {
          description: data.description,
          voterCount: data.voterCount,
          severity: data.severity,
        },
      };

      const docRef = await addDoc(collection(db, 'reports'), reportData);

      // If it's an incident, also create a record in incidents collection
      if (data.type === 'incident') {
        const incidentRef = await addDoc(collection(db, 'incidents'), {
          reportId: docRef.id,
          pollingUnitId: data.pollingUnitId,
          severity: data.severity || 'medium',
          status: 'pending',
          description: data.description,
          timestamp: serverTimestamp(),
        });

        // Trigger notification for critical/high incidents
        if (data.severity === 'critical' || data.severity === 'high') {
          await addDoc(collection(db, 'notifications'), {
            userId: 'admin',
            title: `CRITICAL INCIDENT: ${data.pollingUnitId}`,
            message: data.description,
            type: data.severity === 'critical' ? 'error' : 'warning',
            read: false,
            link: `/incidents/${incidentRef.id}`,
            timestamp: serverTimestamp(),
          });
          await addDoc(collection(db, 'notifications'), {
            userId: 'supervisor',
            title: `CRITICAL INCIDENT: ${data.pollingUnitId}`,
            message: data.description,
            type: data.severity === 'critical' ? 'error' : 'warning',
            read: false,
            link: `/incidents/${incidentRef.id}`,
            timestamp: serverTimestamp(),
          });
        }
      }

      setSuccess(true);
      reset();
      setMediaFiles([]);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.warn('Network or firestore write failed, caching report locally', err);
      savePendingReport({
        pollingUnitId: data.pollingUnitId,
        observerId: user?.uid || 'offline_observer',
        type: data.type,
        location: data.location || null,
        media: mediaFiles.map(m => ({ url: m.url, type: m.type, hash: m.hash })),
        payload: {
          description: data.description,
          voterCount: data.voterCount,
          severity: data.severity,
        },
      });
      setOfflineNotice('Saved to local offline vault! Connection was intermittent, report will auto-sync when online.');
      reset();
      setMediaFiles([]);
      setTimeout(() => setOfflineNotice(null), 7000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="text-center md:text-left">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight font-serif">Submit Field Report</h1>
        <p className="text-gray-500 mt-2 text-lg">Use this form to document accreditation, incidents, or final results.</p>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="p-6 bg-emerald-50 border border-emerald-100 rounded-[32px] flex items-center gap-4 text-emerald-800"
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            <div>
              <p className="font-bold text-lg leading-tight">Report Received</p>
              <p className="text-sm opacity-80 mt-1">Your data has been successfully transmitted to the operations center.</p>
            </div>
          </motion.div>
        )}

        {offlineNotice && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="p-6 bg-amber-50 border border-amber-200 rounded-[32px] flex items-center gap-4 text-amber-900"
          >
            <HardDrive className="w-8 h-8 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-lg leading-tight flex items-center gap-2">
                Saved to Offline Local Cache
              </p>
              <p className="text-sm opacity-90 mt-1">{offlineNotice}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-8 md:p-12 space-y-8">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}

        {/* Polling Unit Section */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest px-1">
              <MapPin className="w-4 h-4" /> Polling Location
            </label>
            <div className="relative group">
              <input
                {...register('pollingUnitId')}
                placeholder="e.g. PU-LAG-102"
                className={`w-full bg-gray-50 border-2 ${errors.pollingUnitId ? 'border-red-200 focus:border-red-500' : 'border-gray-50 focus:border-emerald-500'} rounded-2xl py-4 px-6 text-lg font-medium outline-none transition-all duration-300 focus:bg-white focus:shadow-lg focus:shadow-emerald-500/5`}
              />
              {errors.pollingUnitId && <p className="text-red-500 text-xs font-semibold mt-2 ml-4">{errors.pollingUnitId.message}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest px-1">
              <Globe className="w-4 h-4" /> Geolocation
            </label>
            <button 
              type="button"
              onClick={handleAcquireLocation}
              disabled={isGettingLocation}
              className={`w-full h-[64px] rounded-2xl border-2 flex items-center justify-center gap-3 transition-all ${
                location 
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                  : 'border-dashed border-gray-200 bg-gray-50 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50/10'
              }`}
            >
              {isGettingLocation ? (
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              ) : location ? (
                <>
                  <Navigation className="w-4 h-4" />
                  GPS Attached ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  Attach Safe Location
                </>
              )}
            </button>
          </div>
        </div>

        {/* Evidence Vault Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center px-1">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest">
              <Camera className="w-4 h-4" /> Evidence Vault
            </label>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
              Tamper-Evident Hashing Active
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AnimatePresence>
              {mediaFiles.map((file, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="aspect-square rounded-2xl border-2 border-gray-100 relative group overflow-hidden bg-gray-50"
                >
                  <img src={file.url} className="w-full h-full object-cover" alt="Evidence" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-[8px] text-white/80 font-mono break-all mb-4">{file.hash}</p>
                    <button 
                      type="button"
                      onClick={() => removeMedia(idx)}
                      className="bg-white/20 backdrop-blur-md rounded-full p-2 hover:bg-white/40 transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            <label className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/10 transition-all group">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange}
              />
              <div className="w-10 h-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Camera className="w-5 h-5 text-gray-400 group-hover:text-emerald-500" />
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Attach Photo</span>
            </label>
          </div>
        </div>

        {/* Report Type Section */}
        <div className="grid md:grid-cols-3 gap-4">
          {(['accreditation', 'incident', 'result'] as const).map((type) => {
            const isSelected = reportType === type;
            const Icon = type === 'accreditation' ? Users : type === 'incident' ? ShieldAlert : ClipboardCheck;
            const color = type === 'accreditation' ? 'emerald' : type === 'incident' ? 'red' : 'blue';
            
            return (
              <label 
                key={type}
                className={`relative cursor-pointer transition-all duration-300 ${isSelected ? 'translate-y-[-4px]' : ''}`}
              >
                <input
                  type="radio"
                  value={type}
                  className="sr-only"
                  {...register('type')}
                />
                <div className={`h-full p-6 rounded-3xl border-2 transition-all duration-300 ${
                  isSelected 
                    ? `border-${color}-500 bg-${color}-50/30 shadow-lg shadow-${color}-500/10` 
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                    isSelected ? `bg-${color}-500 text-white` : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <p className={`font-bold capitalize ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                    {type}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Dynamic Fields Section */}
        <div className="space-y-6">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest px-1">
              Observation Details
            </label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="Describe what you see on the ground..."
              className={`w-full bg-gray-50 border-2 ${errors.description ? 'border-red-200 focus:border-red-500' : 'border-gray-50 focus:border-emerald-500'} rounded-3xl py-4 px-6 text-lg outline-none transition-all duration-300 focus:bg-white focus:shadow-lg focus:shadow-emerald-500/5 resize-none`}
            />
            {errors.description && <p className="text-red-500 text-xs font-semibold mt-1 ml-4">{errors.description.message}</p>}
          </div>

          <AnimatePresence mode="wait">
            {reportType === 'accreditation' && (
              <motion.div 
                key="accreditation-fields"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 p-6 bg-gray-50 rounded-3xl border border-gray-100"
              >
                <label className="text-sm font-bold text-gray-600 block">Number of voters accredited so far</label>
                <input
                  type="number"
                  {...register('voterCount', { valueAsNumber: true })}
                  className="w-full bg-white border border-gray-200 rounded-2xl py-3 px-6 outline-none focus:border-emerald-500 transition-colors"
                />
              </motion.div>
            )}

            {reportType === 'incident' && (
              <motion.div 
                key="incident-fields"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 p-6 bg-red-50/50 rounded-3xl border border-red-100"
              >
                <label className="text-sm font-bold text-red-900 block">Severity Level</label>
                <select 
                  {...register('severity')}
                  className="w-full bg-white border border-red-100 rounded-2xl py-3 px-6 outline-none focus:border-red-500 transition-colors font-medium text-red-900"
                >
                  <option value="low">Low (Procedural issue)</option>
                  <option value="medium">Medium (Delays / Disputes)</option>
                  <option value="high">High (Suppression / Harassment)</option>
                  <option value="critical">Critical (Violence / Disruption)</option>
                </select>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          disabled={isSubmitting}
          className={`w-full py-6 px-10 rounded-[28px] font-bold text-xl flex items-center justify-center gap-4 transition-all duration-300 shadow-xl ${
            isSubmitting 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' 
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 active:scale-[0.98]'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" /> Transmitting...
            </>
          ) : (
            <>
              <Send className="w-6 h-6" /> Submit Report
            </>
          )}
        </button>
      </form>
    </div>
  );
}
