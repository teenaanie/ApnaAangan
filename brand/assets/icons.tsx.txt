/**
 * The Aangan icon set.
 *
 * Built to the Graphics and Icons sheet (`brand/assets/guideline-icons.png`).
 * Measured off the artwork rather than guessed: the icons are drawn at 190px
 * in the deck with a 13.5px stroke, which is 1.7 on a 24 grid. Everything here
 * uses that one weight, round caps and round joins, no fills, and
 * `currentColor` — so an icon takes the colour of whatever it sits in, exactly
 * like the logo mark does.
 *
 * The guideline supplies fifteen icons. Twelve of them are here, redrawn; the
 * three the app has no use for (globe, shopping cart, shopping bag — Aangan
 * never handles a basket) are left out rather than carried for completeness.
 * Everything below the divider is drawn in the same style for something the
 * app needs and the sheet does not cover; those are marked in
 * `brand/references/iconography.md` as extensions, not guideline.
 *
 * One weight, one grid, one colour source. If an icon needs to be heavier,
 * it is being used too small.
 */

type IconProps = {
  size?: number;
  className?: string;
  /** Decorative by default. Pass a label when the icon is the only content. */
  label?: string;
};

function Svg({ size = 20, className = "", label, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

/* ===================================================== from the guideline == */

export const Person = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </Svg>
);

export const People = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8.4" r="3.1" />
    <path d="M3.2 19.5a5.8 5.8 0 0 1 11.6 0" />
    <path d="M16.2 5.9a3.1 3.1 0 0 1 0 5" />
    <path d="M17.6 14.4a5.8 5.8 0 0 1 3.2 5.1" />
  </Svg>
);

/** The shopfront. In the app it means a society, not a shop. */
export const Building = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.6 20.4V7.6a1 1 0 0 1 .7-1l6.4-2.1a1 1 0 0 1 .6 0l6.4 2.1a1 1 0 0 1 .7 1v12.8" />
    <path d="M2.8 20.4h18.4" />
    <path d="M8.2 10.2h7.6" />
    <path d="M8.2 13.4h7.6" />
    <path d="M9.9 20.4v-3.6h4.2v3.6" />
  </Svg>
);

/** The open carton from the sheet — flaps out, not a sealed cube. */
export const Box = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.4 9.6v9.2a1 1 0 0 0 .7 1l6.6 1.7a1 1 0 0 0 .6 0l6.6-1.7a1 1 0 0 0 .7-1V9.6" />
    <path d="m4.4 9.6-2.6-2.9 5.4-2 4.8 3.9" />
    <path d="m19.6 9.6 2.6-2.9-5.4-2L12 8.6" />
    <path d="M4.4 9.6h15.2" />
    <path d="M12 8.6v12.9" />
  </Svg>
);

export const Chart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 3.5v17h17" />
    <rect x="6.6" y="12" width="3.2" height="5.4" rx="0.6" />
    <rect x="11.9" y="7.6" width="3.2" height="9.8" rx="0.6" />
    <rect x="17.2" y="10.2" width="3.2" height="7.2" rx="0.6" />
  </Svg>
);

export const Card = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.6" y="5" width="18.8" height="14" rx="2.4" />
    <path d="M2.6 9.8h18.8" />
    <path d="M6 14.4h3.4" />
    <path d="M12.2 14.4h1.8" />
  </Svg>
);

export const Clock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.4V12l3.1 1.9" />
  </Svg>
);

export const Tag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3.6h9.4a2 2 0 0 1 1.7 1l3 5a2 2 0 0 1 0 2l-3 5a2 2 0 0 1-1.7 1H6a2 2 0 0 1-2-2V5.6a2 2 0 0 1 2-2Z" />
    <path d="M7.6 14.6h7.2" />
    <circle cx="17.4" cy="10.6" r="0.1" />
  </Svg>
);

export const Envelope = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.6" y="4.8" width="18.8" height="14.4" rx="1.6" />
    <path d="M2.6 6.2 12 13.4l9.4-7.2" />
  </Svg>
);

export const Gift = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="8.6" width="18" height="12.4" rx="1.6" />
    <path d="M3 12.9h18" />
    <path d="M12 8.6V21" />
    <path d="M12 8.6C10.6 5.4 9.4 3.6 7.9 3.6a2.3 2.3 0 0 0 0 5Z" />
    <path d="M12 8.6c1.4-3.2 2.6-5 4.1-5a2.3 2.3 0 0 1 0 5Z" />
  </Svg>
);

export const Chat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.6 15.2a2 2 0 0 1-2 2h-8.3L6 21v-3.8H4.4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14.2a2 2 0 0 1 2 2Z" />
    <circle cx="8.4" cy="10.6" r="0.1" />
    <circle cx="12" cy="10.6" r="0.1" />
    <circle cx="15.6" cy="10.6" r="0.1" />
  </Svg>
);

export const Calendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5.4" width="18" height="15.2" rx="2" />
    <path d="M3 10.2h18" />
    <path d="M7.8 3.4v3.6" />
    <path d="M16.2 3.4v3.6" />
    <path d="M7 13.6h1.6M11.2 13.6h1.6M15.4 13.6H17" />
    <path d="M7 17.1h1.6M11.2 17.1h1.6M15.4 17.1H17" />
  </Svg>
);

/* ============================================ extensions — see iconography.md */

export const Info = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11.2v5" />
    <path d="M12 7.7v.1" />
  </Svg>
);

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 19.2 7.8 12 15 4.8" />
  </Svg>
);

export const Download = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.2v11.4" />
    <path d="m7.2 10.4 4.8 4.8 4.8-4.8" />
    <path d="M4 19.6h16" />
  </Svg>
);

export const Phone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.1 3.4H5.4a2 2 0 0 0-2 2.2c.5 5.2 4.6 12.7 13 15a2 2 0 0 0 2.5-1.9v-2.6a1.4 1.4 0 0 0-1.1-1.4l-2.6-.5a1.4 1.4 0 0 0-1.4.6l-.7 1a11.7 11.7 0 0 1-5-5l1-.7a1.4 1.4 0 0 0 .6-1.4l-.5-2.6a1.4 1.4 0 0 0-1.1-1.1Z" />
  </Svg>
);

export const WhatsApp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.4 20.6 4.9 16A8.4 8.4 0 1 1 8 19.1Z" />
    <path d="M9 8.4h.9l.9 2.1-.8.9a6 6 0 0 0 2.6 2.6l.9-.8 2.1.9v.9a1.3 1.3 0 0 1-1.5 1.2 8 8 0 0 1-5.9-5.9A1.3 1.3 0 0 1 9 8.4Z" />
  </Svg>
);

export const Search = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.8" cy="10.8" r="7" />
    <path d="m16 16 4.6 4.6" />
  </Svg>
);

export const Check = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4.5 12.6 5 5 10-11" />
  </Svg>
);

export const Pause = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.4 4.6v14.8" />
    <path d="M14.6 4.6v14.8" />
  </Svg>
);

export const Pencil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4.2L20 8.2a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8Z" />
    <path d="m14.6 6.6 2.8 2.8" />
  </Svg>
);

export const MapPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21.2c4-4 6-7.2 6-9.8a6 6 0 1 0-12 0c0 2.6 2 5.8 6 9.8Z" />
    <circle cx="12" cy="11.2" r="2.4" />
  </Svg>
);

export const Link = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 13.6a3.8 3.8 0 0 0 5.6.4l2.8-2.8a3.8 3.8 0 0 0-5.4-5.4l-1.5 1.5" />
    <path d="M14 10.4a3.8 3.8 0 0 0-5.6-.4l-2.8 2.8a3.8 3.8 0 0 0 5.4 5.4l1.5-1.5" />
  </Svg>
);

/* ============================================================== categories ==
   One per seeded category slug, drawn in the same style. The DB still holds an
   emoji per category and per listing; these take precedence where a slug
   matches and the emoji remains the fallback, so nothing breaks for a category
   added later and a provider's own choice of emoji is untouched. */

export const CatFood = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.4 11.4h17.2a8.6 8.6 0 0 1-8.6 7.2 8.6 8.6 0 0 1-8.6-7.2Z" />
    <path d="M2.6 21h18.8" />
    <path d="M9 8.2c0-1.2 1.2-1.4 1.2-2.6S9 3.4 9 3.4" />
    <path d="M14.4 8.2c0-1.2 1.2-1.4 1.2-2.6s-1.2-2.2-1.2-2.2" />
  </Svg>
);

export const CatLearn = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 6.4C10.2 4.9 7.6 4.2 4 4.2v13c3.6 0 6.2.7 8 2.2 1.8-1.5 4.4-2.2 8-2.2v-13c-3.6 0-6.2.7-8 2.2Z" />
    <path d="M12 6.4v13" />
  </Svg>
);

/** A lotus. Beauty and wellness, without reaching for a lipstick. */
export const CatBeauty = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19.4c-2 0-3.6-1.9-3.6-4.3S10 8.4 12 6.2c2 2.2 3.6 6.5 3.6 8.9s-1.6 4.3-3.6 4.3Z" />
    <path d="M8.6 12.4c-1.6-1-3.4-1.3-5.2-1 .3 4.2 3.6 8 8.6 8" />
    <path d="M15.4 12.4c1.6-1 3.4-1.3 5.2-1-.3 4.2-3.6 8-8.6 8" />
  </Svg>
);

export const CatHome = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.8" y="8.2" width="18.4" height="11.6" rx="2" />
    <path d="M8.6 8.2V6a1.8 1.8 0 0 1 1.8-1.8h3.2A1.8 1.8 0 0 1 15.4 6v2.2" />
    <path d="M2.8 13.2h18.4" />
    <path d="M10.4 13.2v2.2h3.2v-2.2" />
  </Svg>
);

export const CatKids = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.4a8.6 8.6 0 0 0 0 17.2c1.4 0 1.9-1 1.4-1.9-.6-1.1.2-2.3 1.5-2.3h1.5a4.2 4.2 0 0 0 4.2-4.2C20.6 7.2 16.7 3.4 12 3.4Z" />
    <circle cx="8" cy="9.4" r="0.1" />
    <circle cx="12" cy="7.6" r="0.1" />
    <circle cx="16" cy="9.4" r="0.1" />
  </Svg>
);

export const CatPets = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="6.4" cy="10.4" rx="2" ry="2.6" />
    <ellipse cx="17.6" cy="10.4" rx="2" ry="2.6" />
    <ellipse cx="10" cy="5.9" rx="1.9" ry="2.4" />
    <ellipse cx="14" cy="5.9" rx="1.9" ry="2.4" />
    <path d="M12 12.4c2.9 0 5.2 2.2 5.2 4.6 0 2-1.6 3.4-3.5 3.4-1 0-1.2-.4-1.7-.4s-.7.4-1.7.4c-1.9 0-3.5-1.4-3.5-3.4 0-2.4 2.3-4.6 5.2-4.6Z" />
  </Svg>
);

export const CatEvents = Gift;

export const CatRepair = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6.2a5.2 5.2 0 0 1-6.9 6.9L6 20.2a2.2 2.2 0 0 1-3.1-3.1l7.1-7.1A5.2 5.2 0 0 1 16.9 3l-3 3 1.2 3.9L19 11Z" />
  </Svg>
);

/** slug → icon. Anything not listed falls back to the emoji in the database. */
export const CATEGORY_ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  food: CatFood,
  learn: CatLearn,
  beauty: CatBeauty,
  home: CatHome,
  kids: CatKids,
  pets: CatPets,
  events: CatEvents,
  repair: CatRepair,
};

/**
 * The icon for a category, or its emoji if we have not drawn one.
 * Keeping the emoji fallback means adding a category in the admin screen never
 * produces a blank square.
 */
export function CategoryIcon({
  slug,
  emoji,
  size = 20,
  className = "",
}: {
  slug?: string | null;
  emoji?: string | null;
  size?: number;
  className?: string;
}) {
  const Drawn = slug ? CATEGORY_ICONS[slug] : undefined;
  if (Drawn) return <Drawn size={size} className={className} />;
  return (
    <span className={className} style={{ fontSize: size, lineHeight: 1 }} aria-hidden>
      {emoji || "✦"}
    </span>
  );
}
