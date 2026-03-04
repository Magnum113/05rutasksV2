export type DiscountStatus = "draft" | "active" | "inactive"
export type PromoStatus = "draft" | "active" | "inactive"
export type PromoDiscountType = "percent" | "fixed"
export type PromoChannel = "web" | "app"
export type PromoUsageMode = "one_time" | "multi_use"
export type PromoFirstOrderFilter = "all" | "yes" | "no"
export type CategoryScope = "with_children" | "self"

export interface PromoCategoryOption {
  id: string
  name: string
  level: number
  parent_id?: string
  coverage_with_children: number
}

export interface PromoProductOption {
  id: string
  name: string
}

export interface PromoSellerOption {
  id: string
  name: string
}

export interface DiscountEntity {
  id: string
  status: DiscountStatus
  name: string
  start_date: string
  end_date: string
  discount_type: PromoDiscountType
  discount_value: number
  max_discount: number | null
  min_order_amount: number | null
  channels: PromoChannel[]
  seller_ids: string[]
  include_category_ids: string[]
  exclude_category_ids: string[]
  include_category_scopes: Record<string, CategoryScope>
  exclude_category_scopes: Record<string, CategoryScope>
  include_product_ids: string[]
  exclude_product_ids: string[]
  include_title_keywords: string[]
  exclude_title_keywords: string[]
  created_at: string
}

export interface PromoCodeEntity {
  id: string
  status: PromoStatus
  code: string
  discount_id: string | null
  start_date: string
  end_date: string
  usage_mode: PromoUsageMode
  counter: number | null
  current_counter: number
  per_user_limit: number | null
  first_order_only: boolean
  usages_count: number
  revenue_total: number
  created_at: string
}

export const DISCOUNT_STATUS_LABELS: Record<DiscountStatus, string> = {
  draft: "Черновик",
  active: "Активна",
  inactive: "Неактивна",
}

export const PROMO_STATUS_LABELS: Record<PromoStatus, string> = {
  draft: "Черновик",
  active: "Активен",
  inactive: "Неактивен",
}

export const PROMO_DISCOUNT_TYPE_LABELS: Record<PromoDiscountType, string> = {
  percent: "Процент",
  fixed: "Фиксированная сумма",
}

export const PROMO_CHANNEL_LABELS: Record<PromoChannel, string> = {
  web: "Веб",
  app: "Приложение",
}

export const PROMO_USAGE_MODE_LABELS: Record<PromoUsageMode, string> = {
  one_time: "one_time",
  multi_use: "multi_use",
}

export const DISCOUNT_STATUS_OPTIONS: Array<{ value: DiscountStatus; label: string }> = [
  { value: "draft", label: DISCOUNT_STATUS_LABELS.draft },
  { value: "active", label: DISCOUNT_STATUS_LABELS.active },
  { value: "inactive", label: DISCOUNT_STATUS_LABELS.inactive },
]

export const PROMO_STATUS_OPTIONS: Array<{ value: PromoStatus; label: string }> = [
  { value: "draft", label: PROMO_STATUS_LABELS.draft },
  { value: "active", label: PROMO_STATUS_LABELS.active },
  { value: "inactive", label: PROMO_STATUS_LABELS.inactive },
]

export const PROMO_DISCOUNT_TYPE_OPTIONS: Array<{ value: PromoDiscountType; label: string }> = [
  { value: "percent", label: PROMO_DISCOUNT_TYPE_LABELS.percent },
  { value: "fixed", label: PROMO_DISCOUNT_TYPE_LABELS.fixed },
]

export const PROMO_CHANNEL_OPTIONS: Array<{ value: PromoChannel; label: string }> = [
  { value: "web", label: PROMO_CHANNEL_LABELS.web },
  { value: "app", label: PROMO_CHANNEL_LABELS.app },
]

export const PROMO_USAGE_MODE_OPTIONS: Array<{ value: PromoUsageMode; label: string }> = [
  { value: "one_time", label: PROMO_USAGE_MODE_LABELS.one_time },
  { value: "multi_use", label: PROMO_USAGE_MODE_LABELS.multi_use },
]

export const PROMO_SELLER_OPTIONS: PromoSellerOption[] = [
  { id: "seller-smart-inc", name: "Smart Inc" },
  { id: "seller-home-tech", name: "Home Tech" },
  { id: "seller-gadget-world", name: "Gadget World" },
  { id: "seller-kids-market", name: "Kids Market" },
  { id: "seller-city-electro", name: "City Electro" },
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

export const PROMO_PRODUCT_OPTIONS: PromoProductOption[] = [
  { id: "prod-samsung-a55", name: "Смартфон Samsung Galaxy A55" },
  { id: "prod-lg-tv-55", name: "Телевизор LG 55 4K" },
  { id: "prod-dyson-v10", name: "Пылесос Dyson V10" },
  { id: "prod-bike-junior", name: "Детский велосипед Junior" },
  { id: "prod-iphone-15", name: "Смартфон Apple iPhone 15" },
]

export const MOCK_DISCOUNTS: DiscountEntity[] = [
  {
    id: "discount_1007",
    status: "active",
    name: "Весенняя скидка на смартфоны",
    start_date: "2026-02-10",
    end_date: "2026-04-10",
    discount_type: "percent",
    discount_value: 10,
    max_discount: 3000,
    min_order_amount: 5000,
    channels: ["web", "app"],
    seller_ids: ["seller-smart-inc", "seller-city-electro"],
    include_category_ids: ["cat-electronics-smartphones"],
    exclude_category_ids: ["cat-electronics-tv"],
    include_category_scopes: { "cat-electronics-smartphones": "with_children" },
    exclude_category_scopes: { "cat-electronics-tv": "with_children" },
    include_product_ids: ["prod-samsung-a55", "prod-iphone-15"],
    exclude_product_ids: [],
    include_title_keywords: ["смартфон", "iphone"],
    exclude_title_keywords: ["уценка"],
    created_at: "2026-02-05T12:10:00",
  },
  {
    id: "discount_1022",
    status: "active",
    name: "Мобильный welcome",
    start_date: "2026-02-01",
    end_date: "2026-04-01",
    discount_type: "fixed",
    discount_value: 700,
    max_discount: null,
    min_order_amount: null,
    channels: ["app"],
    seller_ids: [],
    include_category_ids: [],
    exclude_category_ids: ["cat-kids"],
    include_category_scopes: {},
    exclude_category_scopes: { "cat-kids": "with_children" },
    include_product_ids: [],
    exclude_product_ids: ["prod-bike-junior"],
    include_title_keywords: [],
    exclude_title_keywords: ["уценка"],
    created_at: "2026-01-28T09:20:00",
  },
  {
    id: "discount_1098",
    status: "inactive",
    name: "Партнерский оффер Smart Inc",
    start_date: "2026-03-01",
    end_date: "2026-03-31",
    discount_type: "percent",
    discount_value: 12,
    max_discount: 2500,
    min_order_amount: 6000,
    channels: ["web"],
    seller_ids: ["seller-smart-inc", "seller-home-tech"],
    include_category_ids: ["cat-home-kitchen"],
    exclude_category_ids: [],
    include_category_scopes: { "cat-home-kitchen": "self" },
    exclude_category_scopes: {},
    include_product_ids: ["prod-dyson-v10"],
    exclude_product_ids: [],
    include_title_keywords: ["bosch", "delonghi"],
    exclude_title_keywords: ["аксессуар"],
    created_at: "2026-02-14T11:05:00",
  },
  {
    id: "discount_2001",
    status: "draft",
    name: "Автоскидка на бытовую технику",
    start_date: "2026-03-05",
    end_date: "2026-05-01",
    discount_type: "percent",
    discount_value: 7,
    max_discount: 1800,
    min_order_amount: 3500,
    channels: ["web", "app"],
    seller_ids: [],
    include_category_ids: ["cat-home"],
    exclude_category_ids: [],
    include_category_scopes: { "cat-home": "with_children" },
    exclude_category_scopes: {},
    include_product_ids: [],
    exclude_product_ids: [],
    include_title_keywords: [],
    exclude_title_keywords: [],
    created_at: "2026-03-03T08:40:00",
  },
]

export const MOCK_PROMO_CODES: PromoCodeEntity[] = [
  {
    id: "promo_001",
    status: "active",
    code: "SPRINGPHONE",
    discount_id: "discount_1007",
    start_date: "2026-02-10",
    end_date: "2026-03-25",
    usage_mode: "multi_use",
    counter: 1000,
    current_counter: 412,
    per_user_limit: 1,
    first_order_only: false,
    usages_count: 287,
    revenue_total: 4273500,
    created_at: "2026-02-05T12:10:00",
  },
  {
    id: "promo_002",
    status: "active",
    code: "FIRSTAPP",
    discount_id: "discount_1022",
    start_date: "2026-02-01",
    end_date: "2026-04-01",
    usage_mode: "multi_use",
    counter: null,
    current_counter: 95,
    per_user_limit: 1,
    first_order_only: true,
    usages_count: 95,
    revenue_total: 1210400,
    created_at: "2026-01-28T09:20:00",
  },
  {
    id: "promo_003",
    status: "inactive",
    code: "SMARTSELLER",
    discount_id: "discount_1098",
    start_date: "2026-03-01",
    end_date: "2026-03-31",
    usage_mode: "multi_use",
    counter: 400,
    current_counter: 0,
    per_user_limit: 2,
    first_order_only: false,
    usages_count: 0,
    revenue_total: 0,
    created_at: "2026-02-14T11:05:00",
  },
  {
    id: "promo_004",
    status: "draft",
    code: "DRAFTNOLINK",
    discount_id: null,
    start_date: "2026-03-10",
    end_date: "2026-03-30",
    usage_mode: "one_time",
    counter: 1,
    current_counter: 0,
    per_user_limit: 1,
    first_order_only: false,
    usages_count: 0,
    revenue_total: 0,
    created_at: "2026-03-02T10:00:00",
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

export function formatPromoSellerList(sellerIds: string[]): string {
  if (sellerIds.length === 0) {
    return "Любые"
  }

  return sellerIds
    .map((sellerId) => PROMO_SELLER_OPTIONS.find((option) => option.id === sellerId)?.name ?? sellerId)
    .join(", ")
}

export function formatProductList(productIds: string[]): string {
  if (productIds.length === 0) {
    return "—"
  }

  return productIds
    .map((productId) => PROMO_PRODUCT_OPTIONS.find((option) => option.id === productId)?.name ?? productId)
    .join(", ")
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

export function summarizeAssortmentRules(item: {
  include_category_ids: string[]
  exclude_category_ids: string[]
  include_product_ids: string[]
  exclude_product_ids: string[]
  include_title_keywords: string[]
  exclude_title_keywords: string[]
}): string {
  const parts: string[] = []

  if (item.include_category_ids.length > 0 || item.exclude_category_ids.length > 0) {
    parts.push(`Категории ${item.include_category_ids.length}/${item.exclude_category_ids.length}`)
  }

  if (item.include_product_ids.length > 0 || item.exclude_product_ids.length > 0) {
    parts.push(`Товары ${item.include_product_ids.length}/${item.exclude_product_ids.length}`)
  }

  if (item.include_title_keywords.length > 0 || item.exclude_title_keywords.length > 0) {
    parts.push(`Ключевые слова ${item.include_title_keywords.length}/${item.exclude_title_keywords.length}`)
  }

  return parts.length > 0 ? parts.join(" • ") : "Без ассортиментных ограничений"
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
