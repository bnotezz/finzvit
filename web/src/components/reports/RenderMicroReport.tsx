import React from 'react';
import { F1M_BALANCE_ROWS, F2M_INCOME_ROWS } from '../../lib/form-definitions';
import { formatCurrency, calculateChange } from '../../lib/formatters';
import type { ReportData } from '../../lib/types';

interface RenderMicroReportProps {
  report: ReportData;
}

export const RenderMicroReport: React.FC<RenderMicroReportProps> = ({ report }) => {
  const data = (report as any)?.data || report || {};
  const balanceData = data.balance || {};
  const incomeData = data.income || {};

  return (
    <div className="space-y-6">
      {/* 1. Баланс малого/мікропідприємства */}
      <div className="overflow-x-auto rounded-2xl border border-border-card bg-surface-card shadow-xl backdrop-blur-md">
        <div className="p-4 border-b border-border-subtle bg-zinc-900/40">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Баланс (спрощена форма)</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Форма № 1-м / 1-мс
            </span>
          </h2>
        </div>

        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 text-xs font-medium">
              <th className="py-3 px-4 w-1/2">Назва статті</th>
              <th className="py-3 px-3 w-16 text-center font-mono">Код</th>
              <th className="py-3 px-4 text-right font-mono">На початок року</th>
              <th className="py-3 px-4 text-right font-mono">На кінець періоду</th>
              <th className="py-3 px-4 text-right font-mono">Зміна, %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {F1M_BALANCE_ROWS.map((row, idx) => {
              if (row.level === 0 && row.code === null) {
                return (
                  <tr key={idx} className="bg-zinc-900/90 font-semibold text-white border-t border-b border-zinc-700/80">
                    <td colSpan={5} className="py-2.5 px-4">{row.name} ({row.section})</td>
                  </tr>
                );
              }

              const rowVals = row.code ? balanceData[row.code] : null;
              const beginVal = rowVals?.begin ?? null;
              const endVal = rowVals?.end ?? null;
              const change = calculateChange(beginVal, endVal);
              const isMainBalance = row.code === '1300' || row.code === '1900';

              return (
                <tr
                  key={idx}
                  className={`hover:bg-zinc-800/30 ${
                    isMainBalance ? 'bg-accent/5 font-bold text-accent' : row.isTotal ? 'bg-zinc-900/40 font-semibold text-white' : 'text-zinc-300'
                  }`}
                >
                  <td className="py-2.5 px-4" style={{ paddingLeft: `${row.level * 1}rem` }}>{row.name}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-xs text-zinc-500">{row.code}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatCurrency(beginVal, { isDeduction: row.isDeduction })}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-white">{formatCurrency(endVal, { isDeduction: row.isDeduction })}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{change.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2. Звіт про фінрезультати малого/мікропідприємства */}
      <div className="overflow-x-auto rounded-2xl border border-border-card bg-surface-card shadow-xl backdrop-blur-md">
        <div className="p-4 border-b border-border-subtle bg-zinc-900/40">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Звіт про фінансові результати (спрощена форма)</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Форма № 2-м / 2-мс
            </span>
          </h2>
        </div>

        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 text-xs font-medium">
              <th className="py-3 px-4 w-1/2">Назва статті</th>
              <th className="py-3 px-3 w-16 text-center font-mono">Код</th>
              <th className="py-3 px-4 text-right font-mono">За звітний період</th>
              <th className="py-3 px-4 text-right font-mono">За попередній рік</th>
              <th className="py-3 px-4 text-right font-mono">Зміна, %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {F2M_INCOME_ROWS.map((row, idx) => {
              const rowVals = row.code ? incomeData[row.code] : null;
              const currentVal = rowVals?.current ?? null;
              const prevVal = rowVals?.previous ?? null;
              const change = calculateChange(prevVal, currentVal);

              return (
                <tr
                  key={idx}
                  className={`hover:bg-zinc-800/30 ${
                    row.isTotal ? 'bg-zinc-900/40 font-semibold text-white' : 'text-zinc-300'
                  }`}
                >
                  <td className="py-2.5 px-4">{row.name}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-xs text-zinc-500">{row.code}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-white font-medium">{formatCurrency(currentVal, { isDeduction: row.isDeduction })}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-400">{formatCurrency(prevVal, { isDeduction: row.isDeduction })}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{change.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
