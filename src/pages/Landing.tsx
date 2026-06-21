import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Star,
  Map,
  Trophy,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Search,
  Heart,
  Crown,
  Medal,
  Award,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getDisplayProductName } from "@/lib/utils";
import { TIERS, getTier } from "@/types";

const RARITY_PILL: Record<string, string> = {
  Common: "bg-gray-100   text-gray-600   dark:bg-gray-800 dark:text-gray-400",
  Uncommon:
    "bg-green-100  text-green-700  dark:bg-green-900/40 dark:text-green-400",
  Rare: "bg-blue-100   text-blue-700   dark:bg-blue-900/40 dark:text-blue-400",
  Epic: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  Legendary:
    "bg-amber-100  text-amber-700  dark:bg-amber-900/40 dark:text-amber-400",
};

// Static badge showcase (seeded slugs always present)
const BADGE_SHOWCASE = [
  { icon: "🎉", name: "First Try", desc: "Try your first product" },
  { icon: "🧭", name: "Explorer", desc: "Try 5+ products" },
  { icon: "👑", name: "Legendary Hunter", desc: "Try a 5-pt product" },
  { icon: "🧀", name: "Cheese Head", desc: "Try 3 cheese products" },
  { icon: "🍦", name: "Ice Cream Fanatic", desc: "Try 5 ice cream items" },
  { icon: "🏆", name: "Completionist", desc: "Clear a whole category" },
];

const FEATURES = [
  {
    icon: Search,
    title: "Discover obscure products",
    desc: "Browse a curated catalogue of niche, regional, and discontinued Amul items you never knew existed.",
  },
  {
    icon: Heart,
    title: "Build your bucket list",
    desc: "Save products you want to try. Mark them as tried when you find them. Watch your list shrink.",
  },
  {
    icon: Star,
    title: "Earn points & climb tiers",
    desc: "Every product you try earns points based on rarity. Legendary finds? That's 5 points.",
  },
  {
    icon: Trophy,
    title: "Compete on the leaderboard",
    desc: "Race against other Amul fans to become the top Amul Legend in India.",
  },
  {
    icon: Award,
    title: "Unlock badges",
    desc: "15+ badges to earn — from First Try to Completionist. How many can you unlock?",
  },
  {
    icon: Map,
    title: "Track availability",
    desc: "Know if a product is Pan India, regional, seasonal, or discontinued before you hunt.",
  },
  {
    icon: Sparkles,
    title: "Suggest new products",
    desc: "Found something weird at your local dairy? Submit it and get credit when it's approved.",
  },
];

// ── Count-up stat ──────────────────────────────────────────
function CountUpStat({
  to,
  duration = 1200,
}: {
  to: number;
  duration?: number;
}) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || to === 0) return;
    started.current = true;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(eased * to));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [to, duration]);
  return <>{val}</>;
}

export default function Landing() {
  const { session, isLoading } = useAuth();

  // Live leaderboard data — fetched once, no auth required (public table)
  const [topUsers, setTopUsers] = useState<
    { id: string; username: string; total_points: number }[]
  >([]);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [previewProducts, setPreviewProducts] = useState<
    Array<{
      id: string;
      name: string;
      category: string | null;
      points: number | null;
      rarity_label: string | null;
      image_url: string | null;
    }>
  >([]);
  const [lbLoading, setLbLoading] = useState(true);

  useEffect(() => {
    async function fetchLive() {
      const { data, error } = await supabase.rpc('get_landing_page_data');
      if (!error && data) {
        setTopUsers(data.top_users);
        setUserCount(data.user_count);
        setProductCount(data.product_count);
        setPreviewProducts(data.preview_products);
      }

      setLbLoading(false);
    }
    void fetchLive();
  }, []);

  // Redirect logged-in users to dashboard
  if (!isLoading && session) return <Navigate to="/dashboard" replace />;

  return (
    <div className="overflow-x-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative px-4 pb-20 pt-16 sm:pt-24 text-center">
        {/* Background blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-32 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-amul-red/8 blur-3xl" />
          <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-amul-gold/10 blur-3xl" />
          <div className="absolute top-60 -left-24 h-56 w-56 rounded-full bg-amul-red/6 blur-2xl" />
        </div>

        <div className="relative mx-auto max-w-3xl">
          {/* Badge */}
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-amul-red/20 bg-amul-red/5 px-3.5 py-1.5 text-xs font-medium text-amul-red">
            <span>🐄</span>
            India's weirdest Amul product tracker
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-[hsl(var(--foreground))] sm:text-5xl lg:text-6xl">
            How many Amul products
            <br />
            <span className="text-amul-red">have you actually tried?</span>
          </h1>
          <p className="mt-3 text-2xl font-black sm:text-3xl">
            <span className="gradient-text">Amul Paglu</span> — track your
            obsession.
          </p>

          <p className="mx-auto mt-5 max-w-xl text-base text-[hsl(var(--muted-foreground))] sm:text-lg">
            Amul makes{" "}
            <strong className="text-[hsl(var(--foreground))]">
              {productCount ? `${productCount}+` : "500+"} products
            </strong>
            . Most people know 10. Track your journey from <em>Milk Drinker</em>{" "}
            to <em>Amul Legend</em> — one obscure find at a time.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-amul-red px-6 py-3 text-sm font-semibold text-white shadow-amul transition-all hover:bg-amul-red-dark hover:shadow-lg active:scale-[0.98]"
            >
              Start exploring <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-3 text-sm font-semibold text-[hsl(var(--foreground))] transition-all hover:bg-[hsl(var(--muted))]"
            >
              Sign in
            </Link>
          </div>

          {/* Social proof */}
          <p className="mt-5 text-xs text-[hsl(var(--muted-foreground))]">
            {userCount ? (
              <>
                Join{" "}
                <strong className="text-[hsl(var(--foreground))]">
                  {userCount}
                </strong>{" "}
                Amul fanatics already tracking their obsession · Free forever
              </>
            ) : (
              <>Inspired by r/AmulPagalHoChukaHai · Free forever</>
            )}
          </p>
        </div>

        {/* ── Floating product card strip ─────────────────── */}
        <div className="relative mx-auto mt-14 max-w-5xl">
          {/* Fade edges */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[hsl(var(--background))] to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[hsl(var(--background))] to-transparent"
          />

          <div className="flex gap-4 overflow-hidden px-4">
            {/* Triplicated for seamless infinite marquee */}
            <div className="flex gap-4 animate-[marquee_28s_linear_infinite] shrink-0">
              {(previewProducts.length > 0
                ? [...previewProducts, ...previewProducts, ...previewProducts]
                : []
              ).map((p, i) => (
                <div
                  key={i}
                  className="w-44 shrink-0 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-card"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--muted))]">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">🐄</span>
                    )}
                  </div>
                  <p className="mb-1 text-xs font-semibold leading-snug text-[hsl(var(--foreground))] line-clamp-2">
                    {getDisplayProductName(p.name)}
                  </p>
                  <p className="mb-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                    {p.category}
                  </p>
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${RARITY_PILL[p.rarity_label ?? "Common"] ?? RARITY_PILL.Common}`}
                    >
                      {p.rarity_label}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-amul-gold">
                      {"⭐".repeat(p.points ?? 1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--card))] py-8">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-6 px-4 text-center sm:grid-cols-3">
          {[
            {
              value: productCount ?? 0,
              suffix: "+",
              label: "Amul products",
              fallback: "500+",
            },
            { value: 5, suffix: "", label: "Rarity tiers", fallback: "5" },
            {
              value: userCount ?? 0,
              suffix: "+",
              label: "Amul hunters",
              fallback: "…",
            },
          ].map(({ value, suffix, label, fallback }) => (
            <div key={label}>
              <p className="stat-number font-display text-3xl font-bold text-amul-red sm:text-4xl">
                {value > 0 ? (
                  <>
                    <CountUpStat to={value} />
                    {suffix}
                  </>
                ) : (
                  fallback
                )}
              </p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live Leaderboard ────────────────────────────────── */}
      <section className="px-4 py-16 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <span className="mb-3 inline-block rounded-full border border-amul-gold/30 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              🏆 Live rankings
            </span>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Who's the top <span className="text-amul-red">Amul Legend?</span>
            </h2>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              Real-time rankings — no sign-in needed to see them.
            </p>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-card overflow-hidden">
            {lbLoading ? (
              <div className="divide-y divide-[hsl(var(--border))]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-[hsl(var(--muted))] animate-pulse" />
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[hsl(var(--muted))] animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-32 rounded bg-[hsl(var(--muted))] animate-pulse" />
                      <div className="h-3 w-20 rounded bg-[hsl(var(--muted))] animate-pulse" />
                    </div>
                    <div className="h-5 w-12 rounded bg-[hsl(var(--muted))] animate-pulse" />
                  </div>
                ))}
              </div>
            ) : topUsers.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                No hunters yet — be the first! 🐄
              </p>
            ) : (
              <div className="divide-y divide-[hsl(var(--border))]">
                {topUsers.map((u, i) => {
                  const tier = getTier(u.total_points);
                  const rankIcon =
                    i === 0 ? (
                      <Crown size={14} className="text-amul-gold" />
                    ) : i === 1 ? (
                      <Medal size={14} className="text-slate-400" />
                    ) : i === 2 ? (
                      <Trophy size={14} className="text-orange-400" />
                    ) : null;
                  return (
                    <Link
                      key={u.id}
                      to={`/profile/${u.username}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[hsl(var(--muted))]/50 active:bg-[hsl(var(--muted))]"
                    >
                      {/* Rank */}
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs font-bold text-[hsl(var(--muted-foreground))]">
                        {rankIcon ?? i + 1}
                      </div>
                      {/* Avatar */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amul-red/10 text-sm font-bold text-amul-red">
                        {u.username[0].toUpperCase()}
                      </div>
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">
                          {u.username}
                        </p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {tier.emoji} {tier.label}
                        </p>
                      </div>
                      {/* Points */}
                      <span className="shrink-0 text-sm font-bold text-amul-gold">
                        {u.total_points} pts
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 text-center">
            <Link
              to="/leaderboard"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amul-red hover:underline underline-offset-2"
            >
              View full leaderboard <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features grid ───────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Everything you need to become an
              <span className="text-amul-red"> Amul Legend</span>
            </h2>
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))] sm:text-base">
              Track, discover, and compete — all in one place.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }, idx) => (
              <div
                key={title}
                className={`group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-card transition-all duration-200 hover:shadow-card-lg`}
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amul-red/10 text-amul-red transition-colors group-hover:bg-amul-red group-hover:text-white">
                  <Icon size={20} />
                </div>
                <h3 className="mb-2 font-semibold text-[hsl(var(--foreground))]">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tiers showcase ──────────────────────────────────── */}
      <section className="bg-[hsl(var(--card))] px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Your journey, ranked
            </h2>
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
              Earn points for every product you try. Rarer products = more
              points.
            </p>
          </div>

          <div className="space-y-3">
            {TIERS.map((tier, i) => {
              const isLast = i === TIERS.length - 1;
              const ptLabel = isLast
                ? `${tier.minPoints}+ pts`
                : `${tier.minPoints}–${tier.maxPoints} pts`;
              const widths = ["w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"];
              return (
                <div
                  key={tier.label}
                  className="flex items-center gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3"
                >
                  <span className="text-2xl">{tier.emoji}</span>
                  <div className="flex-1">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                        {tier.label}
                      </span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {ptLabel}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                      <div
                        className={`h-full rounded-full bg-amul-red ${widths[i]}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
            Points are based on product rarity — Common (1pt) → Legendary (5pts)
          </p>
        </div>
      </section>

      {/* ── Badge Showcase ──────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <span className="mb-3 inline-block rounded-full border border-amber-300/40 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              🏅 Achievements
            </span>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Collect <span className="text-amul-red">badges</span> as you
              explore
            </h2>
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
              15+ badges waiting to be unlocked. Each one a milestone in your
              Amul journey.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {BADGE_SHOWCASE.map((b) => (
              <div
                key={b.name}
                className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-card"
              >
                <span className="text-3xl leading-none">{b.icon}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[hsl(var(--foreground))]">
                    {b.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
            …and many more to discover once you start exploring.
          </p>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center font-display text-2xl font-bold sm:text-3xl">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Sign up free",
                desc: "Create an account in 30 seconds. No credit card, no ads.",
              },
              {
                step: "02",
                title: "Browse & add",
                desc: "Explore the product catalogue. Add what you want to try to your list.",
              },
              {
                step: "03",
                title: "Try & earn points",
                desc: "Mark products as tried. Earn points. Climb the leaderboard.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amul-red/10 font-display text-lg font-bold text-amul-red">
                  {step}
                </div>
                <h3 className="mb-2 font-semibold text-[hsl(var(--foreground))]">
                  {title}
                </h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-2xl rounded-3xl bg-amul-red px-8 py-14 text-center shadow-amul">
          <p className="mb-2 text-sm font-medium text-white/70">
            Ready to find out?
          </p>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            How Paglu are you?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-white/80">
            Join other Amul enthusiasts tracking down the most obscure dairy
            products in India.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-amul-red shadow-lg transition-all hover:bg-amul-cream active:scale-[0.98]"
            >
              Create free account <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
            >
              Already have an account
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/70">
            {["Free forever", "No spam", "No tracking"].map((t) => (
              <li key={t} className="flex items-center gap-1">
                <CheckCircle2 size={12} /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-[hsl(var(--border))] px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
        <p className="font-display font-bold text-sm text-amul-red mb-1">
          🐄 Amul Paglu
        </p>
        <p>
          Not affiliated with Amul / GCMMF. Fan project. All product names
          belong to their respective owners.
        </p>
        <p className="mt-3">
          Built with ❤️ by{" "}
          <a
            href="https://www.linkedin.com/in/skolpekwar"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-amul-red"
          >
            Sumit Kolpekwar
          </a>
          {" · "}
          <a
            href="https://github.com/skolpekwar"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-amul-red"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
