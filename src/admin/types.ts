export const TASK_TYPES = [
  "add_to_cart",
  "add_to_favorites",
  "purchase_amount",
  "purchase_category",
  "purchase_seller",
  "visit_url",
  "visit_app_screen",
  "visit_external_url",
] as const

export type TaskType = (typeof TASK_TYPES)[number]

export const TASK_STATUSES = ["upcoming", "active", "completed", "reward_claimed", "expired"] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

export const REWARD_TYPES = ["bonus", "promocode"] as const

export type RewardType = (typeof REWARD_TYPES)[number]

export type TargetType = "internal_url" | "external_url" | "app_screen"
export type PublicationState = "draft" | "published"

export interface TaskCondition {
  items_count?: number
  min_amount?: number
  category_id?: string
  seller_id?: string
  url?: string
  app_screen?: string
}

export interface TaskRewardParams {
  bonus_amount?: number
  promocode_code?: string
  promocode_valid_to?: string
  promocode_terms?: string
}

export interface Task {
  id: string
  task_code: string
  title: string
  description: string
  image_url: string
  active_from: string
  active_to: string
  task_type: TaskType
  conditions: TaskCondition
  purchase_period_from: string | null
  purchase_period_to: string | null
  reward_types: RewardType[]
  reward_params: TaskRewardParams
  target_type: TargetType
  target_value: string
  priority: number
  publication_state: PublicationState
  created_at: string
  archived: boolean
}

export interface TaskTypeOption {
  value: TaskType
  label: string
}

export interface RewardTypeOption {
  value: RewardType
  label: string
}
