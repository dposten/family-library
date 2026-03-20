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
  getBook: (id) => request(`/api/books/${id}`),
  lookupIsbn: (isbn) => request(`/api/books/lookup?isbn=${encodeURIComponent(isbn)}`),
  addBook: (data) => request("/api/books", { method: "POST", body: JSON.stringify(data) }),
  scanAdd: (data) => request("/api/books/scan", { method: "POST", body: JSON.stringify(data) }),
  deleteBook: (id) => request(`/api/books/${id}`, { method: "DELETE" }),
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

  // Users
  getUsers: () => request("/api/users"),
};
