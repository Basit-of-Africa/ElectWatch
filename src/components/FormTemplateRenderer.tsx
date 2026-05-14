import { FormAnswers, getDefaultAnswer, localized, shouldShowQuestion } from '../lib/formTemplates';
import { FormQuestion, FormTemplate } from '../types';

interface FormTemplateRendererProps {
  template: FormTemplate;
  answers: FormAnswers;
  onChange: (questionId: string, value: string | number | string[]) => void;
  language?: string;
}

function inputBaseClass(hasError = false) {
  return `w-full bg-white border ${hasError ? 'border-red-200 focus:border-red-500' : 'border-gray-200 focus:border-emerald-500'} rounded-2xl py-3 px-5 outline-none transition-colors font-medium`;
}

function QuestionInput({
  question,
  value,
  onChange,
  language,
}: {
  question: FormQuestion;
  value: string | number | string[] | undefined;
  onChange: (value: string | number | string[]) => void;
  language: string;
}) {
  switch (question.type) {
    case 'number':
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
          placeholder={localized(question.placeholder, language)}
          className={inputBaseClass()}
        />
      );
    case 'date':
      return (
        <input
          type="datetime-local"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className={inputBaseClass()}
        />
      );
    case 'singleSelect':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className={inputBaseClass()}
        >
          <option value="">Select an option</option>
          {(question.options || []).map(option => (
            <option key={option.id} value={option.id}>
              {localized(option.label, language)}
            </option>
          ))}
        </select>
      );
    case 'multiSelect': {
      const selected = Array.isArray(value) ? value : [];

      return (
        <div className="grid sm:grid-cols-2 gap-3">
          {(question.options || []).map(option => {
            const isChecked = selected.includes(option.id);
            return (
              <label
                key={option.id}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-all ${
                  isChecked ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(event) => {
                    if (event.target.checked) onChange([...selected, option.id]);
                    else onChange(selected.filter(id => id !== option.id));
                  }}
                  className="accent-emerald-600"
                />
                <span className="text-sm font-bold">{localized(option.label, language)}</span>
              </label>
            );
          })}
        </div>
      );
    }
    case 'rating': {
      const scale = question.ratingScale || 5;
      const selected = typeof value === 'number' ? value : Number(value || 0);

      return (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: scale }).map((_, index) => {
            const rating = index + 1;
            return (
              <button
                key={rating}
                type="button"
                onClick={() => onChange(rating)}
                className={`w-11 h-11 rounded-2xl text-sm font-black transition-all ${
                  selected === rating ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-white border border-gray-100 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {rating}
              </button>
            );
          })}
        </div>
      );
    }
    default:
      return (
        <textarea
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={localized(question.placeholder, language)}
          className={`${inputBaseClass()} resize-none`}
        />
      );
  }
}

export default function FormTemplateRenderer({
  template,
  answers,
  onChange,
  language = 'EN',
}: FormTemplateRendererProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-emerald-50/70 border border-emerald-100 px-6 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Active Form Template</p>
          <h3 className="text-lg font-bold text-emerald-950 mt-1">{localized(template.name, language)}</h3>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-white px-3 py-1.5 rounded-full border border-emerald-100">
          {template.code}
        </span>
      </div>

      {template.sections.map(section => (
        <section key={section.id} className="space-y-5 rounded-3xl border border-gray-100 bg-gray-50/70 p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{section.code}</p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">{localized(section.title, language)}</h3>
          </div>

          <div className="space-y-5">
            {section.questions.filter(question => shouldShowQuestion(question, answers)).map(question => {
              const value = answers[question.id] ?? getDefaultAnswer(question);
              return (
                <div key={question.id} className="space-y-2">
                  <label className="flex items-center justify-between gap-4 text-sm font-bold text-gray-700">
                    <span>
                      {question.code}. {localized(question.label, language)}
                    </span>
                    {question.required && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-red-500">Required</span>
                    )}
                  </label>
                  {question.helpText && (
                    <p className="text-xs text-gray-400 font-medium">{localized(question.helpText, language)}</p>
                  )}
                  <QuestionInput
                    question={question}
                    value={value}
                    language={language}
                    onChange={(nextValue) => onChange(question.id, nextValue)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
