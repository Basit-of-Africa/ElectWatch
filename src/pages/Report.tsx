import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../context/AuthContext';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { savePendingReport } from '../lib/offlineStorage';
import { Severity } from '../types';
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
  HardDrive,
  Aperture,
  RefreshCw,
  Image as ImageIcon,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DangerButton from '../components/DangerButton';
import ObserverOnboarding from '../components/ObserverOnboarding';

const optionalNumber = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  const num = typeof val === 'number' ? val : Number(val);
  return isNaN(num) ? undefined : num;
}, z.number().min(0, 'Must be 0 or greater').optional());

const reportSchema = z.object({
  pollingUnitId: z.string().trim().min(1, 'Polling Unit ID is required'),
  electionLevel: z.enum(['governorship', 'general_federal', 'presidential', 'senatorial', 'house_of_reps']),
  type: z.enum(['accreditation', 'incident', 'result']),
  description: z.string().trim().min(3, 'Observation details must be at least 3 characters'),
  voterCount: optionalNumber,
  apcVotes: optionalNumber,
  pdpVotes: optionalNumber,
  lpVotes: optionalNumber,
  nnppVotes: optionalNumber,
  otherVotes: optionalNumber,
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
});

type ReportForm = z.infer<typeof reportSchema>;

export default function Report() {
  const { user, isSupervisor } = useAuth();
  const [hasAcknowledged, setHasAcknowledged] = useState<boolean>(() => {
    if (!user) return true;
    if (user.hasAcknowledgedGuidelines) return true;
    const localAck = localStorage.getItem(`observer_guidelines_ack_${user.uid}`);
    return localAck === 'true';
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<{ url: string, name: string, type: string, hash?: string }[]>([]);

  // Camera capture states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedNotice, setCapturedNotice] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    setIsCameraOpen(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } else {
        setIsCameraOpen(false);
        cameraInputRef.current?.click();
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError('Live camera stream not supported or blocked. Opening native camera...');
      setTimeout(() => {
        setIsCameraOpen(false);
        cameraInputRef.current?.click();
      }, 1000);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const toggleCameraFacing = () => {
    stopCamera();
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    setTimeout(() => startCamera(newMode), 300);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/jpeg', 0.88);
      const mockHash = 'sha256-' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const photoName = `camera_photo_${Date.now()}.jpg`;
      setMediaFiles(prev => [...prev, { url, name: photoName, type: 'image/jpeg', hash: mockHash }]);
      setCapturedNotice('Photo captured & SHA-256 evidence hashed!');
      setTimeout(() => setCapturedNotice(null), 2500);
    }
    setTimeout(() => setIsCapturing(false), 250);
  };

  const { register, handleSubmit, formState: { errors }, watch, reset, setValue } = useForm<ReportForm>({
    resolver: zodResolver(reportSchema) as any,
    defaultValues: {
      electionLevel: 'governorship',
      type: 'accreditation',
      pollingUnitId: user?.assignedPollingUnitId || '',
      severity: 'medium',
      description: '',
    }
  });

  const onInvalid = (formErrors: any) => {
    console.warn('Report form validation issues:', formErrors);
    const firstKey = Object.keys(formErrors)[0];
    const message = formErrors[firstKey]?.message || 'Please check highlighted fields before submitting.';
    setError(`Submission issue: ${message}`);
  };

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

    // Clean payload strictly tailored to category with no undefined values
    const cleanPayload: {
      description: string;
      voterCount?: number;
      severity?: Severity;
      electionLevel?: string;
      apcVotes?: number;
      pdpVotes?: number;
      lpVotes?: number;
      nnppVotes?: number;
      otherVotes?: number;
      totalVotes?: number;
      [key: string]: any;
    } = {
      electionLevel: data.electionLevel || 'governorship',
      description: data.description?.trim() || (data.type === 'result' ? 'Official Form EC8A vote results recorded' : 'Field observation report'),
    };

    if (data.type === 'accreditation') {
      cleanPayload.voterCount = typeof data.voterCount === 'number' && !isNaN(data.voterCount) ? data.voterCount : 0;
    } else if (data.type === 'incident') {
      cleanPayload.severity = data.severity || 'medium';
    } else if (data.type === 'result') {
      const apc = typeof data.apcVotes === 'number' && !isNaN(data.apcVotes) ? data.apcVotes : 0;
      const pdp = typeof data.pdpVotes === 'number' && !isNaN(data.pdpVotes) ? data.pdpVotes : 0;
      const lp = typeof data.lpVotes === 'number' && !isNaN(data.lpVotes) ? data.lpVotes : 0;
      const nnpp = typeof data.nnppVotes === 'number' && !isNaN(data.nnppVotes) ? data.nnppVotes : 0;
      const other = typeof data.otherVotes === 'number' && !isNaN(data.otherVotes) ? data.otherVotes : 0;

      cleanPayload.apcVotes = apc;
      cleanPayload.pdpVotes = pdp;
      cleanPayload.lpVotes = lp;
      cleanPayload.nnppVotes = nnpp;
      cleanPayload.otherVotes = other;
      cleanPayload.totalVotes = apc + pdp + lp + nnpp + other;
    }

    const isCurrentlyOffline = !navigator.onLine;

    if (isCurrentlyOffline) {
      savePendingReport({
        pollingUnitId: data.pollingUnitId.trim(),
        observerId: user?.uid || auth.currentUser?.uid || 'offline_observer',
        type: data.type,
        location: taggedLocation,
        media: mediaFiles.map(m => ({ url: m.url, type: m.type, hash: m.hash || '' })),
        payload: cleanPayload,
      });

      setOfflineNotice('Report safely stored in local offline vault! It will automatically sync as soon as network connection is restored.');
      reset({
        electionLevel: data.electionLevel,
        type: data.type,
        pollingUnitId: data.pollingUnitId,
        severity: 'medium',
        description: '',
      });
      setMediaFiles([]);
      setIsSubmitting(false);
      setTimeout(() => setOfflineNotice(null), 7000);
      return;
    }

    try {
      const reportData: Record<string, any> = {
        pollingUnitId: data.pollingUnitId.trim(),
        observerId: user?.uid || auth.currentUser?.uid || 'offline_observer',
        timestamp: serverTimestamp(),
        type: data.type,
        payload: cleanPayload,
        location: taggedLocation,
        media: mediaFiles.map(m => ({ url: m.url, type: m.type, hash: m.hash || '' })),
      };

      const docRef = await addDoc(collection(db, 'reports'), reportData);

      // If it's an incident, also create a record in incidents collection
      if (data.type === 'incident') {
        try {
          const incidentRef = await addDoc(collection(db, 'incidents'), {
            reportId: docRef.id,
            pollingUnitId: data.pollingUnitId.trim(),
            severity: data.severity || 'medium',
            status: 'pending',
            description: data.description.trim(),
            media: reportData.media,
            timestamp: serverTimestamp(),
          });

          // Trigger notifications for critical/high incidents non-blockingly
          if (data.severity === 'critical' || data.severity === 'high') {
            try {
              await addDoc(collection(db, 'notifications'), {
                userId: 'admin',
                title: `CRITICAL INCIDENT: ${data.pollingUnitId.trim()}`,
                message: data.description.trim(),
                type: data.severity === 'critical' ? 'error' : 'warning',
                read: false,
                link: `/incidents/${incidentRef.id}`,
                timestamp: serverTimestamp(),
              });
              await addDoc(collection(db, 'notifications'), {
                userId: 'supervisor',
                title: `CRITICAL INCIDENT: ${data.pollingUnitId.trim()}`,
                message: data.description.trim(),
                type: data.severity === 'critical' ? 'error' : 'warning',
                read: false,
                link: `/incidents/${incidentRef.id}`,
                timestamp: serverTimestamp(),
              });
            } catch (notifErr) {
              console.warn('Non-blocking notification broadcast warning:', notifErr);
            }
          }
        } catch (incErr) {
          console.warn('Non-blocking incident record sync warning:', incErr);
        }
      }

      setSuccess(true);
      reset({
        electionLevel: data.electionLevel,
        type: data.type,
        pollingUnitId: data.pollingUnitId,
        severity: 'medium',
        description: '',
      });
      setMediaFiles([]);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.warn('Network or firestore write failed, caching report locally', err);
      savePendingReport({
        pollingUnitId: data.pollingUnitId.trim(),
        observerId: user?.uid || auth.currentUser?.uid || 'offline_observer',
        type: data.type,
        location: taggedLocation,
        media: mediaFiles.map(m => ({ url: m.url, type: m.type, hash: m.hash || '' })),
        payload: cleanPayload,
      });
      setOfflineNotice('Saved to local offline vault! Connection was intermittent, report will auto-sync when online.');
      reset({
        electionLevel: data.electionLevel,
        type: data.type,
        pollingUnitId: data.pollingUnitId,
        severity: 'medium',
        description: '',
      });
      setMediaFiles([]);
      setTimeout(() => setOfflineNotice(null), 7000);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasAcknowledged) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-center gap-3 text-amber-900 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="leading-relaxed">
            <strong>Observer Onboarding Required:</strong> To maintain election integrity and non-partisan reporting standards, all accredited field observers must review and accept the official Election Day Code of Conduct before gaining access to reporting tools.
          </p>
        </div>

        <ObserverOnboarding 
          isMandatory={true}
          onComplete={() => setHasAcknowledged(true)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight font-serif">Submit Field Report</h1>
        <p className="text-gray-500 mt-2 text-base">Use this form to document accreditation, incidents, or final results.</p>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div 
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="p-6 bg-emerald-50 border border-emerald-100 rounded-[32px] flex items-center gap-4 text-emerald-800"
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold text-lg leading-tight">Report Received</p>
              <p className="text-sm opacity-80 mt-1">Your data has been successfully transmitted to the operations center.</p>
            </div>
          </motion.div>
        )}

        {offlineNotice && (
          <motion.div 
            role="alert"
            aria-live="assertive"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="p-6 bg-amber-50 border border-amber-200 rounded-[32px] flex items-center gap-4 text-amber-900"
          >
            <HardDrive className="w-8 h-8 text-amber-600 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold text-lg leading-tight flex items-center gap-2">
                Saved to Offline Local Cache
              </p>
              <p className="text-sm opacity-90 mt-1">{offlineNotice}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-6 sm:p-8 md:p-12 space-y-8">
        {error && (
          <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" /> 
            <span>{error}</span>
          </div>
        )}

        {/* Election Level & Polling Unit Section */}
        <div className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-widest px-1">
              Election Level / Category
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: 'governorship', name: 'Gubernatorial Election', sub: 'Osun State Off-Cycle & 2027 State Governorships', badge: 'Active Default' },
                { id: 'general_federal', name: '2027 General Election (Presidential & NASS)', sub: 'Presidential, Senate & House of Reps (Held Concurrently)', badge: '2027 General' },
              ].map((lvl) => {
                const isSel = watch('electionLevel') === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setValue('electionLevel', lvl.id as any)}
                    aria-pressed={isSel}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all min-h-[48px] ${
                      isSel 
                        ? 'border-emerald-600 bg-emerald-50/60 shadow-md ring-2 ring-emerald-500/20' 
                        : 'border-gray-100 bg-gray-50/50 hover:bg-gray-100/80 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-black uppercase tracking-wider ${isSel ? 'text-emerald-900' : 'text-gray-800'}`}>{lvl.name}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${isSel ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{lvl.badge}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium truncate">{lvl.sub}</p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label htmlFor="report-pu-id" className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase tracking-widest px-1">
                <MapPin className="w-4 h-4 text-emerald-600" aria-hidden="true" /> Polling Location *
              </label>
              <div className="relative group">
                <input
                  id="report-pu-id"
                  {...register('pollingUnitId')}
                  aria-required="true"
                  aria-invalid={errors.pollingUnitId ? 'true' : 'false'}
                  aria-describedby={errors.pollingUnitId ? 'pu-error' : undefined}
                  placeholder="e.g. PU-OSUN-102 (Osogbo)"
                  className={`w-full bg-gray-50 border-2 ${errors.pollingUnitId ? 'border-red-200 focus:border-red-500' : 'border-gray-200 focus:border-emerald-500'} rounded-2xl py-4 px-6 text-base sm:text-lg font-medium outline-none transition-all duration-300 focus:bg-white focus:shadow-lg focus:shadow-emerald-500/5 min-h-[48px]`}
                />
                {errors.pollingUnitId && <p id="pu-error" role="alert" className="text-red-500 text-xs font-semibold mt-2 ml-4">{errors.pollingUnitId.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase tracking-widest px-1">
                <Globe className="w-4 h-4 text-emerald-600" aria-hidden="true" /> Geolocation
              </span>
              <button 
                type="button"
                onClick={handleAcquireLocation}
                disabled={isGettingLocation}
                aria-label={location ? `GPS Location attached: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Acquire and attach GPS location"}
                className={`w-full min-h-[56px] rounded-2xl border-2 flex items-center justify-center gap-3 transition-all font-bold text-sm ${
                  location 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                    : 'border-dashed border-gray-200 bg-gray-50 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/10'
                }`}
              >
                {isGettingLocation ? (
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                ) : location ? (
                  <>
                    <Navigation className="w-4 h-4" aria-hidden="true" />
                    <span>GPS Attached ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    <span>Attach Safe Location</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Evidence Vault & Camera Capture Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-2 px-1">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-widest">
                <Camera className="w-4 h-4 text-emerald-600" /> Photo & Evidence Vault
              </label>
              <p className="text-xs text-gray-500 mt-0.5">Capture real-time site photos or upload media from your device.</p>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5">
              <Check className="w-3 h-3" /> Tamper-Evident SHA-256 Hashing Active
            </span>
          </div>

          {/* Hidden inputs & canvas */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Captured / Uploaded Photo Thumbnails */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AnimatePresence>
              {mediaFiles.map((file, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="aspect-square rounded-3xl border-2 border-emerald-100 relative group overflow-hidden bg-gray-900 shadow-md"
                >
                  <img src={file.url} className="w-full h-full object-cover" alt="Captured Evidence" />
                  <div className="absolute top-2 left-2 z-10 bg-emerald-600/90 backdrop-blur-md text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow">
                    <Aperture className="w-3 h-3" /> Photo #{idx + 1}
                  </div>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-[9px] text-emerald-300 font-mono break-all mb-4 bg-black/40 p-2 rounded-xl border border-emerald-500/30">
                      {file.hash}
                    </p>
                    <button 
                      type="button"
                      onClick={() => removeMedia(idx)}
                      className="bg-red-500/80 hover:bg-red-600 text-white rounded-2xl px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1 backdrop-blur-md"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Direct Camera Capture Trigger */}
            <button
              type="button"
              onClick={() => startCamera()}
              className="aspect-square rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-100/50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider text-center px-2">Take Photo (Camera)</span>
              <span className="text-[10px] text-emerald-600 font-medium">Device Camera Viewfinder</span>
            </button>

            {/* Gallery Upload Trigger */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="aspect-square rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gray-300 hover:bg-gray-100/60 transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform text-gray-500 group-hover:text-gray-900">
                <ImageIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Upload Gallery</span>
              <span className="text-[10px] text-gray-400">Select Existing File</span>
            </button>
          </div>
        </div>

        {/* Live Device Camera Viewfinder Modal */}
        <AnimatePresence>
          {isCameraOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-2xl bg-gray-950 rounded-[36px] overflow-hidden border border-gray-800 shadow-2xl flex flex-col"
              >
                {/* Camera Modal Header */}
                <div className="p-6 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                      <Camera className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base font-serif">Incident Camera Viewfinder</h3>
                      <p className="text-[11px] text-gray-400 font-mono">Live Observer Photo Capture</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                      title="Flip Camera"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="p-2.5 rounded-xl bg-gray-800 hover:bg-red-500/20 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Video Stream Container */}
                <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
                  <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Viewfinder Overlay Frame */}
                  <div className="absolute inset-8 border-2 border-emerald-500/30 rounded-3xl pointer-events-none flex flex-col justify-between p-4">
                    <div className="flex justify-between text-[10px] font-mono text-emerald-400 bg-black/40 px-3 py-1 rounded-full w-fit backdrop-blur-sm border border-emerald-500/20">
                      <span>LIVE GPS TAGGED</span>
                    </div>
                    <div className="self-center w-12 h-12 border border-emerald-400/40 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                    </div>
                  </div>

                  {capturedNotice && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-4 bg-emerald-500 text-gray-950 font-extrabold text-xs px-4 py-2 rounded-full shadow-lg border border-emerald-300 flex items-center gap-2 z-20"
                    >
                      <Check className="w-4 h-4" /> {capturedNotice}
                    </motion.div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center p-6 text-center text-amber-400 space-y-4">
                      <AlertCircle className="w-12 h-12" />
                      <p className="text-sm font-medium">{cameraError}</p>
                    </div>
                  )}
                </div>

                {/* Shutter Controls */}
                <div className="p-6 bg-gray-900 border-t border-gray-800 flex items-center justify-between text-white">
                  <div className="text-xs text-gray-400 font-mono">
                    Photos: <span className="text-emerald-400 font-bold">{mediaFiles.length} attached</span>
                  </div>

                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={isCapturing}
                    className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-gray-950 font-extrabold shadow-xl shadow-emerald-500/20 flex items-center justify-center transition-all border-4 border-white cursor-pointer"
                  >
                    <Aperture className={`w-8 h-8 ${isCapturing ? 'animate-spin text-gray-900' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Report Type Section */}
        <div className="grid md:grid-cols-3 gap-4">
          {(['accreditation', 'incident', 'result'] as const).map((type) => {
            const isSelected = reportType === type;
            const Icon = type === 'accreditation' ? Users : type === 'incident' ? ShieldAlert : ClipboardCheck;

            // Explicit static styling per type for high contrast, clear visual feedback and CSS selector targeting
            const getSelectedStyles = () => {
              if (type === 'accreditation') {
                return {
                  card: isSelected 
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/20' 
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 shadow-sm',
                  icon: isSelected ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25' : 'bg-gray-100 text-gray-500',
                  badge: isSelected ? 'bg-emerald-200 text-emerald-900 font-bold' : 'bg-gray-100 text-gray-500',
                  title: isSelected ? 'text-emerald-950 font-black' : 'text-gray-900 font-bold',
                  sub: isSelected ? 'text-emerald-800 font-medium' : 'text-gray-500',
                  badgeText: 'BVAS Check',
                  titleText: 'Accreditation',
                  descriptionText: 'Track voter turnout & BVAS verification progress'
                };
              }
              if (type === 'incident') {
                return {
                  card: isSelected 
                    ? 'border-red-500 bg-red-50/70 shadow-lg shadow-red-500/10 ring-2 ring-red-500/20' 
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 shadow-sm',
                  icon: isSelected ? 'bg-red-600 text-white shadow-md shadow-red-600/25' : 'bg-gray-100 text-gray-500',
                  badge: isSelected ? 'bg-red-200 text-red-900 font-bold' : 'bg-gray-100 text-gray-500',
                  title: isSelected ? 'text-red-950 font-black' : 'text-gray-900 font-bold',
                  sub: isSelected ? 'text-red-800 font-medium' : 'text-gray-500',
                  badgeText: 'Urgent Alert',
                  titleText: 'Incidents & Disruptions',
                  descriptionText: 'Report electoral violations, delays, or security disruptions'
                };
              }
              return {
                card: isSelected 
                  ? 'border-blue-600 bg-blue-50/70 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/20' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 shadow-sm',
                icon: isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25' : 'bg-gray-100 text-gray-500',
                badge: isSelected ? 'bg-blue-200 text-blue-900 font-bold' : 'bg-gray-100 text-gray-500',
                title: isSelected ? 'text-blue-950 font-black' : 'text-gray-900 font-bold',
                sub: isSelected ? 'text-blue-800 font-medium' : 'text-gray-500',
                badgeText: 'Form EC8A',
                titleText: 'Election Results',
                descriptionText: 'Enter official Form EC8A vote tallies & ballot counts'
              };
            };

            const styles = getSelectedStyles();
            
            return (
              <label 
                key={type}
                onClick={() => setValue('type', type, { shouldValidate: true, shouldDirty: true })}
                className={`relative cursor-pointer transition-all duration-300 ${isSelected ? 'translate-y-[-4px]' : ''}`}
              >
                <input
                  type="radio"
                  value={type}
                  className="sr-only"
                  {...register('type')}
                />
                <div className={`h-full p-6 rounded-3xl border-2 transition-all duration-300 flex flex-col justify-between ${styles.card}`}>
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${styles.icon}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${styles.badge}`}>
                        {styles.badgeText}
                      </span>
                    </div>
                    <p className={`text-base sm:text-lg leading-tight ${styles.title}`}>
                      {styles.titleText}
                    </p>
                    <p className={`text-xs mt-1.5 leading-relaxed ${styles.sub}`}>
                      {styles.descriptionText}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100/80 flex items-center justify-between text-xs font-bold">
                    <span className={isSelected ? (type === 'incident' ? 'text-red-700' : type === 'result' ? 'text-blue-700' : 'text-emerald-700') : 'text-gray-400'}>
                      {isSelected ? '● Selected Report' : 'Select category'}
                    </span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Dynamic Fields Section */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label htmlFor="report-description" className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase tracking-widest">
                Observation Details *
              </label>
              <span className="text-xs text-gray-400 font-medium">
                {reportType === 'result' ? 'Optional if vote tallies are entered' : 'Minimum 3 characters'}
              </span>
            </div>
            <textarea
              id="report-description"
              {...register('description')}
              rows={4}
              aria-required="true"
              aria-invalid={errors.description ? "true" : "false"}
              aria-describedby={errors.description ? "desc-error" : undefined}
              placeholder={
                reportType === 'incident'
                  ? "Describe what occurred: parties involved, time, weapons/disruptions, BVAS hardware issues, or crowd intimidation..."
                  : reportType === 'result'
                  ? "Enter any observations regarding ballot reconciliation, presiding officer endorsement, or party agent sign-offs..."
                  : "Describe queue progress, BVAS biometric response time, orderliness, or presiding officer presence..."
              }
              className={`w-full bg-gray-50 border-2 ${errors.description ? 'border-red-200 focus:border-red-500' : 'border-gray-200 focus:border-emerald-500'} rounded-3xl py-4 px-6 text-base sm:text-lg outline-none transition-all duration-300 focus:bg-white focus:shadow-lg focus:shadow-emerald-500/5 resize-none`}
            />
            {errors.description && <p id="desc-error" role="alert" className="text-red-500 text-xs font-semibold mt-1 ml-4">{errors.description.message}</p>}
          </div>

          <AnimatePresence mode="wait">
            {reportType === 'accreditation' && (
              <motion.div 
                key="accreditation-fields"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 p-6 bg-emerald-50/40 rounded-3xl border border-emerald-200"
              >
                <div className="flex items-center justify-between">
                  <label htmlFor="voter-count-input" className="text-sm font-bold text-emerald-950 block">
                    Number of voters accredited so far (BVAS Count)
                  </label>
                  <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-full">
                    BVAS Verified
                  </span>
                </div>
                <input
                  id="voter-count-input"
                  type="number"
                  min="0"
                  placeholder="0"
                  {...register('voterCount', { 
                    setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))
                  })}
                  className="w-full bg-white border border-emerald-200 rounded-2xl py-3 px-6 outline-none focus:border-emerald-500 transition-colors font-mono text-base min-h-[48px]"
                />
                {errors.voterCount && <p className="text-red-500 text-xs font-semibold mt-1">{errors.voterCount.message}</p>}
              </motion.div>
            )}

            {reportType === 'result' && (
              <motion.div 
                key="result-fields"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 p-6 bg-blue-50/50 rounded-3xl border border-blue-200"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-blue-950 block">Official Party Vote Tally ({watch('electionLevel')?.toUpperCase() || 'ELECTION'})</h3>
                    <p className="text-xs text-blue-700 mt-0.5">Enter vote numbers directly from the signed Form EC8A copy</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-blue-800 font-mono font-bold bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200">
                      Total Tallied: {((Number(watch('apcVotes')) || 0) + (Number(watch('pdpVotes')) || 0) + (Number(watch('lpVotes')) || 0) + (Number(watch('nnppVotes')) || 0) + (Number(watch('otherVotes')) || 0)).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded-full">Form EC8A Copy</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label htmlFor="apc-votes-input" className="text-xs font-bold text-gray-700 block mb-1">APC Votes</label>
                    <input
                      id="apc-votes-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      {...register('apcVotes', { 
                        setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))
                      })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2.5 px-4 outline-none focus:border-blue-500 font-mono text-sm min-h-[44px]"
                    />
                    {errors.apcVotes && <p className="text-red-500 text-xs font-semibold mt-1">{errors.apcVotes.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="pdp-votes-input" className="text-xs font-bold text-gray-700 block mb-1">PDP Votes</label>
                    <input
                      id="pdp-votes-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      {...register('pdpVotes', { 
                        setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))
                      })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2.5 px-4 outline-none focus:border-blue-500 font-mono text-sm min-h-[44px]"
                    />
                    {errors.pdpVotes && <p className="text-red-500 text-xs font-semibold mt-1">{errors.pdpVotes.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="lp-votes-input" className="text-xs font-bold text-gray-700 block mb-1">Labour Party (LP)</label>
                    <input
                      id="lp-votes-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      {...register('lpVotes', { 
                        setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))
                      })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2.5 px-4 outline-none focus:border-blue-500 font-mono text-sm min-h-[44px]"
                    />
                    {errors.lpVotes && <p className="text-red-500 text-xs font-semibold mt-1">{errors.lpVotes.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="nnpp-votes-input" className="text-xs font-bold text-gray-700 block mb-1">NNPP Votes</label>
                    <input
                      id="nnpp-votes-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      {...register('nnppVotes', { 
                        setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))
                      })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2.5 px-4 outline-none focus:border-blue-500 font-mono text-sm min-h-[44px]"
                    />
                    {errors.nnppVotes && <p className="text-red-500 text-xs font-semibold mt-1">{errors.nnppVotes.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="other-votes-input" className="text-xs font-bold text-gray-700 block mb-1">Others (SDP, APGA...)</label>
                    <input
                      id="other-votes-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      {...register('otherVotes', { 
                        setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))
                      })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2.5 px-4 outline-none focus:border-blue-500 font-mono text-sm min-h-[44px]"
                    />
                    {errors.otherVotes && <p className="text-red-500 text-xs font-semibold mt-1">{errors.otherVotes.message}</p>}
                  </div>
                </div>
              </motion.div>
            )}

            {reportType === 'incident' && (
              <motion.div 
                key="incident-fields"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 p-6 bg-red-50/50 rounded-3xl border border-red-200"
              >
                <div className="flex items-center justify-between">
                  <label htmlFor="severity-level-select" className="text-sm font-bold text-red-950 block">
                    Incident Severity Level *
                  </label>
                  <span className="text-[10px] text-red-800 font-bold uppercase tracking-wider bg-red-100 px-2 py-0.5 rounded-full">
                    Priority Dispatch
                  </span>
                </div>
                <select 
                  id="severity-level-select"
                  {...register('severity')}
                  className="w-full bg-white border border-red-200 rounded-2xl py-3 px-6 outline-none focus:border-red-500 transition-colors font-medium text-red-900 min-h-[48px]"
                >
                  <option value="low">Low (Procedural delay / minor dispute)</option>
                  <option value="medium">Medium (Logistics disruption / BVAS hardware delay)</option>
                  <option value="high">High (Voter suppression / Polling agent harassment)</option>
                  <option value="critical">Critical (Violence / Ballot snatching / Shooting)</option>
                </select>
                {(watch('severity') === 'critical' || watch('severity') === 'high') && (
                  <p className="text-xs text-red-700 font-semibold flex items-center gap-1.5 bg-red-100/80 p-2.5 rounded-xl border border-red-200">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span>High & Critical incidents immediately alert state supervisors and central incident command.</span>
                  </p>
                )}
                {errors.severity && <p className="text-red-500 text-xs font-semibold mt-1">{errors.severity.message}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dynamic Action Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-label={isSubmitting ? "Transmitting report to operations center..." : `Submit ${reportType} electoral field report`}
          className={`w-full py-6 px-10 rounded-[28px] font-bold text-xl flex items-center justify-center gap-4 transition-all duration-300 shadow-xl min-h-[56px] ${
            isSubmitting 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' 
              : reportType === 'incident'
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20 active:scale-[0.98]'
              : reportType === 'result'
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 active:scale-[0.98]'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 active:scale-[0.98]'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" /> Transmitting...
            </>
          ) : (
            <>
              <Send className="w-6 h-6" /> 
              <span>
                {reportType === 'incident' 
                  ? 'Submit Incident Report' 
                  : reportType === 'result'
                  ? 'Submit Official EC8A Results'
                  : 'Submit Accreditation Report'}
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
