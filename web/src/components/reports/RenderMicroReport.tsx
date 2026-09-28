import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Search, 
  FileSpreadsheet, 
  TrendingUp, 
  Scale 
} from 'lucide-react';
import { F1M_BALANCE_ROWS, F2M_INCOME_ROWS } from '../../lib/form-definitions';
import { formatCurrency, calculateChange } from '../../lib/formatters';
import type { ReportData } from '../../lib/types';

interface RenderMicroReportProps {
  report: ReportData;
}

export const RenderMicroReport: React.FC<RenderMicroReportProps> = ({ report }) => {
  const raw = (report as any)?.data || report || {};
  const balanceData = raw.balance || raw;
  const incomeData = raw.income || raw;

  // Керування відображенням
  const [activeSection, setActiveSection] = useState<'all' | 'balance' | 'income'>('all');
  const [onlyFilled, setOnlyFilled] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Перевірка рівності балансу (Рядок 1300 проти 1900)
  const balanceCheck = useMemo(() => {
    const r1300 = balanceData['1300']?.end ?? null;
    const r1900 = balanceData['1900']?.end ?? null;
    if (r1300 === null || r1900 === null) return null;
    const diff = Math.round(Math.abs(r1300 - r1900) * 10) / 10;
    return {
      isValid: diff === 0,
      diff,
      asset: r1300,
      liability: r1900,
    };
  }, [balanceData]);

  // Підрахунок заповнених рядків
  const filledBalanceCount = useMemo(() => {
    return Object.keys(balanceData).filter((k) => {
      const v = balanceData[k];
      return v && (v.begin !== null || v.end !== null);
    }).length;
  }, [balanceData]);

  const filledIncomeCount = useMemo(() => {
    return Object.keys(incomeData).filter((k) => {
      const v = incomeData[k];
      return v && (v.current !== null || v.previous !== null);
    }).length;
  }, [incomeData]);

  // Фільтрація рядків Балансу (Ф1-м)
  const filteredBalanceRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return F1M_BALANCE_ROWS.filter((row) => {
      if (q) {
        const matchesName = row.name.toLowerCase().includes(q);
        const matchesCode = row.code ? row.code.includes(q) : false;
        if (!matchesName && !matchesCode) return false;
      }
      if (onlyFilled && row.code) {
        if (row.isTotal) return true;
        const vals = balanceData[row.code];
        const hasData = vals && (vals.begin !== null || vals.end !== null);
        return hasData;
      }
      return true;
    });
  }, [searchTerm, onlyFilled, balanceData]);

  // Фільтрація рядків Фінрезультатів (Ф2-м)
  const filteredIncomeRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return F2M_INCOME_ROWS.filter((row) => {
      if (q) {
        const matchesName = row.name.toLowerCase().includes(q);
        const matchesCode = row.code ? row.code.includes(q) : false;
        if (!matchesName && !matchesCode) return false;
      }
      if (onlyFilled && row.code) {
        if (row.isTotal) return true;
        const vals = incomeData[row.code];
        const hasData = vals && (vals.current !== null || vals.previous !== null);
        return hasData;
      }
      return true;
    });
  }, [searchTerm, onlyFilled, incomeData]);

  return (
    <div className="space-y-6">
      {/* Панель керування: вибір розділу, фільтр заповненості та швидкий пошук */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-950/60 border border-white/5 backdrop-blur-xl no-print">
        {/* Таби перемикання між формами */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-900/80 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveSection('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeSection === 'all'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Всі форми
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('balance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeSection === 'balance'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-accent" />
            <span>1. Баланс (1-м)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-700/60 text-zinc-300">
              {filledBalanceCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('income')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeSection === 'income'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>2. Фінрезультати (2-м)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-700/60 text-zinc-300">
              {filledIncomeCount}
            </span>
          </button>
        </div>

        {/* Пошук та перемикач показу статей */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Пошук статті або коду..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-accent/40"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyFilled(!onlyFilled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              onlyFilled
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {onlyFilled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{onlyFilled ? 'Лише заповнені' : 'Всі статті'}</span>
          </button>
        </div>
      </div>

      {/* 1. ФОРМА № 1-м. БАЛАНС (Код за ДКУД 1801006) */}
      {(activeSection === 'all' || activeSection === 'balance') && (
        <div className="overflow-x-auto rounded-2xl border border-border-card bg-surface-card shadow-xl backdrop-blur-md">
          {/* Заголовок офіційної форми */}
          <div className="p-4 sm:p-5 border-b border-border-subtle bg-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-accent" />
                  <span>Форма № 1-м. Баланс</span>
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-accent border border-accent/20">
                  ДКУД 1801006
                </span>
                <span className="text-xs text-zinc-400 font-normal">
                  (НП(С)БО 25 «Спрощена фінансова звітність»)
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Одиниця виміру: <strong className="text-zinc-300">тис. грн з одним десятковим знаком</strong>
              </p>
            </div>

            {/* Індикатор зіставності Балансу (Актив = Пасив) */}
            {balanceCheck && (
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium ${
                  balanceCheck.isValid
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}
              >
                {balanceCheck.isValid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Баланс зійшовся (Актив 1300 = Пасив 1900)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Розбіжність: {balanceCheck.diff} тис. ₴</span>
                  </>
                )}
              </div>
            )}
          </div>

          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 text-xs font-medium">
                <th className="py-3 px-4 w-1/2">Актив / Пасив (Назва статті)</th>
                <th className="py-3 px-3 w-16 text-center font-mono">Код рядка</th>
                <th className="py-3 px-4 text-right font-mono">На початок року</th>
                <th className="py-3 px-4 text-right font-mono">На кінець періоду</th>
                <th className="py-3 px-4 text-right font-mono">Зміна, %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {filteredBalanceRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500 text-xs">
                    Статей балансу за вказаними фільтрами не знайдено.
                  </td>
                </tr>
              ) : (
                filteredBalanceRows.map((row, idx) => {
                  if (row.level === 0 && row.code === null) {
                    return (
                      <tr key={idx} className="bg-zinc-900/90 font-semibold text-white border-t border-b border-zinc-700/80">
                        <td colSpan={5} className="py-2.5 px-4 text-xs tracking-wide uppercase text-zinc-300">
                          {row.name} ({row.section})
                        </td>
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
                      className={`hover:bg-zinc-800/30 transition-colors ${
                        isMainBalance
                          ? 'bg-accent/10 font-bold text-accent border-t-2 border-b-2 border-accent/30'
                          : row.isTotal
                          ? 'bg-zinc-900/50 font-semibold text-white'
                          : 'text-zinc-300'
                      }`}
                    >
                      <td
                        className="py-2.5 px-4"
                        style={{ paddingLeft: `${row.level === 0 ? 1 : row.level * 1.25}rem` }}
                      >
                        <span className={row.level > 1 ? 'text-zinc-400 italic' : ''}>
                          {row.name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-xs text-zinc-500">
                        {row.code}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-400">
                        {formatCurrency(beginVal, { isDeduction: row.isDeduction })}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono tabular-nums ${
                          isMainBalance
                            ? 'font-bold text-accent text-base'
                            : row.isTotal
                            ? 'font-semibold text-white'
                            : 'font-medium text-white'
                        }`}
                      >
                        {formatCurrency(endVal, { isDeduction: row.isDeduction })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs">
                        {change.pct !== null ? (
                          <span
                            className={
                              change.pct > 0
                                ? 'text-emerald-400'
                                : change.pct < 0
                                ? 'text-rose-400'
                                : 'text-zinc-500'
                            }
                          >
                            {change.text}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. ФОРМА № 2-м. ЗВІТ ПРО ФІНАНСОВІ РЕЗУЛЬТАТИ (Код за ДКУД 1801007) */}
      {(activeSection === 'all' || activeSection === 'income') && (
        <div className="overflow-x-auto rounded-2xl border border-border-card bg-surface-card shadow-xl backdrop-blur-md">
          {/* Заголовок офіційної форми */}
          <div className="p-4 sm:p-5 border-b border-border-subtle bg-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <span>Форма № 2-м. Звіт про фінансові результати</span>
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-emerald-400 border border-emerald-500/20">
                  ДКУД 1801007
                </span>
                <span className="text-xs text-zinc-400 font-normal">
                  (НП(С)БО 25 «Спрощена фінансова звітність»)
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Одиниця виміру: <strong className="text-zinc-300">тис. грн з одним десятковим знаком</strong>
              </p>
            </div>

            {/* Швидкий результат: чистий прибуток чи збиток (Рядок 2350) */}
            {incomeData['2350']?.current !== undefined && incomeData['2350']?.current !== null && (
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium ${
                  Number(incomeData['2350'].current) >= 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                <span>
                  {Number(incomeData['2350'].current) >= 0 ? 'Чистий прибуток:' : 'Чистий збиток:'}{' '}
                  {formatCurrency(incomeData['2350'].current)} тис. ₴
                </span>
              </div>
            )}
          </div>

          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 text-xs font-medium">
                <th className="py-3 px-4 w-1/2">Назва статті</th>
                <th className="py-3 px-3 w-16 text-center font-mono">Код рядка</th>
                <th className="py-3 px-4 text-right font-mono">За звітний період</th>
                <th className="py-3 px-4 text-right font-mono">За попередній рік</th>
                <th className="py-3 px-4 text-right font-mono">Зміна, %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {filteredIncomeRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500 text-xs">
                    Статей фінансових результатів за вказаними фільтрами не знайдено.
                  </td>
                </tr>
              ) : (
                filteredIncomeRows.map((row, idx) => {
                  const rowVals = row.code ? incomeData[row.code] : null;
                  const currentVal = rowVals?.current ?? null;
                  const prevVal = rowVals?.previous ?? null;
                  const change = calculateChange(prevVal, currentVal);
                  const isNetProfit = row.code === '2350';

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-zinc-800/30 transition-colors ${
                        isNetProfit
                          ? 'bg-accent/10 font-bold text-accent border-t-2 border-b-2 border-accent/30'
                          : row.isTotal
                          ? 'bg-zinc-900/50 font-semibold text-white'
                          : 'text-zinc-300'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-normal">
                        {row.name}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-xs text-zinc-500">
                        {row.code}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono tabular-nums ${
                          isNetProfit
                            ? Number(currentVal) >= 0
                              ? 'text-emerald-400 font-bold text-base'
                              : 'text-rose-400 font-bold text-base'
                            : row.isTotal
                            ? 'text-white font-semibold'
                            : 'text-white font-medium'
                        }`}
                      >
                        {formatCurrency(currentVal, { isDeduction: row.isDeduction })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-400">
                        {formatCurrency(prevVal, { isDeduction: row.isDeduction })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs">
                        {change.pct !== null ? (
                          <span
                            className={
                              change.pct > 0
                                ? 'text-emerald-400'
                                : change.pct < 0
                                ? 'text-rose-400'
                                : 'text-zinc-500'
                            }
                          >
                            {change.text}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
