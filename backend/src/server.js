import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import authRoutes, { requireAuth } from "./routes/auth.js";
import teamRoutes from "./routes/teams.js";
import matchRoutes from "./routes/matches.js";
import smsRoutes from "./routes/sms.js";
import ussdRoutes from "./routes/ussd.js";
import voiceRoutes from "./routes/voice.js";
import { isLiveMode } from "./services/africastalking.js";

const app = express();
const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phoneNumber || req.body?.from || ipKeyGenerator(req.ip),
  message: "Too many requests. Please try again shortly.",
});

app.use(cors());
app.use(morgan("dev"));
// AT sends form-urlencoded for USSD/Voice callbacks; JSON for our own frontend
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, africasTalkingMode: isLiveMode ? "live-sandbox" : "mock" });
});

app.use("/api/auth", authRoutes);
app.use("/api/teams", requireAuth, teamRoutes);
app.use("/api/matches", requireAuth, matchRoutes);

// Public webhooks — Africa's Talking calls these directly, no JWT available
app.use("/api/sms", webhookRateLimit, smsRoutes);
app.use("/api/ussd", webhookRateLimit, ussdRoutes);
app.use("/api/voice", voiceRoutes);

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]", req.method, req.path, err);

  if (req.path.startsWith("/api/ussd")) {
    res.set("Content-Type", "text/plain");
    return res.status(200).send("END System error occurred. Please try again later.");
  }
  if (req.path.startsWith("/api/voice")) {
    res.set("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">System error occurred. Please try again later.</Say>
</Response>`);
  }
  if (req.path.startsWith("/api/sms")) {
    res.set("Content-Type", "text/plain");
    return res.status(200).send("OK");
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n🏟️  PitchLink backend running on http://localhost:${PORT}`);
  console.log(`   Africa's Talking mode: ${isLiveMode ? "LIVE (sandbox)" : "MOCK (no API key set)"}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
