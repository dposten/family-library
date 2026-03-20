import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import BarcodeScanner from "../components/BarcodeScanner.jsx";

export default function ScanPage() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null); // null | book data | "not_found"
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");

  async function handleDetected(isbn) {
    if (loading) return;
    setScanning(false);
    setLoading(true);
    setError("");
    setLookupResult(null);
    try {
      const data = await api.lookupIsbn(isbn);
      setLookupResult(data);
    } catch {
      setLookupResult({ isbn, title: "", notFound: true });
    } finally {
      setLoading(false);
    }
  }

  async function handleManualLookup(e) {
    e.preventDefault();
    if (manualIsbn.trim()) handleDetected(manualIsbn.trim());
  }

  async function confirmAdd() {
    setAdding(true);
    try {
      const book = await api.scanAdd(lookupResult);
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
  }

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
