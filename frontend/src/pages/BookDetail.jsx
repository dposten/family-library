import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import LoanBadge from "../components/LoanBadge.jsx";

const STATUS_OPTIONS = [
  { value: "unread", label: "Unread", emoji: "📋" },
  { value: "reading", label: "Reading", emoji: "📖" },
  { value: "read", label: "Read", emoji: "✅" },
];

export default function BookDetail({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loanTarget, setLoanTarget] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [b, u] = await Promise.all([api.getBook(id), api.getUsers()]);
      setBook(b);
      setUsers(u);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function setStatus(status) {
    try {
      const updated = await api.setStatus(id, status);
      setBook(updated);
    } catch (err) {
      alert(err.message);
    }
  }

  async function loanBook() {
    if (!loanTarget) return;
    setActionLoading(true);
    try {
      await api.createLoan(book.id, parseInt(loanTarget));
      await load();
      setLoanTarget("");
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function returnBook() {
    if (!book.active_loan) return;
    setActionLoading(true);
    try {
      await api.returnLoan(book.active_loan.id);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteBook() {
    if (!confirm(`Remove "${book.title}" from the catalog?`)) return;
    try {
      await api.deleteBook(book.id);
      navigate("/");
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !book) {
    return <div className="p-4 text-red-500">{error || "Book not found"}</div>;
  }

  const otherUsers = users.filter((u) => u.id !== currentUser.id);

  return (
    <div className="max-w-lg mx-auto">
      {/* Header with cover */}
      <div className="relative">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="w-full h-56 object-cover object-top"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-56 bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center text-6xl">
            📖
          </div>
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-sm text-gray-700"
        >
          ← Back
        </button>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Title & meta */}
        <div>
          <h1 className="text-xl font-bold leading-tight">{book.title}</h1>
          {book.subtitle && <p className="text-gray-600 mt-0.5">{book.subtitle}</p>}
          {book.author && <p className="text-gray-500 text-sm mt-1">by {book.author}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {book.publisher && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                {book.publisher}
              </span>
            )}
            {book.year && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                {book.year}
              </span>
            )}
            {book.isbn && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                ISBN: {book.isbn}
              </span>
            )}
          </div>
        </div>

        {/* Loan status */}
        {book.active_loan && <LoanBadge loan={book.active_loan} />}

        {/* Reading status */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">My Reading Status</p>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  book.my_status === opt.value
                    ? "bg-sky-500 border-sky-500 text-white"
                    : "border-gray-200 text-gray-600 hover:border-sky-300 bg-white"
                }`}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loan actions */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Loan Management</p>
          {book.active_loan ? (
            <button
              onClick={returnBook}
              disabled={actionLoading}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {actionLoading ? "Updating…" : "Mark as Returned"}
            </button>
          ) : (
            <div className="flex gap-2">
              <select
                value={loanTarget}
                onChange={(e) => setLoanTarget(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
              >
                <option value="">Loan to…</option>
                {otherUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
              <button
                onClick={loanBook}
                disabled={!loanTarget || actionLoading}
                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Loan
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        {book.description && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Description</p>
            <p className="text-sm text-gray-600 leading-relaxed">{book.description}</p>
          </div>
        )}

        {/* Delete */}
        <button
          onClick={deleteBook}
          className="w-full py-2.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors mt-2"
        >
          Remove from Catalog
        </button>
      </div>
    </div>
  );
}
