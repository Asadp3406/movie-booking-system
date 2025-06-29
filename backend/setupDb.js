// backend/setupDb.js
require('dotenv').config();
const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const setupDatabase = async () => {
    console.log("Setting up PostgreSQL database...");
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Drop existing tables to start fresh
        await client.query('DROP TABLE IF EXISTS seats, shows, movies, users CASCADE;');
        console.log('Dropped existing tables.');

        // Create tables
        await client.query(`
            CREATE TABLE users (
                id UUID PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE
            );
            CREATE TABLE movies (
                id UUID PRIMARY KEY,
                title TEXT NOT NULL,
                poster_url TEXT
            );
            CREATE TABLE shows (
                id UUID PRIMARY KEY,
                movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
                show_time TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE seats (
                id UUID PRIMARY KEY,
                show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
                seat_number TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'available',
                user_id UUID REFERENCES users(id),
                UNIQUE(show_id, seat_number)
            );
        `);
        console.log('Tables created successfully.');

        // Seed data
        const movies = [
            { id: uuidv4(), title: 'Inception', posterUrl: 'https://i.imgur.com/SENiS3s.jpeg', shows: [{ id: uuidv4(), time: '2025-07-15 18:00:00' }] },
            { id: uuidv4(), title: 'The Dark Knight', posterUrl: 'https://i.imgur.com/S524s7s.jpeg', shows: [{ id: uuidv4(), time: '2025-07-15 19:30:00' }] },
        ];
        for (const movie of movies) {
            await client.query('INSERT INTO movies (id, title, poster_url) VALUES ($1, $2, $3)', [movie.id, movie.title, movie.posterUrl]);
            for (const show of movie.shows) {
                await client.query('INSERT INTO shows (id, movie_id, show_time) VALUES ($1, $2, $3)', [show.id, movie.id, show.time]);
                const rows = ['A', 'B', 'C', 'D', 'E'];
                for (let i = 0; i < 5; i++) {
                    for (let j = 1; j <= 8; j++) {
                        await client.query(`INSERT INTO seats (id, show_id, seat_number, status) VALUES ($1, $2, $3, 'available')`, [uuidv4(), show.id, `${rows[i]}${j}`]);
                    }
                }
            }
        }
        console.log('Data seeded successfully.');

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Database setup failed:", e);
    } finally {
        client.release();
    }
};

setupDatabase().then(() => {
    console.log("Setup script finished.");
});