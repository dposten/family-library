import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import ScanPage from "./pages/ScanPage.jsx";
import BookDetail from "./pages/BookDetail.jsx";
import LoansPage from "./pages/LoansPage.jsx";
import StatsPage from "./pages/StatsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";

function useAuth() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });

  function login(userData, token) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  return { user, login, logout };
}

function NavBar({ user, onLogout }) {
  const linkClass = ({ isActive }) =>
    `flex flex-col items-center gap-0.5 text-xs px-3 py-2 rounded-lg transition-colors ${
      isActive ? "text-sky-600 bg-sky-50" : "text-gray-500 hover:text-gray-800"
    }`;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex justify-around items-center safe-area-bottom z-50">
      <NavLink to="/" end className={linkClass}>
        <span className="text-xl">📚</span>
        <span>Library</span>
      </NavLink>
      <NavLink to="/scan" className={linkClass}>
        <span className="text-xl">📷</span>
        <span>Scan</span>
      </NavLink>
      <NavLink to="/loans" className={linkClass}>
        <span className="text-xl">🤝</span>
        <span>Loans</span>
      </NavLink>
      <NavLink to="/stats" className={linkClass}>
        <span className="text-xl">📊</span>
        <span>Stats</span>
      </NavLink>
      <button
        onClick={onLogout}
        className="flex flex-col items-center gap-0.5 text-xs px-3 py-2 rounded-lg text-gray-500 hover:text-gray-800 transition-colors"
      >
        <span className="text-xl">👤</span>
        <span>{user?.username || "Logout"}</span>
      </button>
    </nav>
  );
}

export default function App() {
  const { user, login, logout } = useAuth();

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<LoginPage onLogin={login} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="pb-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/book/:id" element={<BookDetail currentUser={user} />} />
          <Route path="/loans" element={<LoansPage currentUser={user} />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <NavBar user={user} onLogout={logout} />
    </BrowserRouter>
  );
}
