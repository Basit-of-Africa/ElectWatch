import React from 'react';
import PageHeader from '../components/common/PageHeader';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  FilePlus2, 
  AlertOctagon, 
  CheckSquare, 
  Clock, 
  ShieldAlert, 
  Camera, 
  HardDrive, 
  ArrowRight,
  ClipboardList,
  Vote,
  Sparkles
} from 'lucide-react';

export default function Forms() {
  const forms = [
    {
      id: 'form-ec8a',
      title: 'Form EC8A - Official Polling Unit Result Sheet',
      category: 'Official Results Collation',
      type: 'result',
      description: 'Record party vote tallies (APC, PDP, LP, NNPP, Others) transcribed directly from the stamped Form EC8A. Requires high-resolution photo evidence of the signed sheet.',
      icon: Vote,
      color: 'emerald',
      bgColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badge: 'Statutory Form',
      fields: ['APC / PDP / LP / NNPP Votes', 'Rejected Ballots', 'Total Valid Votes', 'Form EC8A Stamped Photo'],
      timing: 'Post-Poll Sorting & Counting'
    },
    {
      id: 'form-bvas-accreditation',
      title: 'Form BVAS-01 - Voter Accreditation & Hardware Health',
      category: 'Voter Turnout & Biometrics',
      type: 'accreditation',
      description: 'Report accredited voter figures, BVAS facial/fingerprint scanner performance, queue length, and polling station commencement times.',
      icon: CheckSquare,
      color: 'blue',
      bgColor: 'bg-blue-50 text-blue-800 border-blue-200',
      badge: 'Periodic Tracking',
      fields: ['Accredited Voter Count', 'BVAS Hardware Status', 'Queue Crowd Size', 'Official Opening Time'],
      timing: 'Hourly from 8:30 AM to 2:30 PM'
    },
    {
      id: 'form-ir-incident',
      title: 'Form IR-101 - Field Incident & Security Alert',
      category: 'Irregularities & Security Escalation',
      type: 'incident',
      description: 'Document physical threats, ballot box tampering, voter disenfranchisement, BVAS failures, or late arrival of electoral officers. Dispatches instant alert to supervisors.',
      icon: AlertOctagon,
      color: 'red',
      bgColor: 'bg-red-50 text-red-800 border-red-200',
      badge: 'Emergency Alert',
      fields: ['Incident Category', 'Severity (Low to Critical)', 'Police / Security Notified', 'Photo Evidence'],
      timing: 'Immediate Upon Occurrence'
    },
    {
      id: 'form-logistics-prep',
      title: 'Form LOG-01 - Opening Checklist & Logistics Readiness',
      category: 'Pre-Poll Inspection',
      type: 'accreditation',
      description: 'Assess presence of INEC security personnel, party polling agents, stamp pads, indelible ink, ballot boxes, and Braille tactile voting guides.',
      icon: ClipboardList,
      color: 'amber',
      bgColor: 'bg-amber-50 text-amber-800 border-amber-200',
      badge: 'Opening Phase',
      fields: ['Arrival of Officials', 'Completeness of Materials', 'Presence of Security', 'Party Agent Roll Call'],
      timing: '7:30 AM to 8:30 AM'
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Election Observation Forms"
        subtitle="Standardized statutory checklists and transmission forms for biometric accreditation, incident reporting, and EC8A result capture."
        breadcrumbs={[
          { label: 'Forms' }
        ]}
      />

      {/* Offline Storage Notice Banner */}
      <div className="p-4 bg-emerald-950 text-white rounded-2xl border border-emerald-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-800/80 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h4 className="text-sm font-bold font-serif">Offline Protocol Active</h4>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              All forms automatically cache locally if network signal drops in remote rural polling units. Forms sync automatically when back online.
            </p>
          </div>
        </div>

        <Link
          to="/report"
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-xs font-bold uppercase tracking-wider rounded-xl transition-all shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <span>Open Quick Form</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {forms.map((form) => {
          const Icon = form.icon;
          return (
            <div
              key={form.id}
              className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 shadow-xs p-6 flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${form.bgColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                        {form.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${form.bgColor}`}>
                        {form.badge}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{form.timing}</span>
                  </span>
                </div>

                <h3 className="text-base font-bold text-gray-900 tracking-tight font-serif mt-2">
                  {form.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  {form.description}
                </p>

                {/* Key Fields Checklist */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2">
                    Key Data Collected:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {form.fields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="truncate">{field}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400 font-mono">
                  Type: {form.type.toUpperCase()}
                </span>
                <Link
                  to={`/report?type=${form.type}`}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>Launch Form</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
