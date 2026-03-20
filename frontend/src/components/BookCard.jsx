import { Link } from "react-router-dom";

const STATUS_STYLES = {
  unread: "bg-gray-100 text-gray-600",
  reading: "bg-yellow-100 text-yellow-700",
  read: "bg-green-100 text-green-700",
};

const STATUS_LABELS = { unread: "Unread", reading: "Reading", read: "Read" };

export default function BookCard({ book }) {
  const status = book.my_status || "unread";

  return (
    <Link to={`/book/${book.id}`} className="block">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        <div className="aspect-[2/3] bg-gray-100 relative overflow-hidden">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-sky-100 to-sky-200">
              📖
            </div>
          )}
          {book.active_loan && (
            <div className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full">
              Loaned
            </div>
          )}
        </div>
        <div className="p-2.5">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-0.5">{book.title}</h3>
          {book.author && (
            <p className="text-xs text-gray-500 truncate">{book.author}</p>
          )}
          <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        </div>
      </div>
    </Link>
  );
}
