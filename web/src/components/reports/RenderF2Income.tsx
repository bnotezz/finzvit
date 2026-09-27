import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { F2_INCOME_ROWS } from '../../lib/form-definitions';
import { formatCurrency, calculateChange } from '../../lib/formatters';
import type { ReportData } from '../../lib/types';

interface RenderF2IncomeProps {
  report: ReportData;
}

export const RenderF2Income: React.FC<RenderF2IncomeProps> = ({ report }) => {
  const data = (report as any)?.data || report || {};
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const rows = F2_INCOME_ROWS;
  let currentSectionHeader = '';

  return (
    <div className="overflow-x-auto rounded-2xl border border-border-card bg-surface-card shadow-xl backdrop-blur-md">
      <div className="p-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-4 bg-zinc-900/40">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Звіт про фінансові результати (Звіт про сукупний дохід)</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Форма № 2
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Звітний період: за {report.meta?.period_year || 2025} рік · Одиниця виміру: тис. гривень (тис. ₴)
          </p>
        </div>
      </div>

      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 text-xs font-medium">
            <th className="py-3 px-4 w-1/2">Назва статті</th>
            <th className="py-3 px-3 w-16 text-center font-mono">Код</th>
            <th className="py-3 px-4 text-right font-mono">За звітний період (тис. ₴)</th>
            <th className="py-3 px-4 text-right font-mono">За попередній рік (тис. ₴)</th>
            <th className="py-3 px-4 text-right font-mono hidden sm:table-cell">Зміна (тис. ₴)</th>
            <th className="py-3 px-4 text-right font-mono">Зміна, %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/40">
          {rows.map((row, idx) => {
            const isSection = row.level === 0;
            if (isSection && row.code === null) {
              currentSectionHeader = row.name;
              const isCollapsed = !!collapsedSections[row.name];

              return (
                <tr
                  key={idx}
                  onClick={() => toggleSection(row.name)}
                  className="bg-zinc-900/90 hover:bg-zinc-800/80 cursor-pointer transition-colors border-t border-b border-zinc-700/80 select-none"
                >
                  <td colSpan={6} className="py-3 px-4 font-semibold text-white">
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

            if (currentSectionHeader && collapsedSections[currentSectionHeader]) {
              return null;
            }

            const rowCode = row.code;
            const rowValues = rowCode ? data[rowCode] : null;
            const currentVal = rowValues?.current ?? null;
            const prevVal = rowValues?.previous ?? null;
            const change = calculateChange(prevVal, currentVal);

            const isTotalRow = row.isTotal;
            const isNetResult = row.code === '2350' || row.code === '2355';

            return (
              <tr
                key={idx}
                className={`transition-colors hover:bg-zinc-800/30 ${
                  isNetResult
                    ? 'bg-accent/5 font-bold text-white border-y border-accent/30'
                    : isTotalRow
                    ? 'bg-zinc-900/40 font-semibold text-zinc-100 border-t border-zinc-800'
                    : 'text-zinc-300'
                }`}
              >
                <td className="py-2.5 px-4">
                  <div
                    style={{ paddingLeft: `${(row.level - (row.level > 0 ? 1 : 0)) * 1.25}rem` }}
                    className="flex items-center gap-1.5"
                  >
                    {isTotalRow && !isNetResult && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent/60 shrink-0"></span>
                    )}
                    <span className={isNetResult ? 'text-accent' : ''}>
                      {row.name}
                    </span>
                  </div>
                </td>

                <td className="py-2.5 px-3 text-center font-mono text-xs text-zinc-500">
                  {row.code || ''}
                </td>

                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-white font-medium">
                  {formatCurrency(currentVal, { isDeduction: row.isDeduction })}
                </td>

                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-400">
                  {formatCurrency(prevVal, { isDeduction: row.isDeduction })}
                </td>

                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-400 hidden sm:table-cell">
                  {change.absolute !== null ? formatCurrency(change.absolute) : '—'}
                </td>

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
  );
};
