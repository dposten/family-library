const BASE = "";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  getAuthConfig: () => request("/auth/config"),
  register: (username, password) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => request("/auth/me"),

  // Books
  getBooks: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/books${q ? "?" + q : ""}`);
  },
  getTags: () => request("/api/books/tags"),
  addBookTag: (bookId, tagId) =>
    request(`/api/books/${bookId}/tags/${tagId}`, { method: "POST" }),
  removeBookTag: (bookId, tagId) =>
    request(`/api/books/${bookId}/tags/${tagId}`, { method: "DELETE" }),
  getBook: (id) => request(`/api/books/${id}`),
  lookupIsbn: (isbn) => request(`/api/books/lookup?isbn=${encodeURIComponent(isbn)}`),
  addBook: (data) => request("/api/books", { method: "POST", body: JSON.stringify(data) }),
  scanAdd: (data) => request("/api/books/scan", { method: "POST", body: JSON.stringify(data) }),
  deleteBook: (id) => request(`/api/books/${id}`, { method: "DELETE" }),
  setPrivacy: (id, isPrivate) =>
    request(`/api/books/${id}/privacy`, { method: "PATCH", body: JSON.stringify({ is_private: isPrivate }) }),
  setStatus: (id, status) =>
    request(`/api/books/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),

  // Loans
  getLoans: (activeOnly = true) =>
    request(`/api/loans${activeOnly ? "?active_only=true" : "?active_only=false"}`),
  createLoan: (bookId, loanedToUserId) =>
    request("/api/loans", {
      method: "POST",
      body: JSON.stringify({ book_id: bookId, loaned_to_user_id: loanedToUserId }),
    }),
  returnLoan: (loanId) => request(`/api/loans/${loanId}/return`, { method: "PUT" }),

  // Cover upload (multipart — cannot use request() helper)
  uploadCover: (bookId, file) => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    return fetch(`/api/books/${bookId}/cover`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Upload failed");
      }
      return res.json();
    });
  },

  // Metadata refresh
  refreshMetadata: (bookId) => request(`/api/books/${bookId}/refresh`, { method: "PUT" }),

  // Notes
  getNotes: (bookId) => request(`/api/books/${bookId}/notes`),
  addNote: (bookId, content) =>
    request(`/api/books/${bookId}/notes`, { method: "POST", body: JSON.stringify({ content }) }),
  editNote: (bookId, noteId, content) =>
    request(`/api/books/${bookId}/notes/${noteId}`, { method: "PUT", body: JSON.stringify({ content }) }),
  deleteNote: (bookId, noteId) =>
    request(`/api/books/${bookId}/notes/${noteId}`, { method: "DELETE" }),

  // Stats
  getStats: () => request("/api/stats"),

  // Users
  getUsers: () => request("/api/users"),
};
