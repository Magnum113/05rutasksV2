export type PromoStatus = "draft" | "active" | "inactive" | "expired"
export type PromoDiscountType = "percent" | "fixed"
export type PromoChannel = "web" | "mobile_app" | "mobile_web"
export type PromoFirstOrderFilter = "all" | "yes" | "no"
export type PromoTitleRulesFilter = "all" | "yes" | "no"
export type CategoryScope = "with_children" | "self"

export interface PromoCategoryOption {
  id: string
  name: string
  level: number
  parent_id?: string
  coverage_with_children: number
}

export interface PromoCodeEntity {
  id: string
  status: PromoStatus
  name: string
  code: string
  start_date: string
  end_date: string
  discount_id: string
  discount_type: PromoDiscountType
  discount_value: number
  max_discount: number
  min_order_amount: number
  channels: PromoChannel[]
  counter: number | null
  current_counter: number
  per_user_limit: number
  first_order_only: boolean
  seller_id: string | null
  include_category_ids: string[]
  exclude_category_ids: string[]
  include_category_scopes: Record<string, CategoryScope>
  exclude_category_scopes: Record<string, CategoryScope>
  include_title_keywords: string[]
  exclude_title_keywords: string[]
  internal_comment: string
  purchases_count: number
  revenue_total: number
  created_at: string
}

export const PROMO_STATUS_LABELS: Record<PromoStatus, string> = {
  draft: "Черновик",
  active: "Активен",
  inactive: "Неактивен",
  expired: "Завершен",
}

export const PROMO_DISCOUNT_TYPE_LABELS: Record<PromoDiscountType, string> = {
  percent: "Процент",
  fixed: "Фиксированная сумма",
}

export const PROMO_CHANNEL_LABELS: Record<PromoChannel, string> = {
  web: "Веб",
  mobile_app: "Мобильное приложение",
  mobile_web: "Мобильный веб",
}

export const PROMO_STATUS_OPTIONS: Array<{ value: PromoStatus; label: string }> = [
  { value: "draft", label: PROMO_STATUS_LABELS.draft },
  { value: "active", label: PROMO_STATUS_LABELS.active },
  { value: "inactive", label: PROMO_STATUS_LABELS.inactive },
  { value: "expired", label: PROMO_STATUS_LABELS.expired },
]

export const PROMO_DISCOUNT_TYPE_OPTIONS: Array<{ value: PromoDiscountType; label: string }> = [
  { value: "percent", label: PROMO_DISCOUNT_TYPE_LABELS.percent },
  { value: "fixed", label: PROMO_DISCOUNT_TYPE_LABELS.fixed },
]

export const PROMO_CHANNEL_OPTIONS: Array<{ value: PromoChannel; label: string }> = [
  { value: "web", label: PROMO_CHANNEL_LABELS.web },
  { value: "mobile_app", label: PROMO_CHANNEL_LABELS.mobile_app },
  { value: "mobile_web", label: PROMO_CHANNEL_LABELS.mobile_web },
]

export const CATEGORY_SCOPE_OPTIONS: Array<{ value: CategoryScope; label: string }> = [
  { value: "with_children", label: "включая подкатегории" },
  { value: "self", label: "только этот уровень" },
]

export const PROMO_CATEGORY_OPTIONS: PromoCategoryOption[] = [
  { id: "cat-electronics", name: "Электроника", level: 0, coverage_with_children: 1480 },
  {
    id: "cat-electronics-smartphones",
    name: "Смартфоны",
    level: 1,
    parent_id: "cat-electronics",
    coverage_with_children: 620,
  },
  {
    id: "cat-electronics-tv",
    name: "Телевизоры",
    level: 1,
    parent_id: "cat-electronics",
    coverage_with_children: 280,
  },
  { id: "cat-home", name: "Дом и ремонт", level: 0, coverage_with_children: 1250 },
  {
    id: "cat-home-kitchen",
    name: "Кухонная техника",
    level: 1,
    parent_id: "cat-home",
    coverage_with_children: 390,
  },
  { id: "cat-kids", name: "Детские товары", level: 0, coverage_with_children: 830 },
]

export const SAMPLE_PRODUCT_TITLES: string[] = [
  "Смартфон Samsung Galaxy A55",
  "Телевизор LG 55 4K",
  "Пылесос беспроводной Dyson",
  "Детский велосипед Junior",
  "Смартфон Apple iPhone 15",
  "Кофемашина автоматическая DeLonghi",
  "Кухонный комбайн Bosch",
]

export const MOCK_PROMO_CODES: PromoCodeEntity[] = [
  {
    id: "promo_001",
    status: "active",
    name: "Весна смартфонов",
    code: "SPRINGPHONE",
    start_date: "2026-02-10",
    end_date: "2026-03-25",
    discount_id: "discount_1007",
    discount_type: "percent",
    discount_value: 10,
    max_discount: 3000,
    min_order_amount: 5000,
    channels: ["web", "mobile_app"],
    counter: 1000,
    current_counter: 412,
    per_user_limit: 1,
    first_order_only: false,
    seller_id: null,
    include_category_ids: ["cat-electronics-smartphones"],
    exclude_category_ids: ["cat-electronics-tv"],
    include_category_scopes: { "cat-electronics-smartphones": "with_children" },
    exclude_category_scopes: { "cat-electronics-tv": "with_children" },
    include_title_keywords: ["galaxy", "iphone"],
    exclude_title_keywords: ["refurbished"],
    internal_comment: "Проверить эффективность по каналам через 7 дней",
    purchases_count: 287,
    revenue_total: 4273500,
    created_at: "2026-02-05T12:10:00",
  },
  {
    id: "promo_002",
    status: "active",
    name: "Первый заказ в мобильном приложении",
    code: "FIRSTAPP",
    start_date: "2026-02-01",
    end_date: "2026-04-01",
    discount_id: "discount_1022",
    discount_type: "fixed",
    discount_value: 700,
    max_discount: 700,
    min_order_amount: 3000,
    channels: ["mobile_app"],
    counter: null,
    current_counter: 95,
    per_user_limit: 1,
    first_order_only: true,
    seller_id: null,
    include_category_ids: [],
    exclude_category_ids: ["cat-kids"],
    include_category_scopes: {},
    exclude_category_scopes: { "cat-kids": "with_children" },
    include_title_keywords: [],
    exclude_title_keywords: ["уценка"],
    internal_comment: "Безлимитный общий лимит, проверить риски мошенничества",
    purchases_count: 95,
    revenue_total: 1210400,
    created_at: "2026-01-28T09:20:00",
  },
  {
    id: "promo_003",
    status: "inactive",
    name: "Партнерский продавец Smart Inc",
    code: "SMARTSELLER",
    start_date: "2026-03-01",
    end_date: "2026-03-31",
    discount_id: "discount_1098",
    discount_type: "percent",
    discount_value: 12,
    max_discount: 2500,
    min_order_amount: 6000,
    channels: ["web", "mobile_web"],
    counter: 400,
    current_counter: 0,
    per_user_limit: 2,
    first_order_only: false,
    seller_id: "seller-smart-inc",
    include_category_ids: ["cat-home-kitchen"],
    exclude_category_ids: [],
    include_category_scopes: { "cat-home-kitchen": "self" },
    exclude_category_scopes: {},
    include_title_keywords: ["bosch", "delonghi"],
    exclude_title_keywords: ["аксессуар"],
    internal_comment: "Запуск после подтверждения от селлера",
    purchases_count: 0,
    revenue_total: 0,
    created_at: "2026-02-14T11:05:00",
  },
]

export function formatRub(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value)
}

export function normalizeKeywordList(values: string[]): string[] {
  const map = new Map<string, string>()

  for (const rawValue of values) {
    const clean = rawValue.trim().replace(/\s+/g, " ")
    if (!clean) {
      continue
    }

    const key = clean.toLowerCase()
    if (!map.has(key)) {
      map.set(key, clean)
    }
  }

  return Array.from(map.values())
}

export function splitTokens(rawValue: string): string[] {
  return rawValue
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function summarizeCategoryRules(item: {
  include_category_ids: string[]
  exclude_category_ids: string[]
}): string {
  const includeCount = item.include_category_ids.length
  const excludeCount = item.exclude_category_ids.length

  if (includeCount === 0 && excludeCount === 0) {
    return "Без категорийных ограничений"
  }

  return `Включено: ${includeCount}, исключено: ${excludeCount}`
}

export function summarizeTitleRules(item: {
  include_title_keywords: string[]
  exclude_title_keywords: string[]
}): string {
  const includeCount = item.include_title_keywords.length
  const excludeCount = item.exclude_title_keywords.length

  if (includeCount === 0 && excludeCount === 0) {
    return "Нет правил по ключевым словам"
  }

  return `Включено: ${includeCount}, исключено: ${excludeCount}`
}

export function calcCategoryCoverage(
  selectedIds: string[],
  scopes: Record<string, CategoryScope>,
  categories: PromoCategoryOption[],
): number {
  return selectedIds.reduce((sum, id) => {
    const category = categories.find((item) => item.id === id)
    if (!category) {
      return sum
    }

    return sum + (scopes[id] === "self" ? 1 : category.coverage_with_children)
  }, 0)
}

export function buildPromoRuleSummary(item: {
  discount_type: PromoDiscountType
  discount_value: number
  max_discount: number
  min_order_amount: number
  channels: PromoChannel[]
  first_order_only: boolean
  seller_id: string | null
  include_category_ids: string[]
  exclude_category_ids: string[]
  include_title_keywords: string[]
  exclude_title_keywords: string[]
}): string {
  const discountText =
    item.discount_type === "percent"
      ? `${item.discount_value}% (макс ${formatRub(item.max_discount)})`
      : `${formatRub(item.discount_value)} (макс ${formatRub(item.max_discount)})`

  const parts = [
    `Скидка: ${discountText}`,
    `Мин. сумма: ${formatRub(item.min_order_amount)}`,
    `Каналы: ${item.channels.map((channel) => PROMO_CHANNEL_LABELS[channel]).join(", ")}`,
  ]

  if (item.first_order_only) {
    parts.push("Только первый заказ")
  }

  if (item.seller_id) {
    parts.push(`Только продавец ${item.seller_id}`)
  }

  if (item.include_category_ids.length > 0 || item.exclude_category_ids.length > 0) {
    parts.push(`Категории включено/исключено: ${item.include_category_ids.length}/${item.exclude_category_ids.length}`)
  }

  if (item.include_title_keywords.length > 0 || item.exclude_title_keywords.length > 0) {
    parts.push(`Ключевые слова включено/исключено: ${item.include_title_keywords.length}/${item.exclude_title_keywords.length}`)
  }

  return parts.join(" | ")
}
