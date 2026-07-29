// ============================================================
// AFRICA'S TALKING INTEGRATION POINT: USSD webhook
// ============================================================
// >>> This endpoint must be PUBLICLY reachable for AT to call it.
// >>> Register its full public URL in your AT Sandbox dashboard:
//       Sandbox app -> USSD -> your channel -> "Callback URL"
//       e.g. https://<your-ngrok-subdomain>.ngrok-free.app/api/ussd
// >>> Test it live with the AT Simulator:
//       https://developers.africastalking.com/simulator
//     (enter your sandbox USSD service code, e.g. *384*00000#)
//
// AT sends application/x-www-form-urlencoded POST body with:
//   sessionId, serviceCode, phoneNumber, text
// `text` accumulates every input the user has typed this session,
// separated by "*". e.g. after choosing menu 1 then match 2, text = "1*2"
//
// Response MUST be plain text (Content-Type: text/plain) starting with:
//   "CON " -> keep session open, show more menu
//   "END "  -> close session
// ============================================================

import { Router } from "express";
import { db } from "../db/index.js";

const router = Router();

router.post("/", (req, res) => {
  const { sessionId, phoneNumber, text = "" } = req.body;
  res.set("Content-Type", "text/plain");

  const inputs = text.split("*").filter(Boolean);
  const level = inputs.length;

  try {
    // Level 0: root menu
    if (level === 0) {
      return res.send(
        "CON Welcome to PitchLink\n" +
          "1. View my upcoming matches\n" +
          "2. Confirm attendance\n" +
          "3. Help"
      );
    }

    const upcomingForPhone = () =>
      db
        .prepare(
          `SELECT m.id, m.match_date, m.match_time, m.venue,
                  ht.name AS home_team_name, at.name AS away_team_name
           FROM participants p
           JOIN matches m ON m.id = p.match_id
           JOIN teams ht ON ht.id = m.home_team_id
           JOIN teams at ON at.id = m.away_team_id
           WHERE p.phone = ? AND m.status = 'scheduled'
           ORDER BY m.match_date, m.match_time`
        )
        .all(phoneNumber);

    // ---- Option 1: View upcoming matches (read-only, ends session) ----
    if (inputs[0] === "1") {
      const matches = upcomingForPhone();
      if (matches.length === 0) {
        return res.send("END You have no upcoming matches.");
      }
      const lines = matches
        .map((m, i) => `${i + 1}. ${m.home_team_name} vs ${m.away_team_name} - ${m.match_date} ${m.match_time}`)
        .join("\n");
      return res.send(`END Your upcoming matches:\n${lines}`);
    }

    // ---- Option 2: Confirm attendance (multi-step) ----
    if (inputs[0] === "2") {
      const matches = upcomingForPhone();
      if (matches.length === 0) {
        return res.send("END You have no upcoming matches to confirm.");
      }

      // Step: choose which match
      if (level === 1) {
        const lines = matches
          .map((m, i) => `${i + 1}. ${m.home_team_name} vs ${m.away_team_name} (${m.match_date})`)
          .join("\n");
        return res.send(`CON Select a match:\n${lines}`);
      }

      // Step: choose confirm/decline for the selected match
      const matchIndex = parseInt(inputs[1], 10) - 1;
      const selectedMatch = matches[matchIndex];
      if (!selectedMatch) {
        return res.send("END Invalid selection. Please dial in again.");
      }

      if (level === 2) {
        return res.send(
          `CON ${selectedMatch.home_team_name} vs ${selectedMatch.away_team_name}\n` +
            "1. Confirm attendance\n" +
            "2. Decline"
        );
      }

      if (level === 3) {
        const choice = inputs[2];
        const newStatus = choice === "1" ? "confirmed" : choice === "2" ? "declined" : null;
        if (!newStatus) return res.send("END Invalid choice.");

        const participant = db
          .prepare("SELECT * FROM participants WHERE match_id = ? AND phone = ?")
          .get(selectedMatch.id, phoneNumber);

        if (participant) {
          db.prepare(
            "UPDATE participants SET status = ?, responded_at = datetime('now') WHERE id = ?"
          ).run(newStatus, participant.id);

          db.prepare(
            `INSERT INTO messages (match_id, participant_id, channel, direction, body, status, provider_ref)
             VALUES (?, ?, 'ussd', 'inbound', ?, 'received', ?)`
          ).run(selectedMatch.id, participant.id, `USSD reply: ${newStatus}`, sessionId);
        }

        return res.send(
          newStatus === "confirmed"
            ? "END Thanks! Your attendance has been confirmed."
            : "END Noted. You've declined this match."
        );
      }
    }

    // ---- Option 3: Help ----
    if (inputs[0] === "3") {
      return res.send("END PitchLink connects grassroots teams to match-day updates via SMS, USSD and voice calls. For support, contact your tournament organizer.");
    }

    return res.send("END Invalid option.");
  } catch (err) {
    console.error("[USSD] error:", err);
    return res.send("END Sorry, something went wrong. Please try again later.");
  }
});

export default router;
