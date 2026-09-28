import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Check,
  FileSpreadsheet,
  TrendingUp,
  Coins,
  Layers,
  HelpCircle,
  FileText,
  Loader2,
  Sparkles,
  X
} from 'lucide-react';
import type { AvailableForm } from '../../lib/types';

export interface FormDisplayInfo {
  code: string;
  badge: string;
  shortName: string;
  fullName: string;
  description: string;
  icon: React.ElementType;
}

export const getFormDisplayInfo = (code: string, rawTitle?: string): FormDisplayInfo => {
  const c = (code || '').toUpperCase().trim();

  if (c === 'KPI') {
    return {
      code: 'KPI',
      badge: 'KPI',
      shortName: 'Аналітика (KPI)',
      fullName: 'Фінансовий аналіз та показники (BSC)',
      description: 'Комплексна оцінка ліквідності, рентабельності та коефіцієнтів',
      icon: BarChart3,
    };
  }

  if (c.startsWith('S01001')) {
    return {
      code,
      badge: 'Ф1',
      shortName: 'Ф1 Баланс',
      fullName: 'Баланс (Звіт про фінансовий стан)',
      description: 'Форма № 1 · ДКУД 1801001',
      icon: FileSpreadsheet,
    };
  }

  if (c.startsWith('S01002')) {
    return {
      code,
      badge: 'Ф2',
      shortName: 'Ф2 Фінрезультати',
      fullName: 'Звіт про фінансові результати (сукупний дохід)',
      description: 'Форма № 2 · ДКУД 1801002',
      icon: TrendingUp,
    };
  }

  if (c.startsWith('S01100')) {
    return {
      code,
      badge: '1-м, 2-м',
      shortName: 'Ф1-м, Ф2-м Малі',
      fullName: 'Фінансовий звіт малого підприємства',
      description: 'Форми 1-м, 2-м · ДКУД 1801006, 1801007',
      icon: FileText,
    };
  }

  if (c.startsWith('S01110')) {
    return {
      code,
      badge: '1-мс, 2-мс',
      shortName: 'Ф1-мс, Ф2-мс Мікро',
      fullName: 'Фінансовий звіт мікропідприємства',
      description: 'Форми 1-мс, 2-мс · ДКУД 1801008, 1801009',
      icon: FileText,
    };
  }

  if (c.startsWith('S01003') || c.startsWith('S01033')) {
    return {
      code,
      badge: 'Ф3',
      shortName: 'Ф3 Рух коштів',
      fullName: 'Звіт про рух грошових коштів',
      description: 'Форма № 3 / 3-н · ДКУД 1801003',
      icon: Coins,
    };
  }

  if (c.startsWith('S01040')) {
    return {
      code,
      badge: 'Ф4',
      shortName: 'Ф4 Капітал',
      fullName: 'Звіт про власний капітал',
      description: 'Форма № 4 · ДКУД 1801010',
      icon: Layers,
    };
  }

  if (c.startsWith('S01050')) {
    return {
      code,
      badge: 'Ф5',
      shortName: 'Ф5 Примітки',
      fullName: 'Примітки до річної фінансової звітності',
      description: 'Форма № 5 · ДКУД 1805009',
      icon: HelpCircle,
    };
  }

  return {
    code,
    badge: code.slice(0, 4),
    shortName: rawTitle ? rawTitle.split('(')[0].trim().slice(0, 20) : code,
    fullName: rawTitle || code,
    description: `Форма ${code}`,
    icon: FileText,
  };
};

interface CompanyReportNavProps {
  // Роки
  selectedYear: number;
  availableYears: number[];
  supportedYears: readonly number[];
  onSelectYear: (year: number) => void;
  isYearLoading?: boolean;

  // Форми
  forms: AvailableForm[];
  activeFormCode: string;
  onSelectForm: (code: string) => void;
  hasKpi?: boolean;
}

export const CompanyReportNav: React.FC<CompanyReportNavProps> = ({
  selectedYear,
  availableYears,
  supportedYears,
  onSelectYear,
  isYearLoading = false,
  forms,
  activeFormCode,
  onSelectForm,
  hasKpi = true,
}) => {
  const [mobileSelectOpen, setMobileSelectOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Закриття мобільного випадаючого списку при кліку за межі
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMobileSelectOpen(false);
      }
    };
    if (mobileSelectOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileSelectOpen]);

  // Підготовка списку навігаційних елементів (KPI + форми)
  const navItems: FormDisplayInfo[] = [];

  if (hasKpi) {
    navItems.push(getFormDisplayInfo('KPI'));
  }

  forms.forEach((f) => {
    navItems.push(getFormDisplayInfo(f.code, f.title));
  });

  const activeItem = navItems.find((item) => item.code === activeFormCode) || navItems[0] || getFormDisplayInfo('KPI');

  return (
    <div className="space-y-3 no-print">
      {/* ========================================================================= */}
      {/* 1. ДЕСКТОПНИЙ ТА ПЛАНШЕТНИЙ ІНТЕРФЕЙС (shadcn Tabs / Segmented Control)  */}
      {/* ========================================================================= */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-2xl bg-zinc-950/70 border border-white/5 backdrop-blur-xl shadow-lg">
        {/* Перемикач форм звітності */}
        <div className="inline-flex items-center gap-1 p-1 bg-zinc-900/90 border border-zinc-800/80 rounded-xl overflow-x-auto max-w-full">
          {navItems.map((item) => {
            const isActive = item.code === activeFormCode;
            const Icon = item.icon;
            const isKpi = item.code === 'KPI';

            return (
              <button
                key={item.code}
                type="button"
                onClick={() => onSelectForm(item.code)}
                title={item.fullName}
                className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap cursor-pointer select-none ${
                  isActive
                    ? isKpi
                      ? 'bg-accent/20 text-accent border border-accent/40 shadow-sm font-semibold'
                      : 'bg-zinc-800 text-white border border-zinc-700/90 shadow-sm font-semibold'
                    : isKpi
                    ? 'text-accent/90 hover:text-accent hover:bg-accent/10 border border-transparent'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 transition-colors ${
                    isActive
                      ? isKpi
                        ? 'text-accent'
                        : 'text-white'
                      : isKpi
                      ? 'text-accent'
                      : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}
                />
                <span>{item.shortName}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Перемикач років (Level 1 hierarchy) */}
        <div className="inline-flex items-center gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800/80 rounded-xl shrink-0">
          <div className="flex items-center gap-1.5 px-2 text-[11px] font-mono text-zinc-400 select-none">
            <Calendar className="w-3.5 h-3.5 text-accent" />
            <span className="font-semibold text-zinc-300">Рік:</span>
          </div>

          <div className="flex items-center gap-1">
            {supportedYears.map((year) => {
              const isSelected = year === selectedYear;
              const isAvailable = availableYears.includes(year);
              const isLatest = year === Math.max(...supportedYears);

              return (
                <button
                  key={year}
                  type="button"
                  disabled={isYearLoading || (!isAvailable && !isSelected)}
                  onClick={() => onSelectYear(year)}
                  title={
                    !isAvailable
                      ? `Звітність за ${year} рік для цього підприємства не знайдена`
                      : `Переглянути фінансову звітність за ${year} рік`
                  }
                  className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all select-none cursor-pointer ${
                    isSelected
                      ? 'bg-accent/20 border border-accent/40 text-accent font-bold shadow-sm'
                      : isAvailable
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/70 border border-transparent'
                      : 'text-zinc-600 opacity-40 cursor-not-allowed border border-transparent'
                  }`}
                >
                  {isYearLoading && isSelected ? (
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  ) : (
                    <span>{year}</span>
                  )}

                  {/* Бейдж для найсвіжішого року */}
                  {isLatest && isAvailable && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-sans font-medium uppercase tracking-wider ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      Останній
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. МОБІЛЬНИЙ ІНТЕРФЕЙС (shadcn Select Dropdown + Year Segmented Controls) */}
      {/* ========================================================================= */}
      <div className="md:hidden space-y-2 p-3 rounded-2xl bg-zinc-950/80 border border-white/5 backdrop-blur-xl">
        {/* Рядок 1: Вибір року */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/70">
          <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono font-medium">
            <Calendar className="w-3.5 h-3.5 text-accent" />
            <span>Звітний рік:</span>
          </div>

          <div className="inline-flex items-center gap-1 p-0.5 bg-zinc-900 border border-zinc-800 rounded-xl">
            {supportedYears.map((year) => {
              const isSelected = year === selectedYear;
              const isAvailable = availableYears.includes(year);
              const isLatest = year === Math.max(...supportedYears);

              return (
                <button
                  key={year}
                  type="button"
                  disabled={isYearLoading || (!isAvailable && !isSelected)}
                  onClick={() => onSelectYear(year)}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                    isSelected
                      ? 'bg-accent/20 border border-accent/40 text-accent font-bold shadow-sm'
                      : isAvailable
                      ? 'text-zinc-400 hover:text-white'
                      : 'text-zinc-600 opacity-40 cursor-not-allowed'
                  }`}
                >
                  {isYearLoading && isSelected ? (
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  ) : (
                    <span>{year}</span>
                  )}
                  {isLatest && isAvailable && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Рядок 2: Мобільний випадний список форм (shadcn Select Pattern) */}
        <div className="relative" ref={dropdownRef}>
          <div className="text-[11px] font-medium text-zinc-400 mb-1">Форма звітності:</div>
          <button
            type="button"
            onClick={() => setMobileSelectOpen(!mobileSelectOpen)}
            className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-left transition-colors cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-accent/15 text-accent border border-accent/30 shrink-0">
                {activeItem.badge}
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-white truncate text-xs">
                  {activeItem.fullName}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {activeItem.description}
                </div>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                mobileSelectOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Мобільний вибір форми (Bottom Sheet Drawer) */}
          {mobileSelectOpen && (
            <div className="fixed inset-0 z-[100] flex flex-col justify-end">
              {/* Затемнення фону */}
              <div
                className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                onClick={() => setMobileSelectOpen(false)}
                aria-hidden="true"
              />

              {/* Нижня шторка (Drawer) */}
              <div className="relative z-10 w-full max-h-[85vh] bg-zinc-900 border-t border-zinc-700/80 rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-200">
                {/* Drag Handle */}
                <div className="pt-3 pb-1 flex justify-center shrink-0">
                  <div className="w-12 h-1.5 bg-zinc-700 rounded-full" />
                </div>

                {/* Шапка шторки */}
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-white">Оберіть розділ або форму</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Звітний період: {selectedYear} рік
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileSelectOpen(false)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 transition-colors"
                    aria-label="Закрити"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Список доступних форм */}
                <div className="p-3 space-y-1.5 overflow-y-auto overscroll-contain">
                  {navItems.map((item) => {
                    const isSelected = item.code === activeFormCode;
                    const Icon = item.icon;
                    const isKpi = item.code === 'KPI';

                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => {
                          onSelectForm(item.code);
                          setMobileSelectOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-left transition-colors cursor-pointer ${
                          isSelected
                            ? isKpi
                              ? 'bg-accent/15 border border-accent/40 text-white shadow-sm'
                              : 'bg-zinc-800 border border-zinc-700 text-white shadow-sm'
                            : 'bg-zinc-950/60 hover:bg-zinc-800/60 text-zinc-300 border border-zinc-800/70'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected
                                ? isKpi
                                  ? 'bg-accent/20 text-accent border border-accent/30'
                                  : 'bg-zinc-700 text-white border border-zinc-600'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700/60'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs sm:text-sm text-white truncate flex items-center gap-2">
                              <span>{item.shortName}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                {item.badge}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {item.fullName}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-accent" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
