// backend/setupDatabase.js
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const DBSOURCE = process.env.DB_PATH || "db.sqlite";

function setupDatabase() {
    // Return a promise to ensure the main app waits for this to finish
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DBSOURCE, (err) => {
            if (err) {
                console.error("Error opening database:", err.message);
                return reject(err);
            } else {
                console.log('Connected to the SQLite database for setup.');
            }
        });

        db.serialize(() => {
            console.log("Setting up database tables...");
            db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, isAdmin INTEGER DEFAULT 0)`);
            db.run(`CREATE TABLE IF NOT EXISTS movies (id TEXT PRIMARY KEY, title TEXT NOT NULL, posterUrl TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS shows (id TEXT PRIMARY KEY, movieId TEXT, showTime TEXT, FOREIGN KEY (movieId) REFERENCES movies(id))`);
            db.run(`CREATE TABLE IF NOT EXISTS seats (id TEXT PRIMARY KEY, showId TEXT, seatNumber TEXT, status TEXT DEFAULT 'available', userId TEXT, UNIQUE(showId, seatNumber), FOREIGN KEY (showId) REFERENCES shows(id), FOREIGN KEY (userId) REFERENCES users(id))`);
            
            const movies = [
                { id: uuidv4(), title: 'Inception', posterUrl: 'https://i.imgur.com/SENiS3s.jpeg', shows: [{ id: uuidv4(), time: '2025-07-15 18:00:00' }, { id: uuidv4(), time: '2025-07-15 21:00:00' }] },
                { id: uuidv4(), title: 'The Dark Knight', posterUrl: 'https://i.imgur.com/S524s7s.jpeg', shows: [{ id: uuidv4(), time: '2025-07-15 19:30:00' }, { id: uuidv4(), time: '2025-07-15 22:30:00' }] },
                { id: uuidv4(), title: 'Interstellar', posterUrl: 'https://i.imgur.com/b653H51.jpeg', shows: [{ id: uuidv4(), time: '2025-07-16 17:00:00' }] },
                { id: uuidv4(), title: 'The Matrix', posterUrl: 'https://i.imgur.com/k2G3Y22.jpeg', shows: [{ id: uuidv4(), time: '2025-07-16 21:00:00' }] }
            ];

            db.get("SELECT COUNT(*) as count FROM movies", [], (err, row) => {
                if (row && row.count === 0) {
                    console.log("Database is empty. Seeding data...");
                    const insertMovie = db.prepare(`INSERT INTO movies (id, title, posterUrl) VALUES (?, ?, ?)`);
                    const insertShow = db.prepare(`INSERT INTO shows (id, movieId, showTime) VALUES (?, ?, ?)`);
                    const insertSeat = db.prepare(`INSERT INTO seats (id, showId, seatNumber, status) VALUES (?, ?, ?, ?)`);
                    movies.forEach(movie => {
                        insertMovie.run(movie.id, movie.title, movie.posterUrl);
                        movie.shows.forEach(show => {
                            insertShow.run(show.id, movie.id, show.time);
                            const rows = ['A', 'B', 'C', 'D', 'E'];
                            for (let i = 0; i < 5; i++) {
                                for (let j = 1; j <= 8; j++) {
                                    insertSeat.run(uuidv4(), show.id, `${rows[i]}${j}`, 'available');
                                }
                            }
                        });
                    });
                    insertMovie.finalize();
                    insertShow.finalize();
                    insertSeat.finalize();
                    console.log("Data seeding complete.");
                }
            });

            // Perform the migration task (promote admin)
            const adminEmail = 'asad1@gmail.com'; // Your admin email
            db.run(`UPDATE users SET isAdmin = 1 WHERE email = ?`, [adminEmail], function(err) {
                if(err) console.error("Could not promote admin user", err);
                if (this.changes > 0) {
                    console.log(`User ${adminEmail} has been promoted to an admin.`);
                } else {
                    console.log(`Admin user ${adminEmail} not found. Please register this user on the live site and restart the server if needed.`);
                }
            });

            // Close the database connection and resolve the promise
            db.close((err) => {
                if (err) return reject(err);
                console.log("Database setup finished. Connection closed.");
                resolve();
            });
        });
    });
}

// Export the setup function
module.exports = { setupDatabase };