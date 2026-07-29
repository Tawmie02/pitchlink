import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function hashPasswordSync(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export async function comparePassword(password, hashed) {
  return bcrypt.compare(password, hashed);
}

export function comparePasswordSync(password, hashed) {
  return bcrypt.compareSync(password, hashed);
}

export default {
  hash: hashPasswordSync,
  compare: comparePasswordSync,
};
