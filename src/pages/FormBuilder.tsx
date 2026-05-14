import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { ClipboardList, FilePlus2, Layers3, Plus, Save, Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  DEFAULT_LANGUAGE,
  FORM_TEMPLATE_COLLECTION,
  defaultFormTemplates,
  formStatusLabels,
  localized,
  reportTypeLabels,
} from '../lib/formTemplates';
import { FormQuestion, FormQuestionOption, FormQuestionType, FormSection, FormTemplate, FormTemplateStatus, ReportType } from '../types';
import { useAuth } from '../context/AuthContext';

const questionTypes: FormQuestionType[] = ['text', 'number', 'date', 'singleSelect', 'multiSelect', 'rating'];
const statuses: FormTemplateStatus[] = ['drafted', 'published', 'retired'];
const reportTypes: ReportType[] = ['accreditation', 'incident', 'result', 'checklist'];

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

function createBlankTemplate(): FormTemplate {
  return {
    id: newId('form'),
    code: `FORM-${Date.now().toString().slice(-5)}`,
    name: { EN: 'New Form Template' },
    reportType: 'accreditation',
    status: 'drafted',
    languages: ['EN'],
    sections: [
      {
        id: newId('section'),
        code: 'A',
        title: { EN: 'Section A' },
        questions: [],
      },
    ],
  };
}

function createQuestion(type: FormQuestionType): FormQuestion {
  const id = newId('question');
  const base: FormQuestion = {
    id,
    code: 'Q',
    type,
    label: { EN: 'New question' },
    required: false,
  };

  if (type === 'singleSelect' || type === 'multiSelect') {
    base.options = [
      { id: newId('option'), label: { EN: 'Yes' } },
      { id: newId('option'), label: { EN: 'No' } },
    ];
  }

  if (type === 'rating') base.ratingScale = 5;

  return base;
}

export default function FormBuilder() {
  const { isAdmin } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FormTemplate>(createBlankTemplate());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const templatesQuery = query(collection(db, FORM_TEMPLATE_COLLECTION), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(templatesQuery, (snapshot) => {
      const docs = snapshot.docs.map(templateDoc => ({ id: templateDoc.id, ...templateDoc.data() } as FormTemplate));
      setTemplates(docs);
      if (!selectedId && docs.length > 0) {
        setSelectedId(docs[0].id);
        setDraft(docs[0]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, FORM_TEMPLATE_COLLECTION);
    });

    return () => unsubscribe();
  }, [selectedId]);

  const selectedTemplate = useMemo(
    () => templates.find(template => template.id === selectedId),
    [selectedId, templates]
  );

  useEffect(() => {
    if (selectedTemplate) setDraft(selectedTemplate);
  }, [selectedTemplate]);

  if (!isAdmin) {
    return <div className="p-20 text-center">Only administrators can manage form templates.</div>;
  }

  const saveTemplate = async (template = draft) => {
    setSaving(true);
    try {
      await setDoc(doc(db, FORM_TEMPLATE_COLLECTION, template.id), {
        ...template,
        updatedAt: serverTimestamp(),
        createdAt: template.createdAt || serverTimestamp(),
      }, { merge: true });
      setSelectedId(template.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, FORM_TEMPLATE_COLLECTION);
    } finally {
      setSaving(false);
    }
  };

  const seedDefaults = async () => {
    setSaving(true);
    try {
      await Promise.all(defaultFormTemplates.map(template => setDoc(doc(db, FORM_TEMPLATE_COLLECTION, template.id), {
        ...template,
        updatedAt: serverTimestamp(),
        createdAt: template.createdAt || serverTimestamp(),
      }, { merge: true })));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, FORM_TEMPLATE_COLLECTION);
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (sectionId: string, updater: (section: FormSection) => FormSection) => {
    setDraft(prev => ({
      ...prev,
      sections: prev.sections.map(section => section.id === sectionId ? updater(section) : section),
    }));
  };

  const updateQuestion = (sectionId: string, questionId: string, updater: (question: FormQuestion) => FormQuestion) => {
    updateSection(sectionId, section => ({
      ...section,
      questions: section.questions.map(question => question.id === questionId ? updater(question) : question),
    }));
  };

  const updateOption = (sectionId: string, questionId: string, optionId: string, updater: (option: FormQuestionOption) => FormQuestionOption) => {
    updateQuestion(sectionId, questionId, question => ({
      ...question,
      options: (question.options || []).map(option => option.id === optionId ? updater(option) : option),
    }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Configurable Form Builder</h1>
          <p className="text-gray-500 mt-2 font-medium">
            Create typed, sectioned, multi-language forms for field reports and observer checklists.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const blank = createBlankTemplate();
              setDraft(blank);
              setSelectedId(null);
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-gray-100 text-gray-700 font-bold shadow-sm hover:bg-gray-50"
          >
            <FilePlus2 className="w-4 h-4" />
            New Template
          </button>
          <button
            onClick={seedDefaults}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 hover:bg-emerald-100 disabled:opacity-50"
          >
            <Layers3 className="w-4 h-4" />
            Seed Defaults
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-8 items-start">
        <aside className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Templates</p>
          </div>
          <div className="divide-y divide-gray-100">
            {templates.length === 0 ? (
              <div className="p-8 text-sm text-gray-400 text-center">No templates saved yet.</div>
            ) : templates.map(template => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedId(template.id);
                  setDraft(template);
                }}
                className={`w-full text-left p-5 hover:bg-gray-50 transition-colors ${selectedId === template.id ? 'bg-emerald-50/70' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <ClipboardList className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-bold text-gray-900">{localized(template.name)}</p>
                    <p className="text-xs text-gray-400 mt-1">{template.code} · {reportTypeLabels[template.reportType]}</p>
                    <span className="inline-flex mt-2 px-2 py-0.5 rounded-full bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500">
                      {formStatusLabels[template.status]}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-6 md:p-8 space-y-8">
          <div className="grid md:grid-cols-2 gap-5">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Template Name</span>
              <input
                value={localized(draft.name)}
                onChange={(event) => setDraft(prev => ({ ...prev, name: { ...prev.name, EN: event.target.value } }))}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 font-bold outline-none focus:border-emerald-500"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Code</span>
              <input
                value={draft.code}
                onChange={(event) => setDraft(prev => ({ ...prev, code: event.target.value.toUpperCase() }))}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 font-mono font-bold outline-none focus:border-emerald-500"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Report Type</span>
              <select
                value={draft.reportType}
                onChange={(event) => setDraft(prev => ({ ...prev, reportType: event.target.value as ReportType }))}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 font-bold outline-none focus:border-emerald-500"
              >
                {reportTypes.map(type => <option key={type} value={type}>{reportTypeLabels[type]}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Status</span>
              <select
                value={draft.status}
                onChange={(event) => setDraft(prev => ({ ...prev, status: event.target.value as FormTemplateStatus }))}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 font-bold outline-none focus:border-emerald-500"
              >
                {statuses.map(status => <option key={status} value={status}>{formStatusLabels[status]}</option>)}
              </select>
            </label>
          </div>

          <div className="space-y-6">
            {draft.sections.map((section, sectionIndex) => (
              <section key={section.id} className="rounded-3xl border border-gray-100 bg-gray-50/60 p-5 space-y-5">
                <div className="grid md:grid-cols-[90px_1fr_auto] gap-3 items-end">
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Code</span>
                    <input
                      value={section.code}
                      onChange={(event) => updateSection(section.id, current => ({ ...current, code: event.target.value.toUpperCase() }))}
                      className="w-full rounded-2xl border border-gray-200 px-3 py-2 font-mono font-bold outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Section Title</span>
                    <input
                      value={localized(section.title)}
                      onChange={(event) => updateSection(section.id, current => ({ ...current, title: { ...current.title, EN: event.target.value } }))}
                      className="w-full rounded-2xl border border-gray-200 px-3 py-2 font-bold outline-none focus:border-emerald-500"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setDraft(prev => ({ ...prev, sections: prev.sections.filter(item => item.id !== section.id) }))}
                    disabled={draft.sections.length === 1}
                    className="h-10 px-3 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-red-500 disabled:opacity-30"
                    title="Remove section"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {section.questions.map((question, questionIndex) => (
                    <div key={question.id} className="rounded-2xl bg-white border border-gray-100 p-4 space-y-4">
                      <div className="grid md:grid-cols-[80px_150px_1fr_auto] gap-3 items-end">
                        <label className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Code</span>
                          <input
                            value={question.code}
                            onChange={(event) => updateQuestion(section.id, question.id, current => ({ ...current, code: event.target.value.toUpperCase() }))}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono font-bold outline-none focus:border-emerald-500"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Type</span>
                          <select
                            value={question.type}
                            onChange={(event) => updateQuestion(section.id, question.id, current => ({
                              ...createQuestion(event.target.value as FormQuestionType),
                              id: current.id,
                              code: current.code,
                              label: current.label,
                              required: current.required,
                            }))}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 font-bold outline-none focus:border-emerald-500"
                          >
                            {questionTypes.map(type => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Question Label</span>
                          <input
                            value={localized(question.label)}
                            onChange={(event) => updateQuestion(section.id, question.id, current => ({ ...current, label: { ...current.label, EN: event.target.value } }))}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 font-bold outline-none focus:border-emerald-500"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => updateSection(section.id, current => ({ ...current, questions: current.questions.filter(item => item.id !== question.id) }))}
                          className="h-10 px-3 rounded-xl bg-gray-50 text-gray-400 hover:text-red-500"
                          title="Remove question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-sm font-bold text-gray-600">
                          <input
                            type="checkbox"
                            checked={Boolean(question.required)}
                            onChange={(event) => updateQuestion(section.id, question.id, current => ({ ...current, required: event.target.checked }))}
                            className="accent-emerald-600"
                          />
                          Required
                        </label>
                        {question.type === 'rating' && (
                          <label className="inline-flex items-center gap-2 text-sm font-bold text-gray-600">
                            Rating scale
                            <input
                              type="number"
                              min={3}
                              max={10}
                              value={question.ratingScale || 5}
                              onChange={(event) => updateQuestion(section.id, question.id, current => ({ ...current, ratingScale: Number(event.target.value) }))}
                              className="w-20 rounded-xl border border-gray-200 px-3 py-1.5 outline-none focus:border-emerald-500"
                            />
                          </label>
                        )}
                      </div>

                      {(question.type === 'singleSelect' || question.type === 'multiSelect') && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Options</p>
                          {(question.options || []).map(option => (
                            <div key={option.id} className="grid grid-cols-[1fr_auto] gap-2">
                              <input
                                value={localized(option.label)}
                                onChange={(event) => updateOption(section.id, question.id, option.id, current => ({ ...current, label: { ...current.label, EN: event.target.value } }))}
                                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={() => updateQuestion(section.id, question.id, current => ({ ...current, options: (current.options || []).filter(item => item.id !== option.id) }))}
                                className="px-3 rounded-xl bg-gray-50 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => updateQuestion(section.id, question.id, current => ({
                              ...current,
                              options: [...(current.options || []), { id: newId('option'), label: { EN: 'New option' } }],
                            }))}
                            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
                          >
                            <Plus className="w-4 h-4" />
                            Add option
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {questionTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateSection(section.id, current => ({
                        ...current,
                        questions: [...current.questions, { ...createQuestion(type), code: `${section.code}${current.questions.length + 1}` }],
                      }))}
                      className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600 hover:text-emerald-700 hover:border-emerald-200"
                    >
                      + {type}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="flex flex-wrap justify-between gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setDraft(prev => ({
                ...prev,
                sections: [...prev.sections, { id: newId('section'), code: String.fromCharCode(65 + prev.sections.length), title: { EN: `Section ${prev.sections.length + 1}` }, questions: [] }],
              }))}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gray-50 text-gray-700 font-bold hover:bg-gray-100"
            >
              <Plus className="w-4 h-4" />
              Add Section
            </button>

            <button
              type="button"
              onClick={() => saveTemplate()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Language support is stored in the template shape. This builder edits the {DEFAULT_LANGUAGE} copy first, so future language tabs can add translated labels without changing submissions.
          </p>
        </main>
      </div>
    </div>
  );
}
