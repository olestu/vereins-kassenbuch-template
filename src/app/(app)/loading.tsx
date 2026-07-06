/* Skeleton während Server-Daten laden — verhindert weiße Sprünge beim Seitenwechsel */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Lädt…">
      <div className="skeleton h-7 w-56" />
      <div className="flex gap-2">
        <div className="skeleton h-8 w-24" />
        <div className="skeleton h-8 w-28" />
        <div className="skeleton h-8 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
      </div>
      <div className="skeleton h-64" />
    </div>
  );
}
