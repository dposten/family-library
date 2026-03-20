export default function LoanBadge({ loan }) {
  if (!loan) return null;
  return (
    <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full">
      🤝 Loaned to {loan.loaned_to?.username}
    </span>
  );
}
