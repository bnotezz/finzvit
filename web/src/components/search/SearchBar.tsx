import React, { useState, useEffect, useRef } from 'react';
import { Search, Clipboard, X, Building2, ArrowRight, Loader2, CheckCircle2, CornerDownLeft } from 'lucide-react';
import { searchCompanies } from '../../lib/api';
import type { CompanySearchResult } from '../../lib/types';

interface SearchBarProps {
  initialValue?: string;
  autoFocus?: boolean;
  size?: 'large' | 'compact';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  initialValue = '',
  autoFocus = false,
  size = 'large',
}) => {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced автокомпліт
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchCompanies(trimmed, 6);
        setResults(data);
        setIsOpen(data.length > 0);
      } catch (e) {
        console.error('Помилка автокомпліту:', e);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  // Закриття випадаючого списку при кліку поза полем
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const clean = text.trim().replace(/\D/g, '').slice(0, 10);
      if (clean) {
        setQuery(clean);
        goToCompany(clean);
      }
    } catch (err) {
      console.warn('Немає доступу до буфера обміну:', err);
    }
  };

  const goToCompany = (edrpou: string) => {
    const cleanEdrpou = edrpou.trim();
    if (cleanEdrpou) {
      window.location.href = `/company/${cleanEdrpou}`;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && results[selectedIndex]) {
      goToCompany(results[selectedIndex].edrpou);
      return;
    }
    const trimmed = query.trim();
    if (trimmed) {
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (digitsOnly.length >= 8) {
        goToCompany(digitsOnly);
      } else if (results.length > 0) {
        goToCompany(results[0].edrpou);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const cleanDigits = query.trim().replace(/\D/g, '');
  const isDigitsMode = /^\d+$/.test(query.trim()) && query.trim().length > 0;
  const isFullValidEdrpou = cleanDigits.length === 8 || cleanDigits.length === 10;

  return (
    <div ref={wrapperRef} className="relative w-full max-w-3xl mx-auto">
      {/* Світлове обрамлення навколо терміналу */}
      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-indigo-500/20 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-1000"></div>

      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`flex items-center rounded-2xl bg-zinc-950/80 backdrop-blur-2xl border transition-all duration-300 shadow-2xl ${
            isOpen
              ? 'border-accent/60 ring-2 ring-accent/20'
              : 'border-white/10 hover:border-white/20'
          } ${size === 'large' ? 'h-16 px-4' : 'h-13 px-3'}`}
        >
          {/* Індикатор пошуку */}
          <div className="w-10 h-10 rounded-xl bg-zinc-900/90 border border-white/5 flex items-center justify-center shrink-0 mr-3 text-accent shadow-inner">
            <Search className="w-5 h-5" />
          </div>

          {/* Текстове поле */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            autoFocus={autoFocus}
            placeholder="Введіть код ЄДРПОУ (8 цифр) або назву підприємства..."
            className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none text-base sm:text-lg font-normal tracking-wide"
          />

          {/* Кнопка очищення */}
          {query && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors shrink-0 mx-1"
              title="Очистити поле"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Лоадер */}
          {isLoading && (
            <div className="mx-2 shrink-0">
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
            </div>
          )}

          {/* Кнопка швидкої вставки */}
          {!query && (
            <button
              type="button"
              onClick={handlePaste}
              className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 hover:text-accent bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 hover:border-accent/40 rounded-xl px-3 py-2 shrink-0 transition-all ml-2"
              title="Вставити ЄДРПОУ з буфера"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Вставити</span>
            </button>
          )}

          {/* Кнопка Знайти */}
          <button
            type="submit"
            disabled={!query.trim()}
            className="ml-2 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-zinc-950 font-semibold rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-25 disabled:pointer-events-none shrink-0"
          >
            <span>Знайти</span>
            <CornerDownLeft className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>

        {/* Інтерактивний індикатор цифр ЄДРПОУ (коли вводяться цифри) */}
        {isDigitsMode && (
          <div className="absolute -bottom-8 left-2 flex items-center gap-2 text-xs font-mono animate-in fade-in duration-200">
            <div className="flex items-center gap-1">
              {Array.from({ length: 8 }).map((_, idx) => {
                const isFilled = idx < cleanDigits.length;
                return (
                  <div
                    key={idx}
                    className={`w-5 h-6 rounded flex items-center justify-center text-[11px] font-bold border transition-all ${
                      isFilled
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                    }`}
                  >
                    {isFilled ? cleanDigits[idx] : '•'}
                  </div>
                );
              })}
            </div>
            {isFullValidEdrpou ? (
              <span className="text-emerald-400 flex items-center gap-1 ml-1 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Готово до пошуку
              </span>
            ) : (
              <span className="text-zinc-500 text-[11px]">
                {cleanDigits.length}/8 цифр
              </span>
            )}
          </div>
        )}
      </form>

      {/* Випадаючий список підказок */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-zinc-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 divide-y divide-zinc-800/50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-2 text-[11px] font-mono text-zinc-500 uppercase tracking-wider bg-zinc-900/40 flex items-center justify-between">
            <span>Знайдені підприємства</span>
            <span>Стрілки ↑↓ для вибору · Enter</span>
          </div>
          {results.map((company, idx) => (
            <button
              key={company.edrpou}
              onClick={() => goToCompany(company.edrpou)}
              className={`w-full text-left px-4 py-3.5 flex items-start justify-between gap-4 transition-all ${
                idx === selectedIndex
                  ? 'bg-zinc-800/80 text-white'
                  : 'hover:bg-zinc-900 text-zinc-200'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-accent shrink-0 mt-0.5 shadow-sm">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-white truncate">{company.name}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                    <span className="text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                      ЄДРПОУ {company.edrpou}
                    </span>
                    {company.kved && (
                      <span className="text-zinc-400">
                        КВЕД {company.kved}
                        {company.kved_name ? ` · ${company.kved_name}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-500 self-center shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
