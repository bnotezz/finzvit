import React, { useState, useEffect } from 'react';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { fetchReportData } from '../../lib/api';
import type { CompanyMeta, ReportData } from '../../lib/types';
import { RenderF1Balance } from './RenderF1Balance';
import { RenderF2Income } from './RenderF2Income';
import { RenderF3CashFlow } from './RenderF3CashFlow';
import { RenderF4Equity } from './RenderF4Equity';
import { RenderF5Notes } from './RenderF5Notes';
import { RenderMicroReport } from './RenderMicroReport';
import { RenderGenericReport } from './RenderGenericReport';

interface ReportContainerProps {
  company: CompanyMeta;
  onActiveReportChange?: (reportTitle: string, reportData: ReportData | null) => void;
}

export const ReportContainer: React.FC<ReportContainerProps> = ({
  company,
  onActiveReportChange,
}) => {
  const forms = company.available_forms || [];
  const [activeFormCode, setActiveFormCode] = useState<string>(forms[0]?.code || '');
  const [loadedReports, setLoadedReports] = useState<Record<string, ReportData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Завантаження звіту при зміні активного табу
  useEffect(() => {
    if (!activeFormCode) return;

    if (loadedReports[activeFormCode]) {
      const rep = loadedReports[activeFormCode];
      onActiveReportChange?.(rep.meta.form_name, rep);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchReportData(company.edrpou, activeFormCode, company.year || 2025)
      .then((data) => {
        if (!isMounted) return;
        setLoadedReports((prev) => ({ ...prev, [activeFormCode]: data }));
        onActiveReportChange?.(data.meta.form_name, data);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Помилка завантаження звіту:', err);
        setError(`Не вдалося завантажити звіт (${err.message})`);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeFormCode, company.edrpou]);

  if (forms.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl border border-zinc-800 bg-surface-card">
        <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">Звітів для цієї компанії не знайдено.</p>
      </div>
    );
  }

  const currentReport = loadedReports[activeFormCode];

  // Вибір рендерера залежно від коду форми
  const renderReportContent = () => {
    if (!currentReport) return null;

    const code = activeFormCode.toUpperCase();
    if (code.includes('001')) {
      return <RenderF1Balance report={currentReport} />;
    } else if (code.includes('002')) {
      return <RenderF2Income report={currentReport} />;
    } else if (code.includes('003') || code.includes('335')) {
      return <RenderF3CashFlow report={currentReport} />;
    } else if (code.includes('040')) {
      return <RenderF4Equity report={currentReport} />;
    } else if (code.includes('050') || code.includes('105')) {
      return <RenderF5Notes report={currentReport} />;
    } else if (code.includes('100') || code.includes('111')) {
      return <RenderMicroReport report={currentReport} />;
    } else {
      return <RenderGenericReport report={currentReport} />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Навігація за табами */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border-subtle no-print">
        {forms.map((form) => {
          const isActive = form.code === activeFormCode;
          return (
            <button
              key={form.code}
              onClick={() => setActiveFormCode(form.code)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 border ${
                isActive
                  ? 'bg-accent/10 border-accent/40 text-accent shadow-sm'
                  : 'bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800'
              }`}
            >
              <FileText className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-zinc-500'}`} />
              <span>{form.title}</span>
            </button>
          );
        })}
      </div>

      {/* Стан завантаження / помилки / відображення звіту */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <span className="text-sm">Завантаження офіційної форми звіту...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 text-rose-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      ) : (
        renderReportContent()
      )}
    </div>
  );
};
