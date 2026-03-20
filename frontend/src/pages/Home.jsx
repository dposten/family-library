import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import BookCard from "../components/BookCard.jsx";
import SearchBar from "../components/SearchBar.jsx";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Unread", value: "unread" },
  { label: "Reading", value: "reading" },
  { label: "Read", value: "read" },
];

export default function Home() {
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchBooks() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (query) params.q = query;
      if (filter) params.status = filter;
      setBooks(await api.getBooks(params));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchBooks(); }, [query, filter]);

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">📚 Library</h1>
        <Link
          to="/scan"
          className="bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          + Scan
        </Link>
      </div>

      <SearchBar onSearch={setQuery} />

      <div className="flex gap-2 mt-3 mb-4 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 text-sm px-3 py-1 rounded-full border transition-colors ${
              filter === f.value
                ? "bg-sky-500 border-sky-500 text-white"
                : "border-gray-200 text-gray-600 bg-white hover:border-sky-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
              <div className="aspect-[2/3] bg-gray-200" />
              <div className="p-2.5 space-y-1.5">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">No books yet</p>
          <p className="text-sm mt-1">Scan a barcode to add your first book</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
