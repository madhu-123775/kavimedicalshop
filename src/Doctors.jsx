import { useEffect, useState } from "react"

function Doctors() {
  const defaultDoctors = [
    "Dr. C.MAHILAN, MBBS.,",
    "Dr.M.OVIYAA, MBBS.,",
    "Dr.S.ARUL SAKTHI, MBBS.,M.S.,",
  ]

  const [doctors, setDoctors] = useState([])
  const [newDoctor, setNewDoctor] = useState("")

  useEffect(() => {
    const saved = localStorage.getItem("kaviDoctors")

    if (saved) {
      setDoctors(JSON.parse(saved))
    } else {
      setDoctors(defaultDoctors)
      localStorage.setItem(
        "kaviDoctors",
        JSON.stringify(defaultDoctors)
      )
    }
  }, [])

  const addDoctor = () => {
    const name = newDoctor.trim()

    if (!name) return

    const updated = [...doctors, name]

    setDoctors(updated)
    localStorage.setItem("kaviDoctors", JSON.stringify(updated))
    setNewDoctor("")
  }

  const deleteDoctor = (index) => {
    const updated = doctors.filter((_, i) => i !== index)

    setDoctors(updated)
    localStorage.setItem("kaviDoctors", JSON.stringify(updated))
  }

  const goBack = () => {
    window.history.pushState({}, "", "/")
    window.location.reload()
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#eef7f4",
        padding: "30px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          background: "white",
          padding: "30px",
          borderRadius: "20px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            color: "#db2777",
            marginBottom: "25px",
          }}
        >
          👨‍⚕️ Doctors
        </h1>

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "25px",
          }}
        >
          <input
            type="text"
            value={newDoctor}
            onChange={(e) => setNewDoctor(e.target.value)}
            placeholder="Enter doctor name"
            style={{
              flex: 1,
              padding: "13px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              fontSize: "16px",
            }}
          />

          <button
            onClick={addDoctor}
            style={{
              padding: "13px 20px",
              border: "none",
              borderRadius: "8px",
              background: "#db2777",
              color: "white",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Add Doctor
          </button>
        </div>

        {doctors.map((doctor, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "15px",
              marginBottom: "10px",
              background: "#fdf2f8",
              borderRadius: "10px",
            }}
          >
            <span
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "#333",
              }}
            >
              {doctor}
            </span>

            <button
              onClick={() => deleteDoctor(index)}
              style={{
                border: "none",
                borderRadius: "7px",
                background: "#dc2626",
                color: "white",
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        ))}

        <button
          onClick={goBack}
          style={{
            marginTop: "25px",
            padding: "12px 25px",
            border: "none",
            borderRadius: "8px",
            background: "#2563eb",
            color: "white",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
      </div>
    </div>
  )
}

export default Doctors