import { useEffect, useState } from "react";
import { api } from "../api.js";

const TAG_CATEGORY_LABELS = { type: "Type", genre: "Genre", age: "Age" };
const TAG_CATEGORY_ORDER = ["type", "genre", "age"];
const TAG_COLORS = {
  type: "bg-blue-400",
  genre: "bg-purple-400",
  age: "bg-green-400",
};

function Bar({ value, max, colorClass }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatMonth(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });
}

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  const byCategory = TAG_CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = (stats.by_tag || []).filter((t) => t.category === cat);
    return acc;
  }, {});

  const maxTagCount = Math.max(1, ...(stats.by_tag || []).map((t) => t.count));
  const maxUserCount = Math.max(1, ...(stats.per_user || []).map((u) => u.count));
  const maxMonthCount = Math.max(1, ...(stats.by_month || []).map((m) => m.count));

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-4 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">📊 Collection Stats</h1>

      {/* Total */}
      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 text-center">
        <p className="text-5xl font-bold text-sky-600">{stats.total}</p>
        <p className="text-sm text-sky-500 mt-1">books in your library</p>
      </div>

      {/* Per user */}
      {stats.per_user?.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Books Added by Member</h2>
          <div className="space-y-2.5">
            {stats.per_user.map(({ username, count }) => (
              <div key={username} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-24 truncate">{username}</span>
                <Bar value={count} max={maxUserCount} colorClass="bg-sky-400" />
                <span className="text-sm font-medium text-gray-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* By tag category */}
      {TAG_CATEGORY_ORDER.map((cat) =>
        byCategory[cat]?.length > 0 ? (
          <section key={cat}>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              By {TAG_CATEGORY_LABELS[cat]}
            </h2>
            <div className="space-y-2.5">
              {byCategory[cat].map(({ name, count }) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-36 truncate">{name}</span>
                  <Bar value={count} max={maxTagCount} colorClass={TAG_COLORS[cat]} />
                  <span className="text-sm font-medium text-gray-700 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null
      )}

      {/* Over time */}
      {stats.by_month?.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Books Added Over Time</h2>
          <div className="space-y-2">
            {stats.by_month.map(({ month, count }) => (
              <div key={month} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 shrink-0">{formatMonth(month)}</span>
                <Bar value={count} max={maxMonthCount} colorClass="bg-indigo-400" />
                <span className="text-sm font-medium text-gray-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
