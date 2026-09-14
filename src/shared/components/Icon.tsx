export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={className ? `ms ${className}` : "ms"} aria-hidden="true">
      {name}
    </span>
  );
}
