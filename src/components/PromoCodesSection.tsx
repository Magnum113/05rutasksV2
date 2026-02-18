import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react"

import {
  buildPromoRuleSummary,
  calcCategoryCoverage,
  type CategoryScope,
  CATEGORY_SCOPE_OPTIONS,
  type PromoChannel,
  PROMO_CHANNEL_OPTIONS,
  PROMO_CATEGORY_OPTIONS,
  type PromoCodeEntity,
  type PromoDiscountType,
  PROMO_DISCOUNT_TYPE_OPTIONS,
  type PromoFirstOrderFilter,
  formatRub,
  MOCK_PROMO_CODES,
  normalizeKeywordList,
  type PromoStatus,
  PROMO_STATUS_OPTIONS,
  SAMPLE_PRODUCT_TITLES,
  splitTokens,
  summarizeCategoryRules,
  summarizeTitleRules,
  type PromoTitleRulesFilter,
} from "@/admin/promoRegistry"
import { downloadCsv, formatDate, parseDate } from "@/admin/utils"
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

interface PromoCodesSectionProps {
  globalSearch: string
  createSignal: number
}

interface PromoFilters {
  code: string
  status: "all" | PromoStatus
  activeFrom: string
  activeTo: string
  discountId: string
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
  discount_id: string
  discount_type: PromoDiscountType
  discount_value: string
  max_discount: string
  min_order_amount: string
  channels: PromoChannel[]
  counter: string
  per_user_limit: string
  first_order_only: boolean
  seller_id: string
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
    discount_id: "",
    discount_type: "percent",
    discount_value: "",
    max_discount: "",
    min_order_amount: "0",
    channels: ["web"],
    counter: "",
    per_user_limit: "1",
    first_order_only: false,
    seller_id: "",
    include_category_ids: [],
    exclude_category_ids: [],
    include_category_scopes: {},
    exclude_category_scopes: {},
    include_title_keywords: [],
    exclude_title_keywords: [],
    internal_comment: "",
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
    discountId: "",
    channel: "all",
    firstOrderOnly: "all",
    hasTitleRules: "all",
  })

  const [form, setForm] = useState<PromoForm>(createPromoForm)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState<PromoFlash | null>(null)
  const [viewPromo, setViewPromo] = useState<PromoCodeEntity | null>(null)

  useEffect(() => {
    if (createSignal === 0) {
      return
    }

    setMode("create")
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
        const haystack = `${item.code} ${item.name} ${item.discount_id} ${item.seller_id ?? ""}`.toLowerCase()
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

      if (filters.discountId && !item.discount_id.toLowerCase().includes(filters.discountId.toLowerCase())) {
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

  const metrics = useMemo(() => {
    return filteredPromos.reduce(
      (acc, promo) => {
        acc.purchases += promo.purchases_count
        acc.revenue += promo.revenue_total
        if (promo.status === "active") {
          acc.active += 1
        }
        return acc
      },
      { purchases: 0, revenue: 0, active: 0 },
    )
  }, [filteredPromos])

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

  const titlePreview = useMemo(() => {
    const include = form.include_title_keywords.map((item) => item.toLowerCase())
    const exclude = form.exclude_title_keywords.map((item) => item.toLowerCase())

    const isAllowed = (title: string) => {
      const value = title.toLowerCase()

      if (include.length > 0 && !include.some((part) => value.includes(part))) {
        return false
      }

      if (exclude.some((part) => value.includes(part))) {
        return false
      }

      return true
    }

    return {
      allowed: SAMPLE_PRODUCT_TITLES.filter((item) => isAllowed(item)).slice(0, 4),
      rejected: SAMPLE_PRODUCT_TITLES.filter((item) => !isAllowed(item)).slice(0, 4),
    }
  }, [form.exclude_title_keywords, form.include_title_keywords])

  const ruleSummary = useMemo(
    () =>
      buildPromoRuleSummary({
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value) || 0,
        max_discount: Number(form.max_discount) || 0,
        min_order_amount: Number(form.min_order_amount) || 0,
        channels: form.channels,
        first_order_only: form.first_order_only,
        seller_id: form.seller_id.trim() || null,
        include_category_ids: form.include_category_ids,
        exclude_category_ids: form.exclude_category_ids,
        include_title_keywords: form.include_title_keywords,
        exclude_title_keywords: form.exclude_title_keywords,
      }),
    [
      form.channels,
      form.discount_type,
      form.discount_value,
      form.exclude_category_ids,
      form.exclude_title_keywords,
      form.first_order_only,
      form.include_category_ids,
      form.include_title_keywords,
      form.max_discount,
      form.min_order_amount,
      form.seller_id,
    ],
  )

  function setFormField<K extends keyof PromoForm>(key: K, value: PromoForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetFilters() {
    setFilters({
      code: "",
      status: "all",
      activeFrom: "",
      activeTo: "",
      discountId: "",
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
      addError("name", "Поле name обязательно")
    }

    if (!form.code.trim()) {
      addError("code", "Поле code обязательно")
    }

    const duplicateCode = promos.find((item) => item.code.toLowerCase() === form.code.trim().toLowerCase())
    if (duplicateCode) {
      addError("code", "Промокод с таким code уже существует")
    }

    if (!form.discount_id.trim()) {
      addError("discount_id", "discount_id обязателен")
    }

    if (!form.start_date) {
      addError("start_date", "start_date обязателен")
    }

    if (!form.end_date) {
      addError("end_date", "end_date обязателен")
    }

    const startDate = parseDate(form.start_date)
    const endDate = parseDate(form.end_date)
    if (startDate && endDate && startDate > endDate) {
      addError("end_date", "start_date не может быть позже end_date")
    }

    const discountValue = Number(form.discount_value)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      addError("discount_value", "discount_value должен быть > 0")
    }

    const maxDiscount = Number(form.max_discount)
    if (!Number.isFinite(maxDiscount) || maxDiscount <= 0) {
      addError("max_discount", "max_discount должен быть > 0")
    }

    const minOrderAmount = Number(form.min_order_amount)
    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
      addError("min_order_amount", "min_order_amount должен быть >= 0")
    }

    const perUserLimit = Number(form.per_user_limit)
    if (!Number.isInteger(perUserLimit) || perUserLimit < 1) {
      addError("per_user_limit", "per_user_limit должен быть >= 1")
    }

    if (form.counter !== "") {
      const counter = Number(form.counter)
      if (!Number.isInteger(counter) || counter < 1) {
        addError("counter", "counter должен быть пустым или целым числом >= 1")
      }
    }

    if (form.channels.length === 0) {
      addError("channels", "Нельзя сохранить без выбранного канала")
    }

    const includeKeywords = normalizeKeywordList(form.include_title_keywords)
    const excludeKeywords = normalizeKeywordList(form.exclude_title_keywords)

    if (includeKeywords.length !== form.include_title_keywords.length) {
      addError("include_title_keywords", "Пустые и дублирующиеся include keywords не допускаются")
    }

    if (excludeKeywords.length !== form.exclude_title_keywords.length) {
      addError("exclude_title_keywords", "Пустые и дублирующиеся exclude keywords не допускаются")
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

    const payload: PromoCodeEntity = {
      id: `promo_${Math.random().toString(36).slice(2, 8)}`,
      status: form.status,
      name: form.name.trim(),
      code: form.code.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      discount_id: form.discount_id.trim(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_discount: Number(form.max_discount),
      min_order_amount: Number(form.min_order_amount),
      channels: form.channels,
      counter: form.counter === "" ? null : Number(form.counter),
      current_counter: 0,
      per_user_limit: Number(form.per_user_limit),
      first_order_only: form.first_order_only,
      seller_id: form.seller_id.trim() || null,
      include_category_ids: form.include_category_ids,
      exclude_category_ids: form.exclude_category_ids,
      include_category_scopes: form.include_category_scopes,
      exclude_category_scopes: form.exclude_category_scopes,
      include_title_keywords: normalizeKeywordList(form.include_title_keywords),
      exclude_title_keywords: normalizeKeywordList(form.exclude_title_keywords),
      internal_comment: form.internal_comment.trim(),
      purchases_count: 0,
      revenue_total: 0,
      created_at: new Date().toISOString(),
    }

    setPromos((prev) => [payload, ...prev])
    setMode("list")
    resetForm()
    setFlash({ type: "success", text: `Промокод ${payload.code} сохранен` })
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
                Раздел `Маркетинг → Промокоды`: список, создание промокода и просмотр карточки.
              </p>
            </div>

            <Button onClick={() => setMode("create")}>Создать промокод</Button>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <MetricCard title="Активные" value={metrics.active} />
            <MetricCard title="Покупки с промокодом" value={metrics.purchases} />
            <MetricCard title="Выручка с промокодом" value={formatRub(metrics.revenue)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Фильтры</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FieldBlock label="code">
                  <Input
                    value={filters.code}
                    onChange={(event) => setFilters((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder="SPRINGPHONE"
                  />
                </FieldBlock>

                <PromoSelectField
                  label="status"
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

                <FieldBlock label="discount_id">
                  <Input
                    value={filters.discountId}
                    onChange={(event) => setFilters((prev) => ({ ...prev, discountId: event.target.value }))}
                    placeholder="discount_1007"
                  />
                </FieldBlock>

                <PromoSelectField
                  label="Канал"
                  value={filters.channel}
                  options={[{ value: "all", label: "Все" }, ...PROMO_CHANNEL_OPTIONS]}
                  onChange={(value) => setFilters((prev) => ({ ...prev, channel: value as PromoFilters["channel"] }))}
                />

                <PromoSelectField
                  label="first_order_only"
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
              <Button
                variant="outline"
                onClick={() => {
                  if (filteredPromos.length === 0) {
                    setFlash({ type: "info", text: "Нет данных для экспорта" })
                    return
                  }

                  downloadCsv(
                    "promo_codes_export.csv",
                    filteredPromos.map((item) => ({
                      code: item.code,
                      name: item.name,
                      status: item.status,
                      start_date: item.start_date,
                      end_date: item.end_date,
                      discount_id: item.discount_id,
                      discount_type: item.discount_type,
                      discount_value: item.discount_value,
                      max_discount: item.max_discount,
                      min_order_amount: item.min_order_amount,
                      first_order_only: item.first_order_only ? "yes" : "no",
                      channels: item.channels.join("|"),
                      category_rules: summarizeCategoryRules(item),
                      title_rules: summarizeTitleRules(item),
                      purchases_count: item.purchases_count,
                      revenue_total: item.revenue_total,
                    })),
                  )

                  setFlash({ type: "success", text: `CSV выгружен: ${filteredPromos.length} записей` })
                }}
              >
                Экспорт CSV
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>code</TableHead>
                      <TableHead>name</TableHead>
                      <TableHead>status</TableHead>
                      <TableHead>counter/current</TableHead>
                      <TableHead>start_date</TableHead>
                      <TableHead>end_date</TableHead>
                      <TableHead>discount_id</TableHead>
                      <TableHead>discount_type</TableHead>
                      <TableHead>discount_value</TableHead>
                      <TableHead>max_discount</TableHead>
                      <TableHead>min_order_amount</TableHead>
                      <TableHead>first_order_only</TableHead>
                      <TableHead>channels</TableHead>
                      <TableHead>Категории</TableHead>
                      <TableHead>Keywords</TableHead>
                      <TableHead>Покупки</TableHead>
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
                            <Badge className={cn("border", PROMO_STATUS_CLASS[item.status])}>{item.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {item.counter ?? "∞"}/{item.current_counter}
                          </TableCell>
                          <TableCell>{formatDate(item.start_date)}</TableCell>
                          <TableCell>{formatDate(item.end_date)}</TableCell>
                          <TableCell>{item.discount_id}</TableCell>
                          <TableCell>{item.discount_type}</TableCell>
                          <TableCell>
                            {item.discount_type === "percent" ? `${item.discount_value}%` : formatRub(item.discount_value)}
                          </TableCell>
                          <TableCell>{formatRub(item.max_discount)}</TableCell>
                          <TableCell>{formatRub(item.min_order_amount)}</TableCell>
                          <TableCell>{item.first_order_only ? "yes" : "no"}</TableCell>
                          <TableCell>{item.channels.join(", ")}</TableCell>
                          <TableCell>{summarizeCategoryRules(item)}</TableCell>
                          <TableCell>{summarizeTitleRules(item)}</TableCell>
                          <TableCell>{item.purchases_count}</TableCell>
                          <TableCell>{formatRub(item.revenue_total)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => setViewPromo(item)}>
                              Просмотр
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
            <h2 className="text-2xl font-semibold">Создать промокод</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Конфигурация расширенных условий: каналы, категории include/exclude, keywords и лимиты.
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
                  label="status *"
                  value={form.status}
                  options={PROMO_STATUS_OPTIONS}
                  onChange={(value) => setFormField("status", value as PromoStatus)}
                />

                <FieldBlock label="name *" error={fieldErrors.name}>
                  <Input
                    value={form.name}
                    onChange={(event) => setFormField("name", event.target.value)}
                    placeholder="Весна смартфонов"
                  />
                </FieldBlock>

                <FieldBlock label="code *" error={fieldErrors.code}>
                  <Input
                    value={form.code}
                    onChange={(event) => setFormField("code", event.target.value)}
                    placeholder="SPRINGPHONE"
                  />
                </FieldBlock>

                <FieldBlock label="start_date *" error={fieldErrors.start_date}>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(event) => setFormField("start_date", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label="end_date *" error={fieldErrors.end_date}>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(event) => setFormField("end_date", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label="discount_id *" error={fieldErrors.discount_id}>
                  <Input
                    value={form.discount_id}
                    onChange={(event) => setFormField("discount_id", event.target.value)}
                    placeholder="discount_1007"
                  />
                </FieldBlock>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Параметры скидки и лимиты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <PromoSelectField
                  label="discount_type *"
                  value={form.discount_type}
                  options={PROMO_DISCOUNT_TYPE_OPTIONS}
                  onChange={(value) => setFormField("discount_type", value as PromoDiscountType)}
                />

                <FieldBlock label="discount_value *" error={fieldErrors.discount_value}>
                  <Input
                    type="number"
                    min="1"
                    value={form.discount_value}
                    onChange={(event) => setFormField("discount_value", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label="max_discount *" error={fieldErrors.max_discount}>
                  <Input
                    type="number"
                    min="1"
                    value={form.max_discount}
                    onChange={(event) => setFormField("max_discount", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label="min_order_amount *" error={fieldErrors.min_order_amount}>
                  <Input
                    type="number"
                    min="0"
                    value={form.min_order_amount}
                    onChange={(event) => setFormField("min_order_amount", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label="counter (пусто = безлимит)" error={fieldErrors.counter}>
                  <Input
                    type="number"
                    min="1"
                    value={form.counter}
                    onChange={(event) => setFormField("counter", event.target.value)}
                    placeholder="например 1000"
                  />
                </FieldBlock>

                <FieldBlock label="per_user_limit *" error={fieldErrors.per_user_limit}>
                  <Input
                    type="number"
                    min="1"
                    value={form.per_user_limit}
                    onChange={(event) => setFormField("per_user_limit", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label="seller_id (nullable)">
                  <Input
                    value={form.seller_id}
                    onChange={(event) => setFormField("seller_id", event.target.value)}
                    placeholder="seller-smart-inc"
                  />
                </FieldBlock>

                <div className="space-y-2">
                  <Label>first_order_only</Label>
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
                <Label>channels * (минимум 1)</Label>
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
                    <p className="text-sm text-blue-800">category_inclusion_preview: {includeCoveragePreview}</p>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-blue-800">category_exclusion_preview: {excludeCoveragePreview}</p>
                  </CardContent>
                </Card>
              </div>

              {categoryConflicts.length > 0 ? (
                <p className="text-sm text-amber-700">
                  Пересечения include/exclude категорий: {categoryConflicts.join(", ")}. Приоритет у exclude.
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
                  label="include_title_keywords"
                  values={form.include_title_keywords}
                  placeholder="galaxy, iphone"
                  error={fieldErrors.include_title_keywords}
                  onChange={(values) => setFormField("include_title_keywords", values)}
                />

                <TokenInput
                  label="exclude_title_keywords"
                  values={form.exclude_title_keywords}
                  placeholder="refurbished, уценка"
                  error={fieldErrors.exclude_title_keywords}
                  onChange={(values) => setFormField("exclude_title_keywords", values)}
                />
              </div>

              {keywordConflicts.length > 0 ? (
                <p className="text-sm text-amber-700">
                  Конфликт include/exclude keywords: {keywordConflicts.join(", ")}. Приоритет у exclude.
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Card className="border-slate-200 bg-slate-50">
                  <CardHeader>
                    <CardTitle className="text-base">title_keywords_preview: проходит</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {titlePreview.allowed.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Нет примеров</p>
                    ) : (
                      <ul className="list-disc space-y-1 pl-5 text-sm">
                        {titlePreview.allowed.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-slate-50">
                  <CardHeader>
                    <CardTitle className="text-base">title_keywords_preview: исключено</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {titlePreview.rejected.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Нет примеров</p>
                    ) : (
                      <ul className="list-disc space-y-1 pl-5 text-sm">
                        {titlePreview.rejected.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Комментарий и резюме правил</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FieldBlock label="internal_comment">
                <Textarea
                  value={form.internal_comment}
                  onChange={(event) => setFormField("internal_comment", event.target.value)}
                  rows={3}
                  placeholder="Внутренняя заметка для маркетинга"
                />
              </FieldBlock>

              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <p className="text-sm text-blue-800">rule_summary: {ruleSummary}</p>
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
                <Button onClick={savePromo}>Сохранить промокод</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMode("list")
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

      <Dialog open={Boolean(viewPromo)} onOpenChange={(open) => (!open ? setViewPromo(null) : null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Карточка промокода</DialogTitle>
            <DialogDescription>Базовые поля, параметры скидки, условия и метрики промокода.</DialogDescription>
          </DialogHeader>

          {viewPromo ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <InfoRow label="code" value={viewPromo.code} />
                <InfoRow label="name" value={viewPromo.name} />
                <InfoRow label="status" value={viewPromo.status} />
                <InfoRow label="discount_id" value={viewPromo.discount_id} />
                <InfoRow label="start_date" value={formatDate(viewPromo.start_date)} />
                <InfoRow label="end_date" value={formatDate(viewPromo.end_date)} />
                <InfoRow
                  label="discount"
                  value={
                    viewPromo.discount_type === "percent"
                      ? `${viewPromo.discount_value}% (max ${formatRub(viewPromo.max_discount)})`
                      : `${formatRub(viewPromo.discount_value)} (max ${formatRub(viewPromo.max_discount)})`
                  }
                />
                <InfoRow label="min_order_amount" value={formatRub(viewPromo.min_order_amount)} />
                <InfoRow label="counter/current_counter" value={`${viewPromo.counter ?? "∞"}/${viewPromo.current_counter}`} />
                <InfoRow label="per_user_limit" value={String(viewPromo.per_user_limit)} />
                <InfoRow label="first_order_only" value={viewPromo.first_order_only ? "yes" : "no"} />
                <InfoRow label="channels" value={viewPromo.channels.join(", ")} />
                <InfoRow label="seller_id" value={viewPromo.seller_id ?? "—"} />
                <InfoRow label="include_category_ids" value={viewPromo.include_category_ids.join(", ") || "—"} />
                <InfoRow label="exclude_category_ids" value={viewPromo.exclude_category_ids.join(", ") || "—"} />
                <InfoRow label="include_title_keywords" value={viewPromo.include_title_keywords.join(", ") || "—"} />
                <InfoRow label="exclude_title_keywords" value={viewPromo.exclude_title_keywords.join(", ") || "—"} />
                <InfoRow label="purchases_count" value={String(viewPromo.purchases_count)} />
                <InfoRow label="revenue_total" value={formatRub(viewPromo.revenue_total)} />
              </div>

              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <p className="text-sm text-blue-800">
                    rule_summary: {buildPromoRuleSummary(viewPromo)}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewPromo(null)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <SelectValue placeholder="Выберите значение" />
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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return PROMO_CATEGORY_OPTIONS
    }

    return PROMO_CATEGORY_OPTIONS.filter((item) => {
      const haystack = `${item.id} ${item.name}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [query])

  return (
    <Card className="border-dashed bg-slate-50">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FieldBlock label="Поиск по id/названию">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="cat-electronics или Смартфоны"
          />
        </FieldBlock>

        <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border bg-white p-2">
          {filtered.map((item) => {
            const checked = selectedIds.includes(item.id)
            return (
              <div key={item.id} className="rounded-md border p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={checked} onCheckedChange={(value) => onToggle(item.id, value === true)} />
                    <span style={{ paddingLeft: `${item.level * 14}px` }}>
                      {item.name} <span className="text-xs text-muted-foreground">({item.id})</span>
                    </span>
                  </label>

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
              </div>
            )
          })}
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

interface MetricCardProps {
  title: string
  value: string | number
}

function MetricCard(props: MetricCardProps) {
  const { title, value } = props

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

interface InfoRowProps {
  label: string
  value: string
}

function InfoRow(props: InfoRowProps) {
  const { label, value } = props

  return (
    <Card>
      <CardContent className="space-y-1 pt-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </CardContent>
    </Card>
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
