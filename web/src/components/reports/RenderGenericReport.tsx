import React, { useState } from 'react';
import type { ReportData } from '../../lib/types';
import { formatCurrency } from '../../lib/formatters';
import { Search } from 'lucide-react';

interface RenderGenericReportProps {
  report: ReportData;
}

export const RenderGenericReport: React.FC<RenderGenericReportProps> = ({ report }) => {
  const data = report.data || {};
  const [filter, setFilter] = useState('');

  const entries = Object.entries(data).filter(([key]) =>
    key.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="rounded-2xl border border-border-card bg-surface-card shadow-2xl backdrop-blur-md overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-border-subtle bg-zinc-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              {report.meta?.form_name || 'Примітки до річної звітності'}
            </h2>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-accent border border-accent/20">
              {report.meta?.form_code}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Звітний період: за {report.meta?.period_year || 2025} рік · Загальна кількість показників: {Object.keys(data).length}
          </p>
        </div>

        <div className="relative w-full md:w-64 no-print">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Фільтр за кодом..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-accent/40"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-900">
            <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-medium">
              <th className="py-2.5 px-4 w-1/3 font-mono">Код графи / рядка</th>
              <th className="py-2.5 px-4 font-mono text-right">Показник</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40 font-mono">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={2} className="py-8 text-center text-zinc-500 text-xs font-sans">
                  Показників не знайдено
                </td>
              </tr>
            ) : (
              entries.map(([key, val]) => (
                <tr key={key} className="hover:bg-zinc-800/30 text-zinc-300">
                  <td className="py-2 px-4 text-xs text-zinc-400 font-semibold">{key}</td>
                  <td className="py-2 px-4 text-right text-white tabular-nums font-medium">
                    {typeof val === 'number' ? formatCurrency(val) : String(val)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
