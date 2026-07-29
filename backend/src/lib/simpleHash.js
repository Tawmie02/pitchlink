// Lightweight salted-hash helper so we don't need a native bcrypt build
// for a hackathon MVP. NOTE: swap for bcrypt/argon2 before any real
// production use — this is intentionally minimal.
import crypto from "crypto";

const SALT = "pitchlink-static-demo-salt"; // fine for a demo; use per-user random salts in prod

function hash(password) {
  return crypto.createHash("sha256").update(SALT + password).digest("hex");
}

function compare(password, hashed) {
  return hash(password) === hashed;
}

export default { hash, compare };
