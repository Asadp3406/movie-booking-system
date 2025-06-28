// backend/index.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const db = require('./database.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config(); 
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'your-super-secret-key-that-should-be-in-an-env-file';

// --- Middlewares ---
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
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.sendStatus(403);
    }
};

// --- WebSocket Setup ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const broadcast = (data) => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
    });
};
wss.on('connection', ws => {
    console.log('Client connected');
    ws.on('close', () => console.log('Client disconnected'));
});

// --- API Routes ---

// AUTH routes
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();
        db.run(`INSERT INTO users (id, email, password) VALUES (?, ?, ?)`, [id, email, hashedPassword], function(err) {
            if (err) return res.status(400).json({ error: "Email already exists" });
            res.status(201).json({ message: "User created successfully", userId: id });
        });
    } catch { res.status(500).send(); }
});

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

// --- MOVIE API ENDPOINTS ---
// GET a list of all movies
app.get('/api/movies', (req, res) => {
    db.all("SELECT * FROM movies ORDER BY title", [], (err, movies) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json({ movies });
    });
});

// GET a single movie's details and its showtimes
app.get('/api/movies/:id', (req, res) => {
    const movieId = req.params.id;
    const movieSql = "SELECT * FROM movies WHERE id = ?";
    const showsSql = "SELECT id, showTime FROM shows WHERE movieId = ? ORDER BY showTime";

    db.get(movieSql, [movieId], (err, movie) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        if (!movie) {
            res.status(404).json({ "error": "Movie not found" });
            return;
        }
        db.all(showsSql, [movieId], (err, shows) => {
            if (err) {
                res.status(500).json({ "error": err.message });
                return;
            }
            res.json({ movie, shows });
        });
    });
});

// GET seat map for a specific show
app.get('/api/shows/:id', (req, res) => {
    const showId = req.params.id;
    const showSql = `
        SELECT m.title as movieTitle, s.showTime 
        FROM shows s 
        JOIN movies m ON s.movieId = m.id 
        WHERE s.id = ?
    `;
    db.get(showSql, [showId], (err, showDetails) => {
        if (err || !showDetails) return res.status(500).json({ error: 'Could not fetch show details' });
        
        const seatsSql = `SELECT id as seatId, seatNumber, status FROM seats WHERE showId = ? ORDER BY seatNumber`;
        db.all(seatsSql, [showId], (err, seats) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ...showDetails, seats: seats });
        });
    });
});

// Booking and Payment routes
app.post('/api/book', authenticateToken, (req, res) => {
    const { showId, seatNumbers } = req.body;
    const userId = req.user.id;
    if (!showId || !Array.isArray(seatNumbers) || seatNumbers.length === 0) return res.status(400).json({ error: 'Invalid request body' });
    db.serialize(() => {
        db.run('BEGIN IMMEDIATE TRANSACTION;');
        const placeholders = seatNumbers.map(() => '?').join(',');
        const sql = `SELECT * FROM seats WHERE showId = ? AND seatNumber IN (${placeholders}) AND status = 'available'`;
        db.all(sql, [showId, ...seatNumbers], (err, availableSeats) => {
            if (err) { db.run('ROLLBACK;'); return res.status(500).json({ error: 'Database error checking seats' }); }
            if (availableSeats.length !== seatNumbers.length) { db.run('ROLLBACK;'); return res.status(409).json({ error: 'One or more seats are no longer available. Please select again.' }); }
            const updateSql = `UPDATE seats SET status = 'booked', userId = ? WHERE showId = ? AND seatNumber IN (${placeholders})`;
            db.run(updateSql, [userId, showId, ...seatNumbers], function(err) {
                if (err) { db.run('ROLLBACK;'); return res.status(500).json({ error: 'Failed to book seats' }); }
                db.run('COMMIT;', (commitErr) => {
                    if (commitErr) { return res.status(500).json({ error: 'Failed to commit booking' }); }
                    broadcast({ type: 'BOOKING_CONFIRMED', payload: { bookedSeats: seatNumbers } });
                    res.status(200).json({ message: 'Booking successful', bookedSeats: seatNumbers });
                });
            });
        });
    });
});

app.post("/api/create-payment-intent", async (req, res) => {
    const { numSeats } = req.body;
    const pricePerSeat = 1250; // Price in cents ($12.50)
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: numSeats * pricePerSeat,
            currency: "usd",
            automatic_payment_methods: { enabled: true },
        });
        res.send({ clientSecret: paymentIntent.client_secret });
    } catch (e) {
        res.status(400).json({ error: { message: e.message }});
    }
});

// Admin routes
app.get('/api/admin/movies', authenticateToken, verifyAdmin, (req, res) => {
    db.all("SELECT * FROM movies ORDER BY title", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ movies: rows });
    });
});

app.post('/api/admin/movies', authenticateToken, verifyAdmin, (req, res) => {
    const { title, posterUrl } = req.body;
    if (!title || !posterUrl) return res.status(400).json({ error: "Title and Poster URL are required" });
    const id = uuidv4();
    db.run(`INSERT INTO movies (id, title, posterUrl) VALUES (?, ?, ?)`, [id, title, posterUrl], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Movie created", movieId: id });
    });
});


const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is actively listening on port ${PORT}`);
});