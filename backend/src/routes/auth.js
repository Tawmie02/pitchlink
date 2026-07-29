import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/index.js";
import passwordHelper from "../lib/password.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

if (!process.env.JWT_SECRET) {
  console.warn("[SECURITY WARNING] JWT_SECRET is not set in environment. Using default fallback secret.");
}

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !passwordHelper.compare(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export default router;
