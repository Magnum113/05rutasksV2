import { useEffect, useMemo, useState } from "react"
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  Field,
  Flex,
  Grid,
  Heading,
  HStack,
  Image,
  Input,
  NativeSelect,
  Portal,
  Separator,
  Stack,
  Table,
  Text,
  Textarea,
} from "@chakra-ui/react"
import {
  CLAIM_WINDOW_DAYS,
  DEMO_NOW_ISO,
  MOCK_TASK_USER_STATES,
  MOCK_TASKS,
  MOCK_USERS,
  REWARD_TYPE_OPTIONS,
  TASK_TYPE_OPTIONS,
} from "@/admin/mockData"
import {
  type PublicationState,
  type RewardType,
  type StatusMode,
  type TargetType,
  type Task,
  type TaskCondition,
  type TaskRewardParams,
  type TaskStatus,
  type TaskType,
  type TaskUserState,
  type UserEntity,
} from "@/admin/types"
import {
  computeTaskStatus,
  daysLeft,
  downloadCsv,
  formatDate,
  formatDateTime,
  getEffectiveUserStatus,
  isValidUrl,
  parseDate,
  PURCHASE_TYPES,
  safeDateInput,
  safeDateTimeInput,
  STATUS_LABELS,
  TASK_TYPE_LABELS,
  toLocalDateTimeInput,
} from "@/admin/utils"

type Screen = "tasks" | "editor" | "completions" | "users"
type QuickFilter = "all" | "active" | "with_points" | "claim_window"
type RewardFilter = "all" | RewardType
type TypeFilter = "all" | TaskType
type StatusFilter = "all" | TaskStatus

interface TasksFilters {
  status: StatusFilter
  type: TypeFilter
  reward: RewardFilter
  dateFrom: string
  dateTo: string
  hasPoints: "all" | "yes" | "no"
}

interface CompletionFilters {
  status: StatusFilter
  dateFrom: string
  dateTo: string
  unclaimedOnly: boolean
}

interface UsersFilters {
  minPoints: string
  maxPoints: string
  expiringDays: string
  phone: string
}

interface EditorForm {
  task_code: string
  title: string
  description: string
  image_url: string
  image_upload_preview: string
  active_from: string
  active_to: string
  task_type: TaskType
  target_type: TargetType
  target_value: string
  purchase_period_from: string
  purchase_period_to: string
  priority: string
  publication_state: PublicationState
  status_mode: StatusMode
  forced_status: TaskStatus | ""
  simulated_status: TaskStatus | ""
  reward_bonus: boolean
  reward_promocode: boolean
  reward_points: boolean
  bonus_amount: string
  promocode_code: string
  promocode_valid_to: string
  promocode_terms: string
  points_amount: string
  points_expire_at: string
  condition_items_count: string
  condition_min_amount: string
  condition_category_id: string
  condition_seller_id: string
  condition_url: string
  condition_app_screen: string
}

interface FlashMessage {
  type: "success" | "error" | "info"
  text: string
}

interface ConfirmDialogState {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  danger: boolean
  action: null | (() => void)
}

interface ViewDialogState {
  open: boolean
  title: string
  payload: string
}

interface UsersSnapshot {
  user_id: string
  phone: string
  points_available: number
  points_expiring_soon: number
  expiry_nearest_date: string
  completed_tasks: number
  points_history: UserEntity["points_history"]
}

function createEmptyEditorForm(now: Date): EditorForm {
  const end = new Date(now.getTime() + 7 * 86400000)

  return {
    task_code: "",
    title: "",
    description: "",
    image_url: "",
    image_upload_preview: "",
    active_from: toLocalDateTimeInput(now),
    active_to: toLocalDateTimeInput(end),
    task_type: "add_to_cart",
    target_type: "internal_url",
    target_value: "/",
    purchase_period_from: "",
    purchase_period_to: "",
    priority: "50",
    publication_state: "draft",
    status_mode: "auto",
    forced_status: "",
    simulated_status: "",
    reward_bonus: false,
    reward_promocode: false,
    reward_points: false,
    bonus_amount: "",
    promocode_code: "",
    promocode_valid_to: "",
    promocode_terms: "",
    points_amount: "",
    points_expire_at: "",
    condition_items_count: "",
    condition_min_amount: "",
    condition_category_id: "",
    condition_seller_id: "",
    condition_url: "",
    condition_app_screen: "",
  }
}

function taskToEditorForm(task: Task): EditorForm {
  return {
    task_code: task.task_code,
    title: task.title,
    description: task.description,
    image_url: task.image_url,
    image_upload_preview: "",
    active_from: safeDateTimeInput(task.active_from),
    active_to: safeDateTimeInput(task.active_to),
    task_type: task.task_type,
    target_type: task.target_type,
    target_value: task.target_value,
    purchase_period_from: safeDateInput(task.purchase_period_from),
    purchase_period_to: safeDateInput(task.purchase_period_to),
    priority: String(task.priority),
    publication_state: task.publication_state,
    status_mode: task.status_mode,
    forced_status: task.forced_status,
    simulated_status: task.simulated_status,
    reward_bonus: task.reward_types.includes("bonus"),
    reward_promocode: task.reward_types.includes("promocode"),
    reward_points: task.reward_types.includes("activity_points"),
    bonus_amount: task.reward_params.bonus_amount ? String(task.reward_params.bonus_amount) : "",
    promocode_code: task.reward_params.promocode_code ?? "",
    promocode_valid_to: task.reward_params.promocode_valid_to ?? "",
    promocode_terms: task.reward_params.promocode_terms ?? "",
    points_amount: task.reward_params.activity_points_amount
      ? String(task.reward_params.activity_points_amount)
      : "",
    points_expire_at: task.reward_params.activity_points_expire_at ?? "",
    condition_items_count: task.conditions.items_count ? String(task.conditions.items_count) : "",
    condition_min_amount: task.conditions.min_amount ? String(task.conditions.min_amount) : "",
    condition_category_id: task.conditions.category_id ?? "",
    condition_seller_id: task.conditions.seller_id ?? "",
    condition_url: task.conditions.url ?? "",
    condition_app_screen: task.conditions.app_screen ?? "",
  }
}

function buildRewardTypes(form: EditorForm): RewardType[] {
  const rewardTypes: RewardType[] = []

  if (form.reward_bonus) {
    rewardTypes.push("bonus")
  }
  if (form.reward_promocode) {
    rewardTypes.push("promocode")
  }
  if (form.reward_points) {
    rewardTypes.push("activity_points")
  }

  return rewardTypes
}

function buildRewardParams(form: EditorForm): TaskRewardParams {
  const rewardParams: TaskRewardParams = {}

  if (form.reward_bonus && form.bonus_amount) {
    rewardParams.bonus_amount = Number(form.bonus_amount)
  }

  if (form.reward_promocode) {
    rewardParams.promocode_code = form.promocode_code.trim()
    rewardParams.promocode_valid_to = form.promocode_valid_to
    rewardParams.promocode_terms = form.promocode_terms.trim()
  }

  if (form.reward_points) {
    rewardParams.activity_points_amount = Number(form.points_amount)
    rewardParams.activity_points_expire_at = form.points_expire_at
  }

  return rewardParams
}

function buildConditions(form: EditorForm): TaskCondition {
  if (form.task_type === "add_to_cart" || form.task_type === "add_to_favorites") {
    return { items_count: Number(form.condition_items_count) }
  }

  if (form.task_type === "purchase_amount") {
    return { min_amount: Number(form.condition_min_amount) }
  }

  if (form.task_type === "purchase_category") {
    return {
      category_id: form.condition_category_id.trim(),
      min_amount: Number(form.condition_min_amount),
    }
  }

  if (form.task_type === "purchase_seller") {
    return {
      seller_id: form.condition_seller_id.trim(),
      min_amount: Number(form.condition_min_amount),
    }
  }

  if (form.task_type === "visit_url" || form.task_type === "visit_external_url") {
    return { url: form.condition_url.trim() }
  }

  if (form.task_type === "visit_app_screen") {
    return { app_screen: form.condition_app_screen.trim() }
  }

  return {}
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  upcoming: "blue",
  active: "green",
  completed: "orange",
  reward_claimed: "cyan",
  expired: "gray",
}

const QUICK_FILTERS: Array<{ key: QuickFilter; label: string }> = [
  { key: "all", label: "Все" },
  { key: "active", label: "Только active" },
  { key: "with_points", label: "С очками" },
  { key: "claim_window", label: "Окно claim" },
]

function App() {
  const now = useMemo(() => parseDate(DEMO_NOW_ISO) ?? new Date(), [])

  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS)
  const [taskUserStates] = useState<TaskUserState[]>(MOCK_TASK_USER_STATES)
  const [users] = useState<UserEntity[]>(MOCK_USERS)

  const [screen, setScreen] = useState<Screen>("tasks")
  const [globalSearch, setGlobalSearch] = useState("")
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all")

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])

  const [tasksFilters, setTasksFilters] = useState<TasksFilters>({
    status: "all",
    type: "all",
    reward: "all",
    dateFrom: "",
    dateTo: "",
    hasPoints: "all",
  })

  const [completionTaskId, setCompletionTaskId] = useState<string>(MOCK_TASKS[0]?.id ?? "")
  const [completionFilters, setCompletionFilters] = useState<CompletionFilters>({
    status: "all",
    dateFrom: "",
    dateTo: "",
    unclaimedOnly: false,
  })

  const [usersFilters, setUsersFilters] = useState<UsersFilters>({
    minPoints: "",
    maxPoints: "",
    expiringDays: "",
    phone: "",
  })

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editorForm, setEditorForm] = useState<EditorForm>(() => createEmptyEditorForm(now))
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [flash, setFlash] = useState<FlashMessage | null>(null)

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    body: "",
    confirmLabel: "Подтвердить",
    danger: false,
    action: null,
  })

  const [viewDialog, setViewDialog] = useState<ViewDialogState>({
    open: false,
    title: "",
    payload: "",
  })

  useEffect(() => {
    if (!flash) {
      return
    }

    const timeout = setTimeout(() => setFlash(null), 2800)
    return () => clearTimeout(timeout)
  }, [flash])

  useEffect(() => {
    const activeTaskIds = tasks.filter((task) => !task.archived).map((task) => task.id)

    if (!completionTaskId || !activeTaskIds.includes(completionTaskId)) {
      setCompletionTaskId(activeTaskIds[0] ?? "")
    }

    setSelectedTaskIds((prev) => prev.filter((id) => activeTaskIds.includes(id)))
  }, [completionTaskId, tasks])

  const availableTasks = useMemo(() => tasks.filter((task) => !task.archived), [tasks])

  const query = globalSearch.trim().toLowerCase()

  const filteredTasks = useMemo(() => {
    const rows = availableTasks.filter((task) => {
      if (query) {
        const haystack = `${task.task_code} ${task.title} ${task.description}`.toLowerCase()
        if (!haystack.includes(query)) {
          return false
        }
      }

      const status = computeTaskStatus(task, taskUserStates, now)

      if (tasksFilters.status !== "all" && status !== tasksFilters.status) {
        return false
      }

      if (tasksFilters.type !== "all" && task.task_type !== tasksFilters.type) {
        return false
      }

      if (tasksFilters.reward !== "all" && !task.reward_types.includes(tasksFilters.reward)) {
        return false
      }

      if (tasksFilters.hasPoints === "yes" && !task.reward_types.includes("activity_points")) {
        return false
      }

      if (tasksFilters.hasPoints === "no" && task.reward_types.includes("activity_points")) {
        return false
      }

      if (tasksFilters.dateFrom) {
        const from = parseDate(`${tasksFilters.dateFrom}T00:00:00`)
        const taskTo = parseDate(task.active_to)
        if (from && taskTo && taskTo < from) {
          return false
        }
      }

      if (tasksFilters.dateTo) {
        const to = parseDate(`${tasksFilters.dateTo}T23:59:59`)
        const taskFrom = parseDate(task.active_from)
        if (to && taskFrom && taskFrom > to) {
          return false
        }
      }

      if (quickFilter === "active" && status !== "active") {
        return false
      }

      if (quickFilter === "with_points" && !task.reward_types.includes("activity_points")) {
        return false
      }

      if (quickFilter === "claim_window") {
        const activeTo = parseDate(task.active_to)
        if (!activeTo || now <= activeTo) {
          return false
        }

        const hasWindow = taskUserStates
          .filter((item) => item.task_id === task.id)
          .some((item) => getEffectiveUserStatus(item, now) === "completed")

        if (!hasWindow) {
          return false
        }
      }

      return true
    })

    rows.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority
      }
      return (parseDate(b.created_at)?.getTime() ?? 0) - (parseDate(a.created_at)?.getTime() ?? 0)
    })

    return rows
  }, [availableTasks, now, query, quickFilter, taskUserStates, tasksFilters])

  const visibleTaskIds = filteredTasks.map((task) => task.id)
  const allVisibleSelected =
    visibleTaskIds.length > 0 && visibleTaskIds.every((taskId) => selectedTaskIds.includes(taskId))

  const completionBaseRows = useMemo(() => {
    if (!completionTaskId) {
      return []
    }

    return taskUserStates.filter((row) => row.task_id === completionTaskId)
  }, [completionTaskId, taskUserStates])

  const completionRows = useMemo(() => {
    return completionBaseRows.filter((row) => {
      if (query) {
        const haystack = `${row.user_id} ${row.phone}`.toLowerCase()
        if (!haystack.includes(query)) {
          return false
        }
      }

      const effectiveStatus = getEffectiveUserStatus(row, now)

      if (completionFilters.status !== "all" && completionFilters.status !== effectiveStatus) {
        return false
      }

      if (completionFilters.unclaimedOnly && !(effectiveStatus === "completed" && !row.reward_claimed_at)) {
        return false
      }

      if (completionFilters.dateFrom && !row.completed_at) {
        return false
      }

      if (completionFilters.dateTo && !row.completed_at) {
        return false
      }

      if (completionFilters.dateFrom && row.completed_at) {
        const from = parseDate(`${completionFilters.dateFrom}T00:00:00`)
        const completedAt = parseDate(row.completed_at)
        if (from && completedAt && completedAt < from) {
          return false
        }
      }

      if (completionFilters.dateTo && row.completed_at) {
        const to = parseDate(`${completionFilters.dateTo}T23:59:59`)
        const completedAt = parseDate(row.completed_at)
        if (to && completedAt && completedAt > to) {
          return false
        }
      }

      return true
    })
  }, [completionBaseRows, completionFilters, now, query])

  const completionSummary = useMemo(() => {
    let completed = 0
    let claimWindow = 0
    let expired = 0

    for (const row of completionBaseRows) {
      const status = getEffectiveUserStatus(row, now)

      if (status === "completed") {
        completed += 1
        const left = daysLeft(row.claim_window_until, now)
        if (left !== null && left >= 0) {
          claimWindow += 1
        }
      }

      if (status === "expired") {
        expired += 1
      }
    }

    return { completed, claimWindow, expired }
  }, [completionBaseRows, now])

  const usersSnapshot = useMemo<UsersSnapshot[]>(() => {
    return users.map((user) => {
      const activeEntries = user.points_history.filter((entry) => {
        const expiresAt = parseDate(entry.expires_at)
        return entry.points > 0 && expiresAt && expiresAt >= now
      })

      const pointsAvailable = activeEntries.reduce((sum, entry) => sum + entry.points, 0)

      const pointsExpiringSoon = activeEntries
        .filter((entry) => {
          const diff = daysLeft(entry.expires_at, now)
          return diff !== null && diff >= 0 && diff <= 7
        })
        .reduce((sum, entry) => sum + entry.points, 0)

      const nearestExpiry = activeEntries
        .map((entry) => parseDate(entry.expires_at))
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => a.getTime() - b.getTime())[0]

      const completedTaskIds = new Set(
        taskUserStates
          .filter((row) => row.user_id === user.user_id)
          .filter((row) => {
            const status = getEffectiveUserStatus(row, now)
            return ["completed", "reward_claimed", "expired"].includes(status)
          })
          .map((row) => row.task_id),
      )

      return {
        user_id: user.user_id,
        phone: user.phone,
        points_available: pointsAvailable,
        points_expiring_soon: pointsExpiringSoon,
        expiry_nearest_date: nearestExpiry ? nearestExpiry.toISOString().slice(0, 10) : "",
        completed_tasks: completedTaskIds.size,
        points_history: user.points_history,
      }
    })
  }, [now, taskUserStates, users])

  const filteredUsers = useMemo(() => {
    return usersSnapshot.filter((item) => {
      if (query) {
        const haystack = `${item.user_id} ${item.phone}`.toLowerCase()
        if (!haystack.includes(query)) {
          return false
        }
      }

      if (usersFilters.phone && !item.phone.toLowerCase().includes(usersFilters.phone.toLowerCase())) {
        return false
      }

      if (usersFilters.minPoints !== "" && item.points_available < Number(usersFilters.minPoints)) {
        return false
      }

      if (usersFilters.maxPoints !== "" && item.points_available > Number(usersFilters.maxPoints)) {
        return false
      }

      if (usersFilters.expiringDays !== "") {
        if (!item.expiry_nearest_date) {
          return false
        }

        const maxDays = Number(usersFilters.expiringDays)
        const diff = daysLeft(item.expiry_nearest_date, now)
        if (!Number.isFinite(maxDays) || diff === null || diff < 0 || diff > maxDays) {
          return false
        }
      }

      return true
    })
  }, [now, query, usersFilters, usersSnapshot])

  const selectedUserSnapshot = useMemo(() => {
    if (!selectedUserId) {
      return null
    }

    return usersSnapshot.find((item) => item.user_id === selectedUserId) ?? null
  }, [selectedUserId, usersSnapshot])

  const currentEditingTask = useMemo(() => {
    if (!editingTaskId) {
      return null
    }
    return tasks.find((task) => task.id === editingTaskId) ?? null
  }, [editingTaskId, tasks])

  const isEditingPublishedTask = currentEditingTask?.publication_state === "published"

  const conditionErrors = [
    fieldErrors.condition_items_count,
    fieldErrors.condition_min_amount,
    fieldErrors.condition_category_id,
    fieldErrors.condition_seller_id,
    fieldErrors.condition_url,
    fieldErrors.condition_app_screen,
  ].filter(Boolean)

  function setEditorField<K extends keyof EditorForm>(key: K, value: EditorForm[K]) {
    setEditorForm((prev) => ({ ...prev, [key]: value }))
  }

  function showFlash(type: FlashMessage["type"], text: string) {
    setFlash({ type, text })
  }

  function openConfirmDialog(
    title: string,
    body: string,
    action: () => void,
    options?: { danger?: boolean; confirmLabel?: string },
  ) {
    setConfirmDialog({
      open: true,
      title,
      body,
      action,
      danger: Boolean(options?.danger),
      confirmLabel: options?.confirmLabel ?? "Подтвердить",
    })
  }

  function closeConfirmDialog() {
    setConfirmDialog({
      open: false,
      title: "",
      body: "",
      action: null,
      danger: false,
      confirmLabel: "Подтвердить",
    })
  }

  function openViewDialog(title: string, payload: unknown) {
    setViewDialog({
      open: true,
      title,
      payload: JSON.stringify(payload, null, 2),
    })
  }

  function closeViewDialog() {
    setViewDialog({
      open: false,
      title: "",
      payload: "",
    })
  }

  function resetTasksFilters() {
    setTasksFilters({
      status: "all",
      type: "all",
      reward: "all",
      dateFrom: "",
      dateTo: "",
      hasPoints: "all",
    })
    setQuickFilter("all")
  }

  function resetCompletionFilters() {
    setCompletionFilters({
      status: "all",
      dateFrom: "",
      dateTo: "",
      unclaimedOnly: false,
    })
  }

  function resetUsersFilters() {
    setUsersFilters({
      minPoints: "",
      maxPoints: "",
      expiringDays: "",
      phone: "",
    })
  }

  function beginCreateTask() {
    setEditingTaskId(null)
    setEditorForm(createEmptyEditorForm(now))
    setFormErrors([])
    setFieldErrors({})
    setScreen("editor")
  }

  function beginEditTask(task: Task) {
    setEditingTaskId(task.id)
    setEditorForm(taskToEditorForm(task))
    setFormErrors([])
    setFieldErrors({})
    setScreen("editor")
  }

  function toggleTaskSelection(taskId: string, checked: boolean) {
    setSelectedTaskIds((prev) => {
      if (checked) {
        if (prev.includes(taskId)) {
          return prev
        }
        return [...prev, taskId]
      }

      return prev.filter((id) => id !== taskId)
    })
  }

  function toggleSelectAllVisible(checked: boolean) {
    if (checked) {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev)
        visibleTaskIds.forEach((id) => next.add(id))
        return Array.from(next)
      })
      return
    }

    setSelectedTaskIds((prev) => prev.filter((id) => !visibleTaskIds.includes(id)))
  }

  function onTaskPreview(task: Task) {
    openViewDialog(`Карточка ${task.task_code}`, {
      ...task,
      computed_status: computeTaskStatus(task, taskUserStates, now),
      claim_window_days: CLAIM_WINDOW_DAYS,
    })
  }

  function onTaskDuplicate(task: Task) {
    openConfirmDialog(
      "Дублировать задание",
      `Создать копию задания ${task.task_code}?`,
      () => {
        const copy: Task = {
          ...task,
          id: `task_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString().slice(-4)}`,
          task_code: `${task.task_code}_COPY`,
          publication_state: "draft",
          status_mode: "auto",
          forced_status: "",
          simulated_status: "",
          created_at: new Date().toISOString().slice(0, 16),
        }
        setTasks((prev) => [...prev, copy])
        showFlash("success", `Создан дубликат ${copy.task_code}`)
      },
      { confirmLabel: "Дублировать" },
    )
  }

  function onTaskArchive(task: Task) {
    openConfirmDialog(
      "Архивирование задания",
      `Архивировать задание ${task.task_code}?`,
      () => {
        setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, archived: true } : item)))
        setSelectedTaskIds((prev) => prev.filter((id) => id !== task.id))
        showFlash("success", `Задание ${task.task_code} архивировано`)
      },
      { danger: true, confirmLabel: "Архивировать" },
    )
  }

  function onBulkArchive() {
    if (selectedTaskIds.length === 0) {
      showFlash("info", "Выберите хотя бы одно задание для архивации")
      return
    }

    openConfirmDialog(
      "Массовая архивация",
      `Архивировать выбранные задания: ${selectedTaskIds.length}?`,
      () => {
        setTasks((prev) => prev.map((task) => (selectedTaskIds.includes(task.id) ? { ...task, archived: true } : task)))
        setSelectedTaskIds([])
        showFlash("success", `Архивировано заданий: ${selectedTaskIds.length}`)
      },
      { danger: true, confirmLabel: "Архивировать" },
    )
  }

  function onBulkPriorityApply(priorityValue: string) {
    if (selectedTaskIds.length === 0) {
      showFlash("info", "Выберите задания для массового изменения приоритета")
      return
    }

    const priority = Number(priorityValue)
    if (!Number.isInteger(priority) || priority < 0) {
      showFlash("error", "Введите целочисленный приоритет >= 0")
      return
    }

    setTasks((prev) => prev.map((task) => (selectedTaskIds.includes(task.id) ? { ...task, priority } : task)))
    showFlash("success", `Приоритет обновлён для ${selectedTaskIds.length} заданий`)
  }

  function exportTasksCsv() {
    const rows = (selectedTaskIds.length > 0
      ? filteredTasks.filter((task) => selectedTaskIds.includes(task.id))
      : filteredTasks
    ).map((task) => ({
      task_code: task.task_code,
      title: task.title,
      task_type: task.task_type,
      active_from: task.active_from,
      active_to: task.active_to,
      reward_types: task.reward_types.join("|"),
      priority: task.priority,
      publication_state: task.publication_state,
      status_mode: task.status_mode,
      user_view_status: computeTaskStatus(task, taskUserStates, now),
    }))

    if (!rows.length) {
      showFlash("info", "Нет данных для экспорта")
      return
    }

    downloadCsv("tasks_export.csv", rows)
    showFlash("success", `CSV выгружен: ${rows.length} записей`)
  }

  function validateEditor(): { errors: string[]; fieldMap: Record<string, string> } {
    const errors: string[] = []
    const fieldMap: Record<string, string> = {}

    const rewardTypes = buildRewardTypes(editorForm)

    const addError = (field: string, message: string) => {
      fieldMap[field] = message
      errors.push(message)
    }

    if (!editorForm.task_code.trim()) {
      addError("task_code", "Поле task_code обязательно")
    }

    const duplicate = tasks.find(
      (task) => !task.archived && task.task_code === editorForm.task_code.trim() && task.id !== editingTaskId,
    )
    if (duplicate) {
      addError("task_code", "task_code должен быть уникальным")
    }

    if (!editorForm.title.trim()) {
      addError("title", "Заголовок обязателен")
    }

    if (!editorForm.description.trim()) {
      addError("description", "Описание обязательно")
    }

    if (!editorForm.active_from) {
      addError("active_from", "active_from обязателен")
    }

    if (!editorForm.active_to) {
      addError("active_to", "active_to обязателен")
    }

    const activeFrom = parseDate(editorForm.active_from)
    const activeTo = parseDate(editorForm.active_to)

    if (activeFrom && activeTo && activeFrom >= activeTo) {
      addError("active_to", "active_to должен быть позже active_from")
    }

    const priority = Number(editorForm.priority)
    if (!Number.isInteger(priority) || priority < 0) {
      addError("priority", "Приоритет должен быть целым числом >= 0")
    }

    if (editorForm.task_type === "add_to_cart" || editorForm.task_type === "add_to_favorites") {
      const count = Number(editorForm.condition_items_count)
      if (!Number.isInteger(count) || count <= 0) {
        addError("condition_items_count", "Количество товаров должно быть > 0")
      }
    }

    if (editorForm.task_type === "purchase_amount") {
      const minAmount = Number(editorForm.condition_min_amount)
      if (!Number.isFinite(minAmount) || minAmount <= 0) {
        addError("condition_min_amount", "Сумма покупки должна быть > 0")
      }
    }

    if (editorForm.task_type === "purchase_category") {
      if (!editorForm.condition_category_id.trim()) {
        addError("condition_category_id", "category_id обязателен")
      }
      const minAmount = Number(editorForm.condition_min_amount)
      if (!Number.isFinite(minAmount) || minAmount <= 0) {
        addError("condition_min_amount", "Сумма покупки должна быть > 0")
      }
    }

    if (editorForm.task_type === "purchase_seller") {
      if (!editorForm.condition_seller_id.trim()) {
        addError("condition_seller_id", "seller_id обязателен")
      }
      const minAmount = Number(editorForm.condition_min_amount)
      if (!Number.isFinite(minAmount) || minAmount <= 0) {
        addError("condition_min_amount", "Сумма покупки должна быть > 0")
      }
    }

    if (editorForm.task_type === "visit_url" || editorForm.task_type === "visit_external_url") {
      if (!isValidUrl(editorForm.condition_url.trim())) {
        addError("condition_url", "Укажите корректный URL")
      }
    }

    if (editorForm.task_type === "visit_app_screen") {
      if (!editorForm.condition_app_screen.trim()) {
        addError("condition_app_screen", "Укажите app_screen")
      }
    }

    if (PURCHASE_TYPES.includes(editorForm.task_type)) {
      if (!editorForm.purchase_period_from) {
        addError("purchase_period_from", "purchase_period_from обязателен для purchase-заданий")
      }
      if (!editorForm.purchase_period_to) {
        addError("purchase_period_to", "purchase_period_to обязателен для purchase-заданий")
      }

      if (editorForm.purchase_period_from && editorForm.purchase_period_to) {
        const from = parseDate(editorForm.purchase_period_from)
        const to = parseDate(editorForm.purchase_period_to)
        if (from && to && from > to) {
          addError("purchase_period_to", "purchase_period_to не может быть раньше purchase_period_from")
        }
      }
    }

    if (!editorForm.target_value.trim()) {
      addError("target_value", "target_value обязателен")
    }

    if (editorForm.target_type === "internal_url" && !editorForm.target_value.startsWith("/")) {
      addError("target_value", "Для internal_url значение должно начинаться с /")
    }

    if (editorForm.target_type === "external_url" && !isValidUrl(editorForm.target_value.trim())) {
      addError("target_value", "Для external_url укажите корректный URL")
    }

    if (rewardTypes.length === 0) {
      addError("rewards", "Выберите хотя бы один тип награды")
    }

    if (rewardTypes.includes("promocode")) {
      if (!editorForm.promocode_code.trim()) {
        addError("promocode_code", "Код/идентификатор промокода обязателен")
      }
      if (!editorForm.promocode_valid_to) {
        addError("promocode_valid_to", "Срок действия промокода обязателен")
      }
      if (!editorForm.promocode_terms.trim()) {
        addError("promocode_terms", "Условия промокода обязательны")
      }
    }

    if (rewardTypes.includes("activity_points")) {
      const points = Number(editorForm.points_amount)
      if (!Number.isFinite(points) || points <= 0) {
        addError("points_amount", "Количество очков активности должно быть > 0")
      }
      if (!editorForm.points_expire_at) {
        addError("points_expire_at", "Срок сгорания очков обязателен")
      }
    }

    if (editorForm.status_mode === "force" && !editorForm.forced_status) {
      addError("forced_status", "При режиме Force нужно выбрать статус")
    }

    return { errors, fieldMap }
  }

  function saveEditor(publish: boolean) {
    const validation = validateEditor()
    setFormErrors(validation.errors)
    setFieldErrors(validation.fieldMap)

    if (validation.errors.length > 0) {
      showFlash("error", "Форма содержит ошибки. Исправьте поля и повторите")
      return
    }

    const rewardTypes = buildRewardTypes(editorForm)
    const rewardParams = buildRewardParams(editorForm)
    const conditions = buildConditions(editorForm)

    const publicationState: PublicationState = publish ? "published" : "draft"

    const payload: Task = {
      id:
        editingTaskId ??
        `task_${Math.random().toString(36).slice(2, 8)}_${Math.floor(Math.random() * 10000).toString()}`,
      task_code: editorForm.task_code.trim(),
      title: editorForm.title.trim(),
      description: editorForm.description.trim(),
      image_url: editorForm.image_upload_preview || editorForm.image_url.trim(),
      active_from: editorForm.active_from,
      active_to: editorForm.active_to,
      task_type: editorForm.task_type,
      conditions,
      purchase_period_from: PURCHASE_TYPES.includes(editorForm.task_type)
        ? editorForm.purchase_period_from
        : null,
      purchase_period_to: PURCHASE_TYPES.includes(editorForm.task_type) ? editorForm.purchase_period_to : null,
      reward_types: rewardTypes,
      reward_params: rewardParams,
      target_type: editorForm.target_type,
      target_value: editorForm.target_value.trim(),
      priority: Number(editorForm.priority),
      status_mode: editorForm.status_mode,
      forced_status: editorForm.status_mode === "force" ? editorForm.forced_status : "",
      simulated_status: editorForm.simulated_status,
      publication_state: publicationState,
      archived: false,
      created_at: editingTaskId
        ? tasks.find((task) => task.id === editingTaskId)?.created_at ?? new Date().toISOString()
        : new Date().toISOString(),
    }

    setTasks((prev) => {
      if (!editingTaskId) {
        return [...prev, payload]
      }
      return prev.map((task) => (task.id === editingTaskId ? { ...task, ...payload } : task))
    })

    showFlash("success", publish ? "Задание опубликовано" : "Черновик сохранён")
    setEditingTaskId(null)
    setEditorForm(createEmptyEditorForm(now))
    setFormErrors([])
    setFieldErrors({})
    setScreen("tasks")
  }

  function fillPresetVisitUrlPromoPoints() {
    setEditingTaskId(null)
    setFormErrors([])
    setFieldErrors({})
    setEditorForm((prev) => ({
      ...createEmptyEditorForm(now),
      task_code: "VISIT_URL_PROMO_POINTS_DEMO",
      title: "Посетить страницу акции и забрать награду",
      description: "Сценарий для демонстрации: visit_url + promocode + activity_points",
      task_type: "visit_url",
      condition_url: "https://05.ru/promo/demo",
      target_type: "internal_url",
      target_value: "/promo/demo",
      reward_promocode: true,
      reward_points: true,
      promocode_code: "DEMO-10",
      promocode_valid_to: "2026-04-30",
      promocode_terms: "Скидка 10% при заказе от 3000 ₽",
      points_amount: "40",
      points_expire_at: "2026-04-15",
      priority: "88",
      publication_state: prev.publication_state,
    }))
    setScreen("editor")
    showFlash("info", "Заполнен сценарий visit_url + promocode + activity_points")
  }

  function fillPresetPurchaseTask() {
    setEditingTaskId(null)
    setFormErrors([])
    setFieldErrors({})
    setEditorForm((prev) => ({
      ...createEmptyEditorForm(now),
      task_code: "PURCHASE_FIXED_PERIOD_DEMO",
      title: "Покупка в категории с фиксированным окном",
      description: "Сценарий для демонстрации purchase-задачи с фиксированным purchase_period",
      task_type: "purchase_category",
      condition_category_id: "home-appliances",
      condition_min_amount: "10000",
      purchase_period_from: "2026-03-01",
      purchase_period_to: "2026-03-15",
      target_type: "internal_url",
      target_value: "/catalog/home-appliances",
      reward_bonus: true,
      reward_points: true,
      bonus_amount: "700",
      points_amount: "90",
      points_expire_at: "2026-05-01",
      priority: "92",
      publication_state: prev.publication_state,
    }))
    setScreen("editor")
    showFlash("info", "Заполнен сценарий purchase-задачи")
  }

  function exportCompletionCsv() {
    if (!completionRows.length) {
      showFlash("info", "Нет строк для экспорта")
      return
    }

    const selectedTask = tasks.find((task) => task.id === completionTaskId)

    downloadCsv(
      "task_completion_export.csv",
      completionRows.map((row) => ({
        task_code: selectedTask?.task_code ?? row.task_id,
        user_id: row.user_id,
        phone: row.phone,
        status: getEffectiveUserStatus(row, now),
        completed_at: row.completed_at,
        reward_claimed_at: row.reward_claimed_at,
        claim_window_until: row.claim_window_until,
        days_left_to_claim: daysLeft(row.claim_window_until, now),
      })),
    )

    showFlash("success", `CSV выгружен: ${completionRows.length} записей`)
  }

  function openCompletionCard(row: TaskUserState) {
    const task = tasks.find((item) => item.id === row.task_id)

    openViewDialog("Карточка выполнения", {
      task_code: task?.task_code ?? row.task_id,
      user_id: row.user_id,
      phone: row.phone,
      status_original: row.status,
      status_effective: getEffectiveUserStatus(row, now),
      completed_at: row.completed_at,
      reward_claimed_at: row.reward_claimed_at,
      claim_window_until: row.claim_window_until,
      days_left_to_claim: daysLeft(row.claim_window_until, now),
      reward_types: task?.reward_types ?? [],
    })
  }

  function renderStatusBadge(status: TaskStatus) {
    return (
      <Badge colorPalette={STATUS_COLOR[status]} variant="subtle" rounded="full" px="2.5" py="1">
        {STATUS_LABELS[status]}
      </Badge>
    )
  }

  const selectedTaskCount = selectedTaskIds.length

  const bulkPriorityState = useState("")
  const [bulkPriority, setBulkPriority] = bulkPriorityState

  return (
    <Flex minH="100vh" direction={{ base: "column", lg: "row" }} bg="gray.50">
      <Box
        w={{ base: "full", lg: "300px" }}
        bg="gray.900"
        color="gray.50"
        p="6"
        borderRightWidth={{ base: "0", lg: "1px" }}
        borderBottomWidth={{ base: "1px", lg: "0" }}
      >
        <Stack gap="5">
          <Box>
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="widest" color="orange.200" fontWeight="700">
              05.RU
            </Text>
            <Heading size="lg" mt="1">
              Админка задач
            </Heading>
            <Text color="gray.300" mt="2" fontSize="sm">
              Пример UX для разработки фичи Tasks Marketplace.
            </Text>
          </Box>

          <Stack gap="2">
            <Button
              justifyContent="flex-start"
              variant={screen === "tasks" ? "solid" : "surface"}
              colorPalette={screen === "tasks" ? "orange" : "gray"}
              onClick={() => setScreen("tasks")}
            >
              Задания
            </Button>
            <Button
              justifyContent="flex-start"
              variant={screen === "editor" ? "solid" : "surface"}
              colorPalette={screen === "editor" ? "orange" : "gray"}
              onClick={() => {
                if (!editingTaskId) {
                  beginCreateTask()
                } else {
                  setScreen("editor")
                }
              }}
            >
              Создать задание
            </Button>
            <Button
              justifyContent="flex-start"
              variant={screen === "completions" ? "solid" : "surface"}
              colorPalette={screen === "completions" ? "orange" : "gray"}
              onClick={() => setScreen("completions")}
            >
              Выполнение заданий
            </Button>
            <Button
              justifyContent="flex-start"
              variant={screen === "users" ? "solid" : "surface"}
              colorPalette={screen === "users" ? "orange" : "gray"}
              onClick={() => setScreen("users")}
            >
              Пользователи и очки
            </Button>
          </Stack>

          <Card.Root bg="gray.800" borderColor="gray.700">
            <Card.Body>
              <Text fontSize="xs" textTransform="uppercase" color="orange.200" fontWeight="700" mb="2">
                Автоправило PRD
              </Text>
              <Text fontSize="sm" color="gray.200">
                Окно получения награды фиксировано: <Text as="span" fontWeight="700">7 дней</Text> после завершения задания.
              </Text>
            </Card.Body>
          </Card.Root>
        </Stack>
      </Box>

      <Box flex="1" minW="0">
        <Box position="sticky" top="0" zIndex="docked" bg="white" borderBottomWidth="1px" p="4">
          <Flex direction={{ base: "column", xl: "row" }} gap="3" justify="space-between" align={{ base: "stretch", xl: "center" }}>
            <Stack gap="2" flex="1">
              <Field.Root>
                <Field.Label>Глобальный поиск</Field.Label>
                <Input
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  placeholder="task_code, заголовок, телефон, user_id"
                />
              </Field.Root>

              {screen === "tasks" ? (
                <HStack wrap="wrap" gap="2">
                  {QUICK_FILTERS.map((item) => (
                    <Button
                      key={item.key}
                      size="sm"
                      variant={quickFilter === item.key ? "solid" : "outline"}
                      colorPalette={quickFilter === item.key ? "orange" : "gray"}
                      onClick={() => setQuickFilter(item.key)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </HStack>
              ) : null}
            </Stack>

            <HStack alignSelf={{ base: "flex-start", xl: "center" }}>
              <Button colorPalette="orange" onClick={beginCreateTask}>
                + Новое задание
              </Button>
            </HStack>
          </Flex>
        </Box>

        <Box p={{ base: "4", lg: "6" }}>
          <Stack gap="4">
            {flash ? (
              <Card.Root
                borderColor={
                  flash.type === "success" ? "green.200" : flash.type === "error" ? "red.200" : "blue.200"
                }
                bg={flash.type === "success" ? "green.50" : flash.type === "error" ? "red.50" : "blue.50"}
              >
                <Card.Body>
                  <Text
                    color={
                      flash.type === "success"
                        ? "green.700"
                        : flash.type === "error"
                          ? "red.700"
                          : "blue.700"
                    }
                  >
                    {flash.text}
                  </Text>
                </Card.Body>
              </Card.Root>
            ) : null}

            {screen === "tasks" ? (
              <Stack gap="4">
                <Flex justify="space-between" align="flex-end" wrap="wrap" gap="3">
                  <Box>
                    <Heading size="lg">Задания</Heading>
                    <Text color="gray.600" mt="1">
                      Сортировка: высокий приоритет выше, при равенстве выше более новое задание.
                    </Text>
                  </Box>
                </Flex>

                <Card.Root>
                  <Card.Header>
                    <Heading size="md">Фильтры</Heading>
                  </Card.Header>
                  <Card.Body>
                    <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }} gap="3">
                      <SelectField
                        label="Статус (симуляция user-view)"
                        value={tasksFilters.status}
                        options={[
                          { value: "all", label: "Все" },
                          { value: "upcoming", label: "upcoming" },
                          { value: "active", label: "active" },
                          { value: "completed", label: "completed" },
                          { value: "reward_claimed", label: "reward_claimed" },
                          { value: "expired", label: "expired" },
                        ]}
                        onChange={(value) => setTasksFilters((prev) => ({ ...prev, status: value as StatusFilter }))}
                      />

                      <SelectField
                        label="Тип задания"
                        value={tasksFilters.type}
                        options={[
                          { value: "all", label: "Все" },
                          ...TASK_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
                        ]}
                        onChange={(value) => setTasksFilters((prev) => ({ ...prev, type: value as TypeFilter }))}
                      />

                      <SelectField
                        label="Тип награды"
                        value={tasksFilters.reward}
                        options={[
                          { value: "all", label: "Все" },
                          ...REWARD_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
                        ]}
                        onChange={(value) =>
                          setTasksFilters((prev) => ({ ...prev, reward: value as TasksFilters["reward"] }))
                        }
                      />

                      <Field.Root>
                        <Field.Label>Active c</Field.Label>
                        <Input
                          type="date"
                          value={tasksFilters.dateFrom}
                          onChange={(event) =>
                            setTasksFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
                          }
                        />
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>Active по</Field.Label>
                        <Input
                          type="date"
                          value={tasksFilters.dateTo}
                          onChange={(event) => setTasksFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
                        />
                      </Field.Root>

                      <SelectField
                        label="Очки активности"
                        value={tasksFilters.hasPoints}
                        options={[
                          { value: "all", label: "Все" },
                          { value: "yes", label: "Есть" },
                          { value: "no", label: "Нет" },
                        ]}
                        onChange={(value) =>
                          setTasksFilters((prev) => ({ ...prev, hasPoints: value as TasksFilters["hasPoints"] }))
                        }
                      />
                    </Grid>
                  </Card.Body>
                  <Card.Footer>
                    <Button variant="outline" onClick={resetTasksFilters}>
                      Сбросить фильтры
                    </Button>
                  </Card.Footer>
                </Card.Root>

                <Card.Root>
                  <Card.Body>
                    <Stack gap="3">
                      <HStack gap="3" wrap="wrap">
                        <Checkbox.Root
                          checked={allVisibleSelected}
                          onCheckedChange={(details) => toggleSelectAllVisible(details.checked === true)}
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control />
                          <Checkbox.Label>Выбрать все в текущем списке</Checkbox.Label>
                        </Checkbox.Root>

                        <Badge colorPalette="gray" variant="subtle" px="3" py="1" rounded="full">
                          {selectedTaskCount} выбрано
                        </Badge>
                      </HStack>

                      <HStack wrap="wrap" gap="2">
                        <Field.Root maxW="200px">
                          <Field.Label>Новый приоритет</Field.Label>
                          <Input
                            type="number"
                            min="0"
                            value={bulkPriority}
                            onChange={(event) => setBulkPriority(event.target.value)}
                            placeholder="0"
                          />
                        </Field.Root>

                        <Button mt={{ base: "0", md: "6" }} onClick={() => onBulkPriorityApply(bulkPriority)}>
                          Изменить приоритет
                        </Button>
                        <Button mt={{ base: "0", md: "6" }} colorPalette="red" variant="outline" onClick={onBulkArchive}>
                          Архивировать выбранные
                        </Button>
                        <Button mt={{ base: "0", md: "6" }} variant="outline" onClick={exportTasksCsv}>
                          Экспорт CSV
                        </Button>
                      </HStack>

                      <Table.ScrollArea borderWidth="1px" rounded="md">
                        <Table.Root size="sm" variant="line">
                          <Table.Header>
                            <Table.Row>
                              <Table.ColumnHeader />
                              <Table.ColumnHeader>task_code</Table.ColumnHeader>
                              <Table.ColumnHeader>Заголовок</Table.ColumnHeader>
                              <Table.ColumnHeader>Тип задания</Table.ColumnHeader>
                              <Table.ColumnHeader>Период активности</Table.ColumnHeader>
                              <Table.ColumnHeader>Награды</Table.ColumnHeader>
                              <Table.ColumnHeader>Приоритет</Table.ColumnHeader>
                              <Table.ColumnHeader>Публикация / статус</Table.ColumnHeader>
                              <Table.ColumnHeader>Действия</Table.ColumnHeader>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {filteredTasks.length === 0 ? (
                              <Table.Row>
                                <Table.Cell colSpan={9}>
                                  <Text color="gray.500">По текущим фильтрам задания не найдены.</Text>
                                </Table.Cell>
                              </Table.Row>
                            ) : (
                              filteredTasks.map((task) => {
                                const status = computeTaskStatus(task, taskUserStates, now)
                                const selected = selectedTaskIds.includes(task.id)

                                return (
                                  <Table.Row key={task.id}>
                                    <Table.Cell>
                                      <Checkbox.Root
                                        checked={selected}
                                        onCheckedChange={(details) =>
                                          toggleTaskSelection(task.id, details.checked === true)
                                        }
                                      >
                                        <Checkbox.HiddenInput />
                                        <Checkbox.Control />
                                      </Checkbox.Root>
                                    </Table.Cell>
                                    <Table.Cell>
                                      <Text fontWeight="700">{task.task_code}</Text>
                                    </Table.Cell>
                                    <Table.Cell>{task.title}</Table.Cell>
                                    <Table.Cell>{TASK_TYPE_LABELS[task.task_type]}</Table.Cell>
                                    <Table.Cell>
                                      {formatDateTime(task.active_from)} - {formatDateTime(task.active_to)}
                                    </Table.Cell>
                                    <Table.Cell>
                                      <HStack wrap="wrap">
                                        {task.reward_types.map((reward) => (
                                          <Badge key={reward} colorPalette="purple" variant="subtle" rounded="full">
                                            {reward}
                                          </Badge>
                                        ))}
                                      </HStack>
                                    </Table.Cell>
                                    <Table.Cell>{task.priority}</Table.Cell>
                                    <Table.Cell>
                                      <HStack wrap="wrap">
                                        <Badge
                                          colorPalette={task.publication_state === "published" ? "blue" : "yellow"}
                                          variant="subtle"
                                          rounded="full"
                                        >
                                          {task.publication_state}
                                        </Badge>
                                        {renderStatusBadge(status)}
                                        <Badge colorPalette="gray" variant="outline" rounded="full">
                                          {task.status_mode}
                                        </Badge>
                                      </HStack>
                                    </Table.Cell>
                                    <Table.Cell>
                                      <HStack wrap="wrap" gap="1">
                                        <Button size="xs" variant="outline" onClick={() => onTaskPreview(task)}>
                                          Просмотр
                                        </Button>
                                        <Button size="xs" variant="outline" onClick={() => beginEditTask(task)}>
                                          Редактировать
                                        </Button>
                                        <Button size="xs" variant="outline" onClick={() => onTaskDuplicate(task)}>
                                          Дублировать
                                        </Button>
                                        <Button
                                          size="xs"
                                          variant="outline"
                                          colorPalette="red"
                                          onClick={() => onTaskArchive(task)}
                                        >
                                          Архивировать
                                        </Button>
                                      </HStack>
                                    </Table.Cell>
                                  </Table.Row>
                                )
                              })
                            )}
                          </Table.Body>
                        </Table.Root>
                      </Table.ScrollArea>
                    </Stack>
                  </Card.Body>
                </Card.Root>
              </Stack>
            ) : null}

            {screen === "editor" ? (
              <Stack gap="4">
                <Box>
                  <Heading size="lg">{editingTaskId ? "Редактировать задание" : "Создать задание"}</Heading>
                  <Text color="gray.600" mt="1">
                    Все поля и валидации соответствуют PRD. В интерфейсе используются только компоненты Chakra UI.
                  </Text>
                </Box>

                <Card.Root>
                  <Card.Header>
                    <Heading size="md">Быстрые сценарии</Heading>
                  </Card.Header>
                  <Card.Body>
                    <HStack wrap="wrap">
                      <Button onClick={fillPresetVisitUrlPromoPoints} variant="outline">
                        visit_url + promocode + activity_points
                      </Button>
                      <Button onClick={fillPresetPurchaseTask} variant="outline">
                        purchase-задача + fixed purchase period
                      </Button>
                    </HStack>
                  </Card.Body>
                </Card.Root>

                {formErrors.length > 0 ? (
                  <Card.Root borderColor="red.200" bg="red.50">
                    <Card.Header>
                      <Heading size="sm" color="red.700">
                        Проверьте поля формы
                      </Heading>
                    </Card.Header>
                    <Card.Body>
                      <Stack gap="1" as="ul" pl="4">
                        {formErrors.map((error) => (
                          <Text as="li" color="red.700" key={error}>
                            {error}
                          </Text>
                        ))}
                      </Stack>
                    </Card.Body>
                  </Card.Root>
                ) : null}

                <Card.Root>
                  <Card.Header>
                    <Heading size="md">Основное</Heading>
                  </Card.Header>
                  <Card.Body>
                    <Grid templateColumns={{ base: "1fr", lg: "repeat(3, minmax(0, 1fr))" }} gap="3">
                      <Field.Root invalid={Boolean(fieldErrors.task_code)}>
                        <Field.Label>task_code *</Field.Label>
                        <Input
                          value={editorForm.task_code}
                          onChange={(event) => setEditorField("task_code", event.target.value)}
                          placeholder="TASK_CODE_001"
                          readOnly={Boolean(isEditingPublishedTask)}
                        />
                        <Field.HelperText>
                          {isEditingPublishedTask
                            ? "task_code заблокирован, потому что задание уже опубликовано"
                            : "Уникальное значение. После публикации редактирование блокируется."}
                        </Field.HelperText>
                        {fieldErrors.task_code ? <Field.ErrorText>{fieldErrors.task_code}</Field.ErrorText> : null}
                      </Field.Root>

                      <Field.Root invalid={Boolean(fieldErrors.title)}>
                        <Field.Label>Заголовок *</Field.Label>
                        <Input
                          value={editorForm.title}
                          onChange={(event) => setEditorField("title", event.target.value)}
                          placeholder="Добавьте 3 товара в корзину"
                        />
                        {fieldErrors.title ? <Field.ErrorText>{fieldErrors.title}</Field.ErrorText> : null}
                      </Field.Root>

                      <Field.Root invalid={Boolean(fieldErrors.priority)}>
                        <Field.Label>Приоритет *</Field.Label>
                        <Input
                          type="number"
                          min="0"
                          value={editorForm.priority}
                          onChange={(event) => setEditorField("priority", event.target.value)}
                        />
                        {fieldErrors.priority ? <Field.ErrorText>{fieldErrors.priority}</Field.ErrorText> : null}
                      </Field.Root>
                    </Grid>

                    <Field.Root mt="3" invalid={Boolean(fieldErrors.description)}>
                      <Field.Label>Описание *</Field.Label>
                      <Textarea
                        value={editorForm.description}
                        onChange={(event) => setEditorField("description", event.target.value)}
                        rows={3}
                        placeholder="Кратко опишите условие и пользу"
                      />
                      {fieldErrors.description ? <Field.ErrorText>{fieldErrors.description}</Field.ErrorText> : null}
                    </Field.Root>

                    <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="3" mt="3">
                      <Field.Root>
                        <Field.Label>Загрузка изображения</Field.Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (!file) {
                              return
                            }
                            const reader = new FileReader()
                            reader.onload = () => {
                              if (typeof reader.result === "string") {
                                setEditorField("image_upload_preview", reader.result)
                              }
                            }
                            reader.readAsDataURL(file)
                          }}
                        />
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>Или URL изображения</Field.Label>
                        <Input
                          value={editorForm.image_url}
                          onChange={(event) => setEditorField("image_url", event.target.value)}
                          placeholder="https://..."
                        />
                      </Field.Root>
                    </Grid>

                    <Box mt="3" p="3" borderWidth="1px" rounded="md" minH="120px" bg="gray.50">
                      {editorForm.image_upload_preview || editorForm.image_url ? (
                        <Image
                          src={editorForm.image_upload_preview || editorForm.image_url}
                          alt="preview"
                          maxH="200px"
                          w="full"
                          objectFit="cover"
                          rounded="md"
                        />
                      ) : (
                        <Text color="gray.500">Превью изображения</Text>
                      )}
                    </Box>
                  </Card.Body>
                </Card.Root>

                <Card.Root>
                  <Card.Header>
                    <Heading size="md">Периоды</Heading>
                  </Card.Header>
                  <Card.Body>
                    <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="3">
                      <Field.Root invalid={Boolean(fieldErrors.active_from)}>
                        <Field.Label>active_from *</Field.Label>
                        <Input
                          type="datetime-local"
                          value={editorForm.active_from}
                          onChange={(event) => setEditorField("active_from", event.target.value)}
                        />
                        {fieldErrors.active_from ? <Field.ErrorText>{fieldErrors.active_from}</Field.ErrorText> : null}
                      </Field.Root>

                      <Field.Root invalid={Boolean(fieldErrors.active_to)}>
                        <Field.Label>active_to *</Field.Label>
                        <Input
                          type="datetime-local"
                          value={editorForm.active_to}
                          onChange={(event) => setEditorField("active_to", event.target.value)}
                        />
                        {fieldErrors.active_to ? <Field.ErrorText>{fieldErrors.active_to}</Field.ErrorText> : null}
                      </Field.Root>
                    </Grid>

                    <Card.Root mt="3" bg="blue.50" borderColor="blue.200">
                      <Card.Body>
                        <Text color="blue.800">
                          Окно claim после завершения задания фиксированное: <Text as="span" fontWeight="700">7 дней</Text>{" "}
                          (не настраивается).
                        </Text>
                      </Card.Body>
                    </Card.Root>
                  </Card.Body>
                </Card.Root>

                <Card.Root>
                  <Card.Header>
                    <Heading size="md">Тип задания и условия</Heading>
                  </Card.Header>
                  <Card.Body>
                    <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="3">
                      <SelectField
                        label="Тип задания *"
                        value={editorForm.task_type}
                        options={TASK_TYPE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                        onChange={(value) => setEditorField("task_type", value as TaskType)}
                      />

                      <SelectField
                        label="Тип перехода к выполнению *"
                        value={editorForm.target_type}
                        options={[
                          { value: "internal_url", label: "internal_url" },
                          { value: "external_url", label: "external_url" },
                          { value: "app_screen", label: "app_screen" },
                        ]}
                        onChange={(value) => setEditorField("target_type", value as TargetType)}
                      />
                    </Grid>

                    <Box mt="3">
                      {editorForm.task_type === "add_to_cart" || editorForm.task_type === "add_to_favorites" ? (
                        <Field.Root invalid={Boolean(fieldErrors.condition_items_count)}>
                          <Field.Label>Количество товаров *</Field.Label>
                          <Input
                            type="number"
                            min="1"
                            value={editorForm.condition_items_count}
                            onChange={(event) => setEditorField("condition_items_count", event.target.value)}
                          />
                          {fieldErrors.condition_items_count ? (
                            <Field.ErrorText>{fieldErrors.condition_items_count}</Field.ErrorText>
                          ) : null}
                        </Field.Root>
                      ) : null}

                      {editorForm.task_type === "purchase_amount" ? (
                        <Field.Root invalid={Boolean(fieldErrors.condition_min_amount)}>
                          <Field.Label>Минимальная сумма заказа (₽) *</Field.Label>
                          <Input
                            type="number"
                            min="1"
                            value={editorForm.condition_min_amount}
                            onChange={(event) => setEditorField("condition_min_amount", event.target.value)}
                          />
                          {fieldErrors.condition_min_amount ? (
                            <Field.ErrorText>{fieldErrors.condition_min_amount}</Field.ErrorText>
                          ) : null}
                        </Field.Root>
                      ) : null}

                      {editorForm.task_type === "purchase_category" ? (
                        <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="3">
                          <Field.Root invalid={Boolean(fieldErrors.condition_category_id)}>
                            <Field.Label>category_id *</Field.Label>
                            <Input
                              value={editorForm.condition_category_id}
                              onChange={(event) => setEditorField("condition_category_id", event.target.value)}
                              placeholder="electronics"
                            />
                            {fieldErrors.condition_category_id ? (
                              <Field.ErrorText>{fieldErrors.condition_category_id}</Field.ErrorText>
                            ) : null}
                          </Field.Root>

                          <Field.Root invalid={Boolean(fieldErrors.condition_min_amount)}>
                            <Field.Label>Минимальная сумма заказа (₽) *</Field.Label>
                            <Input
                              type="number"
                              min="1"
                              value={editorForm.condition_min_amount}
                              onChange={(event) => setEditorField("condition_min_amount", event.target.value)}
                            />
                            {fieldErrors.condition_min_amount ? (
                              <Field.ErrorText>{fieldErrors.condition_min_amount}</Field.ErrorText>
                            ) : null}
                          </Field.Root>
                        </Grid>
                      ) : null}

                      {editorForm.task_type === "purchase_seller" ? (
                        <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="3">
                          <Field.Root invalid={Boolean(fieldErrors.condition_seller_id)}>
                            <Field.Label>seller_id *</Field.Label>
                            <Input
                              value={editorForm.condition_seller_id}
                              onChange={(event) => setEditorField("condition_seller_id", event.target.value)}
                              placeholder="seller-123"
                            />
                            {fieldErrors.condition_seller_id ? (
                              <Field.ErrorText>{fieldErrors.condition_seller_id}</Field.ErrorText>
                            ) : null}
                          </Field.Root>

                          <Field.Root invalid={Boolean(fieldErrors.condition_min_amount)}>
                            <Field.Label>Минимальная сумма заказа (₽) *</Field.Label>
                            <Input
                              type="number"
                              min="1"
                              value={editorForm.condition_min_amount}
                              onChange={(event) => setEditorField("condition_min_amount", event.target.value)}
                            />
                            {fieldErrors.condition_min_amount ? (
                              <Field.ErrorText>{fieldErrors.condition_min_amount}</Field.ErrorText>
                            ) : null}
                          </Field.Root>
                        </Grid>
                      ) : null}

                      {editorForm.task_type === "visit_url" || editorForm.task_type === "visit_external_url" ? (
                        <Field.Root invalid={Boolean(fieldErrors.condition_url)}>
                          <Field.Label>URL для проверки факта посещения *</Field.Label>
                          <Input
                            value={editorForm.condition_url}
                            onChange={(event) => setEditorField("condition_url", event.target.value)}
                            placeholder="https://example.com"
                          />
                          {fieldErrors.condition_url ? (
                            <Field.ErrorText>{fieldErrors.condition_url}</Field.ErrorText>
                          ) : null}
                        </Field.Root>
                      ) : null}

                      {editorForm.task_type === "visit_app_screen" ? (
                        <Field.Root invalid={Boolean(fieldErrors.condition_app_screen)}>
                          <Field.Label>app_screen *</Field.Label>
                          <Input
                            value={editorForm.condition_app_screen}
                            onChange={(event) => setEditorField("condition_app_screen", event.target.value)}
                            placeholder="profile/home"
                          />
                          {fieldErrors.condition_app_screen ? (
                            <Field.ErrorText>{fieldErrors.condition_app_screen}</Field.ErrorText>
                          ) : null}
                        </Field.Root>
                      ) : null}

                      {conditionErrors.length > 1 ? (
                        <Text color="red.600" fontSize="sm" mt="1">
                          Проверьте поля условий выполнения задания.
                        </Text>
                      ) : null}
                    </Box>

                    <Field.Root mt="3" invalid={Boolean(fieldErrors.target_value)}>
                      <Field.Label>target_value *</Field.Label>
                      <Input
                        value={editorForm.target_value}
                        onChange={(event) => setEditorField("target_value", event.target.value)}
                        placeholder="/catalog или https://... или app://screen"
                      />
                      {fieldErrors.target_value ? <Field.ErrorText>{fieldErrors.target_value}</Field.ErrorText> : null}
                    </Field.Root>

                    {PURCHASE_TYPES.includes(editorForm.task_type) ? (
                      <Card.Root mt="3" bg="gray.50" borderStyle="dashed">
                        <Card.Header>
                          <Heading size="sm">Фиксированный период покупок (только для purchase)</Heading>
                        </Card.Header>
                        <Card.Body>
                          <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="3">
                            <Field.Root invalid={Boolean(fieldErrors.purchase_period_from)}>
                              <Field.Label>purchase_period_from *</Field.Label>
                              <Input
                                type="date"
                                value={editorForm.purchase_period_from}
                                onChange={(event) => setEditorField("purchase_period_from", event.target.value)}
                              />
                              {fieldErrors.purchase_period_from ? (
                                <Field.ErrorText>{fieldErrors.purchase_period_from}</Field.ErrorText>
                              ) : null}
                            </Field.Root>

                            <Field.Root invalid={Boolean(fieldErrors.purchase_period_to)}>
                              <Field.Label>purchase_period_to *</Field.Label>
                              <Input
                                type="date"
                                value={editorForm.purchase_period_to}
                                onChange={(event) => setEditorField("purchase_period_to", event.target.value)}
                              />
                              {fieldErrors.purchase_period_to ? (
                                <Field.ErrorText>{fieldErrors.purchase_period_to}</Field.ErrorText>
                              ) : null}
                            </Field.Root>
                          </Grid>
                        </Card.Body>
                      </Card.Root>
                    ) : null}
                  </Card.Body>
                </Card.Root>

                <Card.Root>
                  <Card.Header>
                    <Heading size="md">Награды</Heading>
                  </Card.Header>
                  <Card.Body>
                    <HStack wrap="wrap" gap="4">
                      <Checkbox.Root
                        checked={editorForm.reward_bonus}
                        onCheckedChange={(details) => setEditorField("reward_bonus", details.checked === true)}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                        <Checkbox.Label>bonus</Checkbox.Label>
                      </Checkbox.Root>

                      <Checkbox.Root
                        checked={editorForm.reward_promocode}
                        onCheckedChange={(details) =>
                          setEditorField("reward_promocode", details.checked === true)
                        }
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                        <Checkbox.Label>promocode</Checkbox.Label>
                      </Checkbox.Root>

                      <Checkbox.Root
                        checked={editorForm.reward_points}
                        onCheckedChange={(details) => setEditorField("reward_points", details.checked === true)}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                        <Checkbox.Label>activity_points</Checkbox.Label>
                      </Checkbox.Root>
                    </HStack>

                    {fieldErrors.rewards ? (
                      <Text color="red.600" fontSize="sm" mt="2">
                        {fieldErrors.rewards}
                      </Text>
                    ) : null}

                    {editorForm.reward_bonus ? (
                      <Card.Root mt="3" bg="gray.50" borderStyle="dashed">
                        <Card.Header>
                          <Heading size="sm">Параметры bonus</Heading>
                        </Card.Header>
                        <Card.Body>
                          <Field.Root>
                            <Field.Label>Количество бонусов</Field.Label>
                            <Input
                              type="number"
                              min="1"
                              value={editorForm.bonus_amount}
                              onChange={(event) => setEditorField("bonus_amount", event.target.value)}
                            />
                          </Field.Root>
                        </Card.Body>
                      </Card.Root>
                    ) : null}

                    {editorForm.reward_promocode ? (
                      <Card.Root mt="3" bg="gray.50" borderStyle="dashed">
                        <Card.Header>
                          <Heading size="sm">Параметры promocode</Heading>
                        </Card.Header>
                        <Card.Body>
                          <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="3">
                            <Field.Root invalid={Boolean(fieldErrors.promocode_code)}>
                              <Field.Label>Код/идентификатор *</Field.Label>
                              <Input
                                value={editorForm.promocode_code}
                                onChange={(event) => setEditorField("promocode_code", event.target.value)}
                                placeholder="SPRING-10"
                              />
                              {fieldErrors.promocode_code ? (
                                <Field.ErrorText>{fieldErrors.promocode_code}</Field.ErrorText>
                              ) : null}
                            </Field.Root>

                            <Field.Root invalid={Boolean(fieldErrors.promocode_valid_to)}>
                              <Field.Label>Срок действия *</Field.Label>
                              <Input
                                type="date"
                                value={editorForm.promocode_valid_to}
                                onChange={(event) => setEditorField("promocode_valid_to", event.target.value)}
                              />
                              {fieldErrors.promocode_valid_to ? (
                                <Field.ErrorText>{fieldErrors.promocode_valid_to}</Field.ErrorText>
                              ) : null}
                            </Field.Root>
                          </Grid>

                          <Field.Root mt="3" invalid={Boolean(fieldErrors.promocode_terms)}>
                            <Field.Label>Условия *</Field.Label>
                            <Textarea
                              rows={3}
                              value={editorForm.promocode_terms}
                              onChange={(event) => setEditorField("promocode_terms", event.target.value)}
                              placeholder="Минимальная сумма, исключения, срок"
                            />
                            {fieldErrors.promocode_terms ? (
                              <Field.ErrorText>{fieldErrors.promocode_terms}</Field.ErrorText>
                            ) : null}
                          </Field.Root>
                        </Card.Body>
                      </Card.Root>
                    ) : null}

                    {editorForm.reward_points ? (
                      <Card.Root mt="3" bg="gray.50" borderStyle="dashed">
                        <Card.Header>
                          <Heading size="sm">Параметры activity_points</Heading>
                        </Card.Header>
                        <Card.Body>
                          <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="3">
                            <Field.Root invalid={Boolean(fieldErrors.points_amount)}>
                              <Field.Label>Количество очков *</Field.Label>
                              <Input
                                type="number"
                                min="1"
                                value={editorForm.points_amount}
                                onChange={(event) => setEditorField("points_amount", event.target.value)}
                              />
                              {fieldErrors.points_amount ? (
                                <Field.ErrorText>{fieldErrors.points_amount}</Field.ErrorText>
                              ) : null}
                            </Field.Root>

                            <Field.Root invalid={Boolean(fieldErrors.points_expire_at)}>
                              <Field.Label>Срок сгорания *</Field.Label>
                              <Input
                                type="date"
                                value={editorForm.points_expire_at}
                                onChange={(event) => setEditorField("points_expire_at", event.target.value)}
                              />
                              {fieldErrors.points_expire_at ? (
                                <Field.ErrorText>{fieldErrors.points_expire_at}</Field.ErrorText>
                              ) : null}
                            </Field.Root>
                          </Grid>
                        </Card.Body>
                      </Card.Root>
                    ) : null}
                  </Card.Body>
                </Card.Root>

                <Card.Root>
                  <Card.Header>
                    <Heading size="md">Публикация и управление статусом</Heading>
                  </Card.Header>
                  <Card.Body>
                    <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="3">
                      <SelectField
                        label="Публикация"
                        value={editorForm.publication_state}
                        options={[
                          { value: "draft", label: "draft" },
                          { value: "published", label: "published" },
                        ]}
                        onChange={(value) => setEditorField("publication_state", value as PublicationState)}
                      />

                      <SelectField
                        label="Симуляция user-status"
                        value={editorForm.simulated_status}
                        options={[
                          { value: "", label: "auto" },
                          { value: "upcoming", label: "upcoming" },
                          { value: "active", label: "active" },
                          { value: "completed", label: "completed" },
                          { value: "reward_claimed", label: "reward_claimed" },
                          { value: "expired", label: "expired" },
                        ]}
                        onChange={(value) => setEditorField("simulated_status", value as TaskStatus | "")}
                      />
                    </Grid>

                    <SelectField
                      label="Режим статуса"
                      value={editorForm.status_mode}
                      options={[
                        { value: "auto", label: "Auto (рекомендуется)" },
                        { value: "force", label: "Force" },
                      ]}
                      onChange={(value) => setEditorField("status_mode", value as StatusMode)}
                    />

                    {editorForm.status_mode === "force" ? (
                      <Stack mt="3" gap="3">
                        <SelectField
                          label="Force status"
                          value={editorForm.forced_status}
                          options={[
                            { value: "", label: "Выберите статус" },
                            { value: "upcoming", label: "upcoming" },
                            { value: "active", label: "active" },
                            { value: "completed", label: "completed" },
                            { value: "reward_claimed", label: "reward_claimed" },
                            { value: "expired", label: "expired" },
                          ]}
                          onChange={(value) => setEditorField("forced_status", value as TaskStatus | "")}
                        />
                        {fieldErrors.forced_status ? (
                          <Text color="red.600" fontSize="sm">
                            {fieldErrors.forced_status}
                          </Text>
                        ) : null}

                        <Card.Root borderColor="orange.200" bg="orange.50">
                          <Card.Body>
                            <Text color="orange.800">
                              Внимание: режим Force переопределяет авто-логику PRD и должен использоваться только
                              для служебной симуляции.
                            </Text>
                          </Card.Body>
                        </Card.Root>
                      </Stack>
                    ) : null}
                  </Card.Body>
                </Card.Root>

                <Card.Root position="sticky" bottom="2" zIndex="base">
                  <Card.Body>
                    <HStack justify="flex-end" wrap="wrap">
                      <Button variant="outline" onClick={() => saveEditor(false)}>
                        Сохранить черновик
                      </Button>
                      <Button colorPalette="orange" onClick={() => saveEditor(true)}>
                        Опубликовать
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingTaskId(null)
                          setEditorForm(createEmptyEditorForm(now))
                          setFormErrors([])
                          setFieldErrors({})
                          setScreen("tasks")
                        }}
                      >
                        Отмена
                      </Button>
                    </HStack>
                  </Card.Body>
                </Card.Root>
              </Stack>
            ) : null}

            {screen === "completions" ? (
              <Stack gap="4">
                <Box>
                  <Heading size="lg">Выполнение заданий</Heading>
                  <Text color="gray.600" mt="1">
                    Просмотр user-status, claim window и экспорт CSV.
                  </Text>
                </Box>

                <Card.Root>
                  <Card.Body>
                    <Grid templateColumns={{ base: "1fr", lg: "1fr auto" }} gap="3" alignItems="end">
                      <SelectField
                        label="Задание"
                        value={completionTaskId}
                        options={availableTasks.map((task) => ({
                          value: task.id,
                          label: `${task.task_code} — ${task.title}`,
                        }))}
                        onChange={setCompletionTaskId}
                      />

                      <HStack wrap="wrap" align="stretch">
                        <StatCard label="completed" value={completionSummary.completed} color="orange" />
                        <StatCard label="в окне claim" value={completionSummary.claimWindow} color="blue" />
                        <StatCard label="expired" value={completionSummary.expired} color="gray" />
                      </HStack>
                    </Grid>
                  </Card.Body>
                </Card.Root>

                <Card.Root>
                  <Card.Header>
                    <Heading size="md">Фильтры</Heading>
                  </Card.Header>
                  <Card.Body>
                    <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }} gap="3">
                      <SelectField
                        label="Статус пользователя"
                        value={completionFilters.status}
                        options={[
                          { value: "all", label: "Все" },
                          { value: "upcoming", label: "upcoming" },
                          { value: "active", label: "active" },
                          { value: "completed", label: "completed" },
                          { value: "reward_claimed", label: "reward_claimed" },
                          { value: "expired", label: "expired" },
                        ]}
                        onChange={(value) =>
                          setCompletionFilters((prev) => ({ ...prev, status: value as CompletionFilters["status"] }))
                        }
                      />

                      <Field.Root>
                        <Field.Label>completed от</Field.Label>
                        <Input
                          type="date"
                          value={completionFilters.dateFrom}
                          onChange={(event) =>
                            setCompletionFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
                          }
                        />
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>completed до</Field.Label>
                        <Input
                          type="date"
                          value={completionFilters.dateTo}
                          onChange={(event) =>
                            setCompletionFilters((prev) => ({ ...prev, dateTo: event.target.value }))
                          }
                        />
                      </Field.Root>

                      <Box pt={{ base: "0", xl: "7" }}>
                        <Checkbox.Root
                          checked={completionFilters.unclaimedOnly}
                          onCheckedChange={(details) =>
                            setCompletionFilters((prev) => ({ ...prev, unclaimedOnly: details.checked === true }))
                          }
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control />
                          <Checkbox.Label>Только completed без claim</Checkbox.Label>
                        </Checkbox.Root>
                      </Box>
                    </Grid>

                    <HStack mt="3" wrap="wrap">
                      <Button variant="outline" onClick={resetCompletionFilters}>
                        Сбросить фильтры
                      </Button>
                      <Button onClick={exportCompletionCsv}>Экспорт CSV</Button>
                    </HStack>
                  </Card.Body>
                </Card.Root>

                <Card.Root>
                  <Card.Body>
                    <Table.ScrollArea borderWidth="1px" rounded="md">
                      <Table.Root size="sm" variant="line">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader>user_id</Table.ColumnHeader>
                            <Table.ColumnHeader>Телефон</Table.ColumnHeader>
                            <Table.ColumnHeader>Текущий статус</Table.ColumnHeader>
                            <Table.ColumnHeader>Дата выполнения</Table.ColumnHeader>
                            <Table.ColumnHeader>Дата claim</Table.ColumnHeader>
                            <Table.ColumnHeader>days_left_to_claim</Table.ColumnHeader>
                            <Table.ColumnHeader>Действия</Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {completionRows.length === 0 ? (
                            <Table.Row>
                              <Table.Cell colSpan={7}>
                                <Text color="gray.500">Нет пользователей по текущим условиям.</Text>
                              </Table.Cell>
                            </Table.Row>
                          ) : (
                            completionRows.map((row) => {
                              const status = getEffectiveUserStatus(row, now)
                              const left = daysLeft(row.claim_window_until, now)

                              return (
                                <Table.Row key={`${row.task_id}_${row.user_id}`}>
                                  <Table.Cell>{row.user_id}</Table.Cell>
                                  <Table.Cell>{row.phone}</Table.Cell>
                                  <Table.Cell>{renderStatusBadge(status)}</Table.Cell>
                                  <Table.Cell>{formatDateTime(row.completed_at)}</Table.Cell>
                                  <Table.Cell>{formatDateTime(row.reward_claimed_at)}</Table.Cell>
                                  <Table.Cell>{left === null ? "—" : Math.max(left, 0)}</Table.Cell>
                                  <Table.Cell>
                                    <Button size="xs" variant="outline" onClick={() => openCompletionCard(row)}>
                                      Карточка
                                    </Button>
                                  </Table.Cell>
                                </Table.Row>
                              )
                            })
                          )}
                        </Table.Body>
                      </Table.Root>
                    </Table.ScrollArea>
                  </Card.Body>
                </Card.Root>
              </Stack>
            ) : null}

            {screen === "users" ? (
              <Stack gap="4">
                <Box>
                  <Heading size="lg">Пользователи и очки активности</Heading>
                  <Text color="gray.600" mt="1">
                    Контроль баланса, сгорания и источников начисления.
                  </Text>
                </Box>

                <Card.Root>
                  <Card.Header>
                    <Heading size="md">Фильтры</Heading>
                  </Card.Header>
                  <Card.Body>
                    <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }} gap="3">
                      <Field.Root>
                        <Field.Label>Баланс от</Field.Label>
                        <Input
                          type="number"
                          min="0"
                          value={usersFilters.minPoints}
                          onChange={(event) =>
                            setUsersFilters((prev) => ({ ...prev, minPoints: event.target.value }))
                          }
                        />
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>Баланс до</Field.Label>
                        <Input
                          type="number"
                          min="0"
                          value={usersFilters.maxPoints}
                          onChange={(event) =>
                            setUsersFilters((prev) => ({ ...prev, maxPoints: event.target.value }))
                          }
                        />
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>Сгорание в ближайшие N дней</Field.Label>
                        <Input
                          type="number"
                          min="1"
                          value={usersFilters.expiringDays}
                          onChange={(event) =>
                            setUsersFilters((prev) => ({ ...prev, expiringDays: event.target.value }))
                          }
                          placeholder="7"
                        />
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>Телефон</Field.Label>
                        <Input
                          value={usersFilters.phone}
                          onChange={(event) => setUsersFilters((prev) => ({ ...prev, phone: event.target.value }))}
                          placeholder="+7..."
                        />
                      </Field.Root>
                    </Grid>

                    <Button mt="3" variant="outline" onClick={resetUsersFilters}>
                      Сбросить фильтры
                    </Button>
                  </Card.Body>
                </Card.Root>

                <Grid templateColumns={{ base: "1fr", xl: "2fr 1fr" }} gap="4">
                  <Card.Root>
                    <Card.Body>
                      <Table.ScrollArea borderWidth="1px" rounded="md">
                        <Table.Root size="sm" variant="line">
                          <Table.Header>
                            <Table.Row>
                              <Table.ColumnHeader>user_id</Table.ColumnHeader>
                              <Table.ColumnHeader>Телефон</Table.ColumnHeader>
                              <Table.ColumnHeader>Доступные очки</Table.ColumnHeader>
                              <Table.ColumnHeader>Сгорает скоро</Table.ColumnHeader>
                              <Table.ColumnHeader>Ближайшая дата сгорания</Table.ColumnHeader>
                              <Table.ColumnHeader>Выполнено заданий</Table.ColumnHeader>
                              <Table.ColumnHeader />
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {filteredUsers.length === 0 ? (
                              <Table.Row>
                                <Table.Cell colSpan={7}>
                                  <Text color="gray.500">Нет пользователей по текущим фильтрам.</Text>
                                </Table.Cell>
                              </Table.Row>
                            ) : (
                              filteredUsers.map((item) => (
                                <Table.Row key={item.user_id}>
                                  <Table.Cell>{item.user_id}</Table.Cell>
                                  <Table.Cell>{item.phone}</Table.Cell>
                                  <Table.Cell fontWeight="700">{item.points_available}</Table.Cell>
                                  <Table.Cell>{item.points_expiring_soon}</Table.Cell>
                                  <Table.Cell>{formatDate(item.expiry_nearest_date)}</Table.Cell>
                                  <Table.Cell>{item.completed_tasks}</Table.Cell>
                                  <Table.Cell>
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      onClick={() => setSelectedUserId(item.user_id)}
                                    >
                                      Детали
                                    </Button>
                                  </Table.Cell>
                                </Table.Row>
                              ))
                            )}
                          </Table.Body>
                        </Table.Root>
                      </Table.ScrollArea>
                    </Card.Body>
                  </Card.Root>

                  <Card.Root>
                    <Card.Header>
                      <Heading size="md">Карточка пользователя</Heading>
                    </Card.Header>
                    <Card.Body>
                      {!selectedUserSnapshot ? (
                        <Text color="gray.500">Выберите пользователя в таблице.</Text>
                      ) : (
                        <Stack gap="4">
                          <Stack gap="1">
                            <InfoRow label="user_id" value={selectedUserSnapshot.user_id} />
                            <InfoRow label="Телефон" value={selectedUserSnapshot.phone} />
                            <InfoRow label="Доступные очки" value={String(selectedUserSnapshot.points_available)} />
                            <InfoRow
                              label="Сгорает скоро"
                              value={String(selectedUserSnapshot.points_expiring_soon)}
                            />
                            <InfoRow
                              label="Ближайшая дата сгорания"
                              value={formatDate(selectedUserSnapshot.expiry_nearest_date)}
                            />
                            <InfoRow
                              label="Выполнено заданий"
                              value={String(selectedUserSnapshot.completed_tasks)}
                            />
                          </Stack>

                          <Separator />

                          <Box>
                            <Text fontWeight="700" mb="2">
                              История очков
                            </Text>
                            <Table.ScrollArea borderWidth="1px" rounded="md">
                              <Table.Root size="sm" variant="line">
                                <Table.Header>
                                  <Table.Row>
                                    <Table.ColumnHeader>Дата</Table.ColumnHeader>
                                    <Table.ColumnHeader>Источник</Table.ColumnHeader>
                                    <Table.ColumnHeader>Очки</Table.ColumnHeader>
                                    <Table.ColumnHeader>Сгорание</Table.ColumnHeader>
                                  </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                  {selectedUserSnapshot.points_history.length === 0 ? (
                                    <Table.Row>
                                      <Table.Cell colSpan={4}>
                                        <Text color="gray.500">История отсутствует.</Text>
                                      </Table.Cell>
                                    </Table.Row>
                                  ) : (
                                    selectedUserSnapshot.points_history.map((entry) => (
                                      <Table.Row key={entry.id}>
                                        <Table.Cell>{formatDate(entry.date)}</Table.Cell>
                                        <Table.Cell>{entry.task_code}</Table.Cell>
                                        <Table.Cell>{entry.points}</Table.Cell>
                                        <Table.Cell>{formatDate(entry.expires_at)}</Table.Cell>
                                      </Table.Row>
                                    ))
                                  )}
                                </Table.Body>
                              </Table.Root>
                            </Table.ScrollArea>
                          </Box>
                        </Stack>
                      )}
                    </Card.Body>
                  </Card.Root>
                </Grid>
              </Stack>
            ) : null}
          </Stack>
        </Box>
      </Box>

      <Dialog.Root open={confirmDialog.open} onOpenChange={(details) => setConfirmDialog((prev) => ({ ...prev, open: details.open }))}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{confirmDialog.title}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>{confirmDialog.body}</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <HStack justify="flex-end" w="full">
                  <Button variant="outline" onClick={closeConfirmDialog}>
                    Отмена
                  </Button>
                  <Button
                    colorPalette={confirmDialog.danger ? "red" : "orange"}
                    onClick={() => {
                      confirmDialog.action?.()
                      closeConfirmDialog()
                    }}
                  >
                    {confirmDialog.confirmLabel}
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={viewDialog.open} onOpenChange={(details) => setViewDialog((prev) => ({ ...prev, open: details.open }))}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="840px">
              <Dialog.Header>
                <Dialog.Title>{viewDialog.title}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Box
                  as="pre"
                  p="3"
                  bg="gray.900"
                  color="green.200"
                  rounded="md"
                  overflow="auto"
                  fontSize="xs"
                  whiteSpace="pre-wrap"
                >
                  {viewDialog.payload}
                </Box>
              </Dialog.Body>
              <Dialog.Footer>
                <Button onClick={closeViewDialog}>Закрыть</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Flex>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}

function SelectField(props: SelectFieldProps) {
  const { label, value, onChange, options } = props

  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <NativeSelect.Root>
        <NativeSelect.Field value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value || "empty"} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field.Root>
  )
}

interface StatCardProps {
  label: string
  value: number
  color: string
}

function StatCard(props: StatCardProps) {
  const { label, value, color } = props

  return (
    <Card.Root minW="120px" borderColor={`${color}.200`} bg={`${color}.50`}>
      <Card.Body>
        <Text fontSize="xs" textTransform="uppercase" color={`${color}.700`}>
          {label}
        </Text>
        <Text fontSize="2xl" fontWeight="700">
          {value}
        </Text>
      </Card.Body>
    </Card.Root>
  )
}

interface InfoRowProps {
  label: string
  value: string
}

function InfoRow(props: InfoRowProps) {
  const { label, value } = props

  return (
    <Flex justify="space-between" gap="3">
      <Text color="gray.600">{label}</Text>
      <Text fontWeight="600" textAlign="right">
        {value}
      </Text>
    </Flex>
  )
}

export default App
