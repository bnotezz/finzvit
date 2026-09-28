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
  XCircle,
  Users,
  Briefcase,
  ShoppingBag,
  Layers,
  Wrench,
  Clock,
  Factory
} from 'lucide-react';
import { formatCurrency, calculateChange, calcNetIncome } from '../../lib/formatters';
import type { ReportData, CompanyFullData } from '../../lib/types';

interface KpiCardsProps {
  balanceReport?: ReportData | null;
  incomeReport?: ReportData | null;
  company?: CompanyFullData | null;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ balanceReport, incomeReport, company }) => {
  const [showFormulas, setShowFormulas] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'liquidity' | 'solvency' | 'activity' | 'profitability' | 'efficiency'
  >('all');

  // Дані з Балансу (Ф1 / 1-м / 1-мс)
  const rawB = (balanceReport as any)?.data || balanceReport || {};
  const bData = rawB.balance || rawB;

  // Рядки Балансу
  const r1010 = bData['1010']?.end ?? null; // Основні засоби (залишкова)
  const r1011 = bData['1011']?.end ?? null; // Основні засоби (первісна)
  const r1095 = bData['1095']?.end ?? null; // Необоротні активи
  const r1100 = bData['1100']?.end ?? null; // Запаси
  const r1125 = bData['1125']?.end ?? null; // Дебіторка за товари/послуги
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
  const r1615 = bData['1615']?.end ?? null; // Кредиторка за товари/послуги
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

  const r2050 = iData['2050']?.current ?? null; // Собівартість
  const r2090 = iData['2090']?.current ?? null; // Валовий прибуток
  const r2150 = iData['2150']?.current ?? null; // Витрати на збут
  const grossProfit = r2090 !== null ? r2090 : ((revenueCurrent !== null && r2050 !== null) ? (revenueCurrent - r2050) : null);

  // Працівники підприємства
  const employees = company?.employees ? Number(company.employees) : null;

  // Динаміка основних показників
  const revenueChange = calculateChange(revenuePrevious, revenueCurrent);
  const netIncomeChange = calculateChange(netIncomePrevious, netIncomeCurrent);
  const assetsChange = calculateChange(r1300Begin, r1300);
  const equityChange = calculateChange(r1495Begin, r1495);
  const cashChange = calculateChange(r1165Begin, r1165);
  const ltDebtChange = calculateChange(r1595Begin, r1595);
  const stDebtChange = calculateChange(r1695Begin, r1695);

  // 1. Сім основних показників (у тис. ₴)
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

  // 2. Розрахунок аналітичних коефіцієнтів (Збалансована система показників BSC)
  // Ліквідність
  const currentRatio = r1195 !== null && r1695 ? r1195 / r1695 : null;
  const absoluteRatio = r1165 !== null && r1695 ? ((r1160 || 0) + r1165) / r1695 : null;
  const quickRatio = r1195 !== null && r1100 !== null && r1695 ? (r1195 - r1100) / r1695 : null;
  const workingCapitalRatio = r1195 && r1195 > 0 && r1695 !== null ? (r1195 - r1695) / r1195 : null;

  // Стійкість та леверидж
  const autonomyRatio = r1495 !== null && r1900 ? r1495 / r1900 : null;
  const financialLeverage = r1495 && r1495 > 0 && r1695 !== null ? ((r1595 || 0) + r1695) / r1495 : null;
  const equityManeuverability = r1495 && r1495 > 0 && r1195 !== null && r1695 !== null ? (r1195 - r1695) / r1495 : null;
  const fixedAssetsCondition = r1010 !== null && r1011 && r1011 > 0 ? r1010 / r1011 : null;
  const capCoverageRatio = r1495 !== null && r1095 ? r1495 / r1095 : null;
  const debtRatio = r1695 !== null && r1300 ? r1695 / r1300 : null;

  // Ділова активність та оборотність
  const receivablesTurnover = revenueCurrent && r1125 && r1125 > 0 ? revenueCurrent / r1125 : null;
  const receivablesDays = receivablesTurnover && receivablesTurnover > 0 ? 365 / receivablesTurnover : null;
  const credDebt = r1615 && r1615 > 0 ? r1615 : r1695;
  const payablesTurnover = revenueCurrent && credDebt && credDebt > 0 ? revenueCurrent / credDebt : null;
  const payablesDays = payablesTurnover && payablesTurnover > 0 ? 365 / payablesTurnover : null;
  const fixedAssetTurnover = revenueCurrent && r1010 && r1010 > 0 ? revenueCurrent / r1010 : null;
  const inventoryToRevenue = revenueCurrent && r1100 !== null ? (r1100 / revenueCurrent) * 100 : null;

  // Рентабельність
  const roa = netIncomeCurrent !== null && r1900 && r1900 > 0 ? (netIncomeCurrent / r1900) * 100 : null;
  const roe = netIncomeCurrent !== null && r1495 && r1495 > 0 ? (netIncomeCurrent / r1495) * 100 : null;
  const grossMargin = grossProfit !== null && revenueCurrent && revenueCurrent > 0 ? (grossProfit / revenueCurrent) * 100 : null;
  const netMargin = netIncomeCurrent !== null && revenueCurrent && revenueCurrent > 0 ? (netIncomeCurrent / revenueCurrent) * 100 : null;
  const productionProfitability = grossProfit !== null && r2050 && r2050 > 0 ? (grossProfit / r2050) * 100 : null;

  // Персонал та витрати
  const revenuePerEmployee = revenueCurrent && employees && employees > 0 ? revenueCurrent / employees : null;
  const profitPerEmployee = netIncomeCurrent !== null && employees && employees > 0 ? netIncomeCurrent / employees : null;
  const costCoverage = r2050 !== null && revenueCurrent && revenueCurrent > 0 ? (r2050 / revenueCurrent) * 100 : null;
  const salesExpensesRatio = r2150 !== null && revenueCurrent && revenueCurrent > 0 ? (r2150 / revenueCurrent) * 100 : null;

  const ratios = [
    // 1. Ліквідність
    {
      id: 'current_ratio',
      category: 'liquidity',
      name: 'Коефіцієнт поточної ліквідності',
      intlName: 'Current Ratio (Табл. 1.1, п. 3)',
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
      intlName: 'Cash Ratio (Табл. 1.1, п. 5)',
      value: absoluteRatio !== null ? absoluteRatio.toFixed(2) : '—',
      rawValue: absoluteRatio,
      formula: '(рядок 1160 + 1165) / рядок 1695',
      calcDetails: r1165 !== null && r1695 ? `(${formatCurrency(r1160 || 0)} + ${formatCurrency(r1165)}) ₴ / ${formatCurrency(r1695)} ₴` : null,
      description: 'Відображає здатність підприємства негайно виконати поточні зобов\'язання за рахунок грошових коштів.',
      benchmark: 'Норма > 0.20',
      status: absoluteRatio === null ? 'none' : absoluteRatio >= 0.2 ? 'optimal' : 'warning',
      statusText: absoluteRatio === null ? '—' : absoluteRatio >= 0.2 ? 'Норма' : 'Низька швидка платоспроможність',
    },
    {
      id: 'quick_ratio',
      category: 'liquidity',
      name: 'Коефіцієнт швидкої ліквідності',
      intlName: 'Quick Ratio (Табл. 1.1, п. 4)',
      value: quickRatio !== null ? quickRatio.toFixed(2) : '—',
      rawValue: quickRatio,
      formula: '(рядок 1195 - 1100) / рядок 1695',
      calcDetails: r1195 !== null && r1100 !== null && r1695 ? `(${formatCurrency(r1195)} - ${formatCurrency(r1100)}) ₴ / ${formatCurrency(r1695)} ₴` : null,
      description: 'Показує, чи може компанія виконати поточні зобов\'язання за рахунок ліквідних активів без продажу запасів.',
      benchmark: 'Норма > 0.70 — 1.0',
      status: quickRatio === null ? 'none' : quickRatio >= 0.7 ? 'optimal' : 'warning',
      statusText: quickRatio === null ? '—' : quickRatio >= 0.7 ? 'Норма' : 'Потребує уваги',
    },
    {
      id: 'working_capital_ratio',
      category: 'liquidity',
      name: 'Частка власних оборотних активів',
      intlName: 'Working Capital Ratio (Табл. 1.1, п. 2)',
      value: workingCapitalRatio !== null ? `${(workingCapitalRatio * 100).toFixed(1)}%` : '—',
      rawValue: workingCapitalRatio,
      formula: '(рядок 1195 - рядок 1695) / рядок 1195',
      calcDetails: r1195 && r1695 ? `(${formatCurrency(r1195)} - ${formatCurrency(r1695)}) ₴ / ${formatCurrency(r1195)} ₴` : null,
      description: 'Частка власних оборотних коштів у загальному обсязі оборотних активів. Характеризує фінансову автономію в операційній діяльності.',
      benchmark: 'Норма > 10.0% — 20.0%',
      status: workingCapitalRatio === null ? 'none' : workingCapitalRatio >= 0.2 ? 'optimal' : workingCapitalRatio >= 0.1 ? 'normal' : 'warning',
      statusText: workingCapitalRatio === null ? '—' : workingCapitalRatio >= 0.2 ? 'Достатній запас' : workingCapitalRatio >= 0.1 ? 'Норма' : 'Дефіцит власного оборотного капіталу',
    },

    // 2. Фінансова стійкість та леверидж
    {
      id: 'autonomy',
      category: 'solvency',
      name: 'Коефіцієнт автономії',
      intlName: 'Equity Ratio (Табл. 1.1, п. 6)',
      value: autonomyRatio !== null ? `${autonomyRatio.toFixed(2)} (${(autonomyRatio * 100).toFixed(1)}%)` : '—',
      rawValue: autonomyRatio,
      formula: 'рядок 1495 / рядок 1900',
      calcDetails: r1495 !== null && r1900 ? `${formatCurrency(r1495)} ₴ / ${formatCurrency(r1900)} ₴` : null,
      description: 'Визначає частку власного капіталу у фінансуванні активів підприємства, показує незалежність компанії від кредиторів.',
      benchmark: 'Норма > 0.50 (> 50%)',
      status: autonomyRatio === null ? 'none' : autonomyRatio >= 0.5 ? 'optimal' : autonomyRatio >= 0.35 ? 'normal' : 'warning',
      statusText: autonomyRatio === null ? '—' : autonomyRatio >= 0.5 ? 'Висока незалежність' : autonomyRatio >= 0.35 ? 'Помірна стійкість' : 'Залежність від боргу',
    },
    {
      id: 'financial_leverage',
      category: 'solvency',
      name: 'Коефіцієнт фінансового левериджу',
      intlName: 'Debt-to-Equity D/E (Табл. 1.1, п. 12)',
      value: financialLeverage !== null ? financialLeverage.toFixed(2) : '—',
      rawValue: financialLeverage,
      formula: '(рядок 1595 + рядок 1695) / рядок 1495',
      calcDetails: r1495 && r1695 ? `(${formatCurrency(r1595 || 0)} + ${formatCurrency(r1695)}) ₴ / ${formatCurrency(r1495)} ₴` : null,
      description: 'Співвідношення всього позикового капіталу до власного капіталу підприємства.',
      benchmark: 'Норма < 1.0 (оптимально 0.5 — 0.8)',
      status: financialLeverage === null ? 'none' : financialLeverage <= 0.8 ? 'optimal' : financialLeverage <= 1.5 ? 'normal' : 'warning',
      statusText: financialLeverage === null ? '—' : financialLeverage <= 0.8 ? 'Низький фінансовий важіль' : financialLeverage <= 1.5 ? 'Помірне боргове навантаження' : 'Високий леверидж (ризик)',
    },
    {
      id: 'equity_maneuverability',
      category: 'solvency',
      name: 'Коефіцієнт маневреності власного капіталу',
      intlName: 'Equity Maneuverability (Табл. 1.1, п. 7)',
      value: equityManeuverability !== null ? equityManeuverability.toFixed(2) : '—',
      rawValue: equityManeuverability,
      formula: '(рядок 1195 - рядок 1695) / рядок 1495',
      calcDetails: r1495 && r1195 && r1695 ? `(${formatCurrency(r1195)} - ${formatCurrency(r1695)}) ₴ / ${formatCurrency(r1495)} ₴` : null,
      description: 'Частка власного капіталу, яка вкладена в оборотні активи та знаходиться у мобільній формі.',
      benchmark: 'Норма > 0.10 — 0.50',
      status: equityManeuverability === null ? 'none' : equityManeuverability >= 0.2 ? 'optimal' : equityManeuverability > 0 ? 'normal' : 'warning',
      statusText: equityManeuverability === null ? '—' : equityManeuverability >= 0.2 ? 'Висока мобільність' : equityManeuverability > 0 ? 'Норма' : 'Низька маневреність',
    },
    {
      id: 'fixed_assets_condition',
      category: 'solvency',
      name: 'Коефіцієнт придатності основних засобів',
      intlName: 'Fixed Assets Condition (Табл. 1.1, п. 1)',
      value: fixedAssetsCondition !== null ? `${(fixedAssetsCondition * 100).toFixed(1)}%` : '—',
      rawValue: fixedAssetsCondition,
      formula: 'рядок 1010 / рядок 1011',
      calcDetails: r1010 && r1011 ? `${formatCurrency(r1010)} ₴ / ${formatCurrency(r1011)} ₴` : null,
      description: 'Співвідношення залишкової вартості основних засобів до їхньої первісної вартості. Характеризує ступінь зношеності обладнання.',
      benchmark: 'Норма > 50.0% (> 0.50)',
      status: fixedAssetsCondition === null ? 'none' : fixedAssetsCondition >= 0.5 ? 'optimal' : 'warning',
      statusText: fixedAssetsCondition === null ? '—' : fixedAssetsCondition >= 0.5 ? 'Обладнання сучасне' : 'Високий ступінь зносу',
    },
    {
      id: 'cap_coverage',
      category: 'solvency',
      name: 'Покриття необоротних активів власним капіталом',
      intlName: 'Capital Coverage Ratio',
      value: capCoverageRatio !== null ? capCoverageRatio.toFixed(2) : '—',
      rawValue: capCoverageRatio,
      formula: 'рядок 1495 / рядок 1095',
      calcDetails: r1495 !== null && r1095 ? `${formatCurrency(r1495)} ₴ / ${formatCurrency(r1095)} ₴` : null,
      description: 'Показує, якою мірою основні засоби та інші необоротні активи профінансовані за рахунок власного капіталу компанії.',
      benchmark: 'Норма > 1.0',
      status: capCoverageRatio === null ? 'none' : capCoverageRatio >= 1.0 ? 'optimal' : 'warning',
      statusText: capCoverageRatio === null ? '—' : capCoverageRatio >= 1.0 ? 'Повністю покриті' : 'Потребує позик',
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
      description: 'Частка активів компанії, яка фінансується за рахунок короткострокових зобов\'язань.',
      benchmark: 'Безпечно <= 0.50 (<= 50%)',
      status: debtRatio === null ? 'none' : debtRatio <= 0.5 ? 'optimal' : debtRatio <= 0.7 ? 'normal' : 'warning',
      statusText: debtRatio === null ? '—' : debtRatio <= 0.5 ? 'Безпечний рівень' : debtRatio <= 0.7 ? 'Помірний ризик' : 'Високий ризик',
    },

    // 3. Ділова активність та оборотність
    {
      id: 'receivables_turnover',
      category: 'activity',
      name: 'Оборотність дебіторської заборгованості',
      intlName: 'Receivables Turnover (Табл. 1.1, п. 10)',
      value: receivablesTurnover !== null ? `${receivablesTurnover.toFixed(1)} об.` : '—',
      rawValue: receivablesTurnover,
      formula: 'рядок 2000 / рядок 1125',
      calcDetails: revenueCurrent && r1125 ? `${formatCurrency(revenueCurrent)} ₴ / ${formatCurrency(r1125)} ₴` : null,
      description: 'Кількість оборотів дебіторської заборгованості за звітний період.',
      benchmark: 'Зростання (висока швидкість розрахунків)',
      status: receivablesTurnover === null ? 'none' : receivablesTurnover >= 6 ? 'optimal' : 'normal',
      statusText: receivablesTurnover === null ? '—' : receivablesTurnover >= 6 ? 'Швидка оплата клієнтами' : 'Помірна оборотність',
    },
    {
      id: 'receivables_days',
      category: 'activity',
      name: 'Тривалість погашення дебіторської заборгованості',
      intlName: 'Days Sales Outstanding DSO (Табл. 1.1, п. 11)',
      value: receivablesDays !== null ? `${Math.round(receivablesDays)} дн.` : '—',
      rawValue: receivablesDays,
      formula: '365 / оборотність дебіторки',
      calcDetails: receivablesTurnover ? `365 / ${receivablesTurnover.toFixed(1)}` : null,
      description: 'Середня кількість днів, за яку покупці розраховуються за поставлену продукцію.',
      benchmark: 'Зменшення (оптимально < 45-60 днів)',
      status: receivablesDays === null ? 'none' : receivablesDays <= 45 ? 'optimal' : receivablesDays <= 75 ? 'normal' : 'warning',
      statusText: receivablesDays === null ? '—' : receivablesDays <= 45 ? 'Швидкий збір виручки' : receivablesDays <= 75 ? 'Норма' : 'Тривале заморожування коштів',
    },
    {
      id: 'payables_turnover',
      category: 'activity',
      name: 'Оборотність кредиторської заборгованості',
      intlName: 'Payables Turnover (Табл. 1.1, п. 8)',
      value: payablesTurnover !== null ? `${payablesTurnover.toFixed(1)} об.` : '—',
      rawValue: payablesTurnover,
      formula: 'рядок 2000 / рядок 1615',
      calcDetails: revenueCurrent && credDebt ? `${formatCurrency(revenueCurrent)} ₴ / ${formatCurrency(credDebt)} ₴` : null,
      description: 'Швидкість розрахунків компанії з постачальниками та підрядниками.',
      benchmark: 'Оборотів за рік',
      status: payablesTurnover === null ? 'none' : 'normal',
      statusText: payablesTurnover === null ? '—' : 'Показник оборотності',
    },
    {
      id: 'payables_days',
      category: 'activity',
      name: 'Тривалість обороту кредиторської заборгованості',
      intlName: 'Days Payable Outstanding DPO (Табл. 1.1, п. 9)',
      value: payablesDays !== null ? `${Math.round(payablesDays)} дн.` : '—',
      rawValue: payablesDays,
      formula: '365 / оборотність кредиторки',
      calcDetails: payablesTurnover ? `365 / ${payablesTurnover.toFixed(1)}` : null,
      description: 'Середній строк розрахунку підприємства за отримані сировину, товари та послуги.',
      benchmark: 'Днів',
      status: payablesDays === null ? 'none' : 'normal',
      statusText: payablesDays === null ? '—' : 'Строк погашення боргів',
    },
    {
      id: 'fixed_asset_turnover',
      category: 'activity',
      name: 'Фондовіддача',
      intlName: 'Fixed Asset Turnover (Табл. 1.2, п. 8)',
      value: fixedAssetTurnover !== null ? `${fixedAssetTurnover.toFixed(2)}` : '—',
      rawValue: fixedAssetTurnover,
      formula: 'рядок 2000 / рядок 1010',
      calcDetails: revenueCurrent && r1010 ? `${formatCurrency(revenueCurrent)} ₴ / ${formatCurrency(r1010)} ₴` : null,
      description: 'Скільки гривень виручки приносить кожна 1 гривня, вкладена в основні засоби.',
      benchmark: 'Зростання (висока ефективність виробничих ліній)',
      status: fixedAssetTurnover === null ? 'none' : fixedAssetTurnover >= 3 ? 'optimal' : 'normal',
      statusText: fixedAssetTurnover === null ? '—' : fixedAssetTurnover >= 3 ? 'Висока продуктивність фондів' : 'Помірна віддача',
    },
    {
      id: 'inventory_to_revenue',
      category: 'activity',
      name: 'Частка запасів у виручці',
      intlName: 'Inventory to Revenue (Табл. 1.4, п. 8)',
      value: inventoryToRevenue !== null ? `${inventoryToRevenue.toFixed(1)}%` : '—',
      rawValue: inventoryToRevenue,
      formula: '(рядок 1100 / рядок 2000) × 100%',
      calcDetails: r1100 !== null && revenueCurrent ? `${formatCurrency(r1100)} ₴ / ${formatCurrency(revenueCurrent)} ₴` : null,
      description: 'Частка вартості матеріалів та готової продукції на складі відносно річного доходу.',
      benchmark: 'Зниження (оптимізація запасів)',
      status: inventoryToRevenue === null ? 'none' : inventoryToRevenue <= 25 ? 'optimal' : 'normal',
      statusText: inventoryToRevenue === null ? '—' : inventoryToRevenue <= 25 ? 'Оптимальний рівень складу' : 'Великі запаси',
    },

    // 4. Рентабельність та маржинальність
    {
      id: 'gross_margin',
      category: 'profitability',
      name: 'Валова рентабельність реалізованої продукції',
      intlName: 'Gross Margin (Табл. 1.4, п. 1)',
      value: grossMargin !== null ? `${grossMargin.toFixed(1)}%` : '—',
      rawValue: grossMargin,
      formula: '(рядок 2000 - рядок 2050) / рядок 2000 × 100%',
      calcDetails: grossProfit !== null && revenueCurrent ? `${formatCurrency(grossProfit)} ₴ / ${formatCurrency(revenueCurrent)} ₴` : null,
      description: 'Частка валового прибутку у загальному обсязі виручки. Базовий маркер комерційної прибутковості продукту.',
      benchmark: 'Норма > 20.0% — 30.0%',
      status: grossMargin === null ? 'none' : grossMargin >= 25 ? 'optimal' : grossMargin > 10 ? 'normal' : 'warning',
      statusText: grossMargin === null ? '—' : grossMargin >= 25 ? 'Висока валова маржа' : grossMargin > 10 ? 'Нормальна прибутковість' : 'Низька маржа',
    },
    {
      id: 'net_margin',
      category: 'profitability',
      name: 'Чиста маржа',
      intlName: 'Net Profit Margin (Табл. 1.4, п. 2)',
      value: netMargin !== null ? `${netMargin.toFixed(1)}%` : '—',
      rawValue: netMargin,
      formula: 'рядок 2350/2355 / рядок 2000 × 100%',
      calcDetails: netIncomeCurrent !== null && revenueCurrent ? `${formatCurrency(netIncomeCurrent)} ₴ / ${formatCurrency(revenueCurrent)} ₴` : null,
      description: 'Частка чистого прибутку після сплати податків у загальній виручці від реалізації.',
      benchmark: 'Добре > 5.0%',
      status: netMargin === null ? 'none' : netMargin > 8 ? 'optimal' : netMargin > 0 ? 'normal' : 'warning',
      statusText: netMargin === null ? '—' : netMargin > 8 ? 'Високомаржинальний бізнес' : netMargin > 0 ? 'Прибутковий' : 'Від\'ємна маржа (збиток)',
    },
    {
      id: 'roa',
      category: 'profitability',
      name: 'Рентабельність активів (ROA)',
      intlName: 'Return on Assets',
      value: roa !== null ? `${roa.toFixed(1)}%` : '—',
      rawValue: roa,
      formula: 'рядок 2350/2355 / рядок 1900 × 100%',
      calcDetails: netIncomeCurrent !== null && r1900 ? `${formatCurrency(netIncomeCurrent)} ₴ / ${formatCurrency(r1900)} ₴` : null,
      description: 'Показує, скільки прибутку генерує кожна гривня вкладених активів підприємства.',
      benchmark: 'Добре > 5.0%',
      status: roa === null ? 'none' : roa > 5 ? 'optimal' : roa > 0 ? 'normal' : 'warning',
      statusText: roa === null ? '—' : roa > 5 ? 'Висока віддача активів' : roa > 0 ? 'Позитивна віддача' : 'Збиткова діяльність',
    },
    {
      id: 'roe',
      category: 'profitability',
      name: 'Рентабельність власного капіталу (ROE)',
      intlName: 'Return on Equity (Табл. 1.1, п. 14)',
      value: roe !== null ? `${roe.toFixed(1)}%` : '—',
      rawValue: roe,
      formula: 'рядок 2350/2355 / рядок 1495 × 100%',
      calcDetails: netIncomeCurrent !== null && r1495 ? `${formatCurrency(netIncomeCurrent)} ₴ / ${formatCurrency(r1495)} ₴` : null,
      description: 'Ефективність використання власного капіталу акціонерів для отримання чистого прибутку.',
      benchmark: 'Добре > 10.0%',
      status: roe === null ? 'none' : roe > 10 ? 'optimal' : roe > 0 ? 'normal' : 'warning',
      statusText: roe === null ? '—' : roe > 10 ? 'Висока дохідність капіталу' : roe > 0 ? 'Позитивна дохідність' : 'Збиток на капітал',
    },
    {
      id: 'production_profitability',
      category: 'profitability',
      name: 'Рентабельність виробництва (витрат)',
      intlName: 'Cost Profitability (Табл. 1.1, п. 15)',
      value: productionProfitability !== null ? `${productionProfitability.toFixed(1)}%` : '—',
      rawValue: productionProfitability,
      formula: 'валовий прибуток / рядок 2050 × 100%',
      calcDetails: grossProfit !== null && r2050 ? `${formatCurrency(grossProfit)} ₴ / ${formatCurrency(r2050)} ₴` : null,
      description: 'Прибуток, отриманий на кожну гривню витрат на собівартість реалізованої продукції.',
      benchmark: 'Зростання',
      status: productionProfitability === null ? 'none' : productionProfitability >= 25 ? 'optimal' : productionProfitability > 0 ? 'normal' : 'warning',
      statusText: productionProfitability === null ? '—' : productionProfitability >= 25 ? 'Висока рентабельність витрат' : productionProfitability > 0 ? 'Прибуткове виробництво' : 'Низька окупність',
    },

    // 5. Ефективність витрат та маркетинг
    {
      id: 'cost_coverage',
      category: 'efficiency',
      name: 'Коефіцієнт покриття виробничих витрат',
      intlName: 'Cost to Revenue (Табл. 1.1, п. 13)',
      value: costCoverage !== null ? `${costCoverage.toFixed(1)}%` : '—',
      rawValue: costCoverage,
      formula: 'рядок 2050 / рядок 2000 × 100%',
      calcDetails: r2050 !== null && revenueCurrent ? `${formatCurrency(r2050)} ₴ / ${formatCurrency(revenueCurrent)} ₴` : null,
      description: 'Частка собівартості виробництва у структурі отриманої виручки.',
      benchmark: 'Зменшення (оптимально < 70-80%)',
      status: costCoverage === null ? 'none' : costCoverage <= 75 ? 'optimal' : costCoverage <= 85 ? 'normal' : 'warning',
      statusText: costCoverage === null ? '—' : costCoverage <= 75 ? 'Ефективна собівартість' : costCoverage <= 85 ? 'Помірні витрати' : 'Високі виробничі витрати',
    },
    {
      id: 'sales_expenses_ratio',
      category: 'efficiency',
      name: 'Частка витрат на здійснення збуту',
      intlName: 'Selling Expenses Ratio (Табл. 1.4, п. 3)',
      value: salesExpensesRatio !== null ? `${salesExpensesRatio.toFixed(1)}%` : '—',
      rawValue: salesExpensesRatio,
      formula: 'рядок 2150 / рядок 2000 × 100%',
      calcDetails: r2150 !== null && revenueCurrent ? `${formatCurrency(r2150)} ₴ / ${formatCurrency(revenueCurrent)} ₴` : null,
      description: 'Частка маркетингових, логістичних витрат та витрат на дистрибуцію у загальній виручці.',
      benchmark: 'Показник інтенсивності збуту',
      status: salesExpensesRatio === null ? 'none' : 'normal',
      statusText: salesExpensesRatio === null ? '—' : 'Комерційна активність',
    },

    // 6. Персонал
    {
      id: 'revenue_per_employee',
      category: 'efficiency',
      name: 'Продуктивність праці (Виручка на 1 працівника)',
      intlName: 'Revenue per Employee (Табл. 1.3, п. 6)',
      value: revenuePerEmployee !== null ? `${formatCurrency(revenuePerEmployee)} тис. ₴` : '—',
      rawValue: revenuePerEmployee,
      formula: 'рядок 2000 / чисельність працівників',
      calcDetails: revenueCurrent && employees ? `${formatCurrency(revenueCurrent)} ₴ / ${employees} працівників` : null,
      description: 'Обсяг реалізованої продукції, що припадає на одного офіційно працевлаштованого працівника.',
      benchmark: 'Зростання (тис. ₴ / працівника)',
      status: revenuePerEmployee === null ? 'none' : 'normal',
      statusText: revenuePerEmployee === null ? '—' : 'Показник ефективності праці',
    },
    {
      id: 'profit_per_employee',
      category: 'efficiency',
      name: 'Прибутковість персоналу (Прибуток на 1 працівника)',
      intlName: 'Net Income per Employee (Табл. 1.3, п. 2)',
      value: profitPerEmployee !== null ? `${formatCurrency(profitPerEmployee)} тис. ₴` : '—',
      rawValue: profitPerEmployee,
      formula: 'чистий прибуток / чисельність працівників',
      calcDetails: netIncomeCurrent !== null && employees ? `${formatCurrency(netIncomeCurrent)} ₴ / ${employees} працівників` : null,
      description: 'Чистий фінансовий результат, який генерує компанія в розрахунку на одного працівника.',
      benchmark: 'Збільшення (тис. ₴ / працівника)',
      status: profitPerEmployee === null ? 'none' : profitPerEmployee > 0 ? 'optimal' : 'warning',
      statusText: profitPerEmployee === null ? '—' : profitPerEmployee > 0 ? 'Прибуткові робочі місця' : 'Збиток на працівника',
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

            return (
              <div
                key={i}
                className="kpi-card rounded-2xl border border-border-card bg-surface-card p-4 shadow-lg relative overflow-hidden backdrop-blur-md flex flex-col justify-between hover:border-zinc-700 transition-colors print:border-black print:p-3 print:bg-transparent print:shadow-none"
              >
                <div className="flex items-start justify-between text-zinc-400 text-xs gap-2">
                  <span className="font-medium tracking-wide text-zinc-300 print:text-black">{card.title}</span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center shrink-0 print:hidden">
                    <Icon className="w-3.5 h-3.5 text-accent" />
                  </div>
                </div>

                <div className="my-2.5">
                  <div
                    className={`text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums print:text-black ${
                      card.isNetIncome
                        ? card.value !== null && card.value >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                        : 'text-white'
                    }`}
                  >
                    {formatCurrency(card.value)}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono mt-0.5 print:text-neutral-700">{card.unit}</div>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 print:border-black/30 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-zinc-500 font-mono print:text-neutral-700">{card.rowNote}</span>
                  {card.change.pct !== null ? (
                    <div
                      className={`flex items-center gap-1 font-mono text-[11px] font-medium print:text-black ${
                        card.change.direction === 'positive'
                          ? 'text-emerald-400'
                          : card.change.direction === 'negative'
                          ? 'text-rose-400'
                          : 'text-zinc-500'
                      }`}
                    >
                      {card.change.direction === 'positive' ? (
                        <TrendingUp className="w-3 h-3 print:hidden" />
                      ) : card.change.direction === 'negative' ? (
                        <TrendingDown className="w-3 h-3 print:hidden" />
                      ) : null}
                      <span>{card.change.text}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-600 font-mono text-[11px] print:text-black">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. БЛОК ФІНАНСОВОЇ АНАЛІТИКИ ТА КОЕФІЦІЄНТІВ (Збалансована система показників BSC) */}
      <div className="kpi-container rounded-2xl border border-border-card bg-surface-card p-5 shadow-2xl backdrop-blur-md space-y-5 print:border-black print:p-3 print:bg-transparent print:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800 print:border-black/30">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent print:hidden" />
              <h3 className="text-base font-bold text-white print:text-black tracking-tight">
                Фінансовий аналіз та система показників (BSC)
              </h3>
            </div>
            <p className="text-xs text-zinc-400 print:text-neutral-700 mt-1">
              Комплексна оцінка ліквідності, платоспроможності, рентабельності, ділової активності та персоналу за методикою НП(С)БО
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto no-print">
            <button
              type="button"
              onClick={() => setShowFormulas(!showFormulas)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
              <span>{showFormulas ? 'Приховати формули' : 'Показати формули'}</span>
            </button>
          </div>
        </div>

        {/* Фільтри за категоріями ЗСП */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-print">
          {[
            { id: 'all', label: `Усі показники (${ratios.length})` },
            { id: 'liquidity', label: 'Ліквідність (4)' },
            { id: 'solvency', label: 'Стійкість та леверидж (6)' },
            { id: 'activity', label: 'Ділова активність (6)' },
            { id: 'profitability', label: 'Рентабельність (5)' },
            { id: 'efficiency', label: 'Персонал і витрати (4)' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
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
                className="kpi-item rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col justify-between space-y-3 hover:border-zinc-700/80 transition-colors print:bg-transparent print:border-black print:p-3 print:shadow-none"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white print:text-black text-xs leading-snug">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 print:text-neutral-700 font-mono mt-0.5">
                        {item.intlName}
                      </div>
                    </div>

                    {/* Статус індикатор */}
                    {item.status !== 'none' && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border shrink-0 print:bg-transparent print:border-black print:text-black ${
                          isOptimal
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isNormal
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {isOptimal || isNormal ? (
                          <CheckCircle2 className="w-3 h-3 print:hidden" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 print:hidden" />
                        )}
                        <span>{item.statusText}</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <div className="text-2xl font-bold font-mono text-white print:text-black tracking-tight tabular-nums">
                      {item.value}
                    </div>
                    <div className="text-[11px] text-zinc-400 print:text-neutral-700 font-mono">
                      {item.benchmark}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-800/60 print:border-black/30 text-xs">
                  <p className="text-zinc-400 print:text-neutral-700 text-[11px] leading-relaxed">
                    {item.description}
                  </p>

                  {showFormulas && item.formula && (
                    <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] space-y-1 font-mono text-zinc-400 print:bg-transparent print:border-black print:text-black">
                      <div className="text-zinc-500 print:text-neutral-700 text-[10px] uppercase tracking-wider font-semibold">
                        Формула за статтями:
                      </div>
                      <div className="text-zinc-300 print:text-black">{item.formula}</div>
                      {item.calcDetails && (
                        <div className="text-accent print:text-black text-[10px] pt-0.5 border-t border-zinc-800/80 print:border-black/30">
                          {item.calcDetails}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
