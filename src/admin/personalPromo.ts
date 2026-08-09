// Индивидуальные (персональные) промокоды.
// Шаблон выдачи = пресет условий, из которого генерируются коды на пользователя.
// Экземпляр = конкретный код, привязанный к user_id, со своим expires_at.

export type PersonalTemplateStatus = "draft" | "active" | "inactive"
// Как считать per_user_issue_limit: active — только действующие коды (issued/reserved),
// истёкший/погашенный освобождает слот; all_time — все выданные когда-либо (без повторной выдачи).
export type PersonalIssueLimitScope = "active" | "all_time"
export type PersonalCodeStatus = "issued" | "reserved" | "redeemed" | "expired"

export interface PersonalTemplate {
  id: string
  status: PersonalTemplateStatus
  name: string
  key: string
  discount_id: string | null
  ttl_days: number // срок от момента выдачи (дней); срок всегда относительный
  code_prefix: string
  per_user_issue_limit: number
  issue_limit_scope: PersonalIssueLimitScope // способ подсчёта per_user_issue_limit
  issue_cap: number | null
  issued_count: number
  redeemed_count: number
  created_at: string
}

export interface PersonalCodeInstance {
  id: string
  code: string
  template_id: string
  user_id: string
  phone: string
  status: PersonalCodeStatus
  issued_at: string
  expires_at: string
  order_id: string | null
}

export const PERSONAL_TEMPLATE_STATUS_LABELS: Record<PersonalTemplateStatus, string> = {
  draft: "Черновик",
  active: "Активен",
  inactive: "Неактивен",
}

export const PERSONAL_TEMPLATE_STATUS_OPTIONS: Array<{ value: PersonalTemplateStatus; label: string }> = [
  { value: "draft", label: PERSONAL_TEMPLATE_STATUS_LABELS.draft },
  { value: "active", label: PERSONAL_TEMPLATE_STATUS_LABELS.active },
  { value: "inactive", label: PERSONAL_TEMPLATE_STATUS_LABELS.inactive },
]

export const PERSONAL_ISSUE_LIMIT_SCOPE_LABELS: Record<PersonalIssueLimitScope, string> = {
  active: "Только активные коды",
  all_time: "За всё время",
}

export const PERSONAL_ISSUE_LIMIT_SCOPE_OPTIONS: Array<{ value: PersonalIssueLimitScope; label: string }> = [
  { value: "active", label: PERSONAL_ISSUE_LIMIT_SCOPE_LABELS.active },
  { value: "all_time", label: PERSONAL_ISSUE_LIMIT_SCOPE_LABELS.all_time },
]

export const PERSONAL_CODE_STATUS_LABELS: Record<PersonalCodeStatus, string> = {
  issued: "issued",
  reserved: "reserved",
  redeemed: "redeemed",
  expired: "expired",
}

export const PERSONAL_CODE_STATUS_OPTIONS: Array<{ value: PersonalCodeStatus; label: string }> = (
  Object.keys(PERSONAL_CODE_STATUS_LABELS) as PersonalCodeStatus[]
).map((value) => ({ value, label: value }))

export const MOCK_PERSONAL_TEMPLATES: PersonalTemplate[] = [
  {
    id: "tpl_gift_7d",
    status: "active",
    name: "Подарок за 7 дней",
    key: "gift_7d",
    discount_id: "discount_1022",
    ttl_days: 7,
    code_prefix: "GIFT",
    per_user_issue_limit: 1,
    issue_limit_scope: "all_time",
    issue_cap: 5000,
    issued_count: 3120,
    redeemed_count: 415,
    created_at: "2026-07-20T10:00:00",
  },
  {
    id: "tpl_cart_48h",
    status: "active",
    name: "Брошенная корзина 48 часов",
    key: "cart_48h",
    discount_id: "discount_1007",
    ttl_days: 2,
    code_prefix: "CART",
    per_user_issue_limit: 1,
    issue_limit_scope: "active",
    issue_cap: null,
    issued_count: 1840,
    redeemed_count: 233,
    created_at: "2026-07-22T12:30:00",
  },
  {
    id: "tpl_winback_14d",
    status: "inactive",
    name: "Winback уснувших",
    key: "winback_14d",
    discount_id: "discount_1098",
    ttl_days: 14,
    code_prefix: "BACK",
    per_user_issue_limit: 1,
    issue_limit_scope: "active",
    issue_cap: 8000,
    issued_count: 640,
    redeemed_count: 58,
    created_at: "2026-07-18T09:15:00",
  },
  {
    id: "tpl_first_order",
    status: "draft",
    name: "Welcome за первый заказ",
    key: "first_order_welcome",
    discount_id: "discount_1022",
    ttl_days: 7,
    code_prefix: "HELLO",
    per_user_issue_limit: 1,
    issue_limit_scope: "all_time",
    issue_cap: null,
    issued_count: 0,
    redeemed_count: 0,
    created_at: "2026-08-01T08:40:00",
  },
]

export const MOCK_PERSONAL_CODES: PersonalCodeInstance[] = [
  {
    id: "pc_0001",
    code: "GIFT-9F2KQ7",
    template_id: "tpl_gift_7d",
    user_id: "user_12345",
    phone: "+7 928 000-11-22",
    status: "issued",
    issued_at: "2026-08-06T10:15:00",
    expires_at: "2026-08-13T10:15:00",
    order_id: null,
  },
  {
    id: "pc_0002",
    code: "GIFT-7A1MP3",
    template_id: "tpl_gift_7d",
    user_id: "user_20481",
    phone: "+7 963 555-84-19",
    status: "redeemed",
    issued_at: "2026-08-02T18:05:00",
    expires_at: "2026-08-09T18:05:00",
    order_id: "bid_558210",
  },
  {
    id: "pc_0003",
    code: "CART-33LZ08",
    template_id: "tpl_cart_48h",
    user_id: "user_88320",
    phone: "+7 988 214-77-05",
    status: "expired",
    issued_at: "2026-07-30T14:00:00",
    expires_at: "2026-08-01T14:00:00",
    order_id: null,
  },
  {
    id: "pc_0004",
    code: "CART-91QW44",
    template_id: "tpl_cart_48h",
    user_id: "user_10233",
    phone: "+7 900 123-45-67",
    status: "reserved",
    issued_at: "2026-08-07T09:40:00",
    expires_at: "2026-08-09T09:40:00",
    order_id: null,
  },
  {
    id: "pc_0005",
    code: "BACK-5T8N21",
    template_id: "tpl_winback_14d",
    user_id: "user_44190",
    phone: "+7 918 700-30-90",
    status: "issued",
    issued_at: "2026-07-25T11:20:00",
    expires_at: "2026-08-08T11:20:00",
    order_id: null,
  },
]

export function personalRedemptionRate(template: Pick<PersonalTemplate, "issued_count" | "redeemed_count">): string {
  if (template.issued_count <= 0) {
    return "—"
  }

  return `${((template.redeemed_count / template.issued_count) * 100).toFixed(1)}%`
}

export function formatPersonalExpiry(template: Pick<PersonalTemplate, "ttl_days">): string {
  return `${template.ttl_days} дн. от выдачи`
}
