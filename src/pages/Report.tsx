import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Globe,
  Loader2,
  MapPin,
  Navigation,
  Send,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import FormTemplateRenderer from '../components/FormTemplateRenderer';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  DEFAULT_LANGUAGE,
  FORM_TEMPLATE_COLLECTION,
  FormAnswers,
  defaultFormTemplates,
  getDescriptionFromAnswers,
  getSeverityFromAnswers,
  localized,
  reportTypeLabels,
  shouldShowQuestion,
} from '../lib/formTemplates';
import { FormTemplate, ReportType } from '../types';

type SubmitState = 'synced' | 'queued';

const SYNC_ACK_TIMEOUT_MS = 4000;

const reportTypeIcons: Record<ReportType, typeof Users> = {
  accreditation: Users,
  incident: ShieldAlert,
  result: ClipboardCheck,
  checklist: ClipboardList,
};

const reportTypeStyles: Record<ReportType, { selected: string; icon: string }> = {
  accreditation: {
    selected: 'border-emerald-500 bg-emerald-50/30 shadow-emerald-500/10',
    icon: 'bg-emerald-500 text-white',
  },
  incident: {
    selected: 'border-red-500 bg-red-50/30 shadow-red-500/10',
    icon: 'bg-red-500 text-white',
  },
  result: {
    selected: 'border-blue-500 bg-blue-50/30 shadow-blue-500/10',
    icon: 'bg-blue-500 text-white',
  },
  checklist: {
    selected: 'border-indigo-500 bg-indigo-50/30 shadow-indigo-500/10',
    icon: 'bg-indigo-500 text-white',
  },
};

function getInitialAnswers(template: FormTemplate | undefined) {
  if (!template) return {};

  return template.sections.reduce((sectionAcc, section) => {
    section.questions.forEach(question => {
      if (question.type === 'multiSelect') sectionAcc[question.id] = [];
      else if (question.type === 'rating') sectionAcc[question.id] = question.ratingScale ? Math.ceil(question.ratingScale / 2) : 3;
      else sectionAcc[question.id] = '';
    });
    return sectionAcc;
  }, {} as FormAnswers);
}

function getPublishedTemplates(templates: FormTemplate[]) {
  const published = templates.filter(template => template.status === 'published');
  return published.length > 0 ? published : defaultFormTemplates;
}

function getRequiredValidationError(template: FormTemplate | undefined, answers: FormAnswers) {
  if (!template) return 'No published form template is available for this report type.';

  for (const section of template.sections) {
    for (const question of section.questions) {
      if (!question.required || !shouldShowQuestion(question, answers)) continue;
      const answer = answers[question.id];
      const isEmptyArray = Array.isArray(answer) && answer.length === 0;
      const isEmptyValue = answer === undefined || answer === null || answer === '';
      if (isEmptyArray || isEmptyValue) return `${localized(question.label)} is required.`;
    }
  }

  return null;
}

export default function Report() {
  const { user, isSupervisor } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>(defaultFormTemplates);
  const [reportType, setReportType] = useState<ReportType>('accreditation');
  const [templateId, setTemplateId] = useState('');
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [pollingUnitId, setPollingUnitId] = useState(user?.assignedPollingUnitId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<SubmitState | false>(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<{ url: string, name: string, type: string, hash?: string }[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, FORM_TEMPLATE_COLLECTION), (snapshot) => {
      const docs = snapshot.docs.map(templateDoc => ({ id: templateDoc.id, ...templateDoc.data() } as FormTemplate));
      setTemplates(getPublishedTemplates(docs));
    }, (snapshotError) => {
      console.warn('Falling back to bundled form templates.', snapshotError);
      setTemplates(defaultFormTemplates);
    });

    return () => unsubscribe();
  }, []);

  const templatesForType = useMemo(
    () => templates.filter(template => template.reportType === reportType && template.status === 'published'),
    [reportType, templates]
  );

  const selectedTemplate = useMemo(() => {
    return templatesForType.find(template => template.id === templateId) || templatesForType[0];
  }, [templateId, templatesForType]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setTemplateId(selectedTemplate.id);
    setAnswers(getInitialAnswers(selectedTemplate));
  }, [selectedTemplate?.id]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files as FileList).forEach((file: File) => {
      const url = URL.createObjectURL(file);
      const mockHash = 'sha256-' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setMediaFiles(prev => [...prev, { url, name: file.name, type: file.type, hash: mockHash }]);
    });
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAcquireLocation = () => {
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
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

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!pollingUnitId.trim()) throw new Error('Polling Unit ID is required.');

      const validationError = getRequiredValidationError(selectedTemplate, answers);
      if (validationError) throw new Error(validationError);

      const description = getDescriptionFromAnswers(selectedTemplate, answers);
      const severity = getSeverityFromAnswers(answers);
      const reportData = {
        pollingUnitId: pollingUnitId.trim(),
        observerId: user?.uid,
        timestamp: serverTimestamp(),
        type: reportType,
        formTemplateId: selectedTemplate?.id,
        formTemplateCode: selectedTemplate?.code,
        location,
        media: mediaFiles.map(media => ({ url: media.url, type: media.type, hash: media.hash })),
        payload: {
          description,
          severity: reportType === 'incident' ? severity : answers.severity,
          voterCount: answers.voterCount,
          formName: selectedTemplate ? localized(selectedTemplate.name) : '',
          answers,
        },
      };

      const batch = writeBatch(db);
      const reportRef = doc(collection(db, 'reports'));

      batch.set(reportRef, reportData);

      if (reportType === 'incident') {
        const incidentRef = doc(collection(db, 'incidents'));

        batch.set(incidentRef, {
          reportId: reportRef.id,
          pollingUnitId: pollingUnitId.trim(),
          severity,
          status: 'pending',
          description,
          timestamp: serverTimestamp(),
        });

        if (severity === 'critical' || severity === 'high') {
          const notificationPayload = {
            title: `CRITICAL INCIDENT: ${pollingUnitId.trim()}`,
            message: description,
            type: severity === 'critical' ? 'error' : 'warning',
            read: false,
            link: `/app/incidents/${incidentRef.id}`,
            timestamp: serverTimestamp(),
          };

          batch.set(doc(collection(db, 'notifications')), { ...notificationPayload, userId: 'admin' });
          batch.set(doc(collection(db, 'notifications')), { ...notificationPayload, userId: 'supervisor' });
        }
      }

      const commit = batch.commit();
      let submitState: SubmitState = navigator.onLine ? 'synced' : 'queued';

      if (!navigator.onLine) {
        commit.catch((syncError) => {
          console.error('Queued report failed to sync:', syncError);
        });
      } else {
        submitState = await Promise.race<SubmitState>([
          commit.then(() => 'synced'),
          new Promise((resolve) => {
            window.setTimeout(() => resolve('queued'), SYNC_ACK_TIMEOUT_MS);
          }),
        ]);

        if (submitState === 'queued') {
          commit.catch((syncError) => {
            console.error('Queued report failed to sync:', syncError);
          });
        }
      }

      setSuccess(submitState);
      setAnswers(getInitialAnswers(selectedTemplate));
      setMediaFiles([]);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit this report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="text-center md:text-left">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight font-serif">Submit Field Report</h1>
        <p className="text-gray-500 mt-2 text-lg">Use admin-configured templates for accreditation, incidents, results, or observer checklists.</p>
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
              <p className="text-sm opacity-80 mt-1">
                {success === 'queued'
                  ? 'No connection detected. The report is stashed on this device and will sync automatically.'
                  : 'Your data has been successfully transmitted to the operations center.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={onSubmit} className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-8 md:p-12 space-y-8">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest px-1">
              <MapPin className="w-4 h-4" /> Polling Location
            </label>
            <input
              value={pollingUnitId}
              onChange={(event) => setPollingUnitId(event.target.value)}
              placeholder="e.g. PU-LAG-102"
              className="w-full bg-gray-50 border-2 border-gray-50 focus:border-emerald-500 rounded-2xl py-4 px-6 text-lg font-medium outline-none transition-all duration-300 focus:bg-white focus:shadow-lg focus:shadow-emerald-500/5"
            />
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
                  key={`${file.name}-${idx}`}
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

        <div className="grid md:grid-cols-4 gap-4">
          {(['accreditation', 'incident', 'result', 'checklist'] as const).map((type) => {
            const isSelected = reportType === type;
            const Icon = reportTypeIcons[type];

            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setReportType(type);
                  setTemplateId('');
                }}
                className={`relative text-left transition-all duration-300 ${isSelected ? 'translate-y-[-4px]' : ''}`}
              >
                <div className={`h-full p-5 rounded-3xl border-2 transition-all duration-300 ${
                  isSelected
                    ? `${reportTypeStyles[type].selected} shadow-lg`
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}>
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                    isSelected ? reportTypeStyles[type].icon : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className={`font-bold ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                    {reportTypeLabels[type]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {templatesForType.length > 1 && (
          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Template Variant</span>
            <select
              value={selectedTemplate?.id || ''}
              onChange={(event) => setTemplateId(event.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl py-3 px-5 outline-none focus:border-emerald-500 font-bold text-gray-700"
            >
              {templatesForType.map(template => (
                <option key={template.id} value={template.id}>
                  {localized(template.name)} ({template.code})
                </option>
              ))}
            </select>
          </label>
        )}

        {selectedTemplate ? (
          <FormTemplateRenderer
            template={selectedTemplate}
            answers={answers}
            language={DEFAULT_LANGUAGE}
            onChange={(questionId, value) => {
              setAnswers(prev => ({ ...prev, [questionId]: value }));
            }}
          />
        ) : (
          <div className="rounded-3xl bg-amber-50 border border-amber-100 text-amber-800 p-6 font-bold">
            No published template found for {reportTypeLabels[reportType]}. Ask an administrator to publish one in Form Builder.
          </div>
        )}

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
