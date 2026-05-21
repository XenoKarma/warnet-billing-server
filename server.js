require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./src/app");
const db = require("./src/database/db");
const socketHandler = require("./src/sockets");
const billingService = require("./src/services/billingService");
const authController = require("./src/controllers/authController");

const PORT = process.env.PORT || 3000;

// Membuat HTTP server dari Express app
const server = http.createServer(app);

// Inisialisasi Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Mengizinkan koneksi dari mana saja
  },
});

// Daftarkan io ke instance Express agar bisa diakses di controller
app.set("io", io);

// Jalankan socket handler
socketHandler(io);

// Inisialisasi service billing (menyalakan timer global)
billingService.init(io);

// Test koneksi database saat start
db.query("SELECT 1")
  .then(async () => {
    console.log("Koneksi Database MySQL Berhasil! 🔌");

    // Migrasi database sederhana (Menambahkan kolom amount jika belum ada)
    try {
      await db.query("ALTER TABLE sessions ADD COLUMN amount DECIMAL(10,2) DEFAULT 0.00");
      console.log("Database Migration: Kolom 'amount' ditambahkan ke tabel 'sessions'.");
    } catch (err) {
      // Jika kolom sudah ada, MySQL akan mengembalikan error. Kita abaikan saja.
    }

    // Inisialisasi tabel users + seed admin default
    await authController.init()

    server.listen(PORT, () => {
      console.log(`Server berjalan di port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Gagal koneksi ke database MySQL:", err.message);
    console.log("Pastikan MySQL di XAMPP sudah menyala dan database 'warnet_billing' sudah dibuat.");
  });