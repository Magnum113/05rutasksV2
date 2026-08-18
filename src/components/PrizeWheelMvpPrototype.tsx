import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clipboard,
  Gift,
  ListChecks,
  LoaderCircle,
  PackageOpen,
  RotateCcw,
  Sparkles,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import "@/components/prize-wheel-mvp.css"

type PrizeKind = "bonus" | "promo" | "points" | "physical"
type InfoPanel = "prizes" | "rules" | "tasks" | null
type PrizeTab = "available" | "won"
type PrototypeVersion = "mvp" | "full"

interface Prize {
  id: string
  title: string
  shortTitle: string
  description: string
  image: string
  kind: PrizeKind
  code?: string
  repeatable?: boolean
  pointsAmount?: number
  pointsTtlDays?: number
}

interface WonPrize {
  claimId: string
  prize: Prize
  claimed: boolean
  promoCode?: string
}

const MVP_PRIZES: Prize[] = [
  {
    id: "bonus-100",
    title: "100 бонусов",
    shortTitle: "100 бонусов",
    description: "Бонусы будут начислены на ваш бонусный счёт после получения приза.",
    image: "/prize-wheel/bonus-100.webp",
    kind: "bonus",
  },
  {
    id: "promo-10",
    title: "Скидка 10% на заказ",
    shortTitle: "−10% на заказ",
    description: "Промокод на скидку 10%. Срок действия — 14 дней.",
    image: "/prize-wheel/promo-10.webp",
    kind: "promo",
    code: "WHEEL10-5RU",
  },
  {
    id: "promo-15",
    title: "Скидка 15% на товары",
    shortTitle: "−15% на товары",
    description: "Промокод на выбранные товары. Срок действия — 7 дней.",
    image: "/prize-wheel/promo-15.webp",
    kind: "promo",
    code: "GIFT15-5RU",
  },
  {
    id: "bonus-10000",
    title: "10 000 бонусов",
    shortTitle: "10 000 бонусов",
    description: "Главный бонусный приз будет начислен на ваш бонусный счёт.",
    image: "/prize-wheel/bonus-10000.webp",
    kind: "bonus",
    repeatable: false,
  },
]

const FULL_PRIZES: Prize[] = [
  ...MVP_PRIZES,
  {
    id: "points-20",
    title: "20 очков активности",
    shortTitle: "+20 очков",
    description: "Очки активности можно потратить на новые вращения. Срок жизни — 30 дней.",
    image: "/prize-wheel/activity-points.svg",
    kind: "points",
    pointsAmount: 20,
    pointsTtlDays: 30,
  },
  {
    id: "physical-headphones",
    title: "Беспроводные наушники",
    shortTitle: "Наушники",
    description: "Заберите приз в магазине 05.ru по адресу: проспект Имама Шамиля, 5. Перед визитом позвоните по номеру +7 800 511-05-05.",
    image: "/prize-wheel/physical-headphones.svg",
    kind: "physical",
    repeatable: false,
  },
]

const MVP_WIN_SEQUENCE = ["promo-10", "bonus-100", "promo-15", "bonus-100", "bonus-10000"]
const FULL_WIN_SEQUENCE = ["points-20", "physical-headphones", "promo-10", "bonus-100", "points-20"]
const INITIAL_REEL_INDEX = 8
const ANIMATION_MS = 2850
const FULL_INITIAL_FREE_SPINS = 1
const FULL_INITIAL_ACTIVITY_POINTS = 40
const ACTIVITY_POINT_SPIN_COST = 10

const PRIZE_KIND_LABELS: Record<PrizeKind, string> = {
  bonus: "Бонусы",
  promo: "Промокод",
  points: "Очки активности",
  physical: "Физический приз",
}

interface PrizeWheelMvpPrototypeProps {
  onBack: () => void
}

interface PrizeWheelPrototypeProps extends PrizeWheelMvpPrototypeProps {
  version: PrototypeVersion
}

function PrizeWheelPrototype({ onBack, version }: PrizeWheelPrototypeProps) {
  const isFullVersion = version === "full"
  const initialFreeSpins = isFullVersion ? FULL_INITIAL_FREE_SPINS : 5
  const configuredPrizes = isFullVersion ? FULL_PRIZES : MVP_PRIZES
  const winSequence = isFullVersion ? FULL_WIN_SEQUENCE : MVP_WIN_SEQUENCE
  const reelViewportRef = useRef<HTMLDivElement | null>(null)
  const reelFirstCardRef = useRef<HTMLElement | null>(null)
  const spinTimeoutRef = useRef<number | null>(null)
  const reelIndexRef = useRef(INITIAL_REEL_INDEX)

  const [freeSpinsLeft, setFreeSpinsLeft] = useState(initialFreeSpins)
  const [activityPoints, setActivityPoints] = useState(isFullVersion ? FULL_INITIAL_ACTIVITY_POINTS : 0)
  const [spinCount, setSpinCount] = useState(0)
  const [reelIndex, setReelIndex] = useState(INITIAL_REEL_INDEX)
  const [trackX, setTrackX] = useState(0)
  const [trackReady, setTrackReady] = useState(false)
  const [instantMove, setInstantMove] = useState(true)
  const [isIdleScrolling, setIsIdleScrolling] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null)
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
  const [selectedPromoCode, setSelectedPromoCode] = useState<string | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
  const [resultClaimed, setResultClaimed] = useState(false)
  const [infoPanel, setInfoPanel] = useState<InfoPanel>(null)
  const [prizeTab, setPrizeTab] = useState<PrizeTab>("available")
  const [wonPrizes, setWonPrizes] = useState<WonPrize[]>([])
  const [copied, setCopied] = useState(false)

  const pendingPrizeCount = wonPrizes.filter((item) => !item.claimed).length
  const userPrizesCount = wonPrizes.length
  const availablePrizes = configuredPrizes.filter((prize) => (
    prize.repeatable !== false || !wonPrizes.some((item) => item.prize.id === prize.id)
  ))
  const reelItems = Array.from({ length: 6 }, () => availablePrizes).flat()
  const canPayWithPoints = isFullVersion && activityPoints >= ACTIVITY_POINT_SPIN_COST
  const canSpin = freeSpinsLeft > 0 || canPayWithPoints

  useLayoutEffect(() => {
    const updateTrackPosition = () => {
      const viewport = reelViewportRef.current
      const firstCard = reelFirstCardRef.current
      if (!viewport || !firstCard) return

      const track = firstCard.parentElement
      const styles = track ? window.getComputedStyle(track) : null
      const gap = styles ? Number.parseFloat(styles.columnGap || styles.gap || "0") : 0
      const cardWidth = firstCard.offsetWidth
      const nextX = viewport.clientWidth / 2 - (reelIndex * (cardWidth + gap) + cardWidth / 2)
      setTrackX(nextX)
      setTrackReady(true)
    }

    updateTrackPosition()
    window.addEventListener("resize", updateTrackPosition)
    return () => window.removeEventListener("resize", updateTrackPosition)
  }, [availablePrizes.length, reelIndex])

  useEffect(() => {
    reelIndexRef.current = reelIndex
  }, [reelIndex])

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const shouldAutoScroll = trackReady
      && !prefersReducedMotion
      && !isSpinning
      && !resultOpen
      && infoPanel === null
      && canSpin
      && availablePrizes.length > 1

    if (!shouldAutoScroll) {
      setIsIdleScrolling(false)
      return
    }

    let intervalId: number | null = null
    let firstFrameId: number | null = null
    let secondFrameId: number | null = null

    const moveToNextPrize = () => {
      const prizeCount = availablePrizes.length
      const loopStart = prizeCount * 2
      const loopEnd = prizeCount * 4

      if (reelIndexRef.current >= loopEnd) {
        setInstantMove(true)
        reelIndexRef.current = loopStart
        setReelIndex(loopStart)

        firstFrameId = window.requestAnimationFrame(() => {
          secondFrameId = window.requestAnimationFrame(() => {
            const nextIndex = loopStart + 1
            setInstantMove(false)
            reelIndexRef.current = nextIndex
            setReelIndex(nextIndex)
          })
        })
        return
      }

      const nextIndex = reelIndexRef.current + 1
      setInstantMove(false)
      reelIndexRef.current = nextIndex
      setReelIndex(nextIndex)
    }

    const startTimeoutId = window.setTimeout(() => {
      setIsIdleScrolling(true)
      moveToNextPrize()
      intervalId = window.setInterval(moveToNextPrize, 1750)
    }, 850)

    return () => {
      window.clearTimeout(startTimeoutId)
      if (intervalId !== null) window.clearInterval(intervalId)
      if (firstFrameId !== null) window.cancelAnimationFrame(firstFrameId)
      if (secondFrameId !== null) window.cancelAnimationFrame(secondFrameId)
      setIsIdleScrolling(false)
    }
  }, [availablePrizes.length, canSpin, infoPanel, isSpinning, resultOpen, trackReady])

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current)
    }
  }, [])

  function beginSpin() {
    if (isSpinning) return
    if (!canSpin || availablePrizes.length === 0) return

    const scheduledPrizeId = winSequence[spinCount % winSequence.length]
    const winner = availablePrizes.find((prize) => prize.id === scheduledPrizeId)
      ?? availablePrizes[spinCount % availablePrizes.length]
    const prizeIndex = availablePrizes.findIndex((prize) => prize.id === winner.id)
    const resetIndex = availablePrizes.length + ((spinCount + 1) % availablePrizes.length)
    const targetIndex = availablePrizes.length * 4 + prizeIndex
    const useFreeSpin = freeSpinsLeft > 0

    setCopied(false)
    setSelectedPrize(null)
    setSelectedPromoCode(null)
    setResultClaimed(false)
    setIsIdleScrolling(false)
    setIsSpinning(true)
    setInstantMove(true)
    setReelIndex(resetIndex)

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setInstantMove(false)
        setReelIndex(targetIndex)
      })
    })

    if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current)
    spinTimeoutRef.current = window.setTimeout(() => {
      const claimId = `${winner.id}-${Date.now()}`
      const promoCode = winner.code ? `${winner.code}-${String(spinCount + 1).padStart(2, "0")}` : undefined
      setSelectedPrize(winner)
      setSelectedClaimId(claimId)
      setSelectedPromoCode(promoCode ?? null)
      setWonPrizes((items) => [{ claimId, prize: winner, claimed: false, promoCode }, ...items])
      if (useFreeSpin) {
        setFreeSpinsLeft((value) => Math.max(0, value - 1))
      } else {
        setActivityPoints((value) => Math.max(0, value - ACTIVITY_POINT_SPIN_COST))
      }
      setSpinCount((value) => value + 1)
      setIsSpinning(false)
      setResultOpen(true)
      spinTimeoutRef.current = null
    }, ANIMATION_MS + 120)
  }

  function claimPrize() {
    if (!selectedPrize || !selectedClaimId || resultClaimed) return

    setWonPrizes((items) => items.map((item) => (
      item.claimId === selectedClaimId ? { ...item, claimed: true } : item
    )))
    if (selectedPrize.kind === "points" && selectedPrize.pointsAmount) {
      setActivityPoints((value) => value + selectedPrize.pointsAmount!)
    }
    setResultClaimed(true)
  }

  function continueAfterClaim() {
    setResultOpen(false)
    setSelectedPrize(null)
    setSelectedClaimId(null)
    setSelectedPromoCode(null)
    setResultClaimed(false)
    setCopied(false)
  }

  async function copyPromoCode() {
    if (!selectedPromoCode) return
    try {
      await navigator.clipboard.writeText(selectedPromoCode)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  function resetDemo() {
    if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current)
    setFreeSpinsLeft(initialFreeSpins)
    setActivityPoints(isFullVersion ? FULL_INITIAL_ACTIVITY_POINTS : 0)
    setSpinCount(0)
    setReelIndex(INITIAL_REEL_INDEX)
    setInstantMove(true)
    setIsIdleScrolling(false)
    setIsSpinning(false)
    setSelectedPrize(null)
    setSelectedClaimId(null)
    setSelectedPromoCode(null)
    setResultOpen(false)
    setResultClaimed(false)
    setInfoPanel(null)
    setPrizeTab("available")
    setWonPrizes([])
    setCopied(false)
  }

  const primaryButtonLabel = isSpinning
    ? "Лента крутится"
    : freeSpinsLeft > 0
      ? "Крутить бесплатно"
      : canPayWithPoints
        ? `Крутить за ${ACTIVITY_POINT_SPIN_COST} очков`
        : isFullVersion
          ? "Недостаточно очков"
          : "Вращения закончились"

  return (
    <div className={`pw-page${isFullVersion ? " pw-page--full" : ""}`}>
      <div className="pw-stage">
        <header className="pw-header">
          <button className="pw-back-button" type="button" onClick={onBack} aria-label="Вернуться в админку">
            <ArrowLeft aria-hidden="true" />
            <span>В админку</span>
          </button>

          <div className="pw-brand">
            <span className="pw-brand-logo" role="img" aria-label="05.RU" />
            <span className="pw-brand-product">Колесо призов</span>
          </div>

          <div className="pw-balance-group" aria-live="polite">
            <div className="pw-spin-balance">
              <Gift aria-hidden="true" />
              <strong>{freeSpinsLeft}</strong>
              <span>{freeSpinsLeft === 1 ? "вращение" : freeSpinsLeft > 1 && freeSpinsLeft < 5 ? "вращения" : "вращений"}</span>
            </div>
            {isFullVersion ? (
              <div className="pw-spin-balance pw-points-balance">
                <CircleDollarSign aria-hidden="true" />
                <strong>{activityPoints}</strong>
                <span>очков</span>
              </div>
            ) : null}
          </div>

          <nav className="pw-nav" aria-label="Разделы колеса призов">
            <button type="button" onClick={() => { setPrizeTab("available"); setInfoPanel("prizes") }}>
              <Gift aria-hidden="true" />
              <span>Призы</span>
              {userPrizesCount > 0 ? <b>{userPrizesCount}</b> : null}
            </button>
            {isFullVersion ? (
              <button type="button" onClick={() => setInfoPanel("tasks")}>
                <ListChecks aria-hidden="true" />
                <span>Задания</span>
              </button>
            ) : null}
          </nav>
        </header>

        <main className="pw-main">
          <div className="pw-intro">
            <h1>{isFullVersion ? "Выполняйте задания и обменивайте очки на призы" : "Крутите ленту — каждый раз выигрывайте приз"}</h1>
            <p>
              {isFullVersion
                ? "В демо осталось одно бесплатное вращение; затем каждое вращение стоит 10 очков активности."
                : "Вам доступно пять бесплатных вращений. В ленте нет пустых секторов."}
            </p>
          </div>

          <section className={`pw-reel-shell${isIdleScrolling ? " pw-reel-shell--idle" : ""}`} aria-label="Лента призов">
            <div className="pw-selector" aria-hidden="true">
              <ChevronDown />
            </div>
            <div className="pw-reel-viewport" ref={reelViewportRef}>
              <div
                className={`pw-reel-track${isIdleScrolling ? " pw-reel-track--idle" : ""}${instantMove ? " pw-reel-track--instant" : ""}${trackReady ? " pw-reel-track--ready" : ""}`}
                style={{ transform: `translate3d(${trackX}px, 0, 0)` }}
              >
                {reelItems.map((prize, index) => (
                  <article
                    className={`pw-reel-card pw-reel-card--${prize.kind}${index === reelIndex ? " pw-reel-card--selected" : ""}`}
                    key={`${prize.id}-${index}`}
                    ref={index === 0 ? reelFirstCardRef : undefined}
                    aria-hidden={index < 4 || index > 19}
                  >
                    <div className="pw-prize-visual">
                      <img src={prize.image} alt="" draggable="false" />
                    </div>
                    <span>{prize.shortTitle}</span>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <div className="pw-action-zone">
            {pendingPrizeCount > 0 ? (
              <p className="pw-pending-note">
                <Sparkles aria-hidden="true" /> Незабранных призов: {pendingPrizeCount}
              </p>
            ) : null}
            <button
              className="pw-spin-button"
              type="button"
              onClick={beginSpin}
              disabled={isSpinning || !canSpin || availablePrizes.length === 0}
            >
              {isSpinning ? (
                <LoaderCircle className="pw-spinner" aria-hidden="true" />
              ) : freeSpinsLeft > 0 ? (
                <Gift aria-hidden="true" />
              ) : (
                <CircleDollarSign aria-hidden="true" />
              )}
              <span>{primaryButtonLabel}</span>
            </button>
            <p className="pw-balance-caption">
              {freeSpinsLeft > 0
                ? `Останется бесплатных вращений: ${Math.max(0, freeSpinsLeft - 1)}`
                : canPayWithPoints
                  ? `После вращения останется ${activityPoints - ACTIVITY_POINT_SPIN_COST} очков`
                  : isFullVersion
                    ? "Заработайте очки активности в заданиях"
                    : "Все бесплатные вращения использованы"}
            </p>
            {isFullVersion && !canSpin && freeSpinsLeft === 0 ? (
              <button className="pw-earn-button" type="button" onClick={() => setInfoPanel("tasks")}>
                Перейти к заданиям
              </button>
            ) : null}
          </div>

          <p className="pw-legal">
            Нажимая «{freeSpinsLeft > 0 ? "Крутить бесплатно" : `Крутить за ${ACTIVITY_POINT_SPIN_COST} очков`}», вы соглашаетесь с{" "}
            <button type="button" onClick={() => setInfoPanel("rules")}>правилами игры</button>
            {" "}и условиями акции.
          </p>
        </main>

        <button className="pw-reset" type="button" onClick={resetDemo}>
          <RotateCcw aria-hidden="true" /> Сбросить демо
        </button>
      </div>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="pw-result-dialog">
          {selectedPrize ? (
            <>
              <DialogHeader className="pw-result-header">
                <span className="pw-result-kicker">{resultClaimed ? "Приз ваш" : "Поздравляем!"}</span>
                <DialogTitle>{selectedPrize.title}</DialogTitle>
                <DialogDescription>{selectedPrize.description}</DialogDescription>
              </DialogHeader>

              <div className={`pw-result-image pw-result-image--${selectedPrize.kind}`}>
                <img src={selectedPrize.image} alt={selectedPrize.title} />
              </div>

              {resultClaimed && selectedPrize.kind === "promo" && selectedPromoCode ? (
                <div className="pw-code-box">
                  <span>Ваш промокод</span>
                  <div>
                    <strong>{selectedPromoCode}</strong>
                    <button type="button" onClick={copyPromoCode} aria-label="Скопировать промокод">
                      {copied ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
                    </button>
                  </div>
                  <small>{copied ? "Промокод скопирован" : "Нажмите, чтобы скопировать"}</small>
                </div>
              ) : null}

              {resultClaimed && selectedPrize.kind === "bonus" ? (
                <div className="pw-success-note">
                  <Check aria-hidden="true" />
                  <span>Бонусы приняты к начислению на ваш бонусный счёт.</span>
                </div>
              ) : null}

              {resultClaimed && selectedPrize.kind === "points" ? (
                <div className="pw-success-note pw-success-note--points">
                  <CircleDollarSign aria-hidden="true" />
                  <span>
                    Начислено {selectedPrize.pointsAmount} очков активности. Срок жизни — {selectedPrize.pointsTtlDays} дней.
                  </span>
                </div>
              ) : null}

              {resultClaimed && selectedPrize.kind === "physical" ? (
                <div className="pw-success-note pw-success-note--physical">
                  <PackageOpen aria-hidden="true" />
                  <span>Приз сохранён. Инструкцию получения можно повторно открыть во вкладке «Вы выиграли».</span>
                </div>
              ) : null}

              {!resultClaimed ? (
                <p className="pw-claim-note">Заберите приз в течение 7 дней. Можно продолжить вращения и вернуться за ним позже.</p>
              ) : null}

              <button
                className="pw-modal-action"
                type="button"
                onClick={resultClaimed ? continueAfterClaim : claimPrize}
              >
                {resultClaimed ? "Продолжить" : "Забрать приз"}
              </button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(infoPanel)} onOpenChange={(open) => !open && setInfoPanel(null)}>
        <DialogContent className="pw-info-dialog">
          <DialogHeader>
            <DialogTitle>
              {infoPanel === "prizes" ? "Призы" : infoPanel === "tasks" ? "Задания" : "Правила игры"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {infoPanel === "prizes"
                ? "Доступные и выигранные призы"
                : infoPanel === "tasks"
                  ? "Задания для получения очков активности"
                  : "Правила механики колеса призов"}
            </DialogDescription>
          </DialogHeader>

          {infoPanel === "prizes" ? (
            <>
              <div className="pw-prize-tabs" role="tablist" aria-label="Категории призов">
                <button
                  type="button"
                  role="tab"
                  aria-selected={prizeTab === "available"}
                  className={prizeTab === "available" ? "pw-prize-tab--active" : ""}
                  onClick={() => setPrizeTab("available")}
                >
                  Можно выиграть
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={prizeTab === "won"}
                  className={prizeTab === "won" ? "pw-prize-tab--active" : ""}
                  onClick={() => setPrizeTab("won")}
                >
                  Вы выиграли
                  {userPrizesCount > 0 ? <b>{userPrizesCount}</b> : null}
                </button>
              </div>

              {prizeTab === "available" ? (
                <div className="pw-prize-list" role="tabpanel">
                  {availablePrizes.map((prize) => (
                    <div key={prize.id} className={`pw-prize-row pw-prize-row--${prize.kind}`}>
                      <img src={prize.image} alt="" />
                      <span>
                        <strong>{prize.title}</strong>
                        <small>{PRIZE_KIND_LABELS[prize.kind]}</small>
                      </span>
                    </div>
                  ))}
                  {availablePrizes.length === 0 ? (
                    <div className="pw-empty-state">
                      <Gift aria-hidden="true" />
                      <strong>Доступных призов сейчас нет</strong>
                      <span>Новые вращения не списываются, пока пул пуст.</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="pw-win-list" role="tabpanel">
                  {wonPrizes.map((item) => (
                    item.claimed && (item.prize.kind === "promo" || item.prize.kind === "physical") ? (
                      <button
                        type="button"
                        key={item.claimId}
                        className="pw-prize-row pw-prize-row--promo"
                        onClick={() => {
                          setSelectedPrize(item.prize)
                          setSelectedClaimId(item.claimId)
                          setSelectedPromoCode(item.promoCode ?? item.prize.code ?? null)
                          setResultClaimed(true)
                          setCopied(false)
                          setInfoPanel(null)
                          setResultOpen(true)
                        }}
                      >
                        <img src={item.prize.image} alt="" />
                        <span>
                          <strong>{item.prize.title}</strong>
                          <small>{item.prize.kind === "promo" ? "Промокод получен" : "Инструкция сохранена"}</small>
                        </span>
                        <b>Открыть</b>
                      </button>
                    ) : item.claimed ? (
                      <div key={item.claimId} className={`pw-prize-row pw-prize-row--${item.prize.kind}`}>
                        <img src={item.prize.image} alt="" />
                        <span><strong>{item.prize.title}</strong><small>Получен · {PRIZE_KIND_LABELS[item.prize.kind]}</small></span>
                        <Check aria-label="Получен" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        key={item.claimId}
                        className={`pw-prize-row pw-prize-row--${item.prize.kind}`}
                        onClick={() => {
                          setSelectedPrize(item.prize)
                          setSelectedClaimId(item.claimId)
                          setSelectedPromoCode(item.promoCode ?? null)
                          setResultClaimed(false)
                          setCopied(false)
                          setInfoPanel(null)
                          setResultOpen(true)
                        }}
                      >
                        <img src={item.prize.image} alt="" />
                        <span><strong>{item.prize.title}</strong><small>Ожидает получения</small></span>
                        <b>Забрать</b>
                      </button>
                    )
                  ))}
                  {wonPrizes.length === 0 ? (
                    <div className="pw-empty-state">
                      <Gift aria-hidden="true" />
                      <strong>Здесь появятся ваши призы</strong>
                      <span>Крутите ленту — каждый раз в ней есть подарок.</span>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : null}

          {infoPanel === "rules" ? (
            <div className="pw-rules">
              <p>Каждому авторизованному пользователю один раз доступны 5 бесплатных вращений.</p>
              {isFullVersion ? <p>После бесплатных вращений каждое новое стоит 10 очков активности.</p> : null}
              <p>Каждое вращение гарантированно определяет один доступный приз. Возможность повторного выигрыша зависит от настроек приза.</p>
              <p>Выигранный приз нужно получить кнопкой «Забрать приз» в течение 7 дней. Незабранные призы сохраняются во вкладке «Вы выиграли» и не ограничивают следующие вращения.</p>
              <p>
                {isFullVersion
                  ? "Призами могут быть бонусы, промокоды, очки активности и физические товары. Вероятности выпадения пользователю не показываются."
                  : "В MVP призами являются бонусы и промокоды. Вероятности выпадения пользователю не показываются."}
              </p>
            </div>
          ) : null}

          {infoPanel === "tasks" ? (
            <div className="pw-tasks-panel">
              <p>Выполняйте задания, чтобы получать очки активности для новых вращений.</p>
              <div className="pw-task-row">
                <ListChecks aria-hidden="true" />
                <span><strong>Оформить заказ</strong><small>Награда: 20 очков активности</small></span>
                <b>+20</b>
              </div>
              <div className="pw-task-row">
                <Sparkles aria-hidden="true" />
                <span><strong>Посетить подборку недели</strong><small>Награда: 10 очков активности</small></span>
                <b>+10</b>
              </div>
              <button className="pw-modal-action" type="button" onClick={() => setInfoPanel(null)}>
                Вернуться к колесу
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function PrizeWheelMvpPrototype({ onBack }: PrizeWheelMvpPrototypeProps) {
  return <PrizeWheelPrototype version="mvp" onBack={onBack} />
}

export function PrizeWheelFullPrototype({ onBack }: PrizeWheelMvpPrototypeProps) {
  return <PrizeWheelPrototype version="full" onBack={onBack} />
}
