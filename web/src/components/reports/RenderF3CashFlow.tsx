import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { F3_CASHFLOW_ROWS } from '../../lib/form-definitions';
import { formatCurrency, calculateChange } from '../../lib/formatters';
import type { ReportData } from '../../lib/types';

interface RenderF3CashFlowProps {
  report: ReportData;
}

export const RenderF3CashFlow: React.FC<RenderF3CashFlowProps> = ({ report }) => {
  const data = (report as any)?.data || report || {};

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
    return F3_CASHFLOW_ROWS.filter((row) => {
      if (!onlyFilled) return true;
      if (row.isTotal) return true;
      if (!row.code) return true; // Заголовки розділів
      const vals = data[row.code];
      return vals && (vals.current !== null || vals.previous !== null);
    });
  }, [data, onlyFilled]);

  // Підрахунок заповнених рядків
  const filledCount = useMemo(() => {
    return Object.keys(data).filter((k) => {
      const v = data[k];
      return v && (v.current !== null || v.previous !== null);
    }).length;
  }, [data]);

  let currentSection = '';

  return (
    <div className="rounded-2xl border border-border-card bg-surface-card shadow-2xl backdrop-blur-md overflow-hidden">
      {/* Шапка звіту */}
      <div className="p-4 sm:p-5 border-b border-border-subtle bg-zinc-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Звіт про рух грошових коштів (за прямим методом)
            </h2>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-accent border border-accent/20">
              Форма № 3
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Звітний період: за {report.meta?.period_year || 2025} рік · Одиниця виміру: тис. гривень (тис. ₴)
          </p>
        </div>

        {/* Кнопка фільтра заповнених */}
        <button
          onClick={() => setOnlyFilled(!onlyFilled)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border transition-colors self-start md:self-auto ${
            onlyFilled
              ? 'bg-accent/10 border-accent/30 text-accent'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
          }`}
          title="Приховати порожні рядки форми"
        >
          {onlyFilled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{onlyFilled ? `Заповнені статті (${filledCount})` : 'Усі статті форми'}</span>
        </button>
      </div>

      {/* Таблиця грошових потоків */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/90 text-zinc-400 text-xs font-medium">
              <th className="py-3 px-4 min-w-[320px]">Стаття звіту</th>
              <th className="py-3 px-3 w-16 text-center font-mono">Код</th>
              <th className="py-3 px-4 text-right font-mono min-w-[130px]">За звітний період (тис. ₴)</th>
              <th className="py-3 px-4 text-right font-mono min-w-[130px]">За попередній рік (тис. ₴)</th>
              <th className="py-3 px-4 text-right font-mono min-w-[110px] hidden sm:table-cell">Зміна (тис. ₴)</th>
              <th className="py-3 px-4 text-right font-mono min-w-[90px]">Зміна, %</th>
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
                    className="bg-zinc-900/90 hover:bg-zinc-800/80 cursor-pointer transition-colors border-t border-b border-zinc-700/80 select-none"
                  >
                    <td colSpan={6} className="py-2.5 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-accent" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-accent" />
                        )}
                        <span>{row.name}</span>
                      </div>
                    </td>
                  </tr>
                );
              }

              // Якщо секція згорнута — не показуємо дочірні рядки (крім фінального залишку 3415)
              const isFinalBalance = row.code === '3415';
              if (!isFinalBalance && currentSection && collapsedSections[currentSection]) {
                return null;
              }

              const rowCode = row.code;
              const rowValues = rowCode ? data[rowCode] : null;
              const currentVal = rowValues?.current ?? null;
              const prevVal = rowValues?.previous ?? null;
              const change = calculateChange(prevVal, currentVal);

              const isTotalRow = row.isTotal;

              return (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    isFinalBalance
                      ? 'bg-accent/10 font-bold text-white border-y-2 border-accent/40 shadow-inner'
                      : isTotalRow
                      ? 'bg-zinc-900/50 font-semibold text-zinc-100 border-t border-zinc-700/60'
                      : 'hover:bg-zinc-800/30 text-zinc-300'
                  }`}
                >
                  {/* Назва статті */}
                  <td className="py-2.5 px-4">
                    <div
                      style={{
                        paddingLeft: `${Math.max(0, row.level - 1) * 1.25}rem`,
                      }}
                      className="flex items-center gap-2"
                    >
                      {isTotalRow && !isFinalBalance && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0"></span>
                      )}
                      <span className={isFinalBalance ? 'text-accent text-base tracking-wide font-bold' : ''}>
                        {row.name}
                      </span>
                    </div>
                  </td>

                  {/* Код рядка */}
                  <td className="py-2.5 px-3 text-center font-mono text-xs text-zinc-500">
                    {row.code || ''}
                  </td>

                  {/* За звітний період */}
                  <td
                    className={`py-2.5 px-4 text-right font-mono tabular-nums font-medium ${
                      isFinalBalance ? 'text-accent text-base' : 'text-white'
                    }`}
                  >
                    {formatCurrency(currentVal, { isDeduction: row.isDeduction })}
                  </td>

                  {/* За аналогічний період попереднього року */}
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-400">
                    {formatCurrency(prevVal, { isDeduction: row.isDeduction })}
                  </td>

                  {/* Абсолютна зміна */}
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-400 hidden sm:table-cell">
                    {change.absolute !== null ? formatCurrency(change.absolute) : '—'}
                  </td>

                  {/* Відносна зміна % */}
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {change.direction !== 'none' ? (
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          change.direction === 'positive'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : change.direction === 'negative'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {change.text}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
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
