import React from "react";
import { X } from "lucide-react";

export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-soft transition-colors ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "stone" }) {
  const tones = {
    stone: "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300",
    green: "bg-pitch-100 dark:bg-pitch-950/80 text-pitch-700 dark:text-pitch-300 border border-pitch-200/50 dark:border-pitch-800/50",
    amber: "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50",
    red: "bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200/50 dark:border-red-800/50",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(status) {
  if (status === "confirmed" || status === "scheduled" || status === "sent" || status === "delivered") return "green";
  if (status === "pending" || status === "simulated" || status === "queued") return "amber";
  if (status === "declined" || status === "cancelled" || status === "failed") return "red";
  return "stone";
}

export function ProgressBar({ confirmed, pending, declined }) {
  const total = confirmed + pending + declined || 1;
  return (
    <div className="w-full h-2.5 rounded-full overflow-hidden bg-stone-100 dark:bg-stone-800 flex">
      <div className="bg-pitch-500 h-full transition-all duration-300" style={{ width: `${(confirmed / total) * 100}%` }} />
      <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${(pending / total) * 100}%` }} />
      <div className="bg-red-400 h-full transition-all duration-300" style={{ width: `${(declined / total) * 100}%` }} />
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "bg-pitch-600 text-white hover:bg-pitch-700 dark:bg-pitch-500 dark:hover:bg-pitch-600 shadow-soft",
    secondary: "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700",
    danger: "bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800",
    ghost: "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-stone-900 rounded-2xl shadow-card border border-stone-200 dark:border-stone-800 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:border-pitch-400 focus:ring-1 focus:ring-pitch-400 outline-none transition";
