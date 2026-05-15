# 🗄️ MySQL Setup Guide

## Prerequisites
- MySQL Server 5.7+ or MySQL 8.0+
- Node.js and npm

## Step 1: Install MySQL

### Windows
1. Download from: https://dev.mysql.com/downloads/mysql/
2. Run installer and follow wizard
3. During setup, create password for `root` user (e.g., `root`)
4. Enable MySQL as Windows Service (recommended)

### Verify Installation
```bash
mysql --version
```

## Step 2: Create Database & Tables

### Option A: Using Command Line
```bash
# Connect to MySQL
mysql -u root -p

# Enter password when prompted
# Paste the SQL commands from database/schema.sql file

# Or run SQL file directly:
mysql -u root -p ctu_room_management < database\schema.sql
```

### Option B: Using MySQL Workbench (GUI)
1. Download: https://dev.mysql.com/downloads/workbench/
2. Open and connect to MySQL (localhost, port 3306)
3. Create new connection if needed
4. Create database: `ctu_room_management`
5. Open [database/schema.sql](database/schema.sql) and execute it

## Step 3: Install Node Packages

```bash
npm install
```

This will install `mysql2` package needed to connect to MySQL.

## Step 4: Configure Connection

Edit [database/config.js](database/config.js) with your MySQL credentials:

```javascript
module.exports = {
    host: 'localhost',      // MySQL server address
    user: 'root',           // MySQL username
    password: 'root',       // MySQL password
    database: 'ctu_room_management',
    port: 3306
};
```

**Or use Environment Variables** (recommended for production):

```bash
# Windows CMD
set DB_HOST=localhost
set DB_USER=root
set DB_PASSWORD=root
set DB_NAME=ctu_room_management
set DB_PORT=3306

# Then start server
npm run dev
```

## Step 5: Start Your System

```bash
npm run dev
```

You should see:
```
✅ MySQL Pool created successfully
✅ Connected to MySQL database
```

## Database Structure

| Table | Purpose |
|-------|---------|
| `users` | Store admin, instructor, and user accounts |
| `rooms` | Store room information |
| `room_history` | Track room usage history |
| `system_logs` | Log all system activities |
| `pending_requests` | Store room booking requests |
| `notifications` | Store user notifications |

## Common Issues

### Error: "Access denied for user 'root'"
- Check MySQL password in [database/config.js](database/config.js)
- Make sure MySQL is running
- Try: `mysql -u root -p` to verify credentials

### Error: "Unknown database 'ctu_room_management'"
- Run SQL schema to create database:
  ```bash
  mysql -u root -p < database\schema.sql
  ```

### MySQL Port Already in Use
- Default port is 3306
- Change in [database/config.js](database/config.js) to use different port
- Or stop other MySQL instance

### "Cannot find module 'mysql2'"
- Run: `npm install`
- Then: `npm run dev`

## Useful MySQL Commands

```bash
# Connect to MySQL
mysql -u root -p

# List all databases
SHOW DATABASES;

# Use CTU database
USE ctu_room_management;

# List all tables
SHOW TABLES;

# View table structure
DESCRIBE users;
DESC rooms;

# Check data
SELECT * FROM users;
SELECT * FROM rooms;

# Exit
EXIT;
```

## Backup Database

```bash
# Backup database
mysqldump -u root -p ctu_room_management > backup.sql

# Restore from backup
mysql -u root -p ctu_room_management < backup.sql
```

## Next Steps

1. Verify MySQL is running
2. Create database with schema.sql
3. Configure [database/config.js](database/config.js)
4. Run `npm install`
5. Run `npm run dev`
6. Check if connection shows "✅ Connected to MySQL database"

Your system now uses MySQL for persistent data storage! 🎉
