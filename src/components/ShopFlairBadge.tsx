export function ShopFlairBadge(props: { label: string; className?: string }) {
  const { label, className } = props;
  return (
    <span
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-zinc-700/70 bg-zinc-950/30 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
      }
    >
      {label}
    </span>
  );
}
