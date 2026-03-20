import { useState } from "react";
import { api } from "../api.js";

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = mode === "login"
        ? await api.login(username, password)
        : await api.register(username, password);
      onLogin(data.user, data.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-sky-50 to-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">📚</div>
          <h1 className="text-2xl font-bold text-gray-900">Family Library</h1>
          <p className="text-gray-500 text-sm mt-1">Your personal book catalog</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex mb-5 gap-1 p-1 bg-gray-100 rounded-lg">
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  mode === m ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        {mode === "register" && (
          <p className="text-center text-xs text-gray-400 mt-4">
            The first account created becomes the admin.
          </p>
        )}
      </div>
    </div>
  );
}
