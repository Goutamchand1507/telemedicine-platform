// -----------------------------
// Environment Debug
// -----------------------------
console.log("🔐 Loaded JWT_SECRET:", process.env.JWT_SECRET);
console.log("🔌 DATABASE_URL exists:", !!process.env.DATABASE_URL);
console.log("NODE_ENV:", process.env.NODE_ENV);

// DO NOT USE dotenv ON RAILWAY
// require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
const { Server } = require("socket.io");

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

const path = require("path");

const app = express();
const server = createServer(app);

// -----------------------------
// Allowed origins
// -----------------------------
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://telemedicine-platform-sigma.vercel.app"
];

function originAllowed(origin) {
  if (!origin) return true; // mobile apps / tools
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true;
  if (origin.includes(".railway.app")) return true;
  if (origin.includes(".onrender.com")) return true;
  return false;
}

console.log("🌍 Allowed origins:", allowedOrigins);

// -----------------------------
// CORS
// -----------------------------
app.use(
  cors({
    origin: (origin, callback) => {
      if (originAllowed(origin)) return callback(null, true);
      console.log("❌ BLOCKED BY CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type, Authorization",
  })
);

app.options("*", cors());

// -----------------------------
// Helmet for WebRTC
// -----------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

// -----------------------------
// Socket.IO — POLLING ONLY (Railway safe mode)
// -----------------------------
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (originAllowed(origin)) return callback(null, true);
      console.log("❌ SOCKET BLOCKED:", origin);
      return callback("Not allowed by CORS");
    },
    credentials: true,
  },
  transports: ["polling"], // Railway does NOT support websocket upgrade
  upgrade: false,
  pingTimeout: 30000,
});

// -----------------------------
// Express Middlewares
// -----------------------------
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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -----------------------------
// Health Check
// -----------------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    server: "running",
    time: new Date().toISOString(),
  });
});

// -----------------------------
// API Routes
// -----------------------------
app.use("/api/auth", authRoutes);
app.use("/api/users", authenticateToken, userRoutes);
app.use("/api/appointments", authenticateToken, appointmentRoutes);
app.use("/api/prescriptions", authenticateToken, prescriptionRoutes);
app.use("/api/health-records", authenticateToken, healthRecordRoutes);
app.use("/api/video", authenticateToken, videoRoutes);
app.use("/api/billing", authenticateToken, billingRoutes);
app.use("/api/admin", authenticateToken, adminRoutes);

// -----------------------------
// Socket.IO Authentication
// -----------------------------
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    next();
  } catch (err) {
    console.log("❌ Socket Auth Failed:", err.message);
    next(new Error("Invalid token"));
  }
});

// -----------------------------
// WebRTC Signaling
// -----------------------------
io.on("connection", (socket) => {
  console.log("⚡ Socket Connected:", socket.id, "| User:", socket.userId);

  socket.on("join-call", ({ callId }) => {
    socket.join(callId);
    socket.to(callId).emit("user-joined", { userId: socket.userId });
  });

  socket.on("leave-call", ({ callId }) => {
    socket.leave(callId);
    socket.to(callId).emit("user-left", { userId: socket.userId });
  });

  socket.on("call-signal", ({ callId, signal }) => {
    socket.to(callId).emit("call-signal", {
      from: socket.userId,
      signal,
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// -----------------------------
// Error Handler
// -----------------------------
app.use(errorHandler);

app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// -----------------------------
// Start Server
// -----------------------------
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log("🚀 Initializing Database…");
    await initializeDatabase();

    console.log("📦 Database connected successfully");

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
