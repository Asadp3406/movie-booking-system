// backend/index.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { setupDatabase } = require('./setupDatabase.js');
const dbPath = process.env.DB_PATH || "db.sqlite";

// --- Main Application Logic ---
const app = express();
let db; // We will initialize the database after checking if setup is needed

// --- Run Initialization and Start Server ---
async function initialize() {
    // Check if the database file exists.
    const dbExists = fs.existsSync(dbPath);

    if (!dbExists) {
        console.log('Database not found. Running initial setup... This will take a moment.');
        try {
            await setupDatabase();
            console.log('Database setup complete.');
        } catch (setupError) {
            console.error('CRITICAL: Database setup failed. Server will not start.', setupError);
            process.exit(1); // Exit if DB setup fails
        }
    } else {
        console.log('Database found. Skipping setup.');
    }
    
    // Now that setup is guaranteed to be complete, connect to the database for the app to use
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error("CRITICAL: Error connecting to the database after setup.", err);
            process.exit(1);
        }
        console.log('Application connected to the database.');
    });

    // Start the server only after the database is ready
    startServer();
}

function startServer() {
    app.use(cors());
    app.use(express.json());
    
    const JWT_SECRET = 'your-super-secret-key-that-should-be-in-an-env-file';

    // --- Middlewares & WebSocket ---
    const authenticateToken = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token == null) return res.sendStatus(401);
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    };
    const verifyAdmin = (req, res, next) => {
        if (req.user && req.user.isAdmin) next();
        else res.sendStatus(403);
    };
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    const broadcast = (data) => {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
        });
    };
    wss.on('connection', ws => console.log('Client connected'));

    // --- All API Routes ---
    app.post('/api/auth/register', async (req, res) => {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            db.run(`INSERT INTO users (id, email, password) VALUES (?, ?, ?)`, [uuidv4(), email, hashedPassword], function(err) {
                if (err) return res.status(400).json({ error: "Email already exists" });
                res.status(201).json({ message: "User created successfully" });
            });
        } catch { res.status(500).send(); }
    });
    // ... all other routes (login, movies, shows, book, payment, admin) go here ...
    // Note: They are unchanged, but must be inside this startServer function
    // For brevity, I will show just one, but you should have all of them here.
    app.post('/api/auth/login', (req, res) => {
        const { email, password } = req.body;
        db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
            if (user == null) return res.status(400).json({ error: "Cannot find user" });
            try {
                if (await bcrypt.compare(password, user.password)) {
                    const accessToken = jwt.sign({ id: user.id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '1h' });
                    res.json({ accessToken: accessToken });
                } else { res.status(403).json({ error: "Not Allowed" }); }
            } catch { res.status(500).send(); }
        });
    });
    app.get('/api/movies', (req, res) => {
        db.all("SELECT * FROM movies ORDER BY title", [], (err, movies) => {
            if (err) return res.status(500).json({ "error": err.message });
            res.json({ movies });
        });
    });
    app.get('/api/movies/:id', (req, res) => {
        const movieId = req.params.id;
        db.get("SELECT * FROM movies WHERE id = ?", [movieId], (err, movie) => {
            if (err || !movie) return res.status(404).json({ "error": "Movie not found" });
            db.all("SELECT id, showTime FROM shows WHERE movieId = ? ORDER BY showTime", [movieId], (err, shows) => {
                if (err) return res.status(500).json({ "error": err.message });
                res.json({ movie, shows });
            });
        });
    });
    app.get('/api/shows/:id', (req, res) => {
        const showId = req.params.id;
        db.get(`SELECT m.title as movieTitle, s.showTime FROM shows s JOIN movies m ON s.movieId = m.id WHERE s.id = ?`, [showId], (err, showDetails) => {
            if (err || !showDetails) return res.status(500).json({ error: 'Could not fetch show details' });
            db.all(`SELECT id as seatId, seatNumber, status FROM seats WHERE showId = ? ORDER BY seatNumber`, [showId], (err, seats) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ ...showDetails, seats: seats });
            });
        });
    });
    app.post('/api/book', authenticateToken, (req, res) => {
        const { showId, seatNumbers } = req.body;
        db.serialize(() => {
            db.run('BEGIN IMMEDIATE TRANSACTION;');
            const placeholders = seatNumbers.map(() => '?').join(',');
            db.all(`SELECT * FROM seats WHERE showId = ? AND seatNumber IN (${placeholders}) AND status = 'available'`, [showId, ...seatNumbers], (err, availableSeats) => {
                if (err || availableSeats.length !== seatNumbers.length) {
                    db.run('ROLLBACK;');
                    return res.status(409).json({ error: 'One or more seats are no longer available. Please select again.' });
                }
                db.run(`UPDATE seats SET status = 'booked', userId = ? WHERE showId = ? AND seatNumber IN (${placeholders})`, [req.user.id, showId, ...seatNumbers], function(err) {
                    if (err) { db.run('ROLLBACK;'); return res.status(500).json({ error: 'Failed to book seats' }); }
                    db.run('COMMIT;', (commitErr) => {
                        if (commitErr) return res.status(500).json({ error: 'Failed to commit booking' });
                        broadcast({ type: 'BOOKING_CONFIRMED', payload: { bookedSeats: seatNumbers } });
                        res.status(200).json({ message: 'Booking successful' });
                    });
                });
            });
        });
    });
    app.post("/api/create-payment-intent", async (req, res) => {
        const { numSeats } = req.body;
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: numSeats * 1250,
                currency: "usd",
                automatic_payment_methods: { enabled: true },
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        } catch (e) { res.status(400).json({ error: { message: e.message }}); }
    });
    app.get('/api/admin/movies', authenticateToken, verifyAdmin, (req, res) => {
        db.all("SELECT * FROM movies ORDER BY title", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ movies: rows });
        });
    });
    app.post('/api/admin/movies', authenticateToken, verifyAdmin, (req, res) => {
        const { title, posterUrl } = req.body;
        if (!title || !posterUrl) return res.status(400).json({ error: "Title and Poster URL are required" });
        db.run(`INSERT INTO movies (id, title, posterUrl) VALUES (?, ?, ?)`, [uuidv4(), title, posterUrl], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "Movie created" });
        });
    });
    app.delete('/api/admin/movies/:id', authenticateToken, verifyAdmin, (req, res) => {
        const movieId = req.params.id;
        db.all("SELECT id FROM shows WHERE movieId = ?", [movieId], (err, shows) => {
            if (err) return res.status(500).json({ error: "Error finding shows for movie." });
            const showIds = shows.map(s => s.id);
            const placeholders = showIds.map(() => '?').join(',');
            db.serialize(() => {
                db.run('BEGIN TRANSACTION;');
                if (showIds.length > 0) db.run(`DELETE FROM seats WHERE showId IN (${placeholders})`, showIds);
                db.run("DELETE FROM shows WHERE movieId = ?", [movieId]);
                db.run("DELETE FROM movies WHERE id = ?", [movieId], (err) => {
                    if(err) { db.run('ROLLBACK;'); return res.status(500).json({ error: "Failed to delete movie." });}
                    db.run('COMMIT;');
                    res.status(200).json({ message: "Movie and all associated shows deleted successfully." });
                });
            });
        });
    });
    app.post('/api/admin/shows', authenticateToken, verifyAdmin, (req, res) => {
        const { movieId, showTime } = req.body;
        if (!movieId || !showTime) return res.status(400).json({ error: "Movie ID and Show Time are required" });
        const showId = uuidv4();
        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');
            db.run(`INSERT INTO shows (id, movieId, showTime) VALUES (?, ?, ?)`, [showId, movieId, showTime], (err) => {
                if (err) { db.run('ROLLBACK;'); return res.status(500).json({ error: "Failed to create show." }); }
                const insertSeat = db.prepare(`INSERT INTO seats (id, showId, seatNumber, status) VALUES (?, ?, ?, ?)`);
                const rows = ['A', 'B', 'C', 'D', 'E'];
                for (let i = 0; i < 5; i++) { for (let j = 1; j <= 8; j++) { insertSeat.run(uuidv4(), showId, `${rows[i]}${j}`, 'available'); } }
                insertSeat.finalize((err) => {
                    if (err) { db.run('ROLLBACK;'); return res.status(500).json({ error: "Failed to create seats for the show." }); }
                    db.run('COMMIT;');
                    res.status(201).json({ message: "Show created successfully with all seats." });
                });
            });
        });
    });

    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => console.log(`Server is actively listening on port ${PORT}`));
}

// Start the application
initialize();