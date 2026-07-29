import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Calendar, Send, PhoneCall, CheckCircle2, XCircle, Pencil, Info, MessageSquareText } from "lucide-react";
import { api } from "../lib/api";
import { Card, Badge, statusTone, ProgressBar, Button, Modal, Field, inputClass } from "../components/ui";
import { useToast } from "../components/Toast";

const SPONSOR_TAG = " -- Powered by Java House Nairobi";

export default function MatchDetail() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);

  // Modals
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("heavy rain forecast");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [targetParticipantId, setTargetParticipantId] = useState("");
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ venue: "", match_date: "", match_time: "", send_sms_update: true });
  const [busy, setBusy] = useState(false);

  const toast = useToast();
  const navigate = useNavigate();

  function load() {
    api.getMatch(id).then((m) => {
      setMatch(m);
      setEditForm({
        venue: m.venue,
        match_date: m.match_date,
        match_time: m.match_time,
        send_sms_update: true,
      });
    }).catch((err) => toast.push(err.message, "error"));
  }
  useEffect(load, [id]);

  if (!match) return <div className="p-8 text-stone-400 dark:text-stone-500 text-sm">Loading match details...</div>;

  const confirmed = match.participants.filter((p) => p.status === "confirmed").length;
  const pending = match.participants.filter((p) => p.status === "pending").length;
  const declined = match.participants.filter((p) => p.status === "declined").length;

  const defaultMsg = `Match reminder: ${match.home_team_name} vs ${match.away_team_name} at ${match.venue} on ${match.match_date} ${match.match_time}. Reply YES to confirm.`;
  const currentMsgText = notifyMessage || defaultMsg;
  const fullSmsText = currentMsgText + SPONSOR_TAG;
  const smsLength = fullSmsText.length;
  const smsSegments = Math.ceil(smsLength / 160);

  function openNotifyModal(participantId = "") {
    setTargetParticipantId(participantId);
    setNotifyModalOpen(true);
  }

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
      const targetId = targetParticipantId || undefined;
      const res = await api.notifyMatch(match.id, notifyMessage || undefined, targetId);
      const recipientText = targetId
        ? `SMS sent to 1 participant via Africa's Talking.`
        : `SMS sent to ${res.sent} recipient${res.sent === 1 ? "" : "s"} via Africa's Talking.`;
      toast.push(recipientText);
      setNotifyModalOpen(false);
      setNotifyMessage("");
      setTargetParticipantId("");
      load();
    } catch (err) {
      toast.push(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleEditMatch(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.updateMatch(match.id, editForm);
      toast.push(editForm.send_sms_update ? "Match updated & SMS alerts sent." : "Match updated.");
      setEditModalOpen(false);
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {match.home_team_name} <span className="text-stone-400 dark:text-stone-500 font-normal">vs</span> {match.away_team_name}
            </h1>
            <Badge tone={statusTone(match.status)}>{match.status}</Badge>
            <button
              onClick={() => setEditModalOpen(true)}
              className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title="Edit match details"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-stone-500 dark:text-stone-400">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {match.match_date} at {match.match_time}</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {match.venue}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={() => openNotifyModal("")}>
            <Send className="w-4 h-4" /> Send update (Bulk / Single)
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
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">Attendance</h2>
          <div className="text-sm text-stone-500 dark:text-stone-400">
            {confirmed} confirmed &middot; {pending} pending &middot; {declined} declined
          </div>
        </div>
        <ProgressBar confirmed={confirmed} pending={pending} declined={declined} />
      </Card>

      <Card className="mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">Participants</h2>
          <span className="text-xs text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-md">
            Click <MessageSquareText className="w-3 h-3 inline mx-0.5 text-pitch-600" /> to test single-number SMS on Africa's Talking Simulator
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-stone-800">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {match.participants.map((p) => (
                <tr key={p.id} className="border-b border-stone-50 dark:border-stone-800/50 last:border-0 hover:bg-stone-50/50 dark:hover:bg-stone-800/40 transition-colors">
                  <td className="px-6 py-3.5 font-medium text-stone-800 dark:text-stone-200">{p.name}</td>
                  <td className="px-6 py-3.5 text-stone-500 dark:text-stone-400 capitalize">
                    {p.role === "assistant_referee" ? "Assistant Referee (Linesman)" : p.role}
                  </td>
                  <td className="px-6 py-3.5 text-stone-500 dark:text-stone-400 font-mono text-xs">{p.phone}</td>
                  <td className="px-6 py-3.5">
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex justify-end gap-1.5 items-center">
                      <button
                        title={`Send SMS to ${p.name} (${p.phone})`}
                        onClick={() => openNotifyModal(p.id)}
                        className="p-1.5 rounded-md text-stone-400 hover:text-pitch-600 dark:hover:text-pitch-400 hover:bg-pitch-50 dark:hover:bg-pitch-950 transition-colors"
                      >
                        <MessageSquareText className="w-4 h-4" />
                      </button>
                      <span className="text-stone-200 dark:text-stone-700">|</span>
                      <button
                        title="Simulate reply: Mark confirmed"
                        onClick={() => handleSimulate(p.id, "confirmed")}
                        className="p-1.5 rounded-md text-stone-400 hover:text-pitch-600 dark:hover:text-pitch-400 hover:bg-pitch-50 dark:hover:bg-pitch-950 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        title="Simulate reply: Mark declined"
                        onClick={() => handleSimulate(p.id, "declined")}
                        className="p-1.5 rounded-md text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">Recent messages</h2>
        </div>
        <div className="divide-y divide-stone-50 dark:divide-stone-800 max-h-96 overflow-y-auto">
          {match.messages.length === 0 && (
            <p className="px-6 py-6 text-sm text-stone-400 dark:text-stone-500">No messages yet for this match.</p>
          )}
          {match.messages.map((m) => (
            <div key={m.id} className="px-6 py-3.5 flex items-start gap-3">
              <Badge tone={statusTone(m.status)}>{m.channel.toUpperCase()}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-700 dark:text-stone-300">{m.body}</p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  {m.direction} &middot; {m.status} &middot; {m.created_at}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Send SMS update modal with Single Target vs Bulk Selector */}
      <Modal open={notifyModalOpen} onClose={() => setNotifyModalOpen(false)} title="Send SMS update">
        <Field label="Recipient Target">
          <select
            className={inputClass}
            value={targetParticipantId}
            onChange={(e) => setTargetParticipantId(e.target.value)}
          >
            <option value="">All participants ({match.participants.length} recipients - Bulk Broadcast)</option>
            {match.participants.map((p) => (
              <option key={p.id} value={p.id}>
                Single: {p.name} ({p.phone}) - [{p.role}]
              </option>
            ))}
          </select>
        </Field>

        <Field label="Message text">
          <textarea
            className={inputClass}
            rows={4}
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            placeholder={defaultMsg}
          />
        </Field>

        <div className="p-3 bg-stone-50 dark:bg-stone-800/80 rounded-xl border border-stone-200 dark:border-stone-700 mb-4 space-y-2 text-xs">
          <div className="flex items-center justify-between text-stone-600 dark:text-stone-300 font-medium">
            <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-pitch-600" /> SMS Preview & Segment Count</span>
            <span>{smsLength} chars &middot; {smsSegments} segment{smsSegments > 1 ? "s" : ""}</span>
          </div>
          <div className="p-2 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 font-mono text-[11px] break-words">
            {currentMsgText}
            <span className="text-pitch-600 dark:text-pitch-400 font-semibold">{SPONSOR_TAG}</span>
          </div>
        </div>

        <Button className="w-full" onClick={handleNotify} disabled={busy}>
          {busy
            ? "Sending..."
            : targetParticipantId
            ? `Send Single SMS to ${match.participants.find((p) => String(p.id) === String(targetParticipantId))?.name || "Participant"}`
            : `Send Bulk SMS to ${match.participants.length} Recipients`}
        </Button>
      </Modal>

      {/* Edit Match details modal with explicit SMS toggle */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Match Fixture">
        <form onSubmit={handleEditMatch} className="space-y-4">
          <Field label="Venue">
            <input
              className={inputClass}
              value={editForm.venue}
              onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={editForm.match_date}
                onChange={(e) => setEditForm({ ...editForm, match_date: e.target.value })}
                required
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                className={inputClass}
                value={editForm.match_time}
                onChange={(e) => setEditForm({ ...editForm, match_time: e.target.value })}
                required
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={editForm.send_sms_update}
              onChange={(e) => setEditForm({ ...editForm, send_sms_update: e.target.checked })}
              className="rounded text-pitch-600 focus:ring-pitch-500 w-4 h-4"
            />
            <span>Send SMS update alert to all participants</span>
          </label>
          <Button type="submit" className="w-full mt-2" disabled={busy}>
            {busy ? "Saving..." : "Save changes"}
          </Button>
        </form>
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
        <p className="text-xs text-stone-400 dark:text-stone-500 mb-4">
          This marks the match cancelled and places an automated text-to-speech voice call via Africa's Talking to every participant's phone.
        </p>
        <Button variant="danger" className="w-full" onClick={handleCancelAlert} disabled={busy}>
          {busy ? "Placing calls..." : "Confirm cancellation & call everyone"}
        </Button>
      </Modal>
    </div>
  );
}
