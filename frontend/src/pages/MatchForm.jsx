import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Card, Button, Field, inputClass } from "../components/ui";
import { useToast } from "../components/Toast";

export default function MatchForm() {
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({
    home_team_id: "",
    away_team_id: "",
    venue: "",
    match_date: "",
    match_time: "",
  });
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    api.getTeams().then(setTeams).catch(console.error);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.home_team_id === form.away_team_id) {
      toast.push("Home and away team must be different.", "error");
      return;
    }
    try {
      const match = await api.createMatch(form);
      toast.push("Match created. Captains and referee were added as participants.");
      navigate(`/matches/${match.id}`);
    } catch (err) {
      toast.push(err.message, "error");
    }
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-900 mb-1">Create match</h1>
      <p className="text-stone-500 text-sm mb-6">
        Captains and a default referee slot will be added automatically once you save.
      </p>

      <Card className="p-6">
        <form onSubmit={handleSubmit}>
          <Field label="Home team">
            <select
              className={inputClass}
              value={form.home_team_id}
              onChange={(e) => setForm({ ...form, home_team_id: e.target.value })}
              required
            >
              <option value="">Select a team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Away team">
            <select
              className={inputClass}
              value={form.away_team_id}
              onChange={(e) => setForm({ ...form, away_team_id: e.target.value })}
              required
            >
              <option value="">Select a team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Venue">
            <input
              className={inputClass}
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              placeholder="e.g. Kasarani Stadium, Nairobi"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={form.match_date}
                onChange={(e) => setForm({ ...form, match_date: e.target.value })}
                required
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                className={inputClass}
                value={form.match_time}
                onChange={(e) => setForm({ ...form, match_time: e.target.value })}
                required
              />
            </Field>
          </div>
          <Button type="submit" className="w-full mt-2">Create match</Button>
        </form>
      </Card>

      {teams.length === 0 && (
        <p className="text-sm text-amber-600 mt-4">
          You don't have any teams yet — add teams first so you can pick them here.
        </p>
      )}
    </div>
  );
}
