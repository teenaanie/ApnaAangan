import Link from "next/link";
import { BRAND } from "@/lib/brand";

/**
 * The Aangan logo, built to the brand guideline.
 *
 * Three things from the guideline drive this file.
 *
 * RECOLOURING. The guideline's Do's permit the mark in any palette colour or
 * warm complementary — sage, mustard, sandstone, cream, black are all shown as
 * acceptable. That is only possible if the artwork is inline SVG inheriting
 * `currentColor`; served as an <img> it can never change colour, which is why
 * it once rendered black on a coloured header.
 *
 * MINIMUM SIZES. App icon 60px, wordmark 160x50px, full logo 140x165px
 * (digital). These are floors, not suggestions — below them the four diamonds
 * inside each home turn to mud. The components carry them as defaults so the
 * floor is the easy path.
 *
 * SPACING. The lockups are built on the guideline's module: the mark is 4x
 * square, and the gap between mark and wordmark is y = 1/2 x — that is, an
 * eighth of the mark's width. Hard-coding a pixel gap would drift the moment
 * anyone resizes the mark, so it is derived.
 */

export const MARK_VIEWBOX = "0.00 0.00 880.45 880.45";

/** Guideline minimums, digital, in px. */
export const LOGO_MIN = {
  markOnly: 60,
  wordmark: { w: 160, h: 50 },
  full: { w: 140, h: 165 },
} as const;

export function Mark({
  size = LOGO_MIN.markOnly,
  className = "",
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      fill="currentColor"
      className={`shrink-0 ${className}`}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g transform="translate(0.000000,871.000000) scale(0.100000,-0.100000)" stroke="none">
      <path d="M5 6823 l7 -1888 27 -49 c33 -62 102 -121 172 -146 99 -37 227 -22
      304 35 17 13 98 89 180 171 83 82 175 172 205 200 l55 52 85 -15 c47 -7 139
      -22 205 -33 66 -10 127 -21 135 -24 8 -3 60 -12 115 -21 55 -8 165 -26 245
      -40 80 -14 199 -34 265 -45 190 -31 263 -45 269 -51 3 -3 -10 -91 -30 -195
      -19 -104 -40 -215 -46 -247 -5 -32 -8 -60 -6 -62 2 -2 44 0 93 5 50 5 122 10
      162 10 l72 0 9 38 c5 20 16 80 25 132 21 128 67 281 121 402 9 21 16 42 16 48
      0 5 4 10 8 10 5 0 15 18 22 41 8 22 17 42 21 45 5 3 16 22 26 42 9 20 21 42
      25 47 5 6 23 33 40 60 57 89 196 251 291 340 162 150 372 285 563 361 49 19
      98 40 109 45 31 15 161 49 250 65 44 8 106 20 138 26 l57 12 0 164 0 163 -47
      -6 c-27 -4 -66 -11 -88 -17 -22 -6 -74 -16 -115 -23 -41 -7 -112 -20 -158 -30
      -46 -9 -86 -15 -89 -12 -6 6 -25 106 -53 282 -11 66 -24 145 -30 175 -26 142
      -75 425 -100 580 -11 63 -24 140 -30 170 -5 30 -12 68 -15 83 -5 29 -21 12
      345 387 99 102 130 165 130 269 0 131 -66 246 -174 304 l-41 22 -1888 3 -1888
      2 6 -1887z m3645 1556 c0 -6 -109 -121 -242 -256 -146 -147 -242 -251 -241
      -261 3 -25 50 -298 78 -457 14 -77 32 -185 40 -240 9 -55 18 -107 20 -115 3
      -8 14 -71 25 -140 11 -69 31 -192 45 -275 15 -82 33 -190 41 -240 l15 -90 -28
      -22 c-15 -13 -31 -23 -35 -23 -8 0 -110 -62 -118 -71 -3 -3 -16 -12 -30 -19
      -28 -15 -196 -139 -250 -185 -19 -16 -78 -72 -131 -125 -166 -165 -263 -294
      -394 -524 l-27 -48 -72 6 c-39 4 -88 11 -108 17 -20 5 -79 16 -130 24 -93 14
      -312 49 -528 85 -63 10 -187 31 -275 45 -88 15 -214 35 -280 47 -217 36 -184
      45 -310 -78 -60 -59 -167 -163 -236 -231 -69 -67 -131 -123 -137 -123 -15 0
      -22 3292 -7 3302 6 4 754 8 1663 8 1210 0 1652 -3 1652 -11z"/>
      <path d="M1725 7416 l-165 -166 169 -169 169 -168 154 160 c84 87 158 164 164
      170 8 8 -31 53 -140 162 -83 82 -159 156 -168 163 -16 13 -35 -4 -183 -152z"/>
      <path d="M1297 6988 l-166 -165 166 -166 c133 -134 169 -165 182 -157 9 5 85
      78 168 163 l153 152 -169 169 -168 168 -166 -164z"/>
      <path d="M2150 6993 c-88 -87 -160 -160 -160 -164 0 -11 315 -329 326 -329 8
      0 219 207 333 326 6 5 -320 324 -331 324 -5 0 -81 -71 -168 -157z"/>
      <path d="M1732 6557 c-89 -89 -162 -167 -162 -172 0 -9 304 -307 320 -313 9
      -3 314 304 318 320 1 7 -69 84 -155 170 l-158 158 -163 -163z"/>
      <path d="M5075 8703 c-37 -8 -110 -45 -147 -75 -21 -16 -50 -55 -67 -90 -28
      -55 -31 -70 -31 -156 0 -125 17 -156 156 -299 310 -317 314 -321 314 -349 0
      -15 -9 -77 -20 -138 -35 -196 -60 -339 -70 -406 -10 -61 -35 -204 -81 -470
      -11 -63 -26 -152 -34 -198 -7 -46 -16 -86 -19 -89 -7 -8 -195 25 -356 62 -36
      8 -84 18 -107 21 l-43 7 0 -162 0 -161 26 -11 c15 -5 61 -14 103 -20 240 -32
      525 -142 746 -287 84 -55 74 -48 155 -115 130 -109 267 -256 356 -383 166
      -239 278 -521 323 -809 l17 -110 37 1 c200 2 274 6 285 12 9 6 10 19 1 58 -5
      27 -17 83 -25 124 -8 41 -26 126 -40 189 -14 62 -22 116 -19 119 7 7 83 22
      275 52 116 18 245 40 555 91 198 33 356 58 435 70 l75 11 210 -210 c146 -147
      222 -216 250 -228 22 -9 51 -20 64 -25 43 -17 153 -12 212 10 70 27 144 97
      176 169 l23 53 0 1874 0 1875 -1857 -1 c-1022 -1 -1867 -3 -1878 -6z m3409
      -329 c3 -9 6 -756 6 -1660 0 -1313 -3 -1644 -13 -1644 -11 0 -72 58 -419 397
      -71 69 -80 75 -110 70 -18 -3 -87 -15 -153 -26 -66 -11 -178 -29 -249 -40 -70
      -11 -149 -24 -175 -30 -25 -6 -93 -18 -151 -27 -97 -14 -223 -35 -520 -84
      -252 -41 -295 -48 -304 -43 -4 3 -17 24 -28 47 -40 86 -122 213 -211 326 -147
      188 -355 379 -547 501 -115 73 -119 75 -169 101 -24 13 -45 28 -48 34 -4 12 9
      106 51 354 14 80 34 199 45 265 28 164 67 397 92 535 11 63 29 169 40 235 10
      66 22 134 25 150 5 28 -3 40 -98 138 -243 251 -363 380 -366 393 -4 17 144 18
      2024 22 1152 2 1272 1 1278 -14z"/>
      <path d="M6755 7414 l-165 -167 82 -81 c46 -45 122 -119 170 -165 l86 -83 167
      167 167 167 -39 40 c-98 101 -285 283 -293 286 -6 2 -84 -72 -175 -164z"/>
      <path d="M7185 6990 l-169 -170 161 -160 c88 -88 165 -160 170 -160 4 0 82 74
      173 165 l164 164 -74 78 c-41 43 -116 117 -165 165 l-91 88 -169 -170z"/>
      <path d="M6330 6989 c-88 -90 -160 -168 -160 -172 0 -9 24 -33 199 -197 61
      -57 119 -108 127 -113 12 -7 51 27 170 146 85 85 154 160 154 166 0 10 -270
      286 -313 320 -15 12 -34 -4 -177 -150z"/>
      <path d="M6775 6567 c-82 -83 -156 -159 -163 -169 -11 -14 7 -36 149 -178
      l161 -162 26 28 c14 16 88 92 164 169 l137 141 -162 162 -162 162 -150 -153z"/>
      <path d="M2190 4124 c0 -14 54 -301 70 -369 17 -74 19 -104 10 -110 -5 -3 -69
      -15 -142 -26 -73 -12 -185 -30 -248 -40 -63 -10 -175 -28 -248 -39 -74 -11
      -150 -24 -170 -29 -20 -5 -80 -15 -132 -21 -52 -6 -108 -15 -125 -19 -16 -5
      -83 -17 -149 -26 l-119 -16 -39 38 c-22 21 -124 121 -226 221 -103 101 -200
      190 -217 197 -85 36 -215 25 -301 -27 -54 -32 -102 -93 -131 -168 -17 -42 -18
      -147 -21 -1867 l-2 -1823 1863 0 c1520 0 1872 2 1914 13 82 22 144 85 190 196
      31 74 30 152 -2 233 -23 57 -46 83 -235 273 l-210 210 6 45 c4 25 10 52 14 60
      4 8 13 60 19 115 7 55 16 114 21 130 6 17 19 86 29 155 11 69 29 177 41 240
      11 63 29 169 40 235 11 66 26 154 33 195 7 41 17 75 22 75 33 -1 139 -18 162
      -26 26 -8 205 -42 296 -56 l37 -5 0 160 c0 186 17 163 -142 192 -161 29 -311
      72 -418 121 -89 41 -224 111 -263 137 -22 15 -53 35 -70 45 -107 65 -306 250
      -410 382 -82 104 -155 209 -168 243 -6 15 -13 29 -17 32 -15 11 -112 221 -112
      242 0 7 -7 26 -15 42 -20 38 -53 161 -72 266 -8 47 -19 104 -25 127 -10 40
      -13 42 -52 47 -22 3 -96 7 -163 10 -100 3 -123 2 -123 -10z m-1792 -631 c27
      -27 132 -127 233 -225 101 -97 186 -179 189 -181 3 -3 46 1 95 9 50 7 148 23
      220 33 71 11 150 25 175 30 25 6 72 13 105 17 33 3 80 11 105 16 44 10 140 25
      425 67 77 12 147 23 155 26 8 3 75 14 150 24 74 11 141 21 149 22 8 3 28 -20
      48 -56 103 -177 195 -313 280 -412 74 -86 226 -233 303 -291 19 -15 37 -29 40
      -32 14 -15 166 -112 250 -160 52 -30 98 -58 101 -63 3 -4 0 -43 -7 -85 -7 -42
      -20 -122 -29 -177 -8 -55 -20 -123 -26 -151 -5 -28 -19 -106 -30 -175 -34
      -214 -57 -349 -84 -504 -46 -265 -65 -380 -65 -397 0 -9 102 -121 228 -248
      125 -127 228 -235 230 -239 3 -9 -3283 -22 -3306 -13 -13 5 -14 38 -9 266 4
      144 7 865 7 1604 0 824 4 1342 9 1342 5 0 32 -21 59 -47z"/>
      <path d="M1731 2419 c-89 -88 -161 -165 -161 -171 0 -5 73 -82 163 -169 l162
      -159 150 153 c83 83 156 160 163 169 11 14 -7 36 -147 177 -87 89 -162 161
      -164 161 -3 0 -78 -72 -166 -161z"/>
      <path d="M2151 1995 l-165 -166 65 -66 c200 -205 259 -263 266 -263 5 0 82 74
      172 164 l164 164 -166 166 c-91 91 -168 166 -169 166 -2 0 -77 -74 -167 -165z"/>
      <path d="M1300 1988 l-161 -162 165 -165 166 -165 167 166 167 167 -165 160
      c-90 88 -167 161 -171 161 -4 0 -80 -73 -168 -162z"/>
      <path d="M1727 1572 c-86 -86 -157 -162 -157 -167 0 -6 73 -84 163 -173 l163
      -162 130 133 c71 72 145 149 164 170 l34 37 -164 160 c-90 88 -167 160 -170
      160 -3 0 -76 -71 -163 -158z"/>
      <path d="M6444 4127 l-152 -9 -12 -82 c-15 -98 -51 -246 -84 -341 -22 -65 -34
      -94 -89 -215 -31 -70 -134 -237 -199 -323 -73 -96 -221 -249 -306 -316 -262
      -207 -542 -337 -852 -397 -41 -8 -99 -19 -127 -25 l-53 -10 0 -158 c0 -87 2
      -160 5 -163 3 -3 25 -1 48 4 23 5 94 18 157 28 63 11 134 24 157 31 23 6 65
      12 94 13 l53 1 12 -75 c14 -87 42 -252 79 -465 14 -82 35 -202 45 -265 10 -63
      30 -182 44 -264 14 -83 26 -158 26 -168 0 -9 -94 -111 -209 -226 -120 -120
      -218 -226 -230 -250 -27 -53 -29 -180 -4 -244 38 -100 129 -180 222 -198 35
      -6 696 -10 1897 -10 l1844 0 0 1813 c0 1755 -1 1816 -19 1869 -27 78 -64 132
      -113 166 -81 55 -165 70 -266 47 -68 -16 -76 -21 -164 -102 -51 -48 -157 -148
      -235 -225 -78 -76 -145 -138 -150 -138 -10 1 -221 34 -378 60 -184 30 -409 67
      -520 84 -55 9 -136 23 -180 31 -44 8 -113 19 -154 24 -40 5 -78 14 -83 19 -7
      7 -6 30 1 69 6 32 20 110 32 173 11 63 24 129 29 145 4 17 11 47 15 68 5 32 3
      37 -12 35 -10 0 -86 -5 -169 -11z m2039 -1504 c11 -1494 9 -2290 -5 -2295 -7
      -2 -753 -1 -1658 2 l-1645 5 180 184 c261 266 260 265 272 281 12 16 0 116
      -47 375 -11 61 -29 169 -40 240 -11 72 -23 137 -26 145 -3 8 -14 68 -25 135
      -10 66 -30 185 -44 265 -48 281 -56 334 -51 347 3 6 24 22 48 34 54 27 277
      178 343 232 163 134 294 270 406 422 33 44 63 85 67 90 5 6 40 66 78 133 64
      115 71 123 94 117 14 -3 79 -15 145 -25 66 -11 192 -31 280 -45 88 -15 203
      -33 255 -40 52 -8 131 -21 175 -29 44 -9 125 -23 180 -31 197 -32 341 -55 429
      -69 l90 -15 35 33 c50 44 224 211 344 329 54 53 103 97 106 97 4 0 11 -412 14
      -917z"/>
      <path d="M6755 2414 l-164 -167 156 -151 c86 -83 162 -157 169 -163 10 -10 41
      17 159 136 80 81 153 158 162 171 15 22 12 26 -133 172 -82 82 -157 154 -167
      159 -15 8 -44 -17 -182 -157z"/>
      <path d="M7184 2000 c-87 -88 -159 -165 -159 -170 0 -11 311 -330 322 -330 4
      0 81 74 171 164 l163 163 -162 166 c-89 92 -165 167 -168 167 -4 0 -79 -72
      -167 -160z"/>
      <path d="M6329 1989 l-162 -162 167 -166 166 -165 166 166 166 166 -161 161
      c-89 88 -166 161 -171 161 -6 0 -83 -73 -171 -161z"/>
      <path d="M6752 1567 l-162 -162 169 -168 168 -168 114 117 c63 65 135 138 162
      164 26 25 47 49 47 53 0 9 -319 327 -328 327 -4 0 -80 -73 -170 -163z"/>
      </g>
    </svg>
  );
}

/**
 * The wordmark is set type, not drawn lettering — the guideline shows it in the
 * title serif. Kept as a component so that if drawn artwork ever arrives, one
 * file changes.
 */
export function Wordmark({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`display font-bold tracking-tight leading-none whitespace-nowrap ${className}`}
      style={style}
    >
      {BRAND.name}
    </span>
  );
}

type Variant = "horizontal" | "vertical" | "mark" | "wordmark" | "responsive";

/**
 * `markSize` is the width of the mark in px and everything else follows from
 * it, exactly as the construction grid does.
 */
export function Logo({
  variant = "horizontal",
  markSize = LOGO_MIN.markOnly,
  href = "/",
  subtitle,
  className = "",
}: {
  variant?: Variant;
  markSize?: number;
  href?: string | null;
  subtitle?: string;
  className?: string;
}) {
  // x = one module = a quarter of the mark. y = half a module.
  const x = markSize / 4;
  const y = x / 2;
  // The wordmark's cap height reads best at roughly half the mark; the
  // guideline's own horizontal lockup sits in that proportion.
  const wordSize = Math.round(markSize * 0.52);

  // "responsive" is the guideline's own answer to a narrow header rather than a
  // compromise: Logo Mark is the PRIMARY variation, meant for exactly the places
  // where the brand is already established or space is tight. Shrinking the
  // horizontal lockup below its minimum instead would break a stated rule; this
  // swaps to a variation that is correct at 60px.
  if (variant === "responsive") {
    return (
      <>
        <span className="sm:hidden">
          <Logo variant="mark" markSize={markSize} href={href} className={className} />
        </span>
        <span className="hidden sm:inline-flex">
          <Logo
            variant="horizontal"
            markSize={markSize}
            href={href}
            subtitle={subtitle}
            className={className}
          />
        </span>
      </>
    );
  }

  const inner =
    variant === "mark" ? (
      <Mark size={markSize} title="Aangan" />
    ) : variant === "wordmark" ? (
      <Wordmark style={{ fontSize: wordSize }} />
    ) : variant === "vertical" ? (
      <span className="inline-flex flex-col items-center" style={{ gap: y }}>
        <Mark size={markSize} />
        <Wordmark style={{ fontSize: wordSize }} />
      </span>
    ) : (
      <span className="inline-flex items-center" style={{ gap: y }}>
        <Mark size={markSize} />
        <span className="leading-none">
          <Wordmark style={{ fontSize: wordSize }} className="block" />
          {subtitle && (
            <span
              className="block uppercase tracking-[0.14em] text-charcoal-faint"
              style={{ fontSize: Math.max(9, Math.round(markSize * 0.17)), marginTop: y / 2 }}
            >
              {subtitle}
            </span>
          )}
        </span>
      </span>
    );

  const body = <span className={`text-terracotta ${className}`}>{inner}</span>;

  return href ? (
    <Link href={href} className="inline-flex shrink-0">
      {body}
    </Link>
  ) : (
    body
  );
}
