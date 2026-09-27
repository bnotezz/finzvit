import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  Layers, 
  Cpu, 
  Package, 
  Wallet, 
  FileText, 
  ShieldAlert, 
  Calculator, 
  Building
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { ReportData } from '../../lib/types';

interface RenderF5NotesProps {
  report: ReportData;
}

// ============================================================================
// РОЗДІЛ I: Нематеріальні активи
// ============================================================================
const SECTION_I_ROWS = [
  { code: '01', line: '010', name: 'Права користування природними ресурсами' },
  { code: '02', line: '020', name: 'Права користування майном' },
  { code: '03', line: '030', name: 'Права на комерційні позначення' },
  { code: '04', line: '040', name: 'Права на об\'єкти промислової власності' },
  { code: '05', line: '050', name: 'Авторське право та суміжні з ним права' },
  { code: '06', line: '060', name: 'Незавершені капітальні інвестиції в нематеріальні активи' },
  { code: '07', line: '070', name: 'Інші нематеріальні активи' },
  { code: '08', line: '080', name: 'Разом нематеріальні активи', isTotal: true },
];

// ============================================================================
// РОЗДІЛ II: Основні засоби
// ============================================================================
const SECTION_II_ROWS = [
  { code: '10', line: '100', name: 'Земельні ділянки' },
  { code: '11', line: '110', name: 'Інвестиційна нерухомість' },
  { code: '12', line: '120', name: 'Будівлі, споруди та передавальні пристрої' },
  { code: '13', line: '130', name: 'Машини та обладнання' },
  { code: '14', line: '140', name: 'Транспортні засоби' },
  { code: '15', line: '150', name: 'Інструменти, прилади, інвентар (меблі)' },
  { code: '16', line: '160', name: 'Тварини' },
  { code: '17', line: '170', name: 'Багаторічні насадження' },
  { code: '18', line: '180', name: 'Інші основні засоби' },
  { code: '19', line: '190', name: 'Довгострокові біологічні активи' },
  { code: '20', line: '200', name: 'Незавершені капітальні інвестиції в основні засоби' },
  { code: '21', line: '210', name: 'Інші необоротні матеріальні активи' },
  { code: '22', line: '220', name: 'Малоцінні необоротні матеріальні активи' },
  { code: '23', line: '230', name: 'Тимчасові (нетитульні) споруди' },
  { code: '24', line: '240', name: 'Природні ресурси' },
  { code: '25', line: '250', name: 'Інвентарна тара' },
  { code: '26', line: '260', name: 'Разом основні засоби', isTotal: true },
];

// ============================================================================
// РОЗДІЛ III: Капітальні інвестиції
// ============================================================================
const SECTION_III_ROWS = [
  { code: '28', line: '280', name: 'Капітальне будівництво' },
  { code: '29', line: '290', name: 'Придбання (виготовлення) основних засобів' },
  { code: '30', line: '300', name: 'Придбання (виготовлення) інших необоротних матеріальних активів' },
  { code: '31', line: '310', name: 'Придбання (створення) нематеріальних активів' },
  { code: '32', line: '320', name: 'Придбання (вирощування) довгострокових біологічних активів' },
  { code: '33', line: '330', name: 'Інші капітальні інвестиції' },
  { code: '34', line: '340', name: 'Разом капітальні інвестиції', isTotal: true },
];

// ============================================================================
// РОЗДІЛ V: Доходи і витрати
// ============================================================================
const SECTION_V_ROWS = [
  { code: '44', line: '440', name: 'Операційна оренда активів' },
  { code: '45', line: '450', name: 'Операційні курсові різниці' },
  { code: '46', line: '460', name: 'Реалізація оборотних активів' },
  { code: '47', line: '470', name: 'Одержані / сплачені штрафи, пені, неустойки' },
  { code: '49', line: '490', name: 'Інші операційні доходи та витрати' },
  { code: '54', line: '540', name: 'Собівартість реалізованих виробничих запасів' },
  { code: '55', line: '550', name: 'Нестачі і втрати від псування цінностей' },
  { code: '56', line: '560', name: 'Визнані штрафи, пені, неустойки' },
  { code: '60', line: '600', name: 'Інші витрати операційної діяльності' },
  { code: '62', line: '620', name: 'Фінансові витрати' },
  { code: '63', line: '630', name: 'Інші фінансові доходи / витрати' },
  { code: '65', line: '650', name: 'Інші доходи від надзвичайних подій' },
  { code: '69', line: '690', name: 'Інші надзвичайні витрати' },
];

// ============================================================================
// РОЗДІЛ VII: Забезпечення і резерви
// ============================================================================
const SECTION_VII_ROWS = [
  { code: '71', line: '710', name: 'Забезпечення на виплату відпусток' },
  { code: '72', line: '720', name: 'Забезпечення наступних витрат на додаткове пенсійне забезпечення' },
  { code: '73', line: '730', name: 'Забезпечення на виконання гарантійних зобов\'язань' },
  { code: '775', line: '775', name: 'Інші забезпечення' },
  { code: '78', line: '780', name: 'Разом забезпечень', isTotal: true },
];

// ============================================================================
// РОЗДІЛ VIII: Запаси
// ============================================================================
const SECTION_VIII_ROWS = [
  { code: '80', line: '800', name: 'Виробничі запаси' },
  { code: '81', line: '810', name: 'Тварини на вирощуванні та відгодівлі' },
  { code: '82', line: '820', name: 'Незавершене виробництво' },
  { code: '83', line: '830', name: 'Готова продукція' },
  { code: '84', line: '840', name: 'Товари' },
  { code: '85', line: '850', name: 'Разом запаси на підприємстві', isTotal: true },
  { code: '88', line: '880', name: 'Запаси, передані в заставу' },
  { code: '89', line: '890', name: 'Запаси на відповідальному зберіганні' },
  { code: '90', line: '900', name: 'Запаси, передані на переробку' },
  { code: '91', line: '910', name: 'Запаси, прийняті на комісію' },
  { code: '92', line: '920', name: 'Усього запасів', isTotal: true },
];

// ============================================================================
// РОЗДІЛ IX: Дебіторська заборгованість
// ============================================================================
const SECTION_IX_ROWS = [
  { code: '94', line: '940', name: 'Довгострокова дебіторська заборгованість' },
  { code: '95', line: '950', name: 'Поточна дебіторська заборгованість' },
];

// ============================================================================
// РОЗДІЛ XII: Податок на прибуток
// ============================================================================
const SECTION_XII_ROWS = [
  { code: 'A1210', line: '1210', name: 'Поточний податок на прибуток' },
  { code: 'A1230', line: '1230', name: 'Зміна відстрочених податкових активів' },
  { code: 'A1235', line: '1235', name: 'Зміна відстрочених податкових зобов\'язань' },
  { code: 'A1240', line: '1240', name: 'Витрати (дохід) з податку на прибуток — разом', isTotal: true },
  { code: 'A1241', line: '1241', name: 'у тому числі: від звичайної діяльності' },
  { code: 'A1243', line: '1243', name: 'інше' },
];

export const RenderF5Notes: React.FC<RenderF5NotesProps> = ({ report }) => {
  const data = (report as any)?.data || report || {};
  const [onlyFilled, setOnlyFilled] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'assets' | 'capex' | 'income' | 'provisions' | 'inventory' | 'debt' | 'tax'>('all');

  // Перевірка наявності даних для рядка
  const hasData = (prefixes: string[], rowCode: string) => {
    return prefixes.some((p) => data[`${p}${rowCode}`] !== undefined && data[`${p}${rowCode}`] !== null);
  };

  return (
    <div className="space-y-6">
      {/* Шапка форми 5 */}
      <div className="rounded-2xl border border-border-card bg-surface-card shadow-2xl backdrop-blur-md p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Примітки до річної фінансової звітності
            </h2>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-accent border border-accent/20">
              Форма № 5
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Звітний період: за {report.meta?.period_year || 2025} рік · Одиниця виміру: тис. гривень (тис. ₴)
          </p>
        </div>

        {/* Перемикач показу порожніх рядків */}
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

      {/* Швидкі таби навігації по розділах */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border-subtle no-print text-xs">
        {[
          { id: 'all', label: 'Усі розділи', icon: Layers },
          { id: 'assets', label: 'I-II. Активи та ОЗ', icon: Building },
          { id: 'capex', label: 'III. Капінвестиції', icon: Cpu },
          { id: 'income', label: 'V. Доходи та витрати', icon: Calculator },
          { id: 'provisions', label: 'VII. Забезпечення', icon: ShieldAlert },
          { id: 'inventory', label: 'VIII. Запаси', icon: Package },
          { id: 'debt', label: 'IX. Дебіторка', icon: Wallet },
          { id: 'tax', label: 'XII-XIII. Податок & Амортизація', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-accent/15 text-accent border border-accent/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* РОЗДІЛ I: Нематеріальні активи */}
      {(activeTab === 'all' || activeTab === 'assets') && (
        <div className="rounded-2xl border border-border-card bg-surface-card shadow-xl overflow-hidden">
          <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              I. Нематеріальні активи
            </h3>
            <span className="text-[11px] font-mono text-zinc-400">Рядки 010 — 080</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-medium">
                  <th className="py-2.5 px-4 min-w-[220px]">Групи нематеріальних активів</th>
                  <th className="py-2.5 px-2 w-12 text-center font-mono">Код</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px]">Поч. вартість</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px]">Поч. знос</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[100px] text-emerald-400/90">Надійшло</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[100px]">Вибуло</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[100px]">Амортизація</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px] text-white">Кінц. вартість</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px]">Кінц. знос</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {SECTION_I_ROWS.filter(
                  (r) => !onlyFilled || r.isTotal || hasData(['A', 'B', 'C', 'F', 'H', 'L', 'M'], r.code)
                ).map((row) => (
                  <tr
                    key={row.code}
                    className={`transition-colors ${
                      row.isTotal
                        ? 'bg-zinc-900/70 font-semibold text-white'
                        : 'hover:bg-zinc-800/30 text-zinc-300'
                    }`}
                  >
                    <td className="py-2.5 px-4">{row.name}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-[11px] text-zinc-500">{row.line}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatCurrency(data[`A${row.code}`])}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                      {formatCurrency(data[`B${row.code}`], { isDeduction: true })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">
                      {formatCurrency(data[`C${row.code}`])}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                      {formatCurrency(data[`F${row.code}`])}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-300">
                      {formatCurrency(data[`H${row.code}`])}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-white">
                      {formatCurrency(data[`L${row.code}`])}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                      {formatCurrency(data[`M${row.code}`], { isDeduction: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* РОЗДІЛ II: Основні засоби */}
      {(activeTab === 'all' || activeTab === 'assets') && (
        <div className="rounded-2xl border border-border-card bg-surface-card shadow-xl overflow-hidden">
          <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              II. Основні засоби
            </h3>
            <span className="text-[11px] font-mono text-zinc-400">Рядки 100 — 260</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-medium">
                  <th className="py-2.5 px-4 min-w-[220px]">Групи основних засобів</th>
                  <th className="py-2.5 px-2 w-12 text-center font-mono">Код</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px]">Поч. вартість</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px]">Поч. знос</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[100px] text-emerald-400/90">Надійшло</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[100px]">Вибуло</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[100px]">Амортизація</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px] text-white">Кінц. вартість</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px]">Кінц. знос</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[120px] text-indigo-300">Лізинг (вартість)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {SECTION_II_ROWS.filter(
                  (r) => !onlyFilled || r.isTotal || hasData(['A', 'B', 'C', 'F', 'H', 'L', 'M', 'N'], r.code)
                ).map((row) => (
                  <tr
                    key={row.code}
                    className={`transition-colors ${
                      row.isTotal
                        ? 'bg-zinc-900/80 font-semibold text-white'
                        : 'hover:bg-zinc-800/30 text-zinc-300'
                    }`}
                  >
                    <td className="py-2.5 px-4">{row.name}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-[11px] text-zinc-500">{row.line}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatCurrency(data[`A${row.code}`])}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                      {formatCurrency(data[`B${row.code}`], { isDeduction: true })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">
                      {formatCurrency(data[`C${row.code}`])}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                      {formatCurrency(data[`F${row.code}`])}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-300">
                      {formatCurrency(data[`H${row.code}`])}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-white">
                      {formatCurrency(data[`L${row.code}`])}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                      {formatCurrency(data[`M${row.code}`], { isDeduction: true })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-indigo-300">
                      {formatCurrency(data[`N${row.code}`])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* РОЗДІЛ III: Капітальні інвестиції */}
      {(activeTab === 'all' || activeTab === 'capex') && (
        <div className="rounded-2xl border border-border-card bg-surface-card shadow-xl overflow-hidden">
          <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              III. Капітальні інвестиції
            </h3>
            <span className="text-[11px] font-mono text-zinc-400">Рядки 280 — 340</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-medium">
                  <th className="py-2.5 px-4 min-w-[260px]">Вид капітальних інвестицій</th>
                  <th className="py-2.5 px-2 w-14 text-center font-mono">Код</th>
                  <th className="py-2.5 px-4 text-right font-mono min-w-[130px] text-emerald-400">За рік надійшло</th>
                  <th className="py-2.5 px-4 text-right font-mono min-w-[130px] text-white">За рік освоєно</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {SECTION_III_ROWS.filter(
                  (r) => !onlyFilled || r.isTotal || hasData(['A', 'B'], r.code)
                ).map((row) => (
                  <tr
                    key={row.code}
                    className={`transition-colors ${
                      row.isTotal ? 'bg-zinc-900/80 font-semibold text-white' : 'hover:bg-zinc-800/30 text-zinc-300'
                    }`}
                  >
                    <td className="py-2.5 px-4">{row.name}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-[11px] text-zinc-500">{row.line}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-400">
                      {formatCurrency(data[`A${row.code}`])}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-white">
                      {formatCurrency(data[`B${row.code}`])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* РОЗДІЛ V: Доходи і витрати */}
      {(activeTab === 'all' || activeTab === 'income') && (
        <div className="rounded-2xl border border-border-card bg-surface-card shadow-xl overflow-hidden">
          <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400"></span>
              V. Доходи і витрати
            </h3>
            <span className="text-[11px] font-mono text-zinc-400">Рядки 440 — 690</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-medium">
                  <th className="py-2.5 px-4 min-w-[260px]">Стаття доходів / витрат</th>
                  <th className="py-2.5 px-2 w-14 text-center font-mono">Код</th>
                  <th className="py-2.5 px-4 text-right font-mono min-w-[130px] text-emerald-400">Доходи</th>
                  <th className="py-2.5 px-4 text-right font-mono min-w-[130px] text-rose-400">Витрати</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {SECTION_V_ROWS.filter(
                  (r) => !onlyFilled || hasData(['A', 'B'], r.code)
                ).map((row) => (
                  <tr key={row.code} className="hover:bg-zinc-800/30 text-zinc-300 transition-colors">
                    <td className="py-2.5 px-4">{row.name}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-[11px] text-zinc-500">{row.line}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-400">
                      {formatCurrency(data[`A${row.code}`])}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-rose-400">
                      {formatCurrency(data[`B${row.code}`], { isDeduction: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* РОЗДІЛ VII: Забезпечення і резерви */}
      {(activeTab === 'all' || activeTab === 'provisions') && (
        <div className="rounded-2xl border border-border-card bg-surface-card shadow-xl overflow-hidden">
          <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              VII. Забезпечення і резерви
            </h3>
            <span className="text-[11px] font-mono text-zinc-400">Рядки 710 — 780</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-medium">
                  <th className="py-2.5 px-4 min-w-[220px]">Вид забезпечення</th>
                  <th className="py-2.5 px-2 w-12 text-center font-mono">Код</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px]">Залишок на початок</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px] text-emerald-400">Нараховано</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px]">Використано</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[100px]">Списано</th>
                  <th className="py-2.5 px-3 text-right font-mono min-w-[110px] font-semibold text-white">Залишок на кінець</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {SECTION_VII_ROWS.filter(
                  (r) => !onlyFilled || r.isTotal || hasData(['A', 'B', 'D', 'E', 'G'], r.code)
                ).map((row) => (
                  <tr
                    key={row.code}
                    className={`transition-colors ${
                      row.isTotal ? 'bg-zinc-900/80 font-semibold text-white' : 'hover:bg-zinc-800/30 text-zinc-300'
                    }`}
                  >
                    <td className="py-2.5 px-4">{row.name}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-[11px] text-zinc-500">{row.line}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatCurrency(data[`A${row.code}`])}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">
                      {formatCurrency(data[`B${row.code}`])}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-300">
                      {formatCurrency(data[`D${row.code}`])}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                      {formatCurrency(data[`E${row.code}`])}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-white">
                      {formatCurrency(data[`G${row.code}`])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* РОЗДІЛ VIII: Запаси */}
      {(activeTab === 'all' || activeTab === 'inventory') && (
        <div className="rounded-2xl border border-border-card bg-surface-card shadow-xl overflow-hidden">
          <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              VIII. Запаси
            </h3>
            <span className="text-[11px] font-mono text-zinc-400">Рядки 800 — 920</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-medium">
                  <th className="py-2.5 px-4 min-w-[260px]">Стаття запасів</th>
                  <th className="py-2.5 px-2 w-14 text-center font-mono">Код</th>
                  <th className="py-2.5 px-4 text-right font-mono min-w-[140px] font-semibold text-white">
                    Балансова вартість
                  </th>
                  <th className="py-2.5 px-4 text-right font-mono min-w-[140px] text-zinc-400">
                    У т.ч. чиста вартість реалізації
                  </th>
                  <th className="py-2.5 px-4 text-right font-mono min-w-[120px] text-accent">Переоцінка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {SECTION_VIII_ROWS.filter(
                  (r) => !onlyFilled || r.isTotal || hasData(['A', 'B', 'C'], r.code)
                ).map((row) => (
                  <tr
                    key={row.code}
                    className={`transition-colors ${
                      row.isTotal ? 'bg-zinc-900/80 font-semibold text-white' : 'hover:bg-zinc-800/30 text-zinc-300'
                    }`}
                  >
                    <td className="py-2.5 px-4">{row.name}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-[11px] text-zinc-500">{row.line}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-white">
                      {formatCurrency(data[`A${row.code}`])}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-400">
                      {formatCurrency(data[`B${row.code}`])}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-accent">
                      {formatCurrency(data[`C${row.code}`])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* РОЗДІЛ IX: Дебіторська заборгованість */}
      {(activeTab === 'all' || activeTab === 'debt') && (
        <div className="rounded-2xl border border-border-card bg-surface-card shadow-xl overflow-hidden">
          <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              IX. Дебіторська заборгованість
            </h3>
            <span className="text-[11px] font-mono text-zinc-400">Рядки 940, 950</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-medium">
                  <th className="py-2.5 px-4 min-w-[260px]">Вид дебіторської заборгованості</th>
                  <th className="py-2.5 px-2 w-14 text-center font-mono">Код</th>
                  <th className="py-2.5 px-4 text-right font-mono min-w-[140px] font-semibold text-white">
                    Усього на кінець року
                  </th>
                  <th className="py-2.5 px-4 text-right font-mono min-w-[140px] text-rose-400">
                    Строк оплати якої минув
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {SECTION_IX_ROWS.map((row) => (
                  <tr key={row.code} className="hover:bg-zinc-800/30 text-zinc-300 transition-colors">
                    <td className="py-2.5 px-4">{row.name}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-[11px] text-zinc-500">{row.line}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-white">
                      {formatCurrency(data[`A${row.code}`])}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-rose-400">
                      {formatCurrency(data[`B${row.code}`])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* РОЗДІЛ XII: Податок на прибуток та XIII: Амортизація */}
      {(activeTab === 'all' || activeTab === 'tax') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Податок на прибуток */}
          <div className="rounded-2xl border border-border-card bg-surface-card shadow-xl overflow-hidden">
            <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                XII. Податок на прибуток
              </h3>
              <span className="text-[11px] font-mono text-zinc-400">Рядки 1210 — 1243</span>
            </div>
            <div className="p-4 space-y-3">
              {SECTION_XII_ROWS.filter((r) => !onlyFilled || data[r.code] !== undefined).map((row) => (
                <div
                  key={row.code}
                  className={`flex items-center justify-between text-xs py-2 px-3 rounded-xl border ${
                    row.isTotal
                      ? 'bg-zinc-900/90 border-accent/30 font-semibold text-white'
                      : 'bg-zinc-950/40 border-white/5 text-zinc-300'
                  }`}
                >
                  <span className="line-clamp-1">{row.name}</span>
                  <span className="font-mono tabular-nums font-medium text-white shrink-0 ml-4">
                    {formatCurrency(data[row.code])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* XIII. Амортизаційні відрахування */}
          <div className="rounded-2xl border border-border-card bg-surface-card shadow-xl overflow-hidden flex flex-col justify-between">
            <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                XIII. Використання амортизації
              </h3>
              <span className="text-[11px] font-mono text-zinc-400">Рядок 1300</span>
            </div>
            <div className="p-6 flex flex-col items-center justify-center text-center space-y-2 flex-1">
              <div className="text-xs text-zinc-400 uppercase tracking-wider font-mono">
                Нараховано амортизації за звітний рік
              </div>
              <div className="text-3xl font-extrabold text-white font-mono tracking-tight text-accent">
                {formatCurrency(data['A1300'])} <span className="text-sm font-sans text-zinc-400">тис. грн</span>
              </div>
              <p className="text-xs text-zinc-500 max-w-sm pt-2">
                Загальна сума амортизаційних нарахувань за звітний період для всіх категорій необоротних активів.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
