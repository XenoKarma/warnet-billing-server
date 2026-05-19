const { io } = require("socket.io-client");

console.log("Menghubungkan ke server billing...");
const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("Terhubung ke server! Socket ID:", socket.id);
  
  // Daftarkan PC ini sebagai PC-01
  const pcNumber = "PC-01";
  socket.emit("register-pc", { pc_number: pcNumber });
  console.log(`Mengirim permintaan registrasi untuk: ${pcNumber}`);
});

socket.on("disconnect", () => {
  console.log("Terputus dari server.");
});

// Mendengarkan perintah dari Server (Operator)
socket.on("start-session", (data) => {
  console.log(`\n=================================`);
  console.log(`[CLIENT] Sesi billing DIMULAI!`);
  console.log(`Durasi: ${data.duration_minutes} Menit.`);
  console.log(`Status PC: ACTIVE (Layar Terbuka)`);
  console.log(`=================================\n`);
});

socket.on("stop-session", () => {
  console.log(`\n=================================`);
  console.log(`[CLIENT] Sesi billing DIHENTIKAN!`);
  console.log(`Status PC: OFFLINE/EXPIRED (Layar Terkunci)`);
  console.log(`=================================\n`);
});

socket.on("add-time", (data) => {
  console.log(`\n=================================`);
  console.log(`[CLIENT] Waktu bertambah ${data.added_minutes} menit!`);
  console.log(`=================================\n`);
});

socket.on("timer-update", (data) => {
  const { timeLeftSeconds } = data;
  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  // \r akan mengembalikan kursor ke awal baris agar tidak spam baris baru
  process.stdout.write(`\r[CLIENT] Sisa waktu bermain: ${minutes} menit ${seconds} detik...   `);
});
