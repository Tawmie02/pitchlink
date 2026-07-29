import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, MapPin, Calendar } from "lucide-react";
import { api } from "../lib/api";
import { Card, Badge, statusTone } from "../components/ui";
import { useToast } from "../components/Toast";

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    api
      .getMatches()
      .then(setMatches)
      .catch((err) => {
        toast.push(err.message || "Failed to load matches", "error");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Matches</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-0.5">Schedule fixtures and manage match-day notifications.</p>
        </div>
        <Link
          to="/matches/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-pitch-600 text-white hover:bg-pitch-700 dark:bg-pitch-500 dark:hover:bg-pitch-600 shadow-soft transition-colors"
        >
          <Plus className="w-4 h-4" /> Create match
        </Link>
      </div>

      {loading ? (
        <div className="text-stone-400 dark:text-stone-500 text-sm py-8">Loading matches...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((m) => (
            <Link key={m.id} to={`/matches/${m.id}`}>
              <Card className="p-5 hover:border-pitch-300 dark:hover:border-pitch-700 transition-all hover:shadow-card h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="font-semibold text-stone-900 dark:text-stone-100">
                    {m.home_team_name} <span className="text-stone-400 dark:text-stone-500 font-normal">vs</span> {m.away_team_name}
                  </div>
                  <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                </div>
                <div className="flex flex-col gap-1.5 text-sm text-stone-500 dark:text-stone-400">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> {m.match_date} at {m.match_time}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {m.venue}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
          {matches.length === 0 && (
            <p className="text-stone-400 dark:text-stone-500 text-sm col-span-2 py-8 text-center">No matches yet — create your first fixture.</p>
          )}
        </div>
      )}
    </div>
  );
}
