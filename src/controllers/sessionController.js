const db = require("../database/db");
const billingService = require("../services/billingService");

// 1. Memulai Sesi Billing (Operator menekan Start)
exports.startSession = async (req, res) => {
  const { pc_number, duration_minutes } = req.body;

  // Validasi Input Dasar
  if (!pc_number || duration_minutes === undefined) {
    return res.status(400).json({ error: "pc_number dan duration_minutes harus diisi" });
  }

  if (typeof duration_minutes !== 'number' || duration_minutes <= 0 || !Number.isInteger(duration_minutes)) {
    return res.status(400).json({ error: "duration_minutes harus berupa angka bulat positif" });
  }

  try {
    // Cari data PC di database
    const [pcs] = await db.query("SELECT * FROM pcs WHERE pc_number = ?", [pc_number]);
    if (pcs.length === 0) {
      return res.status(404).json({ error: `PC ${pc_number} tidak ditemukan` });
    }

    const pc = pcs[0];

    // Validasi status PC: Hanya bisa start jika statusnya 'online'
    if (pc.status === "offline") {
      return res.status(400).json({ error: `PC ${pc_number} sedang mati (offline), tidak bisa memulai sesi` });
    }
    if (pc.status === "active") {
      return res.status(400).json({ error: `PC ${pc_number} sedang aktif digunakan` });
    }

    // 1. Update status PC menjadi 'active' di database
    await db.query("UPDATE pcs SET status = 'active' WHERE id = ?", [pc.id]);

    // Hitung tarif billing (Tarif default: Rp 5.000 / jam)
    const ratePerHour = 5000;
    const amount = (duration_minutes / 60) * ratePerHour;

    // 2. Simpan sesi billing baru ke tabel sessions beserta tarifnya
    const [result] = await db.query(
      "INSERT INTO sessions (pc_id, duration_minutes, amount, status) VALUES (?, ?, ?, 'active')",
      [pc.id, duration_minutes, amount]
    );
    const sessionId = result.insertId;

    // 3. Daftarkan sesi ke billingService untuk hitung mundur realtime
    billingService.startSession(pc_number, duration_minutes, sessionId, pc.id);

    // 4. Kirim perintah realtime ke Client PC via Socket.IO
    const io = req.app.get("io");
    io.to(pc_number).emit("start-session", { duration_minutes });

    console.log(`[OPERATOR] Memulai sesi untuk ${pc_number} selama ${duration_minutes} menit.`);

    return res.json({
      message: `Sesi ${pc_number} berhasil dimulai`,
      data: { pc_number, duration_minutes }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal memulai sesi: " + err.message });
  }
};

// 2. Menghentikan Sesi Billing (Operator menekan Stop)
exports.stopSession = async (req, res) => {
  const { pc_number } = req.body;

  if (!pc_number) {
    return res.status(400).json({ error: "pc_number harus diisi" });
  }

  try {
    // Cari data PC
    const [pcs] = await db.query("SELECT * FROM pcs WHERE pc_number = ?", [pc_number]);
    if (pcs.length === 0) {
      return res.status(404).json({ error: `PC ${pc_number} tidak ditemukan` });
    }

    const pc = pcs[0];

    // Validasi status PC: Hanya bisa di-stop jika statusnya 'active' atau 'expired'
    if (pc.status !== "active" && pc.status !== "expired") {
      return res.status(400).json({ error: `PC ${pc_number} tidak sedang aktif bermain` });
    }

    // 1. Update status PC kembali menjadi 'online'
    await db.query("UPDATE pcs SET status = 'online' WHERE id = ?", [pc.id]);

    // 2. Hapus sesi dari memory billingService
    billingService.stopSession(pc_number);

    // 3. Update sesi di database menjadi 'stopped'
    await db.query(
      "UPDATE sessions SET status = 'stopped', end_time = CURRENT_TIMESTAMP WHERE pc_id = ? AND status = 'active'",
      [pc.id]
    );

    // 4. Kirim perintah realtime ke Client PC agar mengunci layar kembali
    const io = req.app.get("io");
    io.to(pc_number).emit("stop-session");

    console.log(`[OPERATOR] Menghentikan sesi untuk ${pc_number}.`);

    return res.json({
      message: `Sesi ${pc_number} berhasil dihentikan`
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal menghentikan sesi: " + err.message });
  }
};

// 3. Menambah Waktu Billing (Operator menambah durasi)
exports.addTime = async (req, res) => {
  const { pc_number, added_minutes } = req.body;

  // Validasi Input Dasar
  if (!pc_number || added_minutes === undefined) {
    return res.status(400).json({ error: "pc_number dan added_minutes harus diisi" });
  }

  if (typeof added_minutes !== 'number' || added_minutes <= 0 || !Number.isInteger(added_minutes)) {
    return res.status(400).json({ error: "added_minutes harus berupa angka bulat positif" });
  }

  try {
    // Cari data PC
    const [pcs] = await db.query("SELECT * FROM pcs WHERE pc_number = ?", [pc_number]);
    if (pcs.length === 0) {
      return res.status(404).json({ error: `PC ${pc_number} tidak ditemukan` });
    }

    const pc = pcs[0];

    // Validasi status PC: Hanya bisa tambah waktu jika PC sedang aktif bermain
    if (pc.status !== "active") {
      return res.status(400).json({ error: `PC ${pc_number} tidak sedang aktif bermain` });
    }

    // Hitung penambahan tarif (Tarif default: Rp 5.000 / jam)
    const ratePerHour = 5000;
    const addedAmount = (added_minutes / 60) * ratePerHour;

    // 1. Update durasi sesi dan tarif di database
    await db.query(
      "UPDATE sessions SET duration_minutes = duration_minutes + ?, amount = amount + ? WHERE pc_id = ? AND status = 'active'",
      [added_minutes, addedAmount, pc.id]
    );

    // 2. Update durasi di memory billingService
    billingService.addTime(pc_number, added_minutes);

    // 3. Kirim perintah realtime ke Client PC untuk menambah waktu
    const io = req.app.get("io");
    io.to(pc_number).emit("add-time", { added_minutes });

    console.log(`[OPERATOR] Menambahkan waktu ${added_minutes} menit untuk ${pc_number}.`);

    return res.json({
      message: `Waktu ${pc_number} berhasil ditambah ${added_minutes} menit`
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal menambah waktu: " + err.message });
  }
};
