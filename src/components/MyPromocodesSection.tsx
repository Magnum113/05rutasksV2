import { useEffect, useMemo, useState } from "react"
import { Check, ChevronRight, Copy, ExternalLink, Gift, Info, Store, Ticket } from "lucide-react"

import {
  type DiscountEntity,
  type PromoCodeEntity,
  PROMO_CATEGORY_OPTIONS,
  PROMO_PRODUCT_OPTIONS,
  PROMO_PROMOTION_OPTIONS,
  PROMO_SELLER_OPTIONS,
  formatRub,
} from "@/admin/promoRegistry"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface MyPromocodesSectionProps {
  discounts: DiscountEntity[]
  promos: PromoCodeEntity[]
  globalSearch: string
}

type PromoState = "issued" | "reserved"
type PromoKind = "common" | "personal" | "external"

interface ClientPromo {
  id: string
  code: string
  title: string
  description: string
  kind: PromoKind
  status: PromoState
  expiresAt: string | null
  discount?: DiscountEntity
  commonCode?: PromoCodeEntity
  external?: ExternalOffer
}

interface ExternalOffer {
  active: boolean
  name: string
  description: string
  terms: string
  code: string
  serviceName: string
  serviceUrl: string
  startDate: string
  endDate: string
  audience: "all" | "segment"
  phones: string
}

const DEMO_USER_PHONE = "79000000001"

function dateAfter(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function dateLabel(value: string | null): string {
  if (!value) return "Срок не указан"
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date)
}

function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "")
  if (digits.length === 10) digits = `7${digits}`
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`
  return digits.length === 11 && digits.startsWith("7") ? digits : null
}

function getSegmentPhones(raw: string): string[] {
  return Array.from(new Set(raw.split(/[\s,;]+/).map(normalizePhone).filter((phone): phone is string => Boolean(phone))))
}

function createExternalOffer(): ExternalOffer {
  return {
    active: true,
    name: "Скидка на продукты в Близко",
    description: "Промокод для заказа продуктов в сервисе Близко.",
    terms: "Промокод NUT10 действует только в сервисе Близко. Подробные правила применения проверяются в самом сервисе.",
    code: "NUT10",
    serviceName: "Близко",
    serviceUrl: "https://blizko.05.ru/",
    startDate: dateAfter(-3),
    endDate: dateAfter(30),
    audience: "all",
    phones: DEMO_USER_PHONE,
  }
}

function sellerName(id: string): string {
  return PROMO_SELLER_OPTIONS.find((item) => item.id === id)?.name ?? id
}

function SellerMarks({ discount, compact = false }: { discount: DiscountEntity; compact?: boolean }) {
  if (discount.seller_ids.length === 0) return <span className="text-xs text-muted-foreground">У всех продавцов</span>
  return (
    <div className={compact ? "flex min-w-0 items-center gap-2" : "flex flex-wrap items-center gap-2"} aria-label={`Продавцы: ${discount.seller_ids.map(sellerName).join(", ")}`}>
      <div className={compact ? "flex -space-x-2" : "flex flex-wrap gap-2"}>
      {discount.seller_ids.map((id) => {
        const seller = PROMO_SELLER_OPTIONS.find((item) => item.id === id)
        return (
          <span key={id} title={seller?.name ?? id} className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-100 text-slate-600 ring-1 ring-slate-200">
            {seller?.logo_url ? <img src={seller.logo_url} alt="" className="h-full w-full rounded-full object-cover" /> : <Store className="h-3.5 w-3.5" />}
          </span>
        )
      })}
      </div>
      <span className={compact ? "truncate text-xs text-muted-foreground" : "text-sm text-foreground"}>{discount.seller_ids.map(sellerName).join(", ")}</span>
    </div>
  )
}

function isMarketCodeAvailable(promo: PromoCodeEntity, discount: DiscountEntity, today: string): boolean {
  return promo.status === "active" && discount.status === "active"
    && promo.start_date <= today && promo.end_date >= today
    && discount.start_date <= today && discount.end_date >= today
    && (promo.counter === null || promo.current_counter < promo.counter)
}

function discountValue(discount: DiscountEntity | undefined): string | null {
  if (!discount) return null
  return discount.discount_type === "percent" ? `−${discount.discount_value} %` : `−${formatRub(discount.discount_value)}`
}

function scopeLabel(discount: DiscountEntity): string {
  if (discount.include_category_ids.length > 0) {
    const names = discount.include_category_ids.map((id) => PROMO_CATEGORY_OPTIONS.find((option) => option.id === id)?.name ?? id)
    return names.length <= 2 ? `На товары: ${names.join(", ")}` : `На ${names.length} категорий`
  }
  if (discount.include_product_ids.length > 0 || discount.promotion_ids.length > 0 || discount.include_title_keywords.length > 0) return "На выбранные товары"
  return "На подходящие товары заказа"
}

function marketConditions(promo: ClientPromo): string[] {
  const discount = promo.discount
  if (!discount) return []
  const lines: string[] = []
  lines.push(scopeLabel(discount))
  if (discount.include_product_ids.length > 0) lines.push(`Товары: ${discount.include_product_ids.map((id) => PROMO_PRODUCT_OPTIONS.find((option) => option.id === id)?.name ?? id).join(", ")}`)
  if (discount.promotion_ids.length > 0) lines.push(`Товары акций: ${discount.promotion_ids.map((id) => PROMO_PROMOTION_OPTIONS.find((option) => option.id === id)?.name ?? id).join(", ")}`)
  if (discount.include_title_keywords.length > 0) lines.push(`Слова в названии: ${discount.include_title_keywords.join(", ")}`)
  if (discount.exclude_category_ids.length > 0) lines.push(`Не действует на категории: ${discount.exclude_category_ids.map((id) => PROMO_CATEGORY_OPTIONS.find((option) => option.id === id)?.name ?? id).join(", ")}`)
  if (discount.exclude_product_ids.length > 0) lines.push(`Не действует на товары: ${discount.exclude_product_ids.map((id) => PROMO_PRODUCT_OPTIONS.find((option) => option.id === id)?.name ?? id).join(", ")}`)
  if (discount.exclude_title_keywords.length > 0) lines.push(`Не действует на товары со словами: ${discount.exclude_title_keywords.join(", ")}`)
  if (discount.seller_ids.length > 0) lines.push(`Продавцы: ${discount.seller_ids.map(sellerName).join(", ")}`)
  else lines.push("Без ограничения по продавцу")
  if (discount.min_order_amount !== null) lines.push(`При заказе от ${formatRub(discount.min_order_amount)}`)
  if (promo.commonCode?.first_order_only) lines.push("Только для первого заказа")
  if (discount.channels.length === 1) lines.push(discount.channels[0] === "app" ? "Только в приложении" : "Только на сайте")
  if (promo.commonCode?.per_user_limit) lines.push(`Не более ${promo.commonCode.per_user_limit} ${promo.commonCode.per_user_limit === 1 ? "применения" : "применений"} на пользователя`)
  if (discount.max_discount !== null) lines.push(`Скидка не больше ${formatRub(discount.max_discount)}`)
  return lines
}

export function MyPromocodesSection({ discounts, promos, globalSearch }: MyPromocodesSectionProps) {
  const [view, setView] = useState<"client" | "externalSettings">("client")
  const [demoState, setDemoState] = useState<"ready" | "empty" | "loading" | "error">("ready")
  const [authorized, setAuthorized] = useState(true)
  const [savedCommonIds, setSavedCommonIds] = useState<string[]>(["promo_001"])
  const [codeToSave, setCodeToSave] = useState("")
  const [offerDraft, setOfferDraft] = useState<ExternalOffer>(createExternalOffer)
  const [externalOffer, setExternalOffer] = useState<ExternalOffer>(createExternalOffer)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showLegal, setShowLegal] = useState(false)
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(""), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const discountById = useMemo(() => new Map(discounts.map((discount) => [discount.id, discount])), [discounts])
  const segmentPhones = useMemo(() => getSegmentPhones(externalOffer.phones), [externalOffer.phones])
  const offerInPeriod = externalOffer.startDate <= dateAfter(0) && externalOffer.endDate >= dateAfter(0)
  const offerVisible = authorized && externalOffer.active && offerInPeriod && (externalOffer.audience === "all" || segmentPhones.includes(DEMO_USER_PHONE))

  const entries = useMemo<ClientPromo[]>(() => {
    const today = dateAfter(0)
    const common: ClientPromo[] = savedCommonIds.flatMap((id) => {
      const promo = promos.find((item) => item.id === id)
      const discount = promo?.discount_id ? discountById.get(promo.discount_id) : undefined
      if (!promo || !discount || !isMarketCodeAvailable(promo, discount, today)) return []
      return [{ id: `common:${promo.id}`, code: promo.code, title: discount.name, description: discount.description, kind: "common", status: "issued", expiresAt: promo.end_date, discount, commonCode: promo }]
    })

    const personalSeeds: Array<{ id: string; code: string; discountId: string; status: PromoState; days: number }> = [
      { id: "personal:gift", code: "GIFT-9F2KQ7", discountId: "discount_1022", status: "issued", days: 3 },
      { id: "personal:cart", code: "CART-91QW44", discountId: "discount_1007", status: "reserved", days: 2 },
    ]
    const personal: ClientPromo[] = personalSeeds.flatMap((seed) => {
      const discount = discountById.get(seed.discountId)
      if (!discount || discount.status !== "active" || discount.start_date > today || discount.end_date < today || seed.days < 0) return []
      return [{ id: seed.id, code: seed.code, title: discount.name, description: discount.description, kind: "personal", status: seed.status, expiresAt: dateAfter(seed.days), discount }]
    })

    const external: ClientPromo[] = offerVisible
      ? [{ id: "external:blizko", code: externalOffer.code, title: externalOffer.name, description: externalOffer.description, kind: "external", status: "issued", expiresAt: externalOffer.endDate, external: externalOffer }]
      : []

    return [...common, ...personal, ...external]
  }, [savedCommonIds, promos, discountById, offerVisible, externalOffer])

  const selected = entries.find((entry) => entry.id === selectedId) ?? null
  const filteredEntries = entries.filter((entry) => {
    const query = globalSearch.trim().toLowerCase()
    return !query || `${entry.title} ${entry.description} ${entry.code} ${entry.external?.serviceName ?? ""}`.toLowerCase().includes(query)
  }).sort((a, b) => (a.expiresAt ?? "9999").localeCompare(b.expiresAt ?? "9999"))

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code")
    if (!code) return
    const promo = promos.find((item) => item.code.toLowerCase() === code.toLowerCase())
    const discount = promo?.discount_id ? discountById.get(promo.discount_id) : undefined
    if (promo && discount && isMarketCodeAvailable(promo, discount, dateAfter(0))) {
      setSavedCommonIds((previous) => previous.includes(promo.id) ? previous : [...previous, promo.id])
      setSelectedId(`common:${promo.id}`)
      return
    }
    if (code.toLowerCase() === externalOffer.code.toLowerCase() && offerVisible) setSelectedId("external:blizko")
  }, [promos, discountById, externalOffer.code, offerVisible])

  function saveCommonCode(rawCode: string) {
    if (!authorized) { setNotice("Войдите в аккаунт, чтобы сохранить промокод."); return }
    const promo = promos.find((item) => item.code.toLowerCase() === rawCode.trim().toLowerCase())
    if (!promo || promo.status !== "active" || !promo.discount_id) { setNotice("Действующий общий промокод Маркета не найден."); return }
    const discount = discountById.get(promo.discount_id)
    if (!discount || !isMarketCodeAvailable(promo, discount, dateAfter(0))) { setNotice("Этот промокод сейчас недоступен."); return }
    setSavedCommonIds((previous) => previous.includes(promo.id) ? previous : [...previous, promo.id])
    setSelectedId(`common:${promo.id}`)
    setCodeToSave("")
    setNotice("Промокод сохранён в вашем разделе.")
  }

  async function copyText(text: string, success: string) {
    try {
      await navigator.clipboard.writeText(text)
      setNotice(success)
    } catch {
      setNotice("Не удалось скопировать. Выделите и скопируйте код вручную.")
    }
  }

  function saveExternalOffer() {
    if (!offerDraft.name.trim() || !offerDraft.code.trim() || !offerDraft.description.trim() || !offerDraft.terms.trim() || !offerDraft.serviceName.trim()) {
      setNotice("Заполните название, код, описание, условия и название сервиса.")
      return
    }
    if (!offerDraft.startDate || !offerDraft.endDate || offerDraft.startDate > offerDraft.endDate) {
      setNotice("Проверьте период показа предложения.")
      return
    }
    if (offerDraft.active && !offerDraft.serviceUrl.trim()) {
      setNotice("Для активного предложения укажите ссылку на сервис.")
      return
    }
    if (offerDraft.serviceUrl.trim()) {
      try {
        if (new URL(offerDraft.serviceUrl).protocol !== "https:") throw new Error("url")
      } catch { setNotice("Укажите корректную HTTPS-ссылку на внешний сервис."); return }
    }
    setExternalOffer({ ...offerDraft, name: offerDraft.name.trim(), code: offerDraft.code.trim(), description: offerDraft.description.trim(), terms: offerDraft.terms.trim(), serviceUrl: offerDraft.serviceUrl.trim() })
    setNotice("Предложение сохранено. Проверяйте его показ в клиентском виде.")
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Мои промокоды</h2>
          <p className="mt-1 text-sm text-muted-foreground">Клиентский прототип и пример настройки общего кода внешнего сервиса. Данные демонстрационные.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "client" ? "default" : "outline"} onClick={() => setView("client")}>Клиентский вид</Button>
          <Button variant={view === "externalSettings" ? "default" : "outline"} onClick={() => setView("externalSettings")}>Внешний код</Button>
        </div>
      </div>

      {notice ? <div role="status" className="fixed bottom-5 right-5 z-[100] max-w-sm rounded-xl border border-red-100 bg-white px-4 py-3 text-sm font-medium text-[#8d101a] shadow-lg">{notice}</div> : null}

      {view === "client" ? (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Демо-пользователь</p>
                  <p className="text-xs text-muted-foreground">Проверка доступа, сегмента и повторного сохранения общего кода.</p>
                </div>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={authorized} onCheckedChange={(checked) => { setAuthorized(checked === true); setSelectedId(null) }} /> Авторизован</label>
              </div>
              <label className="flex max-w-xs flex-col gap-1 text-sm font-medium">Состояние клиентского экрана
                <select className="h-9 rounded-md border bg-white px-3" value={demoState} onChange={(event) => setDemoState(event.target.value as typeof demoState)}>
                  <option value="ready">С кодами</option><option value="empty">Пустой список</option><option value="loading">Загрузка</option><option value="error">Ошибка загрузки</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => saveCommonCode("SPRINGPHONE")}>Сохранить код с сайта</Button>
                <Button variant="outline" onClick={() => saveCommonCode("FIRSTAPP")}>Открыть код из push</Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input aria-label="Общий промокод Маркета" value={codeToSave} onChange={(event) => setCodeToSave(event.target.value)} placeholder="Введите общий промокод Маркета" />
                <Button onClick={() => saveCommonCode(codeToSave)}>Сохранить промокод</Button>
              </div>
            </CardContent>
          </Card>

          <div className="mx-auto w-full max-w-5xl rounded-[28px] border bg-white p-4 shadow-sm sm:p-7">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E30614]">05.ru</p>
              <h3 className="mt-1 text-3xl font-bold tracking-tight">Мои промокоды</h3>
              <p className="mt-1 text-sm text-muted-foreground">Скопируйте код и используйте его там, где он действует.</p>
            </div>

            {!authorized ? (
              <div className="rounded-2xl border border-dashed p-10 text-center">
                <p className="font-semibold">Войдите, чтобы увидеть свои промокоды</p>
                <p className="mt-1 text-sm text-muted-foreground">Коды и условия доступны только авторизованному пользователю.</p>
              </div>
            ) : demoState === "loading" ? (
              <div role="status" className="grid gap-3 md:grid-cols-2" aria-label="Загружаем промокоды">
                {[0, 1].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border bg-slate-100" />)}
              </div>
            ) : demoState === "error" ? (
              <div className="rounded-2xl border border-dashed p-10 text-center">
                <p className="font-semibold">Не удалось загрузить промокоды</p>
                <p className="mt-1 text-sm text-muted-foreground">Попробуйте ещё раз.</p>
                <Button className="mt-4" onClick={() => setDemoState("ready")}>Повторить</Button>
              </div>
            ) : demoState === "empty" ? (
              <div className="rounded-2xl border border-dashed p-10 text-center">
                <Gift className="mx-auto mb-3 h-9 w-9 text-[#E30614]" />
                <p className="font-semibold">Пока нет промокодов</p>
                <p className="mt-1 text-sm text-muted-foreground">Сохранённые и полученные коды появятся здесь.</p>
              </div>
            ) : (
              <>
                {filteredEntries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center">
                    <Gift className="mx-auto mb-3 h-9 w-9 text-[#E30614]" />
                    <p className="font-semibold">{globalSearch ? "Ничего не найдено" : "Пока нет действующих промокодов"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Промокоды, которые вы сохраните или получите, появятся здесь.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredEntries.map((entry) => (
                      <button key={entry.id} type="button" className="group flex min-h-36 w-full flex-col justify-between gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-[#E30614]/40 hover:bg-red-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E30614]" onClick={() => { setSelectedId(entry.id); setShowLegal(false) }} aria-label={`Открыть промокод «${entry.title}»`}>
                        <span className="flex min-w-0 items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#E30614]">{entry.kind === "external" ? <Gift className="h-5 w-5" /> : <Ticket className="h-5 w-5" />}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block line-clamp-2 font-semibold leading-snug">{entry.title}</span>
                            <span className="mt-1 block text-sm font-semibold text-[#E30614]">{entry.discount ? discountValue(entry.discount) : `Для заказов в ${entry.external?.serviceName}`}</span>
                          </span>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                        <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3">
                          {entry.discount ? <SellerMarks discount={entry.discount} compact /> : <span className="text-xs text-muted-foreground">{entry.external?.serviceName}</span>}
                          <span className="text-xs text-muted-foreground">До {dateLabel(entry.expiresAt)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <Card>
          <CardHeader><CardTitle>Общее предложение внешнего сервиса</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <p className="text-sm text-muted-foreground md:col-span-2">Один код для всей выбранной аудитории. Маркет показывает его, но не рассчитывает скидку и не проверяет применение в своей корзине.</p>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={offerDraft.active} onCheckedChange={(checked) => setOfferDraft((prev) => ({ ...prev, active: checked === true }))} /> Показывать предложение</label>
            <div />
            {([
              ["name", "Название предложения"], ["serviceName", "Сервис"], ["code", "Общий промокод"], ["serviceUrl", "Ссылка на сервис (HTTPS)"],
            ] as const).map(([key, label]) => <label key={key} className="grid gap-1 text-sm font-medium">{label}<Input value={offerDraft[key]} onChange={(event) => setOfferDraft((prev) => ({ ...prev, [key]: event.target.value }))} /></label>)}
            <label className="grid gap-1 text-sm font-medium md:col-span-2">Краткое описание<Textarea value={offerDraft.description} onChange={(event) => setOfferDraft((prev) => ({ ...prev, description: event.target.value }))} /></label>
            <label className="grid gap-1 text-sm font-medium md:col-span-2">Условия для пользователя<Textarea className="min-h-28" value={offerDraft.terms} onChange={(event) => setOfferDraft((prev) => ({ ...prev, terms: event.target.value }))} /></label>
            <label className="grid gap-1 text-sm font-medium">Показывать с<Input type="date" value={offerDraft.startDate} onChange={(event) => setOfferDraft((prev) => ({ ...prev, startDate: event.target.value }))} /></label>
            <label className="grid gap-1 text-sm font-medium">Показывать до<Input type="date" value={offerDraft.endDate} onChange={(event) => setOfferDraft((prev) => ({ ...prev, endDate: event.target.value }))} /></label>
            <label className="grid gap-1 text-sm font-medium">Аудитория
              <select className="h-9 rounded-md border bg-white px-3" value={offerDraft.audience} onChange={(event) => setOfferDraft((prev) => ({ ...prev, audience: event.target.value as ExternalOffer["audience"] }))}>
                <option value="all">Все авторизованные</option><option value="segment">Сегмент по телефонам</option>
              </select>
            </label>
            {offerDraft.audience === "segment" ? (
              <div className="grid gap-2 md:col-span-2">
                <label className="grid gap-1 text-sm font-medium">Телефоны сегмента<Textarea className="min-h-24" value={offerDraft.phones} onChange={(event) => setOfferDraft((prev) => ({ ...prev, phones: event.target.value }))} placeholder="Один телефон в строке" /></label>
                <label className="text-sm">Или загрузите CSV/TXT с номерами<Input type="file" accept=".csv,.txt,text/plain,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { const phones = await file.text(); setOfferDraft((prev) => ({ ...prev, phones })) } }} /></label>
                <p className="text-xs text-muted-foreground">Демо-сопоставление: номеров в сегменте — {getSegmentPhones(offerDraft.phones).length}. Пустой сегмент никому не показывает код. В настоящем API номера сопоставляются с аккаунтами на backend и не отправляются клиенту.</p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <Button onClick={saveExternalOffer}>Сохранить предложение</Button>
              <span className="text-xs text-muted-foreground">Демо-аккаунт: +7 900 000-00-01 · сейчас {offerVisible ? "видит" : "не видит"} код.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(selected && authorized)} onOpenChange={(open) => { if (!open) { setSelectedId(null); setShowLegal(false) } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
          {selected ? showLegal ? (
            <>
              <DialogHeader><DialogTitle>Юридические условия</DialogTitle><DialogDescription>{selected.title}</DialogDescription></DialogHeader>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.discount?.legal_terms_text}</p>
              <Button variant="outline" onClick={() => setShowLegal(false)}>Вернуться к промокоду</Button>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 pr-7">
                  <DialogTitle className="text-2xl leading-tight">{selected.title}</DialogTitle>
                  {selected.discount?.legal_terms_text.trim() ? <Button size="icon" variant="outline" aria-label="Юридические условия" title="Юридические условия" onClick={() => setShowLegal(true)}><Info /></Button> : null}
                </div>
                <DialogDescription>{selected.description}</DialogDescription>
              </DialogHeader>
              {selected.kind === "external" ? <p className="text-sm font-medium text-[#8d101a]">Промокод действует только в {selected.external?.serviceName}</p> : null}
              {selected.discount ? <p className="text-3xl font-bold text-[#E30614]">{discountValue(selected.discount)}</p> : null}
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-muted-foreground">Промокод</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2"><code className="font-mono text-xl font-bold tracking-wide">{selected.code}</code><Button size="sm" onClick={() => copyText(selected.code, "Код скопирован")}> <Copy /> Скопировать</Button></div>
              </div>
              <p className="text-sm text-muted-foreground">Действует до: {dateLabel(selected.expiresAt)}</p>
              {selected.discount ? <SellerMarks discount={selected.discount} /> : null}
              <div className="rounded-xl border p-4">
                <p className="font-semibold">Условия применения</p>
                {selected.kind === "external" ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selected.external?.terms}</p> : <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">{marketConditions(selected).map((condition) => <li key={condition}>{condition}</li>)}</ul>}
              </div>
              {selected.kind === "external" ? (
                <Button disabled={!selected.external?.serviceUrl} onClick={() => { if (selected.external?.serviceUrl) window.open(selected.external.serviceUrl, "_blank", "noopener,noreferrer") }}><ExternalLink /> Перейти в {selected.external?.serviceName}</Button>
              ) : selected.discount?.promo_products_button_text && selected.discount.promo_products_button_url ? (
                <Button onClick={() => window.open(new URL(selected.discount!.promo_products_button_url, "https://05.ru").toString(), "_blank", "noopener,noreferrer")}><ExternalLink /> {selected.discount.promo_products_button_text}</Button>
              ) : null}
              <p className="text-xs text-muted-foreground">{selected.kind === "external" ? "Код применяется только во внешнем сервисе." : "Скопируйте код и введите его при оформлении заказа. Переход к товарам не применяет код автоматически."}</p>
              <Button variant="outline" onClick={() => { setSelectedId(null); setShowLegal(false) }}><Check /> К списку промокодов</Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
