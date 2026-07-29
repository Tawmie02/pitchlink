import bcryptImport from "../lib/simpleHash.js";
import { db } from "./index.js";

// Wipe existing demo data (keeps schema)
db.exec(`
DELETE FROM messages;
DELETE FROM participants;
DELETE FROM team_contacts;
DELETE FROM matches;
DELETE FROM teams;
DELETE FROM users;
DELETE FROM ussd_sessions;
`);

const insertUser = db.prepare(
  "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
);
insertUser.run("Demo Organizer", "organizer@pitchlink.dev", bcryptImport.hash("password123"));

const insertTeam = db.prepare(
  "INSERT INTO teams (name, captain_name, captain_phone) VALUES (?, ?, ?)"
);
const insertTeamContact = db.prepare(
  "INSERT INTO team_contacts (team_id, name, phone, role) VALUES (?, ?, ?, ?)"
);
const teams = [
  ["Nairobi Rangers FC", "Brian Otieno", "+254711000001", [
    ["Brian Otieno", "+254711000001", "captain"],
    ["Samuel Mwangi", "+254711000010", "manager"],
    ["Esther Njeri", "+254711000011", "member"],
  ]],
  ["Kisumu Warriors", "Faith Achieng", "+254711000002", [
    ["Faith Achieng", "+254711000002", "captain"],
    ["Peter Oloo", "+254711000012", "coach"],
    ["Jane Auma", "+254711000013", "member"],
  ]],
  ["Mombasa Tigers", "Ali Hassan", "+254711000003", [
    ["Ali Hassan", "+254711000003", "captain"],
    ["Mary Wambui", "+254711000014", "member"],
  ]],
  ["Eldoret Eagles", "Grace Chebet", "+254711000004", [
    ["Grace Chebet", "+254711000004", "captain"],
    ["Michael Kamau", "+254711000015", "member"],
  ]],
  ["Nakuru Panthers", "Kevin Kiptoo", "+254711000005", [
    ["Kevin Kiptoo", "+254711000005", "captain"],
    ["Susan Kiplagat", "+254711000016", "member"],
  ]],
];
const teamIds = teams.map((t) => insertTeam.run(t[0], t[1], t[2]).lastInsertRowid);
teams.forEach((team, index) => {
  const contacts = team[3] || [[team[1], team[2], "captain"]];
  const teamId = teamIds[index];
  contacts.forEach(([name, phone, role]) => {
    insertTeamContact.run(teamId, name, phone, role);
  });
});

const insertMatch = db.prepare(
  `INSERT INTO matches (home_team_id, away_team_id, venue, match_date, match_time, status)
   VALUES (?, ?, ?, ?, ?, ?)`
);

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const inDays = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const matchRows = [
  [teamIds[0], teamIds[1], "Kasarani Stadium, Nairobi", inDays(0), "16:00", "scheduled"],
  [teamIds[2], teamIds[3], "Moi International Grounds", inDays(0), "18:30", "scheduled"],
  [teamIds[4], teamIds[0], "Nakuru ASK Grounds", inDays(2), "15:00", "scheduled"],
  [teamIds[1], teamIds[4], "Kisumu Social Ground", inDays(5), "14:00", "scheduled"],
];
const matchIds = matchRows.map((m) => insertMatch.run(...m).lastInsertRowid);

const insertParticipant = db.prepare(
  `INSERT INTO participants (match_id, team_id, name, phone, role, status, responded_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const insertMessage = db.prepare(
  `INSERT INTO messages (match_id, participant_id, channel, direction, body, status, created_at)
   VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))`
);

const statusCycle = ["confirmed", "pending", "declined", "confirmed"];
matchIds.forEach((matchId, i) => {
  const [homeTeamId, awayTeamId] = matchRows[i];
  const homeTeam = teams[teamIds.indexOf(homeTeamId)];
  const awayTeam = teams[teamIds.indexOf(awayTeamId)];

  const p1 = insertParticipant.run(
    matchId, homeTeamId, homeTeam[1], homeTeam[2], "captain",
    statusCycle[i % statusCycle.length],
    statusCycle[i % statusCycle.length] !== "pending" ? new Date().toISOString() : null
  ).lastInsertRowid;

  const p2 = insertParticipant.run(
    matchId, awayTeamId, awayTeam[1], awayTeam[2], "captain",
    statusCycle[(i + 1) % statusCycle.length],
    statusCycle[(i + 1) % statusCycle.length] !== "pending" ? new Date().toISOString() : null
  ).lastInsertRowid;

  const p3 = insertParticipant.run(
    matchId, null, "Referee James Mwangi", "+254722000099", "referee",
    "confirmed", new Date().toISOString()
  ).lastInsertRowid;

  insertMessage.run(
    matchId, p1, "sms", "outbound",
    `Match reminder: ${homeTeam[0]} vs ${awayTeam[0]} at ${matchRows[i][2]} on ${matchRows[i][3]} ${matchRows[i][4]}. Reply CONFIRM/DECLINE. -- Powered by Java House Nairobi`,
    "sent", `-${(i + 1) * 3} hours`
  );
  insertMessage.run(
    matchId, p2, "sms", "outbound",
    `Match reminder: ${homeTeam[0]} vs ${awayTeam[0]} at ${matchRows[i][2]} on ${matchRows[i][3]} ${matchRows[i][4]}. Reply CONFIRM/DECLINE. -- Powered by Java House Nairobi`,
    "sent", `-${(i + 1) * 3} hours`
  );
});

console.log("Seed complete:");
console.log(`  users: 1 (organizer@pitchlink.dev / password123)`);
console.log(`  teams: ${teamIds.length}`);
console.log(`  matches: ${matchIds.length}`);
