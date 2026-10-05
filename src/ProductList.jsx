import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newProduct, setNewProduct] = useState({
    name: "",
    combination: "",
  });

  const [selectedFile, setSelectedFile] = useState("");

  // SEARCH
  const [searchText, setSearchText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // =====================================================
  // LOAD PRODUCTS FROM SUPABASE
  // =====================================================

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("products")
        .select("id, created_at, product_name, combination")
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        console.error("Load products error:", error);
        alert("Unable to load products");
        return;
      }

      const formattedProducts = (data || []).map(
        (product) => ({
          id: product.id,
          name: product.product_name || "",
          combination: product.combination || "",
        })
      );

      setProducts(formattedProducts);
    } catch (error) {
      console.error(error);
      alert("Unable to load products");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // INPUT CHANGE
  // =====================================================

  const handleChange = (field, value) => {
    setNewProduct((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredProducts = products.filter((product) => {
    const productName = String(
      product.name || ""
    ).toLowerCase();

    const search = searchText
      .trim()
      .toLowerCase();

    return (
      search.length >= 1 &&
      productName.includes(search)
    );
  });

  const handleSearchChange = (value) => {
    setSearchText(value);
    setShowSuggestions(true);
  };

  const handleProductSelect = (product) => {
    setSearchText(product.name || "");
    setShowSuggestions(false);
  };

  // =====================================================
  // ADD PRODUCT TO SUPABASE
  // =====================================================

  const addProduct = async () => {
    const productName = newProduct.name.trim();
    const combination =
      newProduct.combination.trim();

    if (!productName) {
      alert("Please enter Product Name");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .insert([
          {
            product_name: productName,
            combination: combination,
          },
        ])
        .select(
          "id, created_at, product_name, combination"
        )
        .single();

      if (error) {
        console.error(
          "Add product error:",
          error
        );

        alert(
          "Unable to add product.\n\n" +
            error.message
        );

        return;
      }

      const addedProduct = {
        id: data.id,
        name: data.product_name || "",
        combination:
          data.combination || "",
      };

      setProducts((prev) => [
        ...prev,
        addedProduct,
      ]);

      setNewProduct({
        name: "",
        combination: "",
      });

      alert("Product added successfully!");
    } catch (error) {
      console.error(error);

      alert(
        "Unable to add product.\n\n" +
          error.message
      );
    }
  };

  // =====================================================
  // FIND EXCEL COLUMN
  // =====================================================

  const findHeader = (
    headers,
    possibleNames
  ) => {
    for (const name of possibleNames) {
      const found = headers.find(
        (header) =>
          String(header)
            .trim()
            .toLowerCase() ===
          name.toLowerCase()
      );

      if (found !== undefined) {
        return found;
      }
    }

    return null;
  };

  // =====================================================
  // EXCEL / CSV UPLOAD
  // =====================================================

  const handleFileUpload = (event) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setSelectedFile(file.name);

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = e.target.result;

        const workbook = XLSX.read(data, {
          type: "array",
        });

        const sheetName =
          workbook.SheetNames[0];

        const worksheet =
          workbook.Sheets[sheetName];

        const rows =
          XLSX.utils.sheet_to_json(
            worksheet,
            {
              header: 1,
              defval: "",
            }
          );

        if (!rows.length) {
          alert("Excel file is empty");
          return;
        }

        // Find header row
        let headerIndex = 0;

        for (
          let i = 0;
          i < Math.min(10, rows.length);
          i++
        ) {
          const row = rows[i]
            .map((item) =>
              String(item)
                .trim()
                .toLowerCase()
            )
            .filter(Boolean);

          const hasProductName =
            row.includes("medicine name") ||
            row.includes("product name") ||
            row.includes("brand name") ||
            row.includes("name");

          const hasCombination =
            row.includes("combination") ||
            row.includes("generic name") ||
            row.includes("composition") ||
            row.includes("generic");

          if (
            hasProductName ||
            hasCombination
          ) {
            headerIndex = i;
            break;
          }
        }

        const headers =
          rows[headerIndex];

        const nameHeader =
          findHeader(headers, [
            "Medicine Name",
            "Product Name",
            "Brand Name",
            "Name",
          ]);

        const combinationHeader =
          findHeader(headers, [
            "Combination",
            "Generic Name",
            "Composition",
            "Generic",
          ]);

        const importedProducts = [];

        for (
          let i = headerIndex + 1;
          i < rows.length;
          i++
        ) {
          const row = rows[i];

          const getValue = (header) => {
            if (
              header === null ||
              header === undefined
            ) {
              return "";
            }

            const index =
              headers.indexOf(header);

            if (index === -1) {
              return "";
            }

            return row[index] ?? "";
          };

          const productName =
            String(
              getValue(nameHeader)
            ).trim();

          const combination =
            String(
              getValue(
                combinationHeader
              )
            ).trim();

          if (
            productName ||
            combination
          ) {
            importedProducts.push({
              product_name:
                productName,
              combination:
                combination,
            });
          }
        }

        if (
          importedProducts.length === 0
        ) {
          alert(
            "No product data found.\n\nPlease check your Excel column names."
          );

          return;
        }

        // Insert imported products into Supabase
        const { data: insertedData, error } =
          await supabase
            .from("products")
            .insert(importedProducts)
            .select(
              "id, created_at, product_name, combination"
            );

        if (error) {
          console.error(
            "Excel import error:",
            error
          );

          alert(
            "Unable to import products.\n\n" +
              error.message
          );

          return;
        }

        const formattedProducts =
          (insertedData || []).map(
            (product) => ({
              id: product.id,
              name:
                product.product_name ||
                "",
              combination:
                product.combination ||
                "",
            })
          );

        setProducts((prev) => [
          ...prev,
          ...formattedProducts,
        ]);

        alert(
          `${formattedProducts.length} product(s) imported successfully!`
        );
      } catch (error) {
        console.error(error);

        alert(
          "Unable to read the Excel/CSV file.\n\n" +
            error.message
        );
      }
    };

    reader.readAsArrayBuffer(file);

    // Allow same file again
    event.target.value = "";
  };

  // =====================================================
  // EDIT PRODUCT
  // =====================================================

  const editProduct = async (
    id,
    field,
    value
  ) => {
    // Update screen immediately
    setProducts((prev) =>
      prev.map((product) =>
        product.id === id
          ? {
              ...product,
              [field]: value,
            }
          : product
      )
    );

    try {
      const updateData =
        field === "name"
          ? {
              product_name: value,
            }
          : {
              combination: value,
            };

      const { error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", id);

      if (error) {
        console.error(
          "Update product error:",
          error
        );

        alert(
          "Unable to update product.\n\n" +
            error.message
        );

        // Reload original data
        loadProducts();
      }
    } catch (error) {
      console.error(error);

      alert(
        "Unable to update product.\n\n" +
          error.message
      );

      loadProducts();
    }
  };

  // =====================================================
  // DELETE PRODUCT
  // =====================================================

  const deleteProduct = async (id) => {
    const product = products.find(
      (item) => item.id === id
    );

    const confirmDelete =
      window.confirm(
        `Delete "${
          product?.name ||
          "this product"
        }"?`
      );

    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) {
        console.error(
          "Delete product error:",
          error
        );

        alert(
          "Unable to delete product.\n\n" +
            error.message
        );

        return;
      }

      setProducts((prev) =>
        prev.filter(
          (product) =>
            product.id !== id
        )
      );

      alert("Product deleted successfully!");
    } catch (error) {
      console.error(error);

      alert(
        "Unable to delete product.\n\n" +
          error.message
      );
    }
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f7fb",
        padding: "25px",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          background:
            "linear-gradient(135deg, #059669, #10b981)",
          color: "white",
          padding: "22px",
          borderRadius: "16px",
          marginBottom: "20px",
          boxShadow:
            "0 8px 25px rgba(5,150,105,0.2)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
          }}
        >
          📋 Product List
        </h1>

        <p
          style={{
            margin: "7px 0 0",
            opacity: 0.9,
          }}
        >
          Kavi Medical Shop
        </p>
      </div>

      {/* BACK BUTTON */}

      <button
        onClick={() => {
          window.location.href = "/";
        }}
        style={{
          border: "none",
          background: "#111827",
          color: "white",
          padding: "10px 18px",
          borderRadius: "8px",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        ← Back to Dashboard
      </button>

      {/* SEARCH PRODUCT */}

      <div
        style={{
          background: "white",
          borderRadius: "14px",
          padding: "20px",
          marginBottom: "20px",
          boxShadow:
            "0 3px 15px rgba(0,0,0,0.08)",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            color: "#111827",
          }}
        >
          🔍 Search Product
        </h2>

        <div
          style={{
            position: "relative",
            width: "100%",
          }}
        >
          <input
            type="text"
            placeholder="Search product..."
            value={searchText}
            onChange={(e) =>
              handleSearchChange(
                e.target.value
              )
            }
            onFocus={() => {
              if (
                searchText.trim() !== ""
              ) {
                setShowSuggestions(true);
              }
            }}
            style={inputStyle}
          />

          {/* DROPDOWN */}

          {showSuggestions &&
            searchText.trim() !== "" &&
            filteredProducts.length >
              0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background:
                    "white",
                  border:
                    "1px solid #d1d5db",
                  borderRadius: "8px",
                  marginTop: "4px",
                  maxHeight: "250px",
                  overflowY: "auto",
                  zIndex: 9999,
                  boxShadow:
                    "0 6px 18px rgba(0,0,0,0.15)",
                }}
              >
                {filteredProducts.map(
                  (product) => (
                    <div
                      key={product.id}
                      onClick={() =>
                        handleProductSelect(
                          product
                        )
                      }
                      style={{
                        padding:
                          "13px 15px",
                        borderBottom:
                          "1px solid #eeeeee",
                        cursor:
                          "pointer",
                        fontSize: "16px",
                        color: "#111827",
                      }}
                      onMouseEnter={(
                        e
                      ) => {
                        e.currentTarget.style.backgroundColor =
                          "#ecfdf5";
                      }}
                      onMouseLeave={(
                        e
                      ) => {
                        e.currentTarget.style.backgroundColor =
                          "white";
                      }}
                    >
                      <strong>
                        {product.name}
                      </strong>

                      {product.combination && (
                        <div
                          style={{
                            fontSize:
                              "13px",
                            color:
                              "#6b7280",
                            marginTop:
                              "3px",
                          }}
                        >
                          {
                            product.combination
                          }
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

          {/* NO RESULTS */}

          {showSuggestions &&
            searchText.trim() !== "" &&
            filteredProducts.length ===
              0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background:
                    "white",
                  border:
                    "1px solid #d1d5db",
                  borderRadius: "8px",
                  marginTop: "4px",
                  padding: "14px",
                  zIndex: 9999,
                  color: "#6b7280",
                  boxShadow:
                    "0 6px 18px rgba(0,0,0,0.1)",
                }}
              >
                No matching products found
              </div>
            )}
        </div>

        {/* CLEAR */}

        {searchText && (
          <button
            onClick={() => {
              setSearchText("");
              setShowSuggestions(false);
            }}
            style={{
              marginTop: "10px",
              border: "none",
              background: "#f1f5f9",
              color: "#374151",
              padding: "7px 14px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            ✕ Clear Search
          </button>
        )}
      </div>

      {/* ADD PRODUCT */}

      <div
        style={{
          background: "white",
          borderRadius: "14px",
          padding: "20px",
          marginBottom: "20px",
          boxShadow:
            "0 3px 15px rgba(0,0,0,0.08)",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            color: "#111827",
          }}
        >
          ➕ Add Product
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          <input
            placeholder="Product Name"
            value={newProduct.name}
            onChange={(e) =>
              handleChange(
                "name",
                e.target.value
              )
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter"
              ) {
                addProduct();
              }
            }}
            style={inputStyle}
          />

          <input
            placeholder="Combination"
            value={
              newProduct.combination
            }
            onChange={(e) =>
              handleChange(
                "combination",
                e.target.value
              )
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter"
              ) {
                addProduct();
              }
            }}
            style={inputStyle}
          />
        </div>

        <button
          onClick={addProduct}
          disabled={loading}
          style={{
            marginTop: "15px",
            background: "#059669",
            color: "white",
            border: "none",
            padding: "11px 22px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Add Product
        </button>
      </div>

      {/* EXCEL UPLOAD */}

      <div
        style={{
          background: "white",
          borderRadius: "14px",
          padding: "20px",
          marginBottom: "20px",
          boxShadow:
            "0 3px 15px rgba(0,0,0,0.08)",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            color: "#111827",
          }}
        >
          📁 Import Excel / CSV
        </h2>

        <p
          style={{
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          Upload your Product Name
          and Combination Excel or CSV
          file.
        </p>

        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={
            handleFileUpload
          }
        />

        {selectedFile && (
          <div
            style={{
              marginTop: "12px",
              background: "#dcfce7",
              color: "#166534",
              padding: "12px",
              borderRadius: "8px",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
            }}
          >
            <span>
              ✅ Selected:{" "}
              {selectedFile}
            </span>

            <button
              onClick={() =>
                setSelectedFile("")
              }
              style={{
                border: "none",
                background:
                  "transparent",
                color: "#166534",
                cursor: "pointer",
                fontWeight:
                  "bold",
              }}
            >
              ✕
            </button>
          </div>
        )}

        <div
          style={{
            marginTop: "12px",
            background: "#f3f4f6",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#374151",
          }}
        >
          Supported columns:
          <br />
          <strong>Product Name</strong>
          <br />
          <strong>Combination</strong>
        </div>
      </div>

      {/* DATABASE STATUS */}

      <div
        style={{
          background: "#d1fae5",
          color: "#065f46",
          padding: "12px 16px",
          borderRadius: "10px",
          marginBottom: "20px",
          fontSize: "14px",
        }}
      >
        ☁️ Product data is saved in
        Supabase database.

        <strong>
          {" "}
          {products.length} products
          loaded.
        </strong>
      </div>

      {/* SAVED PRODUCTS */}

      <div
        style={{
          background: "white",
          borderRadius: "14px",
          padding: "20px",
          boxShadow:
            "0 3px 15px rgba(0,0,0,0.08)",
          overflowX: "auto",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            color: "#111827",
          }}
        >
          📋 Saved Products
        </h2>

        {loading ? (
          <div
            style={{
              padding: "30px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div
            style={{
              padding: "30px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            No products added yet.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              minWidth: "650px",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#059669",
                  color: "white",
                }}
              >
                <th style={thStyle}>
                  S.No
                </th>

                <th style={thStyle}>
                  Product Name
                </th>

                <th style={thStyle}>
                  Combination
                </th>

                <th style={thStyle}>
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {products.map(
                (product, index) => (
                  <tr key={product.id}>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign:
                          "center",
                        fontWeight:
                          "bold",
                      }}
                    >
                      {index + 1}
                    </td>

                    <td
                      style={tdStyle}
                    >
                      <input
                        style={
                          tableInputStyle
                        }
                        value={
                          product.name ||
                          ""
                        }
                        onChange={(e) =>
                          editProduct(
                            product.id,
                            "name",
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td
                      style={tdStyle}
                    >
                      <input
                        style={
                          tableInputStyle
                        }
                        value={
                          product.combination ||
                          ""
                        }
                        onChange={(e) =>
                          editProduct(
                            product.id,
                            "combination",
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        textAlign:
                          "center",
                      }}
                    >
                      <button
                        onClick={() =>
                          deleteProduct(
                            product.id
                          )
                        }
                        style={{
                          background:
                            "#fee2e2",
                          color:
                            "#dc2626",
                          border:
                            "none",
                          padding:
                            "8px 12px",
                          borderRadius:
                            "7px",
                          cursor:
                            "pointer",
                          fontWeight:
                            "bold",
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
        )}
      </div>
    </div>
  );
}

// =====================================================
// STYLES
// =====================================================

const inputStyle = {
  width: "100%",
  padding: "11px",
  border:
    "1px solid #d1d5db",
  borderRadius: "8px",
  outline: "none",
  fontSize: "15px",
  boxSizing: "border-box",
};

const thStyle = {
  padding: "12px 10px",
  textAlign: "left",
  fontSize: "13px",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "8px",
  borderBottom:
    "1px solid #e5e7eb",
};

const tableInputStyle = {
  width: "100%",
  minWidth: "150px",
  padding: "8px",
  border:
    "1px solid #d1d5db",
  borderRadius: "6px",
  outline: "none",
  boxSizing: "border-box",
};

export default ProductList;