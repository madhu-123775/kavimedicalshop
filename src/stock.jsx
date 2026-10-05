import { useEffect, useMemo, useState } from "react"
import { supabase } from "./supabaseClient"

const EMPTY_ROW = {
  mfr: "",
  name: "",
  rate: "",
  expiry: "",
  batch: "",
  quantity: "",
  packing: "",
}

function Stock() {
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [searchText, setSearchText] = useState("")

  const [newMedicine, setNewMedicine] =
    useState({ ...EMPTY_ROW })

  const [message, setMessage] = useState("")

  // =====================================================
  // LOAD STOCK FROM SUPABASE
  // =====================================================

  const loadStock = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from("stock")
        .select("*")
        .order("created_at", {
          ascending: true,
        })

      if (error) {
        console.error(
          "LOAD STOCK ERROR:",
          error
        )

        alert(
          "Unable to load stock: " +
            error.message
        )

        return
      }

      const formatted = (data || []).map(
        (item) => ({
          id: item.id,
          sno: item["s.no"] ?? "",
          mfr: item.mfr ?? "",
          name: item["product name"] ?? "",
          rate: item.MRP ?? "",
          expiry: item["expiry date"] ?? "",
          batch: item["batch no"] ?? "",
          quantity: item.quantity ?? 0,
          packing: item["packing/pack"] ?? "",
        })
      )

      setStock(formatted)
    } catch (error) {
      console.error(
        "LOAD STOCK EXCEPTION:",
        error
      )

      alert(
        "Something went wrong while loading stock."
      )
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadStock()
  }, [])

  // =====================================================
  // MESSAGE
  // =====================================================

  const showMessage = (text) => {
    setMessage(text)

    setTimeout(() => {
      setMessage("")
    }, 2500)
  }

  // =====================================================
  // ADD MEDICINE - OPEN EMPTY ROW
  // =====================================================

  const addMedicine = () => {
    setNewMedicine({
      ...EMPTY_ROW,
    })

    showMessage(
      "Enter medicine details below."
    )

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  // =====================================================
  // NEW MEDICINE INPUT
  // =====================================================

  const handleNewMedicineChange = (
    field,
    value
  ) => {
    setNewMedicine((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // =====================================================
  // ADD TO STOCK / SUPABASE
  // =====================================================

  const addToStock = async () => {
    const name =
      newMedicine.name.trim()

    if (!name) {
      alert(
        "Please enter Product Name."
      )
      return
    }

    try {
      setSaving(true)

      // Find next S.No
      const nextSno =
        stock.length > 0
          ? Math.max(
              ...stock.map(
                (item) =>
                  Number(item.sno) || 0
              )
            ) + 1
          : 1

      const insertData = {
        "s.no": nextSno,
        mfr:
          newMedicine.mfr.trim(),
        "product name": name,
        MRP:
          Number(newMedicine.rate) || 0,
        "expiry date":
          newMedicine.expiry.trim(),
        "batch no":
          newMedicine.batch.trim(),
        quantity:
          Number(
            newMedicine.quantity
          ) || 0,
        "packing/pack":
          newMedicine.packing.trim(),
      }

      console.log(
        "INSERTING STOCK:",
        insertData
      )

      const { data, error } =
        await supabase
          .from("stock")
          .insert(insertData)
          .select()
          .single()

      if (error) {
        console.error(
          "ADD STOCK ERROR:",
          error
        )

        alert(
          "Unable to add stock:\n\n" +
            error.message
        )

        return
      }

      console.log(
        "STOCK ADDED:",
        data
      )

      // Add immediately to screen
      const addedItem = {
        id: data.id,
        sno: data["s.no"],
        mfr: data.mfr || "",
        name:
          data["product name"] || "",
        rate: data.MRP || 0,
        expiry:
          data["expiry date"] || "",
        batch:
          data["batch no"] || "",
        quantity:
          data.quantity || 0,
        packing:
          data["packing/pack"] || "",
      }

      setStock((prev) => [
        ...prev,
        addedItem,
      ])

      // Clear form
      setNewMedicine({
        ...EMPTY_ROW,
      })

      showMessage(
        "Medicine added to stock successfully."
      )
    } catch (error) {
      console.error(
        "ADD STOCK EXCEPTION:",
        error
      )

      alert(
        "Something went wrong while adding stock."
      )
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // UPDATE EXISTING STOCK FIELD
  // =====================================================

  const updateStockField = async (
    id,
    field,
    value
  ) => {
    try {
      let column = field
      let databaseValue = value

      if (field === "name") {
        column = "product name"
      }

      if (field === "rate") {
        column = "MRP"
        databaseValue =
          Number(value) || 0
      }

      if (field === "expiry") {
        column = "expiry date"
      }

      if (field === "batch") {
        column = "batch no"
      }

      if (field === "packing") {
        column = "packing/pack"
      }

      if (field === "quantity") {
        databaseValue =
          Number(value) || 0
      }

      const { error } =
        await supabase
          .from("stock")
          .update({
            [column]: databaseValue,
          })
          .eq("id", id)

      if (error) {
        console.error(
          "UPDATE STOCK ERROR:",
          error
        )

        alert(
          "Unable to update stock:\n\n" +
            error.message
        )

        return
      }

      setStock((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                [field]:
                  databaseValue,
              }
            : item
        )
      )
    } catch (error) {
      console.error(
        "UPDATE STOCK EXCEPTION:",
        error
      )
    }
  }

  // =====================================================
  // CHANGE QUANTITY
  // =====================================================

  const changeQuantity = async (
    item,
    amount
  ) => {
    const current =
      Number(item.quantity) || 0

    const newQuantity = Math.max(
      0,
      current + amount
    )

    await updateStockField(
      item.id,
      "quantity",
      newQuantity
    )
  }

  // =====================================================
  // DELETE STOCK
  // =====================================================

  const deleteStock = async (item) => {
    const ok = window.confirm(
      `Delete "${item.name}" from stock?`
    )

    if (!ok) return

    try {
      const { error } =
        await supabase
          .from("stock")
          .delete()
          .eq("id", item.id)

      if (error) {
        console.error(
          "DELETE STOCK ERROR:",
          error
        )

        alert(
          "Unable to delete stock:\n\n" +
            error.message
        )

        return
      }

      setStock((prev) =>
        prev.filter(
          (stockItem) =>
            stockItem.id !== item.id
        )
      )

      showMessage(
        "Stock deleted successfully."
      )
    } catch (error) {
      console.error(
        "DELETE STOCK EXCEPTION:",
        error
      )
    }
  }

  // =====================================================
  // SEARCH
  // Product Name
  // MFR
  // Batch
  // Expiry
  // MRP
  // Quantity
  // Packing / Pack
  // =====================================================

  const filteredStock = useMemo(() => {
    const search =
      searchText
        .trim()
        .toLowerCase()

    if (!search) {
      return stock
    }

    return stock.filter(
      (item) => {
        const productName =
          String(
            item.name || ""
          ).toLowerCase()

        const mfr =
          String(
            item.mfr || ""
          ).toLowerCase()

        const batch =
          String(
            item.batch || ""
          ).toLowerCase()

        const expiry =
          String(
            item.expiry || ""
          ).toLowerCase()

        const mrp =
          String(
            item.rate ?? ""
          ).toLowerCase()

        const quantity =
          String(
            item.quantity ?? ""
          ).toLowerCase()

        const packing =
          String(
            item.packing || ""
          ).toLowerCase()

        return (
          productName.includes(search) ||
          mfr.includes(search) ||
          batch.includes(search) ||
          expiry.includes(search) ||
          mrp.includes(search) ||
          quantity.includes(search) ||
          packing.includes(search)
        )
      }
    )
  }, [stock, searchText])

  // =====================================================
  // STYLES
  // =====================================================

  const pageStyle = {
    minHeight: "100vh",
    background: "#eef7f4",
    padding: "30px",
    fontFamily:
      "Arial, sans-serif",
    color: "#123c69",
  }

  const containerStyle = {
    maxWidth: "1400px",
    margin: "0 auto",
  }

  const cardStyle = {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
    boxShadow:
      "0 3px 12px rgba(0,0,0,0.08)",
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border:
      "1px solid #cbd5e1",
    borderRadius: "6px",
    outline: "none",
    fontSize: "14px",
  }

  const buttonStyle = {
    border: "none",
    padding: "10px 16px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  }

  const headerCellStyle = {
    border:
      "1px solid #cbd5e1",
    padding: "11px 8px",
    background: "#e8f1f8",
    color: "#123c69",
    textAlign: "center",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  }

  const bodyCellStyle = {
    border:
      "1px solid #d1d5db",
    padding: "8px",
    textAlign: "center",
    verticalAlign: "middle",
    background: "#fff",
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>

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
            ...buttonStyle,
            background: "#fff",
            color: "#2563eb",
            border:
              "1px solid #2563eb",
            marginBottom: "15px",
          }}
        >
          ← Back to Dashboard
        </button>

        {/* TITLE */}
        <h1
          style={{
            color: "#123c69",
            marginBottom: "5px",
          }}
        >
          Stock Management
        </h1>

        <p
          style={{
            color: "#64748b",
            marginTop: 0,
          }}
        >
          Add and manage medical shop stock
        </p>

        {/* MESSAGE */}
        {message && (
          <div
            style={{
              background: "#dcfce7",
              color: "#166534",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "15px",
              fontWeight: "bold",
            }}
          >
            {message}
          </div>
        )}

        {/* ADD MEDICINE */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              marginBottom: "15px",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#087f5b",
              }}
            >
              + Add Medicine
            </h2>

            <button
              onClick={addMedicine}
              style={{
                ...buttonStyle,
                background:
                  "#2563eb",
                color: "#fff",
              }}
            >
              Clear Form
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            {/* MFR */}
            <div>
              <label>
                <b>MFR.</b>
              </label>

              <input
                style={inputStyle}
                value={
                  newMedicine.mfr
                }
                onChange={(e) =>
                  handleNewMedicineChange(
                    "mfr",
                    e.target.value
                  )
                }
                placeholder="Manufacturer"
              />
            </div>

            {/* PRODUCT NAME */}
            <div>
              <label>
                <b>Product Name *</b>
              </label>

              <input
                style={inputStyle}
                value={
                  newMedicine.name
                }
                onChange={(e) =>
                  handleNewMedicineChange(
                    "name",
                    e.target.value
                  )
                }
                placeholder="Product Name"
              />
            </div>

            {/* MRP */}
            <div>
              <label>
                <b>MRP</b>
              </label>

              <input
                type="number"
                step="0.01"
                style={inputStyle}
                value={
                  newMedicine.rate
                }
                onChange={(e) =>
                  handleNewMedicineChange(
                    "rate",
                    e.target.value
                  )
                }
                placeholder="MRP"
              />
            </div>

            {/* EXPIRY */}
            <div>
              <label>
                <b>Expiry Date</b>
              </label>

              <input
                style={inputStyle}
                value={
                  newMedicine.expiry
                }
                onChange={(e) =>
                  handleNewMedicineChange(
                    "expiry",
                    e.target.value
                  )
                }
                placeholder="MM/YY"
              />
            </div>

            {/* BATCH */}
            <div>
              <label>
                <b>Batch No</b>
              </label>

              <input
                style={inputStyle}
                value={
                  newMedicine.batch
                }
                onChange={(e) =>
                  handleNewMedicineChange(
                    "batch",
                    e.target.value
                  )
                }
                placeholder="Batch No"
              />
            </div>

            {/* QUANTITY */}
            <div>
              <label>
                <b>Quantity</b>
              </label>

              <input
                type="number"
                min="0"
                style={inputStyle}
                value={
                  newMedicine.quantity
                }
                onChange={(e) =>
                  handleNewMedicineChange(
                    "quantity",
                    e.target.value
                  )
                }
                placeholder="Quantity"
              />
            </div>

            {/* PACKING */}
            <div>
              <label>
                <b>Packing / Pack</b>
              </label>

              <input
                style={inputStyle}
                value={
                  newMedicine.packing
                }
                onChange={(e) =>
                  handleNewMedicineChange(
                    "packing",
                    e.target.value
                  )
                }
                placeholder="e.g. 10's"
              />
            </div>
          </div>

          {/* ADD TO STOCK */}
          <button
            onClick={addToStock}
            disabled={saving}
            style={{
              ...buttonStyle,
              marginTop: "15px",
              background:
                saving
                  ? "#94a3b8"
                  : "#087f5b",
              color: "#fff",
              padding:
                "12px 22px",
            }}
          >
            {saving
              ? "Saving..."
              : "Add to Stock"}
          </button>
        </div>

        {/* SEARCH */}
        <div style={cardStyle}>
          <h2
            style={{
              marginTop: 0,
              marginBottom: "10px",
              color: "#123c69",
            }}
          >
            🔎 Search Stock
          </h2>

          <input
            style={{
              ...inputStyle,
              fontSize: "15px",
              padding: "13px",
            }}
            value={searchText}
            onChange={(e) =>
              setSearchText(
                e.target.value
              )
            }
            placeholder="Search Product Name, MFR, Batch, Expiry, MRP, Quantity, Packing / Pack..."
          />

          <p
            style={{
              fontSize: "12px",
              color: "#64748b",
              marginBottom: 0,
            }}
          >
            {filteredStock.length} item(s) found
          </p>
        </div>

        {/* CURRENT STOCK */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              marginBottom: "15px",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#123c69",
              }}
            >
              Current Stock
            </h2>

            <button
              onClick={loadStock}
              style={{
                ...buttonStyle,
                background:
                  "#2563eb",
                color: "#fff",
              }}
            >
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <p>
              Loading stock from Supabase...
            </p>
          ) : (
            <div
              style={{
                overflowX: "auto",
                border:
                  "1px solid #cbd5e1",
                borderRadius: "6px",
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: "1250px",
                  borderCollapse:
                    "collapse",
                  background: "#fff",
                }}
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
                    ].map(
                      (title) => (
                        <th
                          key={title}
                          style={
                            headerCellStyle
                          }
                        >
                          {title}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredStock.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan="9"
                        style={{
                          ...bodyCellStyle,
                          padding:
                            "30px",
                          color:
                            "#64748b",
                        }}
                      >
                        {stock.length ===
                        0
                          ? "No stock available."
                          : "No matching stock found."}
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map(
                      (item, index) => (
                        <tr
                          key={item.id}
                        >
                          {/* S.NO */}
                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            {item.sno ||
                              index + 1}
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
                              onChange={(
                                e
                              ) =>
                                updateStockField(
                                  item.id,
                                  "mfr",
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>

                          {/* PRODUCT NAME */}
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
                              onChange={(
                                e
                              ) =>
                                updateStockField(
                                  item.id,
                                  "name",
                                  e
                                    .target
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
                              <b>₹</b>

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
                                    item.id,
                                    "rate",
                                    e
                                      .target
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
                              onChange={(
                                e
                              ) =>
                                updateStockField(
                                  item.id,
                                  "expiry",
                                  e
                                    .target
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
                              onChange={(
                                e
                              ) =>
                                updateStockField(
                                  item.id,
                                  "batch",
                                  e
                                    .target
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
                                  changeQuantity(
                                    item,
                                    -1
                                  )
                                }
                                style={{
                                  ...buttonStyle,
                                  padding:
                                    "6px 10px",
                                  background:
                                    "#f1f5f9",
                                }}
                              >
                                −
                              </button>

                              <span
                                style={{
                                  minWidth:
                                    "45px",
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
                                  changeQuantity(
                                    item,
                                    1
                                  )
                                }
                                style={{
                                  ...buttonStyle,
                                  padding:
                                    "6px 10px",
                                  background:
                                    "#f1f5f9",
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
                              onChange={(
                                e
                              ) =>
                                updateStockField(
                                  item.id,
                                  "packing",
                                  e
                                    .target
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
                                  item
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
          )}
        </div>
      </div>
    </div>
  )
}

export default Stock