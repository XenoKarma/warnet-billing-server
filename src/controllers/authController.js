const crypto = require("crypto");
const db = require("../database/db");

// Inisialisasi tabel users + seed admin default
exports.init = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        token VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Seed default admin jika belum ada
    const [rows] = await db.query("SELECT id FROM users WHERE username = 'admin'")
    if (rows.length === 0) {
      await db.query("INSERT INTO users (username, password) VALUES ('admin', 'admin123')")
      console.log("[AUTH] User default 'admin' berhasil dibuat")
    }

    console.log("[AUTH] Tabel users siap")
  } catch (err) {
    console.error("[AUTH] Gagal inisialisasi:", err.message)
  }
}

// Login: validasi username/password → generate token
exports.login = async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password harus diisi" })
  }

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username])
    if (rows.length === 0) {
      return res.status(401).json({ error: "Username atau password salah" })
    }

    const user = rows[0]

    if (password !== user.password) {
      return res.status(401).json({ error: "Username atau password salah" })
    }

    // Generate token
    const token = crypto.randomBytes(32).toString("hex")
    await db.query("UPDATE users SET token = ? WHERE id = ?", [token, user.id])

    console.log(`[AUTH] Login berhasil: ${username}`)
    return res.json({ token, username: user.username })
  } catch (err) {
    console.error("[AUTH] Login error:", err.message)
    return res.status(500).json({ error: "Gagal login: " + err.message })
  }
}

// Verify: cek token valid → return username
exports.verify = async (req, res) => {
  const token = req.headers.authorization

  if (!token) {
    return res.status(401).json({ valid: false, error: "Token tidak ditemukan" })
  }

  try {
    const [rows] = await db.query("SELECT username FROM users WHERE token = ?", [token])
    if (rows.length === 0) {
      return res.json({ valid: false })
    }
    return res.json({ valid: true, username: rows[0].username })
  } catch (err) {
    console.error("[AUTH] Verify error:", err.message)
    return res.status(500).json({ valid: false, error: err.message })
  }
}

// Update: ubah username/password (butuh old password)
exports.updateAccount = async (req, res) => {
  const token = req.headers.authorization
  const { oldPassword, newUsername, newPassword } = req.body

  if (!oldPassword) {
    return res.status(400).json({ error: "Password saat ini wajib diisi" })
  }

  try {
    // Cari user via token
    const [users] = await db.query("SELECT * FROM users WHERE token = ?", [token])
    if (users.length === 0) {
      return res.status(401).json({ error: "Sesi tidak valid, silakan login ulang" })
    }

    const user = users[0]

    // Validasi old password
    if (oldPassword !== user.password) {
      return res.status(400).json({ error: "Password saat ini salah" })
    }

    // Update username jika diisi
    if (newUsername && newUsername.trim()) {
      // Cek apakah username sudah dipakai
      const [existing] = await db.query("SELECT id FROM users WHERE username = ? AND id != ?", [newUsername.trim(), user.id])
      if (existing.length > 0) {
        return res.status(400).json({ error: "Username sudah digunakan" })
      }
      await db.query("UPDATE users SET username = ? WHERE id = ?", [newUsername.trim(), user.id])
    }

    // Update password jika diisi
    if (newPassword) {
      if (newPassword.length < 4) {
        return res.status(400).json({ error: "Password baru minimal 4 karakter" })
      }
      await db.query("UPDATE users SET password = ? WHERE id = ?", [newPassword, user.id])
    }

    // Generate token baru
    const newToken = crypto.randomBytes(32).toString("hex")
    await db.query("UPDATE users SET token = ? WHERE id = ?", [newToken, user.id])

    const [updated] = await db.query("SELECT username FROM users WHERE id = ?", [user.id])

    console.log(`[AUTH] Akun diupdate: ${updated[0].username}`)
    return res.json({
      message: "Akun berhasil diperbarui",
      token: newToken,
      username: updated[0].username,
    })
  } catch (err) {
    console.error("[AUTH] Update error:", err.message)
    return res.status(500).json({ error: "Gagal update akun: " + err.message })
  }
}
