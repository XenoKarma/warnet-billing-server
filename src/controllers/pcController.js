const db = require("../database/db");
const billingService = require("../services/billingService");

exports.addPc = async (req, res) => {
  try {
    // Cari nomor PC terakhir untuk auto-increment
    const [rows] = await db.query("SELECT pc_number FROM pcs ORDER BY id DESC LIMIT 1")
    let nextNumber = 1
    if (rows.length > 0) {
      const lastNum = parseInt(rows[0].pc_number.replace('PC-', ''))
      nextNumber = lastNum + 1
    }
    const pcNumber = `PC-${String(nextNumber).padStart(2, '0')}`

    await db.query("INSERT INTO pcs (pc_number, status) VALUES (?, 'offline')", [pcNumber])
    console.log(`[SERVER] PC baru ditambahkan: ${pcNumber}`)

    return res.json({
      message: `PC ${pcNumber} berhasil ditambahkan`,
      data: { pc_number: pcNumber, status: 'offline' },
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: "Gagal menambah PC: " + err.message })
  }
}

exports.addBulkPc = async (req, res) => {
  const { count } = req.body
  const jumlah = count || 1

  try {
    const [rows] = await db.query("SELECT pc_number FROM pcs ORDER BY id DESC LIMIT 1")
    let nextNumber = 1
    if (rows.length > 0) {
      const lastNum = parseInt(rows[0].pc_number.replace('PC-', ''))
      nextNumber = lastNum + 1
    }

    const added = []
    for (let i = 0; i < jumlah; i++) {
      const pcNumber = `PC-${String(nextNumber + i).padStart(2, '0')}`
      await db.query("INSERT INTO pcs (pc_number, status) VALUES (?, 'offline')", [pcNumber])
      added.push(pcNumber)
    }

    console.log(`[SERVER] ${jumlah} PC baru ditambahkan: ${added.join(', ')}`)
    return res.json({ message: `${jumlah} PC berhasil ditambahkan`, data: added })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: "Gagal menambah PC: " + err.message })
  }
}

exports.deletePc = async (req, res) => {
  const { pcNumber } = req.params

  try {
    const [rows] = await db.query("SELECT * FROM pcs WHERE pc_number = ?", [pcNumber])
    if (rows.length === 0) {
      return res.status(404).json({ error: `PC ${pcNumber} tidak ditemukan` })
    }

    const pc = rows[0]

    // Cegah hapus jika PC sedang aktif
    if (pc.status === 'active') {
      return res.status(400).json({ error: `PC ${pcNumber} sedang aktif, hentikan sesi terlebih dahulu` })
    }

    // Hapus session terkait dulu karena FK constraint
    await db.query("DELETE FROM sessions WHERE pc_id = ?", [pc.id])
    await db.query("DELETE FROM pcs WHERE id = ?", [pc.id])

    console.log(`[SERVER] PC dihapus: ${pcNumber}`)
    return res.json({ message: `PC ${pcNumber} berhasil dihapus` })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: "Gagal menghapus PC: " + err.message })
  }
}

exports.getAllPcs = async (req, res) => {
  try {
    // 1. Ambil semua PC dari database
    const [pcs] = await db.query("SELECT * FROM pcs ORDER BY pc_number ASC");

    // 2. Gabungkan data PC dengan sisa waktu realtime dari billingService
    const result = pcs.map((pc) => {
      const activeSession = billingService.getActiveSession(pc.pc_number);
      
      return {
        id: pc.id,
        pc_number: pc.pc_number,
        status: pc.status,
        ip_address: pc.ip_address,
        timeLeftSeconds: activeSession ? activeSession.timeLeftSeconds : 0,
        durationSeconds: activeSession ? activeSession.durationSeconds : 0,
      };
    });

    return res.json({
      message: "Berhasil mengambil daftar PC",
      data: result,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal mengambil daftar PC: " + err.message });
  }
};
