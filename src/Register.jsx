import { useEffect, useState } from "react"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const REGISTER_EDITS_KEY = "kaviRegisterEdits"

function Register() {
  const [registerData, setRegisterData] = useState([])

  useEffect(() => {
    loadBills()
  }, [])

  // --------------------------------------------------
  // GET SAVED REGISTER EDITS
  // --------------------------------------------------

  const getSavedEdits = () => {
    try {
      const saved = localStorage.getItem(
        REGISTER_EDITS_KEY
      )

      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  }

  const saveEdits = (edits) => {
    localStorage.setItem(
      REGISTER_EDITS_KEY,
      JSON.stringify(edits)
    )
  }

  // --------------------------------------------------
  // CREATE UNIQUE ROW ID
  // --------------------------------------------------

  const createRowId = (
    bill,
    billIndex,
    productIndex
  ) => {
    return `${bill.invoiceNo || `bill-${billIndex}`}-${productIndex}`
  }

  // --------------------------------------------------
  // LOAD BILLS
  // --------------------------------------------------

  const loadBills = () => {
    const savedBills =
      localStorage.getItem("kaviBills")

    if (!savedBills) {
      setRegisterData([])
      return
    }

    try {
      const bills = JSON.parse(savedBills)

      if (!Array.isArray(bills)) {
        setRegisterData([])
        return
      }

      const savedEdits = getSavedEdits()
      const rows = []

      bills.forEach((bill, billIndex) => {
        if (!Array.isArray(bill.products)) return

        bill.products.forEach(
          (product, productIndex) => {
            const rowId = createRowId(
              bill,
              billIndex,
              productIndex
            )

            const saved =
              savedEdits[rowId] || {}

            rows.push({
              id: rowId,

              billIndex,
              productIndex,

              // ORIGINAL VALUES
              sourceBillNo:
                bill.invoiceNo || "",

              sourceDate:
                bill.date || "",

              sourcePrescriber:
                bill.doctor || "",

              sourcePatient:
                bill.patient || "",

              sourceDrug:
                product.description || "",

              sourceQuantity:
                product.qty || "",

              sourceManufacturer:
                product.mfr || "",

              sourceBatch:
                product.batch || "",

              sourceExpiry:
                product.expiry || "",

              // DISPLAY / EDITABLE VALUES
              billNo:
                saved.billNo ??
                bill.invoiceNo ??
                "",

              date:
                saved.date ??
                bill.date ??
                "",

              prescriber:
                saved.prescriber ??
                bill.doctor ??
                "",

              patient:
                saved.patient ??
                bill.patient ??
                "",

              drug:
                saved.drug ??
                product.description ??
                "",

              quantity:
                saved.quantity ??
                product.qty ??
                "",

              manufacturer:
                saved.manufacturer ??
                product.mfr ??
                "",

              batchNo:
                saved.batchNo ??
                product.batch ??
                "",

              expiry:
                saved.expiry ??
                product.expiry ??
                "",

              signature:
                saved.signature ?? "",
            })
          }
        )
      })

      setRegisterData(rows)
    } catch (error) {
      console.log(
        "Register loading error:",
        error
      )

      setRegisterData([])
    }
  }

  // --------------------------------------------------
  // UPDATE ANY FIELD
  // --------------------------------------------------

  const updateField = (
    rowId,
    field,
    value
  ) => {
    setRegisterData((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    )

    const savedEdits = getSavedEdits()

    savedEdits[rowId] = {
      ...(savedEdits[rowId] || {}),
      [field]: value,
    }

    saveEdits(savedEdits)
  }

  // --------------------------------------------------
  // AUTO FILL ALL
  // --------------------------------------------------

  const autoFillAll = () => {
    if (registerData.length === 0) {
      alert("Register-la data illa.")
      return
    }

    const savedEdits = getSavedEdits()

    const updatedRows = registerData.map(
      (row) => {
        const updatedRow = {
          ...row,

          billNo:
            row.sourceBillNo,

          date:
            row.sourceDate,

          prescriber:
            row.sourcePrescriber,

          patient:
            row.sourcePatient,

          drug:
            row.sourceDrug,

          quantity:
            row.sourceQuantity,

          manufacturer:
            row.sourceManufacturer,

          batchNo:
            row.sourceBatch,

          expiry:
            row.sourceExpiry,
        }

        savedEdits[row.id] = {
          ...(savedEdits[row.id] || {}),

          billNo:
            row.sourceBillNo,

          date:
            row.sourceDate,

          prescriber:
            row.sourcePrescriber,

          patient:
            row.sourcePatient,

          drug:
            row.sourceDrug,

          quantity:
            row.sourceQuantity,

          manufacturer:
            row.sourceManufacturer,

          batchNo:
            row.sourceBatch,

          expiry:
            row.sourceExpiry,
        }

        return updatedRow
      }
    )

    setRegisterData(updatedRows)
    saveEdits(savedEdits)

    alert(
      "All bill details auto-filled successfully!"
    )
  }

  // --------------------------------------------------
  // DELETE ENTRY
  // --------------------------------------------------

  const deleteEntry = (row) => {
    const confirmDelete = window.confirm(
      "Indha register entry-ai delete panna venduma?"
    )

    if (!confirmDelete) return

    try {
      const savedBills =
        localStorage.getItem("kaviBills")

      if (!savedBills) return

      const bills = JSON.parse(savedBills)

      const bill = bills[row.billIndex]

      if (
        !bill ||
        !Array.isArray(bill.products)
      ) {
        return
      }

      bill.products.splice(
        row.productIndex,
        1
      )

      // If no products remain,
      // remove the entire bill
      if (bill.products.length === 0) {
        bills.splice(row.billIndex, 1)
      }

      localStorage.setItem(
        "kaviBills",
        JSON.stringify(bills)
      )

      // Remove saved Register edits
      const savedEdits = getSavedEdits()

      delete savedEdits[row.id]

      saveEdits(savedEdits)

      loadBills()

      alert("Register entry deleted.")
    } catch (error) {
      console.log(
        "Delete error:",
        error
      )

      alert(
        "Unable to delete register entry."
      )
    }
  }

  // --------------------------------------------------
  // EXPORT EXCEL
  // --------------------------------------------------

  const exportExcel = () => {
    if (registerData.length === 0) {
      alert(
        "Register-la bill details illa."
      )
      return
    }

    const excelData =
      registerData.map(
        (row, index) => ({
          "S.No": index + 1,

          "Bill No.":
            row.billNo,

          Date:
            row.date,

          "Name & Address of the Prescriber":
            row.prescriber,

          "Name & Address of the Patient":
            row.patient,

          "Name of the Drug or Ingredient":
            row.drug,

          Quantity:
            row.quantity,

          "Manufacturer Name":
            row.manufacturer,

          "Batch No.":
            row.batchNo,

          "Date of Expiry":
            row.expiry,

          "Signature of Pharmacist":
            row.signature,
        })
      )

    const worksheet =
      XLSX.utils.json_to_sheet(
        excelData
      )

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 14 },
      { wch: 32 },
      { wch: 32 },
      { wch: 32 },
      { wch: 12 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
      { wch: 25 },
    ]

    const workbook =
      XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Prescription Register"
    )

    XLSX.writeFile(
      workbook,
      "Prescription_Register_Rule_65_3.xlsx"
    )

    alert(
      "Register Excel successfully exported!"
    )
  }

  // --------------------------------------------------
  // EXPORT PDF
  // --------------------------------------------------

  const exportPDF = () => {
    if (registerData.length === 0) {
      alert(
        "Register-la bill details illa."
      )
      return
    }

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      })

      const pageWidth =
        doc.internal.pageSize.getWidth()

      const pageHeight =
        doc.internal.pageSize.getHeight()

      // ----------------------------------------------
      // TITLE
      // ----------------------------------------------

      doc.setFont(
        "times",
        "bold"
      )

      doc.setFontSize(16)

      doc.text(
        "PRESCRIPTION REGISTER",
        pageWidth / 2,
        11,
        {
          align: "center",
        }
      )

      doc.setFont(
        "times",
        "normal"
      )

      doc.setFontSize(11)

      doc.text(
        "[RULE 65(3)]",
        pageWidth / 2,
        18,
        {
          align: "center",
        }
      )

      // ----------------------------------------------
      // TABLE HEADER
      // ----------------------------------------------

      const head = [[
        "S.No",
        "Bill No.",
        "Date",
        "Name & Address of the Prescriber",
        "Name & Address of the Patient",
        "Name of the Drug or Ingredient",
        "Quantity",
        "Manufacturer Name",
        "Batch No.",
        "Date of Expiry",
        "Signature of Pharmacist",
      ]]

      // ----------------------------------------------
      // TABLE BODY
      // ----------------------------------------------

      const body =
        registerData.map(
          (row, index) => [
            index + 1,
            row.billNo ?? "",
            row.date ?? "",
            row.prescriber ?? "",
            row.patient ?? "",
            row.drug ?? "",
            row.quantity ?? "",
            row.manufacturer ?? "",
            row.batchNo ?? "",
            row.expiry ?? "",
            row.signature ?? "",
          ]
        )

      // ----------------------------------------------
      // PDF TABLE
      // ----------------------------------------------

      autoTable(doc, {
        head,
        body,

        startY: 22,

        theme: "grid",

        tableWidth: 224,

        styles: {
          font: "times",
          fontStyle: "normal",
          fontSize: 7,

          cellPadding: 1.5,

          textColor: [
            0,
            0,
            0,
          ],

          lineColor: [
            80,
            80,
            80,
          ],

          lineWidth: 0.2,

          valign: "middle",

          overflow: "linebreak",
        },

        headStyles: {
          font: "times",
          fontStyle: "bold",

          fontSize: 7,

          fillColor: [
            229,
            231,
            235,
          ],

          textColor: [
            17,
            24,
            39,
          ],

          halign: "center",

          valign: "middle",
        },

        bodyStyles: {
          halign: "center",
          valign: "middle",
        },

        columnStyles: {
          0: {
            cellWidth: 8,
          },

          1: {
            cellWidth: 14,
          },

          2: {
            cellWidth: 17,
          },

          3: {
            cellWidth: 29,
          },

          4: {
            cellWidth: 29,
          },

          5: {
            cellWidth: 29,
          },

          6: {
            cellWidth: 13,
          },

          7: {
            cellWidth: 24,
          },

          8: {
            cellWidth: 17,
          },

          9: {
            cellWidth: 17,
          },

          10: {
            cellWidth: 27,
          },
        },

        // --------------------------------------------
        // REDUCED SIDE GAP
        // --------------------------------------------

        margin: {
          left: 36.5,
          right: 36.5,
          top: 22,
          bottom: 10,
        },

        didDrawPage: () => {
          doc.setFont(
            "times",
            "normal"
          )

          doc.setFontSize(8)

          doc.text(
            `Page ${doc.getNumberOfPages()}`,
            pageWidth / 2,
            pageHeight - 5,
            {
              align: "center",
            }
          )
        },
      })

      doc.save(
        "Prescription_Register_Rule_65_3.pdf"
      )

      alert(
        "Register PDF successfully exported!"
      )
    } catch (error) {
      console.error(
        "PDF export error:",
        error
      )

      alert(
        "PDF export failed. Please try again."
      )
    }
  }

  // --------------------------------------------------
  // BACK
  // --------------------------------------------------

  const goBack = () => {
    window.history.pushState(
      {},
      "",
      "/"
    )

    window.location.reload()
  }

  // --------------------------------------------------
  // INPUT COMPONENT
  // --------------------------------------------------

  const editableInput = (
    row,
    field,
    placeholder = ""
  ) => {
    return (
      <input
        type="text"
        value={
          row[field] ?? ""
        }
        placeholder={
          placeholder
        }
        onChange={(e) =>
          updateField(
            row.id,
            field,
            e.target.value
          )
        }
        style={
          tableInputStyle
        }
      />
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor:
          "#f3f4f6",
        padding: "25px",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        {/* TOP BUTTONS */}

        <div
          className="no-print"
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            marginBottom:
              "20px",
            gap: "10px",
            flexWrap:
              "wrap",
          }}
        >
          {/* BACK */}

          <button
            onClick={goBack}
            style={{
              backgroundColor:
                "#2563eb",
              color: "white",
              border: "none",
              borderRadius:
                "8px",
              padding:
                "10px 18px",
              cursor:
                "pointer",
              fontSize:
                "15px",
            }}
          >
            ← Back
          </button>

          {/* REFRESH */}

          <button
            onClick={loadBills}
            style={{
              backgroundColor:
                "#0d9488",
              color: "white",
              border: "none",
              borderRadius:
                "8px",
              padding:
                "10px 18px",
              cursor:
                "pointer",
              fontSize:
                "15px",
            }}
          >
            🔄 Refresh Register
          </button>

          {/* AUTO FILL */}

          <button
            onClick={
              autoFillAll
            }
            style={{
              backgroundColor:
                "#7c3aed",
              color: "white",
              border: "none",
              borderRadius:
                "8px",
              padding:
                "10px 18px",
              cursor:
                "pointer",
              fontSize:
                "15px",
              fontWeight:
                "bold",
            }}
          >
            🔄 Auto Fill All
          </button>

          {/* EXCEL */}

          <button
            onClick={
              exportExcel
            }
            style={{
              backgroundColor:
                "#16a34a",
              color: "white",
              border: "none",
              borderRadius:
                "8px",
              padding:
                "10px 18px",
              cursor:
                "pointer",
              fontSize:
                "15px",
              fontWeight:
                "bold",
            }}
          >
            📊 Export Excel
          </button>

          {/* PDF */}

          <button
            onClick={
              exportPDF
            }
            style={{
              backgroundColor:
                "#dc2626",
              color: "white",
              border: "none",
              borderRadius:
                "8px",
              padding:
                "10px 18px",
              cursor:
                "pointer",
              fontSize:
                "15px",
              fontWeight:
                "bold",
            }}
          >
            📄 Export PDF
          </button>
        </div>

        {/* TITLE */}

        <div
          style={{
            backgroundColor:
              "white",
            padding:
              "20px",
            borderRadius:
              "12px",
            boxShadow:
              "0 3px 12px rgba(0,0,0,0.08)",
            marginBottom:
              "20px",
          }}
        >
          <h1
            style={{
              textAlign:
                "center",
              margin: "0",
              color:
                "#7c2d12",
              fontSize:
                "26px",
            }}
          >
            PRESCRIPTION REGISTER
          </h1>

          <h2
            style={{
              textAlign:
                "center",
              margin:
                "5px 0 0 0",
              color:
                "#374151",
              fontSize:
                "18px",
            }}
          >
            [RULE 65(3)]
          </h2>
        </div>

        {/* REGISTER TABLE */}

        <div
          style={{
            backgroundColor:
              "white",
            padding:
              "15px",
            borderRadius:
              "12px",
            boxShadow:
              "0 3px 12px rgba(0,0,0,0.08)",
            overflowX:
              "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth:
                "1500px",
              borderCollapse:
                "collapse",
              fontSize:
                "13px",
            }}
          >
            <thead>
              <tr>
                <th
                  style={
                    thStyle
                  }
                >
                  Bill No.
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Date
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Name & Address
                  of the Prescriber
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Name & Address
                  of the Patient
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Name of the Drug
                  or Ingredient
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Quantity
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Manufacturer Name
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Batch No.
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Date of Expiry
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Signature of
                  Pharmacist
                </th>

                <th
                  className="no-print"
                  style={
                    thStyle
                  }
                >
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {registerData.length ===
              0 ? (
                <tr>
                  <td
                    colSpan="11"
                    style={{
                      padding:
                        "30px",
                      textAlign:
                        "center",
                      color:
                        "#6b7280",
                    }}
                  >
                    No bills saved yet.
                  </td>
                </tr>
              ) : (
                registerData.map(
                  (row) => (
                    <tr
                      key={
                        row.id
                      }
                    >
                      {/* BILL NO */}

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {editableInput(
                          row,
                          "billNo"
                        )}
                      </td>

                      {/* DATE */}

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {editableInput(
                          row,
                          "date"
                        )}
                      </td>

                      {/* PRESCRIBER */}

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {editableInput(
                          row,
                          "prescriber"
                        )}
                      </td>

                      {/* PATIENT */}

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {editableInput(
                          row,
                          "patient"
                        )}
                      </td>

                      {/* DRUG */}

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {editableInput(
                          row,
                          "drug"
                        )}
                      </td>

                      {/* QUANTITY */}

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {editableInput(
                          row,
                          "quantity"
                        )}
                      </td>

                      {/* MANUFACTURER */}

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {editableInput(
                          row,
                          "manufacturer"
                        )}
                      </td>

                      {/* BATCH */}

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {editableInput(
                          row,
                          "batchNo"
                        )}
                      </td>

                      {/* EXPIRY */}

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {editableInput(
                          row,
                          "expiry"
                        )}
                      </td>

                      {/* SIGNATURE */}

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {editableInput(
                          row,
                          "signature",
                          "Signature"
                        )}
                      </td>

                      {/* DELETE */}

                      <td
                        className="no-print"
                        style={
                          tdStyle
                        }
                      >
                        <button
                          onClick={() =>
                            deleteEntry(
                              row
                            )
                          }
                          style={{
                            backgroundColor:
                              "#dc2626",
                            color:
                              "white",
                            border:
                              "none",
                            borderRadius:
                              "6px",
                            padding:
                              "8px 12px",
                            cursor:
                              "pointer",
                            fontWeight:
                              "bold",
                          }}
                        >
                          🗑 Delete
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>

        {/* INFO */}

        <div
          className="no-print"
          style={{
            marginTop:
              "15px",
            backgroundColor:
              "#ecfdf5",
            color:
              "#166534",
            padding:
              "12px",
            borderRadius:
              "8px",
            fontSize:
              "14px",
          }}
        >
          Total Register Entries:{" "}
          <b>
            {
              registerData.length
            }
          </b>
        </div>
      </div>

      {/* PRINT CSS */}

      <style>
        {`
          @media print {

            @page {
              size: A4 landscape;
              margin: 5mm;
            }

            body {
              margin: 0;
              padding: 0;
              background: white !important;
            }

            .no-print {
              display: none !important;
            }

            input {
              border: none !important;
              outline: none !important;
              background: transparent !important;
              color: #111827 !important;
              box-shadow: none !important;
            }

            table {
              width: 100% !important;
              min-width: 0 !important;
              font-size: 10px !important;
            }

            th,
            td {
              border: 1px solid #000 !important;
              padding: 5px !important;
            }

            h1 {
              font-size: 20px !important;
            }

            h2 {
              font-size: 14px !important;
            }

            div {
              box-shadow: none !important;
            }
          }
        `}
      </style>
    </div>
  )
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const tableInputStyle = {
  width: "100%",
  minWidth: "100px",
  boxSizing:
    "border-box",
  padding:
    "7px 6px",
  border:
    "1px solid #cbd5e1",
  borderRadius:
    "5px",
  outline:
    "none",
  fontSize:
    "13px",
  backgroundColor:
    "white",
  color:
    "#111827",
}

const thStyle = {
  border:
    "1px solid #374151",
  padding:
    "10px 8px",
  backgroundColor:
    "#e5e7eb",
  color:
    "#111827",
  textAlign:
    "center",
  fontWeight:
    "bold",
  verticalAlign:
    "middle",
}

const tdStyle = {
  border:
    "1px solid #6b7280",
  padding:
    "8px",
  textAlign:
    "center",
  verticalAlign:
    "middle",
  color:
    "#111827",
}

export default Register