import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import LoanBadge from "../components/LoanBadge.jsx";

const TAG_COLORS = {
  type: { pill: "bg-blue-100 text-blue-700", add: "border-blue-200 text-blue-600 hover:bg-blue-50" },
  genre: { pill: "bg-purple-100 text-purple-700", add: "border-purple-200 text-purple-600 hover:bg-purple-50" },
  age: { pill: "bg-green-100 text-green-700", add: "border-green-200 text-green-600 hover:bg-green-50" },
};
const TAG_CATEGORY_LABELS = { type: "Type", genre: "Genre", age: "Age" };
const TAG_CATEGORY_ORDER = ["type", "genre", "age"];

const STATUS_OPTIONS = [
  { value: "unread", label: "Unread", emoji: "📋" },
  { value: "reading", label: "Reading", emoji: "📖" },
  { value: "read", label: "Read", emoji: "✅" },
];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function BookDetail({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [users, setUsers] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loanTarget, setLoanTarget] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddTags, setShowAddTags] = useState(false);

  // Cover upload
  const coverInputRef = useRef(null);

  // Metadata refresh
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  // Notes
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [b, u, t, n] = await Promise.all([
        api.getBook(id),
        api.getUsers(),
        api.getTags(),
        api.getNotes(id),
      ]);
      setBook(b);
      setUsers(u);
      setAllTags(t);
      setNotes(n);
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

  async function addTag(tagId) {
    try {
      const updated = await api.addBookTag(book.id, tagId);
      setBook(updated);
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeTag(tagId) {
    try {
      const updated = await api.removeBookTag(book.id, tagId);
      setBook(updated);
    } catch (err) {
      alert(err.message);
    }
  }

  async function togglePrivacy() {
    try {
      const updated = await api.setPrivacy(book.id, !book.is_private);
      setBook(updated);
    } catch (err) {
      alert(err.message);
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

  async function handleCoverUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const updated = await api.uploadCover(book.id, file);
      setBook(updated);
    } catch (err) {
      alert(err.message);
    }
    e.target.value = "";
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError("");
    try {
      const updated = await api.refreshMetadata(book.id);
      setBook(updated);
    } catch (err) {
      setRefreshError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function submitNote(e) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const note = await api.addNote(id, newNote.trim());
      setNotes((prev) => [...prev, note]);
      setNewNote("");
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingNote(false);
    }
  }

  async function saveEdit(noteId) {
    if (!editContent.trim()) return;
    try {
      const updated = await api.editNote(id, noteId, editContent.trim());
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      setEditingNoteId(null);
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeNote(noteId) {
    try {
      await api.deleteNote(id, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
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
        {/* Upload cover button */}
        <button
          onClick={() => coverInputRef.current?.click()}
          className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm text-xs font-medium text-gray-700 hover:bg-white transition-colors"
        >
          Upload Cover
        </button>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCoverUpload}
        />
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
          {/* Refresh metadata */}
          {book.isbn && (
            <div className="mt-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-xs text-sky-500 hover:text-sky-700 disabled:text-sky-300 transition-colors"
              >
                {refreshing ? "Refreshing…" : "Refresh Metadata"}
              </button>
              {refreshError && (
                <p className="text-xs text-red-500 mt-1">{refreshError}</p>
              )}
            </div>
          )}
        </div>

        {/* Privacy toggle — owner only */}
        {book.added_by?.id === currentUser.id && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={book.is_private || false}
              onChange={togglePrivacy}
              className="w-4 h-4 rounded border-gray-300 text-sky-500 focus:ring-sky-400"
            />
            <span className="text-sm text-gray-600">Private (only visible to me)</span>
          </label>
        )}
        {book.is_private && book.added_by?.id !== currentUser.id && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
            🔒 Private
          </span>
        )}

        {/* Tags */}
        {(() => {
          const bookTagIds = new Set((book.tags || []).map((t) => t.id));
          const availableTags = allTags.filter((t) => !bookTagIds.has(t.id));
          const tagsByCategory = TAG_CATEGORY_ORDER.reduce((acc, cat) => {
            acc[cat] = availableTags.filter((t) => t.category === cat);
            return acc;
          }, {});

          return (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">Tags</p>
                <button
                  onClick={() => setShowAddTags((v) => !v)}
                  className="text-xs text-sky-500 hover:text-sky-700"
                >
                  {showAddTags ? "Done" : "+ Add"}
                </button>
              </div>

              {/* Current tags */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(book.tags || []).length === 0 && !showAddTags && (
                  <p className="text-xs text-gray-400 italic">No tags yet</p>
                )}
                {(book.tags || []).map((tag) => {
                  const colors = TAG_COLORS[tag.category] || TAG_COLORS.genre;
                  return (
                    <span
                      key={tag.id}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${colors.pill}`}
                    >
                      {tag.name}
                      <button
                        onClick={() => removeTag(tag.id)}
                        className="opacity-60 hover:opacity-100 leading-none"
                        aria-label={`Remove ${tag.name}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>

              {/* Add tags panel */}
              {showAddTags && availableTags.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2.5">
                  {TAG_CATEGORY_ORDER.map((cat) =>
                    tagsByCategory[cat]?.length > 0 ? (
                      <div key={cat}>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                          {TAG_CATEGORY_LABELS[cat]}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {tagsByCategory[cat].map((tag) => {
                            const colors = TAG_COLORS[cat] || TAG_COLORS.genre;
                            return (
                              <button
                                key={tag.id}
                                onClick={() => addTag(tag.id)}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${colors.add}`}
                              >
                                + {tag.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>
          );
        })()}

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

        {/* Notes */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">Notes</p>
          {notes.length === 0 && (
            <p className="text-sm text-gray-400 italic mb-3">No notes yet</p>
          )}
          <div className="space-y-3 mb-3">
            {notes.map((note) => {
              const canEdit = note.user_id === currentUser.id || currentUser.is_admin;
              return (
                <div key={note.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {editingNoteId === note.id ? (
                    <div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => saveEdit(note.id)}
                          className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-700 leading-relaxed">{note.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {note.author?.username} · {formatDate(note.created_at)}
                        </span>
                        {canEdit && (
                          <div className="flex gap-2">
                            {note.user_id === currentUser.id && (
                              <button
                                onClick={() => { setEditingNoteId(note.id); setEditContent(note.content); }}
                                className="text-xs text-sky-500 hover:text-sky-700"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => removeNote(note.id)}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <form onSubmit={submitNote} className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              placeholder="Add a note…"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
            />
            <button
              type="submit"
              disabled={addingNote || !newNote.trim()}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white rounded-lg text-sm font-semibold self-end transition-colors"
            >
              Add
            </button>
          </form>
        </div>

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
