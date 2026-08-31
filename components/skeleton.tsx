/**
 * What a page looks like while its data is on its way.
 *
 * Next.js renders these pages on the server, so a click does nothing visible
 * until the server has queried Supabase and sent HTML back. On a phone on
 * mobile data that gap is most of a second, and a gap with no feedback in it
 * does not read as "loading" — it reads as "the button is broken", which is
 * why people tap it again.
 *
 * A `loading.tsx` beside a page turns that same wait into an immediate
 * response: the shell appears at once and fills in. Nothing here is animated
 * beyond a slow pulse; a busy skeleton is its own kind of noise.
 */
export function Line({ w = "100%" }: { w?: string }) {
  return (
    <div
      className="h-3.5 rounded-full bg-sandstone-soft animate-pulse"
      style={{ width: w }}
    />
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ["70%", "95%", "45%", "80%"];
  return (
    <div className="bg-surface border border-sandstone-soft rounded-2xl p-4 flex flex-col gap-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <Line key={i} w={widths[i % widths.length]} />
      ))}
    </div>
  );
}

export function PageSkeleton({
  cards = 6,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  cards?: number;
  columns?: string;
}) {
  return (
    <div className="max-w-[var(--shell)] mx-auto px-4 py-9">
      <div className="flex flex-col gap-3 mb-8 max-w-md">
        <Line w="55%" />
        <Line w="80%" />
      </div>
      <div className={`grid gap-3.5 ${columns}`}>
        {Array.from({ length: cards }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
