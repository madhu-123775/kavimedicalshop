// ======================================================================
// billReader.js  -  Layout-independent stock bill reader
//
// Idea:
//   1. Photo-va clean pannum (light / shadow normalize, optional deskew)
//   2. HEADER line-a kandupidikkum (Quantity, Product Name, Mfr, Batch, Expiry, MRP ...)
//      -> header-la irukkura order-a vachu COLUMNS uruvaakkum
//   3. Rows-a product-name column vachu kandupidikkum
//   4. Ovvoru CELL-aiyum thaniya OCR pannum
//   5. Expiry / Qty / Batch / MRP / Pack / Name-a clean + validate pannum
//
// Dependencies veliya irundhu thara padum (Stock.jsx-la irundhu)
// ======================================================================

const TARGET_WIDTH = 2400

/* ---------------------------------------------------------------
   Small helpers
--------------------------------------------------------------- */

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim()

const median = (a) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

const cyOf = (w) => (w.y0 + w.y1) / 2

const editDist = (a, b) => {
  a = a.toUpperCase()
  b = b.toUpperCase()

  const dp = Array.from(
    { length: a.length + 1 },
    (_, i) => [i]
  )

  for (let j = 1; j <= b.length; j++) {
    dp[0][j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] +
          (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
  }

  return dp[a.length][b.length]
}

/* ---------------------------------------------------------------
   Header classification
--------------------------------------------------------------- */

const OTHER_WORDS = [
  "hsn",
  "code",
  "rate",
  "ptr",
  "pts",
  "amount",
  "amt",
  "gst",
  "cgst",
  "sgst",
  "igst",
  "disc",
  "free",
  "scheme",
  "value",
  "total",
  "tax",
  "sno",
  "slno",
  "sl",
  "cs",
  "tin",
  "mrpcs",
  "netamt",
  "net",
  "taxable",
  "pr",
  "ptrate",
]

export const classifyHeader = (str) => {
  const k = String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

  if (!k) return null

  if (
    k.includes("mrp") ||
    /^[mn][rn][a-z]$/.test(k)
  ) {
    return "mrp"
  }

  if (
    k.includes("exp") ||
    /^ex[mp]/.test(k)
  ) {
    return "expiry"
  }

  if (
    k.includes("batch") ||
    (k.startsWith("bat") && k.length <= 7)
  ) {
    return "batch"
  }

  if (
    k.includes("qty") ||
    k.includes("quantity") ||
    k.includes("uantit") ||
    k === "qnty" ||
    k === "qt"
  ) {
    return "quantity"
  }

  if (
    ["mfr", "mfg", "manufact", "company", "mkt", "mfrs"]
      .some((w) => k.includes(w))
  ) {
    return "mfr"
  }

  if (
    k === "uom" ||
    k.startsWith("pack") ||
    /^pa?c?ki?n?g?$/.test(k) ||
    k === "pkg" ||
    k === "pck" ||
    k === "unit"
  ) {
    return "packing"
  }

  if (
    [
      "description",
      "product",
      "item",
      "particular",
      "medicine",
      "drug",
      "name",
    ].some((w) => k.includes(w))
  ) {
    return "name"
  }

  if (OTHER_WORDS.includes(k)) return "other"

  return null
}

const KEY_FIELDS = [
  "name",
  "batch",
  "expiry",
  "mrp",
  "quantity",
  "packing",
  "mfr",
]

/* ---------------------------------------------------------------
   Gray image helpers
--------------------------------------------------------------- */

const cropGray = (g, W, H, x, y, w, h) => {
  const sx = Math.max(0, Math.floor(x))
  const sy = Math.max(0, Math.floor(y))

  const sw = Math.max(
    1,
    Math.min(W - sx, Math.ceil(w))
  )

  const sh = Math.max(
    1,
    Math.min(H - sy, Math.ceil(h))
  )

  const out = new Uint8ClampedArray(sw * sh)

  for (let yy = 0; yy < sh; yy++) {
    const so = (sy + yy) * W + sx
    out.set(
      g.subarray(so, so + sw),
      yy * sw
    )
  }

  return {
    data: out,
    w: sw,
    h: sh,
    ox: sx,
    oy: sy,
  }
}

const resizeGray = (img, scale) => {
  const nw = Math.max(
    1,
    Math.round(img.w * scale)
  )

  const nh = Math.max(
    1,
    Math.round(img.h * scale)
  )

  const out = new Uint8ClampedArray(nw * nh)

  for (let y = 0; y < nh; y++) {
    const fy = Math.min(
      img.h - 1,
      Math.max(
        0,
        (y + 0.5) / scale - 0.5
      )
    )

    const y0 = Math.floor(fy)
    const y1 = Math.min(img.h - 1, y0 + 1)
    const ty = fy - y0

    for (let x = 0; x < nw; x++) {
      const fx = Math.min(
        img.w - 1,
        Math.max(
          0,
          (x + 0.5) / scale - 0.5
        )
      )

      const x0 = Math.floor(fx)
      const x1 = Math.min(img.w - 1, x0 + 1)
      const tx = fx - x0

      const a =
        img.data[y0 * img.w + x0] *
          (1 - tx) +
        img.data[y0 * img.w + x1] *
          tx

      const b =
        img.data[y1 * img.w + x0] *
          (1 - tx) +
        img.data[y1 * img.w + x1] *
          tx

      out[y * nw + x] =
        a * (1 - ty) +
        b * ty
    }
  }

  return {
    data: out,
    w: nw,
    h: nh,
  }
}

const padGray = (img, p) => {
  const nw = img.w + p * 2
  const nh = img.h + p * 2

  const out =
    new Uint8ClampedArray(nw * nh)
      .fill(255)

  for (let y = 0; y < img.h; y++) {
    out.set(
      img.data.subarray(
        y * img.w,
        (y + 1) * img.w
      ),
      (y + p) * nw + p
    )
  }

  return {
    data: out,
    w: nw,
    h: nh,
  }
}

const boxBlur = (img, r) => {
  const { w, h } = img

  const tmp = new Float32Array(w * h)
  const out = new Uint8ClampedArray(w * h)

  for (let y = 0; y < h; y++) {
    let sum = 0

    for (let x = -r; x <= r; x++) {
      sum +=
        img.data[
          y * w +
            Math.min(
              w - 1,
              Math.max(0, x)
            )
        ]
    }

    for (let x = 0; x < w; x++) {
      tmp[y * w + x] =
        sum / (2 * r + 1)

      sum +=
        img.data[
          y * w +
            Math.min(
              w - 1,
              x + r + 1
            )
        ] -
        img.data[
          y * w +
            Math.max(
              0,
              x - r
            )
        ]
    }
  }

  for (let x = 0; x < w; x++) {
    let sum = 0

    for (let y = -r; y <= r; y++) {
      sum +=
        tmp[
          Math.min(
            h - 1,
            Math.max(0, y)
          ) * w + x
        ]
    }

    for (let y = 0; y < h; y++) {
      out[y * w + x] =
        sum / (2 * r + 1)

      sum +=
        tmp[
          Math.min(
            h - 1,
            y + r + 1
          ) * w + x
        ] -
        tmp[
          Math.max(
            0,
            y - r
          ) * w + x
        ]
    }
  }

  return {
    data: out,
    w,
    h,
  }
}

const otsu = (img) => {
  const hist = new Array(256).fill(0)

  for (const v of img.data) {
    hist[v]++
  }

  const total = img.data.length

  let sum = 0

  for (let i = 0; i < 256; i++) {
    sum += i * hist[i]
  }

  let sumB = 0
  let wB = 0
  let best = 0
  let thr = 128

  for (let i = 0; i < 256; i++) {
    wB += hist[i]

    if (!wB) continue

    const wF = total - wB

    if (!wF) break

    sumB += i * hist[i]

    const mB = sumB / wB
    const mF = (sum - sumB) / wF

    const between =
      wB *
      wF *
      (mB - mF) *
      (mB - mF)

    if (between > best) {
      best = between
      thr = i
    }
  }

  return thr
}

const binarize = (img) => {
  const thr = otsu(img)

  const out =
    new Uint8ClampedArray(
      img.data.length
    )

  for (let i = 0; i < out.length; i++) {
    out[i] =
      img.data[i] > thr
        ? 255
        : 0
  }

  return {
    data: out,
    w: img.w,
    h: img.h,
  }
}

const rotateGray = (img, deg) => {
  const r = (deg * Math.PI) / 180

  const cos = Math.cos(r)
  const sin = Math.sin(r)

  const { w, h } = img

  const cx = w / 2
  const cy = h / 2

  const out =
    new Uint8ClampedArray(w * h)
      .fill(255)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx =
        cos * (x - cx) +
        sin * (y - cy) +
        cx

      const sy =
        -sin * (x - cx) +
        cos * (y - cy) +
        cy

      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)

      if (
        x0 < 0 ||
        y0 < 0 ||
        x0 >= w - 1 ||
        y0 >= h - 1
      ) {
        continue
      }

      const tx = sx - x0
      const ty = sy - y0

      const a =
        img.data[
          y0 * w + x0
        ] *
          (1 - tx) +
        img.data[
          y0 * w + x0 + 1
        ] *
          tx

      const b =
        img.data[
          (y0 + 1) * w + x0
        ] *
          (1 - tx) +
        img.data[
          (y0 + 1) * w + x0 + 1
        ] *
          tx

      out[y * w + x] =
        a * (1 - ty) +
        b * ty
    }
  }

  return {
    data: out,
    w,
    h,
  }
}

/* ---------------------------------------------------------------
   Normalize image
--------------------------------------------------------------- */

const normalizeGray = (gray, w, h) => {
  const B = 40

  const gw = Math.ceil(w / B)
  const gh = Math.ceil(h / B)

  let bg =
    new Float32Array(gw * gh)

  for (let by = 0; by < gh; by++) {
    for (let bx = 0; bx < gw; bx++) {
      let max = 0

      for (
        let y = by * B;
        y < Math.min(h, (by + 1) * B);
        y += 2
      ) {
        for (
          let x = bx * B;
          x < Math.min(w, (bx + 1) * B);
          x += 2
        ) {
          const v =
            gray[y * w + x]

          if (v > max) max = v
        }
      }

      bg[by * gw + bx] =
        max || 255
    }
  }

  for (let pass = 0; pass < 2; pass++) {
    const next =
      new Float32Array(bg.length)

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let sum = 0
        let cnt = 0

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy
            const xx = x + dx

            if (
              yy >= 0 &&
              yy < gh &&
              xx >= 0 &&
              xx < gw
            ) {
              sum +=
                bg[yy * gw + xx]
              cnt++
            }
          }
        }

        next[y * gw + x] =
          sum / cnt
      }
    }

    bg = next
  }

  const sample = (fx, fy) => {
    const x0 = Math.max(
      0,
      Math.min(
        gw - 1,
        Math.floor(fx)
      )
    )

    const y0 = Math.max(
      0,
      Math.min(
        gh - 1,
        Math.floor(fy)
      )
    )

    const x1 =
      Math.min(gw - 1, x0 + 1)

    const y1 =
      Math.min(gh - 1, y0 + 1)

    const tx =
      Math.max(
        0,
        Math.min(1, fx - x0)
      )

    const ty =
      Math.max(
        0,
        Math.min(1, fy - y0)
      )

    const a =
      bg[y0 * gw + x0] *
        (1 - tx) +
      bg[y0 * gw + x1] *
        tx

    const b =
      bg[y1 * gw + x0] *
        (1 - tx) +
      bg[y1 * gw + x1] *
        tx

    return (
      a * (1 - ty) +
      b * ty
    )
  }

  const out =
    new Uint8ClampedArray(
      w * h
    )

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const b =
        sample(
          x / B - 0.5,
          y / B - 0.5
        )

      out[y * w + x] =
        Math.min(
          255,
          (gray[y * w + x] /
            Math.max(b, 1)) *
            255
        )
    }
  }

  return out
}

/* ---------------------------------------------------------------
   Canvas bridge
--------------------------------------------------------------- */

export const browserEnv = (
  createWorker
) => ({
  createWorker: () =>
    createWorker("eng"),

  createCanvas: (w, h) => {
    const c =
      document.createElement(
        "canvas"
      )

    c.width = w
    c.height = h

    return c
  },

  loadImage: async (src) =>
    src instanceof HTMLCanvasElement
      ? src
      : await createImageBitmap(src),

  toInput: (c) => c,
})

const loadGray = async (
  source,
  env
) => {
  const bmp =
    await env.loadImage(source)

  const w = TARGET_WIDTH

  const h =
    Math.round(
      (bmp.height *
        TARGET_WIDTH) /
        bmp.width
    )

  const c =
    env.createCanvas(w, h)

  const ctx =
    c.getContext("2d")

  ctx.imageSmoothingQuality =
    "high"

  ctx.fillStyle = "#fff"

  ctx.fillRect(
    0,
    0,
    w,
    h
  )

  ctx.drawImage(
    bmp,
    0,
    0,
    w,
    h
  )

  const d =
    ctx.getImageData(
      0,
      0,
      w,
      h
    ).data

  const gray =
    new Uint8ClampedArray(
      w * h
    )

  for (
    let i = 0, p = 0;
    i < gray.length;
    i++, p += 4
  ) {
    gray[i] =
      0.299 * d[p] +
      0.587 * d[p + 1] +
      0.114 * d[p + 2]
  }

  return {
    gray,
    w,
    h,
  }
}

const grayToInput = (
  img,
  env
) => {
  const c =
    env.createCanvas(
      img.w,
      img.h
    )

  const ctx =
    c.getContext("2d")

  const id =
    ctx.createImageData(
      img.w,
      img.h
    )

  const d = id.data

  for (
    let i = 0, p = 0;
    i < img.data.length;
    i++, p += 4
  ) {
    d[p] =
      d[p + 1] =
      d[p + 2] =
        img.data[i]

    d[p + 3] = 255
  }

  ctx.putImageData(id, 0, 0)

  return env.toInput(c)
}

/* ---------------------------------------------------------------
   OCR result -> words / lines
--------------------------------------------------------------- */

const rawLines = (data) => {
  if (
    data.lines &&
    data.lines.length
  ) {
    return data.lines
  }

  const out = []

  ;(data.blocks || [])
    .forEach((b) =>
      (b.paragraphs || [])
        .forEach((p) =>
          (p.lines || [])
            .forEach((l) =>
              out.push(l)
            )
        )
    )

  return out
}

const toLines = (
  data,
  ox = 0,
  oy = 0,
  scale = 1
) =>
  rawLines(data)
    .map((l) => {
      const words =
        (l.words || [])
          .filter((w) =>
            clean(w.text)
          )
          .map((w) => ({
            text: clean(w.text),
            x0:
              ox +
              w.bbox.x0 /
                scale,
            x1:
              ox +
              w.bbox.x1 /
                scale,
            y0:
              oy +
              w.bbox.y0 /
                scale,
            y1:
              oy +
              w.bbox.y1 /
                scale,
          }))
          .sort(
            (a, b) =>
              a.x0 - b.x0
          )

      const y =
        words.length
          ? words.reduce(
              (s, w) =>
                s + cyOf(w),
              0
            ) / words.length
          : 0

      return {
        words,
        y,
      }
    })
    .filter(
      (l) => l.words.length
    )

/* ---------------------------------------------------------------
   Header + table location
--------------------------------------------------------------- */

const locateHeader = (
  words
) => {
  const cands =
    words
      .map((w) => ({
        w,
        field:
          classifyHeader(
            w.text
          ),
      }))
      .filter(
        (c) =>
          c.field &&
          c.w.text.replace(
            /[^A-Za-z]/g,
            ""
          ).length >= 2
      )
      .sort(
        (a, b) =>
          cyOf(a.w) -
          cyOf(b.w)
      )

  const clusters = []

  for (const c of cands) {
    const last =
      clusters[
        clusters.length - 1
      ]

    if (
      last &&
      cyOf(c.w) -
        last.y0 <=
        30
    ) {
      last.items.push(c)
    } else {
      clusters.push({
        y0: cyOf(c.w),
        items: [c],
      })
    }
  }

  let best = null
  let bestScore = 0

  for (const cl of clusters) {
    const keys =
      new Set(
        cl.items
          .map((i) => i.field)
          .filter((f) =>
            KEY_FIELDS.includes(f)
          )
      )

    const mean =
      cl.items.reduce(
        (s, i) =>
          s + cyOf(i.w),
        0
      ) /
      cl.items.length

    const score = keys.size

    const ok =
      score >= 3 &&
      (
        keys.has("name") ||
        keys.has("batch") ||
        keys.has("expiry")
      )

    if (
      ok &&
      score > bestScore
    ) {
      best = {
        mean,
        items: cl.items,
      }

      bestScore = score
    }
  }

  if (!best) return null

  const hy = best.mean

  const hw =
    words
      .filter(
        (w) =>
          Math.abs(
            cyOf(w) - hy
          ) <= 24 &&
          w.text.replace(
            /[^A-Za-z]/g,
            ""
          ).length >= 2
      )
      .sort(
        (a, b) =>
          a.x0 - b.x0
      )

  return {
    hy,
    words: hw,
  }
}

// Header words -> columns
const buildColumns = (
  hwords
) => {
  const cols = []

  for (const w of hwords) {
    const field =
      classifyHeader(w.text)

    const last =
      cols[cols.length - 1]

    const gap =
      last
        ? w.x0 - last.x1
        : Infinity

    if (
      last &&
      gap < 60 &&
      field &&
      field === last.field
    ) {
      last.x1 =
        Math.max(
          last.x1,
          w.x1
        )
    } else if (
      last &&
      gap < 45 &&
      !field &&
      last.field !== "mrp"
    ) {
      if (
        last.field ===
          "quantity" &&
        last.uomX0 ===
          undefined
      ) {
        last.uomX0 =
          w.x0
      }

      last.x1 =
        Math.max(
          last.x1,
          w.x1
        )
    } else {
      cols.push({
        field:
          field || "other",
        x0: w.x0,
        x1: w.x1,
        unknownOnly:
          !field,
      })
    }
  }

  // Product OCR-la garble aagi Name mattum kidaichaa
  for (
    let i = 0;
    i < cols.length - 1;
    i++
  ) {
    if (
      cols[i].field ===
        "other" &&
      cols[i].unknownOnly &&
      cols[i + 1].field ===
        "name" &&
      cols[i + 1].x0 -
        cols[i].x1 <
        70
    ) {
      cols[i + 1].x0 =
        cols[i].x0

      cols.splice(i, 1)

      i--
    }
  }

  // Quantity + UOM
  for (
    let i = 0;
    i < cols.length - 1;
    i++
  ) {
    if (
      cols[i].field ===
        "quantity" &&
      cols[i + 1].field ===
        "packing"
    ) {
      cols[i].x1 =
        cols[i + 1].x1

      cols[i].uomX0 =
        cols[i + 1].x0

      cols.splice(i + 1, 1)
    }
  }

  cols.forEach((c) => {
    if (
      c.field ===
      "quantity"
    ) {
      c.withPack = true
    }
  })

  return cols
}

/* ---------------------------------------------------------------
   Column boundaries
--------------------------------------------------------------- */

const setBoundaries = (
  cols,
  gray,
  W,
  y0,
  y1
) => {
  const region =
    cropGray(
      gray,
      W,
      gray.length / W,
      0,
      y0,
      W,
      y1 - y0
    )

  const occ =
    new Uint8Array(W)

  const cnt =
    new Uint16Array(W)

  for (
    let y = 0;
    y < region.h;
    y++
  ) {
    for (
      let x = 0;
      x < W;
      x++
    ) {
      if (
        region.data[
          y * W + x
        ] < 165
      ) {
        cnt[x]++
      }
    }
  }

  const sortedCnt =
    [...cnt]
      .filter(
        (v) => v > 0
      )
      .sort(
        (a, b) => a - b
      )

  const p80 =
    sortedCnt.length
      ? sortedCnt[
          Math.floor(
            sortedCnt.length *
              0.8
          )
        ]
      : 0

  const occThr =
    Math.max(
      3,
      0.25 * p80
    )

  for (
    let x = 0;
    x < W;
    x++
  ) {
    if (
      cnt[x] >=
      occThr
    ) {
      occ[x] = 1
    }
  }

  const occD =
    new Uint8Array(W)

  for (
    let x = 0;
    x < W;
    x++
  ) {
    if (occ[x]) {
      for (
        let k =
          Math.max(
            0,
            x - 5
          );
        k <=
          Math.min(
            W - 1,
            x + 5
          );
        k++
      ) {
        occD[k] = 1
      }
    }
  }

  const bounds = [
    Math.max(
      0,
      cols[0].x0 - 15
    ),
  ]

  for (
    let i = 1;
    i < cols.length;
    i++
  ) {
    const from =
      Math.max(
        0,
        Math.floor(
          cols[i - 1].x0
        )
      )

    const to =
      Math.min(
        W - 1,
        Math.floor(
          cols[i].x0 + 15
        )
      )

    let found = -1
    let s0 = -1

    for (
      let x = from;
      x <= to + 1;
      x++
    ) {
      const empty =
        x <= to &&
        !occD[x]

      if (
        empty &&
        s0 === -1
      ) {
        s0 = x
      }

      if (
        !empty &&
        s0 !== -1
      ) {
        if (
          x - s0 >= 12 &&
          (s0 + x) / 2 >
            bounds[i - 1] +
              20
        ) {
          found =
            (s0 + x) / 2
        }

        s0 = -1
      }
    }

    const fallback =
      cols[i - 1].x1 +
      0.35 *
        (
          cols[i].x0 -
          cols[i - 1].x1
        )

    bounds.push(
      found !== -1
        ? found
        : Math.max(
            bounds[i - 1] +
              20,
            fallback
          )
    )
  }

  cols.forEach(
    (c, i) => {
      c.left =
        bounds[i]

      const next =
        i + 1 <
        cols.length
          ? bounds[i + 1]
          : W

      c.right =
        Math.min(
          next,
          c.x1 +
            (
              c.field ===
              "mrp"
                ? 22
                : 260
            )
        )
    }
  )

  for (
    let i = 0;
    i < cols.length;
    i++
  ) {
    const c = cols[i]

    if (!c.withPack)
      continue

    let split = -1

    if (
      c.uomX0 !==
      undefined
    ) {
      let s0 = -1

      for (
        let x =
          Math.floor(
            c.uomX0 - 80
          );
        x <=
          c.uomX0 + 12;
        x++
      ) {
        const empty =
          x <=
            c.uomX0 + 12 &&
          !occ[x]

        if (
          empty &&
          s0 === -1
        ) {
          s0 = x
        }

        if (
          !empty &&
          s0 !== -1
        ) {
          if (
            x - s0 >= 8
          ) {
            split =
              (s0 + x) / 2
          }

          s0 = -1
        }
      }
    }

    if (
      split !== -1
    ) {
      const uom = {
        field:
          "packing",
        x0:
          c.uomX0 ??
          split,
        x1: c.x1,
        left: split,
        right:
          c.right,
      }

      c.right =
        split

      c.withPack =
        false

      cols.splice(
        i + 1,
        0,
        uom
      )

      i++
    }
  }

  return cols
}

/* ---------------------------------------------------------------
   Field cleaners / validators
--------------------------------------------------------------- */

const FORM_WORDS = [
  "TAB",
  "TABS",
  "TABLET",
  "TABLETS",
  "CAP",
  "CAPS",
  "CAPSULE",
  "SYP",
  "SYRUP",
  "SUSP",
  "DROPS",
  "DROP",
  "DRY",
  "INJ",
  "VIAL",
  "CREAM",
  "GEL",
  "OINT",
  "OINTMENT",
  "FORTE",
  "PLUS",
  "LOTION",
  "POWDER",
  "SOAP",
  "SHAMPOO",
  "SPRAY",
  "OIL",
  "SOLUTION",
  "GRANULES",
  "SACHET",
  "STRIP",
  "EYE",
  "EAR",
  "NASAL",
  "SYRINGE",
  "LIQUID",
  "TONIC",
]

const fixNameToken = (t) => {
  let s = t

  if (
    s.includes("@")
  ) {
    s =
      s.replace(
        /@/g,
        "0"
      )
      .replace(
        /^[Ss](?=\d)/,
        "5"
      )
  }

  s =
    s.replace(
      /(?<=\d)[Oo](?=\d|$)/g,
      "0"
    )
    .replace(
      /(?<=\d)[lI](?=\d)/g,
      "1"
    )

  return s
}

const cleanName = (t) =>
  clean(
    String(t ?? "")
      .replace(
        /[~|_=^`¢«»“”"]+/g,
        " "
      )
  )
    .replace(
      /^\d+[.)]\s+/,
      ""
    )
    .replace(
      /^[^A-Za-z0-9(]+/,
      ""
    )
    .replace(
      /[^A-Za-z0-9).]+$/,
      ""
    )

const fixName = (
  raw,
  knownNames = []
) => {
  let name =
    cleanName(raw)

  if (!name) return ""

  const letters =
    name.replace(
      /[^A-Za-z]/g,
      ""
    )

  const upperRatio =
    letters
      ? letters.replace(
          /[^A-Z]/g,
          ""
        ).length /
        letters.length
      : 1

  const upperCase =
    upperRatio >= 0.5

  let tokens =
    name
      .split(" ")
      .map(fixNameToken)

  tokens =
    tokens.map(
      (t) => {
        const core =
          t.replace(
            /[^A-Za-z]/g,
            ""
          )

        if (
          core.length >= 3 &&
          core.length ===
            t.length
        ) {
          let bestW =
            null

          let bestD =
            99

          for (
            const w of FORM_WORDS
          ) {
            const d =
              editDist(
                core,
                w
              )

            if (
              d < bestD
            ) {
              bestD = d
              bestW = w
            }
          }

          if (
            bestW &&
            bestD <=
              (
                core.length >=
                6
                  ? 2
                  : 1
              ) &&
            bestD > 0
          ) {
            return bestW
          }
        }

        return t
      }
    )

  name =
    tokens.join(" ")

  if (upperCase) {
    name =
      name.toUpperCase()
  }

  // Existing stock names-oda spelling correction
  let best = null
  let bestScore = 1

  for (
    const k of knownNames
  ) {
    const kn =
      clean(k)

    if (!kn) continue

    const d =
      editDist(
        name,
        kn
      )

    const ratio =
      d /
      Math.max(
        name.length,
        kn.length
      )

    if (
      ratio <
      bestScore
    ) {
      bestScore =
        ratio
      best = kn
    }
  }

  // Slightly stronger spelling correction
  if (
    best &&
    bestScore <= 0.30
  ) {
    return best
  }

  return name
}

const cleanBatch = (
  text
) => {
  const tokens =
    String(text ?? "")
      .split(/\s+/)
      .map((t) =>
        t.replace(
          /^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,
          ""
        )
      )
      .filter(Boolean)

  let best = ""

  for (
    const t of tokens
  ) {
    const f =
      t.toUpperCase()

    if (
      f.length < 4 ||
      f.length > 20
    ) {
      continue
    }

    if (
      /^\d+\.\d+$/.test(f)
    ) {
      continue
    }

    if (!/\d/.test(f)) {
      continue
    }

    if (
      f.length > best.length
    ) {
      best = f
    }
  }

  return best
}
/* ---------------------------------------------------------------
   MRP / Quantity / Packing / Expiry helpers
--------------------------------------------------------------- */

// IMPORTANT:
// Decimal MRP + whole-number MRP rendu accept pannum.
// Example: 46.17, 64.68, 103.95, 10, 30, 100, 209

const moneyOf = (text) => {
  const raw =
    String(text ?? "")
      .replace(/,/g, "")
      .replace(/₹/gi, "")
      .replace(/\bRs\.?\b/gi, "")
      .trim()

  if (!raw) return 0

  const toks =
    raw.split(/\s+/)

  // Decimal MRP
  for (
    const t of toks
  ) {
    const m =
      t.match(
        /^\D?(\d{1,6}\.\d{1,2})\D?$/
      )

    if (m) {
      const n =
        Number(m[1])

      if (
        Number.isFinite(n) &&
        n > 0
      ) {
        return n
      }
    }
  }

  // Whole-number MRP
  for (
    const t of toks
  ) {
    const m =
      t.match(
        /^\D?(\d{1,6})\D?$/
      )

    if (m) {
      const n =
        Number(m[1])

      if (
        Number.isFinite(n) &&
        n > 0 &&
        n < 100000
      ) {
        return n
      }
    }
  }

  return 0
}

const parseQtyPack = (
  text
) => {
  const t =
    String(text ?? "")
      .trim()

  const m =
    t.match(
      /^\D*?(\d{1,4}\s*\+\s*\d{1,4}|\d{1,4})(?:\s+(.*))?$/
    )

  if (!m) {
    return {
      qty: 0,
      rest: "",
    }
  }

  let qty

  if (
    m[1].includes("+")
  ) {
    const [a, b] =
      m[1]
        .split("+")
        .map((n) =>
          Number(n)
        )

    qty =
      a + b
  } else {
    qty =
      Number(m[1])
  }

  return {
    qty,
    rest: clean(
      m[2] || ""
    ),
  }
}

const cleanPackText = (
  text
) => {
  let s =
    clean(text)
      .replace(
        /[^A-Za-z0-9'’ ]/g,
        ""
      )

  if (!s) return ""

  s =
    s.replace(
      /\s+/g,
      " "
    )

  let m =
    s.match(
      /^(\d{2})[71]\s*[sS5$]{1,2}$/
    )

  if (m) {
    return `${m[1]}'S`
  }

  m =
    s.match(
      /^(\d{1,4})\s*['’]?\s*[sS5$]{1,2}$/
    )

  if (m) {
    return `${m[1]}'S`
  }

  m =
    s.match(
      /^(\d{1,4})\s*(?:ml|m|l|mi|ni|rl|mm)$/i
    )

  if (m) {
    return `${m[1]}ML`
  }

  m =
    s.match(
      /^(\d{1,4})\s*(gm|gms|g)$/i
    )

  if (m) {
    return `${m[1]}GM`
  }

  m =
    s.match(
      /^(\d+)$/
    )

  if (m) {
    return m[1]
  }

  return s.toUpperCase()
}

const yearOk = (
  y
) => {
  const cur =
    new Date().getFullYear()

  return (
    y >= cur - 1 &&
    y <= cur + 12
  )
}

const hamming = (
  a,
  b
) => {
  let d = 0

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    if (
      a[i] !== b[i]
    ) {
      d++
    }
  }

  return d
}

// text -> { month, ys }
const parseExpiryLoose = (
  text
) => {
  const t =
    String(text ?? "")
      .replace(
        /[^\d/.\-]/g,
        ""
      )

  const m =
    t.match(
      /(\d{1,2})[/.\-](\d{2,4})/
    )

  if (!m) return null

  return {
    month:
      Number(m[1]),
    ys: m[2],
  }
}

const yearDist = (
  ys,
  cand
) => {
  const c =
    String(cand)

  if (
    ys.length === 4
  ) {
    return hamming(
      ys,
      c
    )
  }

  if (
    ys.length === 2
  ) {
    return hamming(
      ys,
      c.slice(2)
    )
  }

  if (
    ys.length === 3
  ) {
    return (
      1 +
      Math.min(
        hamming(
          ys,
          c.slice(0, 3)
        ),
        hamming(
          ys,
          c.slice(1)
        )
      )
    )
  }

  return 4
}

const fmtExpiry = (
  month,
  year
) =>
  `${String(month).padStart(
    2,
    "0"
  )}/${String(year).slice(-2)}`

/* ---------------------------------------------------------------
   Voting helpers
--------------------------------------------------------------- */

const vote = (
  cands,
  valid = (x) => !!x
) => {
  const ok =
    cands.filter(valid)

  if (!ok.length) {
    return {
      value:
        cands[0] ?? "",
      sure: false,
    }
  }

  const counts =
    new Map()

  ok.forEach(
    (c) =>
      counts.set(
        c,
        (counts.get(c) ||
          0) + 1
      )
  )

  let best =
    ok[0]

  let bestN = 0

  for (
    const [c, n] of counts
  ) {
    if (
      n > bestN
    ) {
      best = c
      bestN = n
    }
  }

  return {
    value: best,
    sure:
      bestN >= 2 ||
      (
        cands.length === 1 &&
        ok.length === 1
      ),
  }
}

/* ---------------------------------------------------------------
   Cell OCR
--------------------------------------------------------------- */

const WHITELIST = {
  name: "",
  mfr:
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz. ",
  batch:
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/",
  expiry:
    "0123456789/.-",
  mrp:
    "0123456789.",
  quantity:
    "0123456789+",
  quantityPack:
    "0123456789+MLSGmlsg'’ ",
  packing:
    "0123456789MLSGmlsgx'’ ",
}

const variantsOf = (
  cell
) => {
  const big =
    resizeGray(
      cell,
      2
    )

  return [
    padGray(
      big,
      12
    ),

    padGray(
      boxBlur(
        big,
        1
      ),
      12
    ),

    padGray(
      resizeGray(
        cell,
        3
      ),
      12
    ),

    padGray(
      binarize(
        boxBlur(
          resizeGray(
            cell,
            1.5
          ),
          2
        )
      ),
      12
    ),
  ]
}

const recognizeText =
  async (
    worker,
    input
  ) => {
    const res =
      await worker.recognize(
        input
      )

    return clean(
      res.data.text
    )
  }

/* ---------------------------------------------------------------
   Validated ensemble OCR
--------------------------------------------------------------- */

const charVote = (
  cands
) => {
  const lens =
    new Map()

  cands.forEach(
    (c) =>
      lens.set(
        c.length,
        (lens.get(
          c.length
        ) || 0) + 1
      )
  )

  let L = 0
  let bestN = 0

  for (
    const [l, n] of lens
  ) {
    if (
      n > bestN
    ) {
      L = l
      bestN = n
    }
  }

  const same =
    cands.filter(
      (c) =>
        c.length === L
    )

  let out = ""

  for (
    let i = 0;
    i < L;
    i++
  ) {
    const cnt =
      new Map()

    same.forEach(
      (c) =>
        cnt.set(
          c[i],
          (cnt.get(
            c[i]
          ) || 0) + 1
        )
    )

    let ch =
      same[0][i]

    let n = 0

    for (
      const [k, v] of cnt
    ) {
      if (
        v > n
      ) {
        ch = k
        n = v
      }
    }

    out += ch
  }

  return {
    value: out,
    votes:
      same.length,
  }
}

const readValidated = async (
  worker,
  env,
  gray,
  W,
  H,
  col,
  cy,
  half,
  valid,
  repair
) => {
  const cands = []
  const all = []

  for (
    const dy of [0, -4, 4]
  ) {
    const cell =
      cropGray(
        gray,
        W,
        H,
        col.left,
        cy + dy - half,
        col.right -
          col.left,
        half * 2
      )

    for (
      const sc of [2, 3]
    ) {
      const img =
        padGray(
          resizeGray(
            cell,
            sc
          ),
          12
        )

      const input =
        grayToInput(
          img,
          env
        )

      for (
        const psm of ["7", "8"]
      ) {
        await worker.setParameters(
          {
            tessedit_pageseg_mode:
              psm,
          }
        )

        let t =
          (
            await recognizeText(
              worker,
              input
            )
          ).replace(
            /\s+/g,
            ""
          )

        all.push(t)

        if (
          !valid(t) &&
          repair
        ) {
          t = repair(t)
        }

        if (
          valid(t)
        ) {
          cands.push(t)
        }
      }
    }

    if (
      cands.length >= 6
    ) {
      break
    }
  }

  await worker.setParameters(
    {
      tessedit_pageseg_mode:
        "7",
    }
  )

  if (
    !cands.length
  ) {
    return {
      text:
        all.find(Boolean) ||
        "",
      votes: 0,
    }
  }

  const v =
    charVote(cands)

  return {
    text: v.value,
    votes: v.votes,
  }
}

// Expiry-la "/" a 7 / 1 / | nu thappa padichaa
const repairExpiry = (
  t
) => {
  const d =
    String(t).replace(
      /[^\d/|Il]/g,
      ""
    )

  for (
    let i = 1;
    i <= 2;
    i++
  ) {
    if (
      /[7|Il1]/.test(
        d[i] || ""
      )
    ) {
      const c =
        d.slice(0, i) +
        "/" +
        d.slice(i + 1)

      if (
        /^(1[0-2]|[1-9])\/(\d{2}|20\d\d)$/.test(
          c
        )
      ) {
        return c
      }
    }
  }

  return t
}

/* ---------------------------------------------------------------
   Row finding
--------------------------------------------------------------- */

const findRowCenters =
  async (
    worker,
    gray,
    W,
    H,
    nameCol,
    top,
    bottom,
    env
  ) => {
    const strip =
      cropGray(
        gray,
        W,
        H,
        nameCol.left,
        top,
        nameCol.right -
          nameCol.left,
        bottom - top
      )

    await worker.setParameters(
      {
        tessedit_pageseg_mode:
          "6",
        tessedit_char_whitelist:
          "",
        preserve_interword_spaces:
          "1",
      }
    )

    const res =
      await worker.recognize(
        grayToInput(
          strip,
          env
        ),
        {},
        {
          blocks: true,
          text: true,
        }
      )

    const lines =
      toLines(
        res.data,
        strip.ox,
        strip.oy,
        1
      )

    const centers =
      lines
        .filter(
          (l) =>
            l.words
              .map(
                (w) =>
                  w.text
              )
              .join("")
              .replace(
                /[^A-Za-z0-9]/g,
                ""
              ).length >= 3
        )
        .map(
          (l) => l.y
        )
        .sort(
          (a, b) =>
            a - b
        )

    const merged = []

    for (
      const c of centers
    ) {
      if (
        merged.length &&
        c -
          merged[
            merged.length - 1
          ] <
          18
      ) {
        merged[
          merged.length - 1
        ] =
          (
            merged[
              merged.length - 1
            ] +
            c
          ) / 2
      } else {
        merged.push(c)
      }
    }

    if (
      merged.length < 2
    ) {
      return {
        centers: merged,
        pitch: 38,
      }
    }

    const diffs =
      merged
        .slice(1)
        .map(
          (c, i) =>
            c -
            merged[i]
        )

    const small =
      diffs.filter(
        (d) =>
          d <
          median(diffs) *
            1.5
      )

    const pitch =
      median(small) ||
      median(diffs) ||
      38

    const filled = [
      merged[0],
    ]

    for (
      let i = 1;
      i < merged.length;
      i++
    ) {
      const gap =
        merged[i] -
        merged[i - 1]

      const n =
        Math.round(
          gap / pitch
        )

      for (
        let k = 1;
        k < n;
        k++
      ) {
        filled.push(
          merged[i - 1] +
            (gap * k) / n
        )
      }

      filled.push(
        merged[i]
      )
    }

    return {
      centers: filled,
      pitch,
    }
  }

/* ---------------------------------------------------------------
   Skew
--------------------------------------------------------------- */

const rowSharpness =
  (img) => {
    const p =
      new Float64Array(
        img.h
      )

    for (
      let y = 0;
      y < img.h;
      y++
    ) {
      let s = 0

      for (
        let x = 0;
        x < img.w;
        x++
      ) {
        if (
          img.data[
            y * img.w + x
          ] < 150
        ) {
          s++
        }
      }

      p[y] = s
    }

    let sc = 0

    for (
      const v of p
    ) {
      sc += v * v
    }

    return sc
  }

const bestSkew = (
  gray,
  W,
  H,
  box
) => {
  const reg =
    cropGray(
      gray,
      W,
      H,
      box.x,
      box.y,
      box.w,
      box.h
    )

  const small =
    resizeGray(
      reg,
      0.5
    )

  const base =
    rowSharpness(
      small
    )

  let best = 0
  let bestScore = base

  for (
    let a = -3;
    a <= 3.01;
    a += 0.5
  ) {
    if (
      Math.abs(a) <
      0.01
    ) {
      continue
    }

    const sc =
      rowSharpness(
        rotateGray(
          small,
          a
        )
      )

    if (
      sc >
      bestScore
    ) {
      bestScore = sc
      best = a
    }
  }

  return bestScore >
    base * 1.06
    ? best
    : 0
}
/* ---------------------------------------------------------------
   Main: image / canvas -> rows
--------------------------------------------------------------- */

export const readBillImage =
  async (
    source,
    ctx
  ) => {
    const {
      env,
      onStatus = () => {},
      knownNames = [],
    } = ctx

    const log =
      ctx.debug
        ? (...a) =>
            console.log(
              ...a
            )
        : () => {}

    onStatus(
      "Bill image-a clean pannudhu..."
    )

    let {
      gray,
      w: W,
      h: H,
    } =
      await loadGray(
        source,
        env
      )

    gray =
      normalizeGray(
        gray,
        W,
        H
      )

    const worker =
      await env.createWorker()

    try {
      await worker.setParameters(
        {
          tessedit_pageseg_mode:
            "6",
          preserve_interword_spaces:
            "1",
        }
      )

      const firstPass =
        async () => {
          onStatus(
            "Bill-la table enga irukku nu thedudhu..."
          )

          const res =
            await worker.recognize(
              grayToInput(
                {
                  data: gray,
                  w: W,
                  h: H,
                },
                env
              ),
              {},
              {
                blocks: true,
                text: true,
              }
            )

          const lines =
            toLines(
              res.data
            )

          const words =
            lines.flatMap(
              (l) =>
                l.words
            )

          return {
            words,
            text:
              res.data.text,
          }
        }

      let pass =
        await firstPass()

      let header =
        locateHeader(
          pass.words
        )

      if (header) {
        const angle =
          bestSkew(
            gray,
            W,
            H,
            {
              x: 0,
              y: Math.max(
                0,
                header.hy -
                  20
              ),
              w: W,
              h: Math.min(
                H -
                  header.hy,
                650
              ),
            }
          )

        if (angle) {
          log(
            "deskew",
            angle
          )

          const rot =
            rotateGray(
              {
                data: gray,
                w: W,
                h: H,
              },
              angle
            )

          gray =
            rot.data

          pass =
            await firstPass()

          header =
            locateHeader(
              pass.words
            ) || header
        }
      }

      if (!header) {
        onStatus(
          "Header kidaikkala, text mode-la padikkudhu..."
        )

        return {
          rows:
            parseTextLines(
              pass.text,
              knownNames
            ),
          meta: {},
        }
      }

      if (ctx.dumpGray) {
        ctx.dumpGray(
          gray,
          W,
          H,
          header
        )
      }

      const stop =
        pass.words
          .filter(
            (w) =>
              cyOf(w) >
                header.hy +
                  80 &&
              w.x0 <
                W * 0.5 &&
              /^(remarks?|sub|total|items?|cgst|sgst|igst|e&|grand)/i.test(
                w.text.replace(
                  /[^A-Za-z&]/g,
                  ""
                )
              )
          )
          .sort(
            (a, b) =>
              cyOf(a) -
              cyOf(b)
          )[0]

      const top =
        header.hy + 28

      const bottom =
        stop
          ? stop.y0 - 6
          : Math.min(
              H,
              header.hy +
                700
            )

      const built =
        buildColumns(
          header.words
        )

      if (!built.length) {
        return {
          rows:
            parseTextLines(
              pass.text,
              knownNames
            ),
          meta: {},
        }
      }

      const cols =
        setBoundaries(
          built,
          gray,
          W,
          top,
          bottom
        )

      log(
        "COLUMNS",
        cols
          .map(
            (c) =>
              `${c.field}[${Math.round(
                c.left
              )}-${Math.round(
                c.right
              )}]`
          )
          .join(" ")
      )

      const nameCol =
        cols.find(
          (c) =>
            c.field ===
            "name"
        ) ||
        cols.find(
          (c) =>
            c.field ===
            "batch"
        )

      if (!nameCol) {
        return {
          rows:
            parseTextLines(
              pass.text,
              knownNames
            ),
          meta: {},
        }
      }

      onStatus(
        "Rows-a kandupidikkudhu..."
      )

      const {
        centers,
        pitch,
      } =
        await findRowCenters(
          worker,
          gray,
          W,
          H,
          nameCol,
          top,
          bottom,
          env
        )

      log(
        "ROWS",
        centers.length,
        "pitch",
        pitch
      )

      if (!centers.length) {
        return {
          rows:
            parseTextLines(
              pass.text,
              knownNames
            ),
          meta: {},
        }
      }

      const hasPackCol =
        cols.some(
          (c) =>
            c.field ===
            "packing"
        )

      const cells =
        centers.map(
          () => ({})
        )

      const work =
        cols.filter(
          (c) =>
            [
              "name",
              "mfr",
              "batch",
              "expiry",
              "mrp",
              "quantity",
              "packing",
            ].includes(
              c.field
            )
        )

      const repairMrp =
        (t) => {
          const d =
            String(t).replace(
              /[^\d.]/g,
              ""
            )

          // OCR "4617" -> "46.17"
          if (
            /^\d{4,6}$/.test(
              d
            )
          ) {
            return (
              d.slice(
                0,
                -2
              ) +
              "." +
              d.slice(-2)
            )
          }

          return t
        }

      // IMPORTANT FIX:
      // Integer MRP values are now valid.
      // 10, 30, 100, 209 and 46.17 all accepted.
      const VALID = {
        batch: (t) =>
          /^[A-Z0-9][A-Z0-9\-/]{3,19}$/.test(
            t
          ) &&
          /\d/.test(t),

        expiry: (t) =>
          /^(1[0-2]|[1-9])\/(20\d\d|\d{2})$/.test(
            t
          ),

        mrp: (t) => {
          const n =
            Number(
              String(
                t
              ).replace(
                /[^\d.]/g,
                ""
              )
            )

          return (
            Number.isFinite(n) &&
            n > 0 &&
            n < 100000
          )
        },

        quantity: (t) =>
          /^\d{1,3}(\+\d{1,3})?$/.test(
            t
          ),
      }

      for (
        const col of work
      ) {
        const wlKey =
          col.field ===
            "quantity" &&
          col.withPack &&
          !hasPackCol
            ? "quantityPack"
            : col.field

        await worker.setParameters(
          {
            tessedit_pageseg_mode:
              "7",

            tessedit_char_whitelist:
              WHITELIST[
                wlKey
              ] ?? "",
          }
        )

        const half =
          pitch * 0.5

        for (
          let r = 0;
          r <
          centers.length;
          r++
        ) {
          onStatus(
            `${col.field.toUpperCase()} padikkudhu... (row ${r + 1}/${centers.length})`
          )

          if (
            VALID[
              col.field
            ] &&
            !col.withPack
          ) {
            const res =
              await readValidated(
                worker,
                env,
                gray,
                W,
                H,
                col,
                centers[r],
                half,
                VALID[
                  col.field
                ],
                col.field ===
                  "expiry"
                  ? repairExpiry
                  : col.field ===
                    "mrp"
                  ? repairMrp
                  : null
              )

            cells[r][
              col.field
            ] = [
              res.text,
              res.text,
              res.text,
            ]

            cells[r][
              "_votes_" +
                col.field
            ] =
              res.votes

            continue
          }

          const cell =
            cropGray(
              gray,
              W,
              H,
              col.left,
              centers[r] -
                half,
              col.right -
                col.left,
              half * 2
            )

          const texts = []

          for (
            const v of variantsOf(
              cell
            )
          ) {
            texts.push(
              await recognizeText(
                worker,
                grayToInput(
                  v,
                  env
                )
              )
            )
          }

          cells[r][
            col.field
          ] = texts
        }
      }

      log(
        "CELLS",
        JSON.stringify(
          cells
        )
      )

      const rows =
        finalizeRows(
          cells,
          {
            hasPackCol,
            knownNames,
          }
        )

      const meta = {
        rows:
          rows.length,

        qtySum:
          rows.reduce(
            (s, r) =>
              s +
              (Number(
                r.quantity
              ) || 0),
            0
          ),
      }

      try {
        const fy =
          bottom

        const foot =
          cropGray(
            gray,
            W,
            H,
            W * 0.35,
            fy,
            W * 0.65,
            Math.min(
              H - fy,
              320
            )
          )

        await worker.setParameters(
          {
            tessedit_pageseg_mode:
              "6",
            tessedit_char_whitelist:
              "",
          }
        )

        const fr =
          await worker.recognize(
            grayToInput(
              resizeGray(
                foot,
                1.3
              ),
              env
            )
          )

        const txt =
          fr.data.text

        const im =
          txt.match(
            /Items?\s*[:;.\-]?\s*(\d{1,3})/i
          )

        const qm =
          txt.match(
            /Qty\s*[:;.\-]?\s*(\d{1,5})/i
          )

        if (im) {
          meta.expectedItems =
            Number(
              im[1]
            )
        }

        if (qm) {
          meta.expectedQty =
            Number(
              qm[1]
            )
        }
      } catch (e) {
        // footer optional
      }

      return {
        rows,
        meta,
      }
    } finally {
      await worker.terminate()
    }
  }

/* ---------------------------------------------------------------
   cells[] -> final rows
--------------------------------------------------------------- */

const finalizeRows = (
  cells,
  {
    hasPackCol,
    knownNames,
    exact = false,
  }
) => {
  const out =
    cells.map(
      (c) => {
        const check = []

        // NAME
        const nameC =
          (c.name || [])
            .map(cleanName)

        const nameBest =
          [...nameC].sort(
            (a, b) =>
              (
                b.match(
                  /[A-Za-z]/g
                ) || []
              ).length -
              (
                a.match(
                  /[A-Za-z]/g
                ) || []
              ).length
          )

        const nameRaw =
          nameC.length
            ? nameC.sort(
                (a, b) =>
                  a.length -
                  b.length
              )[
                Math.floor(
                  nameC.length /
                    2
                )
              ]
            : ""

        let name =
          exact
            ? cleanName(
                nameRaw ||
                  nameBest[0] ||
                  ""
              )
            : fixName(
                nameRaw ||
                  nameBest[0] ||
                  "",
                knownNames
              )

        // BATCH
        const bc =
          (c.batch || [])
            .map(cleanBatch)

        let batchV =
          vote(
            bc.filter(Boolean)
              .length
              ? bc
              : [""],
            (x) => !!x
          )

        let batch =
          batchV.value

        const bs =
          bc
            .filter(Boolean)
            .sort(
              (a, b) =>
                a.length -
                b.length
            )

        if (
          bs.length >= 2 &&
          bs[
            bs.length - 1
          ].startsWith(
            bs[0]
          ) &&
          bs[
            bs.length - 1
          ].length -
            bs[0].length ===
            1
        ) {
          batch =
            bs[0]

          batchV = {
            value:
              bs[0],
            sure: true,
          }
        }

        if (
          !batchV.sure
        ) {
          check.push(
            "batch"
          )
        }

        // EXPIRY
        const ex =
          (c.expiry || [])
            .map(
              parseExpiryLoose
            )
            .filter(Boolean)

        // MRP
        const mc =
          (c.mrp || [])
            .map(moneyOf)

        const mv =
          vote(
            mc,
            (x) => x > 0
          )

        if (
          !mv.sure ||
          (
            c._votes_mrp !==
              undefined &&
            c._votes_mrp < 3
          )
        ) {
          check.push(
            "rate"
          )
        }

        // QTY + PACK
        let qty = 0
        let pack = ""

        if (
          c.quantity
        ) {
          const parsed =
            c.quantity.map(
              parseQtyPack
            )

          const qv =
            vote(
              parsed.map(
                (p) =>
                  p.qty
              ),
              (x) =>
                x > 0 &&
                x < 10000
            )

          qty =
            qv.value

          if (
            !qv.sure ||
            (
              c._votes_quantity !==
                undefined &&
              c._votes_quantity <
                3
            )
          ) {
            check.push(
              "quantity"
            )
          }

          if (
            !hasPackCol
          ) {
            const packs =
              parsed
                .map(
                  (p) =>
                    cleanPackText(
                      p.rest
                    )
                )
                .filter(Boolean)

            pack =
              vote(
                packs.length
                  ? packs
                  : [""],
                (x) => !!x
              ).value
          }
        }

        // Fix size from packing
        const fixSizeFromPack =
          () => {
            const pm =
              String(
                pack || ""
              ).match(
                /^(\d{2,4})ML$/
              )

            const parts =
              name.split(" ")

            const tok =
              parts[
                parts.length - 1
              ] || ""

            if (
              !pm ||
              parts.length <
                2
            ) {
              return
            }

            if (
              /^\d{2,4}ML$/i.test(
                tok
              )
            ) {
              return
            }

            if (
              tok.length <= 7 &&
              /[LlI1]$/.test(
                tok
              ) &&
              /[^A-Za-z]/.test(
                tok.replace(
                  /[)(.]/g,
                  "x"
                )
              )
            ) {
              parts[
                parts.length - 1
              ] =
                pm[1] +
                "ML"

              name =
                parts.join(
                  " "
                )
            }
          }

        if (
          hasPackCol &&
          c.packing
        ) {
          const packs =
            c.packing
              .map(
                cleanPackText
              )
              .filter(Boolean)

          pack =
            vote(
              packs.length
                ? packs
                : [""],
              (x) => !!x
            ).value

          const mls =
            packs
              .filter(
                (p) =>
                  /^\d+ML$/.test(
                    p
                  )
              )
              .sort(
                (a, b) =>
                  b.length -
                  a.length
              )

          if (
            mls.length >= 2 &&
            mls[0].length >
              pack.length &&
            /^\d+ML$/.test(
              pack
            )
          ) {
            pack =
              mls[0]
          }
        }

        fixSizeFromPack()

        if (!pack) {
          check.push(
            "packing"
          )
        }

        // MFR
        const mf =
          (c.mfr || [])
            .map((t) =>
              clean(t)
                .replace(
                  /[^A-Za-z]/g,
                  ""
                )
                .toUpperCase()
            )
            .filter(
              (t) =>
                t.length >= 2
            )

        const mfr =
          mf.length
            ? vote(mf).value
            : ""

        return {
          name,
          mfr,
          batch,
          ex,
          rate:
            mv.value,
          quantity:
            qty,
          packing:
            pack,
          check,
          votes:
            c._votes_expiry,
        }
      }
    )

  // Expiry correction
  const cur =
    new Date().getFullYear()

  const exactYears =
    out.flatMap(
      (r) =>
        r.ex
          .filter(
            (e) =>
              e.ys.length ===
                4 &&
              yearOk(
                Number(
                  e.ys
                )
              )
          )
          .map(
            (e) =>
              Number(
                e.ys
              )
          )
    )

  const medYear =
    median(
      exactYears
    ) ||
    cur + 2

  out.forEach(
    (r) => {
      if (!r.ex.length) {
        r.expiry = ""
        r.check.push(
          "expiry"
        )
        return
      }

      const months =
        r.ex
          .map(
            (e) =>
              e.month
          )
          .filter(
            (m) =>
              m >= 1 &&
              m <= 12
          )

      const mv =
        vote(
          months.map(
            String
          ),
          (x) => !!x
        )

      let bestY = null
      let bestScore = 99

      for (
        let y = cur - 1;
        y <= cur + 8;
        y++
      ) {
        const score =
          r.ex.reduce(
            (s2, e) =>
              s2 +
              yearDist(
                e.ys,
                y
              ),
            0
          ) /
            r.ex.length +
          Math.abs(
            y -
              medYear
          ) *
            0.05

        if (
          score <
          bestScore
        ) {
          bestScore =
            score
          bestY = y
        }
      }

      if (
        mv.value &&
        bestY &&
        bestScore <= 1.6
      ) {
        r.expiry =
          fmtExpiry(
            Number(
              mv.value
            ),
            bestY
          )

        if (
          !mv.sure ||
          bestScore > 0.8 ||
          (
            r.votes !==
              undefined &&
            r.votes < 3
          )
        ) {
          r.check.push(
            "expiry"
          )
        }
      } else {
        r.expiry = ""
        r.check.push(
          "expiry"
        )
      }
    }
  )

  // MFR consensus
  const freq =
    new Map()

  out.forEach(
    (r) =>
      r.mfr &&
      freq.set(
        r.mfr,
        (
          freq.get(
            r.mfr
          ) || 0
        ) + 1
      )
  )

  out.forEach(
    (r) => {
      if (!r.mfr)
        return

      for (
        const [
          k,
          n,
        ] of freq
      ) {
        if (
          k !== r.mfr &&
          n >= 2 &&
          n >
            (
              freq.get(
                r.mfr
              ) || 0
            ) &&
          editDist(
            k,
            r.mfr
          ) <= 1
        ) {
          r.mfr = k
        }
      }
    }
  )

  const merged =
    out.filter(
      (r) =>
        r.name &&
        (
          r.batch ||
          r.expiry ||
          r.rate
        )
    )

  return merged.map(
    (r) => ({
      mfr:
        r.mfr,
      name:
        r.name,
      batch:
        r.batch,
      expiry:
        r.expiry,
      quantity:
        r.quantity,
      rate:
        r.rate,
      packing:
        r.packing,
      _check:
        r.check,
    })
  )
}

/* ---------------------------------------------------------------
   Fallback: header kidaikkaadha bill
--------------------------------------------------------------- */

const EXP_RE =
  /^[^\d]?(\d{1,2})[/\-.](\d{2,4})\W?$/

// IMPORTANT FIX:
// Decimal + whole-number MRP both accepted here.
const isMoney = (
  t
) => {
  const s =
    String(t)
      .trim()
      .replace(
        /,/g,
        ""
      )
      .replace(
        /₹/gi,
        ""
      )
      .replace(
        /\bRs\.?\b/gi,
        ""
      )

  return (
    /^\d{1,6}(?:\.\d{1,2})?$/.test(
      s
    ) &&
    Number(s) > 0
  )
}

export const parseTextLines =
  (
    text,
    knownNames = []
  ) => {
    const rows = []

    const lines =
      String(
        text || ""
      )
        .split(/\r?\n/)
        .map(clean)
        .filter(Boolean)

    for (
      const line of lines
    ) {
      if (
        /invoice|total|remarks|cgst|sgst|gstin|phone|ph\./i.test(
          line
        )
      ) {
        continue
      }

      const tokens =
        line.split(/\s+/)

      const expIdx =
        tokens.findIndex(
          (t) =>
            EXP_RE.test(t) &&
            parseExpiryLoose(
              t
            )
        )

      if (
        expIdx === -1
      ) {
        continue
      }

      const exp =
        parseExpiryLoose(
          tokens[expIdx]
        )

      let fixed = ""

      if (
        exp &&
        exp.month >= 1 &&
        exp.month <= 12
      ) {
        const cur =
          new Date().getFullYear()

        let by = null
        let bs = 99

        for (
          let y =
            cur - 1;
          y <= cur + 8;
          y++
        ) {
          const sc =
            yearDist(
              exp.ys,
              y
            )

          if (
            sc < bs
          ) {
            bs = sc
            by = y
          }
        }

        if (
          by &&
          bs <= 1
        ) {
          fixed =
            fmtExpiry(
              exp.month,
              by
            )
        }
      }

      if (!fixed)
        continue

      const mi =
        tokens.findIndex(
          (t, i) =>
            i > expIdx &&
            isMoney(t)
        )

      const mrp =
        mi !== -1
          ? Number(
              tokens[
                mi
              ].replace(
                /[^\d.]/g,
                ""
              )
            )
          : 0

      let batch = ""

      for (
        let i =
          expIdx - 1;
        i >= 0;
        i--
      ) {
        const b =
          cleanBatch(
            tokens[i]
          )

        if (b) {
          batch = b
          break
        }
      }

      // Leading qty
      let qty = 0
      let k = 0

      if (
        /^\d{1,4}(\+\d{1,4})?$/.test(
          tokens[0]
        )
      ) {
        qty =
          parseQtyPack(
            tokens[0]
          ).qty

        k = 1

        if (
          tokens[1] &&
          /^\d{1,4}\s*(ml|gm|'?s)?$/i.test(
            tokens[1]
          )
        ) {
          k = 2
        }
      }

      const nameTokens = []

      for (
        let i = k;
        i < expIdx;
        i++
      ) {
        const t =
          tokens[i]

        if (
          /^\d{6,}$/.test(
            t
          )
        ) {
          break
        }

        if (
          cleanBatch(t) &&
          i > k + 1 &&
          /\d/.test(t) &&
          /[A-Za-z]/.test(
            t
          )
        ) {
          break
        }

        nameTokens.push(
          t
        )
      }

      const name =
        fixName(
          nameTokens.join(
            " "
          ),
          knownNames
        )

      if (
        !/[A-Za-z]{3}/.test(
          name
        )
      ) {
        continue
      }

      rows.push({
        mfr: "",
        name,
        batch,
        expiry: fixed,
        quantity: qty,
        rate: mrp,
        packing:
          k === 2
            ? cleanPackText(
                tokens[1]
              )
            : "",
      })
    }

    return rows
  }

/* ---------------------------------------------------------------
   Digital text PDF
--------------------------------------------------------------- */

export const rowsFromPdfLines =
  (
    lines,
    knownNames = []
  ) => {
    let cols = null
    let hasPackCol = false
    const cells = []

    for (
      const line of lines
    ) {
      const items =
        line.items.filter(
          (i) =>
            clean(i.str)
        )

      if (!items.length)
        continue

      const hw =
        items.map(
          (i) => ({
            text:
              clean(
                i.str
              ),
            x0: i.x,
            x1:
              i.x +
              (i.w || 0),
          })
        )

      const keys =
        new Set(
          hw
            .map(
              (w) =>
                classifyHeader(
                  w.text
                )
            )
            .filter(
              (f) =>
                KEY_FIELDS.includes(
                  f
                )
            )
        )

      if (
        keys.size >= 3 &&
        (
          keys.has(
            "name"
          ) ||
          keys.has(
            "batch"
          )
        )
      ) {
        cols =
          buildColumns(
            hw
          )

        hasPackCol =
          cols.some(
            (c) =>
              c.field ===
              "packing"
          )

        const maxX =
          Math.max(
            ...items.map(
              (i) =>
                i.x +
                (i.w || 0)
            )
          ) + 300

        cols.forEach(
          (c, i) => {
            c.left =
              i === 0
                ? -Infinity
                : (
                    cols[
                      i - 1
                    ].x1 +
                    c.x0
                  ) /
                    2 -
                  12

            c.right =
              i + 1 <
              cols.length
                ? (
                    c.x1 +
                    cols[
                      i + 1
                    ].x0
                  ) /
                      2 -
                    12
                : maxX
          }
        )

        continue
      }

      if (!cols)
        continue

      if (
        /total/i.test(
          items
            .map(
              (i) =>
                i.str
            )
            .join(" ")
        )
      ) {
        continue
      }

      const row = {}

      for (
        const it of items
      ) {
        const col =
          [...cols]
            .reverse()
            .find(
              (c) =>
                it.x >=
                (
                  c.left ===
                  -Infinity
                    ? -1e9
                    : c.left
                )
            )

        if (
          !col ||
          !KEY_FIELDS.includes(
            col.field
          )
        ) {
          continue
        }

        row[
          col.field
        ] =
          (
            row[
              col.field
            ]
              ? row[
                  col.field
                ] + " "
              : ""
          ) +
          it.str
      }

      const data = {}

      Object.entries(
        row
      ).forEach(
        ([k, v]) => {
          data[k] = [v]
        }
      )

      if (
        data.expiry ||
        data.batch
      ) {
        cells.push(
          data
        )
      } else if (
        cells.length &&
        data.name
      ) {
        cells[
          cells.length - 1
        ].name = [
          cells[
            cells.length - 1
          ].name[0] +
            " " +
            data.name[0],
        ]
      }
    }

    if (!cells.length)
      return []

    return finalizeRows(
      cells,
      {
        hasPackCol,
        knownNames,
        exact: false,
      }
    )
  }