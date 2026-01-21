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

app.use("/api/auth", require("./routes/auth"));
// app.use("/api/admin", require("./routes/admin"));

// Initialize Socket.io
socketController.init(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));