import { Router } from "express";
import { db } from "../db/index.js";

const router = Router();

function getTeamContacts(teamId) {
  return db
    .prepare("SELECT id, name, phone, role FROM team_contacts WHERE team_id = ? ORDER BY role, name")
    .all(teamId);
}

function teamWithContacts(teamRow) {
  return {
    ...teamRow,
    contacts: getTeamContacts(teamRow.id),
  };
}

function validateContacts(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return { error: "contacts is required and must be a non-empty array" };
  }
  for (const contact of contacts) {
    if (!contact?.name || !contact?.phone) {
      return { error: "Each contact must include name and phone" };
    }
    if (!/^\+\d{10,15}$/.test(contact.phone)) {
      return {
        error: "Each contact phone must be in international format, e.g. +2547XXXXXXXX",
      };
    }
  }
  return null;
}

function pickCaptainContact(contacts) {
  return contacts.find((c) => c.role === "captain") || contacts[0];
}

function insertContacts(teamId, contacts) {
  const insert = db.prepare(
    "INSERT INTO team_contacts (team_id, name, phone, role) VALUES (?, ?, ?, ?)"
  );
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(teamId, item.name, item.phone, item.role || "member");
    }
  });
  insertMany(contacts);
}

router.get("/", (req, res) => {
  const teams = db.prepare("SELECT * FROM teams ORDER BY name").all();
  res.json(teams.map(teamWithContacts));
});

router.get("/:id", (req, res) => {
  const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found" });
  res.json(teamWithContacts(team));
});

router.post("/", (req, res) => {
  const { name, contacts, captain_name, captain_phone } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  let finalContacts = contacts;
  if (!finalContacts || !Array.isArray(finalContacts) || finalContacts.length === 0) {
    if (captain_name && captain_phone) {
      finalContacts = [{ name: captain_name, phone: captain_phone, role: "captain" }];
    }
  }

  const validation = validateContacts(finalContacts);
  if (validation) return res.status(400).json(validation);

  const captain = pickCaptainContact(finalContacts);
  const result = db
    .prepare("INSERT INTO teams (name, captain_name, captain_phone) VALUES (?, ?, ?)")
    .run(name, captain.name, captain.phone);

  insertContacts(result.lastInsertRowid, finalContacts);
  const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(teamWithContacts(team));
});

router.put("/:id", (req, res) => {
  const { name, contacts, captain_name, captain_phone } = req.body;
  const existing = db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Team not found" });

  let finalContacts = contacts;
  if (!finalContacts || !Array.isArray(finalContacts) || finalContacts.length === 0) {
    if (captain_name && captain_phone) {
      finalContacts = [{ name: captain_name, phone: captain_phone, role: "captain" }];
    }
  }

  let captainName = existing.captain_name;
  let captainPhone = existing.captain_phone;
  if (finalContacts) {
    const validation = validateContacts(finalContacts);
    if (validation) return res.status(400).json(validation);
    const captain = pickCaptainContact(finalContacts);
    captainName = captain.name;
    captainPhone = captain.phone;
  }

  db.prepare("UPDATE teams SET name = ?, captain_name = ?, captain_phone = ? WHERE id = ?").run(
    name ?? existing.name,
    captainName,
    captainPhone,
    req.params.id
  );

  if (finalContacts) {
    db.prepare("DELETE FROM team_contacts WHERE team_id = ?").run(req.params.id);
    insertContacts(req.params.id, finalContacts);
  }

  res.json(teamWithContacts(db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM teams WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export default router;
