import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { CheckCircle2, Download, FileSpreadsheet, Upload, UserPlus, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

const observerRoles = [
  'Polling Unit Observer',
  'Roving Observer',
  'Ward Coordinator',
  'LGA Supervisor',
  'State Lead',
];

const OBSERVER_ID_PREFIX = 'CW-OBS';

const ekitiLgas = [
  'Ado Ekiti',
  'Efon',
  'Ekiti East',
  'Ekiti South-West',
  'Ekiti West',
  'Emure',
  'Gbonyin',
  'Ido Osi',
  'Ijero',
  'Ikere',
  'Ikole',
  'Ilejemeje',
  'Irepodun/Ifelodun',
  'Ise/Orun',
  'Moba',
  'Oye',
];

const osunLgas = [
  'Atakunmosa East',
  'Atakunmosa West',
  'Ayedaade',
  'Ayedire',
  'Boluwaduro',
  'Boripe',
  'Ede North',
  'Ede South',
  'Egbedore',
  'Ejigbo',
  'Ife Central',
  'Ife East',
  'Ife North',
  'Ife South',
  'Ifedayo',
  'Ifelodun',
  'Ila',
  'Ilesa East',
  'Ilesa West',
  'Irepodun',
  'Irewole',
  'Isokan',
  'Iwo',
  'Obokun',
  'Odo Otin',
  'Ola Oluwa',
  'Olorunda',
  'Oriade',
  'Orolu',
  'Osogbo',
];

const locationTree: Record<string, string[]> = {
  Ekiti: ekitiLgas,
  Osun: osunLgas,
};

type ObserverForm = {
  specialId: string;
  firstName: string;
  lastName: string;
  phone: string;
  organisation: string;
  state: string;
  lga: string;
  ward: string;
  assignedPollingUnitId: string;
  observerRole: string;
};

type CsvPreview = {
  rows: ObserverForm[];
  errors: string[];
};

const blankForm: ObserverForm = {
  specialId: '',
  firstName: '',
  lastName: '',
  phone: '',
  organisation: '',
  state: '',
  lga: '',
  ward: '',
  assignedPollingUnitId: '',
  observerRole: observerRoles[0],
};

const inputClass = 'w-full rounded-2xl border border-gray-200 px-4 py-3 font-semibold text-gray-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';
const labelClass = 'text-xs font-black uppercase tracking-widest text-gray-400';

function normalizeSpecialId(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '-');
  if (!normalized) return '';
  if (normalized.startsWith(OBSERVER_ID_PREFIX)) return normalized;
  if (normalized.startsWith('OBS-')) return `${OBSERVER_ID_PREFIX}-${normalized.slice(4)}`;
  if (normalized.startsWith('OBS')) return `${OBSERVER_ID_PREFIX}-${normalized.slice(3).replace(/^-/, '')}`;
  return `${OBSERVER_ID_PREFIX}-${normalized}`;
}

function toObserverDoc(form: ObserverForm) {
  const specialId = normalizeSpecialId(form.specialId);
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const displayName = `${firstName} ${lastName}`.trim();

  return {
    uid: specialId,
    specialId,
    firstName,
    lastName,
    displayName,
    email: `${specialId.toLowerCase()}@civicwatch.local`,
    role: 'observer' as UserRole,
    phone: form.phone.trim(),
    organisation: form.organisation.trim(),
    state: form.state.trim(),
    lga: form.lga.trim(),
    ward: form.ward.trim(),
    observerRole: form.observerRole.trim() || observerRoles[0],
    assignedPollingUnitId: form.assignedPollingUnitId.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function validateObserver(form: ObserverForm, rowLabel = 'Observer') {
  const missing = [
    ['Special ID', normalizeSpecialId(form.specialId)],
    ['First Name', form.firstName.trim()],
    ['Last Name', form.lastName.trim()],
    ['Phone', form.phone.trim()],
    ['Organisation', form.organisation.trim()],
    ['State', form.state.trim()],
    ['LGA', form.lga.trim()],
    ['Ward', form.ward.trim()],
    ['Polling Unit Assignment', form.assignedPollingUnitId.trim()],
  ].filter(([, value]) => !value).map(([label]) => label);

  if (missing.length > 0) return `${rowLabel}: missing ${missing.join(', ')}.`;
  const specialId = normalizeSpecialId(form.specialId);
  if (!specialId.startsWith(OBSERVER_ID_PREFIX)) {
    return `${rowLabel}: Special ID must start with ${OBSERVER_ID_PREFIX}.`;
  }
  if (!/^[A-Z0-9_-]+$/.test(specialId)) {
    return `${rowLabel}: Special ID can only use letters, numbers, underscores, and hyphens.`;
  }
  return null;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(content: string): CsvPreview {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], errors: ['CSV needs a header row and at least one observer row.'] };

  const headers = splitCsvLine(lines[0]).map(header => header.trim().toLowerCase());
  const getValue = (cells: string[], names: string[]) => {
    const index = headers.findIndex(header => names.includes(header));
    return index >= 0 ? cells[index]?.trim() || '' : '';
  };

  const rows: ObserverForm[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  lines.slice(1).forEach((line, rowIndex) => {
    const cells = splitCsvLine(line);
    const firstName = getValue(cells, ['first_name', 'firstname', 'first name']);
    const lastName = getValue(cells, ['last_name', 'lastname', 'last name']);
    const specialId = normalizeSpecialId(getValue(cells, ['special_id', 'specialid', 'special id', 'observer_id', 'observer id', 'id']));
    const observer: ObserverForm = {
      specialId,
      firstName,
      lastName,
      phone: getValue(cells, ['phone', 'phone_number', 'phone number']),
      organisation: getValue(cells, ['organisation', 'organization', 'org']),
      state: getValue(cells, ['state']),
      lga: getValue(cells, ['lga', 'local government', 'local_government']),
      ward: getValue(cells, ['ward']),
      assignedPollingUnitId: getValue(cells, ['polling_unit', 'polling unit', 'polling_unit_id', 'polling unit id', 'assignedpollingunitid']),
      observerRole: getValue(cells, ['observer_role', 'observer role', 'role']) || observerRoles[0],
    };

    const validationError = validateObserver(observer, `Row ${rowIndex + 2}`);
    if (validationError) errors.push(validationError);
    if (specialId && seenIds.has(specialId)) errors.push(`Row ${rowIndex + 2}: duplicate Special ID ${specialId} in file.`);
    seenIds.add(specialId);
    rows.push(observer);
  });

  return { rows, errors };
}

function downloadCsvTemplate() {
  const headers = 'special_id,first_name,last_name,phone,organisation,state,lga,ward,polling_unit_id,observer_role';
  const example = 'CW-OBS-0101,Amina,Bello,+2348012345678,CDD-West Africa,Ekiti,Ado Ekiti,Ward 01,PU-EKI-ADE-001,Polling Unit Observer';
  const blob = new Blob([[headers, example].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'observer_onboarding_template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function ObserverOnboarding() {
  const { isAdmin } = useAuth();
  const [form, setForm] = useState<ObserverForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreview>({ rows: [], errors: [] });
  const [bulkSaving, setBulkSaving] = useState(false);

  const states = Object.keys(locationTree);
  const lgas = useMemo(() => form.state ? locationTree[form.state] || [] : [], [form.state]);
  const wardSuggestions = useMemo(() => Array.from({ length: 10 }, (_, index) => `Ward ${String(index + 1).padStart(2, '0')}`), []);
  const pollingUnitSuggestions = useMemo(() => {
    if (!form.state || !form.lga) return [];
    const stateCode = form.state.slice(0, 3).toUpperCase();
    const lgaCode = form.lga.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'LGA';
    return Array.from({ length: 5 }, (_, index) => `PU-${stateCode}-${lgaCode}-${String(index + 1).padStart(3, '0')}`);
  }, [form.state, form.lga]);

  if (!isAdmin) {
    return <div className="p-20 text-center">Only administrators can onboard observers.</div>;
  }

  const updateForm = (field: keyof ObserverForm, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'state') {
        next.lga = '';
        next.ward = '';
        next.assignedPollingUnitId = '';
      }
      if (field === 'lga') {
        next.ward = '';
        next.assignedPollingUnitId = '';
      }
      if (field === 'ward') next.assignedPollingUnitId = '';
      if (field === 'specialId') next.specialId = normalizeSpecialId(value);
      return next;
    });
  };

  const onboardObserver = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateObserver(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const observer = toObserverDoc(form);
      await setDoc(doc(db, 'users', observer.specialId), observer, { merge: true });
      toast.success(`${observer.displayName} onboarded with ID ${observer.specialId}.`);
      setForm(blankForm);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
      toast.error('Observer could not be onboarded.');
    } finally {
      setSaving(false);
    }
  };

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const preview = parseCsv(text);
    setCsvPreview(preview);
    if (preview.errors.length > 0) {
      toast.error(`CSV has ${preview.errors.length} issue${preview.errors.length === 1 ? '' : 's'} to fix.`);
    } else {
      toast.success(`${preview.rows.length} observer${preview.rows.length === 1 ? '' : 's'} ready to import.`);
    }
    event.target.value = '';
  };

  const bulkOnboardObservers = async () => {
    if (csvPreview.rows.length === 0 || csvPreview.errors.length > 0) return;
    setBulkSaving(true);
    try {
      const batch = writeBatch(db);
      csvPreview.rows.forEach(row => {
        const observer = toObserverDoc(row);
        batch.set(doc(db, 'users', observer.specialId), observer, { merge: true });
      });
      await batch.commit();
      toast.success(`${csvPreview.rows.length} observers onboarded.`);
      setCsvPreview({ rows: [], errors: [] });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
      toast.error('Bulk onboarding failed.');
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight font-serif">Observer Onboarding</h1>
          <p className="text-gray-500 mt-2 font-medium">
            Register field observers, assign a {OBSERVER_ID_PREFIX} system ID, and bind each person to a location or polling unit.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsvTemplate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white border border-gray-100 text-gray-700 font-bold shadow-sm hover:bg-gray-50"
        >
          <Download className="w-4 h-4" />
          CSV Template
        </button>
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-8 items-start">
        <form onSubmit={onboardObserver} className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-2">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-serif">Onboard New Observer</h2>
              <p className="text-sm text-gray-400 font-medium">Single observer registration</p>
            </div>
          </div>

          <label className="space-y-2 block">
            <span className={labelClass}>Specific Observer ID</span>
            <input
              value={form.specialId}
              onChange={event => updateForm('specialId', event.target.value)}
              placeholder="e.g. CW-OBS-0101"
              className={`${inputClass} font-mono uppercase`}
            />
          </label>

          <div className="grid md:grid-cols-2 gap-5">
            <label className="space-y-2">
              <span className={labelClass}>First Name</span>
              <input value={form.firstName} onChange={event => updateForm('firstName', event.target.value)} placeholder="First name" className={inputClass} />
            </label>
            <label className="space-y-2">
              <span className={labelClass}>Last Name</span>
              <input value={form.lastName} onChange={event => updateForm('lastName', event.target.value)} placeholder="Last name" className={inputClass} />
            </label>
            <label className="space-y-2">
              <span className={labelClass}>Phone</span>
              <input value={form.phone} onChange={event => updateForm('phone', event.target.value)} placeholder="+234..." className={inputClass} />
            </label>
            <label className="space-y-2">
              <span className={labelClass}>Organisation</span>
              <input value={form.organisation} onChange={event => updateForm('organisation', event.target.value)} placeholder="e.g. CDD-West Africa" className={inputClass} />
            </label>
            <label className="space-y-2">
              <span className={labelClass}>State</span>
              <select value={form.state} onChange={event => updateForm('state', event.target.value)} className={inputClass}>
                <option value="">Select state</option>
                {states.map(state => <option key={state} value={state}>{state}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClass}>LGA</span>
              <select value={form.lga} onChange={event => updateForm('lga', event.target.value)} className={inputClass} disabled={!form.state}>
                <option value="">Select LGA</option>
                {lgas.map(lga => <option key={lga} value={lga}>{lga}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClass}>Ward</span>
              <input
                value={form.ward}
                onChange={event => updateForm('ward', event.target.value)}
                placeholder="Type or choose ward"
                list="ward-suggestions"
                className={inputClass}
                disabled={!form.lga}
              />
              <datalist id="ward-suggestions">
                {wardSuggestions.map(ward => <option key={ward} value={ward} />)}
              </datalist>
            </label>
            <label className="space-y-2">
              <span className={labelClass}>Polling Unit Assignment</span>
              <input
                value={form.assignedPollingUnitId}
                onChange={event => updateForm('assignedPollingUnitId', event.target.value)}
                placeholder="Type or choose polling unit"
                list="polling-unit-suggestions"
                className={inputClass}
                disabled={!form.ward}
              />
              <datalist id="polling-unit-suggestions">
                {pollingUnitSuggestions.map(unit => <option key={unit} value={unit} />)}
              </datalist>
            </label>
          </div>

          <label className="space-y-2 block">
            <span className={labelClass}>Observer Role</span>
            <select value={form.observerRole} onChange={event => updateForm('observerRole', event.target.value)} className={inputClass}>
              {observerRoles.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            {saving ? 'Registering...' : 'Register Observer'}
          </button>
        </form>

        <aside className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-serif">Bulk Upload</h2>
              <p className="text-sm text-gray-400 font-medium">CSV observer import</p>
            </div>
          </div>

          <label className="block rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/70 p-8 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors">
            <Upload className="w-8 h-8 mx-auto text-emerald-600 mb-3" />
            <span className="block font-bold text-gray-900">Upload CSV file</span>
            <span className="block text-xs text-gray-400 mt-1 font-medium">Use the template headers for fastest import.</span>
            <input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} className="hidden" />
          </label>

          <div className="rounded-3xl bg-gray-50 border border-gray-100 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Preview</span>
              <span className="text-sm font-bold text-gray-900">{csvPreview.rows.length} rows</span>
            </div>
            {csvPreview.rows.slice(0, 4).map(row => (
              <div key={row.specialId} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-gray-800 truncate">{row.firstName} {row.lastName}</span>
                <span className="font-mono text-xs text-emerald-700 bg-white px-2 py-1 rounded-lg border border-gray-100">{row.specialId}</span>
              </div>
            ))}
            {csvPreview.rows.length > 4 && (
              <p className="text-xs text-gray-400 font-medium">+{csvPreview.rows.length - 4} more observers</p>
            )}
            {csvPreview.rows.length === 0 && (
              <p className="text-sm text-gray-400 font-medium">No CSV loaded yet.</p>
            )}
          </div>

          {csvPreview.errors.length > 0 && (
            <div className="rounded-3xl bg-red-50 border border-red-100 p-5 space-y-2">
              <div className="flex items-center gap-2 text-red-700 font-bold">
                <XCircle className="w-4 h-4" />
                Fix CSV issues
              </div>
              <ul className="space-y-1 text-xs text-red-700 font-medium max-h-40 overflow-y-auto pr-1">
                {csvPreview.errors.map(error => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}

          {csvPreview.rows.length > 0 && csvPreview.errors.length === 0 && (
            <div className="rounded-3xl bg-emerald-50 border border-emerald-100 p-5 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
              <p className="text-sm text-emerald-800 font-semibold">
                File is ready. Import will create or update observer records using each row's specific ID.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={bulkOnboardObservers}
            disabled={bulkSaving || csvPreview.rows.length === 0 || csvPreview.errors.length > 0}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gray-900 text-white font-bold hover:bg-gray-800 disabled:opacity-40"
          >
            <Upload className="w-4 h-4" />
            {bulkSaving ? 'Importing...' : 'Import Observers'}
          </button>
        </aside>
      </div>
    </div>
  );
}
