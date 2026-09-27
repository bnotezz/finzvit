import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Filter, Eye, EyeOff, Layers } from 'lucide-react';
import { F1_BALANCE_ROWS } from '../../lib/form-definitions';
import { formatCurrency, calculateChange } from '../../lib/formatters';
import type { ReportData } from '../../lib/types';

interface RenderF1BalanceProps {
  report: ReportData;
}

export const RenderF1Balance: React.FC<RenderF1BalanceProps> = ({ report }) => {
  const data = (report as any)?.data || report || {};

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

  let currentSection = '';

  return (
    <div className="rounded-2xl border border-border-card bg-surface-card shadow-2xl backdrop-blur-md overflow-hidden">
      {/* Шапка форми з перемикачами */}
      <div className="p-4 sm:p-5 border-b border-border-subtle bg-zinc-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Баланс (Звіт про фінансовий стан)
            </h2>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-accent border border-accent/20">
              Форма № 1
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Звітний період: на 31 грудня {report.meta?.period_year || 2025} року · Одиниця виміру: тис. гривень (тис. ₴)
          </p>
        </div>

        {/* Панель керування (Актив/Пасив та фільтр заповнених) */}
        <div className="flex flex-wrap items-center gap-2 text-xs no-print">
          {/* Таби Актив / Пасив */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'all'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Усі (Актив + Пасив)
            </button>
            <button
              onClick={() => setActiveTab('asset')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'asset'
                  ? 'bg-zinc-800 text-accent shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Тільки Актив
            </button>
            <button
              onClick={() => setActiveTab('liability')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'liability'
                  ? 'bg-zinc-800 text-indigo-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Тільки Пасив
            </button>
          </div>

          {/* Перемикач тільки заповнених */}
          <button
            onClick={() => setOnlyFilled(!onlyFilled)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-colors ${
              onlyFilled
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Перемкнути відображення порожніх рядків бланку"
          >
            {onlyFilled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{onlyFilled ? `Заповнені статті (${filledCount})` : 'Усі статті форми'}</span>
          </button>
        </div>
      </div>

      {/* Таблиця */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/90 text-zinc-400 text-xs font-medium">
              <th className="py-3 px-4 min-w-[280px]">Стаття звіту</th>
              <th className="py-3 px-3 w-16 text-center font-mono">Код</th>
              <th className="py-3 px-4 text-right font-mono min-w-[140px]">На початок (тис. ₴)</th>
              <th className="py-3 px-4 text-right font-mono min-w-[140px]">На кінець (тис. ₴)</th>
              <th className="py-3 px-4 text-right font-mono min-w-[120px] hidden sm:table-cell">Зміна (тис. ₴)</th>
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-accent" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-accent" />
                          )}
                          <span>{row.name}</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
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
                  {/* Назва статті */}
                  <td className="py-2.5 px-4">
                    <div
                      style={{
                        paddingLeft: `${Math.max(0, row.level - 1) * 1.25}rem`,
                      }}
                      className="flex items-center gap-2"
                    >
                      {isTotalRow && !isMainBalance && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0"></span>
                      )}
                      <span className={isMainBalance ? 'text-accent text-base tracking-wide' : ''}>
                        {row.name}
                      </span>
                    </div>
                  </td>

                  {/* Код рядка */}
                  <td className="py-2.5 px-3 text-center font-mono text-xs text-zinc-500">
                    {row.code || ''}
                  </td>

                  {/* На початок звітного періоду */}
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {formatCurrency(beginVal, { isDeduction: row.isDeduction })}
                  </td>

                  {/* На кінець звітного періоду */}
                  <td
                    className={`py-2.5 px-4 text-right font-mono tabular-nums font-medium ${
                      isMainBalance ? 'text-accent text-base' : 'text-white'
                    }`}
                  >
                    {formatCurrency(endVal, { isDeduction: row.isDeduction })}
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
