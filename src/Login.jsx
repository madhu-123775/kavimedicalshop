import { useState } from "react"

function Login() {
  const [mobile, setMobile] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleLogin = (e) => {
    e.preventDefault()
    setError("")

    if (!mobile || !email || !password) {
      setError("Please enter mobile number, email ID and password.")
      return
    }

    // Temporary login
    // Real authentication can be connected later.
    localStorage.setItem("kaviLoggedIn", "true")

    window.location.href = "/"
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#eef7f4",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          backgroundColor: "white",
          padding: "35px",
          borderRadius: "18px",
          boxShadow: "0 6px 25px rgba(0,0,0,0.10)",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            textAlign: "center",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              fontSize: "45px",
              marginBottom: "10px",
            }}
          >
            💊
          </div>

          <h1
            style={{
              margin: 0,
              color: "#087f5b",
              fontSize: "30px",
            }}
          >
            Kavi Pharmacy
          </h1>

          <p
            style={{
              color: "#64748b",
              marginTop: "8px",
            }}
          >
            Billing Management System
          </p>
        </div>

        <form onSubmit={handleLogin}>

          {/* MOBILE */}

          <label style={labelStyle}>
            📱 Mobile Number
          </label>

          <input
            type="tel"
            value={mobile}
            onChange={(e) =>
              setMobile(
                e.target.value.replace(/\D/g, "")
              )
            }
            placeholder="Enter mobile number"
            maxLength="10"
            style={inputStyle}
          />

          {/* EMAIL */}

          <label style={labelStyle}>
            📧 Email ID
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="Enter email ID"
            style={inputStyle}
          />

          {/* PASSWORD */}

          <label style={labelStyle}>
            🔑 Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            placeholder="Enter password"
            style={inputStyle}
          />

          {/* ERROR */}

          {error && (
            <div
              style={{
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                padding: "10px",
                borderRadius: "7px",
                marginBottom: "15px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {/* LOGIN BUTTON */}

          <button
            type="submit"
            style={{
              width: "100%",
              backgroundColor: "#087f5b",
              color: "white",
              padding: "13px",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "17px",
              fontWeight: "bold",
            }}
          >
            Login
          </button>
        </form>

        {/* FORGOT PASSWORD */}

        <div
          style={{
            textAlign: "center",
            marginTop: "20px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              window.location.href = "/forgot-password"
            }}
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Forgot Password?
          </button>
        </div>

        {/* CREATE ACCOUNT */}

        <div
          style={{
            textAlign: "center",
            marginTop: "15px",
            color: "#64748b",
            fontSize: "14px",
          }}
        >
          New user?{" "}

          <button
            type="button"
            onClick={() => {
              window.location.href =
                "/register-account"
            }}
            style={{
              background: "none",
              border: "none",
              color: "#087f5b",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  fontWeight: "bold",
  color: "#123c69",
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  marginBottom: "18px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "15px",
  outline: "none",
}

export default Login