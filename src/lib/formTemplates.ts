import { FormQuestion, FormTemplate, ReportType } from '../types';

export type FormAnswers = Record<string, string | number | string[]>;

export const FORM_TEMPLATE_COLLECTION = 'formTemplates';
export const DEFAULT_LANGUAGE = 'EN';

export const reportTypeLabels: Record<ReportType, string> = {
  accreditation: 'Accreditation',
  incident: 'Incident',
  result: 'Result',
  checklist: 'Observer Checklist',
};

export const formStatusLabels = {
  drafted: 'Drafted',
  published: 'Published',
  retired: 'Retired',
};

export function localized(text: Record<string, string> | undefined, language = DEFAULT_LANGUAGE) {
  if (!text) return '';
  return text[language] || text[DEFAULT_LANGUAGE] || Object.values(text)[0] || '';
}

export function shouldShowQuestion(question: FormQuestion, answers: FormAnswers) {
  if (!question.displayLogic) return true;

  const answer = answers[question.displayLogic.parentQuestionId];
  if (Array.isArray(answer)) return answer.includes(question.displayLogic.value);
  return answer === question.displayLogic.value;
}

export function getDefaultAnswer(question: FormQuestion) {
  if (question.type === 'multiSelect') return [];
  if (question.type === 'rating') return question.ratingScale ? Math.ceil(question.ratingScale / 2) : 3;
  return '';
}

export function getDescriptionFromAnswers(template: FormTemplate | undefined, answers: FormAnswers) {
  const descriptionAnswer = answers.description;
  if (typeof descriptionAnswer === 'string' && descriptionAnswer.trim()) return descriptionAnswer.trim();

  const firstTextQuestion = template?.sections
    .flatMap(section => section.questions)
    .find(question => question.type === 'text' && typeof answers[question.id] === 'string' && String(answers[question.id]).trim());

  return firstTextQuestion ? String(answers[firstTextQuestion.id]).trim() : 'Field report submitted.';
}

export function getSeverityFromAnswers(answers: FormAnswers) {
  const value = answers.severity;
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : 'medium';
}

export const defaultFormTemplates: FormTemplate[] = [
  {
    id: 'default-accreditation',
    code: 'ACC-DEFAULT',
    reportType: 'accreditation',
    status: 'published',
    languages: ['EN'],
    name: { EN: 'Accreditation Field Form' },
    sections: [
      {
        id: 'acc-section-main',
        code: 'A',
        title: { EN: 'Accreditation Status' },
        questions: [
          {
            id: 'description',
            code: 'A1',
            type: 'text',
            label: { EN: 'Observation details' },
            placeholder: { EN: 'Describe accreditation progress and any relevant context.' },
            required: true,
          },
          {
            id: 'voterCount',
            code: 'A2',
            type: 'number',
            label: { EN: 'Number of voters accredited so far' },
            required: false,
          },
          {
            id: 'queueStatus',
            code: 'A3',
            type: 'singleSelect',
            label: { EN: 'Queue status' },
            required: true,
            options: [
              { id: 'orderly', label: { EN: 'Orderly' } },
              { id: 'long', label: { EN: 'Long but orderly' }, isFlagged: true },
              { id: 'disrupted', label: { EN: 'Disrupted' }, isFlagged: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'default-incident',
    code: 'INC-DEFAULT',
    reportType: 'incident',
    status: 'published',
    languages: ['EN'],
    name: { EN: 'Incident Report Form' },
    sections: [
      {
        id: 'inc-section-main',
        code: 'I',
        title: { EN: 'Incident Details' },
        questions: [
          {
            id: 'severity',
            code: 'I1',
            type: 'singleSelect',
            label: { EN: 'Severity level' },
            required: true,
            options: [
              { id: 'low', label: { EN: 'Low - procedural issue' } },
              { id: 'medium', label: { EN: 'Medium - delays or disputes' }, isFlagged: true },
              { id: 'high', label: { EN: 'High - harassment or suppression' }, isFlagged: true },
              { id: 'critical', label: { EN: 'Critical - violence or disruption' }, isFlagged: true },
            ],
          },
          {
            id: 'description',
            code: 'I2',
            type: 'text',
            label: { EN: 'Incident narrative' },
            placeholder: { EN: 'Describe what happened, who was involved, and current status.' },
            required: true,
          },
          {
            id: 'securityPresent',
            code: 'I3',
            type: 'singleSelect',
            label: { EN: 'Are security officials present?' },
            required: true,
            options: [
              { id: 'yes', label: { EN: 'Yes' } },
              { id: 'no', label: { EN: 'No' }, isFlagged: true },
            ],
          },
          {
            id: 'securityNotes',
            code: 'I4',
            type: 'text',
            label: { EN: 'Security escalation notes' },
            placeholder: { EN: 'Explain who has been notified and what response is needed.' },
            displayLogic: {
              parentQuestionId: 'securityPresent',
              condition: 'includes',
              value: 'no',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'default-result',
    code: 'RES-DEFAULT',
    reportType: 'result',
    status: 'published',
    languages: ['EN'],
    name: { EN: 'Result Transmission Form' },
    sections: [
      {
        id: 'res-section-main',
        code: 'R',
        title: { EN: 'Result Summary' },
        questions: [
          {
            id: 'description',
            code: 'R1',
            type: 'text',
            label: { EN: 'Result summary' },
            placeholder: { EN: 'Summarize posted results or transmission status.' },
            required: true,
          },
          {
            id: 'totalVotes',
            code: 'R2',
            type: 'number',
            label: { EN: 'Total valid votes counted' },
          },
          {
            id: 'resultSheetPosted',
            code: 'R3',
            type: 'singleSelect',
            label: { EN: 'Was the result sheet publicly posted?' },
            options: [
              { id: 'yes', label: { EN: 'Yes' } },
              { id: 'no', label: { EN: 'No' }, isFlagged: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'default-checklist',
    code: 'OBS-CHECKLIST',
    reportType: 'checklist',
    status: 'published',
    languages: ['EN'],
    name: { EN: 'Observer Polling Unit Checklist' },
    sections: [
      {
        id: 'chk-section-main',
        code: 'C',
        title: { EN: 'Polling Unit Readiness' },
        questions: [
          {
            id: 'description',
            code: 'C1',
            type: 'text',
            label: { EN: 'Checklist notes' },
            placeholder: { EN: 'Add any setup, materials, or access notes.' },
            required: true,
          },
          {
            id: 'materialsAvailable',
            code: 'C2',
            type: 'multiSelect',
            label: { EN: 'Materials available' },
            options: [
              { id: 'ballotPapers', label: { EN: 'Ballot papers' } },
              { id: 'resultSheets', label: { EN: 'Result sheets' } },
              { id: 'bvas', label: { EN: 'BVAS device' } },
              { id: 'ink', label: { EN: 'Indelible ink' } },
            ],
          },
          {
            id: 'readinessRating',
            code: 'C3',
            type: 'rating',
            label: { EN: 'Readiness rating' },
            ratingScale: 5,
          },
        ],
      },
    ],
  },
];
