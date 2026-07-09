// ─────────────────────────────────────────────────────────────────────────────
// Amul Product Scraper — paste into Chrome DevTools console on shop.amul.com
// Output: downloads amul-products-YYYY-MM-DD.csv ready to import into Supabase
// ─────────────────────────────────────────────────────────────────────────────

(async function scrapeAmul() {
  const PAGE_SIZE   = 100   // max per request
  const STORE_ID    = '62fa94df8c13af2e242eba16'  // shop.amul.com StoreHippo store ID
  const SHOP_ORIGIN = 'https://shop.amul.com'

  // Styles for console formatting
  const logStyle = 'color: #38bdf8; font-weight: bold;'      // cyan
  const successStyle = 'color: #4ade80; font-weight: bold;'  // green
  const warnStyle = 'color: #fbbf24; font-weight: bold;'     // gold
  const errorStyle = 'color: #f87171; font-weight: bold;'    // red

  console.warn('%c🚀 [AmulScraper] Starting multi-region scrape...', logStyle)

  // ── 1. Build request headers ──────────────────────────────────────────────
  function getMsGa() {
    const m = document.cookie.match(/_ga=GA[\d.]+\.([\d.]+)/)
    return m ? m[1] : '0.0'
  }
  function makeTid() {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
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

  // ── 2. Fetch all pincodes to extract unique substores ──────────────────────
  let pincodes = []
  let pincodeStart = 0
  const PINCODE_LIMIT = 500

  while (true) {
    console.warn(`%c📡 [AmulScraper] Fetching pincodes start=${pincodeStart}...`, logStyle)
    try {
      const pinResp = await fetch(
        `${SHOP_ORIGIN}/entity/pincode?limit=${PINCODE_LIMIT}&start=${pincodeStart}&cf_cache=1h`,
        { headers: { ...HEADERS, tid: makeTid() } }
      )
      if (!pinResp.ok) {
        console.error(`%c❌ [AmulScraper] Pincode fetch failed: HTTP ${pinResp.status}`, errorStyle)
        break
      }
      const pinData = await pinResp.json()
      const records = pinData?.data ?? pinData?.records ?? []
      if (records.length === 0) break
      
      pincodes.push(...records)
      pincodeStart += PINCODE_LIMIT
      
      console.warn(`%c  └─ Loaded ${records.length} pincodes. Total loaded: ${pincodes.length}`, successStyle)
      if (records.length < PINCODE_LIMIT) break
      await new Promise(r => setTimeout(r, 200))
    } catch(e) {
      console.error(`%c❌ [AmulScraper] Pincode fetch error: ${e.message}`, errorStyle)
      break
    }
  }

  console.warn(`%c📊 [AmulScraper] Fetched ${pincodes.length} total pincode records from directory.`, successStyle)

  const uniqueSubstores = new Set()
  // Add default baseline substore ID
  uniqueSubstores.add('62fa94df8c13af2e242eba16')
  
  // Track how many pincodes map to each substore
  const substoreFrequency = {}
  substoreFrequency['62fa94df8c13af2e242eba16'] = 0 // baseline placeholder

  for (const rec of pincodes) {
    if (rec.substore) {
      const sub = String(rec.substore).trim()
      uniqueSubstores.add(sub)
      substoreFrequency[sub] = (substoreFrequency[sub] || 0) + 1
    }
  }
  
  const substoresList = Array.from(uniqueSubstores)
  console.warn(`%c🔍 [AmulScraper] Discovered ${substoresList.length} unique regional substores:`, warnStyle)
  for (const sub of substoresList) {
    const pinCount = substoreFrequency[sub] ?? 0
    console.warn(`%c  └─ Region: "${sub}" serves ${pinCount} listed pincodes`, logStyle)
  }

  // ── Image URL builder ────────────────────────────────────────────────────────
  function buildImageUrl(p) {
    const imgObj = p.images?.[0]
    if (!imgObj) return ''
    let raw = ''
    if (typeof imgObj === 'string') {
      raw = imgObj
    } else {
      raw = imgObj.image || imgObj.name || imgObj.src || imgObj.url || ''
    }
    if (!raw) return ''
    if (raw.startsWith('http')) return raw

    let clean = raw.startsWith('/') ? raw.slice(1) : raw
    if (clean.startsWith('s/')) {
      return `${SHOP_ORIGIN}/${clean}`
    }
    return `${SHOP_ORIGIN}/s/${STORE_ID}/${clean}`
  }

  // ── Rarity + Points ───────────────────────────────────────────────────────────
  // Legendary (5 pts) — database check constraint allows 1 to 5 points
  function getRarity(name, category, price) {
    const n = (name + ' ' + category).toLowerCase()

    // Price tiers: very expensive products skew rarer
    if (price >= 2000) return { rarity_label: 'Legendary', points: 5 }
    if (price >= 800)  return { rarity_label: 'Epic',      points: 4 }

    if (/camel|isabcool|nolen gur|pan nawabi|rajwadi|mast khoa|kulhad|matka kulfi/.test(n))
      return { rarity_label: 'Legendary', points: 5 }

    if (/protein|organic|gourmet|cheddar|gouda|edam|emmental|feta|buffalo mozzarella|cream cheese|probiotic|sugar.free|lactose.free|less sugar|isabgol|caramel cookie|epic range|epic almond|epic choco|epic strawberry/.test(n))
      return { rarity_label: 'Epic', points: 4 }

    if (/shrikhand|mithai.mate|infant|paneer|ghee|cream cheese|garlic.*butter|choco.*butter|safed makkhan|unsalted butter|amul lite|cheese.*sauce|diced.*cheese|pizza cheese|spread|flavoured.*butter|khakhra|puffles|butter.cake|whole.wheat|atta|confection|honey|organic/.test(n) || price >= 400)
      return { rarity_label: 'Rare', points: 3 }

    if (/chocolate|choco|lassi|buttermilk|milkshake|smoothie|coffee|flavoured.milk|aerated|juice|cooler|malt|cookie|rusk|toast|bread|kulfi|tricone|stick|fundoo|novelty|party.pack|ice.malai|kesar|rajbhog|falooda|shalimar|cassata|gudbud/.test(n) || price >= 150)
      return { rarity_label: 'Uncommon', points: 2 }

    return { rarity_label: 'Common', points: 1 }
  }

  // ── 3. Crawl products from all substores ────────────────────────────────────
  const FIELDS = [
    'name', 'alias', 'categories', 'collections',
    'images', 'brand', 'available', 'price',
  ].map(f => `fields[${f}]=1`).join('&')

  const allProducts = []
  const seen        = new Set()
  let cumulativeScanned = 0
  const regionBreakdown = {}

  async function fetchPage(start, substoreId) {
    let url =
      `${SHOP_ORIGIN}/api/1/entity/ms.products` +
      `?${FIELDS}` +
      `&limit=${PAGE_SIZE}&start=${start}` +
      `&cdc=1m&device_type=other` +
      `&substore=${substoreId}`
    const resp = await fetch(url, { headers: { ...HEADERS, tid: makeTid() } })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return resp.json()
  }

  async function fetchAllForSubstore(substoreId) {
    let start = 0
    let fetched = 0
    while (true) {
      let data
      try {
        data = await fetchPage(start, substoreId)
      } catch (e) {
        console.error(`%c❌ [AmulScraper] Product fetch error for region "${substoreId}" start=${start}: ${e.message}`, errorStyle)
        break
      }
      const items = data?.data ?? data?.products ?? []
      if (items.length === 0) break

      cumulativeScanned += items.length

      for (const p of items) {
        const key = p.alias || p.name
        if (!key || seen.has(key)) continue
        seen.add(key)

        const imgUrl  = buildImageUrl(p)

        // Category formatting
        let categorySlug = ''
        const cat = p.categories?.[0]
        if (typeof cat === 'string')      categorySlug = cat
        else if (typeof cat === 'object') categorySlug = cat?.alias ?? cat?.name ?? cat?.title ?? ''
        
        let category = 'Other'
        if (categorySlug) {
          category = categorySlug
            .trim()
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        }

        const availability = p.available === 1 || p.available === true ? 'Pan India' : 'Discontinued'
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
      await new Promise(r => setTimeout(r, 150))
    }
    return fetched
  }

  // Iterate regions
  for (let idx = 0; idx < substoresList.length; idx++) {
    const sub = substoresList[idx]
    console.warn(`%c🔄 [AmulScraper] Crawling region ${idx + 1}/${substoresList.length} ("${sub}")...`, logStyle)
    const n = await fetchAllForSubstore(sub)
    regionBreakdown[sub] = n
    console.warn(`%c  └─ Region "${sub}" scan: added +${n} unique products. (Accumulated unique catalog: ${allProducts.length})`, successStyle)
    await new Promise(r => setTimeout(r, 200))
  }

  console.warn(`%c🏁 [AmulScraper] Scraping complete!`, warnStyle)
  console.warn(`%c  ├─ Total raw products scanned: ${cumulativeScanned}`, logStyle)
  console.warn(`%c  └─ Deduplicated catalog size:  ${allProducts.length} unique products`, successStyle)

  console.warn(`%c📊 [AmulScraper] Region-wise Breakdown:`, warnStyle)
  for (const [sub, count] of Object.entries(regionBreakdown)) {
    console.warn(`%c  - "${sub}": ${count} unique products`, logStyle)
  }

  if (allProducts.length === 0) {
    console.error(`%c❌ [AmulScraper] Collected 0 products. Something went wrong.`, errorStyle)
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

  console.warn(`%c💾 [AmulScraper] CSV downloaded successfully as: ${filename}`, successStyle)
  console.warn(`%c💡 Make sure you enable the "Info" or "Verbose" level in your console filters to see detailed tables.`, warnStyle)
  console.table(allProducts.slice(0, 5))
})()
