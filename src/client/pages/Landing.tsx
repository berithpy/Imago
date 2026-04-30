import { useEffect, useRef, useState, type FormEvent } from "react";
import { createT, useLocale, type Locale } from "@/client/lib/i18n";
import { Button } from "@/client/components/Button";
import { useAuth } from "@/client/lib/authContext";

const dict = {
  en: {
    nav_lang_en: "EN",
    nav_lang_es: "ES",
    nav_login: "Log in",
    nav_dashboard: "Dashboard",

    hero_tagline: "A simple hosted gallery service for photographers.",
    hero_subtagline:
      "Upload client work, share it with a password or email link, and let clients download their photos — without the friction of bigger platforms.",
    hero_cta: "Join the waitlist",
    hero_secondary: "See what you get",

    why_title: "Why Imago",
    why_body_1:
      "We built Imago because existing gallery platforms are either too expensive for what they deliver, or so feature-heavy that a simple client delivery becomes a chore for both the photographer and the client.",
    why_body_2:
      "Imago is a focused, affordable, easy-to-use gallery service that does the few things photographers actually need, and does them well.",

    what_title: "What you get",
    what_subtitle: "Built around how photographers actually deliver client work.",

    tab_galleries: "Private galleries",
    tab_galleries_body:
      "Each client gets their own gallery with a clean, fast viewer. No clutter, no upsells, no watermarks across their photos.",
    tab_galleries_point_1: "Custom slug per gallery",
    tab_galleries_point_2: "Banner image and event date",
    tab_galleries_point_3: "Soft-deletes and expiry dates",

    tab_sharing: "Flexible sharing",
    tab_sharing_body:
      "Pick the access model that fits the job: a shared password for the whole crew, or an email-only allow list for VIP clients.",
    tab_sharing_point_1: "Password-protected galleries",
    tab_sharing_point_2: "Email allow lists with magic-link sign-in",
    tab_sharing_point_3: "Public galleries when you want reach",

    tab_downloads: "Client downloads",
    tab_downloads_body:
      "Clients download in original quality — single photos or the whole gallery as a zip. No accounts to create, no app to install.",
    tab_downloads_point_1: "Original-quality JPEGs",
    tab_downloads_point_2: "Whole-gallery zip downloads",
    tab_downloads_point_3: "Optional email notifications when galleries update",

    tab_control: "You stay in control",
    tab_control_body:
      "Your galleries, your rules. Set expiry dates, soft-delete safely, and share clean previews when posting links elsewhere.",
    tab_control_point_1: "Soft-deletes you can recover",
    tab_control_point_2: "Per-gallery expiry dates",
    tab_control_point_3: "Link-preview cards for social posts",

    pricing_title: "Pricing",
    pricing_body:
      "Simple monthly pricing. We're finalising plans — join the waitlist and you'll hear from us with launch pricing first.",

    form_title: "Get notified at launch",
    form_body: "Drop your email. No spam, just a single message when we open up.",
    form_placeholder: "you@studio.com",
    form_submit: "Notify me",
    form_submitting: "Sending…",
    form_success: "Thanks — you're on the list. We'll be in touch.",
    form_already: "You're already on the list. We'll be in touch.",
    form_invalid: "Please enter a valid email address.",
    form_error: "Something went wrong. Please try again.",

    footer_contact: "Contact",
    footer_copy: "© Imago",
    footer_built_in: "Built in Paraguay by",
  },
  es: {
    nav_lang_en: "EN",
    nav_lang_es: "ES",
    nav_login: "Entrar",
    nav_dashboard: "Panel",

    hero_tagline: "Un servicio simple de galerías para fotógrafos.",
    hero_subtagline:
      "Subí el trabajo de tus clientes, compartilo con contraseña o enlace por email, y dejá que descarguen sus fotos — sin la fricción de las plataformas grandes.",
    hero_cta: "Sumate a la lista",
    hero_secondary: "Mirá qué incluye",

    why_title: "Por qué Imago",
    why_body_1:
      "Hicimos Imago porque las plataformas existentes son demasiado caras para lo que ofrecen, o tan llenas de funciones que entregar una galería simple se vuelve una molestia para el fotógrafo y para el cliente.",
    why_body_2:
      "Imago es un servicio enfocado, accesible y fácil de usar, que hace las pocas cosas que los fotógrafos realmente necesitan, y las hace bien.",

    what_title: "Qué incluye",
    what_subtitle: "Pensado para cómo los fotógrafos realmente entregan trabajo a sus clientes.",

    tab_galleries: "Galerías privadas",
    tab_galleries_body:
      "Cada cliente recibe su propia galería con un visor limpio y rápido. Sin desorden, sin ventas adicionales, sin marcas de agua sobre sus fotos.",
    tab_galleries_point_1: "Slug personalizado por galería",
    tab_galleries_point_2: "Imagen de portada y fecha del evento",
    tab_galleries_point_3: "Borrado suave y fechas de expiración",

    tab_sharing: "Compartir flexible",
    tab_sharing_body:
      "Elegí el modelo de acceso que mejor encaje: una contraseña compartida para todo el equipo, o una lista de emails permitidos para clientes VIP.",
    tab_sharing_point_1: "Galerías protegidas por contraseña",
    tab_sharing_point_2: "Listas de emails con acceso por enlace mágico",
    tab_sharing_point_3: "Galerías públicas cuando querés alcance",

    tab_downloads: "Descargas para el cliente",
    tab_downloads_body:
      "Los clientes descargan en calidad original — fotos sueltas o la galería entera en zip. Sin crear cuentas, sin instalar nada.",
    tab_downloads_point_1: "JPEGs en calidad original",
    tab_downloads_point_2: "Descarga de toda la galería en zip",
    tab_downloads_point_3: "Notificaciones por email opcionales al actualizar la galería",

    tab_control: "Vos tenés el control",
    tab_control_body:
      "Tus galerías, tus reglas. Definí fechas de expiración, borrá de forma segura y compartí previas limpias cuando posteás enlaces.",
    tab_control_point_1: "Borrado suave recuperable",
    tab_control_point_2: "Fechas de expiración por galería",
    tab_control_point_3: "Tarjetas de previa para posts en redes",

    pricing_title: "Precios",
    pricing_body:
      "Precio mensual simple. Estamos terminando de definir los planes — sumate a la lista y recibirás los precios de lanzamiento primero.",

    form_title: "Avisame en el lanzamiento",
    form_body: "Dejá tu email. Sin spam, solo un mensaje cuando abramos.",
    form_placeholder: "tu@estudio.com",
    form_submit: "Avisame",
    form_submitting: "Enviando…",
    form_success: "Gracias — estás en la lista. Te escribimos pronto.",
    form_already: "Ya estás en la lista. Te escribimos pronto.",
    form_invalid: "Por favor ingresá un email válido.",
    form_error: "Algo salió mal. Probá de nuevo.",

    footer_contact: "Contacto",
    footer_copy: "© Imago",
    footer_built_in: "Construido en Paraguay por",
  },
} as const;

const t = createT(dict);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; alreadyRegistered: boolean }
  | { kind: "error"; message: string };

type TabKey = "galleries" | "sharing" | "downloads" | "control";

const TAB_ORDER: TabKey[] = ["galleries", "sharing", "downloads", "control"];

// Hero tile aspect pattern (alternating portrait / square). The actual image
// for each slot is picked at runtime from /landing/hero-1.webp .. hero-13.webp.
const HERO_TILE_ASPECTS = [
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[4/5]",
  "aspect-square",
];
const HERO_IMAGE_COUNT = 13;
const HERO_TILE_COUNT = HERO_TILE_ASPECTS.length;

function pickHeroImages(): string[] {
  const pool = Array.from({ length: HERO_IMAGE_COUNT }, (_, i) => i + 1);
  // Fisher–Yates shuffle, then take the first HERO_TILE_COUNT.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, HERO_TILE_COUNT).map((n) => `/landing/hero-${n}.webp`);
}

// Inject the shimmer keyframes once. Tailwind v4 does not auto-generate
// @keyframes for arbitrary animation names, so we add it manually.
if (typeof document !== "undefined" && !document.getElementById("imago-shimmer-keyframes")) {
  const style = document.createElement("style");
  style.id = "imago-shimmer-keyframes";
  style.textContent =
    "@keyframes imago-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }";
  document.head.appendChild(style);
}

function HeroTile({ aspect, src }: { aspect: string; src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={`${aspect} relative overflow-hidden rounded-md bg-neutral-900 ring-1 ring-inset ring-white/5`}
    >
      {!loaded && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 bg-[length:200%_100%] animate-[imago-shimmer_1.5s_linear_infinite]"
        />
      )}
      <img
        src={src}
        alt=""
        loading="eager"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover select-none transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"
          }`}
      />
    </div>
  );
}

export function Landing() {
  const { locale, setLocale } = useLocale();
  const { auth, loading: authLoading } = useAuth();
  const formRef = useRef<HTMLDivElement | null>(null);
  const whatRef = useRef<HTMLDivElement | null>(null);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [activeTab, setActiveTab] = useState<TabKey>("galleries");
  // Pick once on mount so the order is stable for this page view.
  const [heroImages] = useState<string[]>(() => pickHeroImages());
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileCardRefs = useRef<Array<HTMLElement | null>>([]);
  const [mobileIndex, setMobileIndex] = useState(0);

  useEffect(() => {
    const root = mobileScrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const idx = mobileCardRefs.current.findIndex((el) => el === visible.target);
        if (idx >= 0) setMobileIndex(idx);
      },
      { root, threshold: [0.5, 0.75, 1] },
    );
    mobileCardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function scrollMobileTo(idx: number) {
    const card = mobileCardRefs.current[idx];
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const signedInHref = auth?.superAdmin
    ? "/operator"
    : auth?.memberships[0]
      ? `/${auth.memberships[0].tenantSlug}/manage`
      : "/login/resolve";
  const navHref = auth && !authLoading ? signedInHref : "/login";
  const navLabel = auth && !authLoading ? t(locale, "nav_dashboard") : t(locale, "nav_login");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setState({ kind: "error", message: t(locale, "form_invalid") });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        setState({ kind: "error", message: t(locale, "form_error") });
        return;
      }
      const data = (await res.json()) as { ok: boolean; alreadyRegistered?: boolean };
      setState({ kind: "success", alreadyRegistered: !!data.alreadyRegistered });
    } catch {
      setState({ kind: "error", message: t(locale, "form_error") });
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Top nav */}
      <header className="w-full border-b border-neutral-900">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
          <div className="text-xl font-semibold tracking-tight text-amber-400">Imago</div>
          <div className="flex items-center gap-4">
            <a
              href={navHref}
              className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              {navLabel}
            </a>
            <LocaleToggle locale={locale} onChange={setLocale} />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* Hero */}
        <section className="w-full max-w-6xl mx-auto px-6 sm:px-10 pt-14 sm:pt-20 pb-14 sm:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="flex flex-col gap-6">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight">
                {t(locale, "hero_tagline")}
              </h1>
              <p className="text-neutral-400 text-base sm:text-lg max-w-xl">
                {t(locale, "hero_subtagline")}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => scrollTo(formRef)}
                  analyticsId="landing_hero_cta"
                  className="px-5 py-3 rounded-lg hover:bg-amber-300"
                >
                  {t(locale, "hero_cta")}
                </Button>
                <button
                  type="button"
                  onClick={() => scrollTo(whatRef)}
                  className="px-5 py-3 bg-transparent text-neutral-200 font-semibold rounded-lg border border-neutral-800 hover:border-neutral-700 hover:text-neutral-100 transition-colors"
                >
                  {t(locale, "hero_secondary")}
                </button>
              </div>
            </div>

            {/* Hero mock gallery — 3 independent columns so tiles stack cleanly
                without row gaps between mismatched aspects. */}
            <div
              aria-hidden
              className="grid grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl"
            >
              {[0, 1, 2].map((col) => (
                <div key={col} className="flex flex-col gap-2 sm:gap-3">
                  <HeroTile
                    aspect={HERO_TILE_ASPECTS[col]}
                    src={heroImages[col]}
                  />
                  <HeroTile
                    aspect={HERO_TILE_ASPECTS[col + 3]}
                    src={heroImages[col + 3]}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why */}
        <section className="w-full border-t border-neutral-900 bg-neutral-950">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
            <div className="grid lg:grid-cols-3 gap-10 lg:gap-16 lg:items-center">
              <div className="lg:col-span-1">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  {t(locale, "why_title")}
                </h2>
              </div>
              <div className="lg:col-span-2 flex flex-col gap-4 text-neutral-400 text-base sm:text-lg">
                <p>{t(locale, "why_body_1")}</p>
                <p>{t(locale, "why_body_2")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* What you get — tabbed */}
        <section ref={whatRef} className="w-full border-t border-neutral-900">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
            <div className="flex flex-col gap-2 mb-8 sm:mb-10 sm:items-center sm:text-center">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                {t(locale, "what_title")}
              </h2>
              <p className="text-neutral-400">{t(locale, "what_subtitle")}</p>
            </div>

            {/* Mobile: swipeable carousel of cards */}
            <div className="sm:hidden -mx-6">
              <div
                ref={mobileScrollRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-6 px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {TAB_ORDER.map((key, i) => (
                  <article
                    key={key}
                    ref={(el) => {
                      mobileCardRefs.current[i] = el;
                    }}
                    className="snap-center shrink-0 w-[88%] flex flex-col gap-5 p-5 bg-neutral-900/50 border border-neutral-800 rounded-xl select-none"
                  >
                    <h3 className="text-xl font-semibold text-amber-300">
                      {t(locale, `tab_${key}` as const)}
                    </h3>
                    <p className="text-neutral-400 text-base">
                      {t(locale, `tab_${key}_body` as const)}
                    </p>
                    <ul className="flex flex-col gap-2 text-neutral-300 text-sm">
                      <li className="flex gap-2">
                        <Bullet />
                        {t(locale, `tab_${key}_point_1` as const)}
                      </li>
                      <li className="flex gap-2">
                        <Bullet />
                        {t(locale, `tab_${key}_point_2` as const)}
                      </li>
                      <li className="flex gap-2">
                        <Bullet />
                        {t(locale, `tab_${key}_point_3` as const)}
                      </li>
                    </ul>
                  </article>
                ))}
              </div>
              {/* Dots */}
              <div className="flex justify-center gap-2 mt-4" role="tablist" aria-label={t(locale, "what_title")}>
                {TAB_ORDER.map((key, i) => {
                  const isActive = mobileIndex === i;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={t(locale, `tab_${key}` as const)}
                      onClick={() => scrollMobileTo(i)}
                      className={`h-2 rounded-full transition-all ${isActive ? "w-6 bg-amber-400" : "w-2 bg-neutral-700"
                        }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Desktop: tab strip + single panel */}
            <div
              role="tablist"
              aria-label={t(locale, "what_title")}
              className="hidden sm:flex flex-wrap justify-center gap-2 mb-8 border-b border-neutral-900"
            >
              {TAB_ORDER.map((key) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(key)}
                    className={`px-4 py-2.5 text-sm font-semibold rounded-t-md border-b-2 transition-colors ${isActive
                      ? "text-amber-300 border-amber-400"
                      : "text-neutral-400 border-transparent hover:text-neutral-200"
                      }`}
                  >
                    {t(locale, `tab_${key}` as const)}
                  </button>
                );
              })}
            </div>

            {/* Tab panel (desktop only) */}
            <div
              role="tabpanel"
              key={activeTab}
              className="hidden sm:flex flex-col gap-5 max-w-2xl mx-auto p-6 sm:p-8 bg-neutral-900/50 border border-neutral-800 rounded-xl"
            >
              <h3 className="text-xl sm:text-2xl font-semibold text-amber-300">
                {t(locale, `tab_${activeTab}` as const)}
              </h3>
              <p className="text-neutral-400 text-base sm:text-lg">
                {t(locale, `tab_${activeTab}_body` as const)}
              </p>
              <ul className="flex flex-col gap-2 text-neutral-300">
                <li className="flex gap-2">
                  <Bullet />
                  {t(locale, `tab_${activeTab}_point_1` as const)}
                </li>
                <li className="flex gap-2">
                  <Bullet />
                  {t(locale, `tab_${activeTab}_point_2` as const)}
                </li>
                <li className="flex gap-2">
                  <Bullet />
                  {t(locale, `tab_${activeTab}_point_3` as const)}
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Pricing + Interest form side-by-side on lg */}
        <section className="w-full border-t border-neutral-900 bg-neutral-950">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 sm:p-8 flex flex-col gap-3">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  {t(locale, "pricing_title")}
                </h2>
                <p className="text-neutral-400 text-base sm:text-lg">
                  {t(locale, "pricing_body")}
                </p>
              </div>

              <div
                ref={formRef}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 sm:p-8 flex flex-col gap-4"
              >
                <h2 className="text-xl sm:text-2xl font-semibold text-neutral-100">
                  {t(locale, "form_title")}
                </h2>
                <p className="text-neutral-400 text-sm">{t(locale, "form_body")}</p>

                {state.kind === "success" ? (
                  <p
                    role="status"
                    className="px-4 py-3 bg-amber-400/10 border border-amber-400/40 rounded-lg text-amber-300 text-sm"
                  >
                    {state.alreadyRegistered
                      ? t(locale, "form_already")
                      : t(locale, "form_success")}
                  </p>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="flex flex-col sm:flex-row gap-3"
                  >
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (state.kind === "error") setState({ kind: "idle" });
                      }}
                      placeholder={t(locale, "form_placeholder")}
                      aria-label={t(locale, "form_placeholder")}
                      className="flex-1 px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-400"
                      disabled={state.kind === "submitting"}
                    />
                    <button
                      type="submit"
                      disabled={state.kind === "submitting"}
                      className="px-5 py-3 bg-amber-400 text-neutral-950 font-semibold rounded-lg border-0 hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {state.kind === "submitting"
                        ? t(locale, "form_submitting")
                        : t(locale, "form_submit")}
                    </button>
                  </form>
                )}

                {state.kind === "error" && (
                  <p role="alert" className="text-red-400 text-sm">
                    {state.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-neutral-900">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-6 flex flex-col sm:flex-row gap-3 sm:gap-6 items-center sm:justify-between text-sm text-neutral-500 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span>{t(locale, "footer_copy")}</span>
            <span className="hidden sm:inline text-neutral-700">·</span>
            <span>
              {t(locale, "footer_built_in")}{" "}
              <a
                href="https://berith.moe"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-300 hover:text-amber-300 underline-offset-2 hover:underline"
              >
                Diego
              </a>
            </span>
          </div>
          <a
            href="mailto:imago@berith.py"
            className="text-neutral-400 hover:text-amber-300"
          >
            {t(locale, "footer_contact")}
          </a>
        </div>
      </footer>
    </div>
  );
}

function Bullet() {
  return (
    <span
      aria-hidden
      className="mt-[0.6em] inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
    />
  );
}

function LocaleToggle({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (l: Locale) => void;
}) {
  const baseClass =
    "px-2.5 py-1 text-xs font-semibold rounded-md border border-neutral-800";
  const active = "bg-amber-400 text-neutral-950 border-amber-400";
  const inactive = "bg-transparent text-neutral-400 hover:text-neutral-100";
  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      <button
        type="button"
        onClick={() => onChange("en")}
        className={`${baseClass} ${locale === "en" ? active : inactive}`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange("es")}
        className={`${baseClass} ${locale === "es" ? active : inactive}`}
        aria-pressed={locale === "es"}
      >
        ES
      </button>
    </div>
  );
}