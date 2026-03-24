import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import BarcodeScanner from "../components/BarcodeScanner.jsx";

const TAG_COLORS = {
  type: { active: "bg-blue-500 border-blue-500 text-white", base: "border-blue-200 text-blue-700 bg-white" },
  genre: { active: "bg-purple-500 border-purple-500 text-white", base: "border-purple-200 text-purple-700 bg-white" },
  age: { active: "bg-green-500 border-green-500 text-white", base: "border-green-200 text-green-700 bg-white" },
};
const TAG_CATEGORY_ORDER = ["type", "genre", "age"];
const TAG_CATEGORY_LABELS = { type: "Type", genre: "Genre", age: "Age" };

export default function ScanPage() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  useEffect(() => {
    api.getTags().then(setAllTags).catch(() => {});
  }, []);

  async function handleDetected(isbn) {
    if (loading) return;
    setScanning(false);
    setLoading(true);
    setError("");
    setLookupResult(null);
    try {
      const data = await api.lookupIsbn(isbn);
      setLookupResult(data);
      setSelectedTagIds(data.suggested_tag_ids || []);
    } catch {
      setLookupResult({ isbn, title: "", notFound: true });
      setSelectedTagIds([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleManualLookup(e) {
    e.preventDefault();
    if (manualIsbn.trim()) handleDetected(manualIsbn.trim());
  }

  function toggleTag(tagId) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  async function confirmAdd() {
    setAdding(true);
    try {
      const book = await api.scanAdd({ ...lookupResult, is_private: isPrivate });
      if (coverFile) {
        await api.uploadCover(book.id, coverFile).catch(() => {});
      }
      // Apply selected tags
      await Promise.all(selectedTagIds.map((tagId) => api.addBookTag(book.id, tagId).catch(() => {})));
      navigate(`/book/${book.id}`);
    } catch (err) {
      setError(err.message);
      setAdding(false);
    }
  }

  function reset() {
    setLookupResult(null);
    setError("");
    setScanning(true);
    setManualIsbn("");
    setCoverFile(null);
    setIsPrivate(false);
    setSelectedTagIds([]);
  }

  const tagsByCategory = TAG_CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = allTags.filter((t) => t.category === cat);
    return acc;
  }, {});

  return (
    <div className="max-w-lg mx-auto px-4 pt-5">
      <h1 className="text-xl font-bold text-gray-900 mb-4">📷 Scan Barcode</h1>

      {scanning && (
        <>
          <BarcodeScanner active={scanning} onDetected={handleDetected} />
          <p className="text-center text-sm text-gray-500 mt-3 mb-4">
            Or enter ISBN manually:
          </p>
          <form onSubmit={handleManualLookup} className="flex gap-2">
            <input
              type="text"
              value={manualIsbn}
              onChange={(e) => setManualIsbn(e.target.value)}
              placeholder="9780743273565"
              className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors"
            >
              Look up
            </button>
          </form>
        </>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin mb-3" />
          <p className="text-gray-500 text-sm">Looking up book…</p>
        </div>
      )}

      {lookupResult && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {lookupResult.cover_url && !lookupResult.notFound && (
            <img
              src={lookupResult.cover_url}
              alt={lookupResult.title}
              className="w-32 mx-auto mt-5 rounded shadow-md"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          )}
          <div className="p-5">
            {lookupResult.notFound ? (
              <>
                <p className="text-gray-500 text-sm mb-3">
                  No metadata found for ISBN <strong>{lookupResult.isbn}</strong>.
                  You can still add it manually.
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={lookupResult.title}
                  onChange={(e) => setLookupResult({ ...lookupResult, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 mb-2"
                  placeholder="Book title"
                />
                <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                <input
                  type="text"
                  value={lookupResult.author || ""}
                  onChange={(e) => setLookupResult({ ...lookupResult, author: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="Author name"
                />
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold leading-tight">{lookupResult.title}</h2>
                {lookupResult.subtitle && (
                  <p className="text-gray-600 text-sm mt-0.5">{lookupResult.subtitle}</p>
                )}
                {lookupResult.author && (
                  <p className="text-gray-500 text-sm mt-1">by {lookupResult.author}</p>
                )}
                {lookupResult.publisher && (
                  <p className="text-xs text-gray-400 mt-1">
                    {lookupResult.publisher}{lookupResult.year ? ` · ${lookupResult.year}` : ""}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">ISBN: {lookupResult.isbn}</p>
              </>
            )}

            {/* Tag selection */}
            {allTags.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Tags
                  {selectedTagIds.length > 0 && (
                    <span className="ml-1.5 text-xs text-gray-400">({selectedTagIds.length} selected)</span>
                  )}
                </p>
                <div className="space-y-2.5">
                  {TAG_CATEGORY_ORDER.map((cat) =>
                    tagsByCategory[cat]?.length > 0 ? (
                      <div key={cat}>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                          {TAG_CATEGORY_LABELS[cat]}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {tagsByCategory[cat].map((tag) => {
                            const active = selectedTagIds.includes(tag.id);
                            const colors = TAG_COLORS[cat] || TAG_COLORS.genre;
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleTag(tag.id)}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                  active ? colors.active : colors.base
                                }`}
                              >
                                {tag.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* Cover upload */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {!lookupResult.cover_url ? "Add cover photo (optional)" : "Replace cover photo (optional)"}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sky-50 file:text-sky-600 hover:file:bg-sky-100"
              />
              {coverFile && (
                <p className="text-xs text-gray-400 mt-1">{coverFile.name}</p>
              )}
            </div>

            {/* Private toggle */}
            <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-sky-500 focus:ring-sky-400"
              />
              <span className="text-sm text-gray-700">Private (only visible to me)</span>
            </label>

            {error && (
              <p className="text-red-500 text-sm mt-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={reset}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAdd}
                disabled={adding || !lookupResult.title}
                className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {adding ? "Adding…" : "Add to Library"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
