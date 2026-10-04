import { useEffect, useState, useRef } from "react"
import * as XLSX from "xlsx"
import * as pdfjsLib from "pdfjs-dist"
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { createWorker } from "tesseract.js"

import {
  readBillImage,
  rowsFromPdfLines,
  browserEnv,
} from "./billReader"

import {
  readBillWithAI,
  hasApiKey,
} from "./aiBillReader"

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

const STORAGE_KEY = "pharmacyMedicines"
const DRAFT_KEY = "pharmacyImportDraft"

const EMPTY_ROW = {
  mfr: "",
  name: "",
  batch: "",
  expiry: "",
  quantity: "",
  rate: "",
  packing: "",
}

// ======================================================
// HELPERS
// ======================================================

const cleanText = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()

const normalizeHeader = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

const toNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0
  }

  const text = String(value)
    .replace(/,/g, "")
    .replace(/₹/gi, "")
    .replace(/rs\.?/gi, "")
    .replace(/[^\d.-]/g, "")

  const number = Number(text)

  return Number.isFinite(number) ? number : 0
}

const formatExpiry = (value) => {
  if (!value) return ""

  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    return `${String(
      value.getMonth() + 1
    ).padStart(2, "0")}/${String(
      value.getFullYear()
    ).slice(-2)}`
  }

  const text = cleanText(value)

  let match = text.match(
    /^(\d{1,2})[\/.-](\d{2,4})$/
  )

  if (match) {
    return `${String(match[1]).padStart(
      2,
      "0"
    )}/${String(match[2]).slice(-2)}`
  }

  match = text.match(
    /^(\d{2,4})[\/.-](\d{1,2})$/
  )

  if (match) {
    return `${String(match[2]).padStart(
      2,
      "0"
    )}/${String(match[1]).slice(-2)}`
  }

  return text
}

const findHeader = (
  headers,
  possibleNames
) => {
  const normalizedHeaders =
    headers.map(normalizeHeader)

  for (const name of possibleNames) {
    const target = normalizeHeader(name)

    const index =
      normalizedHeaders.indexOf(target)

    if (index !== -1) {
      return index
    }
  }

  return -1
}

// ======================================================
// HEADER NAMES
// ======================================================

const MFR_HEADERS = [
  "mfr",
  "manufacturer",
  "manufactured by",
  "company",
  "brand",
  "manufacturer name",
  "mfg",
  "mfg by",
  "maker",
]

const NAME_HEADERS = [
  "product name",
  "product description",
  "description",
  "medicine name",
  "medicine",
  "product",
  "item name",
  "item",
  "particulars",
  "drug name",
  "name",
  "product",
]

const MRP_HEADERS = [
  "mrp",
  "m.r.p",
  "maximum retail price",
  "rate",
  "price",
  "mrp rate",
]

const EXPIRY_HEADERS = [
  "expiry",
  "expiry date",
  "exp",
  "exp date",
  "exp.",
  "expirydate",
]

const BATCH_HEADERS = [
  "batch",
  "batch no",
  "batch number",
  "b.no",
  "bno",
  "batchno",
]

const QUANTITY_HEADERS = [
  "quantity",
  "qty",
  "qnty",
  "stock",
  "units",
  "count",
  "qty.",
]

const PACKING_HEADERS = [
  "pcking",
  "packg",
  "pkg",
  "pck",
  "pk",
  "pack",
  "packing",
  "packing pack",
  "packing/pack",
  "pack size",
  "package",
  "packaging",
  "pack/packing",
  "pack size",
]

// ======================================================
// NORMALIZE OCR ROW
// ======================================================

const normalizeImportedRow = (row = {}) => {
  const normalized = {
    mfr: cleanText(
      row.mfr ??
        row.manufacturer ??
        row.manufacturedBy ??
        row.company ??
        row.brand ??
        row.mfg ??
        ""
    ),

    name: cleanText(
      row.name ??
        row.productName ??
        row.productDescription ??
        row.description ??
        row.medicineName ??
        row.medicine ??
        row.product ??
        row.itemName ??
        row.item ??
        ""
    ),

    batch: cleanText(
      row.batch ??
        row.batchNo ??
        row.batchNumber ??
        row.bNo ??
        ""
    ),

    expiry: formatExpiry(
      row.expiry ??
        row.expiryDate ??
        row.exp ??
        row.expDate ??
        ""
    ),

    quantity: toNumber(
      row.quantity ??
        row.qty ??
        row.qnty ??
        row.stock ??
        row.units ??
        row.count ??
        0
    ),

    rate: toNumber(
      row.rate ??
        row.mrp ??
        row.price ??
        0
    ),

    packing: cleanText(
      row.packing ??
        row.pack ??
        row.packingPack ??
        row.packSize ??
        row.package ??
        row.packaging ??
        ""
    ),
  }

  return normalized
}

// ======================================================
// PDF TEXT
// ======================================================

const pdfPageToLines = async (page) => {
  const content =
    await page.getTextContent()

  const items = content.items
    .filter((item) =>
      String(item.str).trim()
    )
    .map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      w: item.width || 0,
    }))
    .sort(
      (a, b) =>
        b.y - a.y ||
        a.x - b.x
    )

  const lines = []

  for (const item of items) {
    const last =
      lines[lines.length - 1]

    if (
      last &&
      Math.abs(last.y - item.y) <= 3
    ) {
      last.items.push(item)
    } else {
      lines.push({
        y: item.y,
        items: [item],
      })
    }
  }

  lines.forEach((line) => {
    line.items.sort(
      (a, b) => a.x - b.x
    )
  })

  return lines
}

// ======================================================
// COMPONENT
// ======================================================

function Stock() {
  const [stock, setStock] = useState([])

  const [preview, setPreview] =
    useState(() => {
      try {
        const saved =
          JSON.parse(
            localStorage.getItem(
              DRAFT_KEY
            ) || "[]"
          )

        return Array.isArray(saved)
          ? saved.map(normalizeImportedRow)
          : []
      } catch {
        return []
      }
    })

  const [uploading, setUploading] =
    useState(false)

  const [uploadStatus, setUploadStatus] =
    useState("")

  const metaRef = useRef(null)

  // ====================================================
  // SAVE PREVIEW DRAFT
  // ====================================================

  useEffect(() => {
    if (preview.length > 0) {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify(preview)
      )
    } else {
      localStorage.removeItem(DRAFT_KEY)
    }
  }, [preview])

  // ====================================================
  // LOAD STOCK
  // ====================================================

  const loadStock = () => {
    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        )

      if (!saved) {
        setStock([])
        return
      }

      const parsed = JSON.parse(saved)

      if (!Array.isArray(parsed)) {
        setStock([])
        return
      }

      const formatted = parsed
        .map((item) =>
          normalizeImportedRow(item)
        )
        .filter(
          (item) => item.name
        )

      setStock(formatted)
    } catch (error) {
      console.error(
        "LOAD STOCK ERROR:",
        error
      )

      setStock([])
    }
  }

  // ====================================================
  // SAVE STOCK
  // ====================================================

  const saveStock = (newStock) => {
    try {
      const cleaned = newStock
        .map((item) =>
          normalizeImportedRow(item)
        )
        .filter(
          (item) => item.name
        )

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(cleaned)
      )

      setStock(cleaned)

      return true
    } catch (error) {
      console.error(
        "SAVE STOCK ERROR:",
        error
      )

      setUploadStatus(
        "Save failed."
      )

      return false
    }
  }

  // ====================================================
  // INITIAL LOAD + SHORTCUT
  // ====================================================

  useEffect(() => {
    loadStock()

    const handleShortcut = (event) => {
      if (
        event.ctrlKey &&
        event.key === "Delete"
      ) {
        event.preventDefault()

        const ok = window.confirm(
          "Are you sure you want to delete ALL stock?"
        )

        if (!ok) return

        try {
          localStorage.removeItem(
            STORAGE_KEY
          )

          setStock([])

          setUploadStatus(
            "All stock deleted successfully."
          )

          setTimeout(() => {
            setUploadStatus("")
          }, 2500)
        } catch (error) {
          console.error(
            "DELETE ALL ERROR:",
            error
          )

          setUploadStatus(
            "Unable to delete all stock."
          )
        }
      }
    }

    window.addEventListener(
      "keydown",
      handleShortcut
    )

    return () => {
      window.removeEventListener(
        "keydown",
        handleShortcut
      )
    }
  }, [])

  // ====================================================
  // UPDATE STOCK
  // ====================================================

  const updateStockField = (
    index,
    field,
    value
  ) => {
    const updated = stock.map(
      (item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
            }
          : item
    )

    saveStock(updated)
  }

  // ====================================================
  // ADD MEDICINE
  // ====================================================

  const addMedicine = () => {
    const newItem = {
      ...EMPTY_ROW,
    }

    const updated = [
      ...stock,
      newItem,
    ]

    setStock(updated)

    // Empty row shouldn't be saved yet.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    )
  }

  // ====================================================
  // QUANTITY
  // ====================================================

  const changeStock = (
    index,
    amount
  ) => {
    const updated = stock.map(
      (item, i) => {
        if (i !== index) {
          return item
        }

        return {
          ...item,
          quantity: Math.max(
            0,
            Number(
              item.quantity || 0
            ) + amount
          ),
        }
      }
    )

    saveStock(updated)
  }

  // ====================================================
  // DELETE SINGLE STOCK
  // ====================================================

  const deleteStock = (index) => {
    const ok = window.confirm(
      "Are you sure you want to delete this stock?"
    )

    if (!ok) return

    const updated =
      stock.filter(
        (_, i) => i !== index
      )

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    )

    setStock(updated)

    setUploadStatus(
      "Stock deleted successfully."
    )

    setTimeout(() => {
      setUploadStatus("")
    }, 2000)
  }

  // ====================================================
  // SAVE CHANGES
  // ====================================================

  const saveCurrentChanges = () => {
    const success =
      saveStock(stock)

    if (success) {
      setUploadStatus(
        "Stock details saved successfully."
      )

      setTimeout(() => {
        setUploadStatus("")
      }, 2500)
    }
  }

  // ====================================================
  // EXCEL / CSV READER
  // ====================================================

  const readExcel = async (file) => {
    const buffer =
      await file.arrayBuffer()

    const workbook =
      XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      })

    const firstSheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ]

    if (!firstSheet) return []

    const rows =
      XLSX.utils.sheet_to_json(
        firstSheet,
        {
          header: 1,
          defval: "",
        }
      )

    if (!rows.length) return []

    let headerRow = -1

    for (
      let i = 0;
      i < Math.min(rows.length, 30);
      i++
    ) {
      const row = rows[i] || []

      if (
        findHeader(
          row,
          NAME_HEADERS
        ) !== -1
      ) {
        headerRow = i
        break
      }
    }

    if (headerRow === -1) {
      return []
    }

    const headers =
      rows[headerRow].map(cleanText)

    const mfrIndex =
      findHeader(
        headers,
        MFR_HEADERS
      )

    const nameIndex =
      findHeader(
        headers,
        NAME_HEADERS
      )

    const mrpIndex =
      findHeader(
        headers,
        MRP_HEADERS
      )

    const expiryIndex =
      findHeader(
        headers,
        EXPIRY_HEADERS
      )

    const batchIndex =
      findHeader(
        headers,
        BATCH_HEADERS
      )

    const quantityIndex =
      findHeader(
        headers,
        QUANTITY_HEADERS
      )

    const packingIndex =
      findHeader(
        headers,
        PACKING_HEADERS
      )

    const imported = []

    for (
      let i = headerRow + 1;
      i < rows.length;
      i++
    ) {
      const row = rows[i]

      if (!row || !row.length) {
        continue
      }

      const item =
        normalizeImportedRow({
          mfr:
            mfrIndex !== -1
              ? row[mfrIndex]
              : "",

          name:
            nameIndex !== -1
              ? row[nameIndex]
              : "",

          batch:
            batchIndex !== -1
              ? row[batchIndex]
              : "",

          expiry:
            expiryIndex !== -1
              ? row[expiryIndex]
              : "",

          quantity:
            quantityIndex !== -1
              ? row[quantityIndex]
              : 0,

          rate:
            mrpIndex !== -1
              ? row[mrpIndex]
              : 0,

          packing:
            packingIndex !== -1
              ? row[packingIndex]
              : "",
        })

      if (item.name) {
        imported.push(item)
      }
    }

    return imported
  }

  // ====================================================
  // PRODUCT SPELLING
  // ====================================================

  const correctProductName = (
    name,
    knownNames
  ) => {
    const original =
      cleanText(name)

    if (
      !original ||
      !Array.isArray(knownNames) ||
      !knownNames.length
    ) {
      return original
    }

    const normalize = (value) =>
      cleanText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")

    const target =
      normalize(original)

    const exact =
      knownNames.find(
        (item) =>
          normalize(item) === target
      )

    if (exact) {
      return cleanText(exact)
    }

    return original
  }

  // ====================================================
  // PHOTO / OCR
  // ====================================================

  const readPhoto = async (source) => {
    // AI first
    if (hasApiKey()) {
      try {
        const result =
          await readBillWithAI(
            source,
            setUploadStatus
          )

        if (
          result?.rows?.length
        ) {
          metaRef.current =
            result.meta

          const names =
            stock
              .map(
                (item) => item.name
              )
              .filter(Boolean)

          return result.rows
            .map((row) => {
              const normalized =
                normalizeImportedRow(
                  row
                )

              return {
                ...normalized,
                name:
                  correctProductName(
                    normalized.name,
                    names
                  ),
              }
            })
            .filter(
              (row) => row.name
            )
        }
      } catch (error) {
        console.error(
          "AI READ ERROR:",
          error
        )

        setUploadStatus(
          "AI reading failed. OCR mode-la read pannudhu..."
        )
      }
    }

    // OCR
    const result =
      await readBillImage(
        source,
        {
          env: browserEnv(
            createWorker
          ),

          onStatus:
            setUploadStatus,

          knownNames:
            stock
              .map(
                (item) => item.name
              )
              .filter(Boolean),
        }
      )

    metaRef.current =
      result.meta

    const names =
      stock
        .map(
          (item) => item.name
        )
        .filter(Boolean)

    return (result.rows || [])
      .map((row) => {
        const normalized =
          normalizeImportedRow(
            row
          )

        return {
          ...normalized,
          name:
            correctProductName(
              normalized.name,
              names
            ),
        }
      })
      .filter(
        (row) => row.name
      )
  }

  // ====================================================
  // PDF READER
  // ====================================================

  const readPdfRows = async (file) => {
    if (hasApiKey()) {
      try {
        const result =
          await readBillWithAI(
            file,
            setUploadStatus
          )

        if (
          result?.rows?.length
        ) {
          metaRef.current =
            result.meta

          return result.rows
            .map(
              normalizeImportedRow
            )
            .filter(
              (row) => row.name
            )
        }
      } catch (error) {
        console.error(
          "AI PDF ERROR:",
          error
        )
      }
    }

    const buffer =
      await file.arrayBuffer()

    const pdf =
      await pdfjsLib
        .getDocument({
          data: buffer,
        })
        .promise

    const names =
      stock
        .map(
          (item) => item.name
        )
        .filter(Boolean)

    let allLines = []

    for (
      let pageNo = 1;
      pageNo <= pdf.numPages;
      pageNo++
    ) {
      const page =
        await pdf.getPage(pageNo)

      const lines =
        await pdfPageToLines(
          page
        )

      allLines =
        allLines.concat(lines)
    }

    let digitalRows = []

    try {
      digitalRows =
        rowsFromPdfLines(
          allLines,
          names
        )
          .map(normalizeImportedRow)
          .filter(
            (row) => row.name
          )
    } catch (error) {
      console.error(
        "PDF TEXT ERROR:",
        error
      )
    }

    // If digital PDF gives useful rows,
    // use them.
    if (
      digitalRows.length > 0 &&
      digitalRows.some(
        (row) =>
          row.name &&
          (
            row.batch ||
            row.expiry ||
            row.quantity ||
            row.rate ||
            row.mfr ||
            row.packing
          )
      )
    ) {
      return digitalRows
    }

    // OCR fallback
    let ocrRows = []

    for (
      let pageNo = 1;
      pageNo <= pdf.numPages;
      pageNo++
    ) {
      setUploadStatus(
        `Reading PDF page ${pageNo}/${pdf.numPages} with OCR...`
      )

      const page =
        await pdf.getPage(pageNo)

      const viewport =
        page.getViewport({
          scale: 3,
        })

      const canvas =
        document.createElement(
          "canvas"
        )

      canvas.width =
        Math.ceil(
          viewport.width
        )

      canvas.height =
        Math.ceil(
          viewport.height
        )

      const context =
        canvas.getContext(
          "2d",
          {
            willReadFrequently: true,
          }
        )

      await page.render({
        canvasContext: context,
        viewport,
      }).promise

      const rows =
        await readPhoto(canvas)

      ocrRows =
        ocrRows.concat(rows)
    }

    return ocrRows
      .map(normalizeImportedRow)
      .filter(
        (row) => row.name
      )
  }

  // ====================================================
  // PREVIEW UPDATE
  // ====================================================

  const updatePreview = (
    index,
    field,
    value
  ) => {
    setPreview((rows) =>
      rows.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    )
  }

  // ====================================================
  // DELETE PREVIEW ROW
  // ====================================================

  const deletePreviewRow = (index) => {
    setPreview((rows) =>
      rows.filter(
        (_, i) => i !== index
      )
    )
  }

  // ====================================================
  // EXPORT PREVIEW → EXCEL
  // ====================================================

  const exportPreviewToExcel = () => {
    if (!preview.length) {
      setUploadStatus(
        "Export panna items illa."
      )
      return
    }

    const rows = preview
      .map(normalizeImportedRow)
      .filter(
        (row) => row.name
      )

    if (!rows.length) {
      setUploadStatus(
        "Valid medicine details illa."
      )
      return
    }

    const excelRows = rows.map(
      (row, index) => ({
        "S.No": index + 1,
        "MFR.": row.mfr,
        "Product Name": row.name,
        MRP: row.rate || "",
        "Expiry Date":
          row.expiry,
        "Batch No": row.batch,
        Quantity:
          row.quantity || "",
        "Packing / Pack":
          row.packing,
      })
    )

    const worksheet =
      XLSX.utils.json_to_sheet(
        excelRows
      )

    worksheet["!cols"] = [
      { wch: 7 },
      { wch: 20 },
      { wch: 35 },
      { wch: 12 },
      { wch: 15 },
      { wch: 18 },
      { wch: 12 },
      { wch: 18 },
    ]

    const workbook =
      XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Stock"
    )

    const now =
      new Date()

    const date =
      `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`

    XLSX.writeFile(
      workbook,
      `Kavi_Medicals_Stock_${date}.xlsx`
    )

    setUploadStatus(
      "Excel file exported successfully."
    )

    setTimeout(() => {
      setUploadStatus("")
    }, 3000)
  }

  // ====================================================
  // CONFIRM IMPORT
  // ====================================================

  const confirmImport = () => {
    const valid =
      preview
        .map(
          normalizeImportedRow
        )
        .filter(
          (item) => item.name
        )

    if (!valid.length) {
      setUploadStatus(
        "No valid medicine found."
      )
      return
    }

    let currentStock = []

    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        )

      if (saved) {
        const parsed =
          JSON.parse(saved)

        if (
          Array.isArray(parsed)
        ) {
          currentStock =
            parsed
              .map(
                normalizeImportedRow
              )
              .filter(
                (item) =>
                  item.name
              )
        }
      }
    } catch (error) {
      console.error(
        "STORAGE READ ERROR:",
        error
      )
    }

    const updated = [
      ...currentStock,
    ]

    valid.forEach((item) => {
      const existingIndex =
        updated.findIndex(
          (existing) =>
            cleanText(
              existing.name
            ).toLowerCase() ===
              cleanText(
                item.name
              ).toLowerCase() &&
            cleanText(
              existing.batch
            ).toLowerCase() ===
              cleanText(
                item.batch
              ).toLowerCase()
        )

      if (
        existingIndex !== -1
      ) {
        const existing =
          updated[
            existingIndex
          ]

        updated[
          existingIndex
        ] = {
          ...existing,

          mfr:
            item.mfr ||
            existing.mfr,

          expiry:
            item.expiry ||
            existing.expiry,

          quantity:
            Number(
              existing.quantity ||
                0
            ) +
            Number(
              item.quantity ||
                0
            ),

          rate:
            Number(item.rate) > 0
              ? Number(item.rate)
              : Number(
                  existing.rate ||
                    0
                ),

          packing:
            item.packing ||
            existing.packing,
        }
      } else {
        updated.push({
          ...item,
        })
      }
    })

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updated)
      )

      setStock(updated)

      setPreview([])

      setUploadStatus(
        `${valid.length} medicine item(s) saved successfully.`
      )

      setTimeout(() => {
        setUploadStatus("")
      }, 3000)
    } catch (error) {
      console.error(
        "IMPORT SAVE ERROR:",
        error
      )

      setUploadStatus(
        "Unable to save imported medicines."
      )
    }
  }

  // ====================================================
  // FILE UPLOAD
  // ====================================================

  const handleFileUpload =
    async (event) => {
      const file =
        event.target.files?.[0]

      if (!file) return

      setUploading(true)
      setPreview([])
      metaRef.current = null

      setUploadStatus(
        "Reading stock bill..."
      )

      try {
        const fileName =
          file.name.toLowerCase()

        let imported = []

        // Excel
        if (
          fileName.endsWith(
            ".xlsx"
          ) ||
          fileName.endsWith(
            ".xls"
          ) ||
          fileName.endsWith(
            ".csv"
          )
        ) {
          imported =
            await readExcel(file)
        }

        // PDF
        else if (
          fileName.endsWith(".pdf")
        ) {
          imported =
            await readPdfRows(file)
        }

        // Image
        else if (
          /\.(jpg|jpeg|png|webp)$/i.test(
            fileName
          )
        ) {
          imported =
            await readPhoto(file)
        }

        else {
          throw new Error(
            "Unsupported file format."
          )
        }

        imported =
          imported
            .map(
              normalizeImportedRow
            )
            .filter(
              (row) => row.name
            )

        if (!imported.length) {
          setPreview([
            {
              ...EMPTY_ROW,
            },
          ])

          setUploadStatus(
            "Medicine details detect panna mudiyala. Preview-la manually enter pannunga."
          )
        } else {
          const meta =
            metaRef.current

          let message =
            `${imported.length} medicine item(s) detected. Check and click Add to Stock.`

          if (
            meta?.expectedItems &&
            meta.expectedItems !==
              imported.length
          ) {
            message +=
              ` Bill-la ${meta.expectedItems} items expected, ${imported.length} detected.`
          }

          setPreview(imported)

          setUploadStatus(message)
        }
      } catch (error) {
        console.error(
          "UPLOAD ERROR:",
          error
        )

        setPreview([])

        setUploadStatus(
          `Unable to read the stock bill: ${
            error?.message ||
            "unknown error"
          }`
        )
      } finally {
        setUploading(false)

        event.target.value = ""
      }
    }

  // ====================================================
  // STYLES
  // ====================================================

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1150px",
    background: "#fff",
  }

  const headerCellStyle = {
    border: "1px solid #777",
    padding: "12px 10px",
    background: "#e8f1f8",
    color: "#123c69",
    textAlign: "center",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  }

  const bodyCellStyle = {
    border: "1px solid #999",
    padding: "10px",
    textAlign: "center",
    verticalAlign: "middle",
    background: "#fff",
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "7px 8px",
    border: "1px solid #bbb",
    borderRadius: "4px",
    outline: "none",
  }

  const buttonStyle = {
    border: "1px solid #999",
    padding: "8px 13px",
    borderRadius: "5px",
    cursor: "pointer",
  }

  const previewCols = [
    ["mfr", "MFR."],
    ["name", "Product Name"],
    ["rate", "MRP"],
    ["expiry", "Expiry Date"],
    ["batch", "Batch No"],
    ["quantity", "Quantity"],
    ["packing", "Packing / Pack"],
  ]

  // ====================================================
  // UI
  // ====================================================

  return (
    <div
      style={{
        padding: "20px",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      {/* BACK */}

      <button
        onClick={() => {
          window.history.pushState(
            {},
            "",
            "/"
          )

          window.location.reload()
        }}
        style={{
          marginBottom: "15px",
          padding: "9px 16px",
          border:
            "1px solid #2563eb",
          borderRadius: "5px",
          background: "#fff",
          color: "#2563eb",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        ← Back to Dashboard
      </button>

      {/* TITLE */}

      <h2
        style={{
          color: "#123c69",
          marginBottom: "20px",
        }}
      >
        Stock Management
      </h2>

      {/* IMPORT */}

      <div
        style={{
          border:
            "2px dashed #aaa",
          padding: "25px",
          borderRadius: "10px",
          textAlign: "center",
          marginBottom: "20px",
        }}
      >
        <h3>
          Import Stock Bill
        </h3>

        <p>
          Upload Excel, CSV, PDF
          or Image stock bill
        </p>

        <p
          style={{
            fontSize: "13px",
            color: "#666",
          }}
        >
          MFR., Product Name,
          MRP, Expiry Date,
          Batch No, Quantity
          and Packing / Pack
          will be detected.
        </p>

        <input
          type="file"
          accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp"
          onChange={
            handleFileUpload
          }
          disabled={uploading}
        />

        {uploading && (
          <p>
            Reading bill...
            Please wait.
          </p>
        )}

        {uploadStatus && (
          <p
            style={{
              marginTop: "10px",
              fontWeight: "500",
            }}
          >
            {uploadStatus}
          </p>
        )}
      </div>

      {/* PREVIEW */}

      {preview.length > 0 && (
        <div
          style={{
            marginBottom: "25px",
          }}
        >
          <h3>
            Check Imported Items
          </h3>

          <div
            style={{
              overflowX: "auto",
              border:
                "1px solid #777",
            }}
          >
            <table
              style={tableStyle}
            >
              <thead>
                <tr>
                  {previewCols.map(
                    ([key, label]) => (
                      <th
                        key={key}
                        style={
                          headerCellStyle
                        }
                      >
                        {label}
                      </th>
                    )
                  )}

                  <th
                    style={
                      headerCellStyle
                    }
                  >
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {preview.map(
                  (row, index) => (
                    <tr
                      key={index}
                    >
                      {previewCols.map(
                        ([key]) => (
                          <td
                            key={key}
                            style={
                              bodyCellStyle
                            }
                          >
                            <input
                              type={
                                key ===
                                  "rate" ||
                                key ===
                                  "quantity"
                                  ? "number"
                                  : "text"
                              }
                              step={
                                key ===
                                "rate"
                                  ? "0.01"
                                  : undefined
                              }
                              style={
                                inputStyle
                              }
                              value={
                                row[
                                  key
                                ] ??
                                ""
                              }
                              onChange={(
                                e
                              ) =>
                                updatePreview(
                                  index,
                                  key,
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>
                        )
                      )}

                      <td
                        style={
                          bodyCellStyle
                        }
                      >
                        <button
                          onClick={() =>
                            deletePreviewRow(
                              index
                            )
                          }
                          style={{
                            ...buttonStyle,
                            background:
                              "#dc2626",
                            color:
                              "#fff",
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* PREVIEW BUTTONS */}

          <div
            style={{
              marginTop: "12px",
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() =>
                setPreview(
                  (rows) => [
                    ...rows,
                    {
                      ...EMPTY_ROW,
                    },
                  ]
                )
              }
              style={{
                ...buttonStyle,
                background:
                  "#2563eb",
                color: "#fff",
              }}
            >
              + Add Row
            </button>

            <button
              onClick={
                confirmImport
              }
              style={{
                ...buttonStyle,
                background:
                  "#087f5b",
                color: "#fff",
                fontWeight: "bold",
              }}
            >
              Add to Stock
            </button>

            {/* NEW: PIC/OCR → EXCEL */}

            <button
              onClick={
                exportPreviewToExcel
              }
              style={{
                ...buttonStyle,
                background:
                  "#16a34a",
                color: "#fff",
                fontWeight: "bold",
              }}
            >
              📊 Export to Excel
            </button>

            <button
              onClick={() =>
                setPreview([])
              }
              style={buttonStyle}
            >
              Cancel
            </button>
          </div>

          <p
            style={{
              fontSize: "12px",
              color: "#666",
              marginTop: "8px",
            }}
          >
            Picture upload pannina,
            OCR-la detect aana details
            inga check/edit pannitu
            <b> Export to Excel </b>
            click pannalaam.
          </p>
        </div>
      )}

      {/* CURRENT STOCK */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: "10px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h3
          style={{
            margin: 0,
            color: "#123c69",
          }}
        >
          Current Stock
        </h3>

        <div
          style={{
            display: "flex",
            gap: "8px",
          }}
        >
          <button
            onClick={addMedicine}
            style={{
              ...buttonStyle,
              background:
                "#087f5b",
              color: "#fff",
              fontWeight: "bold",
            }}
          >
            + Add Medicine
          </button>

          <button
            onClick={
              saveCurrentChanges
            }
            style={{
              ...buttonStyle,
              background:
                "#2563eb",
              color: "#fff",
              fontWeight: "bold",
            }}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* STOCK TABLE */}

      <div
        style={{
          overflowX: "auto",
          border:
            "1px solid #777",
          borderRadius: "5px",
        }}
      >
        <table
          style={tableStyle}
        >
          <thead>
            <tr>
              {[
                "S.No",
                "MFR.",
                "Product Name",
                "MRP",
                "Expiry Date",
                "Batch No",
                "Quantity",
                "Packing / Pack",
                "Action",
              ].map((title) => (
                <th
                  key={title}
                  style={
                    headerCellStyle
                  }
                >
                  {title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {stock.length === 0 ? (
              <tr>
                <td
                  colSpan="9"
                  style={{
                    ...bodyCellStyle,
                    padding: "25px",
                  }}
                >
                  No stock available
                </td>
              </tr>
            ) : (
              stock.map(
                (item, index) => (
                  <tr
                    key={`${item.name}-${item.batch}-${index}`}
                  >
                    {/* S.NO */}

                    <td
                      style={{
                        ...bodyCellStyle,
                        fontWeight:
                          "bold",
                        width: "60px",
                      }}
                    >
                      {index + 1}
                    </td>

                    {/* MFR */}

                    <td
                      style={{
                        ...bodyCellStyle,
                        minWidth:
                          "150px",
                      }}
                    >
                      <input
                        style={
                          inputStyle
                        }
                        value={
                          item.mfr ||
                          ""
                        }
                        onChange={(e) =>
                          updateStockField(
                            index,
                            "mfr",
                            e.target
                              .value
                          )
                        }
                      />
                    </td>

                    {/* NAME */}

                    <td
                      style={{
                        ...bodyCellStyle,
                        minWidth:
                          "220px",
                      }}
                    >
                      <input
                        style={
                          inputStyle
                        }
                        value={
                          item.name ||
                          ""
                        }
                        onChange={(e) =>
                          updateStockField(
                            index,
                            "name",
                            e.target
                              .value
                          )
                        }
                      />
                    </td>

                    {/* MRP */}

                    <td
                      style={{
                        ...bodyCellStyle,
                        minWidth:
                          "130px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          gap: "3px",
                        }}
                      >
                        <strong>
                          ₹
                        </strong>

                        <input
                          type="number"
                          step="0.01"
                          style={{
                            ...inputStyle,
                            width:
                              "90px",
                          }}
                          value={
                            item.rate ??
                            ""
                          }
                          onChange={(
                            e
                          ) =>
                            updateStockField(
                              index,
                              "rate",
                              e.target
                                .value
                            )
                          }
                        />
                      </div>
                    </td>

                    {/* EXPIRY */}

                    <td
                      style={{
                        ...bodyCellStyle,
                        minWidth:
                          "130px",
                      }}
                    >
                      <input
                        style={{
                          ...inputStyle,
                          textAlign:
                            "center",
                        }}
                        value={
                          item.expiry ||
                          ""
                        }
                        placeholder="MM/YY"
                        onChange={(e) =>
                          updateStockField(
                            index,
                            "expiry",
                            e.target
                              .value
                          )
                        }
                      />
                    </td>

                    {/* BATCH */}

                    <td
                      style={{
                        ...bodyCellStyle,
                        minWidth:
                          "130px",
                      }}
                    >
                      <input
                        style={
                          inputStyle
                        }
                        value={
                          item.batch ||
                          ""
                        }
                        onChange={(e) =>
                          updateStockField(
                            index,
                            "batch",
                            e.target
                              .value
                          )
                        }
                      />
                    </td>

                    {/* QUANTITY */}

                    <td
                      style={{
                        ...bodyCellStyle,
                        minWidth:
                          "150px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          gap: "5px",
                        }}
                      >
                        <button
                          onClick={() =>
                            changeStock(
                              index,
                              -1
                            )
                          }
                          style={{
                            ...buttonStyle,
                            padding:
                              "5px 9px",
                          }}
                        >
                          −
                        </button>

                        <span
                          style={{
                            minWidth:
                              "40px",
                            textAlign:
                              "center",
                            fontWeight:
                              "bold",
                          }}
                        >
                          {
                            item.quantity
                          }
                        </span>

                        <button
                          onClick={() =>
                            changeStock(
                              index,
                              1
                            )
                          }
                          style={{
                            ...buttonStyle,
                            padding:
                              "5px 9px",
                          }}
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* PACKING */}

                    <td
                      style={{
                        ...bodyCellStyle,
                        minWidth:
                          "150px",
                      }}
                    >
                      <input
                        style={
                          inputStyle
                        }
                        value={
                          item.packing ||
                          ""
                        }
                        placeholder="e.g. 10's"
                        onChange={(e) =>
                          updateStockField(
                            index,
                            "packing",
                            e.target
                              .value
                          )
                        }
                      />
                    </td>

                    {/* DELETE */}

                    <td
                      style={{
                        ...bodyCellStyle,
                        minWidth:
                          "100px",
                      }}
                    >
                      <button
                        onClick={() =>
                          deleteStock(
                            index
                          )
                        }
                        style={{
                          ...buttonStyle,
                          background:
                            "#dc2626",
                          color:
                            "#fff",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      <p
        style={{
          marginTop: "15px",
          fontSize: "13px",
          color: "#666",
        }}
      >
        Tip: Press{" "}
        <b>Ctrl + Delete</b>{" "}
        to delete all stock.
      </p>
    </div>
  )
}

export default Stock