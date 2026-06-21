// ─────────────────────────────────────────────────────────────────────────────
// Amul Product Scraper — paste into Chrome DevTools console on shop.amul.com
// Prerequisites: set any pincode in the site UI first (e.g. 400001 - Mumbai)
// Output: downloads amul-products-YYYY-MM-DD.csv ready to import into Supabase
// ─────────────────────────────────────────────────────────────────────────────

(async function scrapeAmul() {
  const PAGE_SIZE   = 100   // max per request
  const STORE_ID    = '62fa94df8c13af2e242eba16'  // shop.amul.com StoreHippo store ID
  const SHOP_ORIGIN = 'https://shop.amul.com'

  // ── 1. Find the active substore ID (set when user picks a pincode) ──────────
  // StoreHippo stores it in localStorage under various keys depending on version
  const substoreId =
    localStorage.getItem('substore') ||
    localStorage.getItem('selectedSubstore') ||
    localStorage.getItem('substoredId') ||
    (() => {
      // Try finding it in any localStorage key that looks like a 24-char hex ID
      for (const [k, v] of Object.entries(localStorage)) {
        if (/substore/i.test(k) && /^[a-f0-9]{24}$/.test(v)) return v
      }
    })()

  if (!substoreId) {
    console.warn('[AmulScraper] Could not auto-detect substore ID. Set a pincode in the site UI first, then re-run.')
    return
  }

  console.log('[AmulScraper] Substore:', substoreId)

  // ── 2. Build request headers (browser sends cookies automatically) ──────────
  function getMsGa() {
    const m = document.cookie.match(/_ga=GA[\d.]+\.([\d.]+)/)
    return m ? m[1] : '0.0'
  }
  function makeTid() {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    return `${Date.now()}:${Math.floor(Math.random() * 9999)}:${hex}`
  }

  const HEADERS = {
    'accept':           'application/json, text/plain, */*',
    'accept-language':  'en-US,en;q=0.9',
    'base_url':         `${SHOP_ORIGIN}/en/`,
    'frontend':         '1',
    'ms-ga':            getMsGa(),
    'cache-control':    'no-cache',
    'pragma':           'no-cache',
  }

  // ── Image URL builder ────────────────────────────────────────────────────────
  function buildImageUrl(p) {
    const imgObj = p.images?.[0]
    if (!imgObj) return ''
    if (typeof imgObj === 'string') {
      return imgObj.startsWith('http') ? imgObj : `${SHOP_ORIGIN}/s/${STORE_ID}/${imgObj}`
    }
    // StoreHippo object form: { image: "fileId/filename.jpg" }
    // also check name/src/url as fallbacks
    const raw = imgObj.image || imgObj.name || imgObj.src || imgObj.url || ''
    if (!raw) return ''
    return raw.startsWith('http') ? raw : `${SHOP_ORIGIN}/s/${STORE_ID}/${raw}`
  }

  // ── Rarity + Points ───────────────────────────────────────────────────────────
  // Legendary (25 pts) — almost impossible to find outside select cities
  // Epic      (10 pts) — specialty / health / premium range
  // Rare      ( 5 pts) — supermarket but not corner-shop level
  // Uncommon  ( 3 pts) — common supermarket, not every kirana
  // Common    ( 1 pt)  — every kirana / general store in India
  function getRarity(name, category, price) {
    const n = (name + ' ' + category).toLowerCase()

    // Price tiers: very expensive products skew rarer
    if (price >= 2000) return { rarity_label: 'Legendary', points: 25 }
    if (price >= 800)  return { rarity_label: 'Epic',      points: 10 }

    if (/camel|isabcool|nolen gur|pan nawabi|rajwadi|mast khoa|kulhad|matka kulfi/.test(n))
      return { rarity_label: 'Legendary', points: 25 }

    if (/protein|organic|gourmet|cheddar|gouda|edam|emmental|feta|buffalo mozzarella|cream cheese|probiotic|sugar.free|lactose.free|less sugar|isabgol|caramel cookie|epic range|epic almond|epic choco|epic strawberry/.test(n))
      return { rarity_label: 'Epic', points: 10 }

    if (/shrikhand|mithai.mate|infant|paneer|ghee|cream cheese|garlic.*butter|choco.*butter|safed makkhan|unsalted butter|amul lite|cheese.*sauce|diced.*cheese|pizza cheese|spread|flavoured.*butter|khakhra|puffles|butter.cake|whole.wheat|atta|confection|honey|organic/.test(n) || price >= 400)
      return { rarity_label: 'Rare', points: 5 }

    if (/chocolate|choco|lassi|buttermilk|milkshake|smoothie|coffee|flavoured.milk|aerated|juice|cooler|malt|cookie|rusk|toast|bread|kulfi|tricone|stick|fundoo|novelty|party.pack|ice.malai|kesar|rajbhog|falooda|shalimar|cassata|gudbud/.test(n) || price >= 150)
      return { rarity_label: 'Uncommon', points: 3 }

    return { rarity_label: 'Common', points: 1 }
  }
  console.log('[AmulScraper] Fetching collections...')
  let collections = []
  try {
    const colResp = await fetch(
      `${SHOP_ORIGIN}/api/1/entity/ms.collections?fields[alias]=1&fields[name]=1&limit=200&start=0&substore=${substoreId}`,
      { headers: { ...HEADERS, tid: makeTid() } }
    )
    const colData = await colResp.json()
    collections = (colData?.data ?? []).map(c => c.alias).filter(Boolean)
    console.log('[AmulScraper] Collections found:', collections.length, collections)
  } catch(e) {
    console.warn('[AmulScraper] Could not fetch collections, will fetch all products directly:', e.message)
  }

  // ── 4. Paginate through all products (per collection if available) ───────────
  const FIELDS = [
    'name', 'alias', 'categories', 'collections',
    'images', 'brand', 'available', 'price',
  ].map(f => `fields[${f}]=1`).join('&')

  async function fetchPage(start, collectionAlias) {
    let url =
      `${SHOP_ORIGIN}/api/1/entity/ms.products` +
      `?${FIELDS}` +
      `&limit=${PAGE_SIZE}&start=${start}` +
      `&cdc=1m&device_type=other` +
      `&substore=${substoreId}`
    if (collectionAlias) {
      url += `&filters[0][field]=collections&filters[0][value][0]=${collectionAlias}&filters[0][operator]=in&filters[0][original]=1`
    }
    const resp = await fetch(url, { headers: { ...HEADERS, tid: makeTid() } })
    if (!resp.ok) throw new Error(`HTTP ${resp.status} (start=${start})`)
    return resp.json()
  }

  async function fetchAllForScope(collectionAlias) {
    let start = 0
    let fetched = 0
    while (true) {
      let data
      try {
        data = await fetchPage(start, collectionAlias)
      } catch (e) {
        console.error('[AmulScraper] Fetch error:', e.message)
        break
      }
      const items = data?.data ?? data?.products ?? []
      if (items.length === 0) break

      for (const p of items) {
        const key = p.alias || p.name
        if (!key || seen.has(key)) continue
        seen.add(key)

        const imgUrl  = buildImageUrl(p)

        // Category: slug like "camel-milk" → "Camel Milk"
        let categorySlug = ''
        const cat = p.categories?.[0]
        if (typeof cat === 'string')      categorySlug = cat
        else if (typeof cat === 'object') categorySlug = cat?.alias ?? cat?.name ?? cat?.title ?? ''
        const category = categorySlug
          .trim()
          .split('-')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')

        const availability = p.available === 1 || p.available === true ? 'in_stock' : 'out_of_stock'
        const { rarity_label, points } = getRarity(p.name ?? '', category, p.price ?? 0)

        allProducts.push({
          name:         (p.name ?? '').trim(),
          category,
          image_url:    imgUrl,
          source_url:   p.alias ? `${SHOP_ORIGIN}/en/product/${p.alias}` : '',
          status:       'pending',
          availability,
          rarity_label,
          points,
        })
        fetched++
      }

      start += PAGE_SIZE
      if (items.length < PAGE_SIZE) break
      await new Promise(r => setTimeout(r, 300))
    }
    return fetched
  }

  const allProducts = []
  const seen        = new Set()

  console.log('[AmulScraper] Fetching products...')

  if (collections.length > 0) {
    // Fetch per collection — bypasses the substore product limit
    for (const alias of collections) {
      const n = await fetchAllForScope(alias)
      console.log(`[AmulScraper] Collection "${alias}": +${n} new | total so far: ${allProducts.length}`)
      await new Promise(r => setTimeout(r, 300))
    }
    // Also do a global sweep to catch products not assigned to any collection
    console.log('[AmulScraper] Running global sweep for uncategorised products...')
    const globalN = await fetchAllForScope(null)
    console.log(`[AmulScraper] Global sweep: +${globalN} new | total: ${allProducts.length}`)
  } else {
    // No collections found — fall back to a single sweep
    await fetchAllForScope(null)
    console.log('[AmulScraper] Products collected:', allProducts.length)
  }

  if (allProducts.length === 0) {
    console.error('[AmulScraper] Got 0 products. The substore (' + substoreId + ') may not serve this area. Try setting a different pincode and re-running.')
    return
  }

  // ── 4. Build and download CSV ───────────────────────────────────────────────
  const COLS = ['name','category','image_url','source_url','status','availability','rarity_label','points']
  const esc  = v => `"${String(v ?? '').replace(/"/g, '""')}"`

  const csv = [
    COLS.join(','),
    ...allProducts.map(p => COLS.map(c => esc(p[c])).join(','))
  ].join('\n')

  const filename = `amul-products-${new Date().toISOString().slice(0, 10)}.csv`
  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a        = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(blob),
    download: filename,
  })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  console.log('[AmulScraper] Done!', allProducts.length, 'products saved to', filename)
  console.table(allProducts.slice(0, 5))
})()
