import { type Task, type TaskStatus, type TaskType } from "@/admin/types"

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  add_to_cart: "Добавить товары в корзину",
  add_to_favorites: "Добавить товары в избранное",
  purchase_amount: "Покупка на сумму",
  purchase_category: "Покупка в категории",
  purchase_seller: "Покупка у продавца",
  visit_url: "Посетить URL",
  visit_app_screen: "Посетить экран приложения",
  visit_external_url: "Посетить сторонний URL",
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  upcoming: "upcoming",
  active: "active",
  completed: "completed",
  reward_claimed: "reward_claimed",
  expired: "expired",
}

export const PURCHASE_TYPES: TaskType[] = ["purchase_amount", "purchase_category", "purchase_seller"]

export function parseDate(value?: string | null): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value?: string | null): string {
  const date = parseDate(value)
  if (!date) {
    return "—"
  }

  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function formatDateTime(value?: string | null): string {
  const date = parseDate(value)
  if (!date) {
    return "—"
  }

  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function safeDateTimeInput(value?: string | null): string {
  if (!value) {
    return ""
  }

  return String(value).slice(0, 16)
}

export function safeDateInput(value?: string | null): string {
  if (!value) {
    return ""
  }

  return String(value).slice(0, 10)
}

export function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return Boolean(parsed.protocol && parsed.host)
  } catch {
    return false
  }
}

export function downloadCsv(filename: string, rows: Array<Record<string, string | number | null>>): void {
  if (!rows.length) {
    return
  }

  const headers = Object.keys(rows[0])
  const escapeCell = (value: string | number | null | undefined) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const href = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(href)
}

export function computeTaskStatus(task: Task, now: Date): TaskStatus {
  if (task.publication_state === "draft") {
    return "upcoming"
  }

  const activeFrom = parseDate(task.active_from)
  const activeTo = parseDate(task.active_to)

  if (activeFrom && now < activeFrom) {
    return "upcoming"
  }

  if (activeTo && now <= activeTo) {
    return "active"
  }

  return "expired"
}
