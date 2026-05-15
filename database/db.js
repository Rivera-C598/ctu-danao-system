// MySQL Database Connection Module
const mysql = require('mysql2/promise');
const config = require('./config');

let pool;

/**
 * Initialize database connection pool
 */
async function initializePool() {
    try {
        pool = mysql.createPool(config);
        console.log('✅ MySQL Pool created successfully');

        // Test connection
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('✅ Connected to MySQL database');

        return pool;
    } catch (error) {
        console.error('❌ Error connecting to MySQL:', error.message);
        throw error;
    }
}

/**
 * Get database connection pool
 */
function getPool() {
    if (!pool) {
        throw new Error('Database pool not initialized. Call initializePool first.');
    }
    return pool;
}

/**
 * Execute query
 */
async function query(sql, values) {
    try {
        const connection = await getPool().getConnection();
        const [results] = await connection.execute(sql, values);
        connection.release();
        return results;
    } catch (error) {
        console.error('❌ Query error:', error.message);
        throw error;
    }
}

module.exports = {
    initializePool,
    getPool,
    query
};
