import { type Dispatch, type SetStateAction, useState } from "react"
import { Plus, Ticket } from "lucide-react"

import { createEmptyExternalOffer, DEMO_USER_PHONE, type ExternalOffer, getSegmentPhones } from "@/admin/externalOffers"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface ExternalOffersSectionProps {
  offers: ExternalOffer[]
  setOffers: Dispatch<SetStateAction<ExternalOffer[]>>
}

export function ExternalOffersSection({ offers, setOffers }: ExternalOffersSectionProps) {
  const [draft, setDraft] = useState<ExternalOffer | null>(null)
  const [message, setMessage] = useState("")

  function save() {
    if (!draft) return
    const next = {
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      code: draft.code.trim().toUpperCase(),
      serviceUrl: draft.serviceUrl.trim(),
    }
    if (!next.name || !next.code || !next.description) {
      setMessage("Укажите название, код и описание с условиями.")
      return
    }
    if (!next.startDate || !next.endDate || next.startDate > next.endDate) {
      setMessage("Проверьте период показа.")
      return
    }
    try {
      if (new URL(next.serviceUrl).protocol !== "https:") throw new Error("url")
    } catch {
      setMessage("Укажите корректную HTTPS-ссылку на Близко.")
      return
    }
    if (offers.some((offer) => offer.id !== next.id && offer.code.toLowerCase() === next.code.toLowerCase())) {
      setMessage("Такой промокод Близко уже настроен.")
      return
    }
    setOffers((current) => current.some((offer) => offer.id === next.id)
      ? current.map((offer) => offer.id === next.id ? next : offer)
      : [...current, next])
    setDraft(null)
    setMessage("Промокод сохранён. Доступные предложения появятся в «Моих промокодах».")
  }

  return (
    <Card className="overflow-hidden border-red-100 bg-gradient-to-br from-white to-red-50/30">
      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#E30614]"><Ticket className="h-5 w-5" /></span>
            <div>
              <h3 className="text-lg font-semibold">Промокоды Близко</h3>
              <p className="max-w-2xl text-sm text-muted-foreground">Внешние коды для раздела «Мои промокоды». Скидка действует в Близко и не рассчитывается в корзине Маркета.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => { setDraft(createEmptyExternalOffer()); setMessage("") }}><Plus className="h-4 w-4" /> Добавить промокод</Button>
        </div>

        <div className="grid gap-2">
          {offers.map((offer) => {
            const today = new Date().toISOString().slice(0, 10)
            const current = offer.active && offer.startDate <= today && offer.endDate >= today
            return (
              <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{offer.name} <span className="ml-2 font-mono text-sm text-[#8d101a]">{offer.code}</span></p>
                  <p className="text-xs text-muted-foreground">{offer.audience === "all" ? "Все авторизованные" : `Сегмент: ${getSegmentPhones(offer.phones).length} номеров`} · {current ? "Показывается" : "Не показывается"} · до {offer.endDate}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setDraft({ ...offer }); setMessage("") }}>Настроить</Button>
              </div>
            )
          })}
          {offers.length === 0 ? <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-muted-foreground">Коды Близко ещё не добавлены.</p> : null}
        </div>

        {draft ? <div className="grid gap-4 rounded-2xl border bg-white p-4 md:grid-cols-2" aria-label="Настройка промокода Близко">
          <div className="flex items-center gap-2 md:col-span-2"><Checkbox checked={draft.active} onCheckedChange={(checked) => setDraft((current) => current ? { ...current, active: checked === true } : current)} /><span className="text-sm font-medium">Показывать предложение</span></div>
          <label className="grid gap-1 text-sm font-medium">Название предложения<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium">Общий промокод<Input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium md:col-span-2">Описание и условия для пользователя<Textarea className="min-h-24" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium md:col-span-2">Ссылка на Близко (HTTPS)<Input type="url" value={draft.serviceUrl} onChange={(event) => setDraft({ ...draft, serviceUrl: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium">Показывать с<Input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium">Показывать до<Input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium">Аудитория
            <select className="h-10 rounded-md border bg-white px-3" value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value as ExternalOffer["audience"] })}>
              <option value="all">Все авторизованные</option><option value="segment">Сегмент по телефонам</option>
            </select>
          </label>
          {draft.audience === "segment" ? <div className="grid gap-2 md:col-span-2">
            <label className="grid gap-1 text-sm font-medium">Телефоны сегмента<Textarea className="min-h-24" value={draft.phones} onChange={(event) => setDraft({ ...draft, phones: event.target.value })} placeholder="Один телефон в строке" /></label>
            <label className="grid gap-1 text-sm font-medium">Загрузить CSV/TXT<Input type="file" accept=".csv,.txt,text/plain,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { const phones = await file.text(); setDraft((current) => current ? { ...current, phones } : current) } }} /></label>
            <p className="text-xs text-muted-foreground">Номеров в сегменте: {getSegmentPhones(draft.phones).length}. Демо-аккаунт +7 900 000-00-01 {getSegmentPhones(draft.phones).includes(DEMO_USER_PHONE) ? "входит" : "не входит"} в сегмент. Пустой сегмент не показывает код никому.</p>
          </div> : null}
          <div className="flex flex-wrap items-center gap-2 md:col-span-2">
            <Button onClick={save}>Сохранить</Button>
            <Button variant="ghost" onClick={() => { setDraft(null); setMessage("") }}>Отмена</Button>
          </div>
        </div> : null}
        {message ? <p role="status" className="text-sm text-[#8d101a]">{message}</p> : null}
      </CardContent>
    </Card>
  )
}
