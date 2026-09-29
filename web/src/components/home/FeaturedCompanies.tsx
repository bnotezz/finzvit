import React, { useState, useEffect } from 'react';
import { ArrowRight, Shuffle, Building2 } from 'lucide-react';
import featuredCompaniesData from '../../data/featured-companies.json';

export interface FeaturedCompany {
  edrpou: string;
  name: string;
  shortName: string;
  industry: string;
  badge: string;
  metric: string;
  description: string;
}

const ALL_COMPANIES: FeaturedCompany[] = featuredCompaniesData as FeaturedCompany[];

const pickRandom = (items: FeaturedCompany[], count: number = 3): FeaturedCompany[] => {
  const shuffled = [...items].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export const FeaturedCompanies: React.FC = () => {
  // На сервері/першому рендері беремо перші 3, щоб не було розриву розмітки
  const [companies, setCompanies] = useState<FeaturedCompany[]>(() => ALL_COMPANIES.slice(0, 3));
  const [isClient, setIsClient] = useState(false);

  // На клієнті обираємо 3 випадкові компанії з пулу
  useEffect(() => {
    setIsClient(true);
    setCompanies(pickRandom(ALL_COMPANIES, 3));
  }, []);

  const handleShuffle = () => {
    // Гарантуємо новий випадковий набір при натисканні кнопки
    setCompanies(pickRandom(ALL_COMPANIES, 3));
  };

  return (
    <div className="w-full pt-4 space-y-3">
      {/* Шапка блоку з можливістю оновити випадкові компанії */}
      <div className="flex items-center justify-between text-xs text-zinc-400 font-mono px-1">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-zinc-500">Приклади підприємств:</span>
          <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
            3 з {ALL_COMPANIES.length}
          </span>
        </div>

        {isClient && (
          <button
            type="button"
            onClick={handleShuffle}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-[11px] transition-all cursor-pointer active:scale-95"
            title="Показати інші випадкові компанії"
          >
            <Shuffle className="w-3 h-3 text-accent" />
            <span>Інші компанії</span>
          </button>
        )}
      </div>

      {/* Сітка 3 карток компаній */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {companies.map((c) => (
          <a
            key={c.edrpou}
            href={`/company/${c.edrpou}`}
            className="p-4 sm:p-5 rounded-2xl border transition-all duration-300 text-left flex flex-col justify-between group relative overflow-hidden backdrop-blur-xl bg-zinc-950/60 border-white/5 hover:border-accent/40 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-accent/5 animate-in fade-in duration-200"
          >
            {/* Тонке фонове підсвічування при наведенні */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-xl pointer-events-none group-hover:bg-accent/15 transition-all"></div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                  {c.badge}
                </span>
                <span className="font-mono text-xs text-zinc-400 group-hover:text-white transition-colors">
                  {c.edrpou}
                </span>
              </div>

              <div>
                <div className="font-bold text-white text-base group-hover:text-accent transition-colors flex items-baseline gap-1.5">
                  <span>{c.shortName}</span>
                </div>
                <div className="text-xs text-zinc-300 truncate mt-0.5 font-medium">
                  {c.name}
                </div>
                <div className="text-[11px] text-zinc-500 line-clamp-2 mt-1 leading-normal">
                  {c.industry}
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="font-mono text-zinc-400 text-[11px]">{c.metric}</span>
              <div className="flex items-center gap-1 text-zinc-500 group-hover:text-accent text-[11px] font-mono transition-colors">
                <span className="hidden group-hover:inline">Звітність</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
