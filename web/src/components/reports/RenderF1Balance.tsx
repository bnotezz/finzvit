import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { F1_BALANCE_ROWS } from '../../lib/form-definitions';
import { formatCurrency, calculateChange } from '../../lib/formatters';
import type { ReportData } from '../../lib/types';

interface RenderF1BalanceProps {
  report: ReportData;
  year?: number;
}

export const RenderF1Balance: React.FC<RenderF1BalanceProps> = ({ report, year }) => {
  const data = (report as any)?.data || report || {};
  const displayYear = year || report.meta?.period_year;

  // Фільтри та керування відображенням
  const [activeTab, setActiveTab] = useState<'all' | 'asset' | 'liability'>('all');
  const [onlyFilled, setOnlyFilled] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  // Фільтрація рядків
  const filteredRows = useMemo(() => {
    return F1_BALANCE_ROWS.filter((row) => {
      // 1. Фільтр за табом Актив / Пасив
      if (activeTab === 'asset' && row.section !== 'АКТИВ') return false;
      if (activeTab === 'liability' && row.section !== 'ПАСИВ') return false;

      // 2. Фільтр заповнених статей
      if (onlyFilled && row.code) {
        // Підсумкові рядки залишаємо завжди
        if (row.isTotal) return true;
        const vals = data[row.code];
        const hasData = vals && (vals.begin !== null || vals.end !== null);
        return hasData;
      }

      return true;
    });
  }, [activeTab, onlyFilled, data]);

  // Підрахунок заповнених статей для бейджа
  const filledCount = useMemo(() => {
    return Object.keys(data).filter((k) => {
      const v = data[k];
      return v && (v.begin !== null || v.end !== null);
    }).length;
  }, [data]);

  // Швидкі підсумки балансу (Актив ряд. 1300 vs Пасив ряд. 1900)
  const assetRow = data['1300'];
  const liabilityRow = data['1900'];
  const assetEnd = assetRow?.end ?? null;
  const assetBegin = assetRow?.begin ?? null;
  const liabilityEnd = liabilityRow?.end ?? null;
  const liabilityBegin = liabilityRow?.begin ?? null;
  const hasTotals = assetEnd !== null || liabilityEnd !== null;
  const isBalanced =
    assetEnd !== null && liabilityEnd !== null && Math.abs(Number(assetEnd) - Number(liabilityEnd)) < 0.01;

  let currentSection = '';

  return (
    <div className="rounded-2xl border border-border-card bg-surface-card shadow-2xl backdrop-blur-md overflow-hidden">
      {/* Шапка форми з перемикачами */}
      <div className="p-3.5 sm:p-5 border-b border-border-subtle bg-zinc-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white print:text-black tracking-tight">
              Баланс (Звіт про фінансовий стан)
            </h2>
            <span className="text-[10px] sm:text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-accent print:bg-transparent print:border-black print:text-black border border-accent/20 shrink-0">
              Форма № 1
            </span>
            <span className="hidden print:inline text-[9pt] font-mono text-black">
              (ДКУД 1801001)
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-zinc-400 print:text-black mt-0.5 leading-normal">
            Звітний період: на 31 грудня {displayYear ? `${displayYear} року` : ''} · Одиниця виміру: тис. гривень (тис. ₴)
          </p>
        </div>

        {/* Панель керування (Актив/Пасив та фільтр заповнених) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs no-print w-full md:w-auto">
          {/* Таби Актив / Пасив */}
          <div className="grid grid-cols-3 sm:flex items-center bg-zinc-900/90 border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium text-center transition-all ${
                activeTab === 'all'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="sm:hidden">Усі</span>
              <span className="hidden sm:inline">Усі (Актив + Пасив)</span>
            </button>
            <button
              onClick={() => setActiveTab('asset')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium text-center transition-all ${
                activeTab === 'asset'
                  ? 'bg-zinc-800 text-accent shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="sm:hidden">Актив</span>
              <span className="hidden sm:inline">Тільки Актив</span>
            </button>
            <button
              onClick={() => setActiveTab('liability')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium text-center transition-all ${
                activeTab === 'liability'
                  ? 'bg-zinc-800 text-indigo-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="sm:hidden">Пасив</span>
              <span className="hidden sm:inline">Тільки Пасив</span>
            </button>
          </div>

          {/* Перемикач тільки заповнених */}
          <button
            onClick={() => setOnlyFilled(!onlyFilled)}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl border transition-colors ${
              onlyFilled
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Перемкнути відображення порожніх рядків бланку"
          >
            {onlyFilled ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
            <span>{onlyFilled ? `Заповнені (${filledCount})` : 'Усі статті форми'}</span>
          </button>
        </div>
      </div>

      {/* Мобільні швидкі підсумки балансу (Актив vs Пасив) */}
      {hasTotals && (
        <div className="sm:hidden p-3 bg-zinc-900/40 border-b border-border-subtle space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Актив (1300) */}
            <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="font-medium">Актив (1300)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
              </div>
              <div className="text-sm font-bold font-mono text-white mt-1">
                {formatCurrency(assetEnd)}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                Поч: {formatCurrency(assetBegin)}
              </div>
            </div>

            {/* Пасив (1900) */}
            <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="font-medium">Пасив (1900)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              </div>
              <div className="text-sm font-bold font-mono text-white mt-1">
                {formatCurrency(liabilityEnd)}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                Поч: {formatCurrency(liabilityBegin)}
              </div>
            </div>
          </div>

          {/* Індикатор рівності балансу */}
          {assetEnd !== null && liabilityEnd !== null && (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-[11px]">
              <span className="text-zinc-400">Рівність Балансу:</span>
              {isBalanced ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Збігається (Актив = Пасив)
                </span>
              ) : (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Δ {(Number(assetEnd) - Number(liabilityEnd)).toLocaleString('uk-UA')} тис. ₴
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Мобільна підказка про свайп таблиці */}
      <div className="flex sm:hidden items-center justify-between px-3 py-1.5 bg-zinc-900/70 border-b border-zinc-800 text-[11px] text-zinc-400 select-none">
        <span className="flex items-center gap-1.5 text-zinc-400">
          <span className="inline-block text-accent font-bold">←</span>
          <span>Свайп колонок вбік</span>
          <span className="inline-block text-accent font-bold">→</span>
        </span>
        <span className="text-zinc-500 font-mono text-[10px]">тис. ₴</span>
      </div>

      {/* Таблиця з закріпленою лівою колонкою на мобільному */}
      <div className="overflow-x-auto relative">
        <table className="fin-table w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/90 text-zinc-400 text-xs font-medium">
              {/* Стаття звіту: закріплена зліва (sticky) на мобільному */}
              <th className="sticky left-0 z-20 bg-zinc-900/95 py-2.5 sm:py-3 px-3 sm:px-4 min-w-[155px] max-w-[180px] sm:min-w-[280px] sm:max-w-none border-r border-zinc-800/80 sm:border-r-0 shadow-[2px_0_6px_rgba(0,0,0,0.3)] sm:shadow-none print:static print:table-cell print:shadow-none print:border-none print:min-w-0 print:max-w-none">
                Стаття звіту
              </th>

              {/* Код рядка: тільки на десктопі, на мобільному виводиться під назвою */}
              <th className="hidden sm:table-cell print:table-cell py-3 px-3 w-16 text-center font-mono">
                Код
              </th>

              {/* На початок */}
              <th className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-right font-mono min-w-[95px] sm:min-w-[140px] print:min-w-0">
                <span className="sm:hidden print:hidden">Початок</span>
                <span className="hidden sm:inline print:inline">На початок (тис. ₴)</span>
              </th>

              {/* На кінець */}
              <th className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-right font-mono min-w-[95px] sm:min-w-[140px] print:min-w-0">
                <span className="sm:hidden print:hidden">Кінець</span>
                <span className="hidden sm:inline print:inline">На кінець (тис. ₴)</span>
              </th>

              {/* Об'єднана зміна (+/–, %) */}
              <th className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-right font-mono min-w-[95px] sm:min-w-[130px] print:min-w-0">
                <span className="sm:hidden print:hidden">Зміна</span>
                <span className="hidden sm:inline print:inline">Зміна (+/–, %)</span>
              </th>
            </tr>

            {/* Офіційні номери колонок згідно з бланком ДКУД 1801001 */}
            <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-500 text-[11px] font-mono text-center">
              <th className="py-1 px-3 text-left">1</th>
              <th className="hidden sm:table-cell print:table-cell py-1 px-2">2</th>
              <th className="py-1 px-3 text-right">3</th>
              <th className="py-1 px-3 text-right">4</th>
              <th className="py-1 px-3 text-right">5</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {filteredRows.map((row, idx) => {
              const isSectionHeader = row.level === 0 && row.code === null;

              if (isSectionHeader) {
                currentSection = row.name;
                const isCollapsed = !!collapsedSections[row.name];

                return (
                  <tr
                    key={idx}
                    onClick={() => toggleSection(row.name)}
                    className="bg-zinc-900/95 hover:bg-zinc-800/80 cursor-pointer transition-colors border-t border-b border-zinc-700/80 select-none print:bg-transparent"
                  >
                    <td colSpan={5} className="py-2.5 px-3 sm:px-4 font-semibold text-white print:text-black">
                      <div className="sticky left-3 sm:left-4 print:static inline-flex items-center justify-between w-full max-w-[calc(100vw-48px)] sm:max-w-none pr-2 print:w-full">
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-accent shrink-0 print:hidden" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-accent shrink-0 print:hidden" />
                          )}
                          <span className="text-xs sm:text-sm font-semibold truncate sm:whitespace-normal print:whitespace-normal">
                            {row.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0 ml-2 print:bg-transparent print:text-black print:border-black">
                          {row.section}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }

              // Якщо секція згорнута — не показуємо дочірні рядки (крім підсумкового Балансу 1300 і 1900)
              const isMainBalance = row.code === '1300' || row.code === '1900';
              if (!isMainBalance && currentSection && collapsedSections[currentSection]) {
                return null;
              }

              const rowCode = row.code;
              const rowValues = rowCode ? data[rowCode] : null;
              const beginVal = rowValues?.begin ?? null;
              const endVal = rowValues?.end ?? null;
              const change = calculateChange(beginVal, endVal);
              const isTotalRow = row.isTotal;

              // Колір фону закріпленої клітинки на мобільному, щоб дані не просвічували при скролі
              const stickyBgClass = isMainBalance
                ? 'bg-zinc-900'
                : isTotalRow
                ? 'bg-zinc-900'
                : 'bg-zinc-950';

              return (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    isMainBalance
                      ? 'bg-accent/10 font-bold text-white border-y-2 border-accent/40 shadow-inner'
                      : isTotalRow
                      ? 'bg-zinc-900/50 font-semibold text-zinc-100 border-t border-zinc-700/60'
                      : 'hover:bg-zinc-800/30 text-zinc-300'
                  }`}
                >
                  {/* Назва статті: sticky зліва на мобільному */}
                  <td
                    className={`sticky left-0 z-10 ${stickyBgClass} sm:bg-transparent py-2 sm:py-2.5 px-3 sm:px-4 border-r border-zinc-800/80 sm:border-r-0 shadow-[2px_0_6px_rgba(0,0,0,0.3)] sm:shadow-none min-w-[155px] max-w-[180px] sm:min-w-[280px] sm:max-w-none print:static print:table-cell print:shadow-none print:border-none print:min-w-0 print:max-w-none print:bg-transparent`}
                  >
                    <div
                      className={`flex flex-col ${
                        row.level === 2 ? 'pl-2.5 sm:pl-5 text-zinc-400 print:text-neutral-700' : ''
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        {isTotalRow && !isMainBalance && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1 sm:mt-1.5 print:bg-black"></span>
                        )}
                        <span
                          className={`leading-snug break-words ${
                            isMainBalance
                              ? 'text-accent text-sm sm:text-base tracking-wide font-bold print:text-black'
                              : isTotalRow
                              ? 'text-white print:text-black'
                              : 'print:text-black'
                          }`}
                        >
                          {row.name}
                        </span>
                      </div>

                      {/* Код рядка на мобільному відображається під назвою */}
                      {row.code && (
                        <span className="text-[10px] font-mono text-zinc-500 sm:hidden print:hidden mt-0.5">
                          #{row.code}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Код рядка на десктопі */}
                  <td className="hidden sm:table-cell print:table-cell py-2.5 px-3 text-center font-mono text-xs text-zinc-500 print:text-black">
                    {row.code || ''}
                  </td>

                  {/* На початок звітного періоду */}
                  <td className="py-2 sm:py-2.5 px-2.5 sm:px-4 text-right font-mono tabular-nums text-xs sm:text-sm">
                    {formatCurrency(beginVal, { isDeduction: row.isDeduction })}
                  </td>

                  {/* На кінець звітного періоду */}
                  <td
                    className={`py-2 sm:py-2.5 px-2.5 sm:px-4 text-right font-mono tabular-nums text-xs sm:text-sm font-medium ${
                      isMainBalance ? 'text-accent font-bold text-sm sm:text-base' : 'text-white'
                    }`}
                  >
                    {formatCurrency(endVal, { isDeduction: row.isDeduction })}
                  </td>

                  {/* Зміна (об'єднана: абсолютна + %) */}
                  <td className="py-2 sm:py-2.5 px-2.5 sm:px-4 text-right font-mono tabular-nums text-xs sm:text-sm">
                    {change.absolute !== null ? (
                      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1 print:flex-row print:items-center print:whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            change.direction === 'positive'
                              ? 'text-emerald-400 print:text-black'
                              : change.direction === 'negative'
                              ? 'text-rose-400 print:text-black'
                              : 'text-zinc-400 print:text-black'
                          }`}
                        >
                          {change.absolute > 0 ? '+' : ''}{formatCurrency(change.absolute)}
                        </span>
                        {change.direction !== 'none' && (
                          <span
                            className={`text-[11px] px-1 py-0.2 rounded whitespace-nowrap print:bg-transparent print:p-0 print:text-black ${
                              change.direction === 'positive'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : change.direction === 'negative'
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'text-zinc-400'
                            }`}
                          >
                            ({change.text})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-600 print:text-black">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
