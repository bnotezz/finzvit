import React, { useState, useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { F4_EQUITY_COLUMNS, F4_EQUITY_ROWS } from '../../lib/form-definitions';
import { formatCurrency } from '../../lib/formatters';
import type { ReportData } from '../../lib/types';

interface RenderF4EquityProps {
  report: ReportData;
}

export const RenderF4Equity: React.FC<RenderF4EquityProps> = ({ report }) => {
  const data = (report as any)?.data || report || {};
  const [onlyFilled, setOnlyFilled] = useState(true);

  // Фільтрація рядків
  const displayRows = useMemo(() => {
    return F4_EQUITY_ROWS.filter((r) => {
      if (!onlyFilled) return true;
      if (r.isTotal) return true;
      const vals = data[r.code];
      return vals && Object.values(vals).some((v) => v !== null && v !== undefined);
    });
  }, [data, onlyFilled]);

  return (
    <div className="rounded-2xl border border-border-card bg-surface-card shadow-2xl backdrop-blur-md overflow-hidden">
      {/* Шапка */}
      <div className="p-4 sm:p-5 border-b border-border-subtle bg-zinc-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white print:text-black tracking-tight">
              Звіт про власний капітал
            </h2>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-accent print:bg-transparent print:border-black print:text-black border border-accent/20">
              Форма № 4
            </span>
            <span className="hidden print:inline text-[9pt] font-mono text-black">
              (ДКУД 1801004)
            </span>
          </div>
          <p className="text-xs text-zinc-400 print:text-black mt-1">
            Звітний період: за {report.meta?.period_year || 2025} рік · Одиниця виміру: тис. гривень (тис. ₴)
          </p>
        </div>

        <button
          onClick={() => setOnlyFilled(!onlyFilled)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border transition-colors self-start md:self-auto ${
            onlyFilled
              ? 'bg-accent/10 border-accent/30 text-accent'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          {onlyFilled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{onlyFilled ? 'Тільки статті з даними' : 'Усі статті форми'}</span>
        </button>
      </div>

      {/* Матрична таблиця капіталу з горизонтальним скролом */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/95 text-zinc-400 font-medium">
              <th className="py-3 px-4 min-w-[240px] sticky left-0 bg-zinc-900 z-10 border-r border-zinc-800/80 print:static print:table-cell print:shadow-none print:border-none print:min-w-0 print:bg-transparent">
                Стаття звіту
              </th>
              <th className="py-3 px-2 w-14 text-center font-mono border-r border-zinc-800/40">
                Код
              </th>
              {F4_EQUITY_COLUMNS.map((col) => (
                <th
                  key={col.id}
                  className="py-3 px-3 text-right font-mono min-w-[130px] whitespace-normal"
                >
                  {col.label} <span className="text-[10px] text-zinc-500 font-normal block">(тис. ₴)</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {displayRows.map((row) => {
              const vals = data[row.code] || {};
              const isFinal = row.isFinal;
              const isTotal = row.isTotal;

              return (
                <tr
                  key={row.code}
                  className={`transition-colors ${
                    isFinal
                      ? 'bg-accent/10 font-bold text-white border-y-2 border-accent/40'
                      : isTotal
                      ? 'bg-zinc-900/60 font-semibold text-zinc-100'
                      : 'hover:bg-zinc-800/30 text-zinc-300'
                  }`}
                >
                  {/* Фіксована перша колонка назви */}
                  <td
                    className={`py-2.5 px-4 sticky left-0 z-10 border-r border-zinc-800/80 print:static print:table-cell print:shadow-none print:border-none print:bg-transparent ${
                      isFinal
                        ? 'bg-zinc-900 text-accent font-bold'
                        : isTotal
                        ? 'bg-zinc-900 font-semibold text-white'
                        : 'bg-zinc-950 text-zinc-200'
                    }`}
                  >
                    {row.name}
                  </td>

                  {/* Код рядка */}
                  <td className="py-2.5 px-2 text-center font-mono text-[11px] text-zinc-500 border-r border-zinc-800/40">
                    {row.code}
                  </td>

                  {/* Колонки капіталу */}
                  {F4_EQUITY_COLUMNS.map((col) => {
                    const cellVal = vals[col.id];
                    return (
                      <td
                        key={col.id}
                        className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                          col.id === 'col_11' || col.id === 'col_10'
                            ? 'font-semibold text-white bg-zinc-900/30'
                            : ''
                        }`}
                      >
                        {formatCurrency(cellVal)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
