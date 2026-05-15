-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Apr 22, 2026 at 12:00 PM
-- Server version: 5.7.0
-- PHP Version: 8.0.0

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- ============================================
-- DATABASE: `ctu_room_management`
-- ============================================

DROP TABLE IF EXISTS `rooms`;
CREATE TABLE `rooms` (
  `id` int(11) NOT NULL,
  `instructor` varchar(255) DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `date` varchar(50) DEFAULT NULL,
  `startTime` varchar(50) DEFAULT NULL,
  `endTime` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `history` longtext,
  `type` varchar(50) DEFAULT NULL,
  `scheduleId` int(11) DEFAULT NULL,
  `schedules` longtext,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Dumping data for table `rooms`
-- ============================================

INSERT INTO `rooms` (`id`, `instructor`, `category`, `date`, `startTime`, `endTime`, `status`, `history`, `type`, `scheduleId`, `schedules`) VALUES
(4, '', 'Office Room', '', '', '', 'Available', '9:01:43 PM - Registered by Anonymous, 11:14:38 PM - jay prieto scheduled (2026-04-19 01:00-02:00, active) - Status: Locked, 12:08:05 PM - Cleared 1 schedules, 12:14:05 PM - Available by Anonymous, 12:17:02 PM - guenmark scheduled (2026-04-20 13:00-14:00, active) - Status: Locked, 12:18:09 PM - Cleared 1 schedules, 12:18:26 PM - Schedule reset by Anonymous', 'register', NULL, '[]'),
(5, '', 'Comlab Room', '', '', '', 'Available', '10:04:53 PM - Registered by Anonymous, 11:17:02 PM - jeff jansen scheduled (2026-04-19 01:00-02:00, active) - Status: Meeting, 12:08:08 PM - Cleared 1 schedules, 12:14:23 PM - Available by Anonymous, 12:17:10 PM - guenmark scheduled (2026-04-20 13:15-14:15, active) - Status: Meeting, 12:18:32 PM - Cleared 1 schedules, 12:20:37 PM - Locked by Anonymous, 12:20:43 PM - Available by Anonymous', 'register', NULL, '[]'),
(6, 'guenmark', 'Comlab Room', '', '', '', 'Available', '11:22:52 PM - Registered by Anonymous, 11:24:06 PM - marco scheduled (2026-04-19 01:00-02:00, active) - Status: Locked, 12:08:14 PM - Cleared 1 schedules, 12:14:08 PM - Available by Anonymous, 12:17:16 PM - guenmark scheduled (2026-04-20 13:16-14:16, active) - Status: Maintenance, 12:20:48 PM - Schedule reset by guenmark (1 schedule(s) cleared)', 'register', NULL, '[]'),
(10, '', 'Comlab Room', '', '', '', 'Available', '11:36:05 PM - Registered by Anonymous, 11:51:35 PM - arthur scheduled (2026-04-19 01:00-02:00, active) - Status: Locked, 12:08:17 PM - Cleared 1 schedules, 12:14:13 PM - Available by Anonymous', 'register', NULL, '[]'),
(20, '', 'Comlab Room', '', '', '', 'Available', '11:36:12 PM - Registered by Anonymous, 12:01:12 AM - arthur scheduled (2026-04-19 01:00-02:00, active) - Status: Locked, 12:08:20 PM - Cleared 1 schedules, 12:14:18 PM - Available by Anonymous', 'register', NULL, '[]'),
(30, '', 'Comlab Room', '', '', '', 'Available', '11:36:25 PM - Registered by Anonymous, 8:50:38 AM - lucia scheduled (2026-04-21 01:00-02:00, active) - Status: Locked, 8:51:56 AM - gecob scheduled (2026-04-21 03:00-04:00, active) - Status: Locked, 8:52:17 AM - lucia finished. Next schedule activated for gecob, 9:02:32 AM - jay prieto scheduled (2026-04-21 04:00-05:00, active) - Status: Locked, 9:05:24 AM - jeff jansen scheduled (2026-04-21 05:00-06:00, active) - Status: Locked, 12:08:24 PM - Cleared 3 schedules, 12:14:16 PM - Available by Anonymous', 'register', NULL, '[]'),
(40, '', 'Comlab Room', '', '', '', 'Available', '11:36:30 PM - Registered by Anonymous', 'register', NULL, NULL),
(50, '', 'Comlab Room', '', '', '', 'Available', '11:36:37 PM - Registered by Anonymous', 'register', NULL, NULL),
(60, '', 'Comlab Room', '', '', '', 'Available', '11:36:43 PM - Registered by Anonymous', 'register', NULL, NULL);

-- ============================================
-- Table structure for table `system_logs`
-- ============================================

DROP TABLE IF EXISTS `system_logs`;
CREATE TABLE `system_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `timestamp` datetime DEFAULT NULL,
  `roomId` int(11) DEFAULT NULL,
  `action` varchar(50) DEFAULT NULL,
  `user` varchar(255) DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `details` longtext,
  `status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Dumping data for table `system_logs`
-- ============================================

INSERT INTO `system_logs` (`timestamp`, `roomId`, `action`, `user`, `category`, `details`, `status`) VALUES
('2026-04-21 13:09:22', 40, 'reject', 'guenmark', 'Comlab Room', 'Rejected: Sorry naay mo gamit', 'Rejected'),
('2026-04-20 04:20:48', 6, 'reset', 'guenmark', 'Comlab Room', 'Schedule reset (1 schedule cleared) - Room set to Available', 'Available'),
('2026-04-20 04:20:43', 5, 'status', 'Anonymous', 'Comlab Room', 'Status: Locked → Available', 'Available'),
('2026-04-20 04:20:37', 5, 'status', 'Anonymous', 'Comlab Room', 'Status: Meeting → Locked', 'Locked'),
('2026-04-20 04:18:32', 5, 'clear', 'Admin', 'Comlab Room', 'Cleared 1 instructor schedules', 'Meeting'),
('2026-04-20 04:18:26', 4, 'reset', 'Anonymous', 'Office Room', 'Schedule reset - Room set to Available', 'Available'),
('2026-04-20 04:18:09', 4, 'clear', 'Admin', 'Office Room', 'Cleared 1 instructor schedules', 'Locked'),
('2026-04-20 04:17:16', 6, 'approve', 'guenmark', 'Comlab Room', 'Approved: 2026-04-20 13:16-14:16 (active)', 'Meeting'),
('2026-04-20 04:17:10', 5, 'approve', 'guenmark', 'Comlab Room', 'Approved: 2026-04-20 13:15-14:15 (active)', 'Meeting'),
('2026-04-20 04:17:02', 4, 'approve', 'guenmark', 'Office Room', 'Approved: 2026-04-20 13:00-14:00 (active)', 'Meeting'),
('2026-04-20 04:16:08', 6, 'request', 'guenmark', 'Comlab Room', 'Request: maintenance status for 2026-04-20 13:16-14:16', 'Pending'),
('2026-04-20 04:00:17', 0, 'admin-create', 'admin1', 'Admin', 'New admin account created: admin (admin1)', 'Admin'),
('2026-04-20 03:06:24', 2, 'remove', 'aizy', 'Machine Room', 'Room unregistered', 'Maintenance');

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
