import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

function Medicines() {
  const [medicines, setMedicines] = useState(() => {
    const saved = localStorage.getItem("kaviMedicines");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: Date.now(),
            name: "Paracetamol",
            combination: "Paracetamol 500mg",
            mfr: "",
            batch: "",
            expiry: "",
            stock: "",
            rate: "",
          },
        ];
  });

  const [name, setName] = useState("");
  const [combination, setCombination] = useState("");
  const [mfr, setMfr] = useState("");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [stock, setStock] = useState("");
  const [rate, setRate] = useState("");
  const [selectedFile, setSelectedFile] = useState("");

  useEffect(() => {
    localStorage.setItem("kaviMedicines", JSON.stringify(medicines));
  }, [medicines]);

  const addMedicine = () => {
    if (!name.trim()) {
      alert("Medicine Name enter pannunga");
      return;
    }

    const newMedicine = {
      id: Date.now(),
      name,
      combination,
      mfr,
      batch,
      expiry,
      stock,
      rate,
    };

    setMedicines((prev) => [...prev, newMedicine]);

    setName("");
    setCombination("");
    setMfr("");
    setBatch("");
    setExpiry("");
    setStock("");
    setRate("");
  };

  const deleteMedicine = (id) => {
    if (!confirm("Indha medicine-a delete panna okay-va?")) return;

    setMedicines((prev) => prev.filter((item) => item.id !== id));
  };

  const editMedicine = (id, field, value) => {
    setMedicines((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const getValue = (row, headers, possibleNames) => {
    for (const name of possibleNames) {
      const index = headers.findIndex(
        (h) => String(h).trim().toLowerCase() === name.toLowerCase()
      );

      if (index !== -1) {
        return row[index] ?? "";
      }
    }

    return "";
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setSelectedFile(file.name);

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        });

        if (!rows.length) {
          alert("Excel file empty-a irukku");
          return;
        }

        const headers = rows[0];

        const imported = rows
          .slice(1)
          .filter((row) => row.some((cell) => String(cell).trim() !== ""))
          .map((row, index) => ({
            id: Date.now() + index,

            name: getValue(row, headers, [
              "Medicine Name",
              "Brand Name",
              "Product Name",
              "Name",
            ]),

            combination: getValue(row, headers, [
              "Combination",
              "Generic Name",
              "Composition",
              "Generic",
            ]),

            mfr: getValue(row, headers, [
              "Manufacturer",
              "MFR",
              "Manufacturer Name",
              "Company",
              "Company Name",
            ]),

            batch: getValue(row, headers, [
              "Batch",
              "Batch No",
              "Batch Number",
              "Batch Code",
            ]),

            expiry: getValue(row, headers, [
              "Expiry",
              "Expiry Date",
              "Expire Date",
            ]),

            stock: getValue(row, headers, [
              "Stock",
              "Stock Quantity",
              "Quantity",
              "Qty",
              "Stock Qty",
            ]),

            rate: getValue(row, headers, [
              "Rate",
              "Price",
              "MRP",
              "Selling Price",
              "Unit Price",
            ]),

            fileName: file.name,
          }));

        if (!imported.length) {
          alert("Excel-la medicine data kidaikala");
          return;
        }

        setMedicines((prev) => [...prev, ...imported]);

        alert(`${imported.length} medicines imported successfully!`);
      } catch (error) {
        console.error(error);
        alert("Excel file read panna mudiyala");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f3ff",
        padding: "25px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "auto",
        }}
      >
        <button
          onClick={() => (window.location.href = "/")}
          style={{
            background: "#6d28d9",
            color: "white",
            border: "none",
            padding: "10px 18px",
            borderRadius: "8px",
            cursor: "pointer",
            marginBottom: "20px",
          }}
        >
          ← Back
        </button>

        <h1
          style={{
            color: "#4c1d95",
            marginBottom: "5px",
          }}
        >
          Medicine List
        </h1>

        <p style={{ color: "#666" }}>
          Add medicines manually or import from Excel / CSV
        </p>

        {/* MANUAL ADD */}

        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            marginTop: "20px",
            boxShadow: "0 3px 12px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ color: "#5b21b6" }}>Add Medicine</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              gap: "10px",
            }}
          >
            <input
              placeholder="Medicine Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              placeholder="Combination"
              value={combination}
              onChange={(e) => setCombination(e.target.value)}
            />

            <input
              placeholder="MFR."
              value={mfr}
              onChange={(e) => setMfr(e.target.value)}
            />

            <input
              placeholder="Batch"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
            />

            <input
              placeholder="Expiry"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />

            <input
              placeholder="Stock"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />

            <input
              placeholder="Rate"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />

            <button
              onClick={addMedicine}
              style={{
                background: "#7c3aed",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              + Add Medicine
            </button>
          </div>
        </div>

        {/* EXCEL UPLOAD */}

        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            marginTop: "20px",
            boxShadow: "0 3px 12px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ color: "#5b21b6" }}>
            Import Excel / CSV
          </h2>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
          />

          {selectedFile && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                background: "#dcfce7",
                color: "#166534",
                borderRadius: "8px",
              }}
            >
              Selected file: <b>{selectedFile}</b>
            </div>
          )}
        </div>

        {/* TABLE */}

        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            marginTop: "20px",
            overflowX: "auto",
            boxShadow: "0 3px 12px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ color: "#5b21b6" }}>
            Saved Medicines ({medicines.length})
          </h2>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "15px",
            }}
          >
            <thead>
              <tr style={{ background: "#ede9fe" }}>
                <th>Medicine Name</th>
                <th>Combination</th>
                <th>MFR.</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th>Stock</th>
                <th>Rate</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {medicines.map((medicine) => (
                <tr key={medicine.id}>
                  <td>
                    <input
                      value={medicine.name || ""}
                      onChange={(e) =>
                        editMedicine(
                          medicine.id,
                          "name",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={medicine.combination || ""}
                      onChange={(e) =>
                        editMedicine(
                          medicine.id,
                          "combination",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={medicine.mfr || ""}
                      onChange={(e) =>
                        editMedicine(
                          medicine.id,
                          "mfr",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={medicine.batch || ""}
                      onChange={(e) =>
                        editMedicine(
                          medicine.id,
                          "batch",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={medicine.expiry || ""}
                      onChange={(e) =>
                        editMedicine(
                          medicine.id,
                          "expiry",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={medicine.stock || ""}
                      onChange={(e) =>
                        editMedicine(
                          medicine.id,
                          "stock",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={medicine.rate || ""}
                      onChange={(e) =>
                        editMedicine(
                          medicine.id,
                          "rate",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <button
                      onClick={() => deleteMedicine(medicine.id)}
                      style={{
                        background: "#dc2626",
                        color: "white",
                        border: "none",
                        padding: "7px 12px",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Medicines;