import math
from typing import Dict, Any, Optional

class FinancialCalculator:
    """
    Калькулятор основних фінансових показників та коефіцієнтів
    на основі стандартних форм фінансової звітності (Ф1, Ф2, Ф3).
    Повністю відповідає формулам та логіці KpiCards.tsx веб-інтерфейсу.
    """

    @classmethod
    def calculate_company_kpis(cls, unified_company_data: Dict[str, Any]) -> Dict[str, Any]:
        reports = unified_company_data.get("reports", {})
        
        # 1. Дані Балансу (Ф1 або мікро-форми)
        rep_b = reports.get("S0100115", {})
        b_data = rep_b.get("data", rep_b) if isinstance(rep_b, dict) else {}
        if not b_data:
            # Шукаємо комбіновані форми малих підприємств
            for micro_code in ["S0110014", "S0110013", "S0111007", "S0111006"]:
                m_rep = reports.get(micro_code, {})
                m_data = m_rep.get("data", m_rep) if isinstance(m_rep, dict) else {}
                if isinstance(m_data, dict) and "balance" in m_data:
                    b_data = m_data["balance"]
                    break

        # 2. Дані Звіту про фінрезультати (Ф2 або мікро-форми)
        rep_i = reports.get("S0100215", {})
        i_data = rep_i.get("data", rep_i) if isinstance(rep_i, dict) else {}
        if not i_data:
            for micro_code in ["S0110014", "S0110013", "S0111007", "S0111006"]:
                m_rep = reports.get(micro_code, {})
                m_data = m_rep.get("data", m_rep) if isinstance(m_rep, dict) else {}
                if isinstance(m_data, dict) and "income" in m_data:
                    i_data = m_data["income"]
                    break

        # Рядки Балансу (Ф1)
        r1095 = cls._safe_num(b_data.get("1095", {}).get("end"))       # Необоротні активи (кінець)
        r1100 = cls._safe_num(b_data.get("1100", {}).get("end"))       # Запаси (кінець)
        r1160 = cls._safe_num(b_data.get("1160", {}).get("end")) or 0  # Поточні фінансові інвестиції
        r1165_end = cls._safe_num(b_data.get("1165", {}).get("end"))   # Гроші та еквіваленти (кінець)
        r1165_beg = cls._safe_num(b_data.get("1165", {}).get("begin")) # Гроші та еквіваленти (початок)
        r1195 = cls._safe_num(b_data.get("1195", {}).get("end"))       # Оборотні активи (кінець)
        r1300_end = cls._safe_num(b_data.get("1300", {}).get("end"))   # Баланс (Активи, кінець)
        r1300_beg = cls._safe_num(b_data.get("1300", {}).get("begin")) # Баланс (Активи, початок)
        r1495_end = cls._safe_num(b_data.get("1495", {}).get("end"))   # Власний капітал (кінець)
        r1495_beg = cls._safe_num(b_data.get("1495", {}).get("begin")) # Власний капітал (початок)
        r1595_end = cls._safe_num(b_data.get("1595", {}).get("end"))   # Довгострокові зобов'язання (кінець)
        r1595_beg = cls._safe_num(b_data.get("1595", {}).get("begin")) # Довгострокові зобов'язання (початок)
        r1695_end = cls._safe_num(b_data.get("1695", {}).get("end"))   # Поточні зобов'язання (кінець)
        r1695_beg = cls._safe_num(b_data.get("1695", {}).get("begin")) # Поточні зобов'язання (початок)
        r1900 = cls._safe_num(b_data.get("1900", {}).get("end"))       # Баланс (Пасиви, кінець)

        # Рядки Фінрезультатів (Ф2)
        revenue_row = i_data.get("2000", {})
        revenue_cur = cls._safe_num(revenue_row.get("current"))
        revenue_prev = cls._safe_num(revenue_row.get("previous"))

        profit_row = i_data.get("2350", {})
        loss_row = i_data.get("2355", {})

        p_cur = cls._safe_num(profit_row.get("current"))
        p_prev = cls._safe_num(profit_row.get("previous"))
        l_cur = cls._safe_num(loss_row.get("current"))
        l_prev = cls._safe_num(loss_row.get("previous"))

        net_income_cur = cls.calculate_net_income(p_cur, l_cur)
        net_income_prev = cls.calculate_net_income(p_prev, l_prev)

        # Розрахунок 7 ключових фінансових показників (у тис. ₴)
        main_metrics = {
            "revenue": {
                "title": "Чистий дохід (Виручка)",
                "row_code": "2000",
                "current": revenue_cur,
                "previous": revenue_prev,
                "change_pct": cls.calculate_change_pct(revenue_prev, revenue_cur),
            },
            "net_income": {
                "title": "Чистий прибуток / збиток",
                "row_code": "2350/2355",
                "current": net_income_cur,
                "previous": net_income_prev,
                "change_pct": cls.calculate_change_pct(net_income_prev, net_income_cur),
            },
            "assets": {
                "title": "Активи (Баланс)",
                "row_code": "1300",
                "current": r1300_end,
                "previous": r1300_beg,
                "change_pct": cls.calculate_change_pct(r1300_beg, r1300_end),
            },
            "equity": {
                "title": "Власний капітал",
                "row_code": "1495",
                "current": r1495_end,
                "previous": r1495_beg,
                "change_pct": cls.calculate_change_pct(r1495_beg, r1495_end),
            },
            "cash": {
                "title": "Гроші та їх еквіваленти",
                "row_code": "1165",
                "current": r1165_end,
                "previous": r1165_beg,
                "change_pct": cls.calculate_change_pct(r1165_beg, r1165_end),
            },
            "lt_debt": {
                "title": "Довгострокові зобов’язання",
                "row_code": "1595",
                "current": r1595_end,
                "previous": r1595_beg,
                "change_pct": cls.calculate_change_pct(r1595_beg, r1595_end),
            },
            "st_debt": {
                "title": "Поточні зобов'язання",
                "row_code": "1695",
                "current": r1695_end,
                "previous": r1695_beg,
                "change_pct": cls.calculate_change_pct(r1695_beg, r1695_end),
            },
        }

        # Розрахунок 9 фінансових коефіцієнтів
        # Рядки Балансу додаткові (Ф1 / 1-м)
        r1010_end = cls._safe_num(b_data.get("1010", {}).get("end"))   # Основні засоби (залишкова)
        r1011_end = cls._safe_num(b_data.get("1011", {}).get("end"))   # Основні засоби (первісна)
        r1125_end = cls._safe_num(b_data.get("1125", {}).get("end"))   # Дебіторська заборгованість за товари/послуги
        r1615_end = cls._safe_num(b_data.get("1615", {}).get("end"))   # Поточна кредиторська заборгованість за товари/послуги

        # Рядки Фінрезультатів додаткові (Ф2 / 2-м)
        r2050_cur = cls._safe_num(i_data.get("2050", {}).get("current")) # Собівартість реалізації
        r2090_cur = cls._safe_num(i_data.get("2090", {}).get("current")) # Валовий прибуток
        r2150_cur = cls._safe_num(i_data.get("2150", {}).get("current")) # Витрати на збут
        gross_profit = r2090_cur if r2090_cur is not None else ((revenue_cur - r2050_cur) if (revenue_cur is not None and r2050_cur is not None) else None)

        # Чисельність персоналу (з метаданих підприємства або company dict)
        employees = cls._safe_num(unified_company_data.get("employees")) or cls._safe_num(unified_company_data.get("company", {}).get("employees"))

        # Розрахунок коефіцієнтів
        # 1. Поточна ліквідність: 1195 / 1695
        current_ratio = (r1195 / r1695_end) if (r1195 is not None and r1695_end and r1695_end > 0) else None

        # 2. Абсолютна ліквідність: (1160 + 1165) / 1695
        abs_ratio = ((r1160 + (r1165_end or 0)) / r1695_end) if (r1695_end and r1695_end > 0) else None

        # 3. Швидка ліквідність: (1195 - 1100) / 1695
        quick_ratio = ((r1195 - (r1100 or 0)) / r1695_end) if (r1195 is not None and r1695_end and r1695_end > 0) else None

        # 4. Коефіцієнт автономії: 1495 / 1900
        autonomy_ratio = (r1495_end / r1900) if (r1495_end is not None and r1900 and r1900 > 0) else None

        # 5. ROA: (рядок 2350/2355 / Баланс) * 100
        total_assets = r1900 if (r1900 is not None and r1900 > 0) else r1300_end
        roa = ((net_income_cur / total_assets) * 100) if (net_income_cur is not None and total_assets and total_assets > 0) else None

        # 6. ROE: (рядок 2350/2355 / рядок 1495) * 100
        roe = ((net_income_cur / r1495_end) * 100) if (net_income_cur is not None and r1495_end and r1495_end > 0) else None

        # 7. Чиста маржа: (рядок 2350/2355 / рядок 2000) * 100
        net_margin = ((net_income_cur / revenue_cur) * 100) if (net_income_cur is not None and revenue_cur and revenue_cur > 0) else None

        # 8. Покриття необоротних активів власним капіталом: 1495 / 1095
        cap_coverage = (r1495_end / r1095) if (r1495_end is not None and r1095 and r1095 > 0) else None

        # 9. Коефіцієнт заборгованості: 1695 / 1300
        debt_ratio = (r1695_end / r1300_end) if (r1695_end is not None and r1300_end and r1300_end > 0) else None

        # --- Нові показники Збалансованої системи показників (BSC Частина 1) ---
        # 10. Забезпеченість власними оборотними коштами: (1195 - 1695) / 1195
        working_capital_ratio = ((r1195 - r1695_end) / r1195) if (r1195 and r1195 > 0 and r1695_end is not None) else None

        # 11. Коефіцієнт придатності основних засобів: 1010 / 1011
        fixed_assets_condition = (r1010_end / r1011_end) if (r1010_end is not None and r1011_end and r1011_end > 0) else None

        # 12. Коефіцієнт маневреності власного капіталу: (1195 - 1695) / 1495
        equity_maneuverability = ((r1195 - r1695_end) / r1495_end) if (r1495_end and r1495_end > 0 and r1195 is not None and r1695_end is not None) else None

        # 13. Коефіцієнт фінансового левериджу: (1595 + 1695) / 1495
        financial_leverage = (((r1595_end or 0) + r1695_end) / r1495_end) if (r1495_end and r1495_end > 0 and r1695_end is not None) else None

        # 14. Валова рентабельність реалізації (Gross Margin): валовий прибуток / 2000 * 100%
        gross_margin = ((gross_profit / revenue_cur) * 100) if (gross_profit is not None and revenue_cur and revenue_cur > 0) else None

        # 15. Рентабельність виробництва (витрат): валовий прибуток / 2050 * 100%
        production_profitability = ((gross_profit / r2050_cur) * 100) if (gross_profit is not None and r2050_cur and r2050_cur > 0) else None

        # 16. Оборотність дебіторської заборгованості: 2000 / 1125
        receivables_turnover = (revenue_cur / r1125_end) if (revenue_cur and revenue_cur > 0 and r1125_end and r1125_end > 0) else None
        receivables_days = (365.0 / receivables_turnover) if (receivables_turnover and receivables_turnover > 0) else None

        # 17. Оборотність кредиторської заборгованості: 2000 / 1615
        cred_debt = r1615_end if (r1615_end and r1615_end > 0) else r1695_end
        payables_turnover = (revenue_cur / cred_debt) if (revenue_cur and revenue_cur > 0 and cred_debt and cred_debt > 0) else None
        payables_days = (365.0 / payables_turnover) if (payables_turnover and payables_turnover > 0) else None

        # 18. Фондовіддача: 2000 / 1010
        fixed_asset_turnover = (revenue_cur / r1010_end) if (revenue_cur and revenue_cur > 0 and r1010_end and r1010_end > 0) else None

        # 19. Покриття виробничих витрат (частка собівартості): 2050 / 2000 * 100%
        cost_coverage = ((r2050_cur / revenue_cur) * 100) if (revenue_cur and revenue_cur > 0 and r2050_cur is not None) else None

        # 20. Продуктивність праці (виручка на 1 працівника)
        revenue_per_employee = (revenue_cur / employees) if (employees and employees > 0 and revenue_cur is not None) else None

        # 21. Прибутковість персоналу (чистий прибуток на 1 працівника)
        profit_per_employee = (net_income_cur / employees) if (employees and employees > 0 and net_income_cur is not None) else None

        # 22. Частка витрат на збут у виручці: 2150 / 2000 * 100%
        sales_expenses_ratio = ((r2150_cur / revenue_cur) * 100) if (revenue_cur and revenue_cur > 0 and r2150_cur is not None) else None

        # 23. Частка запасів у виручці: 1100 / 2000 * 100%
        inventory_to_revenue = ((r1100 / revenue_cur) * 100) if (revenue_cur and revenue_cur > 0 and r1100 is not None) else None

        ratios = {
            # --- 1. Ліквідність ---
            "current_ratio": {
                "name": "Коефіцієнт поточної ліквідності",
                "intl_name": "Current Ratio",
                "category": "Ліквідність",
                "formula": "рядок 1195 / рядок 1695",
                "value": current_ratio,
                "benchmark": "Норма > 1.0 — 2.0",
            },
            "absolute_ratio": {
                "name": "Коефіцієнт абсолютної ліквідності",
                "intl_name": "Cash Ratio",
                "category": "Ліквідність",
                "formula": "(рядок 1160 + 1165) / рядок 1695",
                "value": abs_ratio,
                "benchmark": "Норма > 0.2",
            },
            "quick_ratio": {
                "name": "Коефіцієнт швидкої ліквідності",
                "intl_name": "Quick Ratio",
                "category": "Ліквідність",
                "formula": "(рядок 1195 - 1100) / рядок 1695",
                "value": quick_ratio,
                "benchmark": "Норма > 0.7 — 1.0",
            },
            "working_capital_ratio": {
                "name": "Частка власних оборотних активів",
                "intl_name": "Working Capital Ratio",
                "category": "Ліквідність",
                "formula": "(рядок 1195 - рядок 1695) / рядок 1195",
                "value": working_capital_ratio,
                "benchmark": "Норма > 0.10 — 0.20 (збільшення)",
            },

            # --- 2. Фінансова стійкість та леверидж ---
            "autonomy_ratio": {
                "name": "Коефіцієнт автономії",
                "intl_name": "Equity Ratio",
                "category": "Фінансова стійкість",
                "formula": "рядок 1495 / рядок 1900",
                "value": autonomy_ratio,
                "benchmark": "Норма > 0.5 (оптимально > 0.35)",
            },
            "financial_leverage": {
                "name": "Коефіцієнт фінансового левериджу",
                "intl_name": "Debt to Equity (D/E)",
                "category": "Фінансова стійкість",
                "formula": "(рядок 1595 + рядок 1695) / рядок 1495",
                "value": financial_leverage,
                "benchmark": "Норма < 1.0 (оптимально 0.5 — 0.8)",
            },
            "equity_maneuverability": {
                "name": "Коефіцієнт маневреності власного капіталу",
                "intl_name": "Equity Maneuverability",
                "category": "Фінансова стійкість",
                "formula": "(рядок 1195 - рядок 1695) / рядок 1495",
                "value": equity_maneuverability,
                "benchmark": "Норма > 0.10 — 0.50",
            },
            "fixed_assets_condition": {
                "name": "Коефіцієнт придатності основних засобів",
                "intl_name": "Fixed Assets Condition",
                "category": "Фінансова стійкість",
                "formula": "рядок 1010 / рядок 1011",
                "value": fixed_assets_condition,
                "benchmark": "Норма > 0.50 (збільшення)",
            },
            "cap_coverage": {
                "name": "Покриття необоротних активів власним капіталом",
                "intl_name": "Capital Coverage Ratio",
                "category": "Фінансова стійкість",
                "formula": "рядок 1495 / рядок 1095",
                "value": cap_coverage,
                "benchmark": "Норма > 1.0",
            },
            "debt_ratio": {
                "name": "Коефіцієнт заборгованості",
                "intl_name": "Debt to Assets Ratio",
                "category": "Фінансова стійкість",
                "formula": "рядок 1695 / рядок 1300",
                "value": debt_ratio,
                "benchmark": "Норма < 0.5 — 0.7",
            },

            # --- 3. Ділова активність та оборотність ---
            "receivables_turnover": {
                "name": "Оборотність дебіторської заборгованості",
                "intl_name": "Receivables Turnover",
                "category": "Ділова активність",
                "formula": "рядок 2000 / рядок 1125",
                "value": receivables_turnover,
                "benchmark": "Оборотів за рік (зростання)",
            },
            "receivables_days": {
                "name": "Тривалість погашення дебіторської заборгованості",
                "intl_name": "Days Sales Outstanding (DSO)",
                "category": "Ділова активність",
                "formula": "365 / оборотність дебіторки",
                "value": receivables_days,
                "benchmark": "Днів (зменшення)",
            },
            "payables_turnover": {
                "name": "Оборотність кредиторської заборгованості",
                "intl_name": "Payables Turnover",
                "category": "Ділова активність",
                "formula": "рядок 2000 / рядок 1615",
                "value": payables_turnover,
                "benchmark": "Оборотів за рік",
            },
            "payables_days": {
                "name": "Тривалість обороту кредиторської заборгованості",
                "intl_name": "Days Payable Outstanding (DPO)",
                "category": "Ділова активність",
                "formula": "365 / оборотність кредиторки",
                "value": payables_days,
                "benchmark": "Днів",
            },
            "fixed_asset_turnover": {
                "name": "Фондовіддача",
                "intl_name": "Fixed Asset Turnover",
                "category": "Ділова активність",
                "formula": "рядок 2000 / рядок 1010",
                "value": fixed_asset_turnover,
                "benchmark": "Збільшення (₴ виручки / ₴ ОЗ)",
            },
            "inventory_to_revenue": {
                "name": "Частка запасів у виручці",
                "intl_name": "Inventory to Revenue",
                "category": "Ділова активність",
                "formula": "(рядок 1100 / рядок 2000) × 100%",
                "value": inventory_to_revenue,
                "benchmark": "Зменшення (оптимізація запасів)",
            },

            # --- 4. Рентабельність та маржинальність ---
            "gross_margin": {
                "name": "Валова рентабельність реалізації (Gross Margin)",
                "intl_name": "Gross Profit Margin",
                "category": "Рентабельність",
                "formula": "(рядок 2000 - рядок 2050) / рядок 2000 × 100%",
                "value": gross_margin,
                "benchmark": "Норма > 20-30% (зростання)",
            },
            "net_margin": {
                "name": "Чиста маржа (Net Margin)",
                "intl_name": "Net Profit Margin",
                "category": "Рентабельність",
                "formula": "(рядок 2350/2355 / рядок 2000) × 100%",
                "value": net_margin,
                "benchmark": "> 5-10%",
            },
            "roa": {
                "name": "Рентабельність активів (ROA)",
                "intl_name": "Return on Assets",
                "category": "Рентабельність",
                "formula": "(рядок 2350/2355 / рядок 1900) × 100%",
                "value": roa,
                "benchmark": "> 5% (вище середнього)",
            },
            "roe": {
                "name": "Рентабельність власного капіталу (ROE)",
                "intl_name": "Return on Equity",
                "category": "Рентабельність",
                "formula": "(рядок 2350/2355 / рядок 1495) × 100%",
                "value": roe,
                "benchmark": "> 15% (ефективне використання капіталу)",
            },
            "production_profitability": {
                "name": "Рентабельність виробництва (витрат)",
                "intl_name": "Cost Profitability",
                "category": "Рентабельність",
                "formula": "валовий прибуток / собівартість (рядок 2050) × 100%",
                "value": production_profitability,
                "benchmark": "Зростання",
            },

            # --- 5. Ефективність витрат та маркетинг ---
            "cost_coverage": {
                "name": "Коефіцієнт покриття виробничих витрат",
                "intl_name": "Cost to Revenue Ratio",
                "category": "Витрати та маркетинг",
                "formula": "(рядок 2050 / рядок 2000) × 100%",
                "value": cost_coverage,
                "benchmark": "Зменшення (оптимально < 70-80%)",
            },
            "sales_expenses_ratio": {
                "name": "Частка витрат на збут у виручці",
                "intl_name": "Selling Expenses to Revenue",
                "category": "Витрати та маркетинг",
                "formula": "(рядок 2150 / рядок 2000) × 100%",
                "value": sales_expenses_ratio,
                "benchmark": "Показник комерційних зусиль",
            },

            # --- 6. Ефективність персоналу ---
            "revenue_per_employee": {
                "name": "Продуктивність праці",
                "intl_name": "Revenue per Employee",
                "category": "Персонал",
                "formula": "рядок 2000 / чисельність працівників",
                "value": revenue_per_employee,
                "benchmark": "тис. ₴ / працівника (зростання)",
            },
            "profit_per_employee": {
                "name": "Прибутковість персоналу",
                "intl_name": "Profit per Employee",
                "category": "Персонал",
                "formula": "чистий прибуток / чисельність працівників",
                "value": profit_per_employee,
                "benchmark": "тис. ₴ / працівника (збільшення)",
            },
        }

        return {
            "edrpou": unified_company_data.get("edrpou"),
            "name": unified_company_data.get("name"),
            "main_metrics": main_metrics,
            "ratios": ratios,
        }

    @classmethod
    def calculate_net_income(cls, profit_val: Optional[float], loss_val: Optional[float]) -> Optional[float]:
        """
        Розраховує чистий фінансовий результат (прибуток / збиток).
        Формула: рядок 2350 (прибуток) - рядок 2355 (збиток).
        Якщо в 2355 вже міститься від'ємне число, воно додається: 2350 + 2355.
        Якщо був збиток, поле 2350 порожнє/None, а значення міститься в 2355 (результат < 0).
        """
        if profit_val is None and loss_val is None:
            return None

        p = profit_val if profit_val is not None else 0.0

        if loss_val is not None:
            l_effect = loss_val if loss_val < 0 else -loss_val
        else:
            l_effect = 0.0

        if profit_val is None and loss_val is not None:
            return l_effect
        if profit_val is not None and loss_val is None:
            return p

        return p + l_effect

    @staticmethod
    def calculate_change_pct(previous: Optional[float], current: Optional[float]) -> Optional[float]:
        """
        Розраховує відсоток зміни між попереднім та поточним періодом.
        Повністю узгоджується з calculateChange() у formatters.ts.
        """
        if previous is None or current is None:
            return None
        if previous == 0:
            return 100.0 if current > 0 else (-100.0 if current < 0 else 0.0)
        return ((current - previous) / abs(previous)) * 100.0

    @staticmethod
    def _safe_num(val: Any) -> Optional[float]:
        if val is None:
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None
