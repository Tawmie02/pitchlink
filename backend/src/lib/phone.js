/**
 * Formats a phone number to standard E.164 string (+2547XXXXXXXX).
 * Defaults to Kenya (+254) for 9-digit or 10-digit local numbers starting with 07 or 01.
 * @param {string} phone
 * @returns {string} E.164 formatted string
 */
export function normalizePhone(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[\s\-\(\)\.]/g, "");
  
  if (cleaned.startsWith("07") && cleaned.length === 10) {
    cleaned = "+254" + cleaned.slice(1);
  } else if (cleaned.startsWith("01") && cleaned.length === 10) {
    cleaned = "+254" + cleaned.slice(1);
  } else if (cleaned.startsWith("254") && cleaned.length === 12) {
    cleaned = "+" + cleaned;
  } else if (!cleaned.startsWith("+") && /^\d{10,15}$/.test(cleaned)) {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

export function isValidPhone(phone) {
  const normalized = normalizePhone(phone);
  return /^\+\d{10,15}$/.test(normalized);
}

export default { normalizePhone, isValidPhone };
