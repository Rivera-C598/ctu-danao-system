require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const DATA_FILE = path.join(__dirname, '..', 'data.json');
const SCHEMA_FILE = path.join(__dirname, '..', 'database', 'schema-postgres.sql');
const STATUS_MAP = {
    locked: 'Locked',
    meeting: 'Meeting',
    maintenance: 'Maintenance',
    available: 'Available',
    Available: 'Available',
    Locked: 'Locked',
    Meeting: 'Meeting',
    Maintenance: 'Maintenance'
};

function requireDatabaseUrl() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required. Use your Supabase PostgreSQL connection string.');
    }
}

function normalizeWorkflowStatus(status) {
    if (status === 'approved') return 'completed';
    if (status === 'pending') return 'standby';
    if (status === 'rejected') return 'rejected';
    if (['active', 'standby', 'completed', 'cancelled'].includes(status)) return status;
    return 'completed';
}

function toTimestamp(value) {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function main() {
    requireDatabaseUrl();

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');

    await pool.query(schema);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userIds = new Map();
        for (const user of data.usersDatabase || []) {
            const username = String(user.username || '').trim().toLowerCase();
            if (!username) continue;

            const passwordHash = await bcrypt.hash(String(user.password || 'changeme'), 12);
            const result = await client.query(`
                INSERT INTO users (username, password_hash, full_name, email, phone_number, role, login_count, last_login_at, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (username) DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    full_name = EXCLUDED.full_name,
                    email = EXCLUDED.email,
                    phone_number = EXCLUDED.phone_number,
                    role = EXCLUDED.role,
                    login_count = EXCLUDED.login_count,
                    last_login_at = EXCLUDED.last_login_at
                RETURNING id
            `, [
                username,
                passwordHash,
                user.fullName || username,
                user.email || null,
                user.phoneNumber || null,
                user.role === 'admin' ? 'admin' : 'instructor',
                Number(user.loginCount || 0),
                user.lastLogin ? toTimestamp(user.lastLogin) : null,
                toTimestamp(user.createdAt)
            ]);
            userIds.set(username, result.rows[0].id);
        }

        const adminId = userIds.get('admin') || null;
        const roomIds = new Map();
        for (const room of data.allRooms || []) {
            if (room.type === 'schedule') continue;
            const roomNumber = Number(room.id);
            if (!roomNumber) continue;

            const result = await client.query(`
                INSERT INTO rooms (room_number, category, status, is_requestable)
                VALUES ($1, $2, $3, true)
                ON CONFLICT (room_number) DO UPDATE SET
                    category = EXCLUDED.category,
                    status = EXCLUDED.status,
                    is_requestable = true
                RETURNING id
            `, [
                roomNumber,
                room.category || 'Comlab Room',
                STATUS_MAP[room.status] || 'Available'
            ]);
            roomIds.set(roomNumber, result.rows[0].id);

            for (const historyEntry of room.history || []) {
                await client.query(`
                    INSERT INTO system_logs (actor_id, action, room_id, details, created_at)
                    VALUES ($1, 'room_history_import', $2, $3::jsonb, now())
                `, [adminId, result.rows[0].id, JSON.stringify({ message: historyEntry, roomNumber })]);
            }
        }

        for (const request of data.pendingRequests || []) {
            const username = String(request.instructor || '').trim().toLowerCase();
            const instructorId = userIds.get(username);
            const roomId = roomIds.get(Number(request.roomId));
            if (!instructorId || !roomId) continue;

            const status = normalizeWorkflowStatus(request.status);
            const inserted = await client.query(`
                INSERT INTO room_requests (
                    legacy_id, room_id, instructor_id, date, start_time, end_time,
                    purpose, requested_status, status, queue_position, requested_at,
                    decided_at, decided_by, rejection_reason
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11, $12, $13)
                ON CONFLICT (legacy_id) DO UPDATE SET status = EXCLUDED.status
                RETURNING id
            `, [
                String(request.id),
                roomId,
                instructorId,
                request.date,
                request.startTime,
                request.endTime,
                request.purpose || null,
                request.requestedStatus || 'locked',
                status,
                toTimestamp(request.requestedAt),
                request.approvedAt || request.rejectedAt ? toTimestamp(request.approvedAt || request.rejectedAt) : null,
                adminId,
                request.rejectionReason || null
            ]);

            if (['active', 'standby', 'completed'].includes(status)) {
                await client.query(`
                    INSERT INTO room_schedules (
                        request_id, room_id, instructor_id, date, start_time, end_time,
                        requested_status, status, queue_position, completed_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9)
                    ON CONFLICT (request_id) DO NOTHING
                `, [
                    inserted.rows[0].id,
                    roomId,
                    instructorId,
                    request.date,
                    request.startTime,
                    request.endTime,
                    request.requestedStatus || 'locked',
                    status,
                    status === 'completed' ? toTimestamp(request.approvedAt || request.requestedAt) : null
                ]);
            }
        }

        for (const log of data.systemLogs || []) {
            const roomId = roomIds.get(Number(log.roomId)) || null;
            await client.query(`
                INSERT INTO system_logs (actor_id, action, room_id, details, created_at)
                VALUES ($1, $2, $3, $4::jsonb, $5)
            `, [
                userIds.get(String(log.user || '').toLowerCase()) || adminId,
                log.action || 'imported_log',
                roomId,
                JSON.stringify(log),
                toTimestamp(log.timestamp)
            ]);
        }

        await client.query('COMMIT');
        console.log('Migration complete.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
