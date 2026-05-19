const db = require("../database/db");

// Map untuk menyimpan sesi aktif di memori agar bisa dihitung mundur setiap detik
// Struktur data: { 'PC-01': { sessionId, pcId, timeLeftSeconds, durationSeconds } }
const activeSessions = new Map();
let ioInstance = null;

// Mengatur instance socket.io agar service bisa melakukan broadcast
exports.init = (io) => {
  ioInstance = io;

  // Load sesi aktif dari database saat startup (agar billing tetap berjalan jika server restart)
  db.query(
    `SELECT s.id as sessionId, s.pc_id as pcId, s.duration_minutes, s.start_time, p.pc_number 
     FROM sessions s 
     JOIN pcs p ON s.pc_id = p.id 
     WHERE s.status = 'active'`
  ).then(([sessions]) => {
    sessions.forEach((s) => {
      // Hitung sisa waktu berdasarkan selisih waktu sekarang dengan start_time
      const elapsedSeconds = Math.floor((Date.now() - new Date(s.start_time).getTime()) / 1000);
      const totalSeconds = s.duration_minutes * 60;
      const timeLeftSeconds = totalSeconds - elapsedSeconds;

      if (timeLeftSeconds > 0) {
        activeSessions.set(s.pc_number, {
          sessionId: s.sessionId,
          pcId: s.pcId,
          durationSeconds: totalSeconds,
          timeLeftSeconds: timeLeftSeconds,
        });
        console.log(`[BILLING] Memulihkan sesi aktif untuk ${s.pc_number}. Sisa waktu: ${Math.round(timeLeftSeconds / 60)} menit.`);
      } else {
        // Jika ternyata sudah expired saat server mati, selesaikan sesinya langsung
        db.query("UPDATE pcs SET status = 'expired' WHERE id = ?", [s.pcId]);
        db.query("UPDATE sessions SET status = 'completed', end_time = CURRENT_TIMESTAMP WHERE id = ?", [s.sessionId]);
        console.log(`[BILLING] Sesi ${s.pc_number} telah berakhir saat server offline. Diupdate ke EXPIRED.`);
      }
    });
  }).catch((err) => {
    console.error("Gagal memulihkan sesi aktif dari database:", err.message);
  });

  // Jalankan hitung mundur setiap 1 detik
  setInterval(async () => {
    for (const [pc_number, session] of activeSessions.entries()) {
      session.timeLeftSeconds -= 1;

      // 1. Broadcast sisa waktu ke client secara realtime
      if (ioInstance) {
        ioInstance.to(pc_number).emit("timer-update", {
          timeLeftSeconds: session.timeLeftSeconds,
          durationSeconds: session.durationSeconds,
        });
        // Kirim juga secara global agar Dashboard Operator bisa menampilkan countdown realtime
        ioInstance.emit("pc-timer-update", {
          pc_number,
          timeLeftSeconds: session.timeLeftSeconds,
          durationSeconds: session.durationSeconds,
        });
      }

      // 2. Jika waktu habis (expired)
      if (session.timeLeftSeconds <= 0) {
        console.log(`[BILLING] Sisa waktu ${pc_number} habis! Mengunci PC...`);
        
        // Hapus dari memori
        activeSessions.delete(pc_number);

        try {
          // Update status PC di database menjadi 'expired'
          await db.query("UPDATE pcs SET status = 'expired' WHERE id = ?", [session.pcId]);

          // Update status sesi di database menjadi 'completed'
          await db.query(
            "UPDATE sessions SET status = 'completed', end_time = CURRENT_TIMESTAMP WHERE id = ?",
            [session.sessionId]
          );

          // Kirim perintah stop (kunci layar) ke client & broadcast status expired ke dashboard
          if (ioInstance) {
            ioInstance.to(pc_number).emit("stop-session");
            ioInstance.emit("pc-status-changed", { pc_number, status: "expired" });
          }
        } catch (err) {
          console.error(`Gagal memproses sesi expired untuk ${pc_number}:`, err.message);
        }
      }
    }
  }, 1000);
};

// Menambahkan sesi baru ke memori (dipanggil oleh controller saat start session)
exports.startSession = (pc_number, durationMinutes, sessionId, pcId) => {
  activeSessions.set(pc_number, {
    sessionId,
    pcId,
    durationSeconds: durationMinutes * 60,
    timeLeftSeconds: durationMinutes * 60,
  });

  // Broadcast status active ke dashboard operator
  if (ioInstance) {
    ioInstance.emit("pc-status-changed", { pc_number, status: "active" });
  }
};

// Menghentikan sesi dari memori (dipanggil oleh controller saat stop session)
exports.stopSession = (pc_number) => {
  activeSessions.delete(pc_number);

  // Broadcast status online ke dashboard operator (kembali tersedia)
  if (ioInstance) {
    ioInstance.emit("pc-status-changed", { pc_number, status: "online" });
  }
};

// Menambah waktu sesi di memori (dipanggil oleh controller saat add time)
exports.addTime = (pc_number, addedMinutes) => {
  const session = activeSessions.get(pc_number);
  if (session) {
    session.durationSeconds += addedMinutes * 60;
    session.timeLeftSeconds += addedMinutes * 60;

    // Broadcast update timer langsung setelah waktu ditambah ke client dan dashboard
    if (ioInstance) {
      ioInstance.emit("pc-timer-update", {
        pc_number,
        timeLeftSeconds: session.timeLeftSeconds,
        durationSeconds: session.durationSeconds,
      });
    }
  }
};

// Mengembalikan sesi aktif dari memori (untuk pengecekan status)
exports.getActiveSession = (pc_number) => {
  return activeSessions.get(pc_number);
};
