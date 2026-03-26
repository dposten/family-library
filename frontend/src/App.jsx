import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!menuOpen) { setExportOpen(false); return; }
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleExport(format) {
    try {
      await api.exportLibrary(format);
    } catch (err) {
      alert(err.message);
    }
    setMenuOpen(false);
  }

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
      isActive ? "text-sky-600 bg-sky-50" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
    }`;

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-14 md:w-48 bg-white border-r border-gray-200 flex flex-col py-4 z-50">
      <div className="flex flex-col gap-1 flex-1 px-2">
        <NavLink to="/" end className={linkClass}>
          <span className="text-xl shrink-0">📚</span>
          <span className="hidden md:block text-sm font-medium">Library</span>
        </NavLink>
        <NavLink to="/scan" className={linkClass}>
          <span className="text-xl shrink-0">📷</span>
          <span className="hidden md:block text-sm font-medium">Scan</span>
        </NavLink>
        <NavLink to="/loans" className={linkClass}>
          <span className="text-xl shrink-0">🤝</span>
          <span className="hidden md:block text-sm font-medium">Loans</span>
        </NavLink>
        <NavLink to="/stats" className={linkClass}>
          <span className="text-xl shrink-0">📊</span>
          <span className="hidden md:block text-sm font-medium">Stats</span>
        </NavLink>
      </div>

      {/* Account button + dropdown */}
      <div className="px-2 relative" ref={menuRef}>
        {menuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <button
              onClick={() => { setMenuOpen(false); navigate("/login"); }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Switch Account
            </button>
            <button
              onClick={() => setExportOpen((v) => !v)}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              Export Library
              <span className="text-xs opacity-50">{exportOpen ? "▲" : "▶"}</span>
            </button>
            {exportOpen && (
              <div className="border-t border-gray-100 bg-gray-50 flex gap-2 px-4 py-2.5">
                <button
                  onClick={() => handleExport("csv")}
                  className="flex-1 text-center py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-sky-50 hover:border-sky-300 transition-colors"
                >
                  CSV
                </button>
                <button
                  onClick={() => handleExport("txt")}
                  className="flex-1 text-center py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-sky-50 hover:border-sky-300 transition-colors"
                >
                  TXT
                </button>
              </div>
            )}
            <button
              onClick={() => { setMenuOpen(false); onLogout(); }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
        >
          <span className="text-xl shrink-0">👤</span>
          <span className="hidden md:block text-sm font-medium">{user?.username || "Account"}</span>
        </button>
      </div>
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
      <div className="ml-14 md:ml-48">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/book/:id" element={<BookDetail currentUser={user} />} />
          <Route path="/loans" element={<LoansPage currentUser={user} />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/login" element={<LoginPage onLogin={login} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <NavBar user={user} onLogout={logout} />
    </BrowserRouter>
  );
}
