import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  badge,
  actions
}: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200/80 -mx-6 md:-mx-10 lg:-mx-12 -mt-6 md:-mt-10 lg:-mt-12 px-6 md:px-10 lg:px-12 py-5 mb-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
              <Link to="/dashboard" className="hover:text-emerald-700 flex items-center gap-1 transition-colors">
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {crumb.href ? (
                    <Link to={crumb.href} className="hover:text-emerald-700 font-medium transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-gray-800 font-semibold">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight font-serif">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>

          {subtitle && (
            <p className="text-sm text-gray-500 mt-1 max-w-2xl font-normal leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
