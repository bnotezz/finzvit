import React, { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { fetchCompanyData, fetchReportData } from '../../lib/api';
import type { CompanyFullData, ReportData } from '../../lib/types';
import { CompanyHeader } from './CompanyHeader';
import { KpiCards } from './KpiCards';
import { ReportContainer } from '../reports/ReportContainer';
import { formatCurrency } from '../../lib/formatters';

interface CompanyPageViewProps {
  edrpou: string;
}

export const CompanyPageView: React.FC<CompanyPageViewProps> = ({ edrpou }) => {
  // Визначаємо актуальний код ЄДРПОУ (з пропсів або безпосередньо з URL-шляху)
  const effectiveEdrpou = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && /^\d+$/.test(last)) {
        return last;
      }
    }
    return edrpou || '';
  }, [edrpou]);

  const [company, setCompany] = useState<CompanyFullData | null>(null);
  const [balanceReport, setBalanceReport] = useState<ReportData | null>(null);
  const [incomeReport, setIncomeReport] = useState<ReportData | null>(null);
  const [activeReport, setActiveReport] = useState<ReportData | null>(null);
  const [activeReportTitle, setActiveReportTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveEdrpou) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    // Завантажуємо єдиний консолідований JSON компанії за 1 мережевий запит
    fetchCompanyData(effectiveEdrpou)
      .then(async (data) => {
        if (!isMounted) return;
        setCompany(data);

        // Знаходимо форми Ф1 (Баланс) та Ф2 (Фінрезультати)
        const forms = data.available_forms || [];
        const f1Form = forms.find((f) => 
          f.code.includes('001') || f.code.includes('110') || f.code.includes('111')
        );
        const f2Form = forms.find((f) => 
          f.code.includes('002') || f.code.includes('110') || f.code.includes('111')
        );

        // Якщо звіти вже вбудовані в консолідований документ — встановлюємо їх миттєво з пам'яті
        if (data.reports) {
          if (f1Form && data.reports[f1Form.code]) {
            setBalanceReport(data.reports[f1Form.code]);
          }
          if (f2Form && data.reports[f2Form.code]) {
            setIncomeReport(data.reports[f2Form.code]);
          }
        }

        // Fallback: якщо це застаріле джерело без вбудованих звітів, довантажуємо окремо
        const fallbackPromises: Promise<any>[] = [];
        if (f1Form && (!data.reports || !data.reports[f1Form.code])) {
          fallbackPromises.push(
            fetchReportData(effectiveEdrpou, f1Form.code)
              .then((rep) => isMounted && setBalanceReport(rep))
              .catch((err) => console.error('Помилка довантаження Ф1:', err))
          );
        }
        if (f2Form && f2Form.code !== f1Form?.code && (!data.reports || !data.reports[f2Form.code])) {
          fallbackPromises.push(
            fetchReportData(effectiveEdrpou, f2Form.code)
              .then((rep) => isMounted && setIncomeReport(rep))
              .catch((err) => console.error('Помилка довантаження Ф2:', err))
          );
        }

        if (fallbackPromises.length > 0) {
          await Promise.all(fallbackPromises);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Помилка завантаження компанії:', err);
        setError(err.message || 'Не вдалося завантажити дані компанії.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveEdrpou]);

  // Експорт активного звіту у CSV
  const handleExportCsv = () => {
    if (!activeReport || !company) return;

    const data = activeReport.data || {};
    let csvContent = '\uFEFF'; // UTF-8 BOM для Excel
    csvContent += `Звіт: ${activeReport.meta.form_name}\n`;
    csvContent += `Підприємство: ${company.name}\n`;
    csvContent += `ЄДРПОУ: ${company.edrpou}\n`;
    csvContent += `Період: 2025 рік\n\n`;

    csvContent += `Код рядка,Початок / Попередній,Кінець / Звітний\n`;

    Object.entries(data).forEach(([code, vals]: [string, any]) => {
      if (typeof vals === 'object' && vals !== null) {
        if ('begin' in vals || 'end' in vals) {
          csvContent += `"${code}","${vals.begin ?? ''}","${vals.end ?? ''}"\n`;
        } else if ('previous' in vals || 'current' in vals) {
          csvContent += `"${code}","${vals.previous ?? ''}","${vals.current ?? ''}"\n`;
        } else {
          const colVals = Object.entries(vals).map(([k, v]) => `${k}:${v}`).join('; ');
          csvContent += `"${code}","${colVals}",""\n`;
        }
      } else {
        csvContent += `"${code}","${vals ?? ''}",""\n`;
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FinZvit_${company.edrpou}_${activeReport.meta.form_code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-4 text-zinc-400">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
        <p className="text-sm font-medium">Завантаження фінансової звітності підприємства...</p>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Звітність не знайдена</h2>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            {error || `Для ЄДРПОУ ${edrpou} відсутні подані звіти за 2025 рік або код введено невірно.`}
          </p>
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Повернутися до пошуку</span>
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Кнопка повернення */}
      <div className="no-print">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Назад до пошуку</span>
        </a>
      </div>

      {/* 1. Шапка компанії */}
      <CompanyHeader
        company={company}
        activeReportTitle={activeReportTitle}
        onExportCsv={handleExportCsv}
      />

      {/* 2. KPI Картки */}
      <KpiCards
        balanceReport={balanceReport}
        incomeReport={incomeReport}
      />

      {/* 3. Таби та відображення звітів */}
      <ReportContainer
        company={company}
        initialReports={company.reports}
        onActiveReportChange={(title, rep) => {
          setActiveReportTitle(title);
          setActiveReport(rep);
          if (rep) {
            const rawCode = (rep as any)?.meta?.form_code;
            const matchingForm = company.available_forms?.find((f) => f.title === title || f.code === rawCode);
            const code = (rawCode || matchingForm?.code || '').toUpperCase();
            if (code.includes('001')) setBalanceReport(rep);
            if (code.includes('002')) setIncomeReport(rep);
            if (code.includes('110') || code.includes('111')) {
              setBalanceReport(rep);
              setIncomeReport(rep);
            }
          }
        }}
      />
    </div>
  );
};
