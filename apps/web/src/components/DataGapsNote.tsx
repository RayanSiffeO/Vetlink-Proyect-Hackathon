export function DataGapsNote({ gaps, className }: { gaps: string[]; className: string }) {
  return (
    <p className={`break-words ${className}`}>
      <span className="font-semibold">Datos que faltan: </span>
      {gaps.join(' · ')}
    </p>
  );
}
