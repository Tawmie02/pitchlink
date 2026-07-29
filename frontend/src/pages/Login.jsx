import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../lib/api";
import { Button, Field, inputClass } from "../components/ui";
import { useToast } from "../components/Toast";

export default function Login() {
  const [email, setEmail] = useState("organizer@pitchlink.dev");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { token } = await api.login(email, password);
      setToken(token);
      toast.push("Welcome back!");
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pitch-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-pitch-500 mx-auto flex items-center justify-center font-bold text-xl text-pitch-950 mb-3">
            P
          </div>
          <h1 className="text-2xl font-bold text-white">PitchLink</h1>
          <p className="text-pitch-300 text-sm mt-1">Match-day communication, sorted.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-card">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-xs text-stone-400 mt-4 text-center">
            Demo credentials are pre-filled — just hit sign in.
          </p>
        </form>
      </div>
    </div>
  );
}
