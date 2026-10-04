import { useState } from "react"

function RegisterAccount() {
  const [name, setName] = useState("")
  const [mobile, setMobile] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")

  const handleRegister = (e) => {
    e.preventDefault()
    setError("")

    if (!name || !mobile || !email || !password || !confirmPassword) {
      setError("Please fill all fields.")
      return
    }

    if (mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.")
      return
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    const account = {
      name,
      mobile,
      email,
      password,
    }

    localStorage.setItem(
      "kaviAccount",
      JSON.stringify(account)
    )

    alert("Account created successfully!")

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
          maxWidth: "450px",
          backgroundColor: "white",
          padding: "35px",
          borderRadius: "18px",
          boxShadow: "0 6px 25px rgba(0,0,0,0.10)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "25px",
          }}
        >
          <div style={{ fontSize: "42px" }}>
            💊
          </div>

          <h1
            style={{
              color: "#087f5b",
              margin: "8px 0",
            }}
          >
            Create Account
          </h1>

          <p
            style={{
              color: "#64748b",
              margin: 0,
            }}
          >
            Kavi Pharmacy
          </p>
        </div>

        <form onSubmit={handleRegister}>

          {/* NAME */}

          <label style={labelStyle}>
            👤 Full Name
          </label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            style={inputStyle}
          />

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
            placeholder="Enter 10-digit mobile number"
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
            onChange={(e) => setEmail(e.target.value)}
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
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create password"
            style={inputStyle}
          />

          {/* CONFIRM PASSWORD */}

          <label style={labelStyle}>
            🔐 Confirm Password
          </label>

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(e.target.value)
            }
            placeholder="Confirm password"
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

          {/* CREATE ACCOUNT */}

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
            Create Account
          </button>
        </form>

        {/* BACK TO LOGIN */}

        <button
          onClick={() => {
            window.location.href = "/"
          }}
          style={{
            width: "100%",
            marginTop: "15px",
            backgroundColor: "#e2e8f0",
            color: "#123c69",
            padding: "12px",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "15px",
          }}
        >
          ← Back to Login
        </button>
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
  marginBottom: "17px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "15px",
  outline: "none",
}

export default RegisterAccount