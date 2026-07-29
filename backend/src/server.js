import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRoutes, { requireAuth } from "./routes/auth.js";
import teamRoutes from "./routes/teams.js";
import matchRoutes from "./routes/matches.js";
import ussdRoutes from "./routes/ussd.js";
import voiceRoutes from "./routes/voice.js";
import { isLiveMode } from "./services/africastalking.js";

const app = express();

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
app.use("/api/ussd", ussdRoutes);
app.use("/api/voice", voiceRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n🏟️  PitchLink backend running on http://localhost:${PORT}`);
  console.log(`   Africa's Talking mode: ${isLiveMode ? "LIVE (sandbox)" : "MOCK (no API key set)"}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
