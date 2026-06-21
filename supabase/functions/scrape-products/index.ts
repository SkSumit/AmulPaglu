// supabase/functions/scrape-products/index.ts
// Deno Edge Function — scrapes all Amul products from www.amul.com category pages
//
// Why amul.com and not shop.amul.com:
//   shop.amul.com's sitemap only lists 1 product — all others are pincode-gated
//   and hidden behind client-side JS. amul.com is server-rendered and contains
//   the full national catalog (300+ products across ~30 categories).
//
// How it works:
//  1. Fetch ~30 category pages from www.amul.com in batches of 8 (concurrent)
//  2. From each page, extract product name (img alt) + image URL (img src)
//     for any <img> whose src matches the amul-cms-bucket S3 CDN pattern
//  3. Deduplicate by image_url (same product can appear in multiple categories)
//  4. Skip products whose image_url is already in the DB
//  5. Insert new products as status='pending' (admin reviews before going live)
//  6. Update the scrape_log row with the final counts
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
// by the Supabase runtime — no manual secrets needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL  = "https://www.amul.com"
const BATCH_SIZE = 8  // concurrent category fetches per round

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// All categories from https://www.amul.com/product-listing-page
const CATEGORIES: { slug: string; name: string }[] = [
  { slug: "butter",           name: "Butter" },
  { slug: "cheese",           name: "Cheese" },
  { slug: "ice-cream",        name: "Ice Cream" },
  { slug: "milk",             name: "Milk" },
  { slug: "ghee",             name: "Ghee" },
  { slug: "curd-and-yogurt",  name: "Curd & Yogurt" },
  { slug: "paneer",           name: "Paneer" },
  { slug: "cream",            name: "Cream" },
  { slug: "milk-powder",      name: "Milk Powder" },
  { slug: "shrikhand",        name: "Shrikhand" },
  { slug: "mithai-mate",      name: "Mithai Mate" },
  { slug: "infant-nutrition", name: "Infant Nutrition" },
  { slug: "chocolates",       name: "Chocolates" },
  { slug: "sweets",           name: "Sweets" },
  { slug: "organic",          name: "Organic" },
  { slug: "protein",          name: "Protein" },
  { slug: "ready-in-minutes", name: "Ready in Minutes" },
  { slug: "malt-beverages",   name: "Beverages" },
  { slug: "buttermilk",       name: "Beverages" },
  { slug: "lassi",            name: "Beverages" },
  { slug: "coffee",           name: "Beverages" },
  { slug: "milkshake",        name: "Beverages" },
  { slug: "flavoured-milk",   name: "Beverages" },
  { slug: "smoothies",        name: "Beverages" },
  { slug: "aerated-drinks",   name: "Beverages" },
  { slug: "juices",           name: "Beverages" },
  { slug: "coolers",          name: "Beverages" },
  { slug: "cookies",          name: "Cookies & Biscuits" },
  { slug: "butter-cakes",     name: "Baked Goods" },
  { slug: "khakhra",          name: "Cookies & Biscuits" },
  { slug: "toast",            name: "Cookies & Biscuits" },
  { slug: "rusk",             name: "Cookies & Biscuits" },
  { slug: "puffles",          name: "Snacks" },
  { slug: "breads",           name: "Breads" },
  { slug: "spreads",          name: "Spreads" },
  { slug: "honey",            name: "Honey" },
  { slug: "confectionery",    name: "Confectionery" },
  { slug: "whole-wheat-atta", name: "Atta & Flour" },
  { slug: "health",           name: "Health" },
]

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS })
  }

  let logId: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    logId = body.logId ?? null

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase       = createClient(supabaseUrl, serviceRoleKey)

    // ── 1. Load existing image_urls so we can skip already-known products ─────
    const { data: existing, error: fetchErr } = await supabase
      .from("products")
      .select("image_url")
    if (fetchErr) throw fetchErr

    // seenImages tracks both DB-existing and within-run duplicates
    const seenImages = new Set<string>(
      (existing ?? []).map((p) => p.image_url).filter(Boolean) as string[]
    )
    const existingCount = seenImages.size

    // ── 2. Scrape each category page (in batches to avoid overwhelming) ───────
    type ScrapedProduct = {
      name:         string
      category:     string
      image_url:    string
      source_url:   string
      status:       string
      availability: string
      rarity_label: string
      points:       number
    }

    const newProducts: ScrapedProduct[] = []
    const debug: Record<string, { status: number; htmlLen: number; imgTags: number; added: number; hasNextData: boolean; hasProductImage: boolean; htmlHead: string; err?: string }> = {}

    for (let i = 0; i < CATEGORIES.length; i += BATCH_SIZE) {
      const batch = CATEGORIES.slice(i, i + BATCH_SIZE)

      const batchResults = await Promise.all(
        batch.map(async ({ slug, name: categoryName }) => {
          const pageUrl  = `${BASE_URL}/${slug}`
          const products: ScrapedProduct[] = []

          try {
            const resp = await fetch(pageUrl, {
              headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
              signal: AbortSignal.timeout(15_000),
            })

            if (!resp.ok) {
              debug[slug] = { status: resp.status, htmlLen: 0, imgTags: 0, added: 0, hasNextData: false, hasProductImage: false, htmlHead: "", err: `HTTP ${resp.status}` }
              return products
            }

            const html = await resp.text()
            const hasNextData      = html.includes("__NEXT_DATA__")
            const hasProductImage  = html.includes("productImage")
            const hasAmulCms       = html.includes("amul-cms-bucket")

            // ── Strategy A: extract from __NEXT_DATA__ JSON (most reliable) ───
            if (hasNextData) {
              const ndMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/)
              if (ndMatch) {
                try {
                  const nextData = JSON.parse(ndMatch[1])
                  // Walk JSON tree to find arrays that look like product lists
                  collectProducts(nextData, categoryName, pageUrl, seenImages, products)
                } catch { /* fall through to strategy B */ }
              }
            }

            // ── Strategy B: regex img tags (fallback) ─────────────────────────
            if (products.length === 0 && hasAmulCms) {
              const IMG_RE = /<img\b[^>]*amul-cms-bucket[^>]*>/gi
              let m: RegExpExecArray | null
              let tagCount = 0
              while ((m = IMG_RE.exec(html)) !== null) {
                tagCount++
                const tag  = m[0]
                const srcM = tag.match(/\bsrc=["']([^"']+)["']/)
                const altM = tag.match(/\balt=["']([^"']*)["']/)
                if (!srcM) continue

                let imageUrl = srcM[1]
                // Unwrap Next.js /_next/image?url= proxy
                const proxyM = imageUrl.match(/[?&]url=([^&"']+)/)
                if (proxyM) {
                  try { imageUrl = decodeURIComponent(proxyM[1]) } catch { continue }
                }
                if (!imageUrl.includes("productImage")) continue

                const productName = altM?.[1]?.trim() ?? ""
                if (!productName || productName === "Image" || productName.length < 2 || seenImages.has(imageUrl)) continue
                seenImages.add(imageUrl)
                products.push({ name: productName, category: categoryName, image_url: imageUrl, source_url: pageUrl, status: "pending", availability: "Pan India", rarity_label: "Common", points: 1 })
              }
            }

            debug[slug] = {
              status:          resp.status,
              htmlLen:         html.length,
              imgTags:         products.length,
              added:           products.length,
              hasNextData,
              hasProductImage,
              // First 400 chars of HTML — reveals if it's a block/captcha page
              htmlHead:        html.slice(0, 400).replace(/\s+/g, " "),
            }
          } catch (e) {
            debug[slug] = { status: 0, htmlLen: 0, imgTags: 0, added: 0, hasNextData: false, hasProductImage: false, htmlHead: "", err: String(e) }
          }

          return products
        })
      )

      for (const list of batchResults) newProducts.push(...list)
    }

    // ── 3. Insert new products ────────────────────────────────────────────────
    if (newProducts.length > 0) {
      const { error: insertErr } = await supabase
        .from("products")
        .insert(newProducts)
      if (insertErr) throw insertErr
    }

    const totalFound = existingCount + newProducts.length

    // ── 4. Update scrape log ──────────────────────────────────────────────────
    if (logId) {
      await supabase
        .from("scrape_logs")
        .update({
          status:         "success",
          products_found: totalFound,
          new_products:   newProducts.length,
          log_detail: {
            already_in_db:      existingCount,
            new_added:          newProducts.length,
            categories_scraped: CATEGORIES.length,
            source:             "www.amul.com category pages",
            per_category:       debug,
          },
        })
        .eq("id", logId)
    }

    return new Response(
      JSON.stringify({ ok: true, found: totalFound, added: newProducts.length, per_category: debug }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (logId) {
      try {
        const supabaseUrl    = Deno.env.get("SUPABASE_URL")!
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        const supabase       = createClient(supabaseUrl, serviceRoleKey)
        await supabase
          .from("scrape_logs")
          .update({ status: "error", log_detail: { error: message } })
          .eq("id", logId)
      } catch { /* ignore secondary failure */ }
    }

    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    )
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

type ScrapedProduct = {
  name: string; category: string; image_url: string; source_url: string
  status: string; availability: string; rarity_label: string; points: number
}

/**
 * Recursively walk a Next.js __NEXT_DATA__ JSON tree looking for product-like
 * objects (have both a name/title string and an image URL pointing to the CDN).
 */
function collectProducts(
  node:         unknown,
  categoryName: string,
  pageUrl:      string,
  seenImages:   Set<string>,
  out:          ScrapedProduct[],
  depth = 0,
): void {
  if (depth > 10 || node === null || typeof node !== "object") return

  if (Array.isArray(node)) {
    for (const item of node) collectProducts(item, categoryName, pageUrl, seenImages, out, depth + 1)
    return
  }

  const obj = node as Record<string, unknown>

  // Check if this object looks like a product
  const nameVal  = obj.name ?? obj.title ?? obj.productName ?? obj.product_name
  const imgVal   = obj.image ?? obj.imageUrl ?? obj.image_url ?? obj.img ?? obj.thumbnail ?? obj.src

  if (typeof nameVal === "string" && typeof imgVal === "string") {
    const name = nameVal.trim()
    let   img  = imgVal

    // Unwrap Next.js proxy if needed
    const proxyM = img.match(/[?&]url=([^&"']+)/)
    if (proxyM) { try { img = decodeURIComponent(proxyM[1]) } catch { img = "" } }

    if (
      name.length > 1 &&
      img.includes("productImage") &&
      !seenImages.has(img)
    ) {
      seenImages.add(img)
      out.push({ name, category: categoryName, image_url: img, source_url: pageUrl, status: "pending", availability: "Pan India", rarity_label: "Common", points: 1 })
      return // don't recurse further into this object
    }
  }

  // Recurse into all object values
  for (const val of Object.values(obj)) {
    collectProducts(val, categoryName, pageUrl, seenImages, out, depth + 1)
  }
}
