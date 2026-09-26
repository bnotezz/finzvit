export interface AvailableForm {
  code: string;
  title: string;
  date_filled?: string;
  timestamp?: string;
}

export interface CompanyMeta {
  edrpou: string;
  name: string;
  kved?: string;
  kved_name?: string;
  address?: string;
  territory?: string;
  opf_code?: string;
  opf_name?: string;
  director?: string;
  accountant?: string;
  employees?: number;
  accounting_standard?: string;
  available_forms: AvailableForm[];
  last_updated?: string;
  year?: number;
}

export interface ReportData {
  meta: {
    form_code: string;
    form_name: string;
    filename?: string;
    timestamp?: string;
    period_year: number;
    period_month?: number;
    date_filled?: string;
    software?: string;
  };
  company: CompanyMeta;
  data: Record<string, any>;
}

export interface StatementRowDef {
  code: string | null;      // Код рядка (напр. '1000') або null для заголовка розділу
  name: string;             // Назва статті (напр. 'Нематеріальні активи')
  level: number;            // 0 = Розділ/секція, 1 = Основний рядок, 2 = Підстаття
  isTotal?: boolean;        // Чи рядок підсумковий (жирний шрифт)
  isDeduction?: boolean;    // Чи показник віднімається (знос, амортизація)
  section?: string;         // 'АКТИВ', 'ПАСИВ', тощо
}

export interface CompanySearchResult {
  edrpou: string;
  name: string;
  kved?: string;
  kved_name?: string;
  address?: string;
  available_forms?: AvailableForm[];
  similarity?: number;
}
