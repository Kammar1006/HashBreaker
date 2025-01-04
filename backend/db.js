/*
    Created by Kammar1006 and ChatGPT
*/

const mysql = require("mysql");
const opt = require("./../hidden.json");

let db;

function connectToDatabase() {
    db = mysql.createConnection({
        host: opt.db_host,
        user: opt.db_user,
        password: opt.db_pass,
        database: opt.db_dbname,
        port: opt.db_port,
    });

    // Connection to db:
    db.connect((err) => {
        if (err) {
            console.error("Connection Error:", err);
            setTimeout(connectToDatabase, 2000); //re-try connect
        } else {
            console.log("Connect to DB!");
        }
    });

    db.on("error", (err) => {
        console.error("Błąd bazy danych:", err);
        if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET") {
            console.log("Try reconnect....");
            connectToDatabase();
        } else {
            console.error("Non-Critical Error:", err);
        }
    });
}


connectToDatabase();

function queryDatabase(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) {
                console.error("Query error:", err);
                // Errors:
                return reject(err);
            }
            resolve(results);
        });
    });
}

module.exports = {queryDatabase};