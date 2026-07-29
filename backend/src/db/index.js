import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "pitchlink.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  captain_name TEXT NOT NULL,
  captain_phone TEXT NOT NULL, -- E.164 format e.g. +2547XXXXXXXX
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- captain | member | coach | manager | stakeholder
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  home_team_id INTEGER NOT NULL REFERENCES teams(id),
  away_team_id INTEGER NOT NULL REFERENCES teams(id),
  venue TEXT NOT NULL,
  match_date TEXT NOT NULL, -- ISO date
  match_time TEXT NOT NULL, -- HH:MM
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | cancelled | completed
  created_at TEXT DEFAULT (datetime('now'))
);

-- One row per phone number we need a response from for a given match
-- (captains of both teams, referee, etc.)
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'captain', -- captain | referee
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | declined
  responded_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  participant_id INTEGER REFERENCES participants(id),
  channel TEXT NOT NULL, -- sms | voice | ussd
  direction TEXT NOT NULL, -- outbound | inbound
  body TEXT,
  status TEXT DEFAULT 'sent', -- sent | failed | simulated | delivered
  provider_ref TEXT, -- Africa's Talking messageId / sessionId
  created_at TEXT DEFAULT (datetime('now'))
);

-- Tracks in-progress USSD sessions (menu state machine)
CREATE TABLE IF NOT EXISTS ussd_sessions (
  session_id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  step TEXT NOT NULL DEFAULT 'root',
  match_id INTEGER,
  updated_at TEXT DEFAULT (datetime('now'))
);
`);

export default db;
