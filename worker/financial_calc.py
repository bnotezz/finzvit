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
            for micro_code in ["S0110014", "S0111007"]:
                m_rep = reports.get(micro_code, {})
                m_data = m_rep.get("data", m_rep) if isinstance(m_rep, dict) else {}
                if isinstance(m_data, dict) and "balance" in m_data:
                    b_data = m_data["balance"]
                    break

        # 2. Дані Звіту про фінрезультати (Ф2 або мікро-форми)
        rep_i = reports.get("S0100215", {})
        i_data = rep_i.get("data", rep_i) if isinstance(rep_i, dict) else {}
        if not i_data:
            for micro_code in ["S0110014", "S0111007"]:
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

        net_income_cur = None
        net_income_prev = None

        if profit_row and (profit_row.get("current") is not None or profit_row.get("previous") is not None):
            net_income_cur = cls._safe_num(profit_row.get("current"))
            net_income_prev = cls._safe_num(profit_row.get("previous"))
        elif loss_row and (loss_row.get("current") is not None or loss_row.get("previous") is not None):
            cur_loss = cls._safe_num(loss_row.get("current"))
            prev_loss = cls._safe_num(loss_row.get("previous"))
            net_income_cur = -cur_loss if cur_loss is not None else None
            net_income_prev = -prev_loss if prev_loss is not None else None

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
        # 1. Поточна ліквідність: 1195 / 1695
        current_ratio = (r1195 / r1695_end) if (r1195 is not None and r1695_end and r1695_end > 0) else None

        # 2. Абсолютна ліквідність: (1160 + 1165) / 1695
        abs_ratio = ((r1160 + (r1165_end or 0)) / r1695_end) if (r1695_end and r1695_end > 0) else None

        # 3. Швидка ліквідність: (1195 - 1100) / 1695
        quick_ratio = ((r1195 - (r1100 or 0)) / r1695_end) if (r1195 is not None and r1695_end and r1695_end > 0) else None

        # 4. Коефіцієнт автономії: 1495 / 1900
        autonomy_ratio = (r1495_end / r1900) if (r1495_end is not None and r1900 and r1900 > 0) else None

        # 5. ROA: (2350 / 1900) * 100
        roa = ((net_income_cur / r1900) * 100) if (net_income_cur is not None and r1900 and r1900 > 0) else None

        # 6. ROE: (2350 / 1495) * 100
        roe = ((net_income_cur / r1495_end) * 100) if (net_income_cur is not None and r1495_end and r1495_end > 0) else None

        # 7. Чиста маржа: (2350 / 2000) * 100
        net_margin = ((net_income_cur / revenue_cur) * 100) if (net_income_cur is not None and revenue_cur and revenue_cur > 0) else None

        # 8. Покриття необоротних активів власним капіталом: 1495 / 1095
        cap_coverage = (r1495_end / r1095) if (r1495_end is not None and r1095 and r1095 > 0) else None

        # 9. Коефіцієнт заборгованості: 1695 / 1300
        debt_ratio = (r1695_end / r1300_end) if (r1695_end is not None and r1300_end and r1300_end > 0) else None

        ratios = {
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
            "autonomy_ratio": {
                "name": "Коефіцієнт автономії",
                "intl_name": "Equity Ratio",
                "category": "Фінансова стійкість",
                "formula": "рядок 1495 / рядок 1900",
                "value": autonomy_ratio,
                "benchmark": "Норма > 0.5 (оптимально > 0.35)",
            },
            "roa": {
                "name": "Рентабельність активів (ROA)",
                "intl_name": "Return on Assets",
                "category": "Рентабельність",
                "formula": "(рядок 2350 / рядок 1900) × 100%",
                "value": roa,
                "benchmark": "> 5% (вище середнього)",
            },
            "roe": {
                "name": "Рентабельність власного капіталу (ROE)",
                "intl_name": "Return on Equity",
                "category": "Рентабельність",
                "formula": "(рядок 2350 / рядок 1495) × 100%",
                "value": roe,
                "benchmark": "> 15% (ефективне використання капіталу)",
            },
            "net_margin": {
                "name": "Чиста маржа (Net Margin)",
                "intl_name": "Net Profit Margin",
                "category": "Рентабельність",
                "formula": "(рядок 2350 / рядок 2000) × 100%",
                "value": net_margin,
                "benchmark": "> 5-10%",
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
        }

        return {
            "edrpou": unified_company_data.get("edrpou"),
            "name": unified_company_data.get("name"),
            "main_metrics": main_metrics,
            "ratios": ratios,
        }

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
