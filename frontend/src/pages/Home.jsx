import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import BookCard from "../components/BookCard.jsx";
import SearchBar from "../components/SearchBar.jsx";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Unread", value: "unread" },
  { label: "Reading", value: "reading" },
  { label: "Read", value: "read" },
];

const SORT_OPTIONS = [
  { label: "Title A→Z", value: "" },
  { label: "Title Z→A", value: "title_desc" },
  { label: "Author", value: "author" },
  { label: "Year (newest)", value: "year_desc" },
  { label: "Year (oldest)", value: "year_asc" },
  { label: "Recently Added", value: "newest" },
];

const TAG_CATEGORY_LABELS = { type: "Type", genre: "Genre", age: "Age" };
const TAG_CATEGORY_ORDER = ["type", "genre", "age"];

const TAG_STYLES = {
  type: { base: "border-blue-200 text-blue-700 bg-white", active: "bg-blue-500 border-blue-500 text-white" },
  genre: { base: "border-purple-200 text-purple-700 bg-white", active: "bg-purple-500 border-purple-500 text-white" },
  age: { base: "border-green-200 text-green-700 bg-white", active: "bg-green-500 border-green-500 text-white" },
};

export default function Home() {
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [showTagFilters, setShowTagFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getTags().then(setAllTags).catch(() => {});
  }, []);

  async function fetchBooks() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (query) params.q = query;
      if (filter) params.status = filter;
      if (sort) params.sort = sort;
      if (selectedTags.length) params.tags = selectedTags.join(",");
      setBooks(await api.getBooks(params));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchBooks(); }, [query, filter, sort, selectedTags]);

  function toggleTag(tagId) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  const tagsByCategory = TAG_CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = allTags.filter((t) => t.category === cat);
    return acc;
  }, {});

  const activeTagCount = selectedTags.length;

  return (
    <div className="max-w-6xl mx-auto px-4 pt-5 pb-4">
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

      {/* Status filter + sort */}
      <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
        <div className="flex gap-2 flex-1">
          {STATUS_FILTERS.map((f) => (
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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="shrink-0 text-sm px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Tag filter toggle */}
      <div className="mt-2">
        <button
          onClick={() => setShowTagFilters((v) => !v)}
          className={`text-sm px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
            activeTagCount > 0
              ? "bg-indigo-500 border-indigo-500 text-white"
              : "border-gray-200 text-gray-600 bg-white hover:border-indigo-300"
          }`}
        >
          🏷 Tags {activeTagCount > 0 && `(${activeTagCount})`}
          <span className="text-xs opacity-75">{showTagFilters ? "▲" : "▼"}</span>
        </button>
        {activeTagCount > 0 && (
          <button
            onClick={() => setSelectedTags([])}
            className="ml-2 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Tag filter panel */}
      {showTagFilters && (
        <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
          {TAG_CATEGORY_ORDER.map((cat) => (
            tagsByCategory[cat]?.length > 0 && (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {TAG_CATEGORY_LABELS[cat]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tagsByCategory[cat].map((tag) => {
                    const styles = TAG_STYLES[cat] || TAG_STYLES.genre;
                    const active = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          active ? styles.active : styles.base
                        }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

      <div className="mt-4">
        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
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
            <p className="font-medium">No books found</p>
            <p className="text-sm mt-1">
              {activeTagCount > 0 || filter || query
                ? "Try adjusting your filters"
                : "Scan a barcode to add your first book"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
