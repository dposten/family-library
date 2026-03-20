import { useEffect, useRef, useState } from "react";

export default function SearchBar({ onSearch, placeholder = "Search books…" }) {
  const [value, setValue] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(value), 300);
    return () => clearTimeout(timer.current);
  }, [value]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
      />
    </div>
  );
}
