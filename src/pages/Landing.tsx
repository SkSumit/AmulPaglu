import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Star,
  Trophy,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Search,
  Heart,
  Crown,
  Medal,
  Award,
  Package,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getDisplayProductName } from "@/lib/utils";
import { ProductImage } from "@/components/products/ProductImage";
import { TIERS, getTier } from "@/types";
import logo from "@/assets/logo.png";
import tiersBg from "@/assets/tiers_bg.png";
import leaderboardBg from "@/assets/leaderboard_bg.png";
import badgesBg from "@/assets/badges_bg.png";
import { RARITY_PILL } from "@/lib/constants";
import { CountUp } from "@/components/ui/CountUp";

// FEATURES list for homepage cards

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
    desc: "Race against other Amul fans to become the top Amul Paglu in India.",
  },
  {
    icon: Award,
    title: "Unlock badges",
    desc: "15+ badges to earn — from First Try to Completionist. How many can you unlock?",
  },
  {
    icon: Sparkles,
    title: "Suggest new products",
    desc: "Found something weird at your local dairy? Submit it and get credit when it's approved.",
  },
];


export default function Landing() {
  const { session, isLoading } = useAuth();

  // Live leaderboard data — fetched once, no auth required (public table)
  const [topUsers, setTopUsers] = useState<
    { id: string; username: string; total_points: number; is_admin?: boolean }[]
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
  const [allBadges, setAllBadges] = useState<
    Array<{ icon: string; name: string; description: string }>
  >([]);
  const [tierCounts, setTierCounts] = useState<Record<string, number> | null>(null);
  const [lbLoading, setLbLoading] = useState(true);

  useEffect(() => {
    async function fetchLive() {
      const { data, error } = await supabase.rpc('get_landing_page_data');
      if (!error && data) {
        setTopUsers(data.top_users);
        setUserCount(data.user_count);
        setProductCount(data.product_count);
        setPreviewProducts(data.preview_products);
        setTierCounts(data.tier_counts);
        setAllBadges(data.all_badges || []);
      }

      setLbLoading(false);
    }
    void fetchLive();
  }, []);

  // Scroll-reveal observer
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [lbLoading])

  // Redirect logged-in users to dashboard
  if (!isLoading && session) return <Navigate to="/dashboard" replace />;

  const fallbackBadges = [
    { icon: "🎉", name: "First Try", description: "Try your first product" },
    { icon: "🧭", name: "Explorer", description: "Try 5+ products" },
    { icon: "👑", name: "Legendary Hunter", description: "Try a 5-pt product" },
    { icon: "🧀", name: "Cheese Head", description: "Try 3 cheese products" },
    { icon: "🍦", name: "Ice Cream Fanatic", description: "Try 5 ice cream items" },
    { icon: "🏆", name: "Completionist", description: "Clear a whole category" },
  ];

  const displayedBadges = allBadges.length > 0 ? allBadges.slice(0, 6) : fallbackBadges;
  const remainingBadgesCount = allBadges.length > 0 ? (allBadges.length - displayedBadges.length) : 15;

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

        {/* Top Hero Section: Logo left, Headline right */}
        <div className="relative mx-auto max-w-5xl grid gap-12 lg:grid-cols-12 items-center text-center lg:text-left">
          {/* Left Column: Floating Mascot & Glowing product card */}
          <div className="lg:col-span-5 flex justify-center items-center relative h-80 lg:h-[450px] w-full order-last lg:order-first">
            {/* Mascot Image (Floating) */}
            <div className="relative z-20 animate-float select-none pointer-events-none">
              <img
                src={logo}
                alt="Amul Paglu Mascot"
                className="h-60 w-auto object-contain lg:h-72"
              />
            </div>

            {/* Glowing Product Card */}
            <div className="absolute top-1/2 left-1/2 -translate-x-6 -translate-y-16 lg:-translate-x-10 lg:-translate-y-24 z-10 w-40 rounded-2xl border-2 border-amul-gold bg-[hsl(var(--card))] p-3.5 shadow-[0_0_30px_rgba(255,215,0,0.3)] rotate-[12deg] transition-all hover:rotate-[6deg] hover:scale-105">
              {/* Product Image / Badge */}
              <div className="relative aspect-square w-full rounded-xl bg-amul-gold/5 flex items-center justify-center overflow-hidden">
                <span className="text-4xl">🧈</span>
                <span className="absolute top-1 right-1 rounded-full bg-amul-gold px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                  Legendary
                </span>
              </div>

              {/* Product Info */}
              <div className="mt-3 text-left">
                <h3 className="text-xs font-bold text-[hsl(var(--foreground))]">Amul Garlic Butter</h3>
                <p className="text-[10px] text-amul-gold font-bold mt-0.5">5 Points</p>
              </div>
            </div>

            {/* Subtle background glow effect behind the card */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-44 w-44 rounded-full bg-amul-gold/15 blur-3xl z-0 pointer-events-none" />
          </div>

          {/* Right Column: Badge & Headline */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start justify-center">
            {/* Badge as a Link */}
            <a
              href="https://www.reddit.com/r/AmulPagalHoChukaHai/"
              target="_blank"
              rel="noopener noreferrer"
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-amul-red/20 bg-amul-red/5 px-3.5 py-1.5 text-xs font-semibold text-amul-red transition-all hover:bg-amul-red/10 active:scale-95 shadow-sm"
            >
              <svg viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0">
                <circle cx="400" cy="400" fill="#ff4500" r="400" />
                <path d="M666.8 400c.08 5.48-.6 10.95-2.04 16.24s-3.62 10.36-6.48 15.04c-2.85 4.68-6.35 8.94-10.39 12.65s-8.58 6.83-13.49 9.27c.11 1.46.2 2.93.25 4.4a107.268 107.268 0 0 1 0 8.8c-.05 1.47-.14 2.94-.25 4.4 0 89.6-104.4 162.4-233.2 162.4S168 560.4 168 470.8c-.11-1.46-.2-2.93-.25-4.4a107.268 107.268 0 0 1 0-8.8c.05-1.47.14-2.94.25-4.4a58.438 58.438 0 0 1-31.85-37.28 58.41 58.41 0 0 1 7.8-48.42 58.354 58.354 0 0 1 41.93-25.4 58.4 58.4 0 0 1 46.52 15.5 286.795 286.795 0 0 1 35.89-20.71c12.45-6.02 25.32-11.14 38.51-15.3s26.67-7.35 40.32-9.56 27.45-3.42 41.28-3.63L418 169.6c.33-1.61.98-3.13 1.91-4.49.92-1.35 2.11-2.51 3.48-3.4 1.38-.89 2.92-1.5 4.54-1.8 1.61-.29 3.27-.26 4.87.09l98 19.6c9.89-16.99 30.65-24.27 48.98-17.19s28.81 26.43 24.71 45.65c-4.09 19.22-21.55 32.62-41.17 31.61-19.63-1.01-35.62-16.13-37.72-35.67L440 186l-26 124.8c13.66.29 27.29 1.57 40.77 3.82a284.358 284.358 0 0 1 77.8 24.86A284.412 284.412 0 0 1 568 360a58.345 58.345 0 0 1 29.4-15.21 58.361 58.361 0 0 1 32.95 3.21 58.384 58.384 0 0 1 25.91 20.61A58.384 58.384 0 0 1 666.8 400zm-396.96 55.31c2.02 4.85 4.96 9.26 8.68 12.97 3.71 3.72 8.12 6.66 12.97 8.68A40.049 40.049 0 0 0 306.8 480c16.18 0 30.76-9.75 36.96-24.69 6.19-14.95 2.76-32.15-8.68-43.59s-28.64-14.87-43.59-8.68c-14.94 6.2-24.69 20.78-24.69 36.96 0 5.25 1.03 10.45 3.04 15.31zm229.1 96.02c2.05-2 3.22-4.73 3.26-7.59.04-2.87-1.07-5.63-3.07-7.68s-4.73-3.22-7.59-3.26c-2.87-.04-5.63 1.07-7.94 2.8a131.06 131.06 0 0 1-19.04 11.35 131.53 131.53 0 0 1-20.68 7.99c-7.1 2.07-14.37 3.54-21.72 4.39-7.36.85-14.77 1.07-22.16.67-7.36.33-14.77.03-22.11-.89a129.01 129.01 0 0 1-21.64-4.6c-7.08-2.14-13.95-4.88-20.56-8.18s-12.93-7.16-18.89-11.53c-2.07-1.7-4.7-2.57-7.38-2.44s-5.21 1.26-7.11 3.15c-1.89 1.9-3.02 4.43-3.15 7.11s.74 5.31 2.44 7.38c7.03 5.3 14.5 9.98 22.33 14s16 7.35 24.4 9.97 17.01 4.51 25.74 5.66c8.73 1.14 17.54 1.53 26.33 1.17 8.79.36 17.6-.03 26.33-1.17A153.961 153.961 0 0 0 476.87 564c7.83-4.02 15.3-8.7 22.33-14zm-7.34-68.13c5.42.06 10.8-.99 15.81-3.07 5.01-2.09 9.54-5.17 13.32-9.06s6.72-8.51 8.66-13.58A39.882 39.882 0 0 0 532 441.6c0-16.18-9.75-30.76-24.69-36.96-14.95-6.19-32.15-2.76-43.59 8.68s-14.87 28.64-8.68 43.59c6.2 14.94 20.78 24.69 36.96 24.69z" fill="#fff" />
              </svg>
              Inspired by subreddit r/AmulPagalHoChukaHai
            </a>

            {/* Headline */}
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-[hsl(var(--foreground))] sm:text-5xl lg:text-6xl">
              How many Amul products
              <br />
              <span className="text-amul-red">have you actually tried?</span>
            </h1>
          </div>
        </div>

        {/* Bottom Hero Section: Description, CTAs, Subreddit Info */}
        <div className="relative mx-auto mt-16 max-w-3xl text-center">
          <p className="text-2xl font-bold sm:text-3xl text-black dark:text-white">
            Amul Paglu — track your <a href="https://www.imdb.com/title/tt37287335/" target="_blank" rel="noopener noreferrer" className="text-amul-red underline decoration-wavy decoration-2 decoration-amul-red/60 hover:decoration-amul-red transition-colors">obsession</a>.
          </p>

          <p className="mx-auto mt-5 max-w-2xl text-base text-[hsl(var(--muted-foreground))] sm:text-lg">
            Amul makes{" "}
            <strong className="text-[hsl(var(--foreground))]">
              {productCount ? `${productCount}+` : "156+"} products
            </strong>
            . Most people know 10. Track your journey from <em>Lactose Trainee</em>{" "}
            to <em>Amul Paglu</em> — one obscure find at a time.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-amul-red px-6 py-3 text-sm font-semibold text-white shadow-amul transition-all hover:bg-amul-red-dark hover:shadow-lg active:scale-[0.98]"
            >
              Start Pagluing <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-3 text-sm font-semibold text-[hsl(var(--foreground))] transition-all hover:bg-[hsl(var(--muted))]"
            >
              Sign in
            </Link>
          </div>
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
                    <ProductImage
                      src={p.image_url}
                      name={p.name}
                      className="h-full w-full object-cover"
                      size="xs"
                    />
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
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          size={9}
                          className={j < (p.points ?? 1) ? 'text-amul-gold fill-amul-gold' : 'text-gray-300 dark:text-gray-600 fill-none'}
                        />
                      ))}
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
        <div className="reveal mx-auto grid max-w-4xl grid-cols-1 sm:grid-cols-3 gap-6 px-4 text-center">
          {[
            {
              value: productCount ?? 0,
              suffix: "+",
              label: "Amul products",
              fallback: "156+",
              icon: <Package className="h-5 w-5 text-amul-red" />,
              iconBg: "bg-amul-red/10 dark:bg-red-950/30",
              gradient: "from-amul-red to-red-500",
            },
            {
              value: 5,
              suffix: "",
              label: "Rarity tiers",
              fallback: "5",
              icon: <Award className="h-5 w-5 text-amul-gold" />,
              iconBg: "bg-amul-gold/10 dark:bg-amber-950/30",
              gradient: "from-amul-gold to-amber-600",
            },
            {
              value: userCount ?? 0,
              suffix: "+",
              label: "Amul Paglus",
              fallback: "3+",
              icon: <Users className="h-5 w-5 text-blue-500" />,
              iconBg: "bg-blue-500/10 dark:bg-blue-950/30",
              gradient: "from-blue-600 to-indigo-500",
            },
          ].map(({ value, suffix, label, fallback, icon, iconBg, gradient }) => (
            <div key={label} className="flex items-center justify-center gap-3 text-left">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                {icon}
              </div>
              <div>
                <p className={`stat-number font-display text-2xl font-bold sm:text-3xl bg-gradient-to-r ${gradient} bg-clip-text text-transparent inline-block`}>
                  {value > 0 ? (
                    <>
                      <CountUp to={value} />
                      {suffix}
                    </>
                  ) : (
                    fallback
                  )}
                </p>
                <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live Leaderboard ────────────────────────────────── */}
      <section className="px-4 py-16 bg-[hsl(var(--background))] overflow-hidden">
        <div className="mx-auto max-w-5xl">
          {/* Grid Layout: rankings left, mascot right */}
          <div className="grid gap-8 lg:grid-cols-12 items-center">
            {/* Left: Rankings Table */}
            <div className="lg:col-span-7">
              {/* Section Header */}
              <div className="reveal mb-8 text-center lg:text-left">
                <span className="mb-3 inline-block rounded-full border border-amul-gold/30 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                  🏆 Live rankings
                </span>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">
                  Who's the top <span className="text-amul-red">Amul Paglu?</span>
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
                            <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))] flex flex-wrap items-center gap-2">
                              <span>{u.username}</span>
                              {u.is_admin && (
                                <span className="rounded-full bg-amul-red/5 border border-amul-red/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amul-red uppercase shrink-0">
                                  Creator
                                </span>
                              )}
                              {u.username === 'blah_blah' && (
                                <span className="rounded-full bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 px-2 py-0.5 text-[9px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase shrink-0">
                                  Amul Girl
                                </span>
                              )}
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

              <div className="mt-4 text-center lg:text-left">
                <Link
                  to="/leaderboard"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-amul-red hover:underline underline-offset-2"
                >
                  View full leaderboard <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* Right: Mascot */}
            <div className="lg:col-span-5 flex justify-center items-center">
              <div className="relative select-none pointer-events-none animate-float">
                <img
                  src={leaderboardBg}
                  alt="Leaderboard Mascot"
                  className="h-72 w-auto object-contain max-w-[240px] lg:max-w-full drop-shadow-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features grid ───────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="reveal mb-12 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Everything you need to become an
              <span className="text-amul-red"> Amul Paglu</span>
            </h2>
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))] sm:text-base">
              Track, discover, and compete — all in one place.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }, idx) => (
              <div
                key={title}
                className="reveal group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-card transition-all duration-200 hover:shadow-card-lg"
                style={{ animationDelay: `${idx * 80}ms` }}
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
      <section className="bg-[hsl(var(--card))] px-4 py-20 overflow-hidden">
        <div className="mx-auto max-w-5xl">
          {/* Section Header */}
          <div className="reveal mb-10 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Your journey, ranked
            </h2>
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
              Earn points for every product you try. Rarer products = more points.
            </p>
          </div>

          {/* Grid Layout: tiers left, mascot right */}
          <div className="grid gap-8 lg:grid-cols-12 items-center">
            {/* Left: Tiers List */}
            <div className="lg:col-span-7 space-y-3">
              {TIERS.map((tier, i) => {
                const isLast = i === TIERS.length - 1;
                const ptLabel = isLast
                  ? `${tier.minPoints}+ pts`
                  : `${tier.minPoints}–${tier.maxPoints} pts`;
                const widths = ["w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"];
                const count = tierCounts ? (tierCounts[tier.label] ?? 0) : 0;
                return (
                  <div
                    key={tier.label}
                    className="reveal flex items-center gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span className="text-2xl">{tier.emoji}</span>
                    <div className="flex-1">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-sm font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                          {tier.label}
                          {tierCounts && (
                            <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
                              {count} user{count !== 1 ? "s" : ""}
                            </span>
                          )}
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

              <p className="mt-6 text-center lg:text-left text-xs text-[hsl(var(--muted-foreground))]">
                Points are based on product rarity — Common (1pt) → Legendary (5pts)
              </p>
            </div>

            {/* Right: Mascot */}
            <div className="lg:col-span-5 flex justify-center items-center">
              <div className="relative select-none pointer-events-none animate-float">
                <img
                  src={tiersBg}
                  alt="Tiers Mascot"
                  className="h-72 w-auto object-contain max-w-[240px] lg:max-w-full drop-shadow-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Badge Showcase ──────────────────────────────────── */}
      <section className="px-4 py-20 overflow-hidden">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-12 items-center">
            {/* Left: Mascot */}
            <div className="lg:col-span-5 flex justify-center items-center order-last lg:order-first">
              <div className="relative select-none pointer-events-none animate-float">
                <img
                  src={badgesBg}
                  alt="Badges Mascot"
                  className="h-72 w-auto object-contain max-w-[240px] lg:max-w-full drop-shadow-xl"
                />
              </div>
            </div>

            {/* Right: Badges Grid & Header */}
            <div className="lg:col-span-7">
              <div className="reveal mb-10 text-center lg:text-left">
                <span className="mb-3 inline-block rounded-full border border-amber-300/40 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                  🏅 Achievements
                </span>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">
                  Collect <span className="text-amul-red">badges</span> as you explore
                </h2>
                <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
                  15+ badges waiting to be unlocked. Each one a milestone in your Amul journey.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {displayedBadges.map((b, i) => (
                  <div
                    key={b.name}
                    title={b.description}
                    className="reveal group/badge flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-card transition-all duration-200 hover:shadow-card-lg hover:-translate-y-0.5 hover:border-amul-red/20 cursor-help"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span className="text-3xl leading-none transition-transform duration-200 group-hover/badge:scale-110 shrink-0">{b.icon}</span>
                    <div className="min-w-0 text-left w-full">
                      <p className="font-semibold text-xs sm:text-sm text-[hsl(var(--foreground))] leading-tight break-words" title={b.name}>
                        {b.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-center lg:text-left text-xs text-[hsl(var(--muted-foreground))]">
                {remainingBadgesCount > 0 
                  ? `…and ${remainingBadgesCount} more to discover once you start exploring.`
                  : "…and many more to discover once you start exploring."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="reveal mb-10 text-center font-display text-2xl font-bold sm:text-3xl">
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
            ].map(({ step, title, desc }, i) => (
              <div key={step} className="reveal text-center" style={{ animationDelay: `${i * 100}ms` }}>
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
        <div className="reveal mx-auto max-w-2xl rounded-3xl bg-amul-red px-8 py-14 text-center shadow-amul">
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
        <div className="flex items-center justify-center gap-1 font-display font-bold text-sm text-amul-red mb-1">
          <img src={logo} alt="Amul Paglu Logo" className="h-6 w-6 object-contain" />
          <span>Amul Paglu</span>
        </div>
        <p>
          Not affiliated with Amul / GCMMF. Fan project. All product names
          belong to their respective owners.
        </p>
        <p className="mt-3">
          Built with 🧈 by{" "}
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
