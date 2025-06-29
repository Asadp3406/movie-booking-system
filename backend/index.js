// backend/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { initializeDatabase } = require('./setupDb.js');

const app = express();

// --- Main Application Startup Logic ---
async function main() {
    const client = await db.getClient();
    try {
        // Check if the 'users' table exists
        const res = await client.query("SELECT to_regclass('public.users')");
        if (res.rows[0].to_regclass === null) {
            console.log("Tables not found. Running initial database setup... This will take a moment.");
            await initializeDatabase();
            console.log("Database setup complete.");
        } else {
            console.log("Database tables already exist. Skipping setup.");
        }
    } catch (err) {
        console.error("CRITICAL: Could not check or initialize database.", err);
        process.exit(1); // Exit if DB check fails
    } finally {
        client.release();
    }
    
    // Start the web server only after the database is confirmed to be ready
    startServer();
}

// All web server logic is wrapped in this function
function startServer() {
    app.use(cors());
    app.use(express.json());
    
    const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
    const broadcast = (data) => wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(JSON.stringify(data)));
    wss.on('connection', ws => console.log('Client connected'));

    // --- All API Routes ---
    app.post('/api/auth/register', async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) return res.status(400).json({ error: "Email and password required" });
            const hashedPassword = await bcrypt.hash(password, 10);
            const result = await db.query("INSERT INTO users (id, email, password) VALUES ($1, $2, $3) RETURNING id", [uuidv4(), email, hashedPassword]);
            res.status(201).json({ message: "User created", userId: result.rows[0].id });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Email may already be in use." });
        }
    });
    // ... all other routes (login, movies, shows, book, payment, admin) go here ...
    app.post('/api/auth/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
            const user = result.rows[0];
            if (!user) return res.status(400).json({ error: "Cannot find user" });
            if (await bcrypt.compare(password, user.password)) {
                const accessToken = jwt.sign({ id: user.id, email: user.email, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '1h' });
                res.json({ accessToken });
            } else { res.status(403).json({ error: "Incorrect password" }); }
        } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" });}
    });
    app.get('/api/movies', async (req, res) => {
        const result = await db.query("SELECT id, title, poster_url as \"posterUrl\" FROM movies ORDER BY title");
        res.json({ movies: result.rows });
    });
    app.get('/api/movies/:id', async (req, res) => {
        const movieResult = await db.query("SELECT id, title, poster_url as \"posterUrl\" FROM movies WHERE id = $1", [req.params.id]);
        if (movieResult.rows.length === 0) return res.status(404).json({ error: "Movie not found" });
        const showsResult = await db.query("SELECT id, show_time as \"showTime\" FROM shows WHERE movie_id = $1 ORDER BY show_time", [req.params.id]);
        res.json({ movie: movieResult.rows[0], shows: showsResult.rows });
    });
    app.get('/api/shows/:id', async (req, res) => {
        const showResult = await db.query(`SELECT m.title as "movieTitle", s.show_time as "showTime" FROM shows s JOIN movies m ON s.movie_id = m.id WHERE s.id = $1`, [req.params.id]);
        if (showResult.rows.length === 0) return res.status(404).json({ error: "Show not found" });
        const seatsResult = await db.query(`SELECT id as "seatId", seat_number as "seatNumber", status FROM seats WHERE show_id = $1 ORDER BY seat_number`, [req.params.id]);
        res.json({ ...showResult.rows[0], seats: seatsResult.rows });
    });
    app.post('/api/book', authenticateToken, async (req, res) => {
        const { showId, seatNumbers } = req.body;
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const placeholders = seatNumbers.map((_, i) => `$${i + 2}`).join(',');
            const checkSeatsRes = await client.query(`SELECT id FROM seats WHERE show_id = $1 AND seat_number IN (${placeholders}) AND status = 'available' FOR UPDATE`, [showId, ...seatNumbers]);
            if (checkSeatsRes.rows.length !== seatNumbers.length) { throw new Error('One or more seats are no longer available. Please select again.'); }
            await client.query(`UPDATE seats SET status = 'booked', user_id = $1 WHERE show_id = $2 AND seat_number IN (${placeholders})`, [req.user.id, showId, ...seatNumbers]);
            await client.query('COMMIT');
            broadcast({ type: 'BOOKING_CONFIRMED', payload: { bookedSeats: seatNumbers } });
            res.status(200).json({ message: 'Booking successful' });
        } catch (e) { await client.query('ROLLBACK'); res.status(409).json({ error: e.message });
        } finally { client.release(); }
    });
    app.post("/api/create-payment-intent", async (req, res) => {
        const { numSeats } = req.body;
        const paymentIntent = await stripe.paymentIntents.create({ amount: numSeats * 1250, currency: "usd", automatic_payment_methods: { enabled: true }});
        res.send({ clientSecret: paymentIntent.client_secret });
    });
    app.post('/api/admin/movies', authenticateToken, verifyAdmin, async (req, res) => {
        const { title, posterUrl } = req.body;
        await db.query(`INSERT INTO movies (id, title, poster_url) VALUES ($1, $2, $3)`, [uuidv4(), title, posterUrl]);
        res.status(201).json({ message: "Movie created" });
    });
    app.post('/api/admin/shows', authenticateToken, verifyAdmin, async (req, res) => {
        const { movieId, showTime } = req.body;
        const showId = uuidv4();
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            await client.query(`INSERT INTO shows (id, movie_id, show_time) VALUES ($1, $2, $3)`, [showId, movieId, showTime]);
            const seatInserts = [];
            const rows = ['A', 'B', 'C', 'D', 'E'];
            for (let i = 0; i < 5; i++) { for (let j = 1; j <= 8; j++) { seatInserts.push(client.query(`INSERT INTO seats (id, show_id, seat_number, status) VALUES ($1, $2, $3, 'available')`, [uuidv4(), showId, `${rows[i]}${j}`])); } }
            await Promise.all(seatInserts);
            await client.query('COMMIT');
            res.status(201).json({ message: "Show created successfully" });
        } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: 'Failed to create show' });
        } finally { client.release(); }
    });
    app.delete('/api/admin/movies/:id', authenticateToken, verifyAdmin, async (req, res) => {
        await db.query("DELETE FROM movies WHERE id = $1", [req.params.id]);
        res.status(200).json({ message: "Movie deleted successfully." });
    });
    
    // --- Server Start ---
    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => console.log(`Server is actively listening on port ${PORT}`));
}

// Start the application by calling main()
main();