import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, ArrowLeft, AlertCircle, BarChart3, Building2, HelpCircle, ArrowRight } from 'lucide-react';
import { fetchCompanyData, fetchReportData } from '../../lib/api';
import type { CompanyFullData, ReportData } from '../../lib/types';
import { CompanyHeader } from './CompanyHeader';
import { ReportContainer } from '../reports/ReportContainer';
import { SearchBar } from '../search/SearchBar';
import { formatCurrency, calcNetIncome } from '../../lib/formatters';

interface CompanyPageViewProps {
  edrpou: string;
}

export const CompanyPageView: React.FC<CompanyPageViewProps> = ({ edrpou }) => {
  // Визначаємо актуальний код ЄДРПОУ (з пропсів або безпосередньо з URL-шляху)
  const effectiveEdrpou = useMemo(() => {
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
  const [activeTabOverride, setActiveTabOverride] = useState<string | undefined>(undefined);
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

    const data = (activeReport as any)?.data || activeReport || {};
    let csvContent = '\uFEFF'; // UTF-8 BOM для Excel
    csvContent += `Звіт: ${activeReportTitle || (activeReport as any)?.meta?.form_name || 'Фінансовий звіт'}\n`;
    csvContent += `Підприємство: ${company.name}\n`;
    csvContent += `ЄДРПОУ: ${company.edrpou}\n`;
    csvContent += `Період: ${company.year || 2025} рік\n\n`;

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
    link.setAttribute('download', `FinZvit_${company.edrpou}_${company.year || 2025}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Швидкі показники для компактної плашки
  const quickKpi = useMemo(() => {
    const kpi = (company as any)?.financial_kpi;
    if (kpi) {
      return {
        revenue: kpi.revenue?.current,
        netProfit: kpi.net_profit?.current,
        netMargin: kpi.net_margin_pct,
        assets: kpi.assets?.current,
      };
    }
    const bData = (balanceReport as any)?.data || balanceReport || {};
    const iData = (incomeReport as any)?.data || incomeReport || {};
    const netProfit = calcNetIncome(iData['2350']?.current, iData['2355']?.current);
    const revenue = iData['2000']?.current ?? null;
    const netMargin = (netProfit !== null && revenue && revenue > 0)
      ? Number(((netProfit / revenue) * 100).toFixed(1))
      : null;
    return {
      revenue,
      netProfit,
      netMargin,
      assets: bData['1300']?.end ?? bData['1900']?.end ?? null,
    };
  }, [company, balanceReport, incomeReport]);

  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-4 text-zinc-400">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
        <p className="text-sm font-medium">Завантаження фінансової звітності підприємства...</p>
      </div>
    );
  }

  // Адекватний та інформативний 404 екран, коли звітність чи компанію не знайдено
  if (error || !company) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-8 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto shadow-xl shadow-rose-500/5">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-white/10 text-xs font-mono text-zinc-400">
            <span>404</span>
            <span>•</span>
            <span>ЄДРПОУ {effectiveEdrpou || 'не вказано'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Фінансову звітність не знайдено
          </h2>
          <p className="text-zinc-400 text-sm max-w-lg mx-auto leading-relaxed">
            {error || `Для підприємства з кодом ЄДРПОУ «${effectiveEdrpou}» відсутня подана фінансова звітність за 2025 рік у відкритому реєстрі.`}
          </p>
        </div>

        {/* Діагностичні причини */}
        <div className="p-5 rounded-2xl border border-white/5 bg-zinc-950/60 text-left space-y-3 text-xs text-zinc-400">
          <div className="font-semibold text-zinc-300 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-accent" />
            <span>Можливі причини відсутності даних:</span>
          </div>
          <ul className="space-y-2 pl-6 list-disc text-zinc-400 leading-relaxed">
            <li>
              <strong className="text-zinc-300">Звітність не подавалась:</strong> юридична особа могла не подати річну звітність до органів Держстату або ДПС.
            </li>
            <li>
              <strong className="text-zinc-300">Фізична особа-підприємець (ФОП):</strong> ФОПи подають податкові декларації, а не балансові форми підприємств (Ф1, Ф2 тощо).
            </li>
            <li>
              <strong className="text-zinc-300">Помилка в коді:</strong> код ЄДРПОУ української юридичної особи складається рівно з 8 цифр.
            </li>
          </ul>
        </div>

        {/* Пошук іншого підприємства прямо на сторінці 404 */}
        <div className="pt-2 space-y-3">
          <div className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
            Спробуйте знайти інше підприємство:
          </div>
          <div className="w-full max-w-xl mx-auto">
            <SearchBar size="large" autoFocus={false} />
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white text-xs font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
            <span>На головну сторінку</span>
          </a>
          <a
            href="/company/32673400"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent text-xs font-medium transition-all"
          >
            <Building2 className="w-4 h-4" />
            <span>Зразок: Кормотех (32673400)</span>
          </a>
        </div>
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

      {/* 2. Компактна плашка швидких показників (не займає екран і веде до вкладки KPI) */}
      {(quickKpi.revenue || quickKpi.assets) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-950/60 border border-white/5 backdrop-blur-xl no-print text-xs">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 font-mono">
            {quickKpi.revenue !== null && quickKpi.revenue !== undefined && (
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 uppercase text-[11px]">Дохід:</span>
                <span className="text-white font-semibold">{formatCurrency(quickKpi.revenue)} тис. ₴</span>
              </div>
            )}
            {quickKpi.netProfit !== null && quickKpi.netProfit !== undefined && (
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 uppercase text-[11px]">
                  {Number(quickKpi.netProfit) >= 0 ? 'Прибуток:' : 'Збиток:'}
                </span>
                <span className={`font-semibold ${Number(quickKpi.netProfit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(quickKpi.netProfit)} тис. ₴
                </span>
              </div>
            )}
            {quickKpi.assets !== null && quickKpi.assets !== undefined && (
              <div className="hidden md:flex items-center gap-1.5">
                <span className="text-zinc-500 uppercase text-[11px]">Активи:</span>
                <span className="text-zinc-300 font-semibold">{formatCurrency(quickKpi.assets)} тис. ₴</span>
              </div>
            )}
            {quickKpi.netMargin !== null && quickKpi.netMargin !== undefined && (
              <div className="hidden lg:flex items-center gap-1.5">
                <span className="text-zinc-500 uppercase text-[11px]">Маржинальність:</span>
                <span className={`font-semibold ${Number(quickKpi.netMargin) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {Number(quickKpi.netMargin) > 0 ? `+${quickKpi.netMargin}%` : `${quickKpi.netMargin}%`}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setActiveTabOverride('KPI')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent font-medium text-xs transition-colors cursor-pointer ml-auto"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Аналітика KPI</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      )}

      {/* 3. Таби та відображення звітів (з вбудованою вкладкою KPI) */}
      <ReportContainer
        company={company}
        initialReports={company.reports}
        balanceReport={balanceReport}
        incomeReport={incomeReport}
        activeTabOverride={activeTabOverride}
        onActiveReportChange={(title, rep) => {
          setActiveReportTitle(title);
          setActiveReport(rep);
          setActiveTabOverride(undefined);
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

