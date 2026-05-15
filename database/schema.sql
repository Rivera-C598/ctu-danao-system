-- CTU Room Management System - MySQL Schema
-- Create database
CREATE DATABASE IF NOT EXISTS ctu_room_management1;
USE ctu_room_management1;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    fullName VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role ENUM('admin', 'instructor', 'user') DEFAULT 'user',
    isNewAccount BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastLogin DATETIME,
    loginCount INT DEFAULT 0,
    isActive BOOLEAN DEFAULT TRUE,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id INT PRIMARY KEY,
    instructor VARCHAR(100),
    category VARCHAR(100) NOT NULL,
    date DATE,
    startTime TIME,
    endTime TIME,
    status ENUM('Available', 'Occupied', 'Maintenance') DEFAULT 'Available',
    type VARCHAR(50) DEFAULT 'register',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Room History/Reservations table
CREATE TABLE IF NOT EXISTS room_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    roomId INT NOT NULL,
    instructor VARCHAR(100),
    date DATE,
    startTime TIME,
    endTime TIME,
    action VARCHAR(50),
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
    INDEX idx_roomId (roomId),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- System Logs table
CREATE TABLE IF NOT EXISTS system_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT,
    action VARCHAR(200),
    details JSON,
    ipAddress VARCHAR(45),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_userId (userId),
    INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pending Requests table
CREATE TABLE IF NOT EXISTS pending_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    roomId INT NOT NULL,
    requestDate DATE,
    startTime TIME,
    endTime TIME,
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    requestReason TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_userId (userId),
    INDEX idx_roomId (roomId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    title VARCHAR(200),
    message TEXT,
    type VARCHAR(50),
    isRead BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_userId (userId),
    INDEX idx_isRead (isRead)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default admin user
INSERT IGNORE INTO users (username, password, fullName, email, role, createdAt)
VALUES ('admin', 'ctudanao@admin', 'System Administrator', 'admin@ctu.edu.ph', 'admin', NOW());

-- Insert sample rooms
INSERT IGNORE INTO rooms (id, category, status, type)
VALUES 
(101, 'Comlab Room', 'Available', 'register'),
(102, 'Comlab Room', 'Available', 'register'),
(201, 'Machine Room', 'Available', 'register'),
(202, 'Machine Room', 'Available', 'register'),
(301, 'Library Room', 'Available', 'register'),
(401, 'Office Room', 'Available', 'register');
