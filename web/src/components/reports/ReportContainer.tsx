import React, { useState, useEffect, useMemo } from 'react';
import { FileText, BarChart3 } from 'lucide-react';
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
  company: CompanyMeta & { reports?: Record<string, any> };
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
  const c = (code || '').toUpperCase().trim();
  if (c.startsWith('S01001')) return 1; // Ф1 Баланс
  if (c.startsWith('S01002')) return 2; // Ф2 Фінрезультати
  if (c.startsWith('S01100')) return 3; // 1-м / 2-м Малі
  if (c.startsWith('S01110')) return 4; // 1-мс / 2-мс Мікро
  if (c.startsWith('S01003') || c.startsWith('S01033')) return 5; // Ф3 / Ф3-н Рух коштів
  if (c.startsWith('S01040')) return 6; // Ф4 Власний капітал
  if (c.startsWith('S01050')) return 7; // Ф5 Примітки
  if (c.startsWith('S01060')) return 8; // Ф6 Сегменти
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
  const [loadedReports, setLoadedReports] = useState<Record<string, any>>(() => {
    return initialReports || company.reports || {};
  });

  // Синхронізація активного табу ззовні, якщо передано activeTabOverride
  useEffect(() => {
    if (activeTabOverride) {
      setActiveFormCode(activeTabOverride);
    }
  }, [activeTabOverride]);

  // Синхронізація попередньо завантажених звітів
  useEffect(() => {
    const reps = initialReports || company.reports;
    if (reps && Object.keys(reps).length > 0) {
      setLoadedReports(reps);
    }
  }, [initialReports, company.reports]);

  // Активація обраного звіту при зміні активного табу
  useEffect(() => {
    if (!activeFormCode || activeFormCode === 'KPI') {
      if (activeFormCode === 'KPI') {
        onActiveReportChange?.('Фінансові показники (KPI)', null);
      }
      return;
    }

    const activeForm = sortedForms.find((f) => f.code === activeFormCode);
    const formTitle = activeForm?.title || activeFormCode;
    const rep = loadedReports[activeFormCode] || null;

    onActiveReportChange?.(formTitle, rep);
  }, [activeFormCode, loadedReports, sortedForms]);

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

    if (!currentReport) {
      return (
        <div className="p-8 text-center rounded-2xl border border-zinc-800 bg-surface-card">
          <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">Звіт форми {formTitle} відсутній у наборі даних цієї компанії.</p>
        </div>
      );
    }

    const code = activeFormCode.toUpperCase().trim();
    if (code.startsWith('S01001')) {
      return <RenderF1Balance report={currentReport} />;
    } else if (code.startsWith('S01002')) {
      return <RenderF2Income report={currentReport} />;
    } else if (code.startsWith('S01100') || code.startsWith('S01110')) {
      return <RenderMicroReport report={currentReport} />;
    } else if (code.startsWith('S01003') || code.startsWith('S01033')) {
      return <RenderF3CashFlow report={currentReport} />;
    } else if (code.startsWith('S01040')) {
      return <RenderF4Equity report={currentReport} />;
    } else if (code.startsWith('S01050')) {
      return <RenderF5Notes report={currentReport} />;
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

      {/* Відображення активного звіту або вкладки KPI */}
      {renderReportContent()}
    </div>
  );
};

