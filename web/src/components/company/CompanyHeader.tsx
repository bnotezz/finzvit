import React, { useState } from 'react';
import { Building, MapPin, Users, Calendar, CheckCircle2, Copy, Check, Printer, Download, Share2 } from 'lucide-react';
import type { CompanyMeta } from '../../lib/types';

interface CompanyHeaderProps {
  company: CompanyMeta;
  activeReportTitle?: string;
  onExportCsv?: () => void;
}

export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
  company,
  activeReportTitle,
  onExportCsv,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* 1. ОФІЦІЙНА ШАПКА ДЛЯ ДРУКУ (Згідно зі стандартами фінансової звітності України) */}
      <div className="hidden print:block mb-3 text-black">
        {/* Вотермарк сервісу у верхньому колонтитулі */}
        <div className="flex items-center justify-between border-b-2 border-black pb-1 mb-2 text-[8.5pt]">
          <div className="flex items-center gap-1.5 font-bold tracking-tight">
            <span className="text-[10pt] uppercase tracking-wide">FinZvit</span>
            <span className="font-normal text-[8pt]">· Відкрита фінансова звітність підприємств України</span>
          </div>
          <div className="font-mono text-[8pt] text-neutral-600">
            finzvit.com.ua
          </div>
        </div>

        {/* Офіційна картка реквізитів підприємства (як у бланках Держстату / ДКУД) */}
        <div className="border border-black p-2 text-[8pt] leading-snug space-y-1 bg-white">
          <div className="flex justify-between items-start border-b border-black/40 pb-1 mb-1">
            <div className="pr-2">
              <div className="text-[7pt] uppercase tracking-wider text-neutral-600 font-medium">Підприємство</div>
              <div className="font-bold text-[10.5pt] tracking-tight uppercase">
                {company.name}
              </div>
            </div>
            <div className="border-2 border-black px-2.5 py-0.5 text-center font-mono shrink-0">
              <div className="text-[6.5pt] uppercase text-neutral-600">Код ЄДРПОУ</div>
              <div className="font-bold text-[10pt] tracking-wider">{company.edrpou}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[7.5pt]">
            <div>
              <span className="font-semibold">Вид діяльності (КВЕД): </span>
              <span>{company.kved || '—'} {company.kved_name ? `(${company.kved_name})` : ''}</span>
            </div>
            <div>
              <span className="font-semibold">Організаційно-правова форма: </span>
              <span>{company.opf_name || '—'}</span>
            </div>
            {company.address && (
              <div className="col-span-2">
                <span className="font-semibold">Місцезнаходження: </span>
                <span>{company.address}</span>
              </div>
            )}
            <div>
              <span className="font-semibold">Середня кількість працівників: </span>
              <span>{company.employees !== undefined && company.employees !== null ? company.employees : '—'}</span>
            </div>
            <div>
              <span className="font-semibold">Звітний період: </span>
              <span>{company.year || 2025} рік · <span className="italic">Одиниця виміру: тис. гривень</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ЕКРАННА ВЕБ-ШАПКА З ДІЯМИ ТА ГРАДІЄНТАМИ (При друку прихована) */}
      <div className="rounded-2xl border border-border-card bg-surface-card p-6 shadow-xl relative overflow-hidden backdrop-blur-md print:hidden">
        {/* Декоративний градієнтний акцент */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 relative z-10">
          <div className="space-y-3">
            {/* Статус та версійність */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Звітність подано
              </span>

              {company.accounting_standard && (
                <span className="px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/80 text-zinc-300 font-mono">
                  {company.accounting_standard}
                </span>
              )}

              {company.last_updated && (
                <span className="text-zinc-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Останнє подання: {company.last_updated.slice(0, 10)}
                </span>
              )}
            </div>

            {/* Назва компанії */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              {company.name || 'Підприємство'}
            </h1>

            {/* Код ЄДРПОУ + КВЕД */}
            <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-sm text-zinc-400">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-zinc-500">ЄДРПОУ:</span>
                <span className="text-white font-semibold tracking-wide bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/50">
                  {company.edrpou}
                </span>
              </div>

              {company.kved && (
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500">КВЕД:</span>
                  <span className="text-zinc-200 font-mono">{company.kved}</span>
                  {company.kved_name && (
                    <span className="text-zinc-400 max-w-md truncate hidden md:inline">
                      ({company.kved_name})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Додаткові реквізити */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 text-xs text-zinc-400">
              {company.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="truncate" title={company.address}>
                    {company.address}
                  </span>
                </div>
              )}

              {company.opf_name && (
                <div className="flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="truncate">{company.opf_name}</span>
                </div>
              )}

              {company.employees !== undefined && company.employees !== null && (
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>Працівників: <strong className="text-white font-mono">{company.employees}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Дії зі звітом (Кнопки) */}
          <div className="flex flex-wrap lg:flex-col gap-2 shrink-0 no-print">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs transition-colors"
              title="Скопіювати пряме посилання"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопійовано' : 'Копіювати посилання'}</span>
            </button>

            {onExportCsv && (
              <button
                onClick={onExportCsv}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs transition-colors"
                title="Завантажити поточний звіт у CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Експорт CSV</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs transition-colors"
              title="Друк форми на А4"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Друк / PDF</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
