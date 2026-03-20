import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function LoansPage({ currentUser }) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [returning, setReturning] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setLoans(await api.getLoans(!showAll));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [showAll]);

  async function markReturned(loanId) {
    setReturning(loanId);
    try {
      await api.returnLoan(loanId);
      await load();
    } finally {
      setReturning(null);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">🤝 Loans</h1>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-sky-600 hover:underline"
        >
          {showAll ? "Active only" : "Show all"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse">
              <div className="flex gap-3">
                <div className="w-12 h-16 bg-gray-200 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : loans.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium">No {showAll ? "" : "active "}loans</p>
          <p className="text-sm mt-1">All books are accounted for</p>
        </div>
      ) : (
        <div className="space-y-3">
          {loans.map((loan) => (
            <div
              key={loan.id}
              className={`bg-white rounded-xl border shadow-sm p-4 ${
                loan.returned_at ? "border-gray-100 opacity-60" : "border-orange-100"
              }`}
            >
              <div className="flex gap-3">
                <Link to={`/book/${loan.book_id}`} className="shrink-0">
                  {loan.book?.cover_url ? (
                    <img
                      src={loan.book.cover_url}
                      alt={loan.book?.title}
                      className="w-12 h-16 object-cover rounded shadow-sm"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-12 h-16 bg-sky-100 rounded flex items-center justify-center text-xl">
                      📖
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/book/${loan.book_id}`}>
                    <h3 className="font-semibold text-sm leading-tight line-clamp-1 hover:text-sky-600">
                      {loan.book?.title}
                    </h3>
                  </Link>
                  {loan.book?.author && (
                    <p className="text-xs text-gray-400 truncate">{loan.book.author}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Loaned to <strong>{loan.loaned_to?.username}</strong>
                    {" "}by {loan.loaned_by?.username}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(loan.loaned_at).toLocaleDateString()}
                    {loan.returned_at && (
                      <span className="ml-2 text-green-600">
                        Returned {new Date(loan.returned_at).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {!loan.returned_at && (
                <button
                  onClick={() => markReturned(loan.id)}
                  disabled={returning === loan.id}
                  className="mt-3 w-full py-2 border border-orange-200 text-orange-600 hover:bg-orange-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {returning === loan.id ? "Updating…" : "Mark Returned"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
