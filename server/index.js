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

// =======================================
// ⭐ FIXED CORS FOR VERCEL + ALL PREVIEWS
// =======================================

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://telemedicine-platform-sigma.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Allow server-to-server

      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") // Allow ALL Vercel preview URLs
      ) {
        return callback(null, true);
      }

      console.log("❌ BLOCKED BY CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type, Authorization",
  })
);

// Fix OPTIONS (preflight) request issue
app.options("*", cors());

// ===========================================
// ⭐ FIXED HELMET (no CSP conflict with CORS)
// ===========================================

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Disable CSP or it blocks CORS
  })
);

// ==========================
// Socket.IO Server
// ==========================

const io = new Server(server, {
  cors: {
    origin: [...allowedOrigins, "https://*.vercel.app"],
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// ==========================
// Rate Limiter
// ==========================

app.set("trust proxy", 1);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  })
);

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging & compression
app.use(morgan("combined"));
app.use(compression());

// Static uploads
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==========================
// Health Check
// ==========================

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ==========================
// API ROUTES
// ==========================

app.use("/api/auth", authRoutes);
app.use("/api/users", authenticateToken, userRoutes);
app.use("/api/appointments", authenticateToken, appointmentRoutes);
app.use("/api/prescriptions", authenticateToken, prescriptionRoutes);
app.use("/api/health-records", authenticateToken, healthRecordRoutes);
app.use("/api/video", authenticateToken, videoRoutes);
app.use("/api/billing", authenticateToken, billingRoutes);
app.use("/api/admin", authenticateToken, adminRoutes);

// ==========================
// SOCKET.IO EVENTS
// ==========================

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("No token"));

  const jwt = require("jsonwebtoken");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.userId);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.userId);
  });
});

// ==========================
// Error Handlers
// ==========================
app.use(errorHandler);

app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ==========================
// START SERVER
// ==========================

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
