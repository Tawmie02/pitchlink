import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Calendar, Send, PhoneCall, CheckCircle2, XCircle, Clock3 } from "lucide-react";
import { api } from "../lib/api";
import { Card, Badge, statusTone, ProgressBar, Button, Modal, Field, inputClass } from "../components/ui";
import { useToast } from "../components/Toast";

export default function MatchDetail() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("heavy rain forecast");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  function load() {
    api.getMatch(id).then(setMatch).catch(console.error);
  }
  useEffect(load, [id]);

  if (!match) return <div className="p-8 text-stone-400 text-sm">Loading match...</div>;

  const confirmed = match.participants.filter((p) => p.status === "confirmed").length;
  const pending = match.participants.filter((p) => p.status === "pending").length;
  const declined = match.participants.filter((p) => p.status === "declined").length;

  async function handleSimulate(participantId, status) {
    try {
      await api.simulateReply(match.id, participantId, status);
      toast.push(`Marked as ${status}.`);
      load();
    } catch (err) {
      toast.push(err.message, "error");
    }
  }

  async function handleNotify() {
    setBusy(true);
    try {
      const res = await api.notifyMatch(match.id, notifyMessage || undefined);
      toast.push(`SMS sent to ${res.sent} recipient${res.sent === 1 ? "" : "s"} via Africa's Talking.`);
      setNotifyModalOpen(false);
      setNotifyMessage("");
      load();
    } catch (err) {
      toast.push(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelAlert() {
    setBusy(true);
    try {
      const res = await api.cancelAlert(match.id, cancelReason);
      toast.push(`Cancellation voice alert placed to ${res.called} number${res.called === 1 ? "" : "s"}.`);
      setCancelModalOpen(false);
      load();
    } catch (err) {
      toast.push(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-stone-900">
              {match.home_team_name} <span className="text-stone-400 font-normal">vs</span> {match.away_team_name}
            </h1>
            <Badge tone={statusTone(match.status)}>{match.status}</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-stone-500">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {match.match_date} at {match.match_time}</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {match.venue}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={() => setNotifyModalOpen(true)}>
            <Send className="w-4 h-4" /> Send update
          </Button>
          <Button
            variant="danger"
            onClick={() => setCancelModalOpen(true)}
            disabled={match.status === "cancelled"}
          >
            <PhoneCall className="w-4 h-4" /> Cancel match - Urgent
          </Button>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-stone-900">Attendance</h2>
          <div className="text-sm text-stone-500">
            {confirmed} confirmed &middot; {pending} pending &middot; {declined} declined
          </div>
        </div>
        <ProgressBar confirmed={confirmed} pending={pending} declined={declined} />
      </Card>

      <Card className="mb-6">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-semibold text-stone-900">Participants</h2>
          <span className="text-xs text-stone-400 bg-stone-50 px-2 py-1 rounded-md">
            "Simulate reply" instantly sets status — no need to wait for live USSD/SMS during a demo
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-400 border-b border-stone-100">
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Role</th>
              <th className="px-6 py-3 font-medium">Phone</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Simulate reply</th>
            </tr>
          </thead>
          <tbody>
            {match.participants.map((p) => (
              <tr key={p.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50">
                <td className="px-6 py-3.5 font-medium text-stone-800">{p.name}</td>
                <td className="px-6 py-3.5 text-stone-500 capitalize">{p.role}</td>
                <td className="px-6 py-3.5 text-stone-500">{p.phone}</td>
                <td className="px-6 py-3.5">
                  <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex justify-end gap-1.5">
                    <button
                      title="Mark confirmed"
                      onClick={() => handleSimulate(p.id, "confirmed")}
                      className="p-1.5 rounded-md text-stone-400 hover:text-pitch-600 hover:bg-pitch-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      title="Mark declined"
                      onClick={() => handleSimulate(p.id, "declined")}
                      className="p-1.5 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-900">Recent messages</h2>
        </div>
        <div className="divide-y divide-stone-50 max-h-96 overflow-y-auto">
          {match.messages.length === 0 && (
            <p className="px-6 py-6 text-sm text-stone-400">No messages yet for this match.</p>
          )}
          {match.messages.map((m) => (
            <div key={m.id} className="px-6 py-3.5 flex items-start gap-3">
              <Badge tone={statusTone(m.status)}>{m.channel.toUpperCase()}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-700">{m.body}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {m.direction} &middot; {m.status} &middot; {m.created_at}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Send SMS update modal */}
      <Modal open={notifyModalOpen} onClose={() => setNotifyModalOpen(false)} title="Send SMS update">
        <Field label="Message (optional — leave blank for the default reminder text)">
          <textarea
            className={inputClass}
            rows={4}
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            placeholder={`Reply YES to confirm attendance for ${match.home_team_name} vs ${match.away_team_name}`}
          />
        </Field>
        <p className="text-xs text-stone-400 mb-4">
          Sent via Africa's Talking SMS to all {match.participants.length} participants. A short sponsor tag is appended automatically.
        </p>
        <Button className="w-full" onClick={handleNotify} disabled={busy}>
          {busy ? "Sending..." : "Send SMS"}
        </Button>
      </Modal>

      {/* Emergency cancel + voice alert modal */}
      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancel match & call everyone">
        <Field label="Reason (read aloud in the automated call)">
          <input
            className={inputClass}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </Field>
        <p className="text-xs text-stone-400 mb-4">
          This marks the match cancelled and places an automated text-to-speech voice call via Africa's Talking to every participant's phone.
        </p>
        <Button variant="danger" className="w-full" onClick={handleCancelAlert} disabled={busy}>
          {busy ? "Placing calls..." : "Confirm cancellation & call everyone"}
        </Button>
      </Modal>
    </div>
  );
}
