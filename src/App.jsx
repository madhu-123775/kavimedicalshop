import NewBill from "./NewBill"
import Stock from "./stock"
import ProductList from "./ProductList";
import Register from "./Register"
import SalesReport from "./SalesReport"
import Doctors from "./Doctors"
import Login from "./Login"
import RegisterAccount from "./RegisterAccount"
import ForgotPassword from "./ForgotPassword"

function App() {
  const isLoggedIn =
    localStorage.getItem("kaviLoggedIn") === "true"

  // LOGIN CHECK
  if (!isLoggedIn) {
    if (window.location.pathname === "/register-account") {
      return <RegisterAccount />
    }

    if (window.location.pathname === "/forgot-password") {
      return <ForgotPassword />
    }

    return <Login />
  }

  // PAGE ROUTES
  if (window.location.pathname === "/new-bill") {
    return <NewBill />
  }

  if (window.location.pathname === "/stock") {
    return <Stock />
  }

  if (window.location.pathname === "/product-list") {
    return <ProductList />
  }

  if (window.location.pathname === "/sales-report") {
    return <SalesReport />
  }

  if (window.location.pathname === "/register") {
    return <Register />
  }

  if (window.location.pathname === "/doctors") {
    return <Doctors />
  }

  // NAVIGATION FUNCTION
  const goTo = (path) => {
    window.history.pushState({}, "", path)
    window.location.reload()
  }

  // LOGOUT
  const logout = () => {
    localStorage.removeItem("kaviLoggedIn")
    window.location.href = "/"
  }

  // DASHBOARD
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#eef7f4",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
        color: "#123c69",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          background: "white",
          borderRadius: "20px",
          padding: "35px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "35px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "34px",
              fontWeight: "800",
              color: "#087f5b",
            }}
          >
            Kavi Pharmacy
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#666",
              fontSize: "16px",
            }}
          >
            Billing Management System
          </p>
        </div>

        {/* MENU */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "18px",
          }}
        >
          {/* NEW BILL */}
          <button
            onClick={() => goTo("/new-bill")}
            style={{
              padding: "22px",
              border: "none",
              borderRadius: "14px",
              background: "#087f5b",
              color: "white",
              fontSize: "18px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            🧾 New Bill
          </button>

          {/* STOCK */}
          <button
            onClick={() => goTo("/stock")}
            style={{
              padding: "22px",
              border: "none",
              borderRadius: "14px",
              background: "#2563eb",
              color: "white",
              fontSize: "18px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            📦 Stock
          </button>

          {/* DOCTORS */}
          <button
            onClick={() => goTo("/doctors")}
            style={{
              padding: "22px",
              border: "none",
              borderRadius: "14px",
              background: "#db2777",
              color: "white",
              fontSize: "18px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            👨‍⚕️ Doctors
          </button>

          {/* SALES REPORT */}
          <button
            onClick={() => goTo("/sales-report")}
            style={{
              padding: "22px",
              border: "none",
              borderRadius: "14px",
              background: "#7c3aed",
              color: "white",
              fontSize: "18px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            📊 Sales Report
          </button>

          {/* PRODUCT LIST */}
          <button
            onClick={() => goTo("/product-list")}
            style={{
              padding: "22px",
              border: "none",
              borderRadius: "14px",
              background: "#ea580c",
              color: "white",
              fontSize: "18px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            📋 Product List
          </button>

          {/* REGISTER */}
          <button
            onClick={() => goTo("/register")}
            style={{
              padding: "22px",
              border: "none",
              borderRadius: "14px",
              background: "#0891b2",
              color: "white",
              fontSize: "18px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            📖 Register
          </button>
        </div>

        {/* LOGOUT */}
        <div
          style={{
            textAlign: "center",
            marginTop: "35px",
          }}
        >
          <button
            onClick={logout}
            style={{
              padding: "12px 30px",
              border: "none",
              borderRadius: "10px",
              background: "#dc2626",
              color: "white",
              fontSize: "16px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default App