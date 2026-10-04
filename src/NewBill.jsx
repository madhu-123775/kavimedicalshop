import { useEffect, useState } from "react"
 
// Stock page use panra ADHE key (FIX: munnadi "kaviStock" use pannichu, adhaan link aagala)
const STOCK_KEY = "pharmacyMedicines"
 
const emptyProduct = () => ({
  description: "",
  mfr: "",
  qty: "1",
  batch: "",
  expiry: "",
  rate: "",
  autoFilled: false,
})
 
function NewBill() {
  const [medicines, setMedicines] = useState([])
  const [stockItems, setStockItems] = useState([])
 
  const [products, setProducts] = useState([emptyProduct()])
 
  const [doctor, setDoctor] = useState("")
  const [patient, setPatient] = useState("")
  const [doctors, setDoctors] = useState([])
  const [doctorDropdownOpen, setDoctorDropdownOpen] = useState(false)
 
  // LOAD DOCTORS
  useEffect(() => {
    const savedDoctors = localStorage.getItem("kaviDoctors")
 
    if (savedDoctors) {
      try {
        const data = JSON.parse(savedDoctors)
        if (Array.isArray(data)) setDoctors(data)
      } catch (error) {
        console.log("Doctor loading error:", error)
        setDoctors([])
      }
    }
  }, [])
 
  const cleanDoctorName = (value) =>
    String(value || "")
      .trim()
      .replace(/^dr\.?\s*/i, "")
      .trim()
 
  const filteredDoctors =
    doctorDropdownOpen && doctor.trim().length >= 1
      ? Array.from(
          new Set(
            doctors
              .map(cleanDoctorName)
              .filter(Boolean)
              .filter((doctorName) =>
                doctorName
                  .toLowerCase()
                  .includes(doctor.trim().replace(/^dr\.?\s*/i, "").toLowerCase())
              )
          )
        ).slice(0, 8)
      : []
 
  // INVOICE NUMBER
  const [invoiceNo, setInvoiceNo] = useState(() => {
    const savedBills = localStorage.getItem("kaviBills")
 
    if (savedBills) {
      try {
        const bills = JSON.parse(savedBills)
        if (Array.isArray(bills)) {
          return String(bills.length + 1).padStart(4, "0")
        }
      } catch {
        return "0001"
      }
    }
 
    return "0001"
  })
 
  // CURRENT DATE
  const [billDate, setBillDate] = useState(() =>
    new Date().toLocaleDateString("en-GB")
  )
 
  // PRINT PAPER SIZE
  const [paperSize, setPaperSize] = useState("100")
  const [activeProductRow, setActiveProductRow] = useState(null)
  const printWidth = paperSize === "80" ? "80mm" : "100mm"
 
  // LOAD MEDICINES
  useEffect(() => {
    const saved = localStorage.getItem("kaviMedicines")
 
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (Array.isArray(data)) setMedicines(data)
      } catch (error) {
        console.log("Medicine loading error:", error)
        setMedicines([])
      }
    }
  }, [])
 
  // LOAD STOCK (Stock page save panna data)
  const readStock = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STOCK_KEY) || "[]")
      if (!Array.isArray(saved)) return []
 
      return saved.map((item) => ({
        name: String(item.name || item.medicineName || "").trim(),
        mfr: String(item.mfr || item.manufacturer || ""),
        batch: String(item.batch || ""),
        expiry: String(item.expiry || ""),
        stock: Number(item.stock ?? item.quantity ?? 0),
        rate: Number(item.rate ?? item.mrp ?? 0),
      }))
    } catch (error) {
      console.log("Stock loading error:", error)
      return []
    }
  }
 
  useEffect(() => {
    setStockItems(readStock())
  }, [])
 
  // PRODUCT SUGGESTIONS (stock-la irukkura items, batch-wise)
  const getSuggestions = (value) => {
    const typed = String(value || "").trim().toLowerCase()
    if (!typed) return []
 
    return stockItems
      .filter((item) => item.stock > 0 && item.name.toLowerCase().includes(typed))
      .slice(0, 10)
  }
 
  // Suggestion select pannina stock details bill la auto-fill
  const fillProductFromItem = (index, item) => {
    setActiveProductRow(null)
 
    setProducts((prev) =>
      prev.map((product, i) => {
        if (i !== index) return product
 
        return {
          ...product,
          description: item.name,
          autoFilled: true,
          mfr: item.mfr,
          batch: item.batch,
          expiry: item.expiry,
          rate: String(item.rate || ""),
          available: item.stock,
          amount: undefined,
        }
      })
    )
  }
 
  // PRODUCT CHANGE
  const handleProductChange = (index, field, value) => {
    if (field === "description") {
      setActiveProductRow(index)
    }
 
    setProducts((prev) =>
      prev.map((product, i) => {
        if (i !== index) return product
        return {
          ...product,
          [field]: value,
          ...(field === "description" ? { autoFilled: false, available: undefined } : {}),
        }
      })
    )
  }
 
  // ADD PRODUCT
  const addProduct = () => {
    setProducts((prev) => [...prev, emptyProduct()])
  }
 
  // DELETE PRODUCT
  const deleteProduct = (index) => {
    if (index === 0) return
    setProducts((prev) => prev.filter((_, i) => i !== index))
  }
 
  // GRAND TOTAL
  const grandTotal = products.reduce((total, product) => {
    const typedAmount = String(product.amount ?? "").trim()
    const amount =
      typedAmount !== ""
        ? Number(typedAmount) || 0
        : (Number(product.qty) || 0) * (Number(product.rate) || 0)
 
    return total + amount
  }, 0)
 
  const norm = (v) => String(v || "").trim().replace(/\s+/g, " ").toLowerCase()
 
  // Stock-la irukkurathukku mela qty potta warning
  const getAvailable = (product) => {
    const match =
      stockItems.find(
        (s) => norm(s.name) === norm(product.description) && norm(s.batch) === norm(product.batch)
      ) || stockItems.find((s) => norm(s.name) === norm(product.description))
    return match ? match.stock : null
  }
 
  const overStock = products.filter((product) => {
    const available = getAvailable(product)
    return available !== null && (Number(product.qty) || 0) > available
  })
 
  // DEDUCT SOLD STOCK (Stock page-oda same data-la kuraikkum)
  const deductStockAfterBill = (soldProducts) => {
    try {
      const saved = JSON.parse(localStorage.getItem(STOCK_KEY) || "[]")
      const updated = saved.map((item) => ({ ...item }))
 
      soldProducts.forEach((product) => {
        const soldQty = Number(product.qty) || 0
        if (!soldQty) return
 
        const nameOf = (s) => norm(s.name || s.medicineName)
 
        // munnadi name+batch match, illa na name match
        let target =
          updated.find(
            (s) => nameOf(s) === norm(product.description) && norm(s.batch) === norm(product.batch)
          ) || updated.find((s) => nameOf(s) === norm(product.description))
 
        if (!target) return
 
        const current = Number(target.stock ?? target.quantity ?? 0)
        target.stock = Math.max(0, current - soldQty)
        if ("quantity" in target) target.quantity = target.stock
      })
 
      localStorage.setItem(STOCK_KEY, JSON.stringify(updated))
      setStockItems(readStock())
    } catch (error) {
      console.error("Stock deduction error:", error)
    }
  }
 
  // SAVE BILL
  const saveBill = () => {
    const validProducts = products.filter(
      (product) => product.description.trim() !== ""
    )
 
    if (validProducts.length === 0) {
      alert("Please add at least one medicine.")
      return
    }
 
    if (overStock.length > 0) {
      const names = overStock.map((p) => p.description).join(", ")
      if (!window.confirm(`Stock kammiya irukku: ${names}\nIrundhaalum bill save pannanuma?`)) {
        return
      }
    }
 
    const savedBills = localStorage.getItem("kaviBills")
 
    let bills = []
 
    if (savedBills) {
      try {
        const parsed = JSON.parse(savedBills)
        if (Array.isArray(parsed)) bills = parsed
      } catch {
        bills = []
      }
    }
 
    const bill = {
      invoiceNo: invoiceNo,
      date: billDate,
      doctor: doctor,
      patient: patient,
      products: validProducts,
      grandTotal: Number(grandTotal.toFixed(2)),
    }
 
    const updatedBills = [...bills, bill]
 
    localStorage.setItem("kaviBills", JSON.stringify(updatedBills))
 
    // DEDUCT SOLD STOCK
    deductStockAfterBill(validProducts)
 
    alert(`Bill ${invoiceNo} saved successfully!`)
 
    // NEXT INVOICE NUMBER
    setInvoiceNo(String(updatedBills.length + 1).padStart(4, "0"))
 
    // CLEAR CURRENT BILL
    setDoctor("")
    setPatient("")
    setProducts([emptyProduct()])
  }
 
  // BACK
  const goBack = () => {
    window.history.pushState({}, "", "/")
    window.location.reload()
  }
 
  // PRINT
  const printBill = () => {
    window.print()
  }
 
  const inputStyle = {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "7px",
    padding: "2px 1px",
    boxSizing: "border-box",
    color: "#000000",
  }
 
  const topButton = {
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "8px 14px",
    cursor: "pointer",
  }
 
  const headerInput = {
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "10px",
    padding: "1px 0",
    marginLeft: "3px",
    color: "#000000",
    textAlign: "left",
    pointerEvents: "auto",
    cursor: "text",
    position: "relative",
    zIndex: 10,
  }
 
  const textareaStyle = {
    ...inputStyle,
    width: "100%",
    textAlign: "center",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    overflow: "hidden",
    resize: "none",
    minHeight: "24px",
    lineHeight: "16px",
    padding: "3px 2px",
  }
 
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#eeeeee",
        padding: "20px",
        fontFamily: '"Times New Roman", Times, serif',
      }}
    >
      {/* TOP BUTTONS */}
 
      <div
        className="no-print"
        style={{
          maxWidth: printWidth,
          margin: "0 auto 15px auto",
          display: "flex",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <button onClick={goBack} style={{ ...topButton, backgroundColor: "#2563eb" }}>
          ← Back
        </button>
 
        <button
          onClick={saveBill}
          style={{ ...topButton, backgroundColor: "#7c3aed", fontWeight: "bold" }}
        >
          💾 Save Bill
        </button>
 
        <select
          value={paperSize}
          onChange={(e) => setPaperSize(e.target.value)}
          style={{
            padding: "8px 10px",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            backgroundColor: "white",
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: "14px",
            cursor: "pointer",
          }}
          aria-label="Paper size"
        >
          <option value="80">3 inch (80 mm)</option>
          <option value="100">4 inch (100 mm)</option>
        </select>
 
        <button onClick={printBill} style={{ ...topButton, backgroundColor: "#16a34a" }}>
          🖨️ Print Bill
        </button>
      </div>
 
      {/* 4 INCH BILL */}
 
      <div
        id="bill"
        style={{
          width: printWidth,
          minHeight: "120mm",
          margin: "0 auto",
          backgroundColor: "white",
          padding: "5mm",
          boxSizing: "border-box",
          color: "#000000",
        }}
      >
        {/* HEADER */}
 
        <div style={{ textAlign: "center", lineHeight: "1.3", marginBottom: "5px" }}>
          <div style={{ fontSize: "18px", fontWeight: "bold" }}>KAVI MEDICALS</div>
          <div style={{ fontSize: "11px", fontWeight: "bold" }}>UDAYAPATTI, SALEM-140</div>
          <div style={{ fontSize: "10px" }}>Drug Lic. No: 1719/SLS 20-21</div>
        </div>
 
        <hr style={{ border: "none", borderTop: "1px solid #000", margin: "4px 0" }} />
 
        {/* INVOICE DETAILS */}
 
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "10px",
            marginBottom: "5px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
            <b>Invoice No:</b>
            <input
              type="text"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              style={{ ...headerInput, width: "45px" }}
            />
          </div>
 
          <div
            style={{
              display: "flex",
              alignItems: "center",
              whiteSpace: "nowrap",
              marginLeft: "auto",
            }}
          >
            <b>Date:</b>
            <input
              type="text"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              placeholder="DD/MM/YYYY"
              style={{ ...headerInput, width: "70px" }}
            />
          </div>
        </div>
 
        {/* DOCTOR */}
 
        <div
          style={{
            fontSize: "11px",
            marginBottom: "3px",
            display: "flex",
            alignItems: "center",
            position: "relative",
          }}
        >
          <b>Dr.</b>
 
          <div style={{ position: "relative", marginLeft: "4px", width: "70%" }}>
            <input
              type="text"
              value={doctor}
              onFocus={() => setDoctorDropdownOpen(true)}
              onChange={(e) => {
                setDoctor(e.target.value.replace(/^dr\.?\s*/i, ""))
                setDoctorDropdownOpen(true)
              }}
              onBlur={() => {
                setTimeout(() => setDoctorDropdownOpen(false), 150)
              }}
              placeholder="Type doctor name"
              autoComplete="off"
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "11px",
                width: "100%",
                color: "#000000",
                padding: "2px 0",
              }}
            />
 
            {filteredDoctors.length > 0 && (
              <div
                className="no-print"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  width: "100%",
                  background: "white",
                  border: "1px solid #cccccc",
                  borderRadius: "4px",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                  zIndex: 1000,
                  overflow: "hidden",
                }}
              >
                {filteredDoctors.map((doctorName, index) => (
                  <div
                    key={index}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setDoctor(cleanDoctorName(doctorName))
                      setDoctorDropdownOpen(false)
                    }}
                    style={{
                      padding: "7px 8px",
                      fontSize: "11px",
                      color: "#000000",
                      background: "white",
                      cursor: "pointer",
                      borderBottom:
                        index < filteredDoctors.length - 1 ? "1px solid #eeeeee" : "none",
                    }}
                  >
                    {doctorName}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
 
        {/* PATIENT */}
 
        <div
          style={{
            fontSize: "11px",
            marginBottom: "6px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <b>Pt.Name :</b>
 
          <input
            type="text"
            value={patient}
            onChange={(e) => setPatient(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              marginLeft: "4px",
              fontSize: "11px",
              width: "65%",
              color: "#000000",
            }}
          />
        </div>
 
        {/* MEDICINE TABLE */}
 
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: "9%" }}>S.No</th>
              <th style={{ ...thStyle, width: "12%" }}>MFR.</th>
              <th style={{ ...thStyle, width: "23%", whiteSpace: "nowrap" }}>DESCRIPTION</th>
              <th style={{ ...thStyle, width: "10%" }}>QTY</th>
              <th style={{ ...thStyle, width: "15%" }}>BATCH</th>
              <th style={{ ...thStyle, width: "15%" }}>EXPIRY</th>
              <th style={{ ...thStyle, width: "16%" }}>AMOUNT</th>
            </tr>
          </thead>
 
          <tbody>
            {products.map((product, index) => (
              <tr key={index}>
                {/* S.NO */}
 
                <td style={tdStyle}>{index + 1}</td>
 
                {/* MFR */}
 
                <td style={tdStyle}>
                  <input
                    type="text"
                    value={product.mfr}
                    onChange={(e) => handleProductChange(index, "mfr", e.target.value)}
                    style={{
                      ...inputStyle,
                      textAlign: "center",
                      fontWeight: product.autoFilled ? "bold" : "normal",
                    }}
                  />
                </td>
 
                {/* DESCRIPTION */}
 
                <td
                  style={{
                    ...tdStyle,
                    overflow: "visible",
                    verticalAlign: "middle",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    position: "relative",
                  }}
                >
                  <div style={{ position: "relative", width: "100%" }}>
                    <textarea
                      rows={1}
                      value={product.description}
                      placeholder="Select product"
                      autoComplete="off"
                      onFocus={() => setActiveProductRow(index)}
                      onBlur={() => {
                        setTimeout(() => setActiveProductRow(null), 150)
                      }}
                      onChange={(e) =>
                        handleProductChange(index, "description", e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const suggestions = getSuggestions(product.description)
                          if (suggestions.length > 0) {
                            e.preventDefault()
                            fillProductFromItem(index, suggestions[0])
                          }
                        }
                      }}
                      onInput={(e) => {
                        e.target.style.height = "auto"
                        e.target.style.height = e.target.scrollHeight + "px"
                      }}
                      style={{
                        ...textareaStyle,
                        fontWeight: product.autoFilled ? "bold" : "normal",
                      }}
                    />
 
                    {activeProductRow === index &&
                      product.description.trim() !== "" &&
                      getSuggestions(product.description).length > 0 && (
                        <div
                          className="no-print"
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            width: "260px",
                            maxHeight: "200px",
                            overflowY: "auto",
                            background: "white",
                            border: "1px solid #999",
                            boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                            zIndex: 2000,
                            textAlign: "left",
                          }}
                        >
                          {getSuggestions(product.description).map((item, suggestionIndex) => (
                            <div
                              key={suggestionIndex}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                fillProductFromItem(index, item)
                              }}
                              style={{
                                padding: "6px 8px",
                                fontSize: "11px",
                                background: "white",
                                color: "#000",
                                cursor: "pointer",
                                borderBottom: "1px solid #eeeeee",
                              }}
                            >
                              <div style={{ fontWeight: "bold" }}>{item.name}</div>
                              <div style={{ fontSize: "10px", color: "#555" }}>
                                Batch: {item.batch || "-"} | Exp: {item.expiry || "-"} | Stock:{" "}
                                {item.stock} | ₹{Number(item.rate || 0).toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </td>
 
                {/* QTY */}
 
                <td style={tdStyle}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={product.qty}
                    onChange={(e) =>
                      handleProductChange(index, "qty", e.target.value.replace(/\D/g, ""))
                    }
                    style={{ ...inputStyle, textAlign: "center" }}
                  />
                </td>
 
                {/* BATCH */}
 
                <td
                  style={{
                    ...tdStyle,
                    overflow: "visible",
                    verticalAlign: "middle",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }}
                >
                  <textarea
                    rows={1}
                    value={product.batch}
                    onChange={(e) => {
                      handleProductChange(index, "batch", e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = e.target.scrollHeight + "px"
                    }}
                    style={{
                      ...textareaStyle,
                      boxSizing: "border-box",
                      fontWeight: product.autoFilled ? "bold" : "normal",
                    }}
                  />
                </td>
 
                {/* EXPIRY */}
 
                <td style={tdStyle}>
                  <input
                    type="text"
                    value={product.expiry}
                    onChange={(e) => handleProductChange(index, "expiry", e.target.value)}
                    style={{
                      ...inputStyle,
                      textAlign: "center",
                      fontWeight: product.autoFilled ? "bold" : "normal",
                    }}
                  />
                </td>
 
                {/* AMOUNT */}
 
                <td
                  style={{
                    ...tdStyle,
                    padding: "2px 1px",
                    textAlign: "center",
                    verticalAlign: "middle",
                  }}
                >
                  {(() => {
                    const amountValue =
                      product.amount !== undefined
                        ? String(product.amount)
                        : ((Number(product.qty) || 0) * (Number(product.rate) || 0)).toFixed(2)
 
                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          gap: "2px",
                          lineHeight: 1,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "Arial, sans-serif",
                            fontSize: "8px",
                            lineHeight: 1,
                            color: "#000000",
                            whiteSpace: "nowrap",
                            flex: "0 0 auto",
                          }}
                        >
                          ₹
                        </span>
 
                        {/* width text-oda length-ku match aagum, so ₹ + amount rendum center la varum */}
                        <input
                          type="text"
                          inputMode="decimal"
                          value={amountValue}
                          onChange={(e) =>
                            handleProductChange(index, "amount", e.target.value.replace(/[^0-9.]/g, ""))
                          }
                          style={{
                            ...inputStyle,
                            width: `${Math.max(amountValue.length, 1) + 0.5}ch`,
                            flex: "0 0 auto",
                            fontSize: "8px",
                            lineHeight: 1,
                            textAlign: "center",
                            padding: 0,
                            margin: 0,
                          }}
                        />
                      </div>
                    )
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
 
        {/* MEDICINE LIST */}
 
        <datalist id="kavi-medicine-list">
          {medicines.map((medicine, index) => (
            <option key={index} value={medicine.name || ""} />
          ))}
        </datalist>
 
        {/* STOCK WARNING (print aagathu) */}
 
        {overStock.length > 0 && (
          <div
            className="no-print"
            style={{ marginTop: "6px", fontSize: "10px", color: "#dc2626" }}
          >
            {overStock.map((p, i) => (
              <div key={i}>
                ⚠ {p.description}: stock {getAvailable(p)} mattum irukku
              </div>
            ))}
          </div>
        )}
 
        {/* ADD PRODUCT */}
 
        <button
          className="no-print"
          onClick={addProduct}
          style={{
            marginTop: "8px",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "5px",
            padding: "5px 10px",
            cursor: "pointer",
            fontSize: "11px",
          }}
        >
          + Add Product
        </button>
 
        {/* DELETE */}
 
        <div className="no-print" style={{ marginTop: "5px" }}>
          {products.map(
            (_, index) =>
              index > 0 && (
                <button
                  key={index}
                  onClick={() => deleteProduct(index)}
                  style={{
                    backgroundColor: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    padding: "3px 7px",
                    marginRight: "5px",
                    cursor: "pointer",
                    fontSize: "10px",
                  }}
                >
                  × Row {index + 1}
                </button>
              )
          )}
        </div>
 
        {/* GRAND TOTAL */}
 
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "8px",
            fontSize: "12px",
            fontWeight: "bold",
          }}
        >
          Grand Total: ₹{grandTotal.toFixed(2)}
        </div>
 
        <hr style={{ border: "none", borderTop: "1px solid #000", margin: "6px 0" }} />
 
        {/* FOOTER */}
 
        <div style={{ textAlign: "center", fontSize: "10px", lineHeight: "1.4" }}>
          <div>Thank You</div>
          <div>Visit Again</div>
        </div>
      </div>
 
      {/* PRINT CSS */}
 
      <style>
        {`
          @media print {
 
            @page {
              size: ${printWidth} auto;
              margin: 0;
            }
 
            body {
              margin: 0;
              padding: 0;
              background: white;
            }
 
            .no-print {
              display: none !important;
            }
 
            #bill {
              width: ${printWidth} !important;
              margin: 0 !important;
              padding: 5mm !important;
              box-shadow: none !important;
            }
 
            #bill table,
            #bill th,
            #bill td {
              border: none !important;
            }
 
            #bill input {
              border: none !important;
              outline: none !important;
              color: #000000 !important;
            }
 
            #bill td:nth-child(3),
            #bill td:nth-child(3) textarea,
            #bill td:nth-child(5),
            #bill td:nth-child(5) textarea {
              white-space: pre-wrap !important;
              overflow: hidden !important;
              overflow-wrap: anywhere !important;
              word-break: break-word !important;
              min-height: 24px !important;
              max-height: none !important;
              resize: none !important;
              scrollbar-width: none !important;
            }
 
            #bill td:nth-child(3) textarea::-webkit-scrollbar,
            #bill td:nth-child(5) textarea::-webkit-scrollbar {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
            }
 
            #bill td:nth-child(7) {
              position: relative !important;
            }
 
            #bill td:nth-child(7) > div {
              position: absolute !important;
              left: 50% !important;
              top: 50% !important;
              transform: translate(-50%, -50%) !important;
              display: flex !important;
              width: max-content !important;
              margin: 0 !important;
              align-items: center !important;
              justify-content: center !important;
              text-align: center !important;
              overflow: visible !important;
              z-index: 2 !important;
            }
 
            #bill td:nth-child(7) span {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              text-align: center !important;
              color: #000000 !important;
              width: auto !important;
            }
 
            #bill td:nth-child(7) input {
              flex: 0 0 auto !important;
              font-size: 7px !important;
              text-align: center !important;
              padding: 0 !important;
            }
          }
        `}
      </style>
    </div>
  )
}
 
/* TABLE HEADER */
 
const thStyle = {
  border: "1px solid #000",
  padding: "3px 1px",
  fontSize: "7px",
  textAlign: "center",
  fontWeight: "bold",
  wordBreak: "keep-all",
  whiteSpace: "nowrap",
}
 
/* TABLE DATA */
 
const tdStyle = {
  border: "1px solid #000",
  padding: "2px 1px",
  fontSize: "7px",
  textAlign: "center",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
}
 
export default NewBill
 