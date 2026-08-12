export type WheelCampaignStatus = "draft" | "scheduled" | "active" | "paused" | "completed"
export type WheelRewardType = "bonus" | "activity_points" | "promocode"
export type WheelPromocodeMode = "personal" | "shared"
export type WheelChannel = "web" | "app_webview"
export type WheelSpinStatus =
  | "claim_pending"
  | "reward_issuing"
  | "reward_issued"
  | "reward_failed"
  | "claim_expired"

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
  issued_count: number
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

export interface WheelCampaign {
  id: string
  internal_name: string
  title: string
  description: string
  status: WheelCampaignStatus
  active_from: string
  active_to: string
  claim_until: string
  initial_free_spins: 5
  audience: "all_authorized" | "test_group"
  channels: WheelChannel[]
  game_rules_url: string
  config_version: number
  prizes: WheelPrize[]
  participants_count: number
  spins_count: number
  rewards_issued_count: number
  errors_count: number
}

export interface WheelSpinRecord {
  id: string
  campaign_id: string
  user_id: string
  phone: string
  prize_id: string
  reward_type: WheelRewardType
  status: WheelSpinStatus
  created_at: string
  claim_until: string
  external_operation_id: string | null
  retries: number
}

export const WHEEL_CAMPAIGN_STATUS_LABELS: Record<WheelCampaignStatus, string> = {
  draft: "Черновик",
  scheduled: "Запланирован",
  active: "Активен",
  paused: "На паузе",
  completed: "Завершён",
}

export const WHEEL_REWARD_TYPE_LABELS: Record<WheelRewardType, string> = {
  bonus: "Бонусы",
  activity_points: "Очки активности",
  promocode: "Промокод",
}

export const WHEEL_SPIN_STATUS_LABELS: Record<WheelSpinStatus, string> = {
  claim_pending: "Ожидает получения",
  reward_issuing: "Награда выдаётся",
  reward_issued: "Награда выдана",
  reward_failed: "Ошибка выдачи",
  claim_expired: "Срок получения истёк",
}

export const WHEEL_CHANNEL_LABELS: Record<WheelChannel, string> = {
  web: "Web",
  app_webview: "WebView приложения",
}

export const MOCK_WHEEL_CAMPAIGNS: WheelCampaign[] = [
  {
    id: "wheel_august_2026",
    internal_name: "Август — первый запуск",
    title: "Крутите колесо и забирайте приз",
    description: "Пять гарантированных призов для каждого авторизованного пользователя.",
    status: "active",
    active_from: "2026-08-12T09:00",
    active_to: "2026-08-31T23:59",
    claim_until: "2026-09-07T23:59",
    initial_free_spins: 5,
    audience: "all_authorized",
    channels: ["web", "app_webview"],
    game_rules_url: "/game-rules/prize-wheel-august",
    config_version: 3,
    participants_count: 4281,
    spins_count: 15420,
    rewards_issued_count: 14892,
    errors_count: 12,
    prizes: [
      {
        id: "prize_bonus_100",
        display_name: "100 бонусов",
        description: "Начислим после получения. Срок действия определяется правилами бонусной программы.",
        image_url: "https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=400&q=80",
        action_button_text: "Перейти в каталог",
        action_button_url: "/catalog",
        display_from: "2026-08-12T09:00",
        display_to: "2026-08-31T23:59",
        selection_weight: 5000,
        total_stock: null,
        issued_count: 6180,
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
        id: "prize_points_20",
        display_name: "20 очков активности",
        description: "Хватит на два новых вращения. Очки действуют 30 дней.",
        image_url: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=400&q=80",
        action_button_text: "Перейти к заданиям",
        action_button_url: "/tasks",
        display_from: "2026-08-12T09:00",
        display_to: "2026-08-31T23:59",
        selection_weight: 2500,
        total_stock: null,
        issued_count: 3715,
        status: "active",
        visual_order: 2,
        reward_type: "activity_points",
        one_c_marketing_event_id: null,
        bonus_amount: null,
        points_amount: 20,
        points_ttl_days: 30,
        promocode_mode: null,
        personal_promocode_template_key: null,
        shared_promocode_code: null,
      },
      {
        id: "prize_personal_10",
        display_name: "Скидка 10%",
        description: "На бытовую технику. Промокод действует 7 дней с момента получения.",
        image_url: "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=400&q=80",
        action_button_text: "Открыть каталог",
        action_button_url: "/catalog/bytovaya-tehnika",
        display_from: "2026-08-12T09:00",
        display_to: "2026-08-31T23:59",
        selection_weight: 2499,
        total_stock: null,
        issued_count: 4985,
        status: "active",
        visual_order: 3,
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
        image_url: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=400&q=80",
        action_button_text: "Забрать приз",
        action_button_url: "/profile/bonuses",
        display_from: "2026-08-12T09:00",
        display_to: "2026-08-31T23:59",
        selection_weight: 1,
        total_stock: 3,
        issued_count: 1,
        status: "active",
        visual_order: 4,
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
  },
  {
    id: "wheel_autumn_draft",
    internal_name: "Осенний запуск",
    title: "Осеннее колесо подарков",
    description: "Черновик следующего запуска.",
    status: "draft",
    active_from: "2026-09-01T09:00",
    active_to: "2026-09-30T23:59",
    claim_until: "2026-10-07T23:59",
    initial_free_spins: 5,
    audience: "all_authorized",
    channels: ["web", "app_webview"],
    game_rules_url: "/game-rules/prize-wheel-autumn",
    config_version: 1,
    participants_count: 0,
    spins_count: 0,
    rewards_issued_count: 0,
    errors_count: 0,
    prizes: [],
  },
]

export const MOCK_WHEEL_SPINS: WheelSpinRecord[] = [
  {
    id: "spin_8f12a1",
    campaign_id: "wheel_august_2026",
    user_id: "user_12345",
    phone: "+7 928 000-11-22",
    prize_id: "prize_personal_10",
    reward_type: "promocode",
    status: "reward_issued",
    created_at: "2026-08-12T10:42:00",
    claim_until: "2026-09-07T23:59",
    external_operation_id: "pc_GIFT-9F2KQ7",
    retries: 0,
  },
  {
    id: "spin_9c48d2",
    campaign_id: "wheel_august_2026",
    user_id: "user_20481",
    phone: "+7 963 555-84-19",
    prize_id: "prize_bonus_100",
    reward_type: "bonus",
    status: "reward_issuing",
    created_at: "2026-08-12T11:08:00",
    claim_until: "2026-09-07T23:59",
    external_operation_id: "1c_op_882013",
    retries: 1,
  },
  {
    id: "spin_a70b31",
    campaign_id: "wheel_august_2026",
    user_id: "user_88320",
    phone: "+7 988 214-77-05",
    prize_id: "prize_points_20",
    reward_type: "activity_points",
    status: "claim_pending",
    created_at: "2026-08-12T11:31:00",
    claim_until: "2026-09-07T23:59",
    external_operation_id: null,
    retries: 0,
  },
  {
    id: "spin_b19e44",
    campaign_id: "wheel_august_2026",
    user_id: "user_44190",
    phone: "+7 918 700-30-90",
    prize_id: "prize_bonus_10000",
    reward_type: "bonus",
    status: "reward_failed",
    created_at: "2026-08-12T12:03:00",
    claim_until: "2026-09-07T23:59",
    external_operation_id: "1c_op_882904",
    retries: 3,
  },
]
