export interface ExternalOffer {
  id: string
  active: boolean
  name: string
  description: string
  code: string
  serviceName: string
  serviceUrl: string
  startDate: string
  endDate: string
  audience: "all" | "segment"
  phones: string
}

export const DEMO_USER_PHONE = "79000000001"

function dateAfter(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "")
  if (digits.length === 10) digits = `7${digits}`
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`
  return digits.length === 11 && digits.startsWith("7") ? digits : null
}

export function getSegmentPhones(raw: string): string[] {
  return Array.from(new Set(raw.split(/[\s,;]+/).map(normalizePhone).filter((phone): phone is string => Boolean(phone))))
}

export function createEmptyExternalOffer(): ExternalOffer {
  return {
    id: `blizko-${crypto.randomUUID()}`,
    active: false,
    name: "",
    description: "",
    code: "",
    serviceName: "Близко",
    serviceUrl: "https://blizko.05.ru/",
    startDate: dateAfter(0),
    endDate: dateAfter(30),
    audience: "all",
    phones: "",
  }
}

export function createSeedExternalOffers(): ExternalOffer[] {
  return [{
    ...createEmptyExternalOffer(),
    id: "blizko-nut10",
    active: true,
    name: "Скидка на продукты в Близко",
    description: "Промокод NUT10 действует только при заказе продуктов в Близко. Введите код при оформлении заказа в сервисе Близко.",
    code: "NUT10",
    startDate: dateAfter(-3),
    phones: DEMO_USER_PHONE,
  }]
}
