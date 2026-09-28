import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  PieChart, 
  ShieldCheck, 
  Wallet, 
  Building2, 
  Landmark, 
  Scale, 
  Percent, 
  Activity, 
  HelpCircle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { formatCurrency, calculateChange, calcNetIncome } from '../../lib/formatters';
import type { ReportData } from '../../lib/types';

interface KpiCardsProps {
  balanceReport?: ReportData | null;
  incomeReport?: ReportData | null;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ balanceReport, incomeReport }) => {
  const [showFormulas, setShowFormulas] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'liquidity' | 'solvency' | 'profitability'>('all');

  // Дані з Балансу (Ф1 / 1-м / 1-мс)
  const rawB = (balanceReport as any)?.data || balanceReport || {};
  const bData = rawB.balance || rawB;

  // Рядки Балансу
  const r1095 = bData['1095']?.end ?? null; // Необоротні активи
  const r1100 = bData['1100']?.end ?? null; // Запаси
  const r1160 = bData['1160']?.end ?? 0;    // Поточні фінансові інвестиції
  const r1165 = bData['1165']?.end ?? null; // Гроші та їх еквіваленти
  const r1165Begin = bData['1165']?.begin ?? null;
  const r1195 = bData['1195']?.end ?? null; // Оборотні активи
  const r1300 = bData['1300']?.end ?? null; // Баланс (Активи)
  const r1300Begin = bData['1300']?.begin ?? null;
  const r1495 = bData['1495']?.end ?? null; // Власний капітал
  const r1495Begin = bData['1495']?.begin ?? null;
  const r1595 = bData['1595']?.end ?? null; // Довгострокові зобов’язання
  const r1595Begin = bData['1595']?.begin ?? null;
  const r1695 = bData['1695']?.end ?? null; // Поточні зобов'язання
  const r1695Begin = bData['1695']?.begin ?? null;
  const r1900 = bData['1900']?.end ?? null; // Баланс (Пасиви)

  // Дані зі Звіту про фінрезультати (Ф2 / 2-м / 2-мс)
  const rawI = (incomeReport as any)?.data || incomeReport || {};
  const iData = rawI.income || rawI;

  // Рядки Фінрезультатів
  const revenueRow = iData['2000'];
  const revenueCurrent = revenueRow?.current ?? null;
  const revenuePrevious = revenueRow?.previous ?? null;

  const profitRow = iData['2350'];
  const lossRow = iData['2355'];
  const netIncomeCurrent = calcNetIncome(profitRow?.current, lossRow?.current);
  const netIncomePrevious = calcNetIncome(profitRow?.previous, lossRow?.previous);

  // Динаміка основних показників
  const revenueChange = calculateChange(revenuePrevious, revenueCurrent);
  const netIncomeChange = calculateChange(netIncomePrevious, netIncomeCurrent);
  const assetsChange = calculateChange(r1300Begin, r1300);
  const equityChange = calculateChange(r1495Begin, r1495);
  const cashChange = calculateChange(r1165Begin, r1165);
  const ltDebtChange = calculateChange(r1595Begin, r1595);
  const stDebtChange = calculateChange(r1695Begin, r1695);

  // 1. Сім основних показників (всі у тис. ₴)
  const mainMetrics = [
    {
      title: 'Чистий дохід (Виручка)',
      value: revenueCurrent,
      change: revenueChange,
      icon: Coins,
      unit: 'тис. ₴',
      rowNote: 'Рядок 2000 Ф2',
      color: 'accent',
    },
    {
      title: 'Чистий прибуток / збиток',
      value: netIncomeCurrent,
      change: netIncomeChange,
      icon: TrendingUp,
      unit: 'тис. ₴',
      rowNote: 'Рядок 2350/2355 Ф2',
      isNetIncome: true,
      color: netIncomeCurrent !== null && netIncomeCurrent >= 0 ? 'emerald' : 'rose',
    },
    {
      title: 'Активи (Баланс)',
      value: r1300,
      change: assetsChange,
      icon: PieChart,
      unit: 'тис. ₴',
      rowNote: 'Рядок 1300 Ф1',
      color: 'blue',
    },
    {
      title: 'Власний капітал',
      value: r1495,
      change: equityChange,
      icon: ShieldCheck,
      unit: 'тис. ₴',
      rowNote: 'Рядок 1495 Ф1',
      color: 'indigo',
    },
    {
      title: 'Гроші та їх еквіваленти',
      value: r1165,
      change: cashChange,
      icon: Wallet,
      unit: 'тис. ₴',
      rowNote: 'Рядок 1165 Ф1',
      color: 'emerald',
    },
    {
      title: 'Довгострокові зобов’язання',
      value: r1595,
      change: ltDebtChange,
      icon: Building2,
      unit: 'тис. ₴',
      rowNote: 'Рядок 1595 Ф1',
      color: 'purple',
    },
    {
      title: 'Поточні зобов\'язання',
      value: r1695,
      change: stDebtChange,
      icon: Landmark,
      unit: 'тис. ₴',
      rowNote: 'Рядок 1695 Ф1',
      color: 'amber',
    },
  ];

  // 2. Розрахунок 9 коефіцієнтів
  // 1. Коефіцієнт поточної ліквідності: рядок 1195 / рядок 1695
  const currentRatio = r1195 !== null && r1695 ? r1195 / r1695 : null;

  // 2. Коефіцієнт абсолютної ліквідності: (рядок 1160 + рядок 1165) / рядок 1695
  const absoluteRatio = r1165 !== null && r1695 ? ((r1160 || 0) + r1165) / r1695 : null;

  // 3. Коефіцієнт швидкої ліквідності: (рядок 1195 - рядок 1100) / рядок 1695
  const quickRatio = r1195 !== null && r1100 !== null && r1695 ? (r1195 - r1100) / r1695 : null;

  // 4. Коефіцієнт автономії: рядок 1495 / рядок 1900
  const autonomyRatio = r1495 !== null && r1900 ? r1495 / r1900 : null;

  // 5. Рентабельність активів (ROA): рядок 2350/2355 / рядок 1900
  const roa = netIncomeCurrent !== null && r1900 && r1900 > 0 ? (netIncomeCurrent / r1900) * 100 : null;

  // 6. Рентабельність власного капіталу (ROE): рядок 2350/2355 / рядок 1495
  const roe = netIncomeCurrent !== null && r1495 && r1495 > 0 ? (netIncomeCurrent / r1495) * 100 : null;

  // 7. Чиста маржа: рядок 2350/2355 / рядок 2000
  const netMargin = netIncomeCurrent !== null && revenueCurrent && revenueCurrent > 0 ? (netIncomeCurrent / revenueCurrent) * 100 : null;

  // 8. Коефіцієнт покриття необоротних активів власним капіталом: рядок 1495 / рядок 1095
  const capCoverageRatio = r1495 !== null && r1095 ? r1495 / r1095 : null;

  // 9. Коефіцієнт заборгованості: рядок 1695 / рядок 1300
  const debtRatio = r1695 !== null && r1300 ? r1695 / r1300 : null;

  const ratios = [
    // Ліквідність
    {
      id: 'current_ratio',
      category: 'liquidity',
      name: 'Коефіцієнт поточної ліквідності',
      intlName: 'Current Ratio',
      value: currentRatio !== null ? currentRatio.toFixed(2) : '—',
      rawValue: currentRatio,
      formula: 'рядок 1195 / рядок 1695',
      calcDetails: r1195 !== null && r1695 ? `${formatCurrency(r1195)} ₴ / ${formatCurrency(r1695)} ₴` : null,
      description: 'Визначає здатність підприємства покривати поточні зобов\'язання за рахунок оборотних активів.',
      benchmark: 'Норма > 1.0 — 2.0',
      status: currentRatio === null ? 'none' : currentRatio >= 1.5 ? 'optimal' : currentRatio >= 1.0 ? 'normal' : 'warning',
      statusText: currentRatio === null ? '—' : currentRatio >= 1.5 ? 'Оптимально' : currentRatio >= 1.0 ? 'Норма' : 'Дефіцит ліквідності',
    },
    {
      id: 'absolute_ratio',
      category: 'liquidity',
      name: 'Коефіцієнт абсолютної ліквідності',
      intlName: 'Cash Ratio',
      value: absoluteRatio !== null ? absoluteRatio.toFixed(2) : '—',
      rawValue: absoluteRatio,
      formula: '(рядок 1160 + 1165) / рядок 1695',
      calcDetails: r1165 !== null && r1695 ? `(${formatCurrency(r1160 || 0)} + ${formatCurrency(r1165)}) ₴ / ${formatCurrency(r1695)} ₴` : null,
      description: 'Відображає здатність підприємства негайно виконати поточні зобов\'язання за рахунок грошових коштів.',
      benchmark: 'Норма > 0.2',
      status: absoluteRatio === null ? 'none' : absoluteRatio >= 0.2 ? 'optimal' : 'warning',
      statusText: absoluteRatio === null ? '—' : absoluteRatio >= 0.2 ? 'Норма' : 'Низька швидка платоспроможність',
    },
    {
      id: 'quick_ratio',
      category: 'liquidity',
      name: 'Коефіцієнт швидкої ліквідності',
      intlName: 'Quick Ratio',
      value: quickRatio !== null ? quickRatio.toFixed(2) : '—',
      rawValue: quickRatio,
      formula: '(рядок 1195 - 1100) / рядок 1695',
      calcDetails: r1195 !== null && r1100 !== null && r1695 ? `(${formatCurrency(r1195)} - ${formatCurrency(r1100)}) ₴ / ${formatCurrency(r1695)} ₴` : null,
      description: 'Показує, чи може компанія виконати поточні зобов\'язання за рахунок ліквідних активів без продажу запасів.',
      benchmark: 'Норма > 0.7 — 1.0',
      status: quickRatio === null ? 'none' : quickRatio >= 0.7 ? 'optimal' : 'warning',
      statusText: quickRatio === null ? '—' : quickRatio >= 0.7 ? 'Норма' : 'Потребує уваги',
    },

    // Фінансова стійкість та заборгованість
    {
      id: 'autonomy',
      category: 'solvency',
      name: 'Коефіцієнт автономії',
      intlName: 'Equity Ratio',
      value: autonomyRatio !== null ? `${autonomyRatio.toFixed(2)} (${(autonomyRatio * 100).toFixed(1)}%)` : '—',
      rawValue: autonomyRatio,
      formula: 'рядок 1495 / рядок 1900',
      calcDetails: r1495 !== null && r1900 ? `${formatCurrency(r1495)} ₴ / ${formatCurrency(r1900)} ₴` : null,
      description: 'Визначає частку власного капіталу у фінансуванні активів підприємства, показує незалежність компанії від кредиторів.',
      benchmark: 'Норма > 0.50 (> 50%)',
      status: autonomyRatio === null ? 'none' : autonomyRatio >= 0.5 ? 'optimal' : autonomyRatio >= 0.3 ? 'normal' : 'warning',
      statusText: autonomyRatio === null ? '—' : autonomyRatio >= 0.5 ? 'Висока незалежність' : autonomyRatio >= 0.3 ? 'Помірна незалежність' : 'Залежність від боргу',
    },
    {
      id: 'cap_coverage',
      category: 'solvency',
      name: 'Покриття необоротних активів власним капіталом',
      intlName: 'Fixed Assets Coverage',
      value: capCoverageRatio !== null ? capCoverageRatio.toFixed(2) : '—',
      rawValue: capCoverageRatio,
      formula: 'рядок 1495 / рядок 1095',
      calcDetails: r1495 !== null && r1095 ? `${formatCurrency(r1495)} ₴ / ${formatCurrency(r1095)} ₴` : null,
      description: 'Визначає частку власного капіталу, що фінансує оборотні активи після повного покриття необоротних активів.',
      benchmark: 'Норма > 1.0',
      status: capCoverageRatio === null ? 'none' : capCoverageRatio >= 1.0 ? 'optimal' : 'warning',
      statusText: capCoverageRatio === null ? '—' : capCoverageRatio >= 1.0 ? 'Повне покриття (наявний ВОК)' : 'Неповне покриття',
    },
    {
      id: 'debt_ratio',
      category: 'solvency',
      name: 'Коефіцієнт заборгованості',
      intlName: 'Debt to Assets Ratio',
      value: debtRatio !== null ? `${debtRatio.toFixed(2)} (${(debtRatio * 100).toFixed(1)}%)` : '—',
      rawValue: debtRatio,
      formula: 'рядок 1695 / рядок 1300',
      calcDetails: r1695 !== null && r1300 ? `${formatCurrency(r1695)} ₴ / ${formatCurrency(r1300)} ₴` : null,
      description: 'Відображає частку активів компанії, яка фінансується за рахунок зобов\'язань. Дає уявлення про рівень фінансового ризику.',
      benchmark: 'Безпечно <= 0.50 (<= 50%)',
      status: debtRatio === null ? 'none' : debtRatio <= 0.5 ? 'optimal' : debtRatio <= 0.7 ? 'normal' : 'warning',
      statusText: debtRatio === null ? '—' : debtRatio <= 0.5 ? 'Безпечний рівень' : debtRatio <= 0.7 ? 'Помірний ризик' : 'Високий ризик',
    },

    // Рентабельність та маржинальність
    {
      id: 'roa',
      category: 'profitability',
      name: 'Рентабельність активів (ROA)',
      intlName: 'Return on Assets',
      value: roa !== null ? `${roa.toFixed(1)}%` : '—',
      rawValue: roa,
      formula: 'рядок 2350/2355 / рядок 1900',
      calcDetails: netIncomeCurrent !== null && r1900 ? `${formatCurrency(netIncomeCurrent)} ₴ / ${formatCurrency(r1900)} ₴` : null,
      description: 'Показує, скільки прибутку приносить кожна одиниця активів компанії.',
      benchmark: 'Добре > 5.0%',
      status: roa === null ? 'none' : roa > 5 ? 'optimal' : roa > 0 ? 'normal' : 'warning',
      statusText: roa === null ? '—' : roa > 5 ? 'Висока віддача активів' : roa > 0 ? 'Позитивна віддача' : 'Збиткова діяльність',
    },
    {
      id: 'roe',
      category: 'profitability',
      name: 'Рентабельність власного капіталу (ROE)',
      intlName: 'Return on Equity',
      value: roe !== null ? `${roe.toFixed(1)}%` : '—',
      rawValue: roe,
      formula: 'рядок 2350/2355 / рядок 1495',
      calcDetails: netIncomeCurrent !== null && r1495 ? `${formatCurrency(netIncomeCurrent)} ₴ / ${formatCurrency(r1495)} ₴` : null,
      description: 'Визначає ефективність використання власного капіталу для отримання чистого прибутку.',
      benchmark: 'Добре > 10.0%',
      status: roe === null ? 'none' : roe > 10 ? 'optimal' : roe > 0 ? 'normal' : 'warning',
      statusText: roe === null ? '—' : roe > 10 ? 'Висока дохідність капіталу' : roe > 0 ? 'Позитивна дохідність' : 'Збиток на капітал',
    },
    {
      id: 'net_margin',
      category: 'profitability',
      name: 'Чиста маржа',
      intlName: 'Net Profit Margin',
      value: netMargin !== null ? `${netMargin.toFixed(1)}%` : '—',
      rawValue: netMargin,
      formula: 'рядок 2350/2355 / рядок 2000',
      calcDetails: netIncomeCurrent !== null && revenueCurrent ? `${formatCurrency(netIncomeCurrent)} ₴ / ${formatCurrency(revenueCurrent)} ₴` : null,
      description: 'Відображає частку чистого прибутку в загальній виручці від реалізації.',
      benchmark: 'Добре > 5.0%',
      status: netMargin === null ? 'none' : netMargin > 8 ? 'optimal' : netMargin > 0 ? 'normal' : 'warning',
      statusText: netMargin === null ? '—' : netMargin > 8 ? 'Високомаржинальний' : netMargin > 0 ? 'Прибутковий' : 'Від\'ємна маржа',
    },
  ];

  const filteredRatios = ratios.filter((r) => {
    if (selectedCategory === 'all') return true;
    return r.category === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* 1. БЛОК ОСНОВНИХ ФІНАНСОВИХ ПОКАЗНИКІВ */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
              Ключові показники звітності
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60">
              Офіційні форми Ф1, Ф2
            </span>
          </div>
          <span className="text-xs text-zinc-500 font-mono hidden sm:inline">
            Усі суми зазначені в тис. ₴
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {mainMetrics.map((card, i) => {
            const Icon = card.icon;
            const isNegativeVal = card.value !== null && card.value < 0;

            return (
              <div
                key={i}
                className="rounded-2xl border border-border-card bg-surface-card p-4 shadow-lg relative overflow-hidden backdrop-blur-md flex flex-col justify-between hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between text-zinc-400 text-xs gap-2">
                  <span className="font-medium tracking-wide text-zinc-300">{card.title}</span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-accent" />
                  </div>
                </div>

                <div className="my-2.5">
                  <div
                    className={`text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums ${
                      isNegativeVal ? 'text-financial-negative' : 'text-white'
                    }`}
                  >
                    {card.value !== null ? formatCurrency(card.value) : '—'}
                    {card.value !== null && (
                      <span className="text-xs font-normal text-zinc-400 ml-1.5 font-sans">
                        тис. ₴
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    {card.rowNote}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                  <span className="text-zinc-500 text-[11px]">Динаміка:</span>
                  {card.change.direction !== 'none' ? (
                    <div
                      className={`flex items-center gap-1 font-mono font-medium text-[11px] ${
                        card.change.direction === 'positive'
                          ? 'text-financial-positive'
                          : card.change.direction === 'negative'
                          ? 'text-financial-negative'
                          : 'text-zinc-400'
                      }`}
                    >
                      {card.change.direction === 'positive' ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : card.change.direction === 'negative' ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : null}
                      <span>{card.change.text}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-600 font-mono text-[11px]">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. БЛОК ФІНАНСОВОЇ АНАЛІТИКИ ТА КОЕФІЦІЄНТІВ */}
      <div className="rounded-2xl border border-border-card bg-surface-card p-5 shadow-2xl backdrop-blur-md space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Фінансовий аналіз та коефіцієнти стійкості
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Автоматичний розрахунок ліквідності, платоспроможності та рентабельності на основі НП(С)БО 1
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowFormulas(!showFormulas)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:text-white transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
              <span>{showFormulas ? 'Приховати формули' : 'Показати формули'}</span>
            </button>
          </div>
        </div>

        {/* Фільтри за категоріями */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'Усі коефіцієнти (9)' },
            { id: 'liquidity', label: 'Ліквідність (3)' },
            { id: 'solvency', label: 'Стійкість та борг (3)' },
            { id: 'profitability', label: 'Рентабельність (3)' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Сітка коефіцієнтів */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRatios.map((item) => {
            const isOptimal = item.status === 'optimal';
            const isNormal = item.status === 'normal';
            const isWarning = item.status === 'warning';

            return (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col justify-between space-y-3 hover:border-zinc-700/80 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white text-xs leading-snug">
                        {item.name}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                        {item.intlName}
                      </div>
                    </div>

                    {/* Бейдж статусу */}
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${
                        isOptimal
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : isNormal
                          ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                          : isWarning
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      {isOptimal && <CheckCircle2 className="w-3 h-3" />}
                      {isWarning && <AlertTriangle className="w-3 h-3" />}
                      <span>{item.statusText}</span>
                    </span>
                  </div>

                  {/* Значення коефіцієнта */}
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold font-mono text-white tracking-tight">
                      {item.value}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      ({item.benchmark})
                    </span>
                  </div>

                  {/* Опис */}
                  <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Формула розрахунку */}
                {showFormulas && (
                  <div className="pt-2.5 border-t border-zinc-900 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>Формула:</span>
                      <span className="text-zinc-400">{item.formula}</span>
                    </div>
                    {item.calcDetails && (
                      <div className="text-[10px] text-accent/80 font-mono bg-zinc-900/80 px-2 py-1 rounded truncate" title={item.calcDetails}>
                        {item.calcDetails}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
