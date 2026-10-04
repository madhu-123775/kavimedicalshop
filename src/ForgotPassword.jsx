import { useState } from "react"

function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [mobile, setMobile] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleReset = (e) => {
    e.preventDefault()

    setMessage("")
    setError("")

    if (!email || !mobile) {
      setError("Please enter your email ID and mobile number.")
      return
    }

    const account = JSON.parse(
      localStorage.getItem("kaviAccount") || "null"
    )

    if (!account) {
      setError("No account found. Please create an account first.")
      return
    }

    if (
      account.email !== email ||
      account.mobile !== mobile
    ) {
      setError("Email ID or mobile number does not match.")
      return
    }

    setMessage(
      "Account verified. Password reset can be connected later with secure authentication."
    )
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
            🔐
          </div>

          <h1
            style={{
              margin: 0,
              color: "#087f5b",
              fontSize: "28px",
            }}
          >
            Forgot Password
          </h1>

          <p
            style={{
              color: "#64748b",
              marginTop: "8px",
            }}
          >
            Verify your account
          </p>
        </div>

        <form onSubmit={handleReset}>

          <label style={labelStyle}>
            📧 Email ID
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter registered email"
            style={inputStyle}
          />

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
            placeholder="Enter registered mobile"
            maxLength="10"
            style={inputStyle}
          />

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

          {message && (
            <div
              style={{
                backgroundColor: "#dcfce7",
                color: "#166534",
                padding: "10px",
                borderRadius: "7px",
                marginBottom: "15px",
                fontSize: "14px",
              }}
            >
              {message}
            </div>
          )}

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
            Verify Account
          </button>
        </form>

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
  marginBottom: "18px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "15px",
  outline: "none",
}

export default ForgotPassword