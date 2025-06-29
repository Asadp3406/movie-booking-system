// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
// NEW: Import Node.js's built-in file system and path modules
const fs = require('fs');
const path = require('path');

const DBSOURCE = process.env.DB_PATH || "db.sqlite";

// --- NEW FIX ---
// Before connecting, ensure the directory where the database will be stored exists.
const dbDirectory = path.dirname(DBSOURCE);
if (!fs.existsSync(dbDirectory)) {
    // If the directory doesn't exist, create it recursively.
    fs.mkdirSync(dbDirectory, { recursive: true });
    console.log(`Database directory created at: ${dbDirectory}`);
}
// --- END FIX ---


const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        runSetup();
    }
});

// The rest of the file remains the same...
function runSetup() {
    db.serialize(() => {
        console.log("Setting up database tables...");
        db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, isAdmin INTEGER DEFAULT 0)`, (err) => {
            if (err) { if (!err.message.includes("already exists")) console.error("Error creating users table", err); }
        });
        db.run(`CREATE TABLE IF NOT EXISTS movies (id TEXT PRIMARY KEY, title TEXT NOT NULL, posterUrl TEXT)`, (err) => {
            if (err) console.error("Error creating movies table", err);
        });
        db.run(`CREATE TABLE IF NOT EXISTS shows (id TEXT PRIMARY KEY, movieId TEXT, showTime TEXT, FOREIGN KEY (movieId) REFERENCES movies(id))`, (err) => {
            if (err) console.error("Error creating shows table", err);
        });
        db.run(`CREATE TABLE IF NOT EXISTS seats (id TEXT PRIMARY KEY, showId TEXT, seatNumber TEXT, status TEXT DEFAULT 'available', userId TEXT, UNIQUE(showId, seatNumber), FOREIGN KEY (showId) REFERENCES shows(id), FOREIGN KEY (userId) REFERENCES users(id))`, (err) => {
            if (err) console.error("Error creating seats table", err);
        });
        seedData();
    });
}

function seedData() {
    const movies = [
        { id: uuidv4(), title: 'Inception', posterUrl: 'https://i.imgur.com/SENiS3s.jpeg', shows: [{ id: uuidv4(), time: '2025-07-15 18:00:00' }, { id: uuidv4(), time: '2025-07-15 21:00:00' }] },
        { id: uuidv4(), title: 'The Dark Knight', posterUrl: 'https://i.imgur.com/S524s7s.jpeg', shows: [{ id: uuidv4(), time: '2025-07-15 19:30:00' }, { id: uuidv4(), time: '2025-07-15 22:30:00' }] },
        { id: uuidv4(), title: 'Interstellar', posterUrl: 'https://i.imgur.com/b653H51.jpeg', shows: [{ id: uuidv4(), time: '2025-07-16 17:00:00' }] },
        { id: uuidv4(), title: 'The Matrix', posterUrl: 'https://i.imgur.com/k2G3Y22.jpeg', shows: [{ id: uuidv4(), time: '2025-07-16 21:00:00' }] }
    ];
    db.get("SELECT COUNT(*) as count FROM movies", [], (err, row) => {
        if (row && row.count === 0) {
            console.log("Seeding data...");
            const insertMovie = db.prepare(`INSERT INTO movies (id, title, posterUrl) VALUES (?, ?, ?)`);
            const insertShow = db.prepare(`INSERT INTO shows (id, movieId, showTime) VALUES (?, ?, ?)`);
            const insertSeat = db.prepare(`INSERT INTO seats (id, showId, seatNumber, status) VALUES (?, ?, ?, ?)`);
            db.serialize(() => {
                movies.forEach(movie => {
                    insertMovie.run(movie.id, movie.title, movie.posterUrl);
                    movie.shows.forEach(show => {
                        insertShow.run(show.id, movie.id, show.time);
                        const rows = ['A', 'B', 'C', 'D', 'E'];
                        for (let i = 0; i < 5; i++) {
                            for (let j = 1; j <= 8; j++) {
                                const status = Math.random() < 0.2 ? 'booked' : 'available';
                                insertSeat.run(uuidv4(), show.id, `${rows[i]}${j}`, status);
                            }
                        }
                    });
                });
                insertMovie.finalize();
                insertShow.finalize();
                insertSeat.finalize(err => {
                    if (err) console.error("Error finalizing seed data", err);
                    else console.log("Database setup and seeding complete.");
                });
            });
        } else {
             console.log("Database already seeded or an error occurred.");
        }
    });
}
module.exports = db;