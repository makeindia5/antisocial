const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");

const http = require("http");
const socketController = require("./controllers/socketController");

const app = express();
const server = http.createServer(app);

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use('/uploads', express.static('uploads'));

app.use("/", require("./routes/public"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/gd", require("./routes/gd"));
app.use("/api/admin", require("./routes/admin"));

// Health check endpoint
app.get("/health", (req, res) => {
    const mongoose = require("mongoose");
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.status(200).json({ status: "ok", database: dbStatus });
});

// Initialize Socket.io
socketController.init(server);

const PORT = process.env.PORT || 5002;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));