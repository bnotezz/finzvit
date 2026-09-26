import React, { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { fetchCompanyMeta, fetchReportData } from '../../lib/api';
import type { CompanyMeta, ReportData } from '../../lib/types';
import { CompanyHeader } from './CompanyHeader';
import { KpiCards } from './KpiCards';
import { ReportContainer } from '../reports/ReportContainer';
import { formatCurrency } from '../../lib/formatters';

interface CompanyPageViewProps {
  edrpou: string;
}

export const CompanyPageView: React.FC<CompanyPageViewProps> = ({ edrpou }) => {
  const [company, setCompany] = useState<CompanyMeta | null>(null);
  const [balanceReport, setBalanceReport] = useState<ReportData | null>(null);
  const [incomeReport, setIncomeReport] = useState<ReportData | null>(null);
  const [activeReport, setActiveReport] = useState<ReportData | null>(null);
  const [activeReportTitle, setActiveReportTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchCompanyMeta(edrpou)
      .then(async (meta) => {
        if (!isMounted) return;
        setCompany(meta);

        // Знаходимо форми Ф1 (Баланс) та Ф2 (Фінрезультати)
        // Для звичайних підприємств: S0100115 (Ф1), S0100215 (Ф2)
        // Для малих та мікропідприємств: S0110014 (1-м, 2-м), S0111007 (1-мс, 2-мс)
        const f1Form = meta.available_forms.find((f) => 
          f.code.includes('001') || f.code.includes('110') || f.code.includes('111')
        );
        const f2Form = meta.available_forms.find((f) => 
          f.code.includes('002') || f.code.includes('110') || f.code.includes('111')
        );

        const promises: Promise<any>[] = [];

        if (f1Form && f2Form && f1Form.code === f2Form.code) {
          // Якщо це об'єднана форма (малі / мікро) — завантажуємо один звіт для обох
          promises.push(
            fetchReportData(edrpou, f1Form.code)
              .then((rep) => {
                if (isMounted) {
                  setBalanceReport(rep);
                  setIncomeReport(rep);
                }
              })
              .catch((err) => console.error('Помилка завантаження комбінованого звіту:', err))
          );
        } else {
          if (f1Form) {
            promises.push(
              fetchReportData(edrpou, f1Form.code)
                .then((rep) => isMounted && setBalanceReport(rep))
                .catch((err) => console.error('Помилка завантаження Ф1:', err))
            );
          }
          if (f2Form) {
            promises.push(
              fetchReportData(edrpou, f2Form.code)
                .then((rep) => isMounted && setIncomeReport(rep))
                .catch((err) => console.error('Помилка завантаження Ф2:', err))
            );
          }
        }

        await Promise.all(promises);
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
  }, [edrpou]);

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
        onActiveReportChange={(title, rep) => {
          setActiveReportTitle(title);
          setActiveReport(rep);
          if (rep) {
            const code = rep.meta.form_code.toUpperCase();
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
