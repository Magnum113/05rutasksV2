import { type ReactNode, useEffect, useMemo, useState } from "react"

import { CLAIM_WINDOW_DAYS, DEMO_NOW_ISO, MOCK_TASKS, REWARD_TYPE_OPTIONS, TASK_TYPE_OPTIONS } from "@/admin/mockData"
import {
  type RewardType,
  type TargetType,
  type Task,
  type TaskCondition,
  type TaskRewardParams,
  type TaskStatus,
  type TaskType,
} from "@/admin/types"
import {
  computeTaskStatus,
  downloadCsv,
  formatDateTime,
  isValidUrl,
  parseDate,
  PURCHASE_TYPES,
  safeDateInput,
  safeDateTimeInput,
  STATUS_LABELS,
  TASK_TYPE_LABELS,
  toLocalDateTimeInput,
} from "@/admin/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Screen = "tasks" | "editor"
type RewardFilter = "all" | RewardType
type TypeFilter = "all" | TaskType
type StatusFilter = "all" | TaskStatus
type PublicationFilter = "all" | "draft" | "published"

interface TasksFilters {
  status: StatusFilter
  type: TypeFilter
  reward: RewardFilter
  publication: PublicationFilter
  dateFrom: string
  dateTo: string
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
  reward_bonus: boolean
  reward_promocode: boolean
  bonus_amount: string
  promocode_code: string
  promocode_valid_to: string
  promocode_terms: string
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
    reward_bonus: false,
    reward_promocode: false,
    bonus_amount: "",
    promocode_code: "",
    promocode_valid_to: "",
    promocode_terms: "",
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
    reward_bonus: task.reward_types.includes("bonus"),
    reward_promocode: task.reward_types.includes("promocode"),
    bonus_amount: task.reward_params.bonus_amount ? String(task.reward_params.bonus_amount) : "",
    promocode_code: task.reward_params.promocode_code ?? "",
    promocode_valid_to: task.reward_params.promocode_valid_to ?? "",
    promocode_terms: task.reward_params.promocode_terms ?? "",
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

const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  upcoming: "bg-sky-100 text-sky-700 border-sky-200",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  completed: "bg-amber-100 text-amber-700 border-amber-200",
  reward_claimed: "bg-cyan-100 text-cyan-700 border-cyan-200",
  expired: "bg-slate-200 text-slate-700 border-slate-300",
}

function App() {
  const now = useMemo(() => parseDate(DEMO_NOW_ISO) ?? new Date(), [])

  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS)

  const [screen, setScreen] = useState<Screen>("tasks")
  const [globalSearch, setGlobalSearch] = useState("")

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])

  const [tasksFilters, setTasksFilters] = useState<TasksFilters>({
    status: "all",
    type: "all",
    reward: "all",
    publication: "all",
    dateFrom: "",
    dateTo: "",
  })

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editorForm, setEditorForm] = useState<EditorForm>(() => createEmptyEditorForm(now))
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [flash, setFlash] = useState<FlashMessage | null>(null)

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    body: "",
    confirmLabel: "Подтвердить",
    danger: false,
    action: null,
  })

  useEffect(() => {
    if (!flash) {
      return
    }

    const timeout = setTimeout(() => setFlash(null), 2800)
    return () => clearTimeout(timeout)
  }, [flash])

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

      const status = computeTaskStatus(task, now)

      if (tasksFilters.status !== "all" && status !== tasksFilters.status) {
        return false
      }

      if (tasksFilters.type !== "all" && task.task_type !== tasksFilters.type) {
        return false
      }

      if (tasksFilters.reward !== "all" && !task.reward_types.includes(tasksFilters.reward)) {
        return false
      }

      if (tasksFilters.publication !== "all" && task.publication_state !== tasksFilters.publication) {
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

      return true
    })

    rows.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority
      }
      return (parseDate(b.created_at)?.getTime() ?? 0) - (parseDate(a.created_at)?.getTime() ?? 0)
    })

    return rows
  }, [availableTasks, now, query, tasksFilters])

  const visibleTaskIds = filteredTasks.map((task) => task.id)
  const allVisibleSelected =
    visibleTaskIds.length > 0 && visibleTaskIds.every((taskId) => selectedTaskIds.includes(taskId))

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

  const [bulkPriority, setBulkPriority] = useState("")

  const selectedTaskCount = selectedTaskIds.length

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

  function resetTasksFilters() {
    setTasksFilters({
      status: "all",
      type: "all",
      reward: "all",
      publication: "all",
      dateFrom: "",
      dateTo: "",
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

    const archiveCount = selectedTaskIds.length

    openConfirmDialog(
      "Массовая архивация",
      `Архивировать выбранные задания: ${archiveCount}?`,
      () => {
        setTasks((prev) => prev.map((task) => (selectedTaskIds.includes(task.id) ? { ...task, archived: true } : task)))
        setSelectedTaskIds([])
        showFlash("success", `Архивировано заданий: ${archiveCount}`)
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
      task_status: computeTaskStatus(task, now),
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

    if (rewardTypes.includes("bonus")) {
      const bonusAmount = Number(editorForm.bonus_amount)
      if (!Number.isFinite(bonusAmount) || bonusAmount <= 0) {
        addError("bonus_amount", "Количество бонусов должно быть > 0")
      }
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

    const publicationState = publish ? "published" : currentEditingTask?.publication_state ?? "draft"

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
      purchase_period_from: PURCHASE_TYPES.includes(editorForm.task_type) ? editorForm.purchase_period_from : null,
      purchase_period_to: PURCHASE_TYPES.includes(editorForm.task_type) ? editorForm.purchase_period_to : null,
      reward_types: rewardTypes,
      reward_params: rewardParams,
      target_type: editorForm.target_type,
      target_value: editorForm.target_value.trim(),
      priority: Number(editorForm.priority),
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

  function renderStatusBadge(status: TaskStatus) {
    return <Badge className={cn("border", STATUS_BADGE_CLASS[status])}>{STATUS_LABELS[status]}</Badge>
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full border-b bg-slate-950 p-6 text-slate-50 lg:w-72 lg:border-b-0 lg:border-r">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E30614]">05.RU</p>
              <h1 className="text-2xl font-semibold">Админка маркетинга</h1>
              <p className="text-sm text-slate-300">Интерфейс для создания и редактирования заданий.</p>
            </div>

            <nav className="space-y-2">
              <Button
                className="w-full justify-start"
                variant={screen === "tasks" ? "default" : "secondary"}
                onClick={() => setScreen("tasks")}
              >
                Задания
              </Button>
              <Button
                className="w-full justify-start"
                variant={screen === "editor" ? "default" : "secondary"}
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
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="sticky top-0 z-10 border-b bg-white/95 p-4 backdrop-blur">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="w-full space-y-2 xl:max-w-3xl">
                <Label htmlFor="global-search">Глобальный поиск</Label>
                <Input
                  id="global-search"
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  placeholder="task_code, заголовок"
                />
              </div>

              <Button onClick={beginCreateTask}>+ Новое задание</Button>
            </div>
          </div>

          <div className="p-4 lg:p-6">
            <div className="space-y-4">
              {flash ? (
                <Card
                  className={cn(
                    flash.type === "success" && "border-emerald-200 bg-emerald-50",
                    flash.type === "error" && "border-rose-200 bg-rose-50",
                    flash.type === "info" && "border-sky-200 bg-sky-50",
                  )}
                >
                  <CardContent className="pt-6">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        flash.type === "success" && "text-emerald-700",
                        flash.type === "error" && "text-rose-700",
                        flash.type === "info" && "text-sky-700",
                      )}
                    >
                      {flash.text}
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {screen === "tasks" ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Задания</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Сортировка: высокий приоритет выше, при равенстве выше более новое задание.
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Фильтры</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <SelectField
                          label="Статус"
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

                        <SelectField
                          label="Публикация"
                          value={tasksFilters.publication}
                          options={[
                            { value: "all", label: "Все" },
                            { value: "draft", label: "draft" },
                            { value: "published", label: "published" },
                          ]}
                          onChange={(value) =>
                            setTasksFilters((prev) => ({ ...prev, publication: value as PublicationFilter }))
                          }
                        />

                        <FieldBlock label="Active c">
                          <Input
                            type="date"
                            value={tasksFilters.dateFrom}
                            onChange={(event) => setTasksFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
                          />
                        </FieldBlock>

                        <FieldBlock label="Active по">
                          <Input
                            type="date"
                            value={tasksFilters.dateTo}
                            onChange={(event) => setTasksFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
                          />
                        </FieldBlock>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" onClick={resetTasksFilters}>
                        Сбросить фильтры
                      </Button>
                    </CardFooter>
                  </Card>

                  <Card>
                    <CardContent className="space-y-4 pt-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-sm font-medium">
                          <Checkbox
                            checked={allVisibleSelected}
                            onCheckedChange={(checked) => toggleSelectAllVisible(checked === true)}
                          />
                          Выбрать все в текущем списке
                        </label>

                        <Badge variant="secondary" className="rounded-full px-3 py-1">
                          {selectedTaskCount} выбрано
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-end gap-2">
                        <FieldBlock label="Новый приоритет" className="w-full sm:w-[220px]">
                          <Input
                            type="number"
                            min="0"
                            value={bulkPriority}
                            onChange={(event) => setBulkPriority(event.target.value)}
                            placeholder="0"
                          />
                        </FieldBlock>

                        <Button variant="outline" onClick={() => onBulkPriorityApply(bulkPriority)}>
                          Изменить приоритет
                        </Button>
                        <Button variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={onBulkArchive}>
                          Архивировать выбранные
                        </Button>
                        <Button variant="outline" onClick={exportTasksCsv}>
                          Экспорт CSV
                        </Button>
                      </div>

                      <div className="rounded-md border bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10" />
                              <TableHead>task_code</TableHead>
                              <TableHead>Заголовок</TableHead>
                              <TableHead>Тип задания</TableHead>
                              <TableHead>Период активности</TableHead>
                              <TableHead>Награды</TableHead>
                              <TableHead>Приоритет</TableHead>
                              <TableHead>Публикация / статус</TableHead>
                              <TableHead>Действия</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTasks.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={9}>
                                  <p className="py-6 text-center text-sm text-muted-foreground">
                                    По текущим фильтрам задания не найдены.
                                  </p>
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredTasks.map((task) => {
                                const status = computeTaskStatus(task, now)
                                const selected = selectedTaskIds.includes(task.id)

                                return (
                                  <TableRow key={task.id}>
                                    <TableCell>
                                      <Checkbox
                                        checked={selected}
                                        onCheckedChange={(checked) => toggleTaskSelection(task.id, checked === true)}
                                      />
                                    </TableCell>
                                    <TableCell className="font-semibold">{task.task_code}</TableCell>
                                    <TableCell>{task.title}</TableCell>
                                    <TableCell>{TASK_TYPE_LABELS[task.task_type]}</TableCell>
                                    <TableCell>
                                      {formatDateTime(task.active_from)} - {formatDateTime(task.active_to)}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        {task.reward_types.map((reward) => (
                                          <Badge key={reward} variant="outline" className="rounded-full">
                                            {reward}
                                          </Badge>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell>{task.priority}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        <Badge
                                          className={cn(
                                            "border",
                                            task.publication_state === "published"
                                              ? "border-blue-200 bg-blue-100 text-blue-700"
                                              : "border-amber-200 bg-amber-100 text-amber-700",
                                          )}
                                        >
                                          {task.publication_state}
                                        </Badge>
                                        {renderStatusBadge(status)}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        <Button size="sm" variant="outline" onClick={() => beginEditTask(task)}>
                                          Редактировать
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => onTaskDuplicate(task)}>
                                          Дублировать
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-rose-300 text-rose-700 hover:bg-rose-50"
                                          onClick={() => onTaskArchive(task)}
                                        >
                                          Архивировать
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {screen === "editor" ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-semibold">{editingTaskId ? "Редактировать задание" : "Создать задание"}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Заполните параметры задания и настройте награды.</p>
                  </div>

                  {formErrors.length > 0 ? (
                    <Card className="border-rose-200 bg-rose-50">
                      <CardHeader>
                        <CardTitle className="text-rose-700">Проверьте поля формы</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-rose-700">
                          {formErrors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ) : null}

                  <Card>
                    <CardHeader>
                      <CardTitle>Основное</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        <FieldBlock
                          label="task_code *"
                          hint={
                            isEditingPublishedTask
                              ? "task_code заблокирован, потому что задание уже опубликовано"
                              : "Уникальное значение. После публикации редактирование блокируется."
                          }
                          error={fieldErrors.task_code}
                        >
                          <Input
                            value={editorForm.task_code}
                            onChange={(event) => setEditorField("task_code", event.target.value)}
                            placeholder="TASK_CODE_001"
                            readOnly={Boolean(isEditingPublishedTask)}
                          />
                        </FieldBlock>

                        <FieldBlock label="Заголовок *" error={fieldErrors.title}>
                          <Input
                            value={editorForm.title}
                            onChange={(event) => setEditorField("title", event.target.value)}
                            placeholder="Добавьте 3 товара в корзину"
                          />
                        </FieldBlock>

                        <FieldBlock label="Приоритет *" error={fieldErrors.priority}>
                          <Input
                            type="number"
                            min="0"
                            value={editorForm.priority}
                            onChange={(event) => setEditorField("priority", event.target.value)}
                          />
                        </FieldBlock>
                      </div>

                      <FieldBlock label="Описание *" error={fieldErrors.description}>
                        <Textarea
                          value={editorForm.description}
                          onChange={(event) => setEditorField("description", event.target.value)}
                          rows={3}
                          placeholder="Кратко опишите условие и пользу"
                        />
                      </FieldBlock>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <FieldBlock label="Загрузка изображения">
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
                        </FieldBlock>

                        <FieldBlock label="Или URL изображения">
                          <Input
                            value={editorForm.image_url}
                            onChange={(event) => setEditorField("image_url", event.target.value)}
                            placeholder="https://..."
                          />
                        </FieldBlock>
                      </div>

                      <div className="min-h-[120px] rounded-md border bg-slate-50 p-3">
                        {editorForm.image_upload_preview || editorForm.image_url ? (
                          <img
                            src={editorForm.image_upload_preview || editorForm.image_url}
                            alt="preview"
                            className="max-h-[200px] w-full rounded-md object-cover"
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">Превью изображения</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Периоды</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <FieldBlock label="active_from *" error={fieldErrors.active_from}>
                          <Input
                            type="datetime-local"
                            value={editorForm.active_from}
                            onChange={(event) => setEditorField("active_from", event.target.value)}
                          />
                        </FieldBlock>

                        <FieldBlock label="active_to *" error={fieldErrors.active_to}>
                          <Input
                            type="datetime-local"
                            value={editorForm.active_to}
                            onChange={(event) => setEditorField("active_to", event.target.value)}
                          />
                        </FieldBlock>
                      </div>

                      <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="pt-6">
                          <p className="text-sm text-blue-800">
                            Окно claim после завершения задания фиксированное: <span className="font-bold">{CLAIM_WINDOW_DAYS} дней</span>{" "}
                            (не настраивается).
                          </p>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Тип задания и условия</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
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
                      </div>

                      <div className="space-y-3">
                        {editorForm.task_type === "add_to_cart" || editorForm.task_type === "add_to_favorites" ? (
                          <FieldBlock label="Количество товаров *" error={fieldErrors.condition_items_count}>
                            <Input
                              type="number"
                              min="1"
                              value={editorForm.condition_items_count}
                              onChange={(event) => setEditorField("condition_items_count", event.target.value)}
                            />
                          </FieldBlock>
                        ) : null}

                        {editorForm.task_type === "purchase_amount" ? (
                          <FieldBlock label="Минимальная сумма заказа (₽) *" error={fieldErrors.condition_min_amount}>
                            <Input
                              type="number"
                              min="1"
                              value={editorForm.condition_min_amount}
                              onChange={(event) => setEditorField("condition_min_amount", event.target.value)}
                            />
                          </FieldBlock>
                        ) : null}

                        {editorForm.task_type === "purchase_category" ? (
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <FieldBlock label="category_id *" error={fieldErrors.condition_category_id}>
                              <Input
                                value={editorForm.condition_category_id}
                                onChange={(event) => setEditorField("condition_category_id", event.target.value)}
                                placeholder="electronics"
                              />
                            </FieldBlock>

                            <FieldBlock label="Минимальная сумма заказа (₽) *" error={fieldErrors.condition_min_amount}>
                              <Input
                                type="number"
                                min="1"
                                value={editorForm.condition_min_amount}
                                onChange={(event) => setEditorField("condition_min_amount", event.target.value)}
                              />
                            </FieldBlock>
                          </div>
                        ) : null}

                        {editorForm.task_type === "purchase_seller" ? (
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <FieldBlock label="seller_id *" error={fieldErrors.condition_seller_id}>
                              <Input
                                value={editorForm.condition_seller_id}
                                onChange={(event) => setEditorField("condition_seller_id", event.target.value)}
                                placeholder="seller-123"
                              />
                            </FieldBlock>

                            <FieldBlock label="Минимальная сумма заказа (₽) *" error={fieldErrors.condition_min_amount}>
                              <Input
                                type="number"
                                min="1"
                                value={editorForm.condition_min_amount}
                                onChange={(event) => setEditorField("condition_min_amount", event.target.value)}
                              />
                            </FieldBlock>
                          </div>
                        ) : null}

                        {editorForm.task_type === "visit_url" || editorForm.task_type === "visit_external_url" ? (
                          <FieldBlock label="URL для проверки факта посещения *" error={fieldErrors.condition_url}>
                            <Input
                              value={editorForm.condition_url}
                              onChange={(event) => setEditorField("condition_url", event.target.value)}
                              placeholder="https://example.com"
                            />
                          </FieldBlock>
                        ) : null}

                        {editorForm.task_type === "visit_app_screen" ? (
                          <FieldBlock label="app_screen *" error={fieldErrors.condition_app_screen}>
                            <Input
                              value={editorForm.condition_app_screen}
                              onChange={(event) => setEditorField("condition_app_screen", event.target.value)}
                              placeholder="profile/home"
                            />
                          </FieldBlock>
                        ) : null}

                        {conditionErrors.length > 1 ? (
                          <p className="text-sm text-rose-600">Проверьте поля условий выполнения задания.</p>
                        ) : null}
                      </div>

                      <FieldBlock label="target_value *" error={fieldErrors.target_value}>
                        <Input
                          value={editorForm.target_value}
                          onChange={(event) => setEditorField("target_value", event.target.value)}
                          placeholder="/catalog или https://... или app://screen"
                        />
                      </FieldBlock>

                      {PURCHASE_TYPES.includes(editorForm.task_type) ? (
                        <Card className="border-dashed bg-slate-50">
                          <CardHeader>
                            <CardTitle className="text-base">Фиксированный период покупок (только для purchase)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                              <FieldBlock label="purchase_period_from *" error={fieldErrors.purchase_period_from}>
                                <Input
                                  type="date"
                                  value={editorForm.purchase_period_from}
                                  onChange={(event) => setEditorField("purchase_period_from", event.target.value)}
                                />
                              </FieldBlock>

                              <FieldBlock label="purchase_period_to *" error={fieldErrors.purchase_period_to}>
                                <Input
                                  type="date"
                                  value={editorForm.purchase_period_to}
                                  onChange={(event) => setEditorField("purchase_period_to", event.target.value)}
                                />
                              </FieldBlock>
                            </div>
                          </CardContent>
                        </Card>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Награды</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2 text-sm font-medium">
                          <Checkbox
                            checked={editorForm.reward_bonus}
                            onCheckedChange={(checked) => setEditorField("reward_bonus", checked === true)}
                          />
                          bonus
                        </label>

                        <label className="inline-flex items-center gap-2 text-sm font-medium">
                          <Checkbox
                            checked={editorForm.reward_promocode}
                            onCheckedChange={(checked) => setEditorField("reward_promocode", checked === true)}
                          />
                          promocode
                        </label>
                      </div>

                      {fieldErrors.rewards ? <p className="text-sm text-rose-600">{fieldErrors.rewards}</p> : null}

                      {editorForm.reward_bonus ? (
                        <Card className="border-dashed bg-slate-50">
                          <CardHeader>
                            <CardTitle className="text-base">Параметры bonus</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <FieldBlock label="Количество бонусов *" error={fieldErrors.bonus_amount}>
                              <Input
                                type="number"
                                min="1"
                                value={editorForm.bonus_amount}
                                onChange={(event) => setEditorField("bonus_amount", event.target.value)}
                              />
                            </FieldBlock>
                          </CardContent>
                        </Card>
                      ) : null}

                      {editorForm.reward_promocode ? (
                        <Card className="border-dashed bg-slate-50">
                          <CardHeader>
                            <CardTitle className="text-base">Параметры promocode</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                              <FieldBlock label="Код/идентификатор *" error={fieldErrors.promocode_code}>
                                <Input
                                  value={editorForm.promocode_code}
                                  onChange={(event) => setEditorField("promocode_code", event.target.value)}
                                  placeholder="SPRING-10"
                                />
                              </FieldBlock>

                              <FieldBlock label="Срок действия *" error={fieldErrors.promocode_valid_to}>
                                <Input
                                  type="date"
                                  value={editorForm.promocode_valid_to}
                                  onChange={(event) => setEditorField("promocode_valid_to", event.target.value)}
                                />
                              </FieldBlock>
                            </div>

                            <FieldBlock label="Условия *" error={fieldErrors.promocode_terms}>
                              <Textarea
                                rows={3}
                                value={editorForm.promocode_terms}
                                onChange={(event) => setEditorField("promocode_terms", event.target.value)}
                                placeholder="Минимальная сумма, исключения, срок"
                              />
                            </FieldBlock>
                          </CardContent>
                        </Card>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card className="sticky bottom-2">
                    <CardContent className="pt-6">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" onClick={() => saveEditor(false)}>
                          Сохранить черновик
                        </Button>
                        <Button onClick={() => saveEditor(true)}>Опубликовать</Button>
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
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeConfirmDialog}>
              Отмена
            </Button>
            <Button
              variant={confirmDialog.danger ? "destructive" : "default"}
              onClick={() => {
                confirmDialog.action?.()
                closeConfirmDialog()
              }}
            >
              {confirmDialog.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Выберите значение" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value || "empty"} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface FieldBlockProps {
  label: string
  children: ReactNode
  error?: string
  hint?: string
  className?: string
}

function FieldBlock(props: FieldBlockProps) {
  const { label, children, error, hint, className } = props

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  )
}

export default App
