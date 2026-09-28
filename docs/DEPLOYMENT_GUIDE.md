# 🚀 Посібник із повного розгортання FinZvit (Deployment Guide)

> **Покрокова інструкція з налаштування та розгортання проєкту FinZvit з нуля.**
> Архітектура FinZvit спроектована за принципом **Zero-Cost**: система повноцінно обслуговує 435 000+ підприємств України, вкладаючись на 100% у **безкоштовні ліміти (Free Tier)** сервісів Supabase, Cloudflare R2, Cloudflare Workers та GitHub.

---

## 📑 Зміст

1. [💎 Архітектура та Безкоштовні ліміти (Free Tier)](#1--архітектура-та-безкоштовні-ліміти-free-tier)
2. [💻 Системні вимоги (Prerequisites)](#2--системні-вимоги-prerequisites)
3. [🐙 Крок 1: Підготовка репозиторію на GitHub](#3--крок-1-підготовка-репозиторію-на-github)
4. [🗄️ Крок 2: Налаштування бази даних Supabase](#4--крок-2-налаштування-бази-даних-supabase)
5. [☁️ Крок 3: Налаштування сховища Cloudflare R2](#5--крок-3-налаштування-сховища-cloudflare-r2)
6. [⚡ Крок 4: Налаштування та деплой вебу (Cloudflare Workers)](#6--крок-4-налаштування-та-деплой-вебу-cloudflare-workers)
7. [🐍 Крок 5: Запуск пайплайну обробки даних (Python Data Worker)](#7--крок-5-запуск-пайплайну-обробки-даних-python-data-worker)
8. [🛡️ Крок 6: Перевірка працездатності та QA (Zero-Defect Protocol)](#8--крок-6-перевірка-працездатності-та-qa-zero-defect-protocol)
9. [❓ Часті запитання та діагностика (FAQ & Troubleshooting)](#9--часті-запитання-та-діагностика-faq--troubleshooting)

---

## 1. 💎 Архітектура та Безкоштовні ліміти (Free Tier)

| Сервіс | Безкоштовний ліміт (Free Tier) | Використання у FinZvit | Чому ми не перевищуємо ліміт? |
|---|---|---|---|
| **Supabase (PostgreSQL)** | **500 МБ** диску, 50k MAU | **~40 МБ** на 435k компаній (~8% ліміту) | У БД зберігається лише легкий індекс (`edrpou`, `name`, `kved`, `year`). Важкі форми винесені в R2. |
| **Cloudflare R2** | **10 ГБ** сховища, 1 млн Class A (запис), 10 млн Class B (читання) | **~800 МБ** на 1 рік; 435k операцій запису | Gzip pre-compression (-82% розміру) + 1 об'єднаний JSON на компанію замість 6 файлів. |
| **Cloudflare Workers** | **100 000** запитів/день, 10 мс CPU | < 2 мс CPU на запит | Zero-CPU стрімінг gzip-байтів безпосередньо з R2 до браузера без розпакування на воркері. |
| **Cloudflare CDN** | Безлімітний трафік, 0$ Egress | Кешування `immutable` на 1 рік | Повторні запити обслуговуються з edge-кешу CDN, минаючи воркер та R2. |
| **GitHub** | 2 000 хв дій/міс, 1 ГБ репозиторій | < 100 МБ репо, тести проходять за 1 секунду | Великі ZIP/XML не комітяться у Git; тести ізольовані. |

---

## 2. 💻 Системні вимоги (Prerequisites)

Перед початком переконайтеся, що на вашому комп'ютері або сервері встановлено:
- **Node.js**: версія `20.x` або вище (`node -v`)
- **Python**: версія `3.11` або вище (`python3 --version`)
- **Git**: (`git --version`)
- **Акаунти** (усі безкоштовні):
  1. [GitHub](https://github.com)
  2. [Supabase](https://supabase.com)
  3. [Cloudflare](https://dash.cloudflare.com)

---

## 3. 🐙 Крок 1: Підготовка репозиторію на GitHub

### 3.1. Клонування репозиторію
```bash
git clone https://github.com/your-username/finzvit.git
cd finzvit
```

### 3.2. Перевірка `.gitignore`
Переконайтеся, що гігабайтні архіви та тимчасові файли не потраплять у Git:
```text
# Дані та тимчасові файли
output/
dist/
node_modules/
.env.local
web/.env.local
*.zip
*.xml
```

---

## 4. 🗄️ Крок 2: Налаштування бази даних Supabase

Supabase використовується виключно як високошвидкісний пошуковий рушій (триграмний пошук за 5–15 мс).

### 4.1. Створення проєкту
1. Увійдіть у [Supabase Dashboard](https://supabase.com/dashboard).
2. Натисніть **New Project**.
3. Задайте:
   - **Name**: `finzvit`
   - **Database Password**: згенеруйте надійний пароль (збережіть його).
   - **Region**: оберіть найближчий до України регіон (наприклад, `Frankfurt (eu-central-1)`).
   - **Pricing Plan**: `Free Plan`.
4. Зачекайте 1–2 хвилини до завершення створення проєкту.

### 4.2. Застосування схеми бази даних
1. Перейдіть у розділ **SQL Editor** (іконка терміналу `>_` в лівому меню).
2. Натисніть **New query**.
3. Скопіюйте вміст файлу [`docs/SUPABASE_SCHEMA.sql`](file:///Users/denys/dev/experiments/finzvit/docs/SUPABASE_SCHEMA.sql) або останньої міграції з `supabase/migrations/`.
4. Вставте SQL у вікно редактора та натисніть **Run** (Ctrl+Enter / Cmd+Enter).
5. Виконаний скрипт автоматично:
   - Увімкне розширення `pg_trgm` (PostgreSQL Trigram Extension).
   - Створить таблицю `public.companies` з оптимізованими полями (`edrpou`, `name`, `kved`, `year`).
   - Створить GIN індекс `idx_companies_name_trgm` для швидкого пошуку.
   - Створить безпечну RPC-функцію `public.search_companies(search_query, lim)`.
   - Налаштує RLS (Row Level Security) з публічним доступом на читання.

### 4.3. Отримання ключів Supabase
Перейдіть у **Project Settings** -> **API**:
1. **Project URL**: наприклад `https://xyzcompany.supabase.co`
2. **Project API Keys**:
   - `anon` / `publishable` (наприклад `sb_publishable_...` або `eyJ...`) — використовується для фронтенду.
   - `service_role` (секретний ключ!) — використовується Python воркером для пакетного запису компаній.

---

## 5. ☁️ Крок 3: Налаштування сховища Cloudflare R2

Cloudflare R2 зберігає готові попередньо стиснені gzip-файли звітів кожної компанії (`/{year}/{edrpou}.json`).

### 5.1. Створення R2 Бакету
1. Увійдіть у [Cloudflare Dashboard](https://dash.cloudflare.com).
2. У лівому меню відкрийте **Storage & Databases** -> **R2**.
3. Натисніть **Create bucket**.
4. Введіть назву бакету: **`finzvit-data`** (або свою, якщо зміните конфігурацію).
5. Залиште розташування за замовчуванням (**Automatic**) і натисніть **Create Bucket**.

### 5.2. Налаштування CORS для бакету
1. У створеному бакеті перейдіть на вкладку **Settings**.
2. Прокрутіть до блоку **CORS Policy** та натисніть **Add CORS Policy**.
3. Вставте наступну конфігурацію:
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Encoding", "Content-Type"],
    "MaxAgeSeconds": 86400
  }
]
```
4. Збережіть зміни.

### 5.3. Генерація API токенів R2 (S3 Credentials)
1. Поверніться на сторінку огляду **R2** (ліве меню -> **R2**).
2. Праворуч натисніть **Manage R2 API Tokens**.
3. Натисніть **Create API token**:
   - **Token name**: `finzvit-uploader`
   - **Permissions**: **Object Read & Write** (потрібно для завантаження файлів)
   - **Apply to**: Specific bucket -> `finzvit-data` (або All buckets)
   - **TTL**: за бажанням (Forever або 1 рік)
4. Натисніть **Create API Token**.
5. **ОБОВ'ЯЗКОВО збережіть отримані значення** (вони показуються лише раз!):
   - **Account ID** (видно праворуч на сторінці R2)
   - **Access Key ID**
   - **Secret Access Key**
   - **Endpoint**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

---

## 6. ⚡ Крок 4: Налаштування та деплой вебу (Cloudflare Workers)

Веб-частина побудована на Astro 7 + React 19 та розгортається у Cloudflare Workers з автоматичним зв'язуванням з R2.

### 6.1. Встановлення залежностей вебу
```bash
cd web
npm install
```

### 6.2. Налаштування `web/.env.local`
Створіть файл `web/.env.local` на основі `web/.env.example`:
```bash
cp .env.example .env.local
```
Відкрийте `web/.env.local` і вкажіть параметри вашого Supabase:
```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
PUBLIC_R2_URL=/data
```

### 6.3. Перевірка `web/wrangler.jsonc`
Переконайтеся, що прив'язка R2 відповідає назві вашого бакету:
```jsonc
{
  "name": "finzvit",
  "main": "src/worker.ts",
  "compatibility_date": "2026-09-26",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": ["/data/*", "/company/*"],
    "not_found_handling": "404-page"
  },
  "r2_buckets": [
    {
      "binding": "R2_BUCKET",
      "bucket_name": "finzvit-data"
    }
  ]
}
```

### 6.4. Збірка та публікація у Cloudflare
```bash
# 1. Авторизація у Cloudflare (якщо ще не авторизовані)
npx wrangler login

# 2. Збірка фронтенду Astro
npm run build

# 3. Деплой воркера та статичних ассетів
npx wrangler deploy
```
Після завершення у терміналі з'явиться посилання на ваш робочий сайт (наприклад, `https://finzvit.<user>.workers.dev`).

---

## 7. 🐍 Крок 5: Запуск пайплайну обробки даних (Python Data Worker)

Data Worker парсить відкриті дані ДПС/Держстату, розраховує всі KPI, стискає JSON за допомогою gzip і паралельно завантажує їх у R2 та оновлює індекс Supabase.

### 7.1. Створення віртуального оточення Python
Поверніться у кореневу директорію проєкту:
```bash
cd ..
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 7.2. Налаштування `.env.local` для воркера
Створіть файл `.env.local` у корені проєкту:
```bash
cp .env.example .env.local
```
Заповніть його даними, отриманими на Кроках 2 та 3:
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=eyJhbGciOi... # Ваш service_role key

# Cloudflare R2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=finzvit-data

# Опційно: Cloudflare CDN Cache Purge
# CF_API_TOKEN=your_token
# CF_ZONE_ID=your_zone_id
```

### 7.3. Тестовий прогін на зразках (Dry Run & Sample Data)
У репозиторії є перевірений тестовий архів `sample/fin_zvit_2025_sample.zip` (компанії Кормотех та Нова Пошта):

```bash
# Тестове завантаження 2 компаній у R2 та Supabase
python3 worker/run_worker.py \
  --input sample/fin_zvit_2025_sample.zip \
  --year 2025 \
  --threads 10
```
Перевірте:
1. У вашому R2 з'явилися файли `2025/32673400.json` та `2025/31316718.json`.
2. У таблиці `companies` у Supabase з'явилося 2 записи.
3. На вашому сайті пошук за словом "Кормотех" чи ЄДРПОУ `32673400` знаходить картку компанії з усіма фінансовими звітами.

### 7.4. Завантаження повного реєстру України (data.gov.ua)
1. Перейдіть на офіційний портал відкритих даних:
   - [Набір даних фінансової звітності (Держстат / data.gov.ua)](https://data.gov.ua/dataset/7436ae83-dfc1-4836-9962-8af3e831c522)
   - Або [Ресурс річної звітності за 2025 рік](https://data.gov.ua/dataset/7436ae83-dfc1-4836-9962-8af3e831c522/resource/fe3f6731-8a79-463b-b3af-03811d7a0e26)
2. Завантажте річний ZIP-архів (розмір архіву становить ~850–950 МБ).

### 7.5. Запуск повного імпорту
```bash
python3 worker/run_worker.py \
  --input /шлях/до/завантаженого_архіву.zip \
  --year 2025 \
  --threads 50
```

> 💡 **Параметри команди `run_worker.py`**:
> - `--input` (`-i`): Шлях до ZIP-архіву або папки з розпакованими архівами.
> - `--year` (`-y`): Звітний рік (за замовчуванням `2025`).
> - `--threads` (`-t`): Кількість паралельних потоків для завантаження в R2 (рекомендовано `40`–`60`).
> - `--save-local`: Додатково зберігати копії звітів на локальний диск (за замовчуванням вимкнено для економії місця).
> - `--dry-run`: Протестувати повний парсинг без завантаження у хмару.
> - `--supabase-only`: Оновити тільки базу Supabase (якщо R2 вже завантажено).
> - `--skip-supabase`: Залити тільки R2 (пропустивши Supabase).

---

## 8. 🛡️ Крок 6: Перевірка працездатності та QA (Zero-Defect Protocol)

Проєкт підтримує автоматичну перевірку якості перед кожною зміною:
```bash
./scripts/qa.sh
```

Скрипт автоматично виконує:
1. **62 Python Unit Tests**:
   - Перевірка парсингу всіх форм (Ф1, Ф2, Ф3, Ф4, Ф5, Ф1-м, Ф2-м).
   - Бухгалтерські балансові рівності (Активи = Пасиви).
   - Формула розрахунку чистого фінрезультату (рядки 2350/2355).
   - Стійкість до битих даних (BOM, CP1251, null-байти, `xsi:nil`).
   - Перевірка R2 Gzip компресії та потоко-безпечності.
2. **Web Build & TypeCheck**:
   - Повна компіляція TypeScript, перевірка Astro-шаблонів та збірка Vite.

---

## 9. ❓ Часті запитання та діагностика (FAQ & Troubleshooting)

### П: Пошук повертає порожній результат, що перевірити?
1. Відкрийте Developer Console у браузері (F12) -> вкладку **Console**.
2. Якщо бачите помилку Supabase:
   - Перевірте правильність `PUBLIC_SUPABASE_URL` та `PUBLIC_SUPABASE_PUBLISHABLE_KEY` у `web/.env.local`.
   - Перевірте, чи виконано міграцію SQL для створення RPC функції `search_companies`:
     ```sql
     SELECT * FROM search_companies('Кормотех', 5);
     ```
   - Перевірте, чи в таблиці `companies` є записи:
     ```sql
     SELECT count(*) FROM companies;
     ```

### П: Сторінка компанії показує помилку "Дані не знайдено"?
1. Перевірте, чи завантажено файл `2025/<edrpou>.json` у ваш бакет R2 `finzvit-data`.
2. У `web/wrangler.jsonc` перевірте назву бакета:
   ```jsonc
   "r2_buckets": [{ "binding": "R2_BUCKET", "bucket_name": "finzvit-data" }]
   ```
3. Спробуйте виконати запит напряму до воркера:
   ```bash
   curl -I https://finzvit.<user>.workers.dev/data/2025/32673400.json
   ```

### П: Як оновити звітність за наступний рік (наприклад, 2026)?
Завантажте новий архів з data.gov.ua та запустіть воркер з параметром `--year 2026`:
```bash
python3 worker/run_worker.py --input fin_zvit_2026.zip --year 2026
```
Файли автоматично збережуться в R2 у префікс `2026/{edrpou}.json`, а індекс Supabase оновиться.

---

🎉 **Вітаємо! Ваш незалежний портал фінансової звітності FinZvit успішно розгорнуто!**
