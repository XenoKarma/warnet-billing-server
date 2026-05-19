const db = require("../database/db");
const billingService = require("../services/billingService");

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
