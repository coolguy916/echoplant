// db/database.js
// test
const mysql = require('mysql2');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto.createHash('sha256').update(process.env.DB_ENCRYPTION_KEY || '').digest();
const IV_LENGTH = 16;
class Database {
    constructor(config) {
        this.connection = mysql.createConnection(config);
        this.config = config;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.connection.connect(err => {
                if (err) {
                    console.error(`MySQL connection failed to ${this.config.host}/${this.config.database}:`, err.message);
                    return reject(err);
                }
                console.log(`Connected to MySQL: ${this.config.user}@${this.config.host}/${this.config.database}`);
                resolve();
            });
        });
    }

    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.connection.query(sql, params, (err, results) => {
                if (err) {
                    console.error("Database query error:", err.sqlMessage || err.message);
                    console.error("SQL:", sql);
                    console.error("Params:", params);
                    return reject(err);
                }
                resolve(results);
            });
        });
    }

    validate(data, rules) {
        for (const [field, rule] of Object.entries(rules)) {
            if (rule.includes('required') && (data[field] === undefined || data[field] === null || data[field] === '')) {
                throw new Error(`${field} is required`);
            }
            if (rule.includes('email') && data[field] && !/^\S+@\S+\.\S+$/.test(data[field])) {
                throw new Error(`${field} must be a valid email`);
            }
        }
    }

    encrypt(text) {
        if (text === null || typeof text === 'undefined') return text;
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
        let encrypted = cipher.update(String(text), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    decrypt(encryptedText) {
        if (typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
            return encryptedText;
        }
        try {
            const textParts = encryptedText.split(':');
            const iv = Buffer.from(textParts.shift(), 'hex');
            const encryptedData = textParts.join(':');
            const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            // console.error("Decryption failed for:", encryptedText.substring(0, 20) + "...", error.message);
            return encryptedText;
        }
    }

    postData(tableName, data = {}) {
        const dataToInsert = { ...data };
        const columns = Object.keys(dataToInsert);
        const values = Object.values(dataToInsert);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES (${placeholders})`;
        return this.query(sql, values);
    }

    updateData(tableName, data = {}, whereClause = '', whereParams = []) {
        const dataToUpdate = { ...data };

        const columns = Object.keys(dataToUpdate);
        const values = Object.values(dataToUpdate);
        const setClause = columns.map(col => `\`${col}\` = ?`).join(', ');
        const sql = `UPDATE \`${tableName}\` SET ${setClause} WHERE ${whereClause}`;
        return this.query(sql, [...values, ...whereParams]);
    }

    _decryptRow(row) {
        const decryptedRow = { ...row };
        for (const key in decryptedRow) {
            if (typeof decryptedRow[key] === 'string' && decryptedRow[key].includes(':')) {
                const originalValue = decryptedRow[key];
                decryptedRow[key] = this.decrypt(originalValue);
                if (decryptedRow[key] !== originalValue && !isNaN(Number(decryptedRow[key]))) {
                    decryptedRow[key] = Number(decryptedRow[key]);
                }
            }
        }
        return decryptedRow;
    }

    async getDataByFilters(tableName, filters = {}, options = {}) {
        const keys = Object.keys(filters);
        let sql = `SELECT * FROM \`${tableName}\``;
        const values = [];

        // Handle filters
        if (keys.length > 0) {
            const conditions = keys.map(key => {
                values.push(filters[key]);
                return `\`${key}\` = ?`;
            }).join(' AND ');
            sql += ` WHERE ${conditions}`;
        }

        // Handle sorting - Fixed the parsing issue
        if (options.orderBy) {
            if (typeof options.orderBy === 'string') {
                // Parse string format like "id DESC" or "column ASC"
                const parts = options.orderBy.trim().split(/\s+/);
                const column = parts[0];
                const direction = parts[1] ? parts[1].toUpperCase() : 'DESC';
                sql += ` ORDER BY \`${column}\` ${direction === 'DESC' ? 'DESC' : 'ASC'}`;
            } else if (options.orderBy.column) {
                // Handle object format
                const direction = options.orderBy.direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
                sql += ` ORDER BY \`${options.orderBy.column}\` ${direction}`;
            }
        }

        // Handle limit
        if (options.limit && Number.isInteger(options.limit) && options.limit > 0) {
            sql += ` LIMIT ?`;
            values.push(options.limit);
        }

        const rows = await this.query(sql, values);
        return rows.map(row => this._decryptRow(row));
    }

    async getAllUsers() { // Example from your previous code
        const rows = await this.query('SELECT * FROM users');
        return rows.map(row => this._decryptRow(row)); // Assuming user data might be encrypted
    }

    async insertUser(name, email) { // Example from your previous code
        const encryptedName = this.encrypt(name);
        const encryptedEmail = this.encrypt(email);
        return this.query('INSERT INTO users (name, email) VALUES (?, ?)', [encryptedName, encryptedEmail]);
    }

    close() {
        return new Promise((resolve, reject) => {
            if (this.connection) {
                this.connection.end(err => {
                    if (err) {
                        console.error('Error closing MySQL connection:', err.message);
                        return reject(err);
                    }
                    console.log('MySQL connection closed.');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    check_up(data) {
        if (!data) {
            return res.status(500).json({ success: false, error: "Database not initialized for controller." });
        }
    }
}


module.exports = Database;