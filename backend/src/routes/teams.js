import { Router } from "express";
import { db } from "../db/index.js";
import { normalizePhone, isValidPhone } from "../lib/phone.js";

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
    const normalized = normalizePhone(contact.phone);
    if (!isValidPhone(normalized)) {
      return {
        error: `Invalid phone number for ${contact.name}. Please enter a valid number (e.g. +2547XXXXXXXX or 07XXXXXXXX)`,
      };
    }
    contact.phone = normalized;
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
      const normalized = normalizePhone(item.phone);
      insert.run(teamId, item.name, normalized, item.role || "member");
    }
  });
  insertMany(contacts);
}

function syncTeamToUpcomingMatches(teamId) {
  const contacts = getTeamContacts(teamId);
  const matches = db
    .prepare(
      `SELECT id FROM matches
       WHERE status = 'scheduled'
         AND (home_team_id = ? OR away_team_id = ?)`
    )
    .all(teamId, teamId);

  const findByPhone = db.prepare(
    `SELECT id FROM participants
     WHERE match_id = ? AND team_id = ? AND phone = ?`
  );
  const findByNameAndRole = db.prepare(
    `SELECT id FROM participants
     WHERE match_id = ? AND team_id = ? AND name = ? AND role = ?`
  );
  const insertParticipant = db.prepare(
    `INSERT INTO participants (match_id, team_id, name, phone, role)
     VALUES (?, ?, ?, ?, ?)`
  );
  const updateParticipant = db.prepare(
    `UPDATE participants SET name = ?, phone = ?, role = ?, team_id = ? WHERE id = ?`
  );

  for (const match of matches) {
    for (const contact of contacts) {
      const existing = findByPhone.get(match.id, teamId, contact.phone)
        || findByNameAndRole.get(match.id, teamId, contact.name, contact.role);

      if (existing) {
        updateParticipant.run(contact.name, contact.phone, contact.role || "member", teamId, existing.id);
      } else {
        insertParticipant.run(match.id, teamId, contact.name, contact.phone, contact.role || "member");
      }
    }
  }
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
  syncTeamToUpcomingMatches(result.lastInsertRowid);
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
    syncTeamToUpcomingMatches(req.params.id);
  }

  res.json(teamWithContacts(db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM teams WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export default router;
