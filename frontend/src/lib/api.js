const BASE = "/api";

function getToken() {
  return localStorage.getItem("pitchlink_token");
}

async function request(path, options = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    const error = new Error("Network connection error. Please check backend server status.");
    error.status = 0;
    throw error;
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.payload = data;
    throw error;
  }
  return data;
}

export const api = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),

  getStats: () => request("/matches/stats/summary"),

  getMatches: () => request("/matches"),
  getMatch: (id) => request(`/matches/${id}`),
  createMatch: (payload) => request("/matches", { method: "POST", body: payload }),
  updateMatch: (id, payload) => request(`/matches/${id}`, { method: "PUT", body: payload }),
  deleteMatch: (id) => request(`/matches/${id}`, { method: "DELETE" }),
  notifyMatch: (id, message, participantId) =>
    request(`/matches/${id}/notify`, { method: "POST", body: { message, participant_id: participantId } }),
  cancelAlert: (id, reason) => request(`/matches/${id}/cancel-alert`, { method: "POST", body: { reason } }),
  simulateReply: (matchId, participantId, status) =>
    request(`/matches/${matchId}/participants/${participantId}/simulate-reply`, {
      method: "POST",
      body: { status },
    }),

  getTeams: () => request("/teams"),
  createTeam: (payload) => request("/teams", { method: "POST", body: payload }),
  updateTeam: (id, payload) => request(`/teams/${id}`, { method: "PUT", body: payload }),
  deleteTeam: (id) => request(`/teams/${id}`, { method: "DELETE" }),
};

export function setToken(token) {
  localStorage.setItem("pitchlink_token", token);
}
export function clearToken() {
  localStorage.removeItem("pitchlink_token");
}
export { getToken };
