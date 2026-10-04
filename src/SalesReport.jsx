import { useEffect, useState } from "react"
import * as XLSX from "xlsx"

function SalesReport() {
  const [bills, setBills] = useState([])
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  useEffect(() => {
    const savedBills = JSON.parse(
      localStorage.getItem("kaviBills") || "[]"
    )

    setBills(savedBills)
  }, [])

  const parseBillDate = (dateValue) => {
    if (!dateValue) return null

    const value = String(dateValue).trim()

    // DD/MM/YYYY
    if (value.includes("/")) {
      const parts = value.split("/")

      if (parts.length === 3) {
        const day = Number(parts[0])
        const month = Number(parts[1]) - 1
        const year = Number(parts[2])

        return new Date(year, month, day)
      }
    }

    // YYYY-MM-DD
    if (value.includes("-")) {
      const date = new Date(value)

      if (!isNaN(date.getTime())) {
        return date
      }
    }

    return null
  }

  const filteredBills = bills.filter((bill) => {
    if (!fromDate && !toDate) {
      return true
    }

    const billDate = parseBillDate(bill.date)

    if (!billDate) {
      return false
    }

    const billTime = new Date(
      billDate.getFullYear(),
      billDate.getMonth(),
      billDate.getDate()
    ).getTime()

    if (fromDate) {
      const from = new Date(fromDate + "T00:00:00").getTime()

      if (billTime < from) {
        return false
      }
    }

    if (toDate) {
      const to = new Date(toDate + "T23:59:59").getTime()

      if (billTime > to) {
        return false
      }
    }

    return true
  })

  const getBillTotal = (bill) => {
    return (bill.products || []).reduce((total, product) => {
      const qty = Number(product.qty) || 0
      const rate = Number(product.rate) || 0

      return total + qty * rate
    }, 0)
  }

  const totalSales = filteredBills.reduce(
    (total, bill) => total + getBillTotal(bill),
    0
  )

  const totalItemsSold = filteredBills.reduce((total, bill) => {
    return (
      total +
      (bill.products || []).reduce(
        (sum, product) => sum + (Number(product.qty) || 0),
        0
      )
    )
  }, 0)

  const exportExcel = () => {
    const rows = []

    filteredBills.forEach((bill) => {
      ;(bill.products || []).forEach((product) => {
        const qty = Number(product.qty) || 0
        const rate = Number(product.rate) || 0

        rows.push({
          "Bill No.": bill.invoiceNo || bill.billNo || "",
          Date: bill.date || "",
          "Patient Name": bill.patient || "",
          "Doctor Name": bill.doctor || "",
          Medicine: product.description || "",
          "MFR.": product.mfr || "",
          Batch: product.batch || "",
          Expiry: product.expiry || "",
          Quantity: qty,
          Rate: rate,
          Amount: qty * rate,
        })
      })
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Sales Report"
    )

    XLSX.writeFile(
      workbook,
      "Kavi_Sales_Report.xlsx"
    )
  }

  const clearFilter = () => {
    setFromDate("")
    setToDate("")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#eef7f4",
        padding: "25px",
        fontFamily: "Arial, sans-serif",
        color: "#123c69",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          padding: "25px",
          borderRadius: "15px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "25px",
          }}
        >
          <h1
            style={{
              margin: 0,
              color: "#7c3aed",
            }}
          >
            📊 Sales Report
          </h1>

          <button
            onClick={() => {
              window.history.pushState({}, "", "/")
              window.location.reload()
            }}
            style={{
              backgroundColor: "#64748b",
              color: "white",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        </div>

        {/* SUMMARY */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "15px",
            marginBottom: "25px",
          }}
        >
          <div
            style={{
              backgroundColor: "#dcfce7",
              padding: "20px",
              borderRadius: "12px",
            }}
          >
            <div style={{ color: "#166534" }}>
              Total Sales
            </div>

            <div
              style={{
                fontSize: "25px",
                fontWeight: "bold",
                color: "#15803d",
                marginTop: "8px",
              }}
            >
              ₹{totalSales.toFixed(2)}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#dbeafe",
              padding: "20px",
              borderRadius: "12px",
            }}
          >
            <div style={{ color: "#1d4ed8" }}>
              Total Bills
            </div>

            <div
              style={{
                fontSize: "25px",
                fontWeight: "bold",
                color: "#2563eb",
                marginTop: "8px",
              }}
            >
              {filteredBills.length}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#fef3c7",
              padding: "20px",
              borderRadius: "12px",
            }}
          >
            <div style={{ color: "#92400e" }}>
              Items Sold
            </div>

            <div
              style={{
                fontSize: "25px",
                fontWeight: "bold",
                color: "#d97706",
                marginTop: "8px",
              }}
            >
              {totalItemsSold}
            </div>
          </div>
        </div>

        {/* DATE FILTER */}

        <div
          style={{
            backgroundColor: "#f8fafc",
            padding: "20px",
            borderRadius: "12px",
            marginBottom: "25px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            📅 Date Filter
          </h3>

          <div
            style={{
              display: "flex",
              gap: "15px",
              alignItems: "end",
              flexWrap: "wrap",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: "bold",
                }}
              >
                From Date
              </label>

              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  padding: "10px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "7px",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: "bold",
                }}
              >
                To Date
              </label>

              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  padding: "10px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "7px",
                }}
              />
            </div>

            <button
              onClick={clearFilter}
              style={{
                backgroundColor: "#64748b",
                color: "white",
                border: "none",
                padding: "10px 18px",
                borderRadius: "7px",
                cursor: "pointer",
              }}
            >
              Clear Filter
            </button>

            <button
              onClick={exportExcel}
              style={{
                backgroundColor: "#16a34a",
                color: "white",
                border: "none",
                padding: "10px 18px",
                borderRadius: "7px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              📥 Export Excel
            </button>
          </div>
        </div>

        {/* SALES DETAILS */}

        <h2
          style={{
            color: "#123c69",
            marginBottom: "15px",
          }}
        >
          🧾 Sales Details
        </h2>

        {filteredBills.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              backgroundColor: "#f8fafc",
              borderRadius: "10px",
              color: "#64748b",
            }}
          >
            No sales records found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "900px",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#7c3aed",
                    color: "white",
                  }}
                >
                  <th style={thStyle}>Bill No.</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Patient</th>
                  <th style={thStyle}>Doctor</th>
                  <th style={thStyle}>Items</th>
                  <th style={thStyle}>Total Amount</th>
                </tr>
              </thead>

              <tbody>
                {filteredBills.map((bill, index) => (
                  <tr
                    key={index}
                    style={{
                      backgroundColor:
                        index % 2 === 0
                          ? "#ffffff"
                          : "#f8fafc",
                    }}
                  >
                    <td style={tdStyle}>
                      {bill.invoiceNo ||
                        bill.billNo ||
                        "-"}
                    </td>

                    <td style={tdStyle}>
                      {bill.date || "-"}
                    </td>

                    <td style={tdStyle}>
                      {bill.patient || "-"}
                    </td>

                    <td style={tdStyle}>
                      {bill.doctor || "-"}
                    </td>

                    <td style={tdStyle}>
                      {(bill.products || []).length}
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: "bold",
                        color: "#15803d",
                      }}
                    >
                      ₹{getBillTotal(bill).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const thStyle = {
  padding: "12px",
  border: "1px solid #ddd",
  textAlign: "left",
}

const tdStyle = {
  padding: "12px",
  border: "1px solid #ddd",
}

export default SalesReport 