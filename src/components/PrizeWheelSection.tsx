import { type ReactNode, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, Gift, Plus, RotateCcw, Save, Settings2, Trash2 } from "lucide-react"

import {
  MOCK_WHEEL_CONFIGURATION,
  MOCK_WHEEL_SPINS,
  type WheelChannel,
  type WheelConfiguration,
  type WheelPrize,
  type WheelPromocodeMode,
  type WheelRewardType,
  type WheelSpinStatus,
  WHEEL_CHANNEL_LABELS,
  WHEEL_REWARD_TYPE_LABELS,
  WHEEL_SPIN_STATUS_LABELS,
} from "@/admin/prizeWheel"
import { MOCK_PERSONAL_TEMPLATES } from "@/admin/personalPromo"
import { formatDateTime, parseDate } from "@/admin/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface PrizeWheelSectionProps {
  globalSearch: string
  onOpenMvpPrototype: () => void
  onOpenFullPrototype: () => void
}

type WheelTab = "settings" | "spins"

interface SpinFilters {
  status: "all" | WheelSpinStatus
  rewardType: "all" | WheelRewardType
}

interface SectionFlash {
  type: "success" | "error" | "info"
  text: string
}

const SPIN_STATUS_VARIANT: Record<WheelSpinStatus, "default" | "secondary" | "outline" | "destructive"> = {
  claim_pending: "outline",
  reward_issuing: "secondary",
  reward_issued: "default",
  reward_failed: "destructive",
  claim_expired: "outline",
}

function deepCloneConfiguration(configuration: WheelConfiguration): WheelConfiguration {
  return {
    ...configuration,
    channels: [...configuration.channels],
    prizes: configuration.prizes.map((prize) => ({ ...prize })),
  }
}

function toDateTimeInput(date: Date): string {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function createPrize(configuration: WheelConfiguration): WheelPrize {
  const start = new Date()
  const end = new Date(start.getTime() + 30 * 86400000)
  const order = configuration.prizes.length + 1
  return {
    id: `prize_${Math.random().toString(36).slice(2, 9)}`,
    display_name: "",
    description: "",
    image_url: "",
    action_button_text: "Перейти в каталог",
    action_button_url: "/catalog",
    display_from: toDateTimeInput(start),
    display_to: toDateTimeInput(end),
    selection_weight: 100,
    total_stock: null,
    repeatable_per_user: true,
    issued_count: 0,
    status: "active",
    visual_order: order,
    reward_type: "promocode",
    one_c_marketing_event_id: null,
    bonus_amount: null,
    points_amount: null,
    points_ttl_days: null,
    promocode_mode: "personal",
    personal_promocode_template_key: "",
    shared_promocode_code: null,
  }
}

function isValidLink(value: string): boolean {
  return value.startsWith("/") || value.startsWith("https://") || value.startsWith("http://") || value.startsWith("app://")
}

function effectiveProbability(prize: WheelPrize, prizes: WheelPrize[]): number {
  const now = new Date()
  const available = prizes.filter((item) => {
    const displayFrom = parseDate(item.display_from)
    const displayTo = parseDate(item.display_to)
    return (
      item.status === "active" &&
      displayFrom !== null &&
      displayTo !== null &&
      displayFrom <= now &&
      now <= displayTo &&
      (item.total_stock === null || item.issued_count < item.total_stock)
    )
  })
  const sum = available.reduce((acc, item) => acc + item.selection_weight, 0)
  if (sum <= 0 || !available.some((item) => item.id === prize.id)) {
    return 0
  }
  return (prize.selection_weight / sum) * 100
}

function formatProbability(value: number): string {
  if (value === 0) {
    return "0%"
  }
  if (value >= 1) {
    return `${value.toFixed(2)}%`
  }
  if (value >= 0.01) {
    return `${value.toFixed(4)}%`
  }
  return `${value.toFixed(8).replace(/0+$/, "")}%`
}

function FieldBlock(props: { label: string; hint?: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <Field className={props.className} data-invalid={Boolean(props.error)}>
      <FieldLabel>{props.label}</FieldLabel>
      {props.children}
      {props.hint ? <FieldDescription>{props.hint}</FieldDescription> : null}
      {props.error ? <FieldError>{props.error}</FieldError> : null}
    </Field>
  )
}

function SelectField(props: {
  label: string
  value: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
  onChange: (value: string) => void
  hint?: string
}) {
  return (
    <Field>
      <FieldLabel>{props.label}</FieldLabel>
      <Select value={props.value} onValueChange={props.onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {props.hint ? <FieldDescription>{props.hint}</FieldDescription> : null}
    </Field>
  )
}

export function PrizeWheelSection({ globalSearch, onOpenMvpPrototype, onOpenFullPrototype }: PrizeWheelSectionProps) {
  const [configuration, setConfiguration] = useState<WheelConfiguration>(() =>
    deepCloneConfiguration(MOCK_WHEEL_CONFIGURATION),
  )
  const [tab, setTab] = useState<WheelTab>("settings")
  const [form, setForm] = useState<WheelConfiguration>(() => deepCloneConfiguration(MOCK_WHEEL_CONFIGURATION))
  const [selectedPrizeId, setSelectedPrizeId] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState<SectionFlash | null>(null)
  const [spinFilters, setSpinFilters] = useState<SpinFilters>({ status: "all", rewardType: "all" })

  useEffect(() => {
    if (!flash) {
      return
    }
    const timeout = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(timeout)
  }, [flash])

  const query = globalSearch.trim().toLowerCase()
  const allPrizesById = useMemo(
    () => new Map(configuration.prizes.map((prize) => [prize.id, prize] as const)),
    [configuration.prizes],
  )

  const filteredSpins = useMemo(
    () =>
      MOCK_WHEEL_SPINS.filter((spin) => {
        const prize = allPrizesById.get(spin.prize_id)
        const haystack = `${spin.id} ${spin.user_id} ${spin.phone} ${prize?.display_name ?? ""}`.toLowerCase()
        if (query && !haystack.includes(query)) {
          return false
        }
        if (spinFilters.status !== "all" && spin.status !== spinFilters.status) {
          return false
        }
        if (spinFilters.rewardType !== "all" && spin.reward_type !== spinFilters.rewardType) {
          return false
        }
        return true
      }),
    [allPrizesById, query, spinFilters],
  )

  const selectedPrize = form.prizes.find((prize) => prize.id === selectedPrizeId) ?? null
  function setConfigurationField<K extends keyof WheelConfiguration>(key: K, value: WheelConfiguration[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function setPrizeField<K extends keyof WheelPrize>(prizeId: string, key: K, value: WheelPrize[K]) {
    setForm((previous) => ({
      ...previous,
      prizes: previous.prizes.map((prize) => (prize.id === prizeId ? { ...prize, [key]: value } : prize)),
    }))
  }

  function setPrizeRewardType(prizeId: string, rewardType: WheelRewardType) {
    setForm((previous) => ({
      ...previous,
      prizes: previous.prizes.map((prize) => {
        if (prize.id !== prizeId) {
          return prize
        }
        return {
          ...prize,
          reward_type: rewardType,
          one_c_marketing_event_id: rewardType === "bonus" ? prize.one_c_marketing_event_id : null,
          bonus_amount: rewardType === "bonus" ? prize.bonus_amount : null,
          points_amount: rewardType === "activity_points" ? prize.points_amount : null,
          points_ttl_days: rewardType === "activity_points" ? prize.points_ttl_days : null,
          promocode_mode: rewardType === "promocode" ? prize.promocode_mode ?? "personal" : null,
          personal_promocode_template_key:
            rewardType === "promocode" ? prize.personal_promocode_template_key : null,
          shared_promocode_code: rewardType === "promocode" ? prize.shared_promocode_code : null,
        }
      }),
    }))
  }

  function addPrize() {
    const prize = createPrize(form)
    setForm((previous) => ({ ...previous, prizes: [...previous.prizes, prize] }))
    setSelectedPrizeId(prize.id)
  }

  function removePrize(prizeId: string) {
    setForm((previous) => {
      const next = previous.prizes
        .filter((prize) => prize.id !== prizeId)
        .map((prize, index) => ({ ...prize, visual_order: index + 1 }))
      setSelectedPrizeId(next[0]?.id ?? null)
      return { ...previous, prizes: next }
    })
  }

  function movePrize(prizeId: string, direction: -1 | 1) {
    setForm((previous) => {
      const ordered = [...previous.prizes].sort((a, b) => a.visual_order - b.visual_order)
      const currentIndex = ordered.findIndex((prize) => prize.id === prizeId)
      const nextIndex = currentIndex + direction
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ordered.length) {
        return previous
      }
      const [moved] = ordered.splice(currentIndex, 1)
      ordered.splice(nextIndex, 0, moved)
      return { ...previous, prizes: ordered.map((prize, index) => ({ ...prize, visual_order: index + 1 })) }
    })
  }

  function validate(publish: boolean): { errors: string[]; fields: Record<string, string> } {
    const errors: string[] = []
    const fields: Record<string, string> = {}
    const addError = (field: string, message: string) => {
      fields[field] = message
      errors.push(message)
    }

    if (!form.title.trim()) addError("title", "Заголовок для пользователя обязателен")
    if (!form.description.trim()) addError("description", "Описание колеса обязательно")
    if (!isValidLink(form.game_rules_url)) addError("game_rules_url", "Укажите корректную ссылку на «Правила игры»")
    if (form.channels.length === 0) addError("channels", "Выберите хотя бы один канал")
    if (publish && form.prizes.length === 0) addError("prizes", "Для публикации добавьте хотя бы один приз")

    const eventIds = new Set<string>()

    form.prizes.forEach((prize, index) => {
      const prefix = `prize.${prize.id}`
      const label = `Приз ${index + 1}`
      if (!prize.display_name.trim()) addError(`${prefix}.display_name`, `${label}: название приза обязательно`)
      if (!prize.description.trim()) addError(`${prefix}.description`, `${label}: описание обязательно`)
      if (!prize.image_url.trim()) addError(`${prefix}.image_url`, `${label}: изображение обязательно`)
      if (!prize.action_button_text.trim()) addError(`${prefix}.action_button_text`, `${label}: текст кнопки обязателен`)
      if (!isValidLink(prize.action_button_url)) addError(`${prefix}.action_button_url`, `${label}: укажите корректную ссылку кнопки`)
      if (!Number.isInteger(prize.selection_weight) || prize.selection_weight <= 0) {
        addError(`${prefix}.selection_weight`, `${label}: вес должен быть целым числом больше 0`)
      }
      if (prize.total_stock !== null && (!Number.isInteger(prize.total_stock) || prize.total_stock <= 0)) {
        addError(`${prefix}.total_stock`, `${label}: запас должен быть пустым или целым числом больше 0`)
      }
      const displayFrom = parseDate(prize.display_from)
      const displayTo = parseDate(prize.display_to)
      if (!displayFrom || !displayTo || displayFrom >= displayTo) {
        addError(`${prefix}.display_to`, `${label}: проверьте период показа`)
      }

      if (prize.reward_type === "bonus") {
        const eventId = prize.one_c_marketing_event_id?.trim() ?? ""
        if (!eventId) addError(`${prefix}.one_c_marketing_event_id`, `${label}: идентификатор мероприятия 1С обязателен`)
        if (eventId && eventIds.has(eventId)) {
          addError(`${prefix}.one_c_marketing_event_id`, `${label}: мероприятие 1С уже используется другим бонусным призом`)
        }
        eventIds.add(eventId)
        if (!prize.bonus_amount || prize.bonus_amount <= 0) addError(`${prefix}.bonus_amount`, `${label}: количество бонусов должно быть больше 0`)
      }

      if (prize.reward_type === "activity_points") {
        if (publish) {
          addError(`${prefix}.reward_type`, `${label}: очки активности станут доступны только в полной версии`)
        }
        if (!prize.points_amount || prize.points_amount <= 0) addError(`${prefix}.points_amount`, `${label}: количество очков должно быть больше 0`)
        if (!prize.points_ttl_days || !Number.isInteger(prize.points_ttl_days) || prize.points_ttl_days <= 0) {
          addError(`${prefix}.points_ttl_days`, `${label}: срок жизни очков в днях обязателен`)
        }
      }

      if (prize.reward_type === "physical_prize") {
        if (publish) {
          addError(`${prefix}.reward_type`, `${label}: физические призы станут доступны только в полной версии`)
        }
        if (prize.total_stock === null || !Number.isInteger(prize.total_stock) || prize.total_stock <= 0) {
          addError(`${prefix}.total_stock`, `${label}: для физического приза обязателен запас больше 0`)
        }
      }

      if (prize.reward_type === "promocode") {
        if (prize.promocode_mode === "personal" && !prize.personal_promocode_template_key?.trim()) {
          addError(`${prefix}.personal_promocode_template_key`, `${label}: выберите шаблон персонального промокода`)
        }
        if (prize.promocode_mode === "shared" && !prize.shared_promocode_code?.trim()) {
          addError(`${prefix}.shared_promocode_code`, `${label}: укажите общий промокод`)
        }
      }
    })

    return { errors, fields }
  }

  function save(publish: boolean) {
    const validation = validate(publish)
    setFormErrors(validation.errors)
    setFieldErrors(validation.fields)
    if (validation.errors.length > 0) {
      setFlash({ type: "error", text: "Проверьте обязательные поля колеса и призов" })
      return
    }

    const payload: WheelConfiguration = {
      ...form,
      config_version: publish ? form.config_version + 1 : form.config_version,
      prizes: form.prizes.map((prize, index) => ({ ...prize, visual_order: index + 1 })),
    }

    setConfiguration(deepCloneConfiguration(payload))
    setForm(deepCloneConfiguration(payload))
    setFlash({ type: "success", text: publish ? `Опубликована версия v${payload.config_version}` : "Настройки сохранены" })
    setSelectedPrizeId(null)
  }

  function saveSelectedPrize(prizeId: string) {
    const validation = validate(false)
    const prefix = `prize.${prizeId}.`
    const prizeFieldErrors = Object.fromEntries(
      Object.entries(validation.fields).filter(([field]) => field.startsWith(prefix)),
    )
    const prizeErrors = Object.values(prizeFieldErrors)

    setFieldErrors((previous) => ({
      ...Object.fromEntries(Object.entries(previous).filter(([field]) => !field.startsWith(prefix))),
      ...prizeFieldErrors,
    }))

    if (prizeErrors.length > 0) {
      setFormErrors(prizeErrors)
      setFlash({ type: "error", text: "Проверьте обязательные поля приза" })
      return
    }

    setFormErrors([])
    setFlash({ type: "success", text: "Приз сохранён в настройках" })
    setSelectedPrizeId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Колесо призов</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Одна постоянная механика: настройки, призы, веса выпадения и контроль выдачи наград.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={tab === "settings" ? "default" : "secondary"} onClick={() => setTab("settings")}>
            Настройки колеса
          </Button>
          <Button variant={tab === "spins" ? "default" : "secondary"} onClick={() => setTab("spins")}>
            Реестр вращений
          </Button>
          <Button variant="outline" onClick={onOpenMvpPrototype}>
            <ExternalLink aria-hidden="true" />
            Открыть MVP
          </Button>
          <Button variant="outline" onClick={onOpenFullPrototype}>
            <ExternalLink aria-hidden="true" />
            Открыть полную версию
          </Button>
        </div>
      </div>

      {flash ? (
        <Alert variant={flash.type === "error" ? "destructive" : "default"}>
          <AlertTitle>{flash.type === "error" ? "Проверьте настройки" : "Готово"}</AlertTitle>
          <AlertDescription>{flash.text}</AlertDescription>
        </Alert>
      ) : null}

      <Card className={cn(!form.wheel_visibility_enabled && "border-amber-300 bg-amber-50/60")}>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-secondary p-2 text-secondary-foreground">
              {form.wheel_visibility_enabled ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            </div>
            <div>
              <p className="font-semibold">Показывать колесо пользователям</p>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Флаг MVP. При выключении колесо исчезает из всех точек входа, не открывается по прямой
                ссылке, а новые вращения блокируются. Настройки, остаток вращений и история сохраняются.
              </p>
            </div>
          </div>
          <Field orientation="horizontal" className="w-auto shrink-0">
            <Checkbox
              checked={form.wheel_visibility_enabled}
              onCheckedChange={(checked) => {
                setConfigurationField("wheel_visibility_enabled", checked === true)
                setFlash({
                  type: "info",
                  text:
                    checked === true
                      ? "Колесо будет показываться после сохранения настройки"
                      : "Колесо будет скрыто после сохранения настройки",
                })
              }}
              aria-label="Показывать колесо во всех локациях"
            />
            <FieldLabel>{form.wheel_visibility_enabled ? "Включено" : "Выключено"}</FieldLabel>
          </Field>
        </CardContent>
      </Card>

      {tab === "spins" ? (
        <>
          <Card>
            <CardHeader><CardTitle>Фильтры реестра</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SelectField
                label="Тип награды"
                value={spinFilters.rewardType}
                options={[
                  { value: "all", label: "Все типы" },
                  ...Object.entries(WHEEL_REWARD_TYPE_LABELS)
                    .filter(([value]) => value !== "activity_points" && value !== "physical_prize")
                    .map(([value, label]) => ({ value, label })),
                ]}
                onChange={(value) => setSpinFilters((previous) => ({ ...previous, rewardType: value as SpinFilters["rewardType"] }))}
              />
              <SelectField
                label="Статус"
                value={spinFilters.status}
                options={[{ value: "all", label: "Все статусы" }, ...Object.entries(WHEEL_SPIN_STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
                onChange={(value) => setSpinFilters((previous) => ({ ...previous, status: value as SpinFilters["status"] }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>spin_id / дата</TableHead>
                      <TableHead>Пользователь</TableHead>
                      <TableHead>Приз</TableHead>
                      <TableHead>Версия</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Операция / повторы</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSpins.map((spin) => {
                      const prize = allPrizesById.get(spin.prize_id)
                      return (
                        <TableRow key={spin.id}>
                          <TableCell><p className="font-semibold">{spin.id}</p><p className="text-xs text-muted-foreground">{formatDateTime(spin.created_at)}</p></TableCell>
                          <TableCell><p>{spin.user_id}</p><p className="text-xs text-muted-foreground">{spin.phone}</p></TableCell>
                          <TableCell><p className="font-medium">{prize?.display_name ?? spin.prize_id}</p><Badge variant="outline">{WHEEL_REWARD_TYPE_LABELS[spin.reward_type]}</Badge></TableCell>
                          <TableCell>v{spin.config_version}</TableCell>
                          <TableCell><Badge variant={SPIN_STATUS_VARIANT[spin.status]}>{WHEEL_SPIN_STATUS_LABELS[spin.status]}</Badge></TableCell>
                          <TableCell><p>{spin.external_operation_id ?? "—"}</p><p className="text-xs text-muted-foreground">Повторов: {spin.retries}</p></TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {tab === "settings" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold">Настройки общего колеса</h3>
              <p className="mt-1 text-sm text-muted-foreground">Пять бесплатных вращений выдаются каждому авторизованному пользователю один раз за всё время.</p>
            </div>
            <Badge variant="outline">Опубликована версия v{configuration.config_version}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Участники</p><p className="mt-1 text-2xl font-semibold tabular-nums">{configuration.participants_count.toLocaleString("ru-RU")}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Вращения</p><p className="mt-1 text-2xl font-semibold tabular-nums">{configuration.spins_count.toLocaleString("ru-RU")}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Награды выданы</p><p className="mt-1 text-2xl font-semibold tabular-nums">{configuration.rewards_issued_count.toLocaleString("ru-RU")}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Ошибки выдачи</p><p className="mt-1 text-2xl font-semibold tabular-nums">{configuration.errors_count.toLocaleString("ru-RU")}</p></CardContent></Card>
          </div>

          {formErrors.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Проверьте настройки</AlertTitle>
              <AlertDescription><ul className="ml-4 list-disc space-y-1">{formErrors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}</ul>{formErrors.length > 8 ? <p className="mt-2">И ещё ошибок: {formErrors.length - 8}</p> : null}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-4">
              <Card>
                <CardHeader><CardTitle>Основные настройки</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <FieldBlock label="Заголовок для пользователя *" error={fieldErrors.title}>
                    <Input value={form.title} onChange={(event) => setConfigurationField("title", event.target.value)} placeholder="Крутите колесо и забирайте приз" />
                  </FieldBlock>
                  <FieldBlock label="Описание *" error={fieldErrors.description}>
                    <Textarea value={form.description} onChange={(event) => setConfigurationField("description", event.target.value)} rows={3} />
                  </FieldBlock>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    <FieldBlock label="Бесплатных вращений" hint="Один раз за всё время"><Input value="5" readOnly /></FieldBlock>
                    <FieldBlock label="Срок получения приза" hint="С момента выигрыша"><Input value="7 дней" readOnly /></FieldBlock>
                    <SelectField label="Аудитория" value={form.audience} options={[{ value: "all_authorized", label: "Все авторизованные" }, { value: "test_group", label: "Тестовая группа" }]} onChange={(value) => setConfigurationField("audience", value as WheelConfiguration["audience"])} />
                    <FieldBlock label="Ссылка «Правила игры» *" error={fieldErrors.game_rules_url}><Input value={form.game_rules_url} onChange={(event) => setConfigurationField("game_rules_url", event.target.value)} placeholder="/game-rules/prize-wheel" /></FieldBlock>
                  </div>
                  <FieldBlock label="Каналы *" error={fieldErrors.channels}>
                    <div className="flex flex-wrap gap-5 rounded-md border p-3">
                      {(Object.keys(WHEEL_CHANNEL_LABELS) as WheelChannel[]).map((channel) => (
                        <Field key={channel} orientation="horizontal" className="w-auto">
                          <Checkbox checked={form.channels.includes(channel)} onCheckedChange={(checked) => setConfigurationField("channels", checked === true ? [...new Set([...form.channels, channel])] : form.channels.filter((item) => item !== channel))} />
                          <FieldLabel>{WHEEL_CHANNEL_LABELS[channel]}</FieldLabel>
                        </Field>
                      ))}
                    </div>
                  </FieldBlock>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><CardTitle>Призы</CardTitle><p className="mt-1 text-sm text-muted-foreground">В пользовательском интерфейсе доступные пользователю призы прокручиваются горизонтальной лентой. Вес влияет только на выбор backend.</p></div>
                    <Button onClick={addPrize}><Plus aria-hidden="true" />Добавить приз</Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {fieldErrors.prizes ? <p className="text-sm font-medium text-destructive">{fieldErrors.prizes}</p> : null}
                  {form.prizes.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center"><Gift className="mx-auto text-muted-foreground" aria-hidden="true" /><p className="mt-3 font-medium">Пока нет призов</p><p className="mt-1 text-sm text-muted-foreground">В MVP добавьте бонусы или промокод.</p></div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {[...form.prizes].sort((a, b) => a.visual_order - b.visual_order).map((prize, index) => (
                        <button key={prize.id} type="button" onClick={() => setSelectedPrizeId(prize.id)} className={cn("flex min-w-0 items-center gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition-[border-color,box-shadow,transform] active:scale-[0.96]", selectedPrizeId === prize.id && "border-primary ring-1 ring-primary")}>
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-black/10">
                            {prize.image_url ? <img src={prize.image_url} alt="" className="h-full w-full object-cover" /> : <Gift className="text-muted-foreground" aria-hidden="true" />}
                          </div>
                          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{prize.display_name || `Приз ${index + 1}`}</p><p className="mt-1 truncate text-xs text-muted-foreground">{WHEEL_REWARD_TYPE_LABELS[prize.reward_type]} · вес {prize.selection_weight} · {formatProbability(effectiveProbability(prize, form.prizes))}</p></div>
                          <Badge variant={prize.status === "active" ? "default" : "secondary"}>{index + 1}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedPrize ? (
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><CardTitle>Настройка приза</CardTitle><p className="mt-1 text-sm text-muted-foreground">{selectedPrize.display_name || "Новый приз"}</p></div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="outline" onClick={() => movePrize(selectedPrize.id, -1)} aria-label="Переместить приз выше"><ChevronUp aria-hidden="true" /></Button>
                        <Button size="icon" variant="outline" onClick={() => movePrize(selectedPrize.id, 1)} aria-label="Переместить приз ниже"><ChevronDown aria-hidden="true" /></Button>
                        <Button size="icon" variant="destructive" onClick={() => removePrize(selectedPrize.id)} aria-label="Удалить приз"><Trash2 aria-hidden="true" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <FieldBlock label="Название приза *" error={fieldErrors[`prize.${selectedPrize.id}.display_name`]}>
                      <Input value={selectedPrize.display_name} onChange={(event) => setPrizeField(selectedPrize.id, "display_name", event.target.value)} />
                    </FieldBlock>
                    <FieldBlock label="Описание *" hint="Для промокода укажите, на что он действует и в течение какого срока." error={fieldErrors[`prize.${selectedPrize.id}.description`]}><Textarea value={selectedPrize.description} onChange={(event) => setPrizeField(selectedPrize.id, "description", event.target.value)} rows={3} /></FieldBlock>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <FieldBlock label="Изображение *" error={fieldErrors[`prize.${selectedPrize.id}.image_url`]}><Input value={selectedPrize.image_url} onChange={(event) => setPrizeField(selectedPrize.id, "image_url", event.target.value)} placeholder="https://..." /></FieldBlock>
                      <FieldBlock label="Загрузить изображение"><Input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === "string") setPrizeField(selectedPrize.id, "image_url", reader.result) }; reader.readAsDataURL(file) }} /></FieldBlock>
                    </div>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <FieldBlock label="Название кнопки *" error={fieldErrors[`prize.${selectedPrize.id}.action_button_text`]}><Input value={selectedPrize.action_button_text} onChange={(event) => setPrizeField(selectedPrize.id, "action_button_text", event.target.value)} /></FieldBlock>
                      <FieldBlock label="Ссылка кнопки *" error={fieldErrors[`prize.${selectedPrize.id}.action_button_url`]}><Input value={selectedPrize.action_button_url} onChange={(event) => setPrizeField(selectedPrize.id, "action_button_url", event.target.value)} /></FieldBlock>
                    </div>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                      <FieldBlock label="Вес выпадения *" hint={`Базовая вероятность сейчас: ${formatProbability(effectiveProbability(selectedPrize, form.prizes))}`} error={fieldErrors[`prize.${selectedPrize.id}.selection_weight`]}><Input type="number" min="1" step="1" value={selectedPrize.selection_weight} onChange={(event) => setPrizeField(selectedPrize.id, "selection_weight", Number(event.target.value))} /></FieldBlock>
                      <FieldBlock label="Запас" hint="Пусто — без ограничения" error={fieldErrors[`prize.${selectedPrize.id}.total_stock`]}><Input type="number" min="1" step="1" value={selectedPrize.total_stock ?? ""} onChange={(event) => setPrizeField(selectedPrize.id, "total_stock", event.target.value === "" ? null : Number(event.target.value))} /></FieldBlock>
                      <SelectField label="Статус" value={selectedPrize.status} options={[{ value: "active", label: "Активен" }, { value: "inactive", label: "Неактивен" }]} onChange={(value) => setPrizeField(selectedPrize.id, "status", value as WheelPrize["status"])} />
                    </div>
                    <Field orientation="horizontal" className="rounded-lg border p-4">
                      <Checkbox
                        id={`repeatable-${selectedPrize.id}`}
                        checked={selectedPrize.repeatable_per_user}
                        onCheckedChange={(checked) => setPrizeField(selectedPrize.id, "repeatable_per_user", checked === true)}
                      />
                      <div className="flex flex-col gap-1">
                        <FieldLabel htmlFor={`repeatable-${selectedPrize.id}`}>Можно выиграть повторно</FieldLabel>
                        <FieldDescription>
                          Если выключено, после первого выигрыша этот приз больше не выпадает тому же пользователю.
                        </FieldDescription>
                      </div>
                    </Field>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <FieldBlock label="Показывать с *"><Input type="datetime-local" value={selectedPrize.display_from} onChange={(event) => setPrizeField(selectedPrize.id, "display_from", event.target.value)} /></FieldBlock>
                      <FieldBlock label="Показывать до *" error={fieldErrors[`prize.${selectedPrize.id}.display_to`]}><Input type="datetime-local" value={selectedPrize.display_to} onChange={(event) => setPrizeField(selectedPrize.id, "display_to", event.target.value)} /></FieldBlock>
                    </div>
                    <SelectField
                      label="Тип награды"
                      value={selectedPrize.reward_type}
                      options={Object.entries(WHEEL_REWARD_TYPE_LABELS).map(([value, label]) => ({
                        value,
                        label: value === "activity_points" || value === "physical_prize" ? `${label} — полная версия` : label,
                        disabled: value === "activity_points" || value === "physical_prize",
                      }))}
                      onChange={(value) => setPrizeRewardType(selectedPrize.id, value as WheelRewardType)}
                      hint="В MVP доступны только бонусы и промокоды. Очки активности и физические призы добавляются в полной версии."
                    />

                    {selectedPrize.reward_type === "bonus" ? (
                      <div className="grid grid-cols-1 gap-3 rounded-lg bg-muted p-4 lg:grid-cols-2">
                        <FieldBlock label="Идентификатор мероприятия 1С *" hint="Для каждого бонусного приза создаётся отдельное мероприятие." error={fieldErrors[`prize.${selectedPrize.id}.one_c_marketing_event_id`]}><Input value={selectedPrize.one_c_marketing_event_id ?? ""} onChange={(event) => setPrizeField(selectedPrize.id, "one_c_marketing_event_id", event.target.value)} /></FieldBlock>
                        <FieldBlock label="Количество бонусов *" error={fieldErrors[`prize.${selectedPrize.id}.bonus_amount`]}><Input type="number" min="1" value={selectedPrize.bonus_amount ?? ""} onChange={(event) => setPrizeField(selectedPrize.id, "bonus_amount", event.target.value === "" ? null : Number(event.target.value))} /></FieldBlock>
                        <p className="text-sm text-muted-foreground lg:col-span-2">Срок действия мероприятия и срок сгорания бонусов настраиваются в 1С. Дополнительной проверки 1С при публикации нет.</p>
                      </div>
                    ) : null}

                    {selectedPrize.reward_type === "activity_points" ? (
                      <div className="grid grid-cols-1 gap-3 rounded-lg bg-muted p-4 lg:grid-cols-2">
                        <FieldBlock label="Количество очков *" hint="Может быть больше стоимости одного вращения — 10 очков." error={fieldErrors[`prize.${selectedPrize.id}.points_amount`]}><Input type="number" min="1" value={selectedPrize.points_amount ?? ""} onChange={(event) => setPrizeField(selectedPrize.id, "points_amount", event.target.value === "" ? null : Number(event.target.value))} /></FieldBlock>
                        <FieldBlock label="Срок жизни, дней *" error={fieldErrors[`prize.${selectedPrize.id}.points_ttl_days`]}><Input type="number" min="1" step="1" value={selectedPrize.points_ttl_days ?? ""} onChange={(event) => setPrizeField(selectedPrize.id, "points_ttl_days", event.target.value === "" ? null : Number(event.target.value))} /></FieldBlock>
                      </div>
                    ) : null}

                    {selectedPrize.reward_type === "promocode" ? (
                      <div className="flex flex-col gap-3 rounded-lg bg-muted p-4">
                        <SelectField label="Режим промокода" value={selectedPrize.promocode_mode ?? "personal"} options={[{ value: "personal", label: "Индивидуальный" }, { value: "shared", label: "Общий" }]} onChange={(value) => setPrizeField(selectedPrize.id, "promocode_mode", value as WheelPromocodeMode)} />
                        {selectedPrize.promocode_mode === "personal" ? (
                          <FieldBlock label="Шаблон индивидуального промокода *" error={fieldErrors[`prize.${selectedPrize.id}.personal_promocode_template_key`]}>
                            <Select value={selectedPrize.personal_promocode_template_key ?? ""} onValueChange={(value) => setPrizeField(selectedPrize.id, "personal_promocode_template_key", value)}>
                              <SelectTrigger><SelectValue placeholder="Выберите активный шаблон" /></SelectTrigger>
                              <SelectContent>{MOCK_PERSONAL_TEMPLATES.filter((template) => template.status === "active").map((template) => <SelectItem key={template.key} value={template.key}>{template.name} · {template.key}</SelectItem>)}</SelectContent>
                            </Select>
                          </FieldBlock>
                        ) : (
                          <FieldBlock label="Общий промокод *" hint="Общий код — отдельный режим, не fallback для персонального." error={fieldErrors[`prize.${selectedPrize.id}.shared_promocode_code`]}><Input value={selectedPrize.shared_promocode_code ?? ""} onChange={(event) => setPrizeField(selectedPrize.id, "shared_promocode_code", event.target.value)} /></FieldBlock>
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter className="justify-end border-t pt-4">
                    <Button onClick={() => saveSelectedPrize(selectedPrize.id)}>
                      <Save aria-hidden="true" />
                      Сохранить приз
                    </Button>
                  </CardFooter>
                </Card>
              ) : null}
            </div>

            <Card>
              <CardHeader><CardTitle>Правила механики</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 text-sm text-muted-foreground md:grid-cols-2">
                <p>Каждое вращение гарантирует один приз. Варианта «Без приза» нет.</p>
                <p>Пользователь видит горизонтальную ленту доступных ему призов без весов и процентов.</p>
                <p>Backend заранее фиксирует результат, после чего лента останавливается на выбранном призе.</p>
                <p>Незабранный или выдающийся приз хранится во вкладке «Вы выиграли» и не блокирует следующее вращение.</p>
                <p>Запас закончился — приз исключается, остальные продолжают выпадать по своим весам.</p>
                <p>Повторный выигрыш настраивается для каждого приза; при запрете приз исчезает из пула пользователя после первого выигрыша.</p>
                <p>В MVP призами являются только бонусы и промокоды.</p>
                <p>В полной версии добавляются очки активности как приз и оплата вращения, а также физические призы.</p>
              </CardContent>
            </Card>
          </div>

          <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t bg-background/95 py-4 backdrop-blur sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => save(false)}><Settings2 aria-hidden="true" />Сохранить настройки</Button>
            <Button onClick={() => save(true)}><RotateCcw aria-hidden="true" />Опубликовать версию</Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
