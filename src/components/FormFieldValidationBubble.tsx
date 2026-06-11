/** Dark zinc + blue field validation bubble (replaces browser-native yellow popups). */
export function FormFieldValidationBubble({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`pointer-events-none absolute bottom-full left-0 z-10 mb-2 flex max-w-[16rem] items-start gap-2 rounded-lg border border-blue-500/30 bg-zinc-950 px-2.5 py-2 text-xs leading-snug text-zinc-200 shadow-lg shadow-black/40 ring-1 ring-blue-500/15 ${className}`.trim()}
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-blue-500/40 bg-blue-950/60 text-[10px] font-semibold leading-none text-blue-300"
        aria-hidden
      >
        !
      </span>
      <span>{message}</span>
    </div>
  );
}

/** Form-level validation message matching the field bubble scheme. */
export function FormValidationAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-zinc-950 px-3 py-2 text-sm leading-snug text-zinc-200 ring-1 ring-blue-500/15"
    >
      <span
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-blue-500/40 bg-blue-950/60 text-[10px] font-semibold leading-none text-blue-300"
        aria-hidden
      >
        !
      </span>
      <span>{message}</span>
    </div>
  );
}
