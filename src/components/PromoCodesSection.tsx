import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react"

import {
  calcCategoryCoverage,
  type CategoryScope,
  CATEGORY_SCOPE_OPTIONS,
  type PromoCategoryOption,
  type PromoChannel,
  PROMO_CHANNEL_OPTIONS,
  PROMO_CATEGORY_OPTIONS,
  type PromoCodeEntity,
  type PromoDiscountType,
  PROMO_DISCOUNT_TYPE_OPTIONS,
  type PromoFirstOrderFilter,
  formatRub,
  formatPromoSellerList,
  MOCK_PROMO_CODES,
  normalizeKeywordList,
  PROMO_CHANNEL_LABELS,
  PROMO_SELLER_OPTIONS,
  type PromoStatus,
  PROMO_STATUS_LABELS,
  PROMO_STATUS_OPTIONS,
  PROMO_DISCOUNT_TYPE_LABELS,
  splitTokens,
  summarizeCategoryRules,
  summarizeTitleRules,
  type PromoTitleRulesFilter,
} from "@/admin/promoRegistry"
import { formatDate, parseDate } from "@/admin/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface PromoCodesSectionProps {
  globalSearch: string
  createSignal: number
}

interface PromoFilters {
  code: string
  status: "all" | PromoStatus
  activeFrom: string
  activeTo: string
  channel: "all" | PromoChannel
  firstOrderOnly: PromoFirstOrderFilter
  hasTitleRules: PromoTitleRulesFilter
}

interface PromoForm {
  status: PromoStatus
  name: string
  code: string
  start_date: string
  end_date: string
  discount_type: PromoDiscountType
  discount_value: string
  max_discount: string
  min_order_amount: string
  channels: PromoChannel[]
  counter: string
  per_user_limit: string
  first_order_only: boolean
  seller_ids: string[]
  include_category_ids: string[]
  exclude_category_ids: string[]
  include_category_scopes: Record<string, CategoryScope>
  exclude_category_scopes: Record<string, CategoryScope>
  include_title_keywords: string[]
  exclude_title_keywords: string[]
  internal_comment: string
}

interface PromoFlash {
  type: "success" | "error" | "info"
  text: string
}

const PROMO_STATUS_CLASS: Record<PromoStatus, string> = {
  draft: "border-slate-300 bg-slate-100 text-slate-700",
  active: "border-emerald-200 bg-emerald-100 text-emerald-700",
  inactive: "border-amber-200 bg-amber-100 text-amber-700",
  expired: "border-rose-200 bg-rose-100 text-rose-700",
}

const CATEGORY_BY_ID = new Map(PROMO_CATEGORY_OPTIONS.map((item) => [item.id, item]))

function createPromoForm(): PromoForm {
  const now = new Date()
  const end = new Date(now.getTime() + 30 * 86400000)

  return {
    status: "draft",
    name: "",
    code: "",
    start_date: now.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    discount_type: "percent",
    discount_value: "",
    max_discount: "",
    min_order_amount: "",
    channels: ["web"],
    counter: "",
    per_user_limit: "",
    first_order_only: false,
    seller_ids: [],
    include_category_ids: [],
    exclude_category_ids: [],
    include_category_scopes: {},
    exclude_category_scopes: {},
    include_title_keywords: [],
    exclude_title_keywords: [],
    internal_comment: "",
  }
}

function promoToForm(promo: PromoCodeEntity): PromoForm {
  return {
    status: promo.status,
    name: promo.name,
    code: promo.code,
    start_date: promo.start_date,
    end_date: promo.end_date,
    discount_type: promo.discount_type,
    discount_value: String(promo.discount_value),
    max_discount: promo.max_discount === null ? "" : String(promo.max_discount),
    min_order_amount: promo.min_order_amount === null ? "" : String(promo.min_order_amount),
    channels: [...promo.channels],
    counter: promo.counter === null ? "" : String(promo.counter),
    per_user_limit: promo.per_user_limit === null ? "" : String(promo.per_user_limit),
    first_order_only: promo.first_order_only,
    seller_ids: [...promo.seller_ids],
    include_category_ids: [...promo.include_category_ids],
    exclude_category_ids: [...promo.exclude_category_ids],
    include_category_scopes: { ...promo.include_category_scopes },
    exclude_category_scopes: { ...promo.exclude_category_scopes },
    include_title_keywords: [...promo.include_title_keywords],
    exclude_title_keywords: [...promo.exclude_title_keywords],
    internal_comment: promo.internal_comment,
  }
}

function getAncestors(categoryId: string): string[] {
  const ancestors: string[] = []
  let current = CATEGORY_BY_ID.get(categoryId)

  while (current?.parent_id) {
    ancestors.push(current.parent_id)
    current = CATEGORY_BY_ID.get(current.parent_id)
  }

  return ancestors
}

function dedupeCategorySelection(
  selectedIds: string[],
  scopes: Record<string, CategoryScope>,
): { ids: string[]; scopes: Record<string, CategoryScope> } {
  const selectedSet = new Set(selectedIds)

  for (const id of selectedIds) {
    for (const ancestorId of getAncestors(id)) {
      if (selectedSet.has(ancestorId) && scopes[ancestorId] === "with_children") {
        selectedSet.delete(id)
        break
      }
    }
  }

  const ids = Array.from(selectedSet)
  const nextScopes = Object.fromEntries(Object.entries(scopes).filter(([id]) => selectedSet.has(id)))

  return { ids, scopes: nextScopes }
}

export function PromoCodesSection(props: PromoCodesSectionProps) {
  const { globalSearch, createSignal } = props

  const [promos, setPromos] = useState<PromoCodeEntity[]>(MOCK_PROMO_CODES)
  const [mode, setMode] = useState<"list" | "create">("list")
  const [filters, setFilters] = useState<PromoFilters>({
    code: "",
    status: "all",
    activeFrom: "",
    activeTo: "",
    channel: "all",
    firstOrderOnly: "all",
    hasTitleRules: "all",
  })

  const [form, setForm] = useState<PromoForm>(createPromoForm)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState<PromoFlash | null>(null)
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null)

  useEffect(() => {
    if (createSignal === 0) {
      return
    }

    setMode("create")
    setEditingPromoId(null)
    setForm(createPromoForm())
    setFormErrors([])
    setFieldErrors({})
  }, [createSignal])

  useEffect(() => {
    if (!flash) {
      return
    }

    const timeout = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(timeout)
  }, [flash])

  const query = globalSearch.trim().toLowerCase()

  const filteredPromos = useMemo(() => {
    const rows = promos.filter((item) => {
      if (query) {
        const haystack =
          `${item.code} ${item.name} ${item.discount_id} ${item.seller_ids.join(" ")} ${formatPromoSellerList(item.seller_ids)}`.toLowerCase()
        if (!haystack.includes(query)) {
          return false
        }
      }

      if (filters.code && !item.code.toLowerCase().includes(filters.code.toLowerCase())) {
        return false
      }

      if (filters.status !== "all" && item.status !== filters.status) {
        return false
      }

      if (filters.channel !== "all" && !item.channels.includes(filters.channel)) {
        return false
      }

      if (filters.firstOrderOnly === "yes" && !item.first_order_only) {
        return false
      }

      if (filters.firstOrderOnly === "no" && item.first_order_only) {
        return false
      }

      const hasTitleRules = item.include_title_keywords.length > 0 || item.exclude_title_keywords.length > 0
      if (filters.hasTitleRules === "yes" && !hasTitleRules) {
        return false
      }

      if (filters.hasTitleRules === "no" && hasTitleRules) {
        return false
      }

      if (filters.activeFrom) {
        const from = parseDate(filters.activeFrom)
        const promoEnd = parseDate(item.end_date)
        if (from && promoEnd && promoEnd < from) {
          return false
        }
      }

      if (filters.activeTo) {
        const to = parseDate(filters.activeTo)
        const promoStart = parseDate(item.start_date)
        if (to && promoStart && promoStart > to) {
          return false
        }
      }

      return true
    })

    rows.sort((a, b) => {
      const aTime = parseDate(a.created_at)?.getTime() ?? 0
      const bTime = parseDate(b.created_at)?.getTime() ?? 0
      return bTime - aTime
    })

    return rows
  }, [filters, promos, query])

  const includeCoveragePreview = useMemo(
    () => calcCategoryCoverage(form.include_category_ids, form.include_category_scopes, PROMO_CATEGORY_OPTIONS),
    [form.include_category_ids, form.include_category_scopes],
  )

  const excludeCoveragePreview = useMemo(
    () => calcCategoryCoverage(form.exclude_category_ids, form.exclude_category_scopes, PROMO_CATEGORY_OPTIONS),
    [form.exclude_category_ids, form.exclude_category_scopes],
  )

  const categoryConflicts = useMemo(() => {
    const includeSet = new Set(form.include_category_ids)
    return form.exclude_category_ids.filter((item) => includeSet.has(item))
  }, [form.exclude_category_ids, form.include_category_ids])

  const keywordConflicts = useMemo(() => {
    const includeSet = new Set(form.include_title_keywords.map((item) => item.toLowerCase()))
    return form.exclude_title_keywords.filter((item) => includeSet.has(item.toLowerCase()))
  }, [form.exclude_title_keywords, form.include_title_keywords])

  function setFormField<K extends keyof PromoForm>(key: K, value: PromoForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetFilters() {
    setFilters({
      code: "",
      status: "all",
      activeFrom: "",
      activeTo: "",
      channel: "all",
      firstOrderOnly: "all",
      hasTitleRules: "all",
    })
  }

  function resetForm() {
    setForm(createPromoForm())
    setFormErrors([])
    setFieldErrors({})
  }

  function startCreatePromo() {
    setEditingPromoId(null)
    setMode("create")
    resetForm()
  }

  function startEditPromo(promo: PromoCodeEntity) {
    setEditingPromoId(promo.id)
    setMode("create")
    setForm(promoToForm(promo))
    setFormErrors([])
    setFieldErrors({})
  }

  function toggleChannel(channel: PromoChannel, checked: boolean) {
    setForm((prev) => {
      const nextChannels = checked
        ? Array.from(new Set([...prev.channels, channel]))
        : prev.channels.filter((item) => item !== channel)

      return { ...prev, channels: nextChannels }
    })
  }

  function toggleCategory(
    target: "include" | "exclude",
    categoryId: string,
    checked: boolean,
    defaultScope: CategoryScope = "with_children",
  ) {
    setForm((prev) => {
      const idsKey = target === "include" ? "include_category_ids" : "exclude_category_ids"
      const scopeKey = target === "include" ? "include_category_scopes" : "exclude_category_scopes"

      const ids = prev[idsKey]
      const scopes = { ...prev[scopeKey] }

      let nextIds: string[]

      if (checked) {
        nextIds = Array.from(new Set([...ids, categoryId]))
        if (!scopes[categoryId]) {
          scopes[categoryId] = defaultScope
        }
      } else {
        nextIds = ids.filter((item) => item !== categoryId)
        delete scopes[categoryId]
      }

      const deduped = dedupeCategorySelection(nextIds, scopes)

      return {
        ...prev,
        [idsKey]: deduped.ids,
        [scopeKey]: deduped.scopes,
      }
    })
  }

  function setCategoryScope(target: "include" | "exclude", categoryId: string, scope: CategoryScope) {
    setForm((prev) => {
      const scopeKey = target === "include" ? "include_category_scopes" : "exclude_category_scopes"
      const idsKey = target === "include" ? "include_category_ids" : "exclude_category_ids"

      const scopes = {
        ...prev[scopeKey],
        [categoryId]: scope,
      }

      const deduped = dedupeCategorySelection(prev[idsKey], scopes)

      return {
        ...prev,
        [idsKey]: deduped.ids,
        [scopeKey]: deduped.scopes,
      }
    })
  }

  function validatePromoForm(): { errors: string[]; fieldMap: Record<string, string> } {
    const errors: string[] = []
    const fieldMap: Record<string, string> = {}

    const addError = (field: string, message: string) => {
      fieldMap[field] = message
      errors.push(message)
    }

    if (!form.name.trim()) {
      addError("name", "Поле «Название» обязательно")
    }

    if (!form.code.trim()) {
      addError("code", "Поле «Код промокода» обязательно")
    }

    const duplicateCode = promos.find(
      (item) => item.code.toLowerCase() === form.code.trim().toLowerCase() && item.id !== editingPromoId,
    )
    if (duplicateCode) {
      addError("code", "Промокод с таким кодом уже существует")
    }

    if (!form.start_date) {
      addError("start_date", "Поле «Дата начала» обязательно")
    }

    if (!form.end_date) {
      addError("end_date", "Поле «Дата окончания» обязательно")
    }

    const startDate = parseDate(form.start_date)
    const endDate = parseDate(form.end_date)
    if (startDate && endDate && startDate > endDate) {
      addError("end_date", "Дата начала не может быть позже даты окончания")
    }

    const discountValue = Number(form.discount_value)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      addError("discount_value", "Значение скидки должно быть больше 0")
    }

    if (form.max_discount !== "") {
      const maxDiscount = Number(form.max_discount)
      if (!Number.isFinite(maxDiscount) || maxDiscount <= 0) {
        addError("max_discount", "Максимальная скидка должна быть больше 0, если заполнена")
      }
    }

    if (form.min_order_amount !== "") {
      const minOrderAmount = Number(form.min_order_amount)
      if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
        addError("min_order_amount", "Минимальная сумма заказа должна быть не меньше 0, если заполнена")
      }
    }

    if (form.per_user_limit !== "") {
      const perUserLimit = Number(form.per_user_limit)
      if (!Number.isInteger(perUserLimit) || perUserLimit < 1) {
        addError("per_user_limit", "Лимит на пользователя должен быть не меньше 1, если заполнен")
      }
    }

    if (form.counter !== "") {
      const counter = Number(form.counter)
      if (!Number.isInteger(counter) || counter < 1) {
        addError("counter", "Общий лимит должен быть пустым или целым числом не меньше 1")
      }
    }

    if (form.channels.length === 0) {
      addError("channels", "Нельзя сохранить без выбранного канала")
    }

    const includeKeywords = normalizeKeywordList(form.include_title_keywords)
    const excludeKeywords = normalizeKeywordList(form.exclude_title_keywords)

    if (includeKeywords.length !== form.include_title_keywords.length) {
      addError("include_title_keywords", "Пустые и дублирующиеся включающие слова не допускаются")
    }

    if (excludeKeywords.length !== form.exclude_title_keywords.length) {
      addError("exclude_title_keywords", "Пустые и дублирующиеся исключающие слова не допускаются")
    }

    return { errors, fieldMap }
  }

  function savePromo() {
    const validation = validatePromoForm()
    setFormErrors(validation.errors)
    setFieldErrors(validation.fieldMap)

    if (validation.errors.length > 0) {
      setFlash({ type: "error", text: "Форма промокода содержит ошибки" })
      return
    }

    const nextIncludeKeywords = normalizeKeywordList(form.include_title_keywords)
    const nextExcludeKeywords = normalizeKeywordList(form.exclude_title_keywords)
    const nextPayload = {
      status: form.status,
      name: form.name.trim(),
      code: form.code.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_discount: form.max_discount === "" ? null : Number(form.max_discount),
      min_order_amount: form.min_order_amount === "" ? null : Number(form.min_order_amount),
      channels: [...form.channels],
      counter: form.counter === "" ? null : Number(form.counter),
      per_user_limit: form.per_user_limit === "" ? null : Number(form.per_user_limit),
      first_order_only: form.first_order_only,
      seller_ids: [...form.seller_ids],
      include_category_ids: [...form.include_category_ids],
      exclude_category_ids: [...form.exclude_category_ids],
      include_category_scopes: { ...form.include_category_scopes },
      exclude_category_scopes: { ...form.exclude_category_scopes },
      include_title_keywords: nextIncludeKeywords,
      exclude_title_keywords: nextExcludeKeywords,
      internal_comment: form.internal_comment.trim(),
    }

    if (editingPromoId) {
      setPromos((prev) =>
        prev.map((item) =>
          item.id === editingPromoId
            ? {
                ...item,
                ...nextPayload,
              }
            : item,
        ),
      )
      setFlash({ type: "success", text: `Промокод ${nextPayload.code} обновлен` })
    } else {
      const payload: PromoCodeEntity = {
        id: `promo_${Math.random().toString(36).slice(2, 8)}`,
        discount_id: `discount_auto_${Date.now().toString().slice(-6)}`,
        current_counter: 0,
        purchases_count: 0,
        revenue_total: 0,
        created_at: new Date().toISOString(),
        ...nextPayload,
      }

      setPromos((prev) => [payload, ...prev])
      setFlash({ type: "success", text: `Промокод ${payload.code} сохранен` })
    }

    setMode("list")
    setEditingPromoId(null)
    resetForm()
  }

  return (
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

      {mode === "list" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Промокоды</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Раздел `Маркетинг → Промокоды`: список, создание и редактирование промокодов.
              </p>
            </div>

            <Button onClick={startCreatePromo}>Создать промокод</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Фильтры</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FieldBlock label="Код промокода">
                  <Input
                    value={filters.code}
                    onChange={(event) => setFilters((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder="SPRINGPHONE"
                  />
                </FieldBlock>

                <PromoSelectField
                  label="Статус"
                  value={filters.status}
                  options={[{ value: "all", label: "Все" }, ...PROMO_STATUS_OPTIONS]}
                  onChange={(value) => setFilters((prev) => ({ ...prev, status: value as PromoFilters["status"] }))}
                />

                <FieldBlock label="Активен с">
                  <Input
                    type="date"
                    value={filters.activeFrom}
                    onChange={(event) => setFilters((prev) => ({ ...prev, activeFrom: event.target.value }))}
                  />
                </FieldBlock>

                <FieldBlock label="Активен по">
                  <Input
                    type="date"
                    value={filters.activeTo}
                    onChange={(event) => setFilters((prev) => ({ ...prev, activeTo: event.target.value }))}
                  />
                </FieldBlock>

                <PromoSelectField
                  label="Канал"
                  value={filters.channel}
                  options={[{ value: "all", label: "Все" }, ...PROMO_CHANNEL_OPTIONS]}
                  onChange={(value) => setFilters((prev) => ({ ...prev, channel: value as PromoFilters["channel"] }))}
                />

                <PromoSelectField
                  label="Только первый заказ"
                  value={filters.firstOrderOnly}
                  options={[
                    { value: "all", label: "Все" },
                    { value: "yes", label: "Только первый заказ" },
                    { value: "no", label: "Не только первый заказ" },
                  ]}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, firstOrderOnly: value as PromoFilters["firstOrderOnly"] }))
                  }
                />

                <PromoSelectField
                  label="Наличие правил по названию"
                  value={filters.hasTitleRules}
                  options={[
                    { value: "all", label: "Все" },
                    { value: "yes", label: "Есть" },
                    { value: "no", label: "Нет" },
                  ]}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, hasTitleRules: value as PromoFilters["hasTitleRules"] }))
                  }
                />
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="outline" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Код</TableHead>
                      <TableHead>Название</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Лимит/использовано</TableHead>
                      <TableHead>Дата начала</TableHead>
                      <TableHead>Дата окончания</TableHead>
                      <TableHead>Тип скидки</TableHead>
                      <TableHead>Значение скидки</TableHead>
                      <TableHead>Макс. скидка</TableHead>
                      <TableHead>Мин. сумма заказа</TableHead>
                      <TableHead>Продавцы</TableHead>
                      <TableHead>Первый заказ</TableHead>
                      <TableHead>Каналы</TableHead>
                      <TableHead>Категории</TableHead>
                      <TableHead>Ключевые слова</TableHead>
                      <TableHead>Сколько раз применили</TableHead>
                      <TableHead>Выручка</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPromos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={18}>
                          <p className="py-6 text-center text-sm text-muted-foreground">Промокоды не найдены.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPromos.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-semibold">{item.code}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>
                            <Badge className={cn("border", PROMO_STATUS_CLASS[item.status])}>
                              {PROMO_STATUS_LABELS[item.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.counter ?? "∞"}/{item.current_counter}
                          </TableCell>
                          <TableCell>{formatDate(item.start_date)}</TableCell>
                          <TableCell>{formatDate(item.end_date)}</TableCell>
                          <TableCell>{PROMO_DISCOUNT_TYPE_LABELS[item.discount_type]}</TableCell>
                          <TableCell>
                            {item.discount_type === "percent" ? `${item.discount_value}%` : formatRub(item.discount_value)}
                          </TableCell>
                          <TableCell>{item.max_discount === null ? "Без ограничения" : formatRub(item.max_discount)}</TableCell>
                          <TableCell>{item.min_order_amount === null ? "От любой суммы" : formatRub(item.min_order_amount)}</TableCell>
                          <TableCell>{formatPromoSellerList(item.seller_ids)}</TableCell>
                          <TableCell>{item.first_order_only ? "Да" : "Нет"}</TableCell>
                          <TableCell>{item.channels.map((channel) => PROMO_CHANNEL_LABELS[channel]).join(", ")}</TableCell>
                          <TableCell>{summarizeCategoryRules(item)}</TableCell>
                          <TableCell>{summarizeTitleRules(item)}</TableCell>
                          <TableCell>{item.purchases_count}</TableCell>
                          <TableCell>{formatRub(item.revenue_total)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => startEditPromo(item)}>
                              Изменить
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {mode === "create" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">{editingPromoId ? "Редактировать промокод" : "Создать промокод"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Настройка расширенных условий: каналы, категории включения/исключения, ключевые слова и лимиты.
            </p>
          </div>

          {formErrors.length > 0 ? (
            <Card className="border-rose-200 bg-rose-50">
              <CardHeader>
                <CardTitle className="text-rose-700">Проверьте поля формы промокода</CardTitle>
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
              <CardTitle>Базовые поля</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <PromoSelectField
                  label="Статус *"
                  value={form.status}
                  options={PROMO_STATUS_OPTIONS}
                  onChange={(value) => setFormField("status", value as PromoStatus)}
                />

                <FieldBlock label="Название *" error={fieldErrors.name}>
                  <Input
                    value={form.name}
                    onChange={(event) => setFormField("name", event.target.value)}
                    placeholder="Весна смартфонов"
                  />
                </FieldBlock>

                <FieldBlock label="Код промокода *" error={fieldErrors.code}>
                  <Input
                    value={form.code}
                    onChange={(event) => setFormField("code", event.target.value)}
                    placeholder="SPRINGPHONE"
                  />
                </FieldBlock>

                <FieldBlock label="Дата начала *" error={fieldErrors.start_date}>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(event) => setFormField("start_date", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label="Дата окончания *" error={fieldErrors.end_date}>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(event) => setFormField("end_date", event.target.value)}
                  />
                </FieldBlock>

              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {editingPromoId
                  ? "ID скидки сохраняется, обновляются параметры промокода."
                  : "ID скидки создается и привязывается автоматически при сохранении промокода."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Параметры скидки и лимиты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <PromoSelectField
                  label="Тип скидки *"
                  value={form.discount_type}
                  options={PROMO_DISCOUNT_TYPE_OPTIONS}
                  onChange={(value) => setFormField("discount_type", value as PromoDiscountType)}
                />

                <FieldBlock label="Значение скидки *" error={fieldErrors.discount_value}>
                  <Input
                    type="number"
                    min="1"
                    value={form.discount_value}
                    onChange={(event) => setFormField("discount_value", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label="Максимальная скидка (опционально)" error={fieldErrors.max_discount}>
                  <Input
                    type="number"
                    min="1"
                    value={form.max_discount}
                    onChange={(event) => setFormField("max_discount", event.target.value)}
                    placeholder="Если пусто — без верхнего лимита"
                  />
                </FieldBlock>

                <FieldBlock label="Минимальная сумма заказа (опционально)" error={fieldErrors.min_order_amount}>
                  <Input
                    type="number"
                    min="0"
                    value={form.min_order_amount}
                    onChange={(event) => setFormField("min_order_amount", event.target.value)}
                    placeholder="Если пусто — от любой суммы"
                  />
                </FieldBlock>

                <FieldBlock label="Общий лимит применений (пусто = безлимит)" error={fieldErrors.counter}>
                  <Input
                    type="number"
                    min="1"
                    value={form.counter}
                    onChange={(event) => setFormField("counter", event.target.value)}
                    placeholder="Например: 1000"
                  />
                </FieldBlock>

                <FieldBlock label="Лимит применений на пользователя (опционально)" error={fieldErrors.per_user_limit}>
                  <Input
                    type="number"
                    min="1"
                    value={form.per_user_limit}
                    onChange={(event) => setFormField("per_user_limit", event.target.value)}
                    placeholder="Если пусто — без ограничения"
                  />
                </FieldBlock>

                <FieldBlock label="Продавцы (опционально)">
                  <MultiSelectDropdown
                    value={form.seller_ids}
                    options={PROMO_SELLER_OPTIONS.map((option) => ({ value: option.id, label: `${option.name} (${option.id})` }))}
                    placeholder="Любые продавцы"
                    onChange={(next) => setFormField("seller_ids", next)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Если выбрано несколько продавцов, промокод применяется к товарам этих продавцов.
                  </p>
                </FieldBlock>

                <div className="space-y-2">
                  <Label>Только для первого заказа</Label>
                  <label className="inline-flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={form.first_order_only}
                      onCheckedChange={(checked) => setFormField("first_order_only", checked === true)}
                    />
                    Только для первого заказа
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Каналы применения * (минимум 1)</Label>
                <div className="flex flex-wrap gap-4 rounded-md border bg-slate-50 p-3">
                  {PROMO_CHANNEL_OPTIONS.map((option) => (
                    <label key={option.value} className="inline-flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={form.channels.includes(option.value)}
                        onCheckedChange={(checked) => toggleChannel(option.value, checked === true)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {fieldErrors.channels ? <p className="text-xs text-rose-600">{fieldErrors.channels}</p> : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Категорийные правила</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <CategoryRuleSelector
                  title="Включить категории"
                  selectedIds={form.include_category_ids}
                  scopes={form.include_category_scopes}
                  onToggle={(id, checked) => toggleCategory("include", id, checked)}
                  onScopeChange={(id, scope) => setCategoryScope("include", id, scope)}
                />

                <CategoryRuleSelector
                  title="Исключить категории"
                  selectedIds={form.exclude_category_ids}
                  scopes={form.exclude_category_scopes}
                  onToggle={(id, checked) => toggleCategory("exclude", id, checked)}
                  onScopeChange={(id, scope) => setCategoryScope("exclude", id, scope)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-blue-800">Охват включенных категорий: {includeCoveragePreview}</p>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-blue-800">Охват исключенных категорий: {excludeCoveragePreview}</p>
                  </CardContent>
                </Card>
              </div>

              {categoryConflicts.length > 0 ? (
                <p className="text-sm text-amber-700">
                  Есть пересечения между включенными и исключенными категориями: {categoryConflicts.join(", ")}.
                  Приоритет у исключения.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Фильтр по названию товара</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <TokenInput
                  label="Включить слова в названии"
                  values={form.include_title_keywords}
                  placeholder="смартфон, iphone"
                  error={fieldErrors.include_title_keywords}
                  onChange={(values) => setFormField("include_title_keywords", values)}
                />

                <TokenInput
                  label="Исключить слова в названии"
                  values={form.exclude_title_keywords}
                  placeholder="уценка, восстановленный"
                  error={fieldErrors.exclude_title_keywords}
                  onChange={(values) => setFormField("exclude_title_keywords", values)}
                />
              </div>

              {keywordConflicts.length > 0 ? (
                <p className="text-sm text-amber-700">
                  Конфликт между включающими и исключающими словами: {keywordConflicts.join(", ")}.
                  Приоритет у исключения.
                </p>
              ) : null}

              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <p className="text-sm text-blue-800">
                    Предпросмотр по ключевым словам: включено {form.include_title_keywords.length}, исключено{" "}
                    {form.exclude_title_keywords.length}
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <Card className="sticky bottom-2">
            <CardContent className="pt-6">
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Очистить форму
                </Button>
                <Button onClick={savePromo}>{editingPromoId ? "Сохранить изменения" : "Сохранить промокод"}</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMode("list")
                    setEditingPromoId(null)
                    resetForm()
                  }}
                >
                  К списку
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

    </div>
  )
}

interface PromoSelectFieldProps {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

function PromoSelectField(props: PromoSelectFieldProps) {
  const { label, value, options, onChange } = props

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Выберите вариант" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface MultiSelectDropdownProps {
  value: string[]
  options: Array<{ value: string; label: string }>
  placeholder: string
  onChange: (value: string[]) => void
}

function MultiSelectDropdown(props: MultiSelectDropdownProps) {
  const { value, options, placeholder, onChange } = props
  const [open, setOpen] = useState(false)

  const selectedLabels = options.filter((option) => value.includes(option.value)).map((option) => option.label)

  function toggleOption(optionValue: string, checked: boolean) {
    const next = checked ? Array.from(new Set([...value, optionValue])) : value.filter((item) => item !== optionValue)
    onChange(next)
  }

  return (
    <div className="relative">
      <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpen((prev) => !prev)}>
        <span className="truncate text-left">{selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder}</span>
        <span className="ml-2 text-xs text-muted-foreground">{open ? "▴" : "▾"}</span>
      </Button>

      {open ? (
        <div className="absolute z-20 mt-2 w-full rounded-md border bg-white p-2 shadow-lg">
          <div className="mb-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(options.map((option) => option.value))}>
              Выбрать все
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
              Очистить
            </Button>
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
            {options.map((option) => (
              <label key={option.value} className="inline-flex w-full items-center gap-2 text-sm">
                <Checkbox
                  checked={value.includes(option.value)}
                  onCheckedChange={(checked) => toggleOption(option.value, checked === true)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={() => setOpen(false)}>
            Готово
          </Button>
        </div>
      ) : null}
    </div>
  )
}

interface CategoryRuleSelectorProps {
  title: string
  selectedIds: string[]
  scopes: Record<string, CategoryScope>
  onToggle: (categoryId: string, checked: boolean) => void
  onScopeChange: (categoryId: string, scope: CategoryScope) => void
}

function CategoryRuleSelector(props: CategoryRuleSelectorProps) {
  const { title, selectedIds, scopes, onToggle, onScopeChange } = props
  const [query, setQuery] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(PROMO_CATEGORY_OPTIONS.filter((item) => !item.parent_id).map((item) => item.id)),
  )

  const normalizedQuery = query.trim().toLowerCase()

  const childrenByParent = useMemo(() => {
    const map = new Map<string, PromoCategoryOption[]>()
    const rootKey = "__root__"

    for (const item of PROMO_CATEGORY_OPTIONS) {
      const parentKey = item.parent_id ?? rootKey
      const group = map.get(parentKey) ?? []
      group.push(item)
      map.set(parentKey, group)
    }

    for (const group of map.values()) {
      group.sort((a, b) => a.name.localeCompare(b.name, "ru-RU"))
    }

    return { map, rootKey }
  }, [])

  const visibleInTree = useMemo(() => {
    const state = new Map<string, boolean>()

    const walk = (nodeId: string): boolean => {
      const current = CATEGORY_BY_ID.get(nodeId)
      if (!current) {
        state.set(nodeId, false)
        return false
      }

      const selfMatches =
        normalizedQuery.length === 0 || `${current.id} ${current.name}`.toLowerCase().includes(normalizedQuery)

      const children = childrenByParent.map.get(nodeId) ?? []
      const childMatches = children.some((child) => walk(child.id))
      const visible = selfMatches || childMatches

      state.set(nodeId, visible)
      return visible
    }

    const roots = childrenByParent.map.get(childrenByParent.rootKey) ?? []
    for (const root of roots) {
      walk(root.id)
    }

    return state
  }, [childrenByParent, normalizedQuery])

  const rootNodes = childrenByParent.map.get(childrenByParent.rootKey) ?? []

  const visibleRoots = rootNodes.filter((root) => visibleInTree.get(root.id))

  const toggleExpanded = (categoryId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const renderNode = (item: PromoCategoryOption, depth: number): ReactNode => {
    if (!visibleInTree.get(item.id)) {
      return null
    }

    const checked = selectedIds.includes(item.id)
    const children = childrenByParent.map.get(item.id) ?? []
    const visibleChildren = children.filter((child) => visibleInTree.get(child.id))
    const hasChildren = visibleChildren.length > 0
    const expanded = normalizedQuery ? true : expandedIds.has(item.id)

    return (
      <div key={item.id} className="space-y-2 rounded-md border p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 16}px` }}>
            {hasChildren ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-slate-700"
                onClick={() => toggleExpanded(item.id)}
                aria-label={expanded ? "Свернуть подкатегории" : "Развернуть подкатегории"}
              >
                {expanded ? "▾" : "▸"}
              </Button>
            ) : (
              <span className="inline-block h-6 w-6" />
            )}

            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={checked} onCheckedChange={(value) => onToggle(item.id, value === true)} />
              <span>
                {item.name} <span className="text-xs text-muted-foreground">({item.id})</span>
              </span>
            </label>
          </div>

          {checked ? (
            <Select
              value={scopes[item.id] ?? "with_children"}
              onValueChange={(value) => onScopeChange(item.id, value as CategoryScope)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {hasChildren && expanded ? <div className="space-y-2">{visibleChildren.map((child) => renderNode(child, depth + 1))}</div> : null}
      </div>
    )
  }

  return (
    <Card className="border-dashed bg-slate-50">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FieldBlock label="Поиск по ID или названию">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="cat-electronics или Смартфоны"
          />
        </FieldBlock>

        <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border bg-white p-2">
          {visibleRoots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Категории по запросу не найдены</p>
          ) : (
            visibleRoots.map((root) => renderNode(root, 0))
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {selectedIds.length === 0 ? (
            <span className="text-sm text-muted-foreground">Категории не выбраны</span>
          ) : (
            selectedIds.map((id) => {
              const category = CATEGORY_BY_ID.get(id)
              return (
                <Badge key={id} variant="outline" className="gap-2 rounded-full px-3 py-1">
                  <span>{category?.name ?? id}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={() => onToggle(id, false)}>
                    x
                  </Button>
                </Badge>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface TokenInputProps {
  label: string
  values: string[]
  placeholder: string
  onChange: (values: string[]) => void
  error?: string
}

function TokenInput(props: TokenInputProps) {
  const { label, values, placeholder, onChange, error } = props
  const [draft, setDraft] = useState("")

  function addTokens(raw: string) {
    const incoming = splitTokens(raw)
    if (incoming.length === 0) {
      return
    }

    onChange(normalizeKeywordList([...values, ...incoming]))
    setDraft("")
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" && event.key !== ",") {
      return
    }

    event.preventDefault()
    addTokens(draft)
  }

  return (
    <FieldBlock label={label} error={error}>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 rounded-md border bg-slate-50 p-2">
          {values.length === 0 ? (
            <span className="text-sm text-muted-foreground">Список пуст</span>
          ) : (
            values.map((value, index) => (
              <Badge key={`${value}_${index}`} variant="outline" className="gap-2 rounded-full px-3 py-1">
                <span>{value}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-xs"
                  onClick={() => onChange(values.filter((_, tokenIndex) => tokenIndex !== index))}
                >
                  x
                </Button>
              </Badge>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <Textarea
            rows={2}
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => addTokens(draft)}
          />
          <Button type="button" variant="outline" onClick={() => addTokens(draft)}>
            Добавить
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Разделители: запятая или перенос строки.</p>
      </div>
    </FieldBlock>
  )
}

interface FieldBlockProps {
  label: string
  children: ReactNode
  error?: string
}

function FieldBlock(props: FieldBlockProps) {
  const { label, children, error } = props

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  )
}
