import React, { useEffect, useState } from "react";
import { Plus, Phone, Pencil, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Card, Button, Modal, Field, inputClass } from "../components/ui";
import { useToast } from "../components/Toast";

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    contacts: [{ name: "", phone: "+254", role: "captain" }],
  });
  const toast = useToast();

  function load() {
    api.getTeams().then(setTeams).catch(console.error);
  }
  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      contacts: [{ name: "", phone: "+254", role: "captain" }],
    });
    setModalOpen(true);
  }
  function openEdit(team) {
    setEditing(team);
    setForm({
      name: team.name,
      contacts:
        team.contacts?.map((contact) => ({
          name: contact.name,
          phone: contact.phone,
          role: contact.role,
        })) || [{ name: "", phone: "+254", role: "captain" }],
    });
    setModalOpen(true);
  }

  function addContact() {
    setForm({
      ...form,
      contacts: [...form.contacts, { name: "", phone: "+254", role: "member" }],
    });
  }

  function updateContact(index, field, value) {
    setForm({
      ...form,
      contacts: form.contacts.map((contact, i) =>
        i === index ? { ...contact, [field]: value } : contact
      ),
    });
  }

  function removeContact(index) {
    setForm({
      ...form,
      contacts: form.contacts.filter((_, i) => i !== index),
    });
  }

  function normalizeContacts(contacts) {
    return contacts.map((contact) => ({
      ...contact,
      name: contact.name?.trim() || "",
      phone: contact.phone?.trim() || "",
      role: contact.role?.trim() || "member",
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const contacts = normalizeContacts(form.contacts);
    if (!contacts.length) {
      toast.push("Add at least one contact.", "error");
      return;
    }
    const invalid = contacts.find((contact) => !contact.name || !contact.phone);
    if (invalid) {
      toast.push("Each contact needs a name and phone number.", "error");
      return;
    }
    if (!contacts.some((contact) => contact.role.toLowerCase() === "captain")) {
      contacts[0].role = "captain";
    }

    try {
      if (editing) {
        await api.updateTeam(editing.id, { name: form.name, contacts });
        toast.push("Team updated.");
      } else {
        await api.createTeam({ name: form.name, contacts });
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
          <p className="text-stone-500 text-sm mt-0.5">All team contacts can be stored here so every stakeholder can receive SMS, voice and USSD updates.</p>
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
              <th className="px-6 py-3 font-medium">Contacts</th>
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
                <td className="px-6 py-3.5 text-stone-500">{t.contacts?.length ?? 0}</td>
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

          <div className="space-y-4">
            {form.contacts.map((contact, index) => (
              <div key={index} className="border border-stone-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-sm font-semibold text-stone-900">Contact {index + 1}</h3>
                  {form.contacts.length > 1 && (
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => removeContact(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Field label="Name">
                  <input
                    className={inputClass}
                    value={contact.name}
                    onChange={(e) => updateContact(index, "name", e.target.value)}
                    placeholder="e.g. Brian Otieno"
                    required
                  />
                </Field>
                <Field label="Phone (international format)">
                  <input
                    className={inputClass}
                    value={contact.phone}
                    onChange={(e) => updateContact(index, "phone", e.target.value)}
                    placeholder="+2547XXXXXXXX"
                    pattern="\+\d{10,15}"
                    required
                  />
                </Field>
                <Field label="Role">
                  <input
                    className={inputClass}
                    value={contact.role}
                    onChange={(e) => updateContact(index, "role", e.target.value)}
                    placeholder="captain / coach / player / stakeholder"
                  />
                </Field>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-pitch-600 hover:text-pitch-800 mt-3"
            onClick={addContact}
          >
            <Plus className="w-4 h-4" /> Add another contact
          </button>

          <p className="text-xs text-stone-400 mb-4 mt-3">
            Each contact will receive SMS, voice and USSD updates if they are invited to a match.
          </p>
          <Button type="submit" className="w-full">
            {editing ? "Save changes" : "Add team"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
