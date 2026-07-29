import React, { useEffect, useState } from "react";
import { Plus, Phone, Pencil, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Card, Button, Modal, Field, inputClass } from "../components/ui";
import { useToast } from "../components/Toast";

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", captain_name: "", captain_phone: "" });
  const toast = useToast();

  function load() {
    api.getTeams().then(setTeams).catch(console.error);
  }
  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", captain_name: "", captain_phone: "+254" });
    setModalOpen(true);
  }
  function openEdit(team) {
    setEditing(team);
    setForm({ name: team.name, captain_name: team.captain_name, captain_phone: team.captain_phone });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateTeam(editing.id, form);
        toast.push("Team updated.");
      } else {
        await api.createTeam(form);
        toast.push("Team added.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.push(err.message, "error");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this team? This can't be undone.")) return;
    try {
      await api.deleteTeam(id);
      toast.push("Team removed.");
      load();
    } catch (err) {
      toast.push(err.message, "error");
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Teams</h1>
          <p className="text-stone-500 text-sm mt-0.5">Captains receive SMS, voice and USSD updates at these numbers.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add team
        </Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-400 border-b border-stone-100">
              <th className="px-6 py-3 font-medium">Team</th>
              <th className="px-6 py-3 font-medium">Captain</th>
              <th className="px-6 py-3 font-medium">Phone</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50">
                <td className="px-6 py-3.5 font-medium text-stone-800">{t.name}</td>
                <td className="px-6 py-3.5 text-stone-600">{t.captain_name}</td>
                <td className="px-6 py-3.5 text-stone-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {t.captain_phone}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <button onClick={() => openEdit(t)} className="text-stone-400 hover:text-pitch-600 p-1.5">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="text-stone-400 hover:text-red-600 p-1.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-stone-400">
                  No teams yet. Add your first team to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit team" : "Add team"}>
        <form onSubmit={handleSubmit}>
          <Field label="Team name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Nairobi Rangers FC"
              required
            />
          </Field>
          <Field label="Captain name">
            <input
              className={inputClass}
              value={form.captain_name}
              onChange={(e) => setForm({ ...form, captain_name: e.target.value })}
              placeholder="e.g. Brian Otieno"
              required
            />
          </Field>
          <Field label="Captain phone (international format)">
            <input
              className={inputClass}
              value={form.captain_phone}
              onChange={(e) => setForm({ ...form, captain_phone: e.target.value })}
              placeholder="+2547XXXXXXXX"
              pattern="\+\d{10,15}"
              required
            />
          </Field>
          <p className="text-xs text-stone-400 mb-4 -mt-2">
            Must start with "+" and country code — this is the number Africa's Talking will SMS, call, or serve USSD to.
          </p>
          <Button type="submit" className="w-full">
            {editing ? "Save changes" : "Add team"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
