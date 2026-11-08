import type { HeatCell } from "./mock";

export function RecordsPanel({ cells }: { cells: HeatCell[] }) {
  const top = [...cells].sort((x, y) => y.days - x.days).slice(0, 10);
  const max = top[0]?.days ?? 1;

  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-2">
        <span
          aria-hidden
          className="h-2.5 w-10 shrink-0 rounded-full bg-linear-to-r from-heatmap/10 to-heatmap"
        />
        <p className="truncate text-xs text-muted-foreground">
          진할수록 더 여러 날 간 곳 · 같은 날 여러 장은 하루로 셈
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto *:shrink-0 pt-3 pb-6">
        <h3 className="px-2 text-xs font-extrabold text-muted-foreground">
          만난 뒤 자주 간 곳
        </h3>
        <ol className="flex flex-col">
          {top.map((cell, i) => (
            <li
              key={cell.place}
              className="flex min-h-11 items-center gap-3 rounded-lg px-2"
            >
              <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{cell.place}</span>
                <span
                  aria-hidden
                  className="mt-1 block h-1 rounded-full bg-heatmap"
                  style={{
                    width: `${(cell.days / max) * 100}%`,
                    opacity: 0.25 + (cell.days / max) * 0.75,
                  }}
                />
              </span>
              <span className="shrink-0 text-xs font-medium tabular-nums">
                {cell.days}일
              </span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
