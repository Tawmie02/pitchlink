import { Router } from "express";
import { db } from "../db/index.js";

const router = Router();

router.get("/", (req, res) => {
  const teams = db.prepare("SELECT * FROM teams ORDER BY name").all();
  res.json(teams);
});

router.get("/:id", (req, res) => {
  const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found" });
  res.json(team);
});

router.post("/", (req, res) => {
  const { name, captain_name, captain_phone } = req.body;
  if (!name || !captain_name || !captain_phone) {
    return res.status(400).json({ error: "name, captain_name, captain_phone are required" });
  }
  if (!/^\+\d{10,15}$/.test(captain_phone)) {
    return res.status(400).json({
      error: "captain_phone must be in international format, e.g. +2547XXXXXXXX",
    });
  }
  const result = db
    .prepare("INSERT INTO teams (name, captain_name, captain_phone) VALUES (?, ?, ?)")
    .run(name, captain_name, captain_phone);
  const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(team);
});

router.put("/:id", (req, res) => {
  const { name, captain_name, captain_phone } = req.body;
  const existing = db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Team not found" });

  db.prepare(
    "UPDATE teams SET name = ?, captain_name = ?, captain_phone = ? WHERE id = ?"
  ).run(
    name ?? existing.name,
    captain_name ?? existing.captain_name,
    captain_phone ?? existing.captain_phone,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM teams WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export default router;
