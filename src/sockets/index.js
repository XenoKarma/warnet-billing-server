const db = require("../database/db");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`Ada perangkat baru terhubung: ${socket.id}`);

    // Variabel lokal untuk menyimpan PC mana yang sedang terhubung melalui socket ini
    let connectedPcNumber = null;

    // 1. Event saat Client PC mendaftarkan dirinya (misal PC-01 terhubung)
    socket.on("register-pc", async (data) => {
      const { pc_number } = data;
      connectedPcNumber = pc_number;
      socket.join(pc_number); // PC masuk ke room-nya sendiri (misal room: 'PC-01')
      console.log(`${pc_number} terdaftar dengan Socket ID: ${socket.id} dan bergabung ke room: ${pc_number}`);

      try {
        // Cari PC di database
        const [rows] = await db.query("SELECT status FROM pcs WHERE pc_number = ?", [pc_number]);
        if (rows.length > 0) {
          const currentStatus = rows[0].status;
          // Jika PC sudah 'active' (sedang digunakan), biarkan tetap active
          // Jika statusnya 'offline', kita ubah ke 'online'
          const nextStatus = currentStatus === "active" ? "active" : "online";
          
          await db.query("UPDATE pcs SET status = ?, ip_address = ? WHERE pc_number = ?", [
            nextStatus,
            socket.handshake.address,
            pc_number
          ]);

          // Broadcast status baru PC ke dashboard operator
          io.emit("pc-status-changed", { pc_number, status: nextStatus });

          console.log(`Status database untuk ${pc_number} diupdate ke: ${nextStatus}`);
        } else {
          console.log(`PC dengan nomor ${pc_number} tidak ditemukan di database.`);
        }
      } catch (err) {
        console.error("Gagal mengupdate status PC di database:", err.message);
      }
    });

    // 2. Event saat perangkat terputus (disconnect)
    socket.on("disconnect", async () => {
      console.log(`Perangkat terputus: ${socket.id}`);
      if (connectedPcNumber) {
        try {
          const [rows] = await db.query("SELECT status FROM pcs WHERE pc_number = ?", [connectedPcNumber]);
          if (rows.length > 0) {
            const currentStatus = rows[0].status;
            // Jika sebelumnya statusnya 'online' (tidak sedang aktif bermain), kembalikan ke 'offline'
            if (currentStatus === "online") {
              await db.query("UPDATE pcs SET status = 'offline' WHERE pc_number = ?", [connectedPcNumber]);
              
              // Broadcast status offline ke dashboard operator
              io.emit("pc-status-changed", { pc_number: connectedPcNumber, status: "offline" });

              console.log(`Status database untuk ${connectedPcNumber} diupdate ke: offline`);
            }
          }
        } catch (err) {
          console.error("Gagal mengupdate status PC saat disconnect:", err.message);
        }
      }
    });
  });
};
