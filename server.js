require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const PORT = process.env.PORT || 5501;
const JWT_COOKIE = 'ctu_auth';
const DATABASE_URL = process.env.DATABASE_URL;
const IS_PROD = process.env.NODE_ENV === 'production';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    if (IS_PROD) throw new Error('JWT_SECRET environment variable is required in production.');
    console.warn('WARNING: JWT_SECRET not set — using insecure dev-only default. NEVER do this in production.');
}
const _JWT_SECRET = JWT_SECRET || 'dev-only-change-this-secret';

const CORS_ORIGIN = process.env.CORS_ORIGIN;
if (!CORS_ORIGIN && IS_PROD) throw new Error('CORS_ORIGIN environment variable is required in production.');

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

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: CORS_ORIGIN || 'http://localhost:5501',
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many registration attempts. Please try again later.' }
});

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
        role: row.role,
        loginCount: row.login_count,
        lastLogin: row.last_login_at,
        createdAt: row.created_at,
        avatarUrl: row.avatar_url || null
    };
}

function signUser(row) {
    return jwt.sign({
        id: row.id,
        username: row.username,
        role: row.role,
        fullName: row.full_name
    }, _JWT_SECRET, { expiresIn: '12h' });
}

function setAuthCookie(res, token) {
    res.cookie(JWT_COOKIE, token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: IS_PROD,
        maxAge: 12 * 60 * 60 * 1000
    });
}

function requireAuthHtml(req, res, next) {
    const token = req.cookies[JWT_COOKIE];
    if (!token) return res.redirect('/');
    try {
        jwt.verify(token, _JWT_SECRET);
        next();
    } catch (_error) {
        res.clearCookie(JWT_COOKIE);
        res.redirect('/');
    }
}

function authOptional(req, _res, next) {
    const token = req.cookies[JWT_COOKIE];
    if (!token) return next();
    try {
        req.user = jwt.verify(token, _JWT_SECRET);
    } catch (_error) {
        req.user = null;
    }
    next();
}

function requireAuth(req, res, next) {
    const token = req.cookies[JWT_COOKIE];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
        req.user = jwt.verify(token, _JWT_SECRET);
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
            SELECT rr.*, rm.room_number, rm.category AS room_category, u.username, u.full_name, u.avatar_url
            FROM room_requests rr
            JOIN rooms rm ON rm.id = rr.room_id
            JOIN users u ON u.id = rr.instructor_id
            ORDER BY rr.requested_at DESC
            LIMIT 500
        `),
        user?.role === 'admin'
            ? db.query('SELECT * FROM users ORDER BY created_at DESC')
            : db.query('SELECT id, username, full_name, email, role, login_count, last_login_at, created_at FROM users WHERE id = $1', [user?.id]),
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
        instructorAvatar: row.avatar_url || null,
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
        roomRequests: pendingRequests,
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

async function autoCompleteExpiredSessions(db) {
    const today = manilaToday();
    const nowManila = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date());

    const { rows: expired } = await db.query(`
        SELECT s.id, s.room_id, s.request_id, s.requested_status
        FROM room_schedules s
        WHERE s.status = 'active' AND s.date = $1 AND s.end_time <= $2
    `, [today, nowManila]);

    for (const s of expired) {
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            await client.query('UPDATE room_schedules SET status = $1, completed_at = now() WHERE id = $2', ['completed', s.id]);
            await client.query('UPDATE room_requests SET status = $1 WHERE id = $2', ['completed', s.request_id]);
            await promoteNextSchedule(client, s.room_id, { date: today, start_time: '00:00', end_time: '23:59' });
            await client.query('COMMIT');
        } catch (_err) {
            await client.query('ROLLBACK').catch(() => {});
        } finally {
            client.release();
        }
    }
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

// Auth-gated HTML routes — must come before express.static
app.get('/html/AdminDashboard.html', requireAuthHtml, (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'AdminDashboard.html'));
});
app.get('/html/InstructorDashboard.html', requireAuthHtml, (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'InstructorDashboard.html'));
});

const staticOpts = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
    }
};
// Serve only safe public directories — never expose server.js, .env, node_modules
['js', 'css', 'assets', 'html', 'public'].forEach(dir => {
    app.use(`/${dir}`, express.static(path.join(__dirname, dir), staticOpts));
});

app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
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

app.patch('/api/auth/profile', requireAuth, async (req, res, next) => {
    try {
        const fullName = String(req.body.fullName || '').trim();
        const email    = String(req.body.email    || '').trim() || null;
        if (!fullName) return res.status(400).json({ error: 'Full name is required.' });
        const { rows } = await requireDb().query(
            'UPDATE users SET full_name=$1, email=$2, updated_at=now() WHERE id=$3 RETURNING *',
            [fullName, email, req.user.id]
        );
        res.json({ user: publicUser(rows[0]) });
    } catch (error) { next(error); }
});

// Use memory storage — file goes to Supabase Storage, not disk
const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only.'));
        cb(null, true);
    }
});

app.post('/api/auth/avatar', requireAuth, (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
        if (!supabase) return res.status(503).json({ error: 'Storage not configured (SUPABASE_URL/SUPABASE_SERVICE_KEY missing).' });

        const ext = req.file.mimetype.includes('png') ? 'png' : req.file.mimetype.includes('gif') ? 'gif' : 'jpg';
        const filename = `${req.user.id}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filename, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true  // overwrite existing
            });

        if (uploadError) return res.status(500).json({ error: uploadError.message });

        const { data } = supabase.storage.from('avatars').getPublicUrl(filename);
        const avatarUrl = data.publicUrl;

        await requireDb().query('UPDATE users SET avatar_url=$1, updated_at=now() WHERE id=$2', [avatarUrl, req.user.id]);
        res.json({ avatarUrl });
    } catch (error) {
        console.error('Avatar upload error:', error.message);
        next(error);
    }
});

app.post('/api/auth/reset-password', requireAuth, async (req, res, next) => {
    try {
        const currentPassword = String(req.body.currentPassword || '');
        const newPassword = String(req.body.newPassword || '');
        if (!currentPassword || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Current password and new password (min 6 chars) are required.' });
        }
        const db = requireDb();
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const user = rows[0];
        if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }
        const newHash = await bcrypt.hash(newPassword, 12);
        await db.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [newHash, req.user.id]);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

app.post('/api/auth/register', registerLimiter, async (req, res, next) => {
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

app.delete('/api/logs', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
        await requireDb().query('DELETE FROM system_logs');
        res.json({ ok: true });
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

app.delete('/api/registration-codes/:id/permanent', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
        await requireDb().query('DELETE FROM registration_codes WHERE id = $1 AND revoked_at IS NOT NULL', [req.params.id]);
        res.json({ ok: true });
    } catch (error) {
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

app.post('/api/admin/users/:id/reset-password', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
        const newPassword = String(req.body.newPassword || '');
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }
        const newHash = await bcrypt.hash(newPassword, 12);
        const { rowCount } = await requireDb().query(
            'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
            [newHash, req.params.id]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'User not found.' });
        await addLog(requireDb(), req.user.id, 'user_password_reset', null, { targetUserId: req.params.id });
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

app.patch('/api/users/me', requireAuth, async (req, res, next) => {
    try {
        const fullName = String(req.body.fullName || '').trim();
        const email = String(req.body.email || '').trim() || null;
        if (!fullName) return res.status(400).json({ error: 'Full name is required.' });
        const { rows } = await requireDb().query(
            'UPDATE users SET full_name = $1, email = $2, updated_at = now() WHERE id = $3 RETURNING *',
            [fullName, email, req.user.id]
        );
        res.json({ user: publicUser(rows[0]) });
    } catch (error) {
        next(error);
    }
});

app.post('/api/requests', requireAuth, requireRole('instructor'), async (req, res, next) => {
    const client = await requireDb().connect();
    try {
        const date = String(req.body.date || '');
        const startTime = String(req.body.startTime || '');
        const endTime = String(req.body.endTime || '');
        if (!date || !startTime || !endTime || startTime >= endTime) {
            return res.status(400).json({ error: 'Invalid date or time range.' });
        }
        if (date < manilaToday()) {
            return res.status(400).json({ error: 'Cannot request a room for a past date.' });
        }

        await client.query('BEGIN');
        const roomResult = await client.query('SELECT * FROM rooms WHERE room_number = $1 FOR UPDATE', [Number(req.body.roomId)]);
        const room = roomResult.rows[0];
        if (!room) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Room not found.' }); }
        if (!room.is_requestable) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This room is not available for requests.' }); }

        const { rows: dupRows } = await client.query(`
            SELECT id, start_time, end_time FROM room_requests
            WHERE instructor_id = $1 AND room_id = $2 AND date = $3
              AND status IN ('pending','active','standby')
              AND start_time < $5 AND end_time > $4
            LIMIT 1
        `, [req.user.id, room.id, date, startTime, endTime]);
        if (dupRows[0]) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `You already have a request for this room on ${date} at ${dupRows[0].start_time?.slice(0,5)}–${dupRows[0].end_time?.slice(0,5)}.` });
        }

        // Block if another instructor already has an overlapping pending/approved request
        const { rows: otherRows } = await client.query(`
            SELECT id, start_time, end_time FROM room_requests
            WHERE instructor_id != $1 AND room_id = $2 AND date = $3
              AND status IN ('pending','active','standby')
              AND start_time < $5 AND end_time > $4
            LIMIT 1
        `, [req.user.id, room.id, date, startTime, endTime]);
        if (otherRows[0]) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `This time slot is already taken or pending for this room (${otherRows[0].start_time?.slice(0,5)}–${otherRows[0].end_time?.slice(0,5)}). Choose a different time.` });
        }

        const requestedStatus = req.body.requestedStatus || 'locked';
        const { rows } = await client.query(`
            INSERT INTO room_requests (room_id, instructor_id, date, start_time, end_time, purpose, requested_status, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            RETURNING *
        `, [room.id, req.user.id, date, startTime, endTime, req.body.purpose || null, requestedStatus]);

        await addLog(client, req.user.id, 'request_create', room.id, { date, startTime, endTime, requestedStatus });
        await client.query('COMMIT');
        res.status(201).json({ request: rows[0], status: 'pending' });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        client.release();
    }
});

app.post('/api/requests/:id/approve', requireAuth, requireRole('admin'), async (req, res, next) => {
    const client = await requireDb().connect();
    try {
        await client.query('BEGIN');
        const { rows: reqRows } = await client.query(`
            SELECT rr.*, rm.room_number FROM room_requests rr
            JOIN rooms rm ON rm.id = rr.room_id
            WHERE rr.id = $1 AND rr.status = 'pending'
            FOR UPDATE
        `, [req.params.id]);
        const request = reqRows[0];
        if (!request) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pending request not found.' }); }

        // True overlap = times actually intersect (conflict) → reject, admin must manually reject
        const trueOverlap = await hasOverlap(client, request.room_id, request.date, request.start_time, request.end_time);
        if (trueOverlap) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Time conflict: this slot overlaps with an existing approved booking. Please reject this request.' });
        }

        // Sequential (no overlap) — queue if any other schedule exists for this room+date
        const { rows: existingScheds } = await client.query(
            `SELECT id FROM room_schedules WHERE room_id=$1 AND date=$2 AND status IN ('active','standby') LIMIT 1`,
            [request.room_id, request.date]
        );
        const hasOtherSchedule = existingScheds.length > 0;
        const status = hasOtherSchedule ? 'standby' : 'active';
        const queuePosition = hasOtherSchedule ? await nextQueuePosition(client, request.room_id, request.date) : null;

        await client.query(`
            UPDATE room_requests SET status = $1, queue_position = $2, decided_at = now(), decided_by = $3 WHERE id = $4
        `, [status, queuePosition, req.user.id, request.id]);

        await client.query(`
            INSERT INTO room_schedules (request_id, room_id, instructor_id, date, start_time, end_time, requested_status, status, queue_position)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [request.id, request.room_id, request.instructor_id, request.date, request.start_time, request.end_time, request.requested_status, status, queuePosition]);

        if (status === 'active' && dbDate(request.date) === manilaToday()) {
            await client.query('UPDATE rooms SET status = $1, updated_at = now() WHERE id = $2', [STATUS_MAP[request.requested_status] || 'Locked', request.room_id]);
        }

        await addLog(client, req.user.id, 'request_approve', request.room_id, { requestId: request.id, status });
        await client.query('COMMIT');
        res.json({ ok: true, status });
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
            WHERE id = $1 AND status IN ('pending', 'active', 'standby')
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
            SELECT *
            FROM room_requests
            WHERE id = $1
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
        if (req.user.role !== 'admin' && !['pending','completed','rejected','cancelled'].includes(request.status)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Only pending requests can be cancelled. Contact admin for active bookings.' });
        }
        const scheduleResult = await client.query(`
            UPDATE room_schedules
            SET status = $1
            WHERE request_id = $2
            RETURNING *
        `, ['cancelled', req.params.id]);
        await client.query('UPDATE room_requests SET status = $1 WHERE id = $2', ['cancelled', req.params.id]);

        const schedule = scheduleResult.rows[0];
        if (schedule?.status === 'active') {
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
    if (pool) {
        setInterval(() => {
            autoCompleteExpiredSessions(pool).catch(() => {});
        }, 60 * 1000);
    }
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`CTU Room Management System running on port ${PORT}`);
    });
}

module.exports = app;
