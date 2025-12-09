// server/index.js
console.log("Loaded JWT_SECRET:", process.env.JWT_SECRET);

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const appointmentRoutes = require("./routes/appointments");
const prescriptionRoutes = require("./routes/prescriptions");
const healthRecordRoutes = require("./routes/healthRecords");
const videoRoutes = require("./routes/video");
const billingRoutes = require("./routes/billing");
const adminRoutes = require("./routes/admin");

const { errorHandler } = require("./middleware/errorHandler");
const { authenticateToken } = require("./middleware/auth");
const { initializeDatabase } = require("./config/database");

const app = express();
const server = createServer(app);

// -----------------------------
// Build allowed origins list
// -----------------------------
const envOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  // common production frontend you mentioned
  "https://telemedicine-platform-sigma.vercel.app",
  // include any env-provided origins
  ...envOrigins,
];

console.log("Allowed CORS origins:", allowedOrigins);

// small helper to validate origin including wildcards for vercel & render preview
function originAllowed(origin) {
  if (!origin) return true; // allow server-to-server (no origin)
  // exact matches
  if (allowedOrigins.includes(origin)) return true;
  // allow Vercel preview domains
  if (origin.endsWith(".vercel.app")) return true;
  // allow Render subdomains like *.onrender.com or render.com
  if (origin.includes(".onrender.com") || origin.includes("render.com")) return true;
  return false;
}

// -----------------------------------------------------
// CORS middleware
// -----------------------------------------------------
app.use(
  cors({
    origin: (origin, callback) => {
      if (originAllowed(origin)) return callback(null, true);
      console.warn("❌ BLOCKED BY CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type, Authorization",
  })
);

// allow preflight for all routes
app.options("*", cors());

// -----------------------------------------------------
// Helmet (disable CSP to avoid blocking websockets/webrtc)
// -----------------------------------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

// -----------------------------------------------------
// Socket.IO server with proper CORS check
// -----------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (originAllowed(origin)) return callback(null, true);
      console.warn("❌ SOCKET.IO REJECT ORIGIN:", origin);
      return callback("Not allowed by CORS");
    },
    credentials: true,
    methods: ["GET", "POST"],
  },
  // Increase pingTimeout if needed for free hosts that sleep
  pingTimeout: 30000,
});

// -----------------------------------------------------
// Rate limiter, parsers, logs, compression
// -----------------------------------------------------
app.set("trust proxy", 1);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("combined"));
app.use(compression());

// Static uploads (if you use)
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -----------------------------------------------------
// Health check
// -----------------------------------------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// -----------------------------------------------------
// API routes
// -----------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/users", authenticateToken, userRoutes);
app.use("/api/appointments", authenticateToken, appointmentRoutes);
app.use("/api/prescriptions", authenticateToken, prescriptionRoutes);
app.use("/api/health-records", authenticateToken, healthRecordRoutes);
app.use("/api/video", authenticateToken, videoRoutes);
app.use("/api/billing", authenticateToken, billingRoutes);
app.use("/api/admin", authenticateToken, adminRoutes);

// -----------------------------------------------------
// Socket.IO auth middleware (JWT in handshake.auth.token)
// -----------------------------------------------------
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided in socket auth"));

    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // attach to socket for later use
    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    return next();
  } catch (err) {
    console.warn("Socket auth error:", err.message || err);
    return next(new Error("Invalid socket auth token"));
  }
});

// -----------------------------------------------------
// Socket.IO events — signaling for WebRTC
// -----------------------------------------------------
io.on("connection", (socket) => {
  console.log(`⚡ Socket connected: ${socket.id} userId=${socket.userId}`);

  // Join a call room
  // payload: { callId: string }
  socket.on("join-call", (payload) => {
    try {
      const callId = payload?.callId;
      if (!callId) return socket.emit("error", { message: "callId required" });

      socket.join(callId);
      console.log(`User ${socket.userId} joined call ${callId}`);

      // notify other participants that a user joined
      socket.to(callId).emit("user-joined", { userId: socket.userId });
    } catch (err) {
      console.error("join-call error:", err);
    }
  });

  // Leave a call room
  // payload: { callId: string }
  socket.on("leave-call", (payload) => {
    try {
      const callId = payload?.callId;
      if (!callId) return;
      socket.leave(callId);
      console.log(`User ${socket.userId} left call ${callId}`);
      socket.to(callId).emit("user-left", { userId: socket.userId });
    } catch (err) {
      console.error("leave-call error:", err);
    }
  });

  // Generic signaling - forward any signal (offer/answer/ice) to other peers in room
  // payload: { callId: string, signal: any }
  socket.on("call-signal", (payload) => {
    try {
      const { callId, signal } = payload || {};
      if (!callId || !signal) return;
      // forward to other peers in the room
      socket.to(callId).emit("call-signal", {
        from: socket.userId,
        signal,
      });
    } catch (err) {
      console.error("call-signal error:", err);
    }
  });

  // Optional: handle ping/health or custom events as needed

  socket.on("disconnect", (reason) => {
    console.log(`❌ Socket disconnected: ${socket.id} userId=${socket.userId} reason=${reason}`);
    // optionally emit user-left to any rooms (Socket.io will remove socket from rooms automatically).
  });
});

// -----------------------------------------------------
// error handler & 404
// -----------------------------------------------------
app.use(errorHandler);

app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// -----------------------------------------------------
// start server
// -----------------------------------------------------
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initializeDatabase();
    console.log("Database connected successfully");

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
