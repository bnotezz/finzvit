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
import { CompanyReportNav } from '../company/CompanyReportNav';

interface ReportContainerProps {
  company: CompanyMeta & { reports?: Record<string, any> };
  initialReports?: Record<string, ReportData>;
  balanceReport?: ReportData | null;
  incomeReport?: ReportData | null;
  activeTabOverride?: string;
  onActiveReportChange?: (reportTitle: string, reportData: ReportData | null) => void;
  // Мультирічність та навігація по роках
  selectedYear: number;
  availableYears: number[];
  supportedYears: readonly number[];
  onYearChange: (year: number) => void;
  isYearLoading?: boolean;
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
  selectedYear,
  availableYears,
  supportedYears,
  onYearChange,
  isYearLoading = false,
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

  // Якщо поточна форма відсутня у новому році, перемикаємо на першу доступну форму або KPI
  useEffect(() => {
    if (activeFormCode === 'KPI') return;
    const formExists = sortedForms.some((f) => f.code === activeFormCode);
    if (!formExists) {
      setActiveFormCode(sortedForms[0]?.code || 'KPI');
    }
  }, [sortedForms]);

  // Синхронізація звітів при зміні компанії або року
  useEffect(() => {
    const reps = initialReports || company.reports || {};
    setLoadedReports(reps);
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

  const currentReport = loadedReports[activeFormCode];
  const activeForm = sortedForms.find((f) => f.code === activeFormCode);
  const formTitle = activeForm?.title || activeFormCode;

  // Вибір контенту залежно від обраного табу
  const renderReportContent = () => {
    if (activeFormCode === 'KPI') {
      return <KpiCards balanceReport={balanceReport} incomeReport={incomeReport} company={company} />;
    }

    if (!currentReport) {
      return (
        <div className="p-8 text-center rounded-2xl border border-zinc-800 bg-surface-card">
          <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">Звіт форми {formTitle} відсутній у наборі даних за {selectedYear} рік.</p>
        </div>
      );
    }

    const code = activeFormCode.toUpperCase().trim();
    const effectiveYear = company.year || selectedYear;

    if (code.startsWith('S01001')) {
      return <RenderF1Balance report={currentReport} year={effectiveYear} />;
    } else if (code.startsWith('S01002')) {
      return <RenderF2Income report={currentReport} year={effectiveYear} />;
    } else if (code.startsWith('S01100') || code.startsWith('S01110')) {
      return <RenderMicroReport report={currentReport} year={effectiveYear} />;
    } else if (code.startsWith('S01003') || code.startsWith('S01033')) {
      return <RenderF3CashFlow report={currentReport} year={effectiveYear} />;
    } else if (code.startsWith('S01040')) {
      return <RenderF4Equity report={currentReport} year={effectiveYear} />;
    } else if (code.startsWith('S01050')) {
      return <RenderF5Notes report={currentReport} year={effectiveYear} />;
    } else {
      return (
        <RenderGenericReport
          report={currentReport}
          formTitle={formTitle}
          formCode={activeFormCode}
          year={effectiveYear}
        />
      );
    }
  };

  if (sortedForms.length === 0 && !balanceReport && !incomeReport) {
    return (
      <div className="space-y-4">
        <CompanyReportNav
          selectedYear={selectedYear}
          availableYears={availableYears}
          supportedYears={supportedYears}
          onSelectYear={onYearChange}
          isYearLoading={isYearLoading}
          forms={[]}
          activeFormCode=""
          onSelectForm={setActiveFormCode}
          hasKpi={false}
        />
        <div className="p-8 text-center rounded-2xl border border-zinc-800 bg-surface-card">
          <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">Фінансових звітів за {selectedYear} рік для цієї компанії не знайдено.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Дворівнева навігація: Рівень 1 - Роки, Рівень 2 - Форми звітності */}
      <CompanyReportNav
        selectedYear={selectedYear}
        availableYears={availableYears}
        supportedYears={supportedYears}
        onSelectYear={onYearChange}
        isYearLoading={isYearLoading}
        forms={sortedForms}
        activeFormCode={activeFormCode}
        onSelectForm={setActiveFormCode}
        hasKpi={true}
      />

      {/* Відображення активного звіту або вкладки KPI з індикацією оновлення року */}
      <div className={`transition-opacity duration-200 ${isYearLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        {renderReportContent()}
      </div>
    </div>
  );
};

