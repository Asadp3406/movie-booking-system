// backend/migrate.js
const sqlite3 = require('sqlite3').verbose();
const DBSOURCE = "db.sqlite";

// Create a new, direct connection just for this migration script
const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        // This will happen if db.sqlite doesn't exist.
        return console.error("Error connecting to database. Please make sure you have run `node database.js` at least once.", err.message);
    }
    console.log("Connected to the SQLite database for migration.");
});

console.log("Running migration...");

// 'serialize' ensures that the commands run one after another in the correct order
db.serialize(() => {

    // Command 1: Add the isAdmin column to the users table
    db.run(`ALTER TABLE users ADD COLUMN isAdmin INTEGER DEFAULT 0`, (err) => {
        if (err) {
            // It's normal to get an error if the column already exists. We can safely ignore it.
            if (err.message.includes("duplicate column name")) {
                console.log("Column 'isAdmin' already exists. Skipping.");
            } else {
                // For any other error, we should log it.
                console.error("Error adding column to users table:", err.message);
            }
        } else {
            console.log("Column 'isAdmin' added to users table.");
        }
    });

    // Command 2: Find your user and promote them to admin
    const adminEmail = 'asad1@gmail.com'; // The email has been updated for you

    db.run(`UPDATE users SET isAdmin = 1 WHERE email = ?`, [adminEmail], function(err) {
        if (err) {
            return console.error("Error updating user to admin:", err.message);
        }
        // 'this.changes' tells us how many rows were affected. If 1, it worked. If 0, the user wasn't found.
        if (this.changes > 0) {
            console.log(`SUCCESS: User ${adminEmail} has been promoted to an admin.`);
        } else {
            console.log(`INFO: Admin user '${adminEmail}' not found. Make sure this user is registered and the email is correct in the script.`);
        }
    });

    // Command 3: Close the database connection (this will run last)
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Migration finished. Closed the database connection.');
    });
});