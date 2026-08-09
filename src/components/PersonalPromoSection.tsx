import { type ReactNode, useEffect, useMemo, useState } from "react"

import { DISCOUNT_STATUS_LABELS, MOCK_DISCOUNTS } from "@/admin/promoRegistry"
import {
  formatPersonalExpiry,
  MOCK_PERSONAL_CODES,
  MOCK_PERSONAL_TEMPLATES,
  PERSONAL_CODE_STATUS_LABELS,
  PERSONAL_CODE_STATUS_OPTIONS,
  PERSONAL_ISSUE_LIMIT_SCOPE_OPTIONS,
  PERSONAL_TEMPLATE_STATUS_LABELS,
  PERSONAL_TEMPLATE_STATUS_OPTIONS,
  personalRedemptionRate,
  type PersonalCodeInstance,
  type PersonalCodeStatus,
  type PersonalIssueLimitScope,
  type PersonalTemplate,
  type PersonalTemplateStatus,
} from "@/admin/personalPromo"
import { formatDate, formatDateTime, parseDate } from "@/admin/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface PersonalPromoSectionProps {
  globalSearch: string
  createSignal: number
  onCreateDiscount: () => void
}

type PersonalTab = "templates" | "issued"
type ViewMode = "list" | "form"

interface TemplateFilters {
  search: string
  status: "all" | PersonalTemplateStatus
}

interface IssuedFilters {
  search: string
  status: "all" | PersonalCodeStatus
  templateId: "all" | string
}

interface TemplateForm {
  status: PersonalTemplateStatus
  name: string
  key: string
  discount_id: string
  ttl_days: string
  code_prefix: string
  per_user_issue_limit: string
  issue_limit_scope: PersonalIssueLimitScope
  issue_cap: string
}

interface SectionFlash {
  type: "success" | "error" | "info"
  text: string
}

const TEMPLATE_STATUS_VARIANT: Record<PersonalTemplateStatus, "default" | "secondary" | "outline"> = {
  draft: "outline",
  active: "default",
  inactive: "secondary",
}

const CODE_STATUS_VARIANT: Record<PersonalCodeStatus, "default" | "secondary" | "outline"> = {
  issued: "default",
  reserved: "outline",
  redeemed: "secondary",
  expired: "outline",
}

function createTemplateForm(): TemplateForm {
  return {
    status: "draft",
    name: "",
    key: "",
    discount_id: "",
    ttl_days: "7",
    code_prefix: "GIFT",
    per_user_issue_limit: "1",
    issue_limit_scope: "all_time",
    issue_cap: "",
  }
}

function templateToForm(template: PersonalTemplate): TemplateForm {
  return {
    status: template.status,
    name: template.name,
    key: template.key,
    discount_id: template.discount_id ?? "",
    ttl_days: String(template.ttl_days),
    code_prefix: template.code_prefix,
    per_user_issue_limit: String(template.per_user_issue_limit),
    issue_limit_scope: template.issue_limit_scope,
    issue_cap: template.issue_cap === null ? "" : String(template.issue_cap),
  }
}

export function PersonalPromoSection(props: PersonalPromoSectionProps) {
  const { globalSearch, createSignal, onCreateDiscount } = props

  const [templates, setTemplates] = useState<PersonalTemplate[]>(MOCK_PERSONAL_TEMPLATES)
  const [instances] = useState<PersonalCodeInstance[]>(MOCK_PERSONAL_CODES)

  const [tab, setTab] = useState<PersonalTab>("templates")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState<TemplateForm>(createTemplateForm)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [flash, setFlash] = useState<SectionFlash | null>(null)

  const [templateFilters, setTemplateFilters] = useState<TemplateFilters>({ search: "", status: "all" })
  const [issuedFilters, setIssuedFilters] = useState<IssuedFilters>({ search: "", status: "all", templateId: "all" })

  useEffect(() => {
    if (createSignal === 0) {
      return
    }

    startCreate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSignal])

  useEffect(() => {
    if (!flash) {
      return
    }

    const timeout = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(timeout)
  }, [flash])

  const discountById = useMemo(() => new Map(MOCK_DISCOUNTS.map((item) => [item.id, item])), [])
  const templateById = useMemo(() => new Map(templates.map((item) => [item.id, item])), [templates])

  const query = globalSearch.trim().toLowerCase()

  const filteredTemplates = useMemo(() => {
    const rows = templates.filter((item) => {
      const haystack = `${item.name} ${item.key}`.toLowerCase()

      if (query && !haystack.includes(query)) {
        return false
      }

      if (templateFilters.search && !haystack.includes(templateFilters.search.toLowerCase())) {
        return false
      }

      if (templateFilters.status !== "all" && item.status !== templateFilters.status) {
        return false
      }

      return true
    })

    rows.sort((a, b) => (parseDate(b.created_at)?.getTime() ?? 0) - (parseDate(a.created_at)?.getTime() ?? 0))
    return rows
  }, [query, templateFilters, templates])

  const filteredInstances = useMemo(() => {
    const rows = instances.filter((item) => {
      const haystack = `${item.code} ${item.user_id} ${item.phone}`.toLowerCase()

      if (query && !haystack.includes(query)) {
        return false
      }

      if (issuedFilters.search && !haystack.includes(issuedFilters.search.toLowerCase())) {
        return false
      }

      if (issuedFilters.status !== "all" && item.status !== issuedFilters.status) {
        return false
      }

      if (issuedFilters.templateId !== "all" && item.template_id !== issuedFilters.templateId) {
        return false
      }

      return true
    })

    rows.sort((a, b) => (parseDate(b.issued_at)?.getTime() ?? 0) - (parseDate(a.issued_at)?.getTime() ?? 0))
    return rows
  }, [instances, issuedFilters, query])

  const selectedDiscount = form.discount_id ? discountById.get(form.discount_id) : null

  function setField<K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(createTemplateForm())
    setFormErrors([])
    setFieldErrors({})
  }

  function startCreate() {
    setTab("templates")
    setEditingId(null)
    setViewMode("form")
    resetForm()
  }

  function startEdit(template: PersonalTemplate) {
    setEditingId(template.id)
    setViewMode("form")
    setForm(templateToForm(template))
    setFormErrors([])
    setFieldErrors({})
  }

  function validate(): { errors: string[]; fieldMap: Record<string, string> } {
    const errors: string[] = []
    const fieldMap: Record<string, string> = {}

    const addError = (field: string, message: string) => {
      fieldMap[field] = message
      errors.push(message)
    }

    if (!form.name.trim()) {
      addError("name", "Название обязательно")
    }

    const key = form.key.trim()
    if (!key) {
      addError("key", "Ключ (key) обязателен")
    } else if (!/^[a-z0-9_]+$/.test(key)) {
      addError("key", "Ключ: только строчные латинские буквы, цифры и _")
    } else if (templates.some((item) => item.key === key && item.id !== editingId)) {
      addError("key", "Такой ключ уже существует")
    }

    if (!/^[A-Z0-9]+$/.test(form.code_prefix.trim())) {
      addError("code_prefix", "Префикс: заглавные латинские буквы и цифры")
    }

    if (form.status !== "draft" && !form.discount_id) {
      addError("discount_id", "Для статуса «Активен/Неактивен» нужна связанная скидка")
    }

    const ttl = Number(form.ttl_days)
    if (!Number.isInteger(ttl) || ttl <= 0) {
      addError("ttl_days", "Срок (дней) должен быть целым числом больше 0")
    }

    const perUser = Number(form.per_user_issue_limit)
    if (!Number.isInteger(perUser) || perUser < 1) {
      addError("per_user_issue_limit", "Лимит на пользователя должен быть целым числом ≥ 1")
    }

    if (form.issue_cap !== "") {
      const cap = Number(form.issue_cap)
      if (!Number.isInteger(cap) || cap <= 0) {
        addError("issue_cap", "Бюджет выдач должен быть пустым или целым числом больше 0")
      }
    }

    return { errors, fieldMap }
  }

  function save() {
    const validation = validate()
    setFormErrors(validation.errors)
    setFieldErrors(validation.fieldMap)

    if (validation.errors.length > 0) {
      setFlash({ type: "error", text: "Форма шаблона содержит ошибки" })
      return
    }

    const payload = {
      status: form.status,
      name: form.name.trim(),
      key: form.key.trim(),
      discount_id: form.discount_id ? form.discount_id : null,
      ttl_days: Number(form.ttl_days),
      code_prefix: form.code_prefix.trim(),
      per_user_issue_limit: Number(form.per_user_issue_limit),
      issue_limit_scope: form.issue_limit_scope,
      issue_cap: form.issue_cap === "" ? null : Number(form.issue_cap),
    }

    if (editingId) {
      setTemplates((prev) => prev.map((item) => (item.id === editingId ? { ...item, ...payload } : item)))
      setFlash({ type: "success", text: `Шаблон «${payload.name}» обновлён` })
    } else {
      const newTemplate: PersonalTemplate = {
        id: `tpl_${Math.random().toString(36).slice(2, 8)}`,
        issued_count: 0,
        redeemed_count: 0,
        created_at: new Date().toISOString(),
        ...payload,
      }
      setTemplates((prev) => [newTemplate, ...prev])
      setFlash({ type: "success", text: `Шаблон «${newTemplate.name}» создан` })
    }

    setViewMode("list")
    setEditingId(null)
    resetForm()
  }

  return (
    <div className="flex flex-col gap-4">
      {flash ? (
        <Alert variant={flash.type === "error" ? "destructive" : "default"}>
          <AlertTitle>{flash.type === "error" ? "Ошибка" : "Готово"}</AlertTitle>
          <AlertDescription>{flash.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Индивидуальные промокоды</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Раздел `Маркетинг → Промокоды → Индивидуальные`: шаблоны выдачи и выданные пользователям коды.
          </p>
        </div>

        {viewMode === "list" && tab === "templates" ? <Button onClick={startCreate}>Создать шаблон</Button> : null}
      </div>

      {viewMode === "list" ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant={tab === "templates" ? "default" : "secondary"} onClick={() => setTab("templates")}>
              Шаблоны
            </Button>
            <Button variant={tab === "issued" ? "default" : "secondary"} onClick={() => setTab("issued")}>
              Выданные коды
            </Button>
          </div>

          {tab === "templates" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Фильтры</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FieldBlock label="Поиск (название / key)">
                      <Input
                        value={templateFilters.search}
                        onChange={(event) => setTemplateFilters((prev) => ({ ...prev, search: event.target.value }))}
                        placeholder="gift_7d"
                      />
                    </FieldBlock>

                    <SelectField
                      label="Статус"
                      value={templateFilters.status}
                      options={[{ value: "all", label: "Все" }, ...PERSONAL_TEMPLATE_STATUS_OPTIONS]}
                      onChange={(value) =>
                        setTemplateFilters((prev) => ({ ...prev, status: value as TemplateFilters["status"] }))
                      }
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" onClick={() => setTemplateFilters({ search: "", status: "all" })}>
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
                          <TableHead>Название / key</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Скидка</TableHead>
                          <TableHead>Срок</TableHead>
                          <TableHead>На пользователя</TableHead>
                          <TableHead>Бюджет / выдано</TableHead>
                          <TableHead>Выдано / погашено</TableHead>
                          <TableHead>Redemption</TableHead>
                          <TableHead>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTemplates.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9}>
                              <p className="py-6 text-center text-sm text-muted-foreground">Шаблоны не найдены.</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredTemplates.map((item) => {
                            const discount = item.discount_id ? discountById.get(item.discount_id) : null

                            return (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <p className="font-semibold">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">{item.key}</p>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={TEMPLATE_STATUS_VARIANT[item.status]}>
                                    {PERSONAL_TEMPLATE_STATUS_LABELS[item.status]}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {discount ? (
                                    <div className="flex flex-col gap-1">
                                      <span className="text-sm">{discount.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {DISCOUNT_STATUS_LABELS[discount.status]}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Не выбрана</span>
                                  )}
                                </TableCell>
                                <TableCell>{formatPersonalExpiry(item)}</TableCell>
                                <TableCell>{item.per_user_issue_limit}</TableCell>
                                <TableCell>
                                  {item.issue_cap === null ? "∞" : item.issue_cap} / {item.issued_count}
                                </TableCell>
                                <TableCell>
                                  {item.issued_count} / {item.redeemed_count}
                                </TableCell>
                                <TableCell>{personalRedemptionRate(item)}</TableCell>
                                <TableCell>
                                  <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
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
              <Card>
                <CardHeader>
                  <CardTitle>Фильтры</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <FieldBlock label="Поиск (код / user_id / телефон)">
                      <Input
                        value={issuedFilters.search}
                        onChange={(event) => setIssuedFilters((prev) => ({ ...prev, search: event.target.value }))}
                        placeholder="GIFT-9F2KQ7"
                      />
                    </FieldBlock>

                    <SelectField
                      label="Статус"
                      value={issuedFilters.status}
                      options={[{ value: "all", label: "Все" }, ...PERSONAL_CODE_STATUS_OPTIONS]}
                      onChange={(value) =>
                        setIssuedFilters((prev) => ({ ...prev, status: value as IssuedFilters["status"] }))
                      }
                    />

                    <SelectField
                      label="Шаблон"
                      value={issuedFilters.templateId}
                      options={[
                        { value: "all", label: "Все" },
                        ...templates.map((item) => ({ value: item.id, label: item.key })),
                      ]}
                      onChange={(value) => setIssuedFilters((prev) => ({ ...prev, templateId: value }))}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIssuedFilters({ search: "", status: "all", templateId: "all" })}
                  >
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
                          <TableHead>Пользователь</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Выдан</TableHead>
                          <TableHead>Действует до</TableHead>
                          <TableHead>Шаблон</TableHead>
                          <TableHead>Заказ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInstances.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <p className="py-6 text-center text-sm text-muted-foreground">Выданные коды не найдены.</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredInstances.map((item) => {
                            const template = templateById.get(item.template_id)

                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-semibold">{item.code}</TableCell>
                                <TableCell>
                                  <p className="text-sm">{item.user_id}</p>
                                  <p className="text-xs text-muted-foreground">{item.phone}</p>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={CODE_STATUS_VARIANT[item.status]}>
                                    {PERSONAL_CODE_STATUS_LABELS[item.status]}
                                  </Badge>
                                </TableCell>
                                <TableCell>{formatDateTime(item.issued_at)}</TableCell>
                                <TableCell>{formatDateTime(item.expires_at)}</TableCell>
                                <TableCell>{template?.key ?? item.template_id}</TableCell>
                                <TableCell>{item.order_id ?? "—"}</TableCell>
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
          )}
        </>
      ) : (
        <>
          <div>
            <h2 className="text-2xl font-semibold">{editingId ? "Редактировать шаблон" : "Создать шаблон"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Шаблон задаёт условия, из которых фичи (кнопка «Вам подарок», задания, колесо) генерируют индивидуальные
              коды. Единого поля «код» нет — коды генерируются по префиксу.
            </p>
          </div>

          {formErrors.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Проверьте поля формы</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 flex list-disc flex-col gap-1">
                  {formErrors.map((error) => (
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
                <SelectField
                  label="Статус *"
                  value={form.status}
                  options={PERSONAL_TEMPLATE_STATUS_OPTIONS}
                  onChange={(value) => setField("status", value as PersonalTemplateStatus)}
                />

                <FieldBlock label="Название *" error={fieldErrors.name}>
                  <Input
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    placeholder="Подарок за 7 дней"
                  />
                </FieldBlock>

                <FieldBlock label="Ключ (key) *" error={fieldErrors.key} hint="По нему фичи вызывают выдачу. Пример: gift_7d">
                  <Input
                    value={form.key}
                    onChange={(event) => setField("key", event.target.value)}
                    placeholder="gift_7d"
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
              <FieldBlock label="Связанная скидка" error={fieldErrors.discount_id}>
                <Select
                  value={form.discount_id || "none"}
                  onValueChange={(value) => setField("discount_id", value === "none" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите скидку" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">Не выбрана</SelectItem>
                      {MOCK_DISCOUNTS.map((discount) => (
                        <SelectItem key={discount.id} value={discount.id}>
                          {discount.name} ({DISCOUNT_STATUS_LABELS[discount.status]})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldBlock>

              {selectedDiscount ? (
                <Alert>
                  <AlertTitle>Скидка: {selectedDiscount.name}</AlertTitle>
                  <AlertDescription>
                    Расчёт и ассортиментные условия берутся из скидки. Статус: {DISCOUNT_STATUS_LABELS[selectedDiscount.status]},
                    период: {formatDate(selectedDiscount.start_date)} - {formatDate(selectedDiscount.end_date)}.
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button variant="outline" onClick={onCreateDiscount}>
                Создать новую скидку
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Срок действия</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <FieldBlock
                  label="Срок, дней от выдачи *"
                  error={fieldErrors.ttl_days}
                  hint="Срок всегда относительный — от момента клика"
                >
                  <Input
                    type="number"
                    min="1"
                    value={form.ttl_days}
                    onChange={(event) => setField("ttl_days", event.target.value)}
                  />
                </FieldBlock>
              </div>

              <Alert>
                <AlertTitle>Срок ставит бэкенд при выдаче</AlertTitle>
                <AlertDescription>
                  Бэкенд по серверному времени вычисляет и сохраняет абсолютный{" "}
                  <span className="font-semibold">expires_at = момент выдачи + срок</span> (напр. 7 дн. = ровно 7×24 ч).
                  Он неизменяем: правка срока в шаблоне не влияет на уже выданные коды.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Формат кода и лимиты</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                <FieldBlock label="Префикс кода *" error={fieldErrors.code_prefix} hint="Заглавные буквы/цифры">
                  <Input
                    value={form.code_prefix}
                    onChange={(event) => setField("code_prefix", event.target.value.toUpperCase())}
                    placeholder="GIFT"
                  />
                </FieldBlock>

                <FieldBlock label="Лимит на пользователя *" error={fieldErrors.per_user_issue_limit}>
                  <Input
                    type="number"
                    min="1"
                    value={form.per_user_issue_limit}
                    onChange={(event) => setField("per_user_issue_limit", event.target.value)}
                  />
                </FieldBlock>

                <SelectField
                  label="Подсчёт лимита *"
                  value={form.issue_limit_scope}
                  options={PERSONAL_ISSUE_LIMIT_SCOPE_OPTIONS}
                  onChange={(value) => setField("issue_limit_scope", value as PersonalIssueLimitScope)}
                />

                <FieldBlock label="Бюджет выдач (issue_cap)" error={fieldErrors.issue_cap}>
                  <Input
                    type="number"
                    min="1"
                    value={form.issue_cap}
                    onChange={(event) => setField("issue_cap", event.target.value)}
                    placeholder="Пусто = без лимита"
                  />
                </FieldBlock>
              </div>

              <FieldBlock label="Пример кода">
                <Input value={`${form.code_prefix || "CODE"}-XXXXXX`} readOnly />
              </FieldBlock>

              <Alert>
                <AlertDescription>
                  Подсчёт лимита: <span className="font-semibold">«только активные»</span> — истёкший/погашенный код
                  освобождает слот (нужно для корзины и winback); <span className="font-semibold">«за всё время»</span> —
                  один код навсегда, повторной выдачи после истечения нет (для разовых подарков). Код всегда one-time —
                  гасится один раз.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="sticky bottom-2">
            <CardContent className="pt-6">
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Очистить форму
                </Button>
                <Button onClick={save}>{editingId ? "Сохранить изменения" : "Сохранить шаблон"}</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewMode("list")
                    setEditingId(null)
                    resetForm()
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
  )
}

interface SelectFieldProps {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

function SelectField(props: SelectFieldProps) {
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

interface FieldBlockProps {
  label: string
  children: ReactNode
  error?: string
  hint?: string
}

function FieldBlock(props: FieldBlockProps) {
  const { label, children, error, hint } = props

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError>{error}</FieldError>
    </Field>
  )
}
