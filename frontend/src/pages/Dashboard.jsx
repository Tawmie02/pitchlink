import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, MessageSquareText, CheckCircle2, Clock3, Plus, Send } from "lucide-react";
import { api } from "../lib/api";
import { Card, Badge, statusTone } from "../components/ui";

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-stone-900">{value}</div>
      <div className="text-sm text-stone-500 mt-0.5">{label}</div>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
  }, []);

  if (!stats) {
    return <div className="p-8 text-stone-400 text-sm">Loading dashboard...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
          <p className="text-stone-500 text-sm mt-0.5">Here's what's happening across your tournament.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/teams" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-stone-200 hover:bg-stone-50">
            <Plus className="w-4 h-4" /> Add team
          </Link>
          <Link to="/matches/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-pitch-600 text-white hover:bg-pitch-700 shadow-soft">
            <Plus className="w-4 h-4" /> Create match
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={CalendarClock} label="Upcoming matches" value={stats.upcoming} tone="bg-pitch-100 text-pitch-700" />
        <StatCard icon={MessageSquareText} label="SMS sent" value={stats.smsSent} tone="bg-blue-100 text-blue-700" />
        <StatCard icon={CheckCircle2} label="Confirmed responses" value={stats.confirmed} tone="bg-green-100 text-green-700" />
        <StatCard icon={Clock3} label="Pending responses" value={stats.pending} tone="bg-amber-100 text-amber-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h2 className="font-semibold text-stone-900 mb-4">Today's matches</h2>
          {stats.todaysMatches.length === 0 ? (
            <p className="text-sm text-stone-400">No matches scheduled today.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.todaysMatches.map((m) => (
                <Link
                  key={m.id}
                  to={`/matches/${m.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-stone-100 hover:border-pitch-200 hover:bg-pitch-50/50 transition-colors"
                >
                  <div>
                    <div className="font-medium text-stone-800 text-sm">
                      {m.home_team_name} <span className="text-stone-400">vs</span> {m.away_team_name}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">{m.venue} &middot; {m.match_time}</div>
                  </div>
                  <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-pitch-600" /> Recent activity
          </h2>
          <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
            {stats.recentActivity.length === 0 && (
              <p className="text-sm text-stone-400">No messages sent yet.</p>
            )}
            {stats.recentActivity.map((a) => (
              <div key={a.id} className="text-sm border-b border-stone-100 pb-2.5 last:border-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge tone={statusTone(a.status)}>{a.channel.toUpperCase()}</Badge>
                  <span className="text-xs text-stone-400">{a.direction}</span>
                </div>
                <p className="text-stone-600 text-xs line-clamp-2">{a.body}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
