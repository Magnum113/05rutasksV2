import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react"

import {
  calcCategoryCoverage,
  type CategoryScope,
  CATEGORY_SCOPE_OPTIONS,
  type DiscountEntity,
  type DiscountStatus,
  DISCOUNT_STATUS_LABELS,
  DISCOUNT_STATUS_OPTIONS,
  formatProductList,
  formatPromotionList,
  formatPromoSellerList,
  formatRub,
  MOCK_DISCOUNTS,
  MOCK_PROMO_CODES,
  normalizeKeywordList,
  type PromoCategoryOption,
  type PromoChannel,
  PROMO_CATEGORY_OPTIONS,
  PROMO_CHANNEL_LABELS,
  PROMO_CHANNEL_OPTIONS,
  type PromoCodeEntity,
  type PromoDiscountType,
  PROMO_DISCOUNT_TYPE_LABELS,
  PROMO_DISCOUNT_TYPE_OPTIONS,
  type PromoFirstOrderFilter,
  PROMO_PRODUCT_OPTIONS,
  PROMO_PROMOTION_OPTIONS,
  type PromoStatus,
  PROMO_STATUS_LABELS,
  PROMO_STATUS_OPTIONS,
  type PromoUsageMode,
  PROMO_USAGE_MODE_LABELS,
  PROMO_USAGE_MODE_OPTIONS,
  PROMO_SELLER_OPTIONS,
  splitTokens,
  summarizeAssortmentRules,
  summarizeCategoryRules,
  summarizeTitleRules,
} from "@/admin/promoRegistry"
import { formatDate, parseDate } from "@/admin/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

interface PromoCodesSectionProps {
  mode: "promo" | "discounts"
  globalSearch: string
  promoCreateSignal: number
  discountCreateSignal: number
  onNavigate: (screen: "promo" | "discounts") => void
}

interface DiscountFilters {
  name: string
  status: "all" | DiscountStatus
  activeFrom: string
  activeTo: string
  channel: "all" | PromoChannel
  hasLinkedPromos: "all" | "yes" | "no"
}

interface PromoFilters {
  code: string
  status: "all" | PromoStatus
  activeFrom: string
  activeTo: string
  usageMode: "all" | PromoUsageMode
  firstOrderOnly: PromoFirstOrderFilter
  discountId: "all" | string
}

interface DiscountForm {
  status: DiscountStatus
  name: string
  start_date: string
  end_date: string
  discount_type: PromoDiscountType
  discount_value: string
  max_discount: string
  min_order_amount: string
  channels: PromoChannel[]
  seller_ids: string[]
  promotion_ids: string[]
  include_category_ids: string[]
  exclude_category_ids: string[]
  include_category_scopes: Record<string, CategoryScope>
  exclude_category_scopes: Record<string, CategoryScope>
  include_product_ids: string[]
  exclude_product_ids: string[]
  include_title_keywords: string[]
  exclude_title_keywords: string[]
}

interface PromoForm {
  status: PromoStatus
  code: string
  discount_id: string
  start_date: string
  end_date: string
  usage_mode: PromoUsageMode
  counter: string
  per_user_limit: string
  first_order_only: boolean
}

interface SectionFlash {
  type: "success" | "error" | "info"
  text: string
}

const PROMO_STATUS_VARIANT: Record<PromoStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  active: "default",
  inactive: "secondary",
}

const DISCOUNT_STATUS_VARIANT: Record<DiscountStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  active: "default",
  inactive: "secondary",
}

const CATEGORY_BY_ID = new Map(PROMO_CATEGORY_OPTIONS.map((item) => [item.id, item]))

function createDiscountForm(): DiscountForm {
  const now = new Date()
  const end = new Date(now.getTime() + 30 * 86400000)

  return {
    status: "draft",
    name: "",
    start_date: now.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    discount_type: "percent",
    discount_value: "",
    max_discount: "",
    min_order_amount: "",
    channels: ["web"],
    seller_ids: [],
    promotion_ids: [],
    include_category_ids: [],
    exclude_category_ids: [],
    include_category_scopes: {},
    exclude_category_scopes: {},
    include_product_ids: [],
    exclude_product_ids: [],
    include_title_keywords: [],
    exclude_title_keywords: [],
  }
}

function createPromoForm(prefilledDiscountId?: string): PromoForm {
  const now = new Date()
  const end = new Date(now.getTime() + 30 * 86400000)

  return {
    status: "draft",
    code: "",
    discount_id: prefilledDiscountId ?? "",
    start_date: now.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    usage_mode: "multi_use",
    counter: "",
    per_user_limit: "",
    first_order_only: false,
  }
}

function discountToForm(discount: DiscountEntity): DiscountForm {
  return {
    status: discount.status,
    name: discount.name,
    start_date: discount.start_date,
    end_date: discount.end_date,
    discount_type: discount.discount_type,
    discount_value: String(discount.discount_value),
    max_discount: discount.max_discount === null ? "" : String(discount.max_discount),
    min_order_amount: discount.min_order_amount === null ? "" : String(discount.min_order_amount),
    channels: [...discount.channels],
    seller_ids: [...discount.seller_ids],
    promotion_ids: [...discount.promotion_ids],
    include_category_ids: [...discount.include_category_ids],
    exclude_category_ids: [...discount.exclude_category_ids],
    include_category_scopes: { ...discount.include_category_scopes },
    exclude_category_scopes: { ...discount.exclude_category_scopes },
    include_product_ids: [...discount.include_product_ids],
    exclude_product_ids: [...discount.exclude_product_ids],
    include_title_keywords: [...discount.include_title_keywords],
    exclude_title_keywords: [...discount.exclude_title_keywords],
  }
}

function promoToForm(promo: PromoCodeEntity): PromoForm {
  return {
    status: promo.status,
    code: promo.code,
    discount_id: promo.discount_id ?? "",
    start_date: promo.start_date,
    end_date: promo.end_date,
    usage_mode: promo.usage_mode,
    counter: promo.counter === null ? "" : String(promo.counter),
    per_user_limit: promo.per_user_limit === null ? "" : String(promo.per_user_limit),
    first_order_only: promo.first_order_only,
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
  const { mode, globalSearch, promoCreateSignal, discountCreateSignal, onNavigate } = props

  const [discounts, setDiscounts] = useState<DiscountEntity[]>(MOCK_DISCOUNTS)
  const [promos, setPromos] = useState<PromoCodeEntity[]>(MOCK_PROMO_CODES)

  const [discountViewMode, setDiscountViewMode] = useState<"list" | "form">("list")
  const [promoViewMode, setPromoViewMode] = useState<"list" | "form">("list")

  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null)
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null)

  const [discountForm, setDiscountForm] = useState<DiscountForm>(createDiscountForm)
  const [promoForm, setPromoForm] = useState<PromoForm>(createPromoForm)

  const [discountFormErrors, setDiscountFormErrors] = useState<string[]>([])
  const [discountFieldErrors, setDiscountFieldErrors] = useState<Record<string, string>>({})
  const [promoFormErrors, setPromoFormErrors] = useState<string[]>([])
  const [promoFieldErrors, setPromoFieldErrors] = useState<Record<string, string>>({})

  const [flash, setFlash] = useState<SectionFlash | null>(null)

  const [discountFilters, setDiscountFilters] = useState<DiscountFilters>({
    name: "",
    status: "all",
    activeFrom: "",
    activeTo: "",
    channel: "all",
    hasLinkedPromos: "all",
  })

  const [promoFilters, setPromoFilters] = useState<PromoFilters>({
    code: "",
    status: "all",
    activeFrom: "",
    activeTo: "",
    usageMode: "all",
    firstOrderOnly: "all",
    discountId: "all",
  })

  const discountById = useMemo(() => new Map(discounts.map((item) => [item.id, item])), [discounts])

  useEffect(() => {
    if (promoCreateSignal === 0) {
      return
    }

    startCreatePromo()
  }, [promoCreateSignal])

  useEffect(() => {
    if (discountCreateSignal === 0) {
      return
    }

    startCreateDiscount()
  }, [discountCreateSignal])

  useEffect(() => {
    if (!flash) {
      return
    }

    const timeout = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(timeout)
  }, [flash])

  useEffect(() => {
    if (promoForm.usage_mode !== "one_time") {
      return
    }

    setPromoForm((prev) => {
      if (prev.counter === "1" && prev.per_user_limit === "1") {
        return prev
      }

      return {
        ...prev,
        counter: "1",
        per_user_limit: "1",
      }
    })
  }, [promoForm.usage_mode])

  const query = globalSearch.trim().toLowerCase()

  const linkedPromoCountByDiscount = useMemo(() => {
    const map = new Map<string, number>()

    for (const promo of promos) {
      if (!promo.discount_id) {
        continue
      }

      map.set(promo.discount_id, (map.get(promo.discount_id) ?? 0) + 1)
    }

    return map
  }, [promos])

  const filteredDiscounts = useMemo(() => {
    const rows = discounts.filter((item) => {
      if (query) {
        const haystack =
          `${item.id} ${item.name} ${item.seller_ids.join(" ")} ${item.promotion_ids.join(" ")} ${formatPromoSellerList(item.seller_ids)} ${formatPromotionList(item.promotion_ids)} ${item.include_category_ids.join(" ")} ${item.exclude_category_ids.join(" ")}`.toLowerCase()

        if (!haystack.includes(query)) {
          return false
        }
      }

      if (discountFilters.name && !item.name.toLowerCase().includes(discountFilters.name.toLowerCase())) {
        return false
      }

      if (discountFilters.status !== "all" && item.status !== discountFilters.status) {
        return false
      }

      if (discountFilters.channel !== "all" && !item.channels.includes(discountFilters.channel)) {
        return false
      }

      const linkedCount = linkedPromoCountByDiscount.get(item.id) ?? 0
      if (discountFilters.hasLinkedPromos === "yes" && linkedCount === 0) {
        return false
      }

      if (discountFilters.hasLinkedPromos === "no" && linkedCount > 0) {
        return false
      }

      if (discountFilters.activeFrom) {
        const from = parseDate(discountFilters.activeFrom)
        const end = parseDate(item.end_date)

        if (from && end && end < from) {
          return false
        }
      }

      if (discountFilters.activeTo) {
        const to = parseDate(discountFilters.activeTo)
        const start = parseDate(item.start_date)

        if (to && start && start > to) {
          return false
        }
      }

      return true
    })

    rows.sort((a, b) => (parseDate(b.created_at)?.getTime() ?? 0) - (parseDate(a.created_at)?.getTime() ?? 0))

    return rows
  }, [discountFilters, discounts, linkedPromoCountByDiscount, query])

  const filteredPromos = useMemo(() => {
    const rows = promos.filter((item) => {
      const linkedDiscount = item.discount_id ? discountById.get(item.discount_id) : null

      if (query) {
        const haystack =
          `${item.code} ${item.discount_id ?? ""} ${linkedDiscount?.name ?? ""} ${linkedDiscount?.status ?? ""}`.toLowerCase()

        if (!haystack.includes(query)) {
          return false
        }
      }

      if (promoFilters.code && !item.code.toLowerCase().includes(promoFilters.code.toLowerCase())) {
        return false
      }

      if (promoFilters.status !== "all" && item.status !== promoFilters.status) {
        return false
      }

      if (promoFilters.usageMode !== "all" && item.usage_mode !== promoFilters.usageMode) {
        return false
      }

      if (promoFilters.firstOrderOnly === "yes" && !item.first_order_only) {
        return false
      }

      if (promoFilters.firstOrderOnly === "no" && item.first_order_only) {
        return false
      }

      if (promoFilters.discountId !== "all" && item.discount_id !== promoFilters.discountId) {
        return false
      }

      if (promoFilters.activeFrom) {
        const from = parseDate(promoFilters.activeFrom)
        const end = parseDate(item.end_date)

        if (from && end && end < from) {
          return false
        }
      }

      if (promoFilters.activeTo) {
        const to = parseDate(promoFilters.activeTo)
        const start = parseDate(item.start_date)

        if (to && start && start > to) {
          return false
        }
      }

      return true
    })

    rows.sort((a, b) => (parseDate(b.created_at)?.getTime() ?? 0) - (parseDate(a.created_at)?.getTime() ?? 0))

    return rows
  }, [discountById, promoFilters, promos, query])

  const includeCoveragePreview = useMemo(
    () => calcCategoryCoverage(discountForm.include_category_ids, discountForm.include_category_scopes, PROMO_CATEGORY_OPTIONS),
    [discountForm.include_category_ids, discountForm.include_category_scopes],
  )

  const excludeCoveragePreview = useMemo(
    () => calcCategoryCoverage(discountForm.exclude_category_ids, discountForm.exclude_category_scopes, PROMO_CATEGORY_OPTIONS),
    [discountForm.exclude_category_ids, discountForm.exclude_category_scopes],
  )

  const categoryConflicts = useMemo(() => {
    const includeSet = new Set(discountForm.include_category_ids)
    return discountForm.exclude_category_ids.filter((item) => includeSet.has(item))
  }, [discountForm.exclude_category_ids, discountForm.include_category_ids])

  const keywordConflicts = useMemo(() => {
    const includeSet = new Set(discountForm.include_title_keywords.map((item) => item.toLowerCase()))
    return discountForm.exclude_title_keywords.filter((item) => includeSet.has(item.toLowerCase()))
  }, [discountForm.exclude_title_keywords, discountForm.include_title_keywords])

  const relatedPromosForDiscount = useMemo(() => {
    if (!editingDiscountId) {
      return []
    }

    return promos.filter((item) => item.discount_id === editingDiscountId)
  }, [editingDiscountId, promos])

  const selectedPromoDiscount = promoForm.discount_id ? discountById.get(promoForm.discount_id) : null

  function setDiscountField<K extends keyof DiscountForm>(key: K, value: DiscountForm[K]) {
    setDiscountForm((prev) => ({ ...prev, [key]: value }))
  }

  function setPromoField<K extends keyof PromoForm>(key: K, value: PromoForm[K]) {
    setPromoForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetDiscountForm() {
    setDiscountForm(createDiscountForm())
    setDiscountFormErrors([])
    setDiscountFieldErrors({})
  }

  function resetPromoForm(prefilledDiscountId?: string) {
    setPromoForm(createPromoForm(prefilledDiscountId))
    setPromoFormErrors([])
    setPromoFieldErrors({})
  }

  function startCreateDiscount() {
    setEditingDiscountId(null)
    setDiscountViewMode("form")
    resetDiscountForm()
    onNavigate("discounts")
  }

  function startEditDiscount(discount: DiscountEntity) {
    setEditingDiscountId(discount.id)
    setDiscountViewMode("form")
    setDiscountForm(discountToForm(discount))
    setDiscountFormErrors([])
    setDiscountFieldErrors({})
    onNavigate("discounts")
  }

  function startCreatePromo(prefilledDiscountId?: string) {
    setEditingPromoId(null)
    setPromoViewMode("form")
    resetPromoForm(prefilledDiscountId)
    onNavigate("promo")
  }

  function startEditPromo(promo: PromoCodeEntity) {
    setEditingPromoId(promo.id)
    setPromoViewMode("form")
    setPromoForm(promoToForm(promo))
    setPromoFormErrors([])
    setPromoFieldErrors({})
    onNavigate("promo")
  }

  function toggleDiscountChannel(channel: PromoChannel, checked: boolean) {
    setDiscountForm((prev) => {
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
    setDiscountForm((prev) => {
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
    setDiscountForm((prev) => {
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

  function validateDiscountForm(): { errors: string[]; fieldMap: Record<string, string> } {
    const errors: string[] = []
    const fieldMap: Record<string, string> = {}

    const addError = (field: string, message: string) => {
      fieldMap[field] = message
      errors.push(message)
    }

    if (!discountForm.name.trim()) {
      addError("name", "Поле «Название скидки» обязательно")
    }

    if (!discountForm.start_date) {
      addError("start_date", "Поле «Дата начала» обязательно")
    }

    if (!discountForm.end_date) {
      addError("end_date", "Поле «Дата окончания» обязательно")
    }

    const start = parseDate(discountForm.start_date)
    const end = parseDate(discountForm.end_date)

    if (start && end && start > end) {
      addError("end_date", "Дата начала скидки не может быть позже даты окончания")
    }

    const discountValue = Number(discountForm.discount_value)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      addError("discount_value", "Значение скидки должно быть больше 0")
    }

    if (discountForm.max_discount !== "") {
      const maxDiscount = Number(discountForm.max_discount)
      if (!Number.isFinite(maxDiscount) || maxDiscount <= 0) {
        addError("max_discount", "Максимальная скидка должна быть больше 0, если заполнена")
      }
    }

    if (discountForm.min_order_amount !== "") {
      const minOrderAmount = Number(discountForm.min_order_amount)
      if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
        addError("min_order_amount", "Минимальная сумма заказа должна быть не меньше 0, если заполнена")
      }
    }

    if (discountForm.channels.length === 0) {
      addError("channels", "Для скидки нужен минимум один канал (web или app)")
    }

    const knownPromotionIds = new Set(PROMO_PROMOTION_OPTIONS.map((option) => option.id))
    const unknownPromotions = discountForm.promotion_ids.filter((promotionId) => !knownPromotionIds.has(promotionId))
    if (unknownPromotions.length > 0) {
      addError(
        "promotion_ids",
        `Выбраны несуществующие акции: ${unknownPromotions.join(", ")}. Такая скидка невалидна.`,
      )
    }

    const includeKeywords = normalizeKeywordList(discountForm.include_title_keywords)
    const excludeKeywords = normalizeKeywordList(discountForm.exclude_title_keywords)

    if (includeKeywords.length !== discountForm.include_title_keywords.length) {
      addError("include_title_keywords", "Пустые и дублирующиеся включающие слова не допускаются")
    }

    if (excludeKeywords.length !== discountForm.exclude_title_keywords.length) {
      addError("exclude_title_keywords", "Пустые и дублирующиеся исключающие слова не допускаются")
    }

    return { errors, fieldMap }
  }

  function saveDiscount() {
    const validation = validateDiscountForm()
    setDiscountFormErrors(validation.errors)
    setDiscountFieldErrors(validation.fieldMap)

    if (validation.errors.length > 0) {
      setFlash({ type: "error", text: "Форма скидки содержит ошибки" })
      return
    }

    const payload = {
      status: discountForm.status,
      name: discountForm.name.trim(),
      start_date: discountForm.start_date,
      end_date: discountForm.end_date,
      discount_type: discountForm.discount_type,
      discount_value: Number(discountForm.discount_value),
      max_discount: discountForm.max_discount === "" ? null : Number(discountForm.max_discount),
      min_order_amount: discountForm.min_order_amount === "" ? null : Number(discountForm.min_order_amount),
      channels: [...discountForm.channels],
      seller_ids: [...discountForm.seller_ids],
      promotion_ids: [...discountForm.promotion_ids],
      include_category_ids: [...discountForm.include_category_ids],
      exclude_category_ids: [...discountForm.exclude_category_ids],
      include_category_scopes: { ...discountForm.include_category_scopes },
      exclude_category_scopes: { ...discountForm.exclude_category_scopes },
      include_product_ids: [...discountForm.include_product_ids],
      exclude_product_ids: [...discountForm.exclude_product_ids],
      include_title_keywords: normalizeKeywordList(discountForm.include_title_keywords),
      exclude_title_keywords: normalizeKeywordList(discountForm.exclude_title_keywords),
    }

    if (editingDiscountId) {
      setDiscounts((prev) =>
        prev.map((item) =>
          item.id === editingDiscountId
            ? {
                ...item,
                ...payload,
              }
            : item,
        ),
      )

      setFlash({ type: "success", text: `Скидка «${payload.name}» обновлена` })
    } else {
      const newDiscount: DiscountEntity = {
        id: `discount_${Date.now().toString().slice(-6)}`,
        created_at: new Date().toISOString(),
        ...payload,
      }

      setDiscounts((prev) => [newDiscount, ...prev])
      setFlash({ type: "success", text: `Скидка «${newDiscount.name}» сохранена` })
    }

    setDiscountViewMode("list")
    setEditingDiscountId(null)
    resetDiscountForm()
  }

  function validatePromoForm(): { errors: string[]; fieldMap: Record<string, string> } {
    const errors: string[] = []
    const fieldMap: Record<string, string> = {}

    const addError = (field: string, message: string) => {
      fieldMap[field] = message
      errors.push(message)
    }

    if (!promoForm.code.trim()) {
      addError("code", "Поле «Код промокода» обязательно")
    }

    const duplicateCode = promos.find(
      (item) => item.code.toLowerCase() === promoForm.code.trim().toLowerCase() && item.id !== editingPromoId,
    )

    if (duplicateCode) {
      addError("code", "Промокод с таким кодом уже существует")
    }

    if (!promoForm.start_date) {
      addError("start_date", "Поле «Дата начала» обязательно")
    }

    if (!promoForm.end_date) {
      addError("end_date", "Поле «Дата окончания» обязательно")
    }

    const start = parseDate(promoForm.start_date)
    const end = parseDate(promoForm.end_date)

    if (start && end && start > end) {
      addError("end_date", "Дата начала промокода не может быть позже даты окончания")
    }

    if (promoForm.status !== "draft" && !promoForm.discount_id) {
      addError("discount_id", "Для статуса «Активен/Неактивен» обязательно выбрать связанную скидку")
    }

    if (promoForm.counter !== "") {
      const counter = Number(promoForm.counter)
      if (!Number.isInteger(counter) || counter <= 0) {
        addError("counter", "Общий лимит должен быть пустым или целым числом больше 0")
      }
    }

    if (promoForm.per_user_limit !== "") {
      const perUserLimit = Number(promoForm.per_user_limit)
      if (!Number.isInteger(perUserLimit) || perUserLimit <= 0) {
        addError("per_user_limit", "Лимит на пользователя должен быть пустым или целым числом больше 0")
      }
    }

    return { errors, fieldMap }
  }

  function savePromo() {
    const validation = validatePromoForm()
    setPromoFormErrors(validation.errors)
    setPromoFieldErrors(validation.fieldMap)

    if (validation.errors.length > 0) {
      setFlash({ type: "error", text: "Форма промокода содержит ошибки" })
      return
    }

    const normalizedCounter = promoForm.usage_mode === "one_time" ? 1 : promoForm.counter === "" ? null : Number(promoForm.counter)
    const normalizedPerUser =
      promoForm.usage_mode === "one_time" ? 1 : promoForm.per_user_limit === "" ? null : Number(promoForm.per_user_limit)

    const payload = {
      status: promoForm.status,
      code: promoForm.code.trim(),
      discount_id: promoForm.discount_id ? promoForm.discount_id : null,
      start_date: promoForm.start_date,
      end_date: promoForm.end_date,
      usage_mode: promoForm.usage_mode,
      counter: normalizedCounter,
      per_user_limit: normalizedPerUser,
      first_order_only: promoForm.first_order_only,
    }

    if (editingPromoId) {
      setPromos((prev) =>
        prev.map((item) =>
          item.id === editingPromoId
            ? {
                ...item,
                ...payload,
              }
            : item,
        ),
      )

      setFlash({ type: "success", text: `Промокод ${payload.code} обновлен` })
    } else {
      const newPromo: PromoCodeEntity = {
        id: `promo_${Math.random().toString(36).slice(2, 8)}`,
        current_counter: 0,
        usages_count: 0,
        revenue_total: 0,
        created_at: new Date().toISOString(),
        ...payload,
      }

      setPromos((prev) => [newPromo, ...prev])
      setFlash({ type: "success", text: `Промокод ${newPromo.code} сохранен` })
    }

    setPromoViewMode("list")
    setEditingPromoId(null)
    resetPromoForm()
  }

  function resetDiscountFilters() {
    setDiscountFilters({
      name: "",
      status: "all",
      activeFrom: "",
      activeTo: "",
      channel: "all",
      hasLinkedPromos: "all",
    })
  }

  function resetPromoFilters() {
    setPromoFilters({
      code: "",
      status: "all",
      activeFrom: "",
      activeTo: "",
      usageMode: "all",
      firstOrderOnly: "all",
      discountId: "all",
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {flash ? (
        <Alert variant={flash.type === "error" ? "destructive" : "default"}>
          <AlertTitle>{flash.type === "error" ? "Ошибка" : "Готово"}</AlertTitle>
          <AlertDescription>{flash.text}</AlertDescription>
        </Alert>
      ) : null}

      {mode === "discounts" ? (
        <div className="flex flex-col gap-4">
          {discountViewMode === "list" ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">Скидки</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Раздел `Маркетинг → Скидки`: список, создание и редактирование скидок.
                  </p>
                </div>

                <Button onClick={startCreateDiscount}>Создать скидку</Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Фильтры</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <FieldBlock label="Название скидки">
                      <Input
                        value={discountFilters.name}
                        onChange={(event) => setDiscountFilters((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Весенняя скидка"
                      />
                    </FieldBlock>

                    <PromoSelectField
                      label="Статус"
                      value={discountFilters.status}
                      options={[{ value: "all", label: "Все" }, ...DISCOUNT_STATUS_OPTIONS]}
                      onChange={(value) => setDiscountFilters((prev) => ({ ...prev, status: value as DiscountFilters["status"] }))}
                    />

                    <FieldBlock label="Активна с">
                      <Input
                        type="date"
                        value={discountFilters.activeFrom}
                        onChange={(event) => setDiscountFilters((prev) => ({ ...prev, activeFrom: event.target.value }))}
                      />
                    </FieldBlock>

                    <FieldBlock label="Активна по">
                      <Input
                        type="date"
                        value={discountFilters.activeTo}
                        onChange={(event) => setDiscountFilters((prev) => ({ ...prev, activeTo: event.target.value }))}
                      />
                    </FieldBlock>

                    <PromoSelectField
                      label="Канал"
                      value={discountFilters.channel}
                      options={[{ value: "all", label: "Все" }, ...PROMO_CHANNEL_OPTIONS]}
                      onChange={(value) =>
                        setDiscountFilters((prev) => ({ ...prev, channel: value as DiscountFilters["channel"] }))
                      }
                    />

                    <PromoSelectField
                      label="Связанные промокоды"
                      value={discountFilters.hasLinkedPromos}
                      options={[
                        { value: "all", label: "Все" },
                        { value: "yes", label: "Есть" },
                        { value: "no", label: "Нет" },
                      ]}
                      onChange={(value) =>
                        setDiscountFilters((prev) => ({ ...prev, hasLinkedPromos: value as DiscountFilters["hasLinkedPromos"] }))
                      }
                    />
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="outline" onClick={resetDiscountFilters}>
                    Сбросить фильтры
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="rounded-md border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Название</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Период активности</TableHead>
                          <TableHead>Тип / значение</TableHead>
                          <TableHead>Мин. сумма заказа</TableHead>
                          <TableHead>Макс. скидка</TableHead>
                          <TableHead>Ключевые ограничения</TableHead>
                          <TableHead>Связанных промокодов</TableHead>
                          <TableHead>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDiscounts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9}>
                              <p className="py-6 text-center text-sm text-muted-foreground">Скидки не найдены.</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredDiscounts.map((item) => {
                            const linkedPromos = linkedPromoCountByDiscount.get(item.id) ?? 0
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-semibold">{item.name}</TableCell>
                                <TableCell>
                                  <Badge variant={DISCOUNT_STATUS_VARIANT[item.status]}>
                                    {DISCOUNT_STATUS_LABELS[item.status]}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {formatDate(item.start_date)} - {formatDate(item.end_date)}
                                </TableCell>
                                <TableCell>
                                  {PROMO_DISCOUNT_TYPE_LABELS[item.discount_type]} /{" "}
                                  {item.discount_type === "percent"
                                    ? `${item.discount_value}%`
                                    : formatRub(item.discount_value)}
                                </TableCell>
                                <TableCell>
                                  {item.min_order_amount === null ? "От любой суммы" : formatRub(item.min_order_amount)}
                                </TableCell>
                                <TableCell>{item.max_discount === null ? "Без ограничения" : formatRub(item.max_discount)}</TableCell>
                                <TableCell>
                                  <p className="text-sm">Каналы: {item.channels.map((channel) => PROMO_CHANNEL_LABELS[channel]).join(", ")}</p>
                                  <p className="text-sm">Продавцы: {formatPromoSellerList(item.seller_ids)}</p>
                                  <p className="text-sm">Акции: {formatPromotionList(item.promotion_ids)}</p>
                                  <p className="text-sm text-muted-foreground">{summarizeAssortmentRules(item)}</p>
                                </TableCell>
                                <TableCell>{linkedPromos}</TableCell>
                                <TableCell>
                                  <Button size="sm" variant="outline" onClick={() => startEditDiscount(item)}>
                                    Изменить
                                  </Button>
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
            </>
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-semibold">{editingDiscountId ? "Редактировать скидку" : "Создать скидку"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Все условия и параметры расчета задаются в сущности скидки.
                </p>
              </div>

              {discountFormErrors.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTitle>Проверьте поля формы скидки</AlertTitle>
                  <AlertDescription>
                    <ul className="ml-4 flex list-disc flex-col gap-1">
                      {discountFormErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>Основное</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <PromoSelectField
                      label="Статус *"
                      value={discountForm.status}
                      options={DISCOUNT_STATUS_OPTIONS}
                      onChange={(value) => setDiscountField("status", value as DiscountStatus)}
                    />

                    <FieldBlock label="Название скидки *" error={discountFieldErrors.name}>
                      <Input
                        value={discountForm.name}
                        onChange={(event) => setDiscountField("name", event.target.value)}
                        placeholder="Весенняя скидка на смартфоны"
                      />
                    </FieldBlock>

                    <FieldBlock label="Дата начала *" error={discountFieldErrors.start_date}>
                      <Input
                        type="date"
                        value={discountForm.start_date}
                        onChange={(event) => setDiscountField("start_date", event.target.value)}
                      />
                    </FieldBlock>

                    <FieldBlock label="Дата окончания *" error={discountFieldErrors.end_date}>
                      <Input
                        type="date"
                        value={discountForm.end_date}
                        onChange={(event) => setDiscountField("end_date", event.target.value)}
                      />
                    </FieldBlock>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Расчет скидки</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    <PromoSelectField
                      label="Тип скидки *"
                      value={discountForm.discount_type}
                      options={PROMO_DISCOUNT_TYPE_OPTIONS}
                      onChange={(value) => setDiscountField("discount_type", value as PromoDiscountType)}
                    />

                    <FieldBlock label="Значение скидки *" error={discountFieldErrors.discount_value}>
                      <Input
                        type="number"
                        min="1"
                        value={discountForm.discount_value}
                        onChange={(event) => setDiscountField("discount_value", event.target.value)}
                      />
                    </FieldBlock>

                    <FieldBlock label="Макс. скидка (опционально)" error={discountFieldErrors.max_discount}>
                      <Input
                        type="number"
                        min="1"
                        value={discountForm.max_discount}
                        onChange={(event) => setDiscountField("max_discount", event.target.value)}
                        placeholder="Пусто = без верхнего лимита"
                      />
                    </FieldBlock>

                    <FieldBlock label="Мин. сумма заказа (опционально)" error={discountFieldErrors.min_order_amount}>
                      <Input
                        type="number"
                        min="0"
                        value={discountForm.min_order_amount}
                        onChange={(event) => setDiscountField("min_order_amount", event.target.value)}
                        placeholder="Пусто = от любой суммы"
                      />
                    </FieldBlock>
                  </div>

                  <FieldDescription>Если задан `max_discount`, итоговая скидка ограничивается этим значением.</FieldDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Каналы и продавцы</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <FieldSet>
                    <FieldLegend>Каналы применения * (минимум 1)</FieldLegend>
                    <FieldGroup className="flex-row flex-wrap gap-4 rounded-md border bg-muted p-3">
                      {PROMO_CHANNEL_OPTIONS.map((option) => (
                        <Field key={option.value} orientation="horizontal" className="w-auto">
                          <Checkbox
                            id={`discount-channel-${option.value}`}
                            checked={discountForm.channels.includes(option.value)}
                            onCheckedChange={(checked) => toggleDiscountChannel(option.value, checked === true)}
                          />
                          <FieldLabel htmlFor={`discount-channel-${option.value}`}>{option.label}</FieldLabel>
                        </Field>
                      ))}
                    </FieldGroup>
                    <FieldError>{discountFieldErrors.channels}</FieldError>
                  </FieldSet>

                  <FieldBlock label="Продавцы (опционально)">
                    <MultiSelectDropdown
                      value={discountForm.seller_ids}
                      options={PROMO_SELLER_OPTIONS.map((option) => ({ value: option.id, label: `${option.name} (${option.id})` }))}
                      placeholder="Любые продавцы"
                      onChange={(next) => setDiscountField("seller_ids", next)}
                    />
                    <FieldDescription>Можно выбрать одного или нескольких продавцов из выпадающего списка.</FieldDescription>
                  </FieldBlock>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ассортимент</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <CategoryRuleSelector
                      title="Включить категории"
                      selectedIds={discountForm.include_category_ids}
                      scopes={discountForm.include_category_scopes}
                      onToggle={(id, checked) => toggleCategory("include", id, checked)}
                      onScopeChange={(id, scope) => setCategoryScope("include", id, scope)}
                    />

                    <CategoryRuleSelector
                      title="Исключить категории"
                      selectedIds={discountForm.exclude_category_ids}
                      scopes={discountForm.exclude_category_scopes}
                      onToggle={(id, checked) => toggleCategory("exclude", id, checked)}
                      onScopeChange={(id, scope) => setCategoryScope("exclude", id, scope)}
                    />
                  </div>

                  <FieldBlock label="Выбор акций (опционально)" error={discountFieldErrors.promotion_ids}>
                    <MultiSelectDropdown
                      value={discountForm.promotion_ids}
                      options={PROMO_PROMOTION_OPTIONS.map((option) => ({ value: option.id, label: `${option.name} (${option.id})` }))}
                      placeholder="Акции не выбраны"
                      onChange={(next) => setDiscountField("promotion_ids", next)}
                    />
                    <FieldDescription>
                      Если выбрана акция, скидка применяется только к товарам этой акции. При одновременных фильтрах
                      (категории/товары/слова) применяется пересечение условий.
                    </FieldDescription>
                  </FieldBlock>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FieldBlock label="Включить товары (опционально)">
                      <MultiSelectDropdown
                        value={discountForm.include_product_ids}
                        options={PROMO_PRODUCT_OPTIONS.map((option) => ({ value: option.id, label: `${option.name} (${option.id})` }))}
                        placeholder="Не выбрано"
                        onChange={(next) => setDiscountField("include_product_ids", next)}
                      />
                    </FieldBlock>

                    <FieldBlock label="Исключить товары (опционально)">
                      <MultiSelectDropdown
                        value={discountForm.exclude_product_ids}
                        options={PROMO_PRODUCT_OPTIONS.map((option) => ({ value: option.id, label: `${option.name} (${option.id})` }))}
                        placeholder="Не выбрано"
                        onChange={(next) => setDiscountField("exclude_product_ids", next)}
                      />
                    </FieldBlock>
                  </div>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <TokenInput
                      label="Включить слова в названии"
                      values={discountForm.include_title_keywords}
                      placeholder="смартфон, iphone"
                      error={discountFieldErrors.include_title_keywords}
                      onChange={(values) => setDiscountField("include_title_keywords", values)}
                    />

                    <TokenInput
                      label="Исключить слова в названии"
                      values={discountForm.exclude_title_keywords}
                      placeholder="уценка, восстановленный"
                      error={discountFieldErrors.exclude_title_keywords}
                      onChange={(values) => setDiscountField("exclude_title_keywords", values)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Alert>
                      <AlertTitle>Охват включенных категорий</AlertTitle>
                      <AlertDescription>{includeCoveragePreview}</AlertDescription>
                    </Alert>

                    <Alert>
                      <AlertTitle>Охват исключенных категорий</AlertTitle>
                      <AlertDescription>{excludeCoveragePreview}</AlertDescription>
                    </Alert>
                  </div>

                  {categoryConflicts.length > 0 ? (
                    <Alert>
                      <AlertTitle>Пересечение категорий</AlertTitle>
                      <AlertDescription>
                        Есть пересечения между включенными и исключенными категориями: {categoryConflicts.join(", ")}.
                        Приоритет у исключения.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {keywordConflicts.length > 0 ? (
                    <Alert>
                      <AlertTitle>Конфликт ключевых слов</AlertTitle>
                      <AlertDescription>
                        Конфликт между включающими и исключающими словами: {keywordConflicts.join(", ")}. Приоритет у исключения.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <Alert>
                    <AlertTitle>Выбранные акции</AlertTitle>
                    <AlertDescription>
                      <p>{formatPromotionList(discountForm.promotion_ids)}</p>
                      <p>Логика: акция + другие фильтры работают как пересечение условий.</p>
                    </AlertDescription>
                  </Alert>

                  <Alert>
                    <AlertTitle>Выбранные товары</AlertTitle>
                    <AlertDescription>
                      <p>Включенные товары: {formatProductList(discountForm.include_product_ids)}</p>
                      <p>Исключенные товары: {formatProductList(discountForm.exclude_product_ids)}</p>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Связанные промокоды</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {editingDiscountId ? (
                    <div className="rounded-md border bg-card">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Код</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Период</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {relatedPromosForDiscount.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3}>
                                <p className="py-3 text-sm text-muted-foreground">Связанных промокодов пока нет.</p>
                              </TableCell>
                            </TableRow>
                          ) : (
                            relatedPromosForDiscount.map((promo) => (
                              <TableRow key={promo.id}>
                                <TableCell className="font-semibold">{promo.code}</TableCell>
                                <TableCell>
                                  <Badge variant={PROMO_STATUS_VARIANT[promo.status]}>
                                    {PROMO_STATUS_LABELS[promo.status]}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {formatDate(promo.start_date)} - {formatDate(promo.end_date)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Чтобы создавать связанные промокоды, сначала сохраните скидку.
                    </p>
                  )}

                  <Button
                    variant="outline"
                    disabled={!editingDiscountId}
                    onClick={() => startCreatePromo(editingDiscountId ?? undefined)}
                  >
                    Создать промокод
                  </Button>
                </CardContent>
              </Card>

              <Card className="sticky bottom-2">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={resetDiscountForm}>
                      Очистить форму
                    </Button>
                    <Button onClick={saveDiscount}>{editingDiscountId ? "Сохранить изменения" : "Сохранить скидку"}</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDiscountViewMode("list")
                        setEditingDiscountId(null)
                        resetDiscountForm()
                      }}
                    >
                      К списку
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      ) : null}

      {mode === "promo" ? (
        <div className="flex flex-col gap-4">
          {promoViewMode === "list" ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">Промокоды</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Раздел `Маркетинг → Промокоды`: список, создание и редактирование промокодов.
                  </p>
                </div>

                <Button onClick={() => startCreatePromo()}>Создать промокод</Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Фильтры</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <FieldBlock label="Код промокода">
                      <Input
                        value={promoFilters.code}
                        onChange={(event) => setPromoFilters((prev) => ({ ...prev, code: event.target.value }))}
                        placeholder="SPRINGPHONE"
                      />
                    </FieldBlock>

                    <PromoSelectField
                      label="Статус"
                      value={promoFilters.status}
                      options={[{ value: "all", label: "Все" }, ...PROMO_STATUS_OPTIONS]}
                      onChange={(value) => setPromoFilters((prev) => ({ ...prev, status: value as PromoFilters["status"] }))}
                    />

                    <FieldBlock label="Активен с">
                      <Input
                        type="date"
                        value={promoFilters.activeFrom}
                        onChange={(event) => setPromoFilters((prev) => ({ ...prev, activeFrom: event.target.value }))}
                      />
                    </FieldBlock>

                    <FieldBlock label="Активен по">
                      <Input
                        type="date"
                        value={promoFilters.activeTo}
                        onChange={(event) => setPromoFilters((prev) => ({ ...prev, activeTo: event.target.value }))}
                      />
                    </FieldBlock>

                    <PromoSelectField
                      label="Режим использования"
                      value={promoFilters.usageMode}
                      options={[{ value: "all", label: "Все" }, ...PROMO_USAGE_MODE_OPTIONS]}
                      onChange={(value) => setPromoFilters((prev) => ({ ...prev, usageMode: value as PromoFilters["usageMode"] }))}
                    />

                    <PromoSelectField
                      label="Только первый заказ"
                      value={promoFilters.firstOrderOnly}
                      options={[
                        { value: "all", label: "Все" },
                        { value: "yes", label: "Да" },
                        { value: "no", label: "Нет" },
                      ]}
                      onChange={(value) =>
                        setPromoFilters((prev) => ({ ...prev, firstOrderOnly: value as PromoFilters["firstOrderOnly"] }))
                      }
                    />

                    <PromoSelectField
                      label="Связанная скидка"
                      value={promoFilters.discountId}
                      options={[
                        { value: "all", label: "Все" },
                        ...discounts.map((discount) => ({
                          value: discount.id,
                          label: `${discount.name} (${DISCOUNT_STATUS_LABELS[discount.status]})`,
                        })),
                      ]}
                      onChange={(value) => setPromoFilters((prev) => ({ ...prev, discountId: value }))}
                    />
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="outline" onClick={resetPromoFilters}>
                    Сбросить фильтры
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="rounded-md border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Код</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Период действия</TableHead>
                          <TableHead>Режим использования</TableHead>
                          <TableHead>Только первый заказ</TableHead>
                          <TableHead>counter / current</TableHead>
                          <TableHead>per_user_limit</TableHead>
                          <TableHead>Связанная скидка</TableHead>
                          <TableHead>Сколько раз применили</TableHead>
                          <TableHead>Выручка</TableHead>
                          <TableHead>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPromos.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11}>
                              <p className="py-6 text-center text-sm text-muted-foreground">Промокоды не найдены.</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredPromos.map((item) => {
                            const linkedDiscount = item.discount_id ? discountById.get(item.discount_id) : null

                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-semibold">{item.code}</TableCell>
                                <TableCell>
                                  <Badge variant={PROMO_STATUS_VARIANT[item.status]}>
                                    {PROMO_STATUS_LABELS[item.status]}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {formatDate(item.start_date)} - {formatDate(item.end_date)}
                                </TableCell>
                                <TableCell>{PROMO_USAGE_MODE_LABELS[item.usage_mode]}</TableCell>
                                <TableCell>{item.first_order_only ? "Да" : "Нет"}</TableCell>
                                <TableCell>
                                  {item.counter ?? "∞"}/{item.current_counter}
                                </TableCell>
                                <TableCell>{item.per_user_limit ?? "∞"}</TableCell>
                                <TableCell>
                                  {linkedDiscount ? (
                                    <div className="flex flex-col gap-1">
                                      <p className="text-sm font-medium">{linkedDiscount.name}</p>
                                      <Badge variant={DISCOUNT_STATUS_VARIANT[linkedDiscount.status]}>
                                        {DISCOUNT_STATUS_LABELS[linkedDiscount.status]}
                                      </Badge>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Не выбрана</p>
                                  )}
                                </TableCell>
                                <TableCell>{item.usages_count}</TableCell>
                                <TableCell>{formatRub(item.revenue_total)}</TableCell>
                                <TableCell>
                                  <Button size="sm" variant="outline" onClick={() => startEditPromo(item)}>
                                    Изменить
                                  </Button>
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
            </>
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-semibold">{editingPromoId ? "Редактировать промокод" : "Создать промокод"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Код, период и лимиты настраиваются в промокоде. Условия применения берутся из связанной скидки.
                </p>
              </div>

              {promoFormErrors.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTitle>Проверьте поля формы промокода</AlertTitle>
                  <AlertDescription>
                    <ul className="ml-4 flex list-disc flex-col gap-1">
                      {promoFormErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>Основное</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <PromoSelectField
                      label="Статус *"
                      value={promoForm.status}
                      options={PROMO_STATUS_OPTIONS}
                      onChange={(value) => setPromoField("status", value as PromoStatus)}
                    />

                    <FieldBlock label="Код промокода *" error={promoFieldErrors.code}>
                      <Input
                        value={promoForm.code}
                        onChange={(event) => setPromoField("code", event.target.value)}
                        placeholder="SPRINGPHONE"
                      />
                    </FieldBlock>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Связь со скидкой</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <FieldBlock label="Связанная скидка" error={promoFieldErrors.discount_id}>
                    <Select value={promoForm.discount_id || "none"} onValueChange={(value) => setPromoField("discount_id", value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите скидку" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="none">Не выбрана</SelectItem>
                          {discounts.map((discount) => (
                            <SelectItem key={discount.id} value={discount.id}>
                              {discount.name} ({DISCOUNT_STATUS_LABELS[discount.status]})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FieldBlock>

                  {selectedPromoDiscount ? (
                    <Alert>
                      <AlertTitle>Выбрана скидка: {selectedPromoDiscount.name}</AlertTitle>
                      <AlertDescription>
                        <p>
                          Статус скидки: {DISCOUNT_STATUS_LABELS[selectedPromoDiscount.status]}, период:{" "}
                          {formatDate(selectedPromoDiscount.start_date)} - {formatDate(selectedPromoDiscount.end_date)}
                        </p>
                        {selectedPromoDiscount.promotion_ids.length > 0 ? (
                          <p>
                            Условие по акциям: товар должен входить в выбранные акции (
                            {formatPromotionList(selectedPromoDiscount.promotion_ids)}).
                          </p>
                        ) : null}
                        <p>
                          При одновременных ограничениях скидки (акции + категории/товары/слова) в checkout применяется
                          пересечение условий.
                        </p>
                        {selectedPromoDiscount.status !== "active" ? (
                          <p>Если скидка неактивна или вне периода, промокод не применяется в checkout.</p>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <Button variant="outline" onClick={startCreateDiscount}>
                    Создать новую скидку
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Период действия</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <FieldBlock label="Дата начала *" error={promoFieldErrors.start_date}>
                      <Input
                        type="date"
                        value={promoForm.start_date}
                        onChange={(event) => setPromoField("start_date", event.target.value)}
                      />
                    </FieldBlock>

                    <FieldBlock label="Дата окончания *" error={promoFieldErrors.end_date}>
                      <Input
                        type="date"
                        value={promoForm.end_date}
                        onChange={(event) => setPromoField("end_date", event.target.value)}
                      />
                    </FieldBlock>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Лимиты и ограничения использования</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    <PromoSelectField
                      label="Режим использования *"
                      value={promoForm.usage_mode}
                      options={PROMO_USAGE_MODE_OPTIONS}
                      onChange={(value) => setPromoField("usage_mode", value as PromoUsageMode)}
                    />

                    <FieldBlock label="Общий лимит применений (counter)" error={promoFieldErrors.counter}>
                      <Input
                        type="number"
                        min="1"
                        disabled={promoForm.usage_mode === "one_time"}
                        value={promoForm.counter}
                        onChange={(event) => setPromoField("counter", event.target.value)}
                        placeholder="Пусто = безлимит"
                      />
                    </FieldBlock>

                    <FieldBlock label="Лимит на пользователя (per_user_limit)" error={promoFieldErrors.per_user_limit}>
                      <Input
                        type="number"
                        min="1"
                        disabled={promoForm.usage_mode === "one_time"}
                        value={promoForm.per_user_limit}
                        onChange={(event) => setPromoField("per_user_limit", event.target.value)}
                        placeholder="Пусто = безлимит"
                      />
                    </FieldBlock>

                    <Field>
                      <FieldLabel>Ограничение first_order_only</FieldLabel>
                      <Field orientation="horizontal" className="w-auto">
                        <Checkbox
                          id="promo-first-order-only"
                          checked={promoForm.first_order_only}
                          onCheckedChange={(checked) => setPromoField("first_order_only", checked === true)}
                        />
                        <FieldLabel htmlFor="promo-first-order-only">Только для первого заказа</FieldLabel>
                      </Field>
                    </Field>
                  </div>

                  {promoForm.usage_mode === "one_time" ? (
                    <Alert>
                      <AlertTitle>Режим one_time</AlertTitle>
                      <AlertDescription>Промокод может быть использован только 1 раз в системе.</AlertDescription>
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="sticky bottom-2">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => resetPromoForm(promoForm.discount_id || undefined)}>
                      Очистить форму
                    </Button>
                    <Button onClick={savePromo}>{editingPromoId ? "Сохранить изменения" : "Сохранить промокод"}</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPromoViewMode("list")
                        setEditingPromoId(null)
                        resetPromoForm()
                      }}
                    >
                      К списку
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
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
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Выберите вариант" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <span className="truncate text-left">{selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder}</span>
          <Badge variant="secondary" className="ml-2 rounded-full">
            {value.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Поиск..." />
          <div className="flex flex-wrap gap-2 border-b p-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(options.map((option) => option.value))}>
              Выбрать все
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
              Очистить
            </Button>
          </div>

          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <ScrollArea className="h-40">
              <CommandGroup>
                {options.map((option) => {
                  const checked = value.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => toggleOption(option.value, !checked)}
                    >
                      <Checkbox checked={checked} aria-hidden="true" />
                      <span>{option.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </ScrollArea>
          </CommandList>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="m-2 w-[calc(100%-1rem)]"
            onClick={() => setOpen(false)}
          >
            Готово
          </Button>
        </Command>
      </PopoverContent>
    </Popover>
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

      const selfMatches = normalizedQuery.length === 0 || `${current.id} ${current.name}`.toLowerCase().includes(normalizedQuery)

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
    const checkboxId = `${title}-${item.id}`.replace(/[^a-zA-Z0-9_-]/g, "-")

    return (
      <div key={item.id} className="flex flex-col gap-2 rounded-md border p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 16}px` }}>
            {hasChildren ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleExpanded(item.id)}
                aria-label={expanded ? "Свернуть подкатегории" : "Развернуть подкатегории"}
              >
                {expanded ? "▾" : "▸"}
              </Button>
            ) : (
              <span className="inline-block h-6 w-6" />
            )}

            <Field orientation="horizontal" className="w-auto">
              <Checkbox id={checkboxId} checked={checked} onCheckedChange={(value) => onToggle(item.id, value === true)} />
              <FieldLabel htmlFor={checkboxId}>
                {item.name} <span className="text-xs text-muted-foreground">({item.id})</span>
              </FieldLabel>
            </Field>
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
                <SelectGroup>
                  {CATEGORY_SCOPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {hasChildren && expanded ? <div className="flex flex-col gap-2">{visibleChildren.map((child) => renderNode(child, depth + 1))}</div> : null}
      </div>
    )
  }

  return (
    <Card className="border-dashed bg-muted">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <FieldBlock label="Поиск по ID или названию">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="cat-electronics или Смартфоны" />
        </FieldBlock>

        <ScrollArea className="h-72 rounded-md border bg-background p-2">
          <div className="flex flex-col gap-2">
            {visibleRoots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Категории по запросу не найдены</p>
            ) : (
              visibleRoots.map((root) => renderNode(root, 0))
            )}
          </div>
        </ScrollArea>

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
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2 rounded-md border bg-muted p-2">
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
        <FieldDescription>Разделители: запятая или перенос строки.</FieldDescription>
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
    <Field data-invalid={Boolean(error)}>
      <FieldLabel>{label}</FieldLabel>
      {children}
      <FieldError>{error}</FieldError>
    </Field>
  )
}
