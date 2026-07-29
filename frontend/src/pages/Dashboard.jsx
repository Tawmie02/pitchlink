import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock, MessageSquareText, CheckCircle2, Clock3, Plus, Send, ShieldAlert, Whistle } from "lucide-react";
import { api, clearToken } from "../lib/api";
import { Card, Badge, statusTone } from "../components/ui";

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">{value}</div>
      <div className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{label}</div>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setError("");
    api
      .getStats()
      .then(setStats)
      .catch((err) => {
        if (err.status === 401) {
          clearToken();
          navigate("/login");
          return;
        }
        setError(err.message || "Failed to load dashboard.");
      });
  }, []);

  if (error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Card className="p-6 border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/40">
          <h1 className="text-xl font-bold text-red-900 dark:text-red-200 mb-2">Dashboard unavailable</h1>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">{error}</p>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 rounded-lg bg-pitch-600 text-white text-sm font-medium hover:bg-pitch-700"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            <Link className="px-4 py-2 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm font-medium text-stone-700 dark:text-stone-200" to="/teams">
              Open Teams
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return <div className="p-8 text-stone-400 dark:text-stone-500 text-sm">Loading dashboard...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Dashboard</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-0.5">Here's what's happening across your tournament.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/teams" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
            <Plus className="w-4 h-4" /> Add team
          </Link>
          <Link to="/matches/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-pitch-600 text-white hover:bg-pitch-700 dark:bg-pitch-500 dark:hover:bg-pitch-600 shadow-soft transition-colors">
            <Plus className="w-4 h-4" /> Create match
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={CalendarClock} label="Upcoming matches" value={stats.upcoming} tone="bg-pitch-100 dark:bg-pitch-950 text-pitch-700 dark:text-pitch-300" />
        <StatCard icon={MessageSquareText} label="SMS sent" value={stats.smsSent} tone="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300" />
        <StatCard icon={CheckCircle2} label="Confirmed responses" value={stats.confirmed} tone="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300" />
        <StatCard icon={Clock3} label="Pending responses" value={stats.pending} tone="bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Today's matches</h2>
          {stats.todaysMatches.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500">No matches scheduled today.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.todaysMatches.map((m) => (
                <Link
                  key={m.id}
                  to={`/matches/${m.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-800 hover:border-pitch-200 dark:hover:border-pitch-700 hover:bg-pitch-50/50 dark:hover:bg-pitch-950/30 transition-colors"
                >
                  <div>
                    <div className="font-medium text-stone-800 dark:text-stone-200 text-sm">
                      {m.home_team_name} <span className="text-stone-400 dark:text-stone-500 font-normal">vs</span> {m.away_team_name}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{m.venue} &middot; {m.match_time}</div>
                  </div>
                  <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          {/* Referee & Officiating Status Card */}
          <Card className="p-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-3 flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-pitch-600 dark:text-pitch-400" /> Referee Coverage
            </h2>
            <div className="p-3 bg-pitch-50/60 dark:bg-pitch-950/40 rounded-xl border border-pitch-200/60 dark:border-pitch-800/60 text-xs space-y-1.5">
              <div className="font-medium text-pitch-900 dark:text-pitch-200 flex items-center justify-between">
                <span>Officiating Team</span>
                <Badge tone="green">Covered</Badge>
              </div>
              <p className="text-pitch-700 dark:text-pitch-300">
                Primary Referees & Linesmen (Assistant Referees) are auto-assigned to every fixture.
              </p>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2 text-sm">
              <Send className="w-4 h-4 text-pitch-600 dark:text-pitch-400" /> Recent activity
            </h2>
            <div className="flex flex-col gap-3 max-h-60 overflow-y-auto">
              {stats.recentActivity.length === 0 && (
                <p className="text-sm text-stone-400 dark:text-stone-500">No messages sent yet.</p>
              )}
              {stats.recentActivity.map((a) => (
                <div key={a.id} className="text-sm border-b border-stone-100 dark:border-stone-800 pb-2.5 last:border-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge tone={statusTone(a.status)}>{a.channel.toUpperCase()}</Badge>
                    <span className="text-xs text-stone-400 dark:text-stone-500">{a.direction}</span>
                  </div>
                  <p className="text-stone-600 dark:text-stone-300 text-xs line-clamp-2">{a.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
