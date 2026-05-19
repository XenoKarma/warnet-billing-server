-- 1. Membuat Database
CREATE DATABASE IF NOT EXISTS warnet_billing;
USE warnet_billing;

-- 2. Membuat Tabel PC (untuk mendata PC client)
CREATE TABLE IF NOT EXISTS pcs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pc_number VARCHAR(10) NOT NULL UNIQUE,          -- Contoh: 'PC-01', 'PC-02'
    status ENUM('offline', 'online', 'active', 'expired') DEFAULT 'offline',
    ip_address VARCHAR(45) NULL,                     -- Untuk mencatat IP Client
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Membuat Tabel Sessions (untuk mencatat riwayat pemakaian billing)
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pc_id INT NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    duration_minutes INT NOT NULL,                   -- Durasi yang dibeli dalam menit
    amount DECIMAL(10,2) DEFAULT 0.00,               -- Tarif billing yang dibayar
    status ENUM('active', 'completed', 'stopped') DEFAULT 'active',
    FOREIGN KEY (pc_id) REFERENCES pcs(id) ON DELETE CASCADE
);

-- 4. Mengisi Data Awal PC (Dummy Data untuk simulasi)
INSERT INTO pcs (pc_number, status) VALUES 
('PC-01', 'offline'),
('PC-02', 'offline'),
('PC-03', 'offline'),
('PC-04', 'offline'),
('PC-05', 'offline')
ON DUPLICATE KEY UPDATE pc_number=pc_number;
