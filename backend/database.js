// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const DBSOURCE = process.env.DB_PATH || "db.sqlite";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        runSetup();
    }
});

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
    // --- "Dune: Part Two" has been removed from this list ---
    const movies = [
        { id: uuidv4(), title: 'Inception', posterUrl: 'https://m.media-amazon.com/images/I/912AErFSBHL._AC_UF894,1000_QL80_.jpg', shows: [{ id: uuidv4(), time: '2025-07-15 18:00:00' }, { id: uuidv4(), time: '2025-07-15 21:00:00' }] },
        { id: uuidv4(), title: 'The Matrix', posterUrl: 'https://m.media-amazon.com/images/I/51EG732BV3L._AC_UF894,1000_QL80_.jpg', shows: [{ id: uuidv4(), time: '2025-07-15 19:00:00' }, { id: uuidv4(), time: '2025-07-15 22:00:00' }] }
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