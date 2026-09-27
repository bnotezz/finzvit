import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, FileText, AlertCircle, BarChart3 } from 'lucide-react';
import { fetchReportData } from '../../lib/api';
import type { CompanyMeta, ReportData } from '../../lib/types';
import { RenderF1Balance } from './RenderF1Balance';
import { RenderF2Income } from './RenderF2Income';
import { RenderF3CashFlow } from './RenderF3CashFlow';
import { RenderF4Equity } from './RenderF4Equity';
import { RenderF5Notes } from './RenderF5Notes';
import { RenderMicroReport } from './RenderMicroReport';
import { RenderGenericReport } from './RenderGenericReport';
import { KpiCards } from '../company/KpiCards';

interface ReportContainerProps {
  company: CompanyMeta;
  initialReports?: Record<string, ReportData>;
  balanceReport?: ReportData | null;
  incomeReport?: ReportData | null;
  activeTabOverride?: string;
  onActiveReportChange?: (reportTitle: string, reportData: ReportData | null) => void;
}

// Канонічний порядок офіційних форм звітності України:
// 1: Баланс (Ф1 / 1-м / 1-мс)
// 2: Звіт про фінансові результати (Ф2 / 2-м / 2-мс)
// 3: Звіт про рух грошових коштів (Ф3 / Ф3-н)
// 4: Звіт про власний капітал (Ф4)
// 5: Примітки до річної звітності (Ф5)
const getFormOrder = (code: string): number => {
  const c = (code || '').toUpperCase();
  if (c.includes('001')) return 1; // Ф1 Баланс
  if (c.includes('002')) return 2; // Ф2 Фінрезультати
  if (c.includes('110') || c.includes('100')) return 2.1; // 1-м / 2-м
  if (c.includes('111')) return 2.2; // 1-мс / 2-мс
  if (c.includes('003') || c.includes('033') || c.includes('335')) return 3; // Ф3 / Ф3-н Рух коштів
  if (c.includes('040')) return 4; // Ф4 Власний капітал
  if (c.includes('050') || c.includes('105')) return 5; // Ф5 Примітки
  return 10;
};

export const ReportContainer: React.FC<ReportContainerProps> = ({
  company,
  initialReports,
  balanceReport,
  incomeReport,
  activeTabOverride,
  onActiveReportChange,
}) => {
  const rawForms = company.available_forms || [];

  // Строге канонічне сортування звітів: Ф1 -> Ф2 -> Ф3 -> Ф4 -> Ф5
  const sortedForms = useMemo(() => {
    return [...rawForms].sort((a, b) => getFormOrder(a.code) - getFormOrder(b.code));
  }, [rawForms]);

  const [activeFormCode, setActiveFormCode] = useState<string>(
    activeTabOverride || sortedForms[0]?.code || 'KPI'
  );
  const [loadedReports, setLoadedReports] = useState<Record<string, ReportData>>(initialReports || {});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Синхронізація активного табу ззовні, якщо передано activeTabOverride
  useEffect(() => {
    if (activeTabOverride) {
      setActiveFormCode(activeTabOverride);
    }
  }, [activeTabOverride]);

  // Синхронізація попередньо завантажених звітів
  useEffect(() => {
    if (initialReports && Object.keys(initialReports).length > 0) {
      setLoadedReports((prev) => ({ ...initialReports, ...prev }));
    }
  }, [initialReports]);

  // Завантаження або активація звіту при зміні активного табу
  useEffect(() => {
    if (!activeFormCode || activeFormCode === 'KPI') {
      if (activeFormCode === 'KPI') {
        onActiveReportChange?.('Фінансові показники (KPI)', null);
      }
      return;
    }

    const activeForm = sortedForms.find((f) => f.code === activeFormCode);
    const formTitle = activeForm?.title || activeFormCode;

    if (loadedReports[activeFormCode]) {
      const rep = loadedReports[activeFormCode];
      onActiveReportChange?.(formTitle, rep);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchReportData(company.edrpou, activeFormCode, company.year || 2025)
      .then((data) => {
        if (!isMounted) return;
        setLoadedReports((prev) => ({ ...prev, [activeFormCode]: data }));
        onActiveReportChange?.(formTitle, data);
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
  }, [activeFormCode, company.edrpou, loadedReports, sortedForms]);

  if (sortedForms.length === 0 && !balanceReport && !incomeReport) {
    return (
      <div className="p-8 text-center rounded-2xl border border-zinc-800 bg-surface-card">
        <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">Звітів для цієї компанії не знайдено.</p>
      </div>
    );
  }

  const currentReport = loadedReports[activeFormCode];
  const activeForm = sortedForms.find((f) => f.code === activeFormCode);
  const formTitle = activeForm?.title || activeFormCode;

  // Вибір контенту залежно від обраного табу
  const renderReportContent = () => {
    if (activeFormCode === 'KPI') {
      return <KpiCards balanceReport={balanceReport} incomeReport={incomeReport} />;
    }

    if (!currentReport) return null;

    const code = activeFormCode.toUpperCase();
    if (code.includes('001')) {
      return <RenderF1Balance report={currentReport} />;
    } else if (code.includes('002')) {
      return <RenderF2Income report={currentReport} />;
    } else if (code.includes('003') || code.includes('335') || code.includes('033')) {
      return <RenderF3CashFlow report={currentReport} />;
    } else if (code.includes('040')) {
      return <RenderF4Equity report={currentReport} />;
    } else if (code.includes('050') || code.includes('105')) {
      return <RenderF5Notes report={currentReport} />;
    } else if (code.includes('100') || code.includes('111')) {
      return <RenderMicroReport report={currentReport} />;
    } else {
      return (
        <RenderGenericReport
          report={currentReport}
          formTitle={formTitle}
          formCode={activeFormCode}
          year={company.year}
        />
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Навігація за табами зі строгим порядком (Ф1 -> Ф2 -> Ф3 -> Ф4 -> Ф5 -> KPI) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5 no-print">
        {sortedForms.map((form) => {
          const isActive = form.code === activeFormCode;
          return (
            <button
              key={form.code}
              type="button"
              onClick={() => setActiveFormCode(form.code)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 border cursor-pointer select-none ${
                isActive
                  ? 'bg-accent/15 border-accent/40 text-accent shadow-sm'
                  : 'bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800/80'
              }`}
            >
              <FileText className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-zinc-500'}`} />
              <span>{form.title}</span>
            </button>
          );
        })}

        {/* Окрема вкладка для аналітичних KPI показників */}
        <button
          type="button"
          onClick={() => setActiveFormCode('KPI')}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 border cursor-pointer select-none ml-auto ${
            activeFormCode === 'KPI'
              ? 'bg-accent/20 border-accent text-accent shadow-md shadow-accent/10'
              : 'bg-zinc-900/40 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800/80'
          }`}
        >
          <BarChart3 className={`w-4 h-4 ${activeFormCode === 'KPI' ? 'text-accent' : 'text-zinc-500'}`} />
          <span>Показники (KPI)</span>
        </button>
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

