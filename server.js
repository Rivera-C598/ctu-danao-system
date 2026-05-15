require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Pool } = require('pg');

const PORT = process.env.PORT || 5501;
const JWT_COOKIE = 'ctu_auth';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret';
const DATABASE_URL = process.env.DATABASE_URL;
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

const app = express();
const pool = DATABASE_URL ? new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
}) : null;

app.use(cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        res.setHeader('Cache-Control', 'no-cache');
    }
}));

function requireDb() {
    if (!pool) {
        const error = new Error('DATABASE_URL is not configured.');
        error.status = 503;
        throw error;
    }
    return pool;
}

function manilaToday() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

function dbDate(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
}

function publicUser(row) {
    if (!row) return null;
    return {
        id: row.id,
        username: row.username,
        fullName: row.full_name,
        email: row.email,
        phoneNumber: row.phone_number,
        role: row.role,
        loginCount: row.login_count,
        lastLogin: row.last_login_at,
        createdAt: row.created_at
    };
}

function signUser(row) {
    return jwt.sign({
        id: row.id,
        username: row.username,
        role: row.role,
        fullName: row.full_name
    }, JWT_SECRET, { expiresIn: '12h' });
}

function setAuthCookie(res, token) {
    res.cookie(JWT_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 12 * 60 * 60 * 1000
    });
}

function authOptional(req, _res, next) {
    const token = req.cookies[JWT_COOKIE];
    if (!token) return next();
    try {
        req.user = jwt.verify(token, JWT_SECRET);
    } catch (_error) {
        req.user = null;
    }
    next();
}

function requireAuth(req, res, next) {
    const token = req.cookies[JWT_COOKIE];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (_error) {
        res.status(401).json({ error: 'Invalid or expired session' });
    }
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}

async function getCurrentUser(userId) {
    const { rows } = await requireDb().query('SELECT * FROM users WHERE id = $1', [userId]);
    return rows[0];
}

async function addLog(clientOrPool, actorId, action, roomId, details) {
    await clientOrPool.query(`
        INSERT INTO system_logs (actor_id, action, room_id, details)
        VALUES ($1, $2, $3, $4::jsonb)
    `, [actorId || null, action, roomId || null, JSON.stringify(details || {})]);
}

function mapRoomRows(roomRows, scheduleRows) {
    const schedulesByRoom = new Map();
    for (const row of scheduleRows) {
        const item = {
            id: row.id,
            requestId: row.request_id,
            date: dbDate(row.date),
            instructor: row.username,
            instructorName: row.full_name,
            startTime: row.start_time?.slice(0, 5),
            endTime: row.end_time?.slice(0, 5),
            purpose: row.purpose,
            requestedStatus: row.requested_status,
            requestedRoomStatus: STATUS_MAP[row.requested_status] || 'Available',
            queueStatus: row.status,
            queuePosition: row.queue_position
        };
        if (!schedulesByRoom.has(row.room_id)) schedulesByRoom.set(row.room_id, []);
        schedulesByRoom.get(row.room_id).push(item);
    }

    return roomRows.map((room) => {
        const schedules = schedulesByRoom.get(room.id) || [];
        const active = schedules.find((s) => s.queueStatus === 'active') || schedules[0];
        return {
            dbId: room.id,
            id: room.room_number,
            instructor: active?.instructor || '',
            category: room.category,
            date: active?.date || '',
            startTime: active?.startTime || '',
            endTime: active?.endTime || '',
            status: room.status,
            isRequestable: room.is_requestable,
            history: [],
            type: 'register',
            schedules,
            scheduleId: active?.id || null
        };
    });
}

async function buildSnapshot(user) {
    const db = requireDb();
    const [roomResult, scheduleResult, requestResult, userResult, logResult, codeResult, notifResult] = await Promise.all([
        db.query('SELECT * FROM rooms ORDER BY room_number'),
        db.query(`
            SELECT s.*, r.purpose, u.username, u.full_name
            FROM room_schedules s
            JOIN users u ON u.id = s.instructor_id
            LEFT JOIN room_requests r ON r.id = s.request_id
            WHERE s.status IN ('active', 'standby')
            ORDER BY s.date, s.start_time, COALESCE(s.queue_position, 0)
        `),
        db.query(`
            SELECT rr.*, rm.room_number, rm.category AS room_category, u.username, u.full_name
            FROM room_requests rr
            JOIN rooms rm ON rm.id = rr.room_id
            JOIN users u ON u.id = rr.instructor_id
            ORDER BY rr.requested_at DESC
            LIMIT 500
        `),
        user?.role === 'admin'
            ? db.query('SELECT * FROM users ORDER BY created_at DESC')
            : db.query('SELECT id, username, full_name, email, phone_number, role, login_count, last_login_at, created_at FROM users WHERE id = $1', [user?.id]),
        db.query(`
            SELECT l.*, u.username, rm.room_number
            FROM system_logs l
            LEFT JOIN users u ON u.id = l.actor_id
            LEFT JOIN rooms rm ON rm.id = l.room_id
            ORDER BY l.created_at DESC
            LIMIT 500
        `),
        user?.role === 'admin'
            ? db.query('SELECT c.*, creator.username AS created_by_username, used.username AS used_by_username FROM registration_codes c LEFT JOIN users creator ON creator.id = c.created_by LEFT JOIN users used ON used.id = c.used_by ORDER BY c.created_at DESC LIMIT 100')
            : Promise.resolve({ rows: [] }),
        db.query(`
            SELECT * FROM notifications
            WHERE (user_id = $1 OR role_target = $2 OR (user_id IS NULL AND role_target IS NULL))
            ORDER BY created_at DESC
            LIMIT 100
        `, [user?.id || null, user?.role || null])
    ]);

    const allRooms = mapRoomRows(roomResult.rows, scheduleResult.rows);
    const pendingRequests = requestResult.rows.map((row) => ({
        id: row.id,
        roomId: row.room_number,
        roomCategory: row.room_category,
        instructor: row.username,
        instructorName: row.full_name,
            date: dbDate(row.date),
        startTime: row.start_time?.slice(0, 5),
        endTime: row.end_time?.slice(0, 5),
        purpose: row.purpose,
        requestedStatus: row.requested_status,
        status: row.status,
        queuePosition: row.queue_position,
        requestedAt: row.requested_at,
        approvedAt: row.decided_at,
        rejectionReason: row.rejection_reason
    }));

    return {
        allRooms,
        pendingRequests,
        usersDatabase: userResult.rows.map(publicUser),
        systemLogs: logResult.rows.map((row) => ({
            id: row.id,
            timestamp: row.created_at,
            action: row.action,
            roomId: row.room_number,
            user: row.username || 'system',
            details: row.details,
            status: row.details?.status || ''
        })),
        registrationCodes: codeResult.rows.map((row) => ({
            id: row.id,
            code: row.code,
            createdAt: row.created_at,
            createdBy: row.created_by_username,
            usedBy: row.used_by_username,
            usedAt: row.used_at,
            revokedAt: row.revoked_at
        })),
        notifications: notifResult.rows
    };
}

async function hasOverlap(client, roomId, date, startTime, endTime) {
    const { rows } = await client.query(`
        SELECT id FROM room_schedules
        WHERE room_id = $1
          AND date = $2
          AND status IN ('active', 'standby')
          AND start_time < $4
          AND end_time > $3
        LIMIT 1
    `, [roomId, date, startTime, endTime]);
    return rows.length > 0;
}

async function nextQueuePosition(client, roomId, date) {
    const { rows } = await client.query(`
        SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_position
        FROM room_schedules
        WHERE room_id = $1 AND date = $2 AND status = 'standby'
    `, [roomId, date]);
    return Number(rows[0].next_position || 1);
}

async function promoteNextSchedule(client, roomId, completedSchedule) {
    const { rows } = await client.query(`
        SELECT s.*, r.id AS request_id, r.requested_status
        FROM room_schedules s
        JOIN room_requests r ON r.id = s.request_id
        WHERE s.room_id = $1
          AND s.date = $2
          AND s.status = 'standby'
          AND s.start_time < $4
          AND s.end_time > $3
        ORDER BY COALESCE(s.queue_position, 999999), s.start_time
        LIMIT 1
    `, [roomId, completedSchedule.date, completedSchedule.start_time, completedSchedule.end_time]);

    if (!rows[0]) {
        await client.query('UPDATE rooms SET status = $1, updated_at = now() WHERE id = $2', ['Available', roomId]);
        return null;
    }

    const next = rows[0];
    await client.query('UPDATE room_schedules SET status = $1, queue_position = NULL WHERE id = $2', ['active', next.id]);
    await client.query('UPDATE room_requests SET status = $1, queue_position = NULL, decided_at = now() WHERE id = $2', ['active', next.request_id]);
    await client.query('UPDATE rooms SET status = $1, updated_at = now() WHERE id = $2', [STATUS_MAP[next.requested_status] || 'Available', roomId]);
    return next;
}

app.get('/health', async (_req, res) => {
    try {
        if (!pool) return res.status(503).json({ status: 'NO_DATABASE' });
        await pool.query('SELECT 1');
        res.json({ status: 'OK', uptime: process.uptime() });
    } catch (error) {
        res.status(503).json({ status: 'ERROR', error: error.message });
    }
});

app.post('/api/auth/login', async (req, res, next) => {
    try {
        const username = String(req.body.username || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        const { rows } = await requireDb().query('SELECT * FROM users WHERE username = $1', [username]);
        const user = rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        await requireDb().query('UPDATE users SET login_count = login_count + 1, last_login_at = now() WHERE id = $1', [user.id]);
        setAuthCookie(res, signUser(user));
        res.json({ user: publicUser({ ...user, login_count: user.login_count + 1, last_login_at: new Date() }) });
    } catch (error) {
        next(error);
    }
});

app.post('/api/auth/register', async (req, res, next) => {
    const client = await requireDb().connect();
    try {
        const username = String(req.body.username || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        const fullName = String(req.body.fullName || '').trim();
        const code = String(req.body.registrationCode || '').trim();
        if (!username || username.length < 3 || !password || password.length < 6 || !fullName || !code) {
            return res.status(400).json({ error: 'Username, password, full name, and registration code are required.' });
        }

        await client.query('BEGIN');
        const codeResult = await client.query(`
            SELECT * FROM registration_codes
            WHERE code = $1 AND used_at IS NULL AND revoked_at IS NULL
            FOR UPDATE
        `, [code]);
        if (!codeResult.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid or already used registration code.' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const userResult = await client.query(`
            INSERT INTO users (username, password_hash, full_name, email, phone_number, role)
            VALUES ($1, $2, $3, $4, $5, 'instructor')
            RETURNING *
        `, [username, passwordHash, fullName, req.body.email || null, req.body.phoneNumber || null]);
        await client.query('UPDATE registration_codes SET used_by = $1, used_at = now() WHERE id = $2', [userResult.rows[0].id, codeResult.rows[0].id]);
        await addLog(client, userResult.rows[0].id, 'register', null, { username });
        await client.query('COMMIT');
        res.status(201).json({ user: publicUser(userResult.rows[0]) });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') return res.status(409).json({ error: 'Username already exists.' });
        next(error);
    } finally {
        client.release();
    }
});

app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(JWT_COOKIE);
    res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
    try {
        res.json({ user: publicUser(await getCurrentUser(req.user.id)) });
    } catch (error) {
        next(error);
    }
});

app.get('/api/data', authOptional, async (req, res, next) => {
    try {
        res.json(await buildSnapshot(req.user));
    } catch (error) {
        next(error);
    }
});

app.get('/api/rooms', requireAuth, async (req, res, next) => {
    try {
        const snapshot = await buildSnapshot(req.user);
        res.json(snapshot.allRooms);
    } catch (error) {
        next(error);
    }
});

app.post('/api/rooms', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
        const roomNumber = Number(req.body.roomNumber || req.body.id);
        if (!roomNumber) return res.status(400).json({ error: 'Room number is required.' });
        const { rows } = await requireDb().query(`
            INSERT INTO rooms (room_number, category, status, is_requestable)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [roomNumber, req.body.category || 'Comlab Room', STATUS_MAP[req.body.status] || 'Available', req.body.isRequestable !== false]);
        await addLog(requireDb(), req.user.id, 'room_create', rows[0].id, { roomNumber });
        res.status(201).json(rows[0]);
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Room already exists.' });
        next(error);
    }
});

app.patch('/api/rooms/:roomNumber', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
        const fields = [];
        const values = [];
        const allowed = {
            category: 'category',
            status: 'status',
            isRequestable: 'is_requestable'
        };
        for (const [bodyKey, column] of Object.entries(allowed)) {
            if (Object.prototype.hasOwnProperty.call(req.body, bodyKey)) {
                values.push(bodyKey === 'status' ? (STATUS_MAP[req.body[bodyKey]] || 'Available') : req.body[bodyKey]);
                fields.push(`${column} = $${values.length}`);
            }
        }
        if (!fields.length) return res.status(400).json({ error: 'No supported room fields provided.' });
        values.push(Number(req.params.roomNumber));
        const { rows } = await requireDb().query(`
            UPDATE rooms SET ${fields.join(', ')}, updated_at = now()
            WHERE room_number = $${values.length}
            RETURNING *
        `, values);
        if (!rows[0]) return res.status(404).json({ error: 'Room not found.' });
        await addLog(requireDb(), req.user.id, 'room_update', rows[0].id, req.body);
        res.json(rows[0]);
    } catch (error) {
        next(error);
    }
});

app.delete('/api/rooms/:roomNumber', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
        await requireDb().query('DELETE FROM rooms WHERE room_number = $1', [Number(req.params.roomNumber)]);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

app.post('/api/registration-codes', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
        const code = String(req.body.code || `CTU-${Math.random().toString(36).slice(2, 10).toUpperCase()}`).trim();
        const { rows } = await requireDb().query(`
            INSERT INTO registration_codes (code, created_by)
            VALUES ($1, $2)
            RETURNING *
        `, [code, req.user.id]);
        res.status(201).json(rows[0]);
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Code already exists.' });
        next(error);
    }
});

app.delete('/api/registration-codes/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
        await requireDb().query('UPDATE registration_codes SET revoked_at = now() WHERE id = $1 AND used_at IS NULL', [req.params.id]);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

app.post('/api/admin/users', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
        const username = String(req.body.username || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        const fullName = String(req.body.fullName || '').trim();
        const role = req.body.role === 'admin' ? 'admin' : 'instructor';
        if (!username || username.length < 3 || !password || password.length < 6 || !fullName) {
            return res.status(400).json({ error: 'Username, full name, and password are required.' });
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const { rows } = await requireDb().query(`
            INSERT INTO users (username, password_hash, full_name, email, phone_number, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [username, passwordHash, fullName, req.body.email || null, req.body.phoneNumber || null, role]);
        await addLog(requireDb(), req.user.id, 'user_create', null, { username, role });
        res.status(201).json({ user: publicUser(rows[0]) });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Username already exists.' });
        next(error);
    }
});

app.post('/api/requests', requireAuth, requireRole('instructor'), async (req, res, next) => {
    const client = await requireDb().connect();
    try {
        const date = String(req.body.date || '');
        const startTime = String(req.body.startTime || '');
        const endTime = String(req.body.endTime || '');
        const today = manilaToday();
        if (date !== today) return res.status(400).json({ error: `Schedules are only allowed for today (${today}).` });
        if (!startTime || !endTime || startTime >= endTime) return res.status(400).json({ error: 'Invalid time range.' });

        await client.query('BEGIN');
        const roomResult = await client.query('SELECT * FROM rooms WHERE room_number = $1 FOR UPDATE', [Number(req.body.roomId)]);
        const room = roomResult.rows[0];
        if (!room) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Room not found.' });
        }
        if (!room.is_requestable) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'This room is not available for instructor requests.' });
        }

        const overlaps = await hasOverlap(client, room.id, date, startTime, endTime);
        const status = overlaps ? 'standby' : 'active';
        const queuePosition = overlaps ? await nextQueuePosition(client, room.id, date) : null;
        const requestedStatus = req.body.requestedStatus || 'locked';
        const requestResult = await client.query(`
            INSERT INTO room_requests (
                room_id, instructor_id, date, start_time, end_time, purpose,
                requested_status, status, queue_position, decided_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
            RETURNING *
        `, [room.id, req.user.id, date, startTime, endTime, req.body.purpose || null, requestedStatus, status, queuePosition]);
        await client.query(`
            INSERT INTO room_schedules (
                request_id, room_id, instructor_id, date, start_time, end_time,
                requested_status, status, queue_position
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [requestResult.rows[0].id, room.id, req.user.id, date, startTime, endTime, requestedStatus, status, queuePosition]);
        if (status === 'active') {
            await client.query('UPDATE rooms SET status = $1, updated_at = now() WHERE id = $2', [STATUS_MAP[requestedStatus] || 'Available', room.id]);
        }
        await addLog(client, req.user.id, 'request_create', room.id, { status, date, startTime, endTime, requestedStatus });
        await client.query('COMMIT');
        res.status(201).json({ request: requestResult.rows[0], status });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        client.release();
    }
});

app.patch('/api/requests/:id/reject', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
        const { rows } = await requireDb().query(`
            UPDATE room_requests
            SET status = 'rejected', decided_at = now(), decided_by = $2, rejection_reason = $3
            WHERE id = $1 AND status IN ('active', 'standby')
            RETURNING *
        `, [req.params.id, req.user.id, req.body.reason || null]);
        if (!rows[0]) return res.status(404).json({ error: 'Request not found or already closed.' });
        await requireDb().query('UPDATE room_schedules SET status = $1 WHERE request_id = $2', ['cancelled', req.params.id]);
        res.json(rows[0]);
    } catch (error) {
        next(error);
    }
});

app.delete('/api/requests/:id', requireAuth, async (req, res, next) => {
    const client = await requireDb().connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`
            SELECT rr.*, s.id AS schedule_id, s.status AS schedule_status
            FROM room_requests rr
            LEFT JOIN room_schedules s ON s.request_id = rr.id
            WHERE rr.id = $1
            FOR UPDATE
        `, [req.params.id]);
        const request = rows[0];
        if (!request) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Request not found.' });
        }
        if (req.user.role !== 'admin' && request.instructor_id !== req.user.id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Forbidden' });
        }
        await client.query('UPDATE room_requests SET status = $1 WHERE id = $2', ['cancelled', req.params.id]);
        await client.query('UPDATE room_schedules SET status = $1 WHERE request_id = $2', ['cancelled', req.params.id]);
        if (request.schedule_status === 'active') {
            await promoteNextSchedule(client, request.room_id, request);
        }
        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        client.release();
    }
});

app.post('/api/schedules/:id/done', requireAuth, async (req, res, next) => {
    const client = await requireDb().connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`
            SELECT s.*, r.id AS request_id
            FROM room_schedules s
            JOIN room_requests r ON r.id = s.request_id
            WHERE s.id = $1 AND s.status = 'active'
            FOR UPDATE
        `, [req.params.id]);
        const schedule = rows[0];
        if (!schedule) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Active schedule not found.' });
        }
        if (req.user.role !== 'admin' && schedule.instructor_id !== req.user.id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Only the active instructor can mark this schedule done.' });
        }
        await client.query('UPDATE room_schedules SET status = $1, completed_at = now() WHERE id = $2', ['completed', schedule.id]);
        await client.query('UPDATE room_requests SET status = $1 WHERE id = $2', ['completed', schedule.request_id]);
        const promoted = await promoteNextSchedule(client, schedule.room_id, schedule);
        await addLog(client, req.user.id, 'schedule_done', schedule.room_id, { scheduleId: schedule.id, promotedScheduleId: promoted?.id || null });
        await client.query('COMMIT');
        res.json({ ok: true, promotedScheduleId: promoted?.id || null });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        client.release();
    }
});

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'Login.html'));
});

app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Server error' });
});

if (require.main === module) {
    if (!DATABASE_URL) {
        console.warn('DATABASE_URL is not configured. API routes will return 503 until it is set.');
    }
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`CTU Room Management System running on port ${PORT}`);
    });
}

module.exports = app;
