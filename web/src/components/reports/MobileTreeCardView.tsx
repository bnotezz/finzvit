import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, calculateChange } from '../../lib/formatters';

export interface MobileReportRowItem {
  code: string | null;
  name: string;
  level: number;
  section?: string;
  isTotal?: boolean;
  isDeduction?: boolean;
  isMainHighlight?: boolean;
  val1Label: string; // Наприклад "Поч" або "Попер"
  val1: number | null;
  val2Label: string; // Наприклад "Кін" або "Звіт"
  val2: number | null;
  val1FullLabel?: string;
  val2FullLabel?: string;
}

interface MobileTreeCardViewProps {
  rows: MobileReportRowItem[];
  collapsedSections?: Record<string, boolean>;
  onToggleSection?: (sectionName: string) => void;
  emptyMessage?: string;
}

export const MobileTreeCardView: React.FC<MobileTreeCardViewProps> = ({
  rows,
  collapsedSections = {},
  onToggleSection,
  emptyMessage = 'Немає статей для відображення за вибраними фільтрами',
}) => {
  if (!rows || rows.length === 0) {
    return (
      <div className="py-8 px-4 text-center rounded-2xl border border-zinc-800 bg-zinc-950/40 text-xs text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  let currentSectionHeader = '';

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => {
        const isSectionHeader = row.level === 0 && row.code === null;

        // 1. Заголовок секції (Level 0)
        if (isSectionHeader) {
          currentSectionHeader = row.name;
          const isCollapsed = !!collapsedSections[row.name];

          return (
            <div
              key={`sec-${idx}-${row.name}`}
              onClick={() => onToggleSection && onToggleSection(row.name)}
              className="w-full flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800/80 border border-zinc-800 text-left transition-all cursor-pointer active:scale-[0.99] select-none shadow-sm mt-3 first:mt-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-accent shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-accent shrink-0" />
                )}
                <span className="font-bold text-xs sm:text-sm text-white leading-tight">
                  {row.name}
                </span>
              </div>
              {row.section && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700/60 shrink-0">
                  {row.section}
                </span>
              )}
            </div>
          );
        }

        // Якщо секція згорнута — приховуємо рядок (крім головних підсумків)
        if (!row.isMainHighlight && currentSectionHeader && collapsedSections[currentSectionHeader]) {
          return null;
        }

        const change = calculateChange(row.val1, row.val2);
        const isLevel2 = row.level >= 2;

        // 2. Головний баланс / Головний фінрезультат (1300, 1900, 2350, 2355 тощо)
        if (row.isMainHighlight) {
          return (
            <div
              key={`row-${idx}-${row.code}`}
              className="p-3.5 rounded-2xl bg-accent/10 border-2 border-accent/40 shadow-lg space-y-2.5 my-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {row.code && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30 shrink-0">
                      #{row.code}
                    </span>
                  )}
                  <span className="font-bold text-sm text-accent uppercase tracking-wide leading-snug">
                    {row.name}
                  </span>
                </div>
                {row.section && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-white border border-zinc-700 shrink-0">
                    {row.section}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-accent/20">
                <div className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800">
                  <div className="text-[10px] text-zinc-400">
                    {row.val1FullLabel || row.val1Label}
                  </div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5 truncate">
                    {formatCurrency(row.val1, { isDeduction: row.isDeduction })}{' '}
                    <span className="text-[10px] text-zinc-500 font-normal">тис. ₴</span>
                  </div>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded-xl border border-accent/30">
                  <div className="text-[10px] text-accent font-medium">
                    {row.val2FullLabel || row.val2Label}
                  </div>
                  <div className="text-sm font-bold font-mono text-accent mt-0.5 truncate">
                    {formatCurrency(row.val2, { isDeduction: row.isDeduction })}{' '}
                    <span className="text-[10px] text-accent/70 font-normal">тис. ₴</span>
                  </div>
                </div>
              </div>

              {change.absolute !== null && (
                <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-zinc-400 text-[11px]">Зміна:</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span
                      className={`font-semibold ${
                        change.direction === 'positive'
                          ? 'text-emerald-400'
                          : change.direction === 'negative'
                          ? 'text-rose-400'
                          : 'text-zinc-300'
                      }`}
                    >
                      {change.absolute > 0 ? '+' : ''}{formatCurrency(change.absolute)} тис. ₴
                    </span>
                    {change.direction !== 'none' && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                          change.direction === 'positive'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        ({change.text})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }

        // 3. Підсумковий рядок розділу (isTotal)
        if (row.isTotal) {
          return (
            <div
              key={`row-${idx}-${row.code}`}
              className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-700/80 space-y-2 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span className="font-semibold text-xs text-white leading-snug">
                    {row.name}
                  </span>
                </div>
                {row.code && (
                  <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                    #{row.code}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-zinc-800/80">
                <div className="flex items-baseline gap-1 text-[11px] min-w-0">
                  <span className="text-zinc-500 shrink-0">{row.val1Label}:</span>
                  <span className="font-mono text-zinc-300 truncate">
                    {formatCurrency(row.val1, { isDeduction: row.isDeduction })}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 text-[11px] min-w-0">
                  <span className="text-zinc-500 shrink-0">{row.val2Label}:</span>
                  <span className="font-mono font-semibold text-white truncate">
                    {formatCurrency(row.val2, { isDeduction: row.isDeduction })}
                  </span>
                </div>
              </div>

              {change.absolute !== null && (
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/50 font-mono">
                  <span className="text-zinc-500 text-[10px]">Динаміка:</span>
                  <div className="flex items-center gap-1">
                    <span
                      className={`font-semibold ${
                        change.direction === 'positive'
                          ? 'text-emerald-400'
                          : change.direction === 'negative'
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {change.absolute > 0 ? '+' : ''}{formatCurrency(change.absolute)} тис. ₴
                    </span>
                    {change.direction !== 'none' && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                          change.direction === 'positive'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        ({change.text})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }

        // 4. Деревоподібний підпункт 2-го рівня (Level 2 Sub-item)
        if (isLevel2) {
          return (
            <div
              key={`row-${idx}-${row.code}`}
              className="ml-3 pl-3 border-l-2 border-zinc-800/80 py-1.5 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-[1px] bg-zinc-600 shrink-0" />
                  <span className="text-[11px] text-zinc-300 leading-snug">
                    {row.name}
                  </span>
                </div>
                {row.code && (
                  <span className="text-[9px] font-mono text-zinc-500 shrink-0">
                    #{row.code}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] pl-2.5">
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="text-zinc-500 shrink-0">{row.val1Label}:</span>
                  <span className="font-mono text-zinc-400 truncate">
                    {formatCurrency(row.val1, { isDeduction: row.isDeduction })}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="text-zinc-500 shrink-0">{row.val2Label}:</span>
                  <span className="font-mono font-medium text-zinc-200 truncate">
                    {formatCurrency(row.val2, { isDeduction: row.isDeduction })}
                  </span>
                </div>
              </div>

              {change.absolute !== null && (
                <div className="flex items-center justify-between text-[10px] pl-2.5 font-mono text-zinc-400">
                  <span className="text-zinc-600 text-[9px]">Зміна:</span>
                  <div className="flex items-center gap-1">
                    <span
                      className={
                        change.direction === 'positive'
                          ? 'text-emerald-400/90'
                          : change.direction === 'negative'
                          ? 'text-rose-400/90'
                          : 'text-zinc-400'
                      }
                    >
                      {change.absolute > 0 ? '+' : ''}{formatCurrency(change.absolute)}
                    </span>
                    {change.direction !== 'none' && (
                      <span
                        className={`text-[9px] px-1 rounded ${
                          change.direction === 'positive'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        ({change.text})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }

        // 5. Звичайний рядок 1-го рівня (Level 1 Regular Item)
        return (
          <div
            key={`row-${idx}-${row.code}`}
            className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70 hover:border-zinc-700/80 transition-colors space-y-1.5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-zinc-200 font-medium leading-snug">
                {row.name}
              </span>
              {row.code && (
                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                  #{row.code}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-zinc-800/40">
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-zinc-500 shrink-0">{row.val1Label}:</span>
                <span className="font-mono text-zinc-300 truncate">
                  {formatCurrency(row.val1, { isDeduction: row.isDeduction })}
                </span>
              </div>
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-zinc-500 shrink-0">{row.val2Label}:</span>
                <span className="font-mono font-medium text-white truncate">
                  {formatCurrency(row.val2, { isDeduction: row.isDeduction })}
                </span>
              </div>
            </div>

            {change.absolute !== null && (
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/30 font-mono">
                <span className="text-zinc-500 text-[10px]">Зміна:</span>
                <div className="flex items-center gap-1">
                  <span
                    className={`font-semibold ${
                      change.direction === 'positive'
                        ? 'text-emerald-400'
                        : change.direction === 'negative'
                        ? 'text-rose-400'
                        : 'text-zinc-400'
                    }`}
                  >
                    {change.absolute > 0 ? '+' : ''}{formatCurrency(change.absolute)} тис. ₴
                  </span>
                  {change.direction !== 'none' && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                        change.direction === 'positive'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      ({change.text})
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
