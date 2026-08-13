import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clipboard,
  Gift,
  History,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  TicketPercent,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import "@/components/prize-wheel-mvp.css"

type PrizeKind = "bonus" | "promo"
type InfoPanel = "prizes" | "wins" | "rules" | null

interface Prize {
  id: string
  title: string
  shortTitle: string
  description: string
  image: string
  kind: PrizeKind
  code?: string
}

interface WonPrize {
  claimId: string
  prize: Prize
}

const PRIZES: Prize[] = [
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
    description: "Индивидуальный промокод на скидку 10%. Срок действия — 14 дней.",
    image: "/prize-wheel/promo-10.webp",
    kind: "promo",
    code: "WHEEL10-5RU",
  },
  {
    id: "promo-15",
    title: "Скидка 15% на товары",
    shortTitle: "−15% на товары",
    description: "Индивидуальный промокод на выбранные товары. Срок действия — 7 дней.",
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
  },
]

const REEL_ITEMS = Array.from({ length: 6 }, () => PRIZES).flat()
const WIN_SEQUENCE = [1, 0, 2, 0, 3]
const INITIAL_REEL_INDEX = 8
const ANIMATION_MS = 2850

interface PrizeWheelMvpPrototypeProps {
  onBack: () => void
}

export function PrizeWheelMvpPrototype({ onBack }: PrizeWheelMvpPrototypeProps) {
  const reelViewportRef = useRef<HTMLDivElement | null>(null)
  const reelFirstCardRef = useRef<HTMLElement | null>(null)
  const spinTimeoutRef = useRef<number | null>(null)

  const [spinsLeft, setSpinsLeft] = useState(5)
  const [reelIndex, setReelIndex] = useState(INITIAL_REEL_INDEX)
  const [trackX, setTrackX] = useState(0)
  const [trackReady, setTrackReady] = useState(false)
  const [instantMove, setInstantMove] = useState(true)
  const [isSpinning, setIsSpinning] = useState(false)
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
  const [resultClaimed, setResultClaimed] = useState(false)
  const [infoPanel, setInfoPanel] = useState<InfoPanel>(null)
  const [wonPrizes, setWonPrizes] = useState<WonPrize[]>([])
  const [copied, setCopied] = useState(false)

  const hasPendingPrize = Boolean(selectedPrize && !resultClaimed)
  const spinsUsed = 5 - spinsLeft

  const activePanelTitle = useMemo(() => {
    if (infoPanel === "prizes") return "Призы в ленте"
    if (infoPanel === "wins") return "Мои призы"
    if (infoPanel === "rules") return "Правила игры"
    return ""
  }, [infoPanel])

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
  }, [reelIndex])

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current)
    }
  }, [])

  function beginSpin() {
    if (isSpinning) return

    if (hasPendingPrize) {
      setResultOpen(true)
      return
    }

    if (spinsLeft <= 0) return

    const prizeIndex = WIN_SEQUENCE[spinsUsed % WIN_SEQUENCE.length]
    const winner = PRIZES[prizeIndex]
    const resetIndex = 4 + ((spinsUsed + 1) % PRIZES.length)
    const targetIndex = 16 + prizeIndex

    setCopied(false)
    setSelectedPrize(null)
    setResultClaimed(false)
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
      setSelectedPrize(winner)
      setSpinsLeft((value) => Math.max(0, value - 1))
      setIsSpinning(false)
      setResultOpen(true)
      spinTimeoutRef.current = null
    }, ANIMATION_MS + 120)
  }

  function claimPrize() {
    if (!selectedPrize || resultClaimed) return

    setWonPrizes((items) => [
      { claimId: `${selectedPrize.id}-${Date.now()}`, prize: selectedPrize },
      ...items,
    ])
    setResultClaimed(true)
  }

  function continueAfterClaim() {
    setResultOpen(false)
    setSelectedPrize(null)
    setResultClaimed(false)
    setCopied(false)
  }

  async function copyPromoCode() {
    if (!selectedPrize?.code) return
    try {
      await navigator.clipboard.writeText(selectedPrize.code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  function resetDemo() {
    if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current)
    setSpinsLeft(5)
    setReelIndex(INITIAL_REEL_INDEX)
    setInstantMove(true)
    setIsSpinning(false)
    setSelectedPrize(null)
    setResultOpen(false)
    setResultClaimed(false)
    setInfoPanel(null)
    setWonPrizes([])
    setCopied(false)
  }

  const primaryButtonLabel = isSpinning
    ? "Лента крутится"
    : hasPendingPrize
      ? "Забрать приз"
      : spinsLeft > 0
        ? "Крутить бесплатно"
        : "Вращения закончились"

  return (
    <div className="pw-page">
      <div className="pw-stage">
        <header className="pw-header">
          <button className="pw-back-button" type="button" onClick={onBack} aria-label="Вернуться в админку">
            <ArrowLeft aria-hidden="true" />
            <span>В админку</span>
          </button>

          <div className="pw-brand">
            <span className="pw-brand-logo">05.RU</span>
            <span className="pw-brand-product">Колесо призов</span>
          </div>

          <div className="pw-spin-balance" aria-live="polite">
            <Gift aria-hidden="true" />
            <strong>{spinsLeft}</strong>
            <span>{spinsLeft === 1 ? "вращение" : spinsLeft > 1 && spinsLeft < 5 ? "вращения" : "вращений"}</span>
          </div>

          <nav className="pw-nav" aria-label="Разделы колеса призов">
            <button type="button" onClick={() => setInfoPanel("prizes")}>
              <Gift aria-hidden="true" />
              <span>Призы</span>
            </button>
            <button type="button" onClick={() => setInfoPanel("wins")}>
              <History aria-hidden="true" />
              <span>Мои призы</span>
              {wonPrizes.length > 0 ? <b>{wonPrizes.length}</b> : null}
            </button>
            <button type="button" onClick={() => setInfoPanel("rules")}>
              <TicketPercent aria-hidden="true" />
              <span>Правила игры</span>
            </button>
          </nav>
        </header>

        <main className="pw-main">
          <div className="pw-intro">
            <h1>Крутите ленту — каждый раз выигрывайте приз</h1>
            <p>Вам доступно пять бесплатных вращений. В ленте нет пустых секторов.</p>
          </div>

          <section className="pw-reel-shell" aria-label="Лента призов">
            <div className="pw-selector" aria-hidden="true">
              <ChevronDown />
            </div>
            <div className="pw-reel-viewport" ref={reelViewportRef}>
              <div
                className={`pw-reel-track${instantMove ? " pw-reel-track--instant" : ""}${trackReady ? " pw-reel-track--ready" : ""}`}
                style={{ transform: `translate3d(${trackX}px, 0, 0)` }}
              >
                {REEL_ITEMS.map((prize, index) => (
                  <article
                    className={`pw-reel-card${index === reelIndex ? " pw-reel-card--selected" : ""}`}
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
            {hasPendingPrize ? (
              <p className="pw-pending-note">
                <Sparkles aria-hidden="true" /> У вас есть незабранный приз
              </p>
            ) : null}
            <button
              className="pw-spin-button"
              type="button"
              onClick={beginSpin}
              disabled={isSpinning || (spinsLeft === 0 && !hasPendingPrize)}
            >
              {isSpinning ? <LoaderCircle className="pw-spinner" aria-hidden="true" /> : <Gift aria-hidden="true" />}
              <span>{primaryButtonLabel}</span>
            </button>
            <p className="pw-balance-caption">
              {spinsLeft > 0 ? `Останется после вращения: ${Math.max(0, spinsLeft - 1)}` : "Все бесплатные вращения использованы"}
            </p>
          </div>

          <p className="pw-legal">
            Нажимая «Крутить бесплатно», вы соглашаетесь с{" "}
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

              <div className="pw-result-image">
                <img src={selectedPrize.image} alt={selectedPrize.title} />
              </div>

              {resultClaimed && selectedPrize.kind === "promo" && selectedPrize.code ? (
                <div className="pw-code-box">
                  <span>Ваш индивидуальный промокод</span>
                  <div>
                    <strong>{selectedPrize.code}</strong>
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

              {!resultClaimed ? (
                <p className="pw-claim-note">Заберите приз в течение 7 дней. До получения нового приза вращение недоступно.</p>
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
            <DialogTitle>{activePanelTitle}</DialogTitle>
            <DialogDescription className="sr-only">Информация о механике колеса призов</DialogDescription>
          </DialogHeader>

          {infoPanel === "prizes" ? (
            <div className="pw-prize-list">
              {PRIZES.map((prize) => (
                <div key={prize.id}>
                  <img src={prize.image} alt="" />
                  <span>
                    <strong>{prize.title}</strong>
                    <small>{prize.kind === "bonus" ? "Бонусы" : "Индивидуальный промокод"}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {infoPanel === "wins" ? (
            <div className="pw-win-list">
              {hasPendingPrize && selectedPrize ? (
                <button type="button" onClick={() => { setInfoPanel(null); setResultOpen(true) }}>
                  <img src={selectedPrize.image} alt="" />
                  <span><strong>{selectedPrize.title}</strong><small>Ожидает получения</small></span>
                  <b>Забрать</b>
                </button>
              ) : null}
              {wonPrizes.map((item) => (
                <div key={item.claimId}>
                  <img src={item.prize.image} alt="" />
                  <span><strong>{item.prize.title}</strong><small>Получен</small></span>
                  <Check aria-label="Получен" />
                </div>
              ))}
              {!hasPendingPrize && wonPrizes.length === 0 ? (
                <div className="pw-empty-state">
                  <Gift aria-hidden="true" />
                  <strong>Здесь появятся ваши призы</strong>
                  <span>Крутите ленту — каждый раз в ней есть подарок.</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {infoPanel === "rules" ? (
            <div className="pw-rules">
              <p>Каждому авторизованному пользователю один раз доступны 5 бесплатных вращений.</p>
              <p>Каждое вращение гарантированно определяет один активный приз. Один и тот же приз может выпасть несколько раз.</p>
              <p>Выигранный приз нужно получить кнопкой «Забрать приз» в течение 7 дней. До получения нового приза следующее вращение недоступно.</p>
              <p>В MVP призами являются бонусы и промокоды. Вероятности выпадения пользователю не показываются.</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
