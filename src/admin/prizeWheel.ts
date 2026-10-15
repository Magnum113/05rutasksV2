export type WheelRewardType = "bonus" | "activity_points" | "promocode" | "physical_prize"
export type WheelPromocodeMode = "personal" | "shared"
export type WheelChannel = "web" | "app_webview"
export type WheelSpinStatus = "reward_issuing" | "reward_issued" | "reward_failed"
// Only selects a demo of the iteration; not a new setting in the product API.
export type WheelPrototypeVersion = "mvp" | "full"

export interface WheelPrize {
  id: string
  display_name: string
  description: string
  image_url: string
  action_button_text: string
  action_button_url: string
  display_from: string
  display_to: string
  selection_weight: number
  total_stock: number | null
  repeatable_per_user: boolean
  status: "active" | "inactive"
  visual_order: number
  reward_type: WheelRewardType
  one_c_marketing_event_id: string | null
  bonus_amount: number | null
  points_amount: number | null
  points_ttl_days: number | null
  promocode_mode: WheelPromocodeMode | null
  personal_promocode_template_key: string | null
  shared_promocode_code: string | null
}

export interface WheelConfiguration {
  id: string
  title: string
  description: string
  wheel_visibility_enabled: boolean
  channels: WheelChannel[]
  game_rules_url: string
  config_version: number
  prizes: WheelPrize[]
}

export interface WheelSpinRecord {
  id: string
  config_version: number
  user_id: string
  prize_id: string
  prize_display_name: string
  reward_type: WheelRewardType
  status: WheelSpinStatus
  created_at: string
  external_operation_id: string | null
  error_message: string | null
  payment_method: "free_spin" | "activity_points"
  points_spent: number
  points_refunded: number
}

export const WHEEL_REWARD_TYPE_LABELS: Record<WheelRewardType, string> = {
  bonus: "Бонусы",
  activity_points: "Очки активности",
  promocode: "Промокод",
  physical_prize: "Физический приз",
}

export const WHEEL_SPIN_STATUS_LABELS: Record<WheelSpinStatus, string> = {
  reward_issuing: "Награда выдаётся",
  reward_issued: "Награда выдана",
  reward_failed: "Ошибка выдачи",
}

export const WHEEL_CHANNEL_LABELS: Record<WheelChannel, string> = {
  web: "Web",
  app_webview: "WebView приложения",
}

export const MVP_WHEEL_RULES_URL = "https://files.kaiten.ru/d57f2699-12e8-47eb-a8b1-f4be85f6791c.pdf"

export const MOCK_WHEEL_CONFIGURATION: WheelConfiguration = {
  id: "prize_wheel",
  title: "Колесо призов",
  description: "Крутите колесо и выигрывайте призы.",
  wheel_visibility_enabled: true,
  channels: ["web", "app_webview"],
  game_rules_url: MVP_WHEEL_RULES_URL,
  config_version: 4,
  prizes: [
      {
        id: "prize_bonus_100",
        display_name: "100 бонусов",
        description: "Начислим бонусы автоматически. Условия использования — в правилах бонусной программы.",
        image_url: "/prize-wheel/bonus-100.webp",
        action_button_text: "Перейти в каталог",
        action_button_url: "/catalog",
        display_from: "2026-08-12T09:00",
        display_to: "2026-12-31T23:59",
        selection_weight: 5000,
        total_stock: null,
        repeatable_per_user: true,
        status: "active",
        visual_order: 1,
        reward_type: "bonus",
        one_c_marketing_event_id: "MM_WHEEL_AUG_100",
        bonus_amount: 100,
        points_amount: null,
        points_ttl_days: null,
        promocode_mode: null,
        personal_promocode_template_key: null,
        shared_promocode_code: null,
      },
      {
        id: "prize_personal_10",
        display_name: "Скидка 10%",
        description: "На бытовую технику. Промокод действует 7 дней с момента получения.",
        image_url: "/prize-wheel/promo-10.webp",
        action_button_text: "Открыть каталог",
        action_button_url: "/catalog/bytovaya-tehnika",
        display_from: "2026-08-12T09:00",
        display_to: "2026-12-31T23:59",
        selection_weight: 2499,
        total_stock: null,
        repeatable_per_user: true,
        status: "active",
        visual_order: 2,
        reward_type: "promocode",
        one_c_marketing_event_id: null,
        bonus_amount: null,
        points_amount: null,
        points_ttl_days: null,
        promocode_mode: "personal",
        personal_promocode_template_key: "gift_7d",
        shared_promocode_code: null,
      },
      {
        id: "prize_bonus_10000",
        display_name: "10 000 бонусов",
        description: "Главный бонусный приз колеса.",
        image_url: "/prize-wheel/bonus-10000.webp",
        action_button_text: "Открыть бонусный счёт",
        action_button_url: "/profile/bonuses",
        display_from: "2026-08-12T09:00",
        display_to: "2026-12-31T23:59",
        selection_weight: 1,
        total_stock: 3,
        repeatable_per_user: true,
        status: "active",
        visual_order: 3,
        reward_type: "bonus",
        one_c_marketing_event_id: "MM_WHEEL_AUG_10000",
        bonus_amount: 10000,
        points_amount: null,
        points_ttl_days: null,
        promocode_mode: null,
        personal_promocode_template_key: null,
        shared_promocode_code: null,
      },
  ],
}

export const MOCK_WHEEL_SPINS: WheelSpinRecord[] = [
  {
    id: "spin_8f12a1",
    config_version: 3,
    user_id: "user_12345",
    prize_id: "prize_personal_10",
    prize_display_name: "Скидка 10%",
    reward_type: "promocode",
    status: "reward_issued",
    created_at: "2026-08-12T10:42:00",
    external_operation_id: "pc_op_1001",
    error_message: null,
    payment_method: "free_spin",
    points_spent: 0,
    points_refunded: 0,
  },
  {
    id: "spin_9c48d2",
    config_version: 3,
    user_id: "user_20481",
    prize_id: "prize_bonus_100",
    prize_display_name: "100 бонусов",
    reward_type: "bonus",
    status: "reward_issuing",
    created_at: "2026-08-12T11:08:00",
    external_operation_id: "1c_op_882013",
    error_message: null,
    payment_method: "free_spin",
    points_spent: 0,
    points_refunded: 0,
  },
  {
    id: "spin_b19e44",
    config_version: 3,
    user_id: "user_44190",
    prize_id: "prize_bonus_10000",
    prize_display_name: "10 000 бонусов",
    reward_type: "bonus",
    status: "reward_failed",
    created_at: "2026-08-12T12:03:00",
    external_operation_id: "1c_op_882904",
    error_message: "1С временно недоступна. Автоматическая выдача будет повторена.",
    payment_method: "free_spin",
    points_spent: 0,
    points_refunded: 0,
  },
]

export const MOCK_FULL_WHEEL_CONFIGURATION: WheelConfiguration = {
  ...MOCK_WHEEL_CONFIGURATION,
  // No approved PDF for iteration 2 yet. Do not reuse the rules of five free spins.
  game_rules_url: "",
  prizes: [
    ...MOCK_WHEEL_CONFIGURATION.prizes,
    {
      ...MOCK_WHEEL_CONFIGURATION.prizes[0],
      id: "prize_points_30",
      display_name: "30 очков активности",
      description: "Очки начисляются автоматически на общий баланс заданий и колеса.",
      image_url: "/prize-wheel/activity-points.svg",
      action_button_text: "",
      action_button_url: "",
      reward_type: "activity_points",
      one_c_marketing_event_id: null,
      bonus_amount: null,
      points_amount: 30,
      points_ttl_days: 30,
      selection_weight: 500,
      visual_order: 4,
    },
    {
      ...MOCK_WHEEL_CONFIGURATION.prizes[0],
      id: "prize_headphones",
      display_name: "Наушники",
      description: "Получите приз в магазине по адресу Шамиля, 5. Для уточнения порядка получения позвоните по телефону 8 800 511 05 05.",
      image_url: "/prize-wheel/physical-headphones.svg",
      action_button_text: "",
      action_button_url: "",
      reward_type: "physical_prize",
      one_c_marketing_event_id: null,
      bonus_amount: null,
      selection_weight: 1,
      total_stock: 5,
      repeatable_per_user: false,
      visual_order: 5,
    },
  ],
}

export const MOCK_FULL_WHEEL_SPINS: WheelSpinRecord[] = [
  ...MOCK_WHEEL_SPINS,
  {
    ...MOCK_WHEEL_SPINS[0],
    id: "spin_points_demo",
    prize_id: "prize_points_30",
    prize_display_name: "30 очков активности",
    reward_type: "activity_points",
    payment_method: "activity_points",
    points_spent: 10,
    external_operation_id: "ledger_wheel_1001",
  },
  {
    ...MOCK_WHEEL_SPINS[0],
    id: "spin_physical_demo",
    prize_id: "prize_headphones",
    prize_display_name: "Наушники",
    reward_type: "physical_prize",
    payment_method: "activity_points",
    points_spent: 10,
    external_operation_id: null,
  },
  {
    ...MOCK_WHEEL_SPINS[2],
    id: "spin_refund_demo",
    external_operation_id: "1c_op_refund_demo",
    payment_method: "activity_points",
    points_spent: 10,
    points_refunded: 10,
    error_message: "Выдать награду окончательно невозможно. 10 очков возвращены; выдача прекращена.",
  },
]

export function cloneWheelConfiguration(configuration: WheelConfiguration): WheelConfiguration {
  const copy = structuredClone(configuration)
  // Migrate old local demo data; these fields are not part of the PRD configuration.
  for (const key of ["participants_count", "spins_count", "rewards_issued_count", "errors_count", "claim_ttl_days", "audience", "initial_free_spins"]) {
    Reflect.deleteProperty(copy, key)
  }
  for (const prize of copy.prizes) Reflect.deleteProperty(prize, "issued_count")
  return copy
}

// Stand-in for the backend's read-only basic probability response (backend PRD §7).
// There is no live API in this prototype. Do not copy this calculation into the real frontend.
export function getMockBaseProbabilities(prizes: WheelPrize[], now = new Date()): Record<string, number> {
  const available = prizes.filter((prize) =>
    prize.status === "active" && new Date(prize.display_from) <= now && now <= new Date(prize.display_to) &&
    (prize.total_stock === null || prize.total_stock > 0),
  )
  const sum = available.reduce((total, prize) => total + prize.selection_weight, 0)
  return Object.fromEntries(prizes.map((prize) => [prize.id,
    sum > 0 && available.includes(prize) ? prize.selection_weight / sum * 100 : 0,
  ]))
}

type PrototypeStorage = Pick<Storage, "getItem" | "setItem">
const STORAGE_PREFIX = "05ru-wheel-admin-prototype-v2"
const LEGACY_DEMO_IMAGES: Record<string, string> = {
  "https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=400&q=80": "/prize-wheel/bonus-100.webp",
  "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=400&q=80": "/prize-wheel/promo-10.webp",
  "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=400&q=80": "/prize-wheel/bonus-10000.webp",
}

function browserStorage(): PrototypeStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

export function loadWheelConfiguration(version: WheelPrototypeVersion, storage = browserStorage()): WheelConfiguration {
  const fallback = version === "full" ? MOCK_FULL_WHEEL_CONFIGURATION : MOCK_WHEEL_CONFIGURATION
  let configuration = cloneWheelConfiguration(fallback)
  try {
    const saved = storage?.getItem(`${STORAGE_PREFIX}:${version}`)
    if (saved) {
      const parsed = JSON.parse(saved) as WheelConfiguration
      if (parsed.id === "prize_wheel" && Array.isArray(parsed.prizes) && Array.isArray(parsed.channels)) {
        configuration = cloneWheelConfiguration(parsed)
      }
    }
  } catch {
    // A damaged demo cache must not prevent opening the editor.
  }
  // Replace only the old sample photos; uploaded or custom images are preserved.
  configuration.prizes = configuration.prizes.map((prize) => ({
    ...prize, image_url: LEGACY_DEMO_IMAGES[prize.image_url] ?? prize.image_url,
  }))
  try {
    const visible = storage?.getItem(`${STORAGE_PREFIX}:visibility`)
    if (visible === "true" || visible === "false") configuration.wheel_visibility_enabled = visible === "true"
  } catch {
    // Visibility is independent of draft validation and draft cache errors.
  }
  return configuration
}

export function saveWheelConfiguration(configuration: WheelConfiguration, version: WheelPrototypeVersion, storage = browserStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(`${STORAGE_PREFIX}:${version}`, JSON.stringify(cloneWheelConfiguration(configuration)))
    return true
  } catch {
    return false
  }
}

export function saveWheelVisibility(enabled: boolean, storage = browserStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(`${STORAGE_PREFIX}:visibility`, String(enabled))
    return true
  } catch {
    return false
  }
}
