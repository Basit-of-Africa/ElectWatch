import React from 'react';
import { Severity, IncidentStatus, ReportType, CheckInStatus } from '../../types';

interface StatusBadgeProps {
  type?: 'severity' | 'incidentStatus' | 'reportType' | 'checkInStatus' | 'general';
  value?: Severity | IncidentStatus | ReportType | CheckInStatus | string;
  label?: string;
  variant?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StatusBadge({
  type = 'general',
  value,
  label: explicitLabel,
  variant,
  size = 'sm',
  className = ''
}: StatusBadgeProps) {
  const actualValue = value || explicitLabel || variant || 'active';
  const sizeClasses = size === 'sm' 
    ? 'text-[11px] px-2.5 py-0.5 font-bold uppercase tracking-wider' 
    : 'text-xs px-3 py-1 font-bold uppercase tracking-wider';

  let colorClasses = 'bg-gray-100 text-gray-700 border-gray-200';
  let label = explicitLabel || String(actualValue);

  // Active / round active badges
  if (actualValue === 'active' || String(actualValue).toLowerCase().includes('active')) {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    label = explicitLabel || 'Active';
  }

  // Severity badges
  if (value === 'critical') {
    colorClasses = 'bg-red-100 text-red-800 border-red-200';
    label = 'Critical';
  } else if (value === 'high') {
    colorClasses = 'bg-orange-100 text-orange-800 border-orange-200';
    label = 'High';
  } else if (value === 'medium') {
    colorClasses = 'bg-amber-100 text-amber-800 border-amber-200';
    label = 'Medium';
  } else if (value === 'low') {
    colorClasses = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    label = 'Low';
  }

  // Incident status
  else if (value === 'pending') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
    label = 'Pending Review';
  } else if (value === 'investigating') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
    label = 'Investigating';
  } else if (value === 'resolved') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    label = 'Resolved';
  }

  // Report types
  else if (value === 'incident') {
    colorClasses = 'bg-red-50 text-red-700 border-red-200';
    label = 'Incident';
  } else if (value === 'accreditation') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
    label = 'Accreditation';
  } else if (value === 'result') {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    label = 'Official Result';
  }

  // CheckIn status
  else if (value === 'checked_in') {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    label = 'On-Site';
  } else if (value === 'en_route') {
    colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
    label = 'En Route';
  } else if (value === 'not_checked_in') {
    colorClasses = 'bg-gray-100 text-gray-600 border-gray-200';
    label = 'Pending Check-In';
  }

  // General statuses
  else if (value === 'verified' || value === 'active') {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (value === 'awaiting_review' || value === 'in_progress') {
    colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
  }

  return (
    <span className={`inline-flex items-center rounded-full border ${sizeClasses} ${colorClasses} ${className}`}>
      {label}
    </span>
  );
}
