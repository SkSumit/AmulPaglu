import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SHOP_ORIGIN = "https://shop.amul.com"
const STORE_ID    = "62fa94df8c13af2e242eba16"
const PAGE_SIZE   = 100

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS })
  }

  let logId: string | null = null

  try {
    // ── Check authorization & permissions (Admins Only) ──────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" }
      })
    }

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    // Verify token identity using anon client
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" }
      })
    }

    // Check admin flag using service role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (profileErr || !profile || !profile.is_admin) {
      return new Response(JSON.stringify({ error: "Access denied. Admins only." }), {
        status: 403,
        headers: { ...CORS, "Content-Type": "application/json" }
      })
    }

    // ── Parse request payload ────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    logId = body.logId ?? null
    const cookie = body.cookie ?? ""

    // ── Load existing product images to prevent duplicate crawls ──────────────
    const { data: existing, error: fetchErr } = await adminClient
      .from("products")
      .select("image_url")
    if (fetchErr) throw fetchErr

    const seenImages = new Set<string>(
      (existing ?? []).map((p) => p.image_url).filter(Boolean) as string[]
    )
    const existingCount = seenImages.size

    // ── Set up request headers ───────────────────────────────────────────────
    const HEADERS: Record<string, string> = {
      "Accept": "application/json, text/plain, */*",
      "User-Agent": BROWSER_UA,
      "base_url": `${SHOP_ORIGIN}/en/`,
      "frontend": "1",
      "ms-ga": "0.0",
      "cache-control": "no-cache",
      "pragma": "no-cache",
    }
    if (cookie) {
      HEADERS["cookie"] = cookie
    }

    function makeTid() {
      const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      return `${Date.now()}:${Math.floor(Math.random() * 9999)}:${hex}`
    }

    // ── Fetch unique substores from pincodes directory ──────────────────────
    if (logId) {
      await adminClient
        .from("scrape_logs")
        .update({
          status: "running",
          log_detail: { phase: "Fetching all regional substores from pincodes..." }
        })
        .eq("id", logId)
    }

    const uniqueSubstores = new Set<string>()
    // Add default baseline substore ID
    uniqueSubstores.add("62fa94df8c13af2e242eba16")

    let pincodeStart = 0
    const PINCODE_LIMIT = 500
    while (true) {
      try {
        const pinUrl = `${SHOP_ORIGIN}/api/1/entity/pincode?limit=${PINCODE_LIMIT}&start=${pincodeStart}&cf_cache=1h`
        const pinResp = await fetch(pinUrl, { headers: { ...HEADERS, tid: makeTid() } })
        if (!pinResp.ok) break
        const pinData = await pinResp.json()
        const records = pinData?.data ?? pinData?.records ?? []
        if (records.length === 0) break

        for (const rec of records) {
          if (rec.substore) {
            uniqueSubstores.add(String(rec.substore).trim())
          }
        }
        
        pincodeStart += PINCODE_LIMIT
        if (records.length < PINCODE_LIMIT) break
      } catch (e) {
        console.error(`[AmulScraper] Error fetching pincodes: ${e.message}`)
        break
      }
    }

    const substoresList = Array.from(uniqueSubstores)
    console.log(`[AmulScraper] Found ${substoresList.length} unique regional substores:`, substoresList)

    // ── Fetch Products (Paginated) ───────────────────────────────────────────
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

    const allProducts: ScrapedProduct[] = []
    const seen = new Set<string>()

    function buildImageUrl(p: any) {
      const imgObj = p.images?.[0]
      if (!imgObj) return ""
      if (typeof imgObj === "string") {
        return imgObj.startsWith("http") ? imgObj : `${SHOP_ORIGIN}/s/${STORE_ID}/${imgObj}`
      }
      const raw = imgObj.image || imgObj.name || imgObj.src || imgObj.url || ""
      if (!raw) return ""
      return raw.startsWith("http") ? raw : `${SHOP_ORIGIN}/s/${STORE_ID}/${raw}`
    }

    function getRarity(name: string, category: string, price: number) {
      const n = (name + " " + category).toLowerCase()

      if (price >= 2000) return { rarity_label: "Legendary", points: 5 }
      if (price >= 800)  return { rarity_label: "Epic",      points: 4 }

      if (/camel|isabcool|nolen gur|pan nawabi|rajwadi|mast khoa|kulhad|matka kulfi/.test(n))
        return { rarity_label: "Legendary", points: 5 }

      if (/protein|organic|gourmet|cheddar|gouda|edam|emmental|feta|buffalo mozzarella|cream cheese|probiotic|sugar.free|lactose.free|less sugar|isabgol|caramel cookie|epic range|epic almond|epic choco|epic strawberry/.test(n))
        return { rarity_label: "Epic", points: 4 }

      if (/shrikhand|mithai.mate|infant|paneer|ghee|cream cheese|garlic.*butter|choco.*butter|safed makkhan|unsalted butter|amul lite|cheese.*sauce|diced.*cheese|pizza cheese|spread|flavoured.*butter|khakhra|puffles|butter.cake|whole.wheat|atta|confection|honey|organic/.test(n) || price >= 400)
        return { rarity_label: "Rare", points: 3 }

      if (/chocolate|choco|lassi|buttermilk|milkshake|smoothie|coffee|flavoured.milk|aerated|juice|cooler|malt|cookie|rusk|toast|bread|kulfi|tricone|stick|fundoo|novelty|party.pack|ice.malai|kesar|rajbhog|falooda|shalimar|cassata|gudbud/.test(n) || price >= 150)
        return { rarity_label: "Uncommon", points: 2 }

      return { rarity_label: "Common", points: 1 }
    }

    const FIELDS = [
      "name", "alias", "categories", "collections",
      "images", "brand", "available", "price",
    ].map(f => `fields[${f}]=1`).join("&")

    async function fetchPage(start: number, sub: string) {
      const url =
        `${SHOP_ORIGIN}/api/1/entity/ms.products` +
        `?${FIELDS}` +
        `&limit=${PAGE_SIZE}&start=${start}` +
        `&cdc=1m&device_type=other` +
        `&substore=${sub}`
      const resp = await fetch(url, { headers: { ...HEADERS, tid: makeTid() } })
      if (!resp.ok) throw new Error(`HTTP ${resp.status} (start=${start})`)
      return resp.json()
    }

    async function fetchAllForSubstore(sub: string) {
      let start = 0
      let fetched = 0
      while (true) {
        let data
        try {
          data = await fetchPage(start, sub)
        } catch (e) {
          console.error(`[AmulScraper] Fetch error: ${e.message}`)
          break
        }
        const items = data?.data ?? data?.products ?? []
        if (items.length === 0) break

        for (const p of items) {
          const key = p.alias || p.name
          if (!key || seen.has(key)) continue
          seen.add(key)

          const imgUrl = buildImageUrl(p)
          if (!imgUrl || seenImages.has(imgUrl)) continue
          seenImages.add(imgUrl)

          // Category formatting
          let categorySlug = ""
          const cat = p.categories?.[0]
          if (typeof cat === "string") categorySlug = cat
          else if (typeof cat === "object") categorySlug = cat?.alias ?? cat?.name ?? cat?.title ?? ""
          
          let category = "Other"
          if (categorySlug) {
            category = categorySlug
              .trim()
              .split("-")
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ")
          }

          const availability = p.available === 1 || p.available === true ? "Pan India" : "Discontinued"
          const { rarity_label, points } = getRarity(p.name ?? "", category, p.price ?? 0)

          allProducts.push({
            name: (p.name ?? "").trim(),
            category,
            image_url: imgUrl,
            source_url: p.alias ? `${SHOP_ORIGIN}/en/product/${p.alias}` : "",
            status: "pending",
            availability,
            rarity_label,
            points,
          })
          fetched++
        }

        start += PAGE_SIZE
        if (items.length < PAGE_SIZE) break
        // Small throttle
        await new Promise(r => setTimeout(r, 100))
      }
      return fetched
    }

    // Run regional scraping sweeps
    let substoreIdx = 0
    for (const sub of substoresList) {
      substoreIdx++
      if (logId) {
        await adminClient
          .from("scrape_logs")
          .update({
            log_detail: {
              phase: `Scraping region ${substoreIdx}/${substoresList.length} (${sub})`,
              regions_scraped: substoreIdx,
              regions_total: substoresList.length,
              products_collected: allProducts.length,
              source: "shop.amul.com JSON API Storefront",
            }
          })
          .eq("id", logId)
      }
      await fetchAllForSubstore(sub)
      await new Promise(r => setTimeout(r, 100))
    }

    // ── Insert new products into Supabase ─────────────────────────────────────
    if (allProducts.length > 0) {
      if (logId) {
        await adminClient
          .from("scrape_logs")
          .update({
            log_detail: {
              phase: `Inserting ${allProducts.length} new products into database...`,
              regions_scraped: substoresList.length,
              regions_total: substoresList.length,
              products_collected: allProducts.length,
              source: "shop.amul.com JSON API Storefront",
            }
          })
          .eq("id", logId)
      }
      const { error: insertErr } = await adminClient
        .from("products")
        .insert(allProducts)
      if (insertErr) throw insertErr
    }

    const totalFound = existingCount + allProducts.length

    // ── Update Scrape Log ────────────────────────────────────────────────────
    if (logId) {
      await adminClient
        .from("scrape_logs")
        .update({
          status: "success",
          products_found: totalFound,
          new_products: allProducts.length,
          log_detail: {
            phase: "Scrape completed successfully",
            already_in_db: existingCount,
            new_added: allProducts.length,
            regions_scraped: substoresList.length,
            source: "shop.amul.com JSON API Storefront",
          },
        })
        .eq("id", logId)
    }

    return new Response(
      JSON.stringify({ ok: true, found: totalFound, added: allProducts.length }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[AmulScraper] Error: ${message}`)

    if (logId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        const supabase = createClient(supabaseUrl, serviceRoleKey)
        await supabase
          .from("scrape_logs")
          .update({ status: "failed", log_detail: { error: message } })
          .eq("id", logId)
      } catch { /* ignore secondary failure */ }
    }

    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    )
  }
})
