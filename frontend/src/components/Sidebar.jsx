import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Users, LogOut, Radio } from "lucide-react";
import { clearToken } from "../lib/api";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/matches", label: "Matches", icon: CalendarDays },
  { to: "/teams", label: "Teams", icon: Users },
];

export default function Sidebar() {
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  return (
    <aside className="w-64 shrink-0 bg-pitch-950 text-pitch-50 flex flex-col h-screen sticky top-0">
      <div className="px-6 py-6 flex items-center gap-2.5 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-pitch-500 flex items-center justify-center font-bold text-pitch-950">
          P
        </div>
        <div>
          <div className="font-bold text-lg leading-none">PitchLink</div>
          <div className="text-xs text-pitch-300 mt-0.5">Match-day comms</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 flex flex-col gap-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-pitch-500 text-pitch-950"
                  : "text-pitch-100 hover:bg-white/5"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-3">
        <div className="rounded-lg bg-white/5 px-3 py-2.5 mb-2 text-xs text-pitch-200 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-pitch-400" />
          Africa's Talking: sandbox
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-pitch-100 hover:bg-white/5 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
