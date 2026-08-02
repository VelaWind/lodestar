/**
 * Lodestar content model.
 *
 * Every topic is a Module: one typed data file that renders as seven
 * progressive-disclosure layers. Nothing here knows about React — this file is
 * the contract between "someone authoring a topic" and "the shell". Adding a
 * module must never require touching the shell, so every rendering decision the
 * shell needs to make has to be expressible in these types.
 */

/* ------------------------------------------------------------------ */
/* Parameters                                                          */
/* ------------------------------------------------------------------ */

/**
 * A single physical knob, in SI units. This is the load-bearing type of the
 * whole app: the sim integrates against these numbers, the equation layer
 * substitutes these numbers, and the sliders bound these numbers. There is
 * exactly one source of truth per quantity and it lives here.
 */
export interface Param {
  /** Stable key, unique within a module. Referenced by equations and sims. */
  id: string;
  /**
   * How the knob reads to someone who has not met the symbol yet: a question or
   * a plain phrase, not a term of art. "How heavy is the body?" rather than
   * "Gravitating mass". Shown at the Curious and Student tiers.
   */
  friendlyLabel: string;
  /**
   * The name a textbook would use for this quantity. Shown beside `symbol` at
   * the Deep tier, where naming the thing precisely is the point.
   */
  technicalLabel: string;
  /** LaTeX for the symbol, without delimiters. e.g. `M_\oplus`, `v_{\text{esc}}` */
  symbol: string;
  /** SI unit as a plain string. e.g. "kg", "m", "m/s", "W/m^2" */
  unit: string;
  /** Bounds and default are all in the SI base unit above — never in display units. */
  min: number;
  max: number;
  default: number;
  /**
   * Slider granularity. For `scale: 'linear'` this is a step in SI units. For
   * `scale: 'log'` it is a step in *decades* (0.01 → 100 stops per decade).
   */
  step: number;
  /**
   * Log scale is the norm in astrophysics — a mass slider that spans asteroid
   * to star is unusable linearly.
   */
  scale: 'linear' | 'log';
  /** Optional hint for how to print the value. Display only; never affects math. */
  format?: ParamFormat;
}

export interface ParamFormat {
  /**
   * 'auto' picks fixed vs scientific from magnitude (the default),
   * 'fixed' forces decimal, 'scientific' forces mantissa × 10^exp.
   */
  notation?: 'auto' | 'fixed' | 'scientific';
  /** Significant digits (scientific/auto) or decimal places (fixed). Default 3. */
  digits?: number;
  /**
   * Show the value in a friendlier unit without changing the stored SI value.
   * `displayed = si * factor`. e.g. { unit: 'km', factor: 1e-3 }
   */
  displayUnit?: { unit: string; factor: number };
}

/** Live values for a module, keyed by `Param.id`, always in SI units. */
export type ParamValues = Record<string, number>;

/**
 * A new value for a param, or a function of its current one.
 *
 * The updater form is what the keyboard needs: a held arrow fires faster than
 * React re-renders, and a handler computing from its rendered prop would apply
 * the same move from the same stale start and drop presses.
 */
export type ParamUpdate = number | ((current: number) => number);

/* ------------------------------------------------------------------ */
/* Rich text                                                           */
/* ------------------------------------------------------------------ */

/**
 * Why a hand-rolled AST instead of markdown or MDX:
 *
 * 1. No runtime parser. Markdown means shipping a parser and parsing on every
 *    render (or memoising around it). This AST *is* the parsed form — authored
 *    once, at author time, checked by tsc.
 * 2. Inline math is a first-class node, not an escape hatch. In markdown, `$…$`
 *    requires a plugin and fights the parser over backslashes; here a LaTeX
 *    string is just a string in a `math` node, no escaping games beyond TS's own.
 * 3. Typos are compile errors. A malformed link in markdown renders as garbage;
 *    a malformed link here doesn't build.
 *
 * The cost is verbosity when authoring, which `rich.ts` helpers absorb.
 * Deliberately minimal: emphasis, code, links, math. Add node kinds when a
 * module actually needs them — every kind added is a case the renderer must
 * handle forever.
 */
export type Inline =
  | string
  | { k: 'em'; children: Inline[] }
  | { k: 'strong'; children: Inline[] }
  | { k: 'code'; text: string }
  | { k: 'link'; href: string; children: Inline[] }
  /** Inline KaTeX. `tex` is the body only — no `$` delimiters. */
  | { k: 'math'; tex: string };

export type Block =
  | { k: 'p'; children: Inline[] }
  /** Subheading *within* a layer. Layer titles come from the layer registry. */
  | { k: 'h'; children: Inline[] }
  | { k: 'ul'; items: Inline[][] }
  | { k: 'ol'; items: Inline[][] }
  | { k: 'quote'; children: Inline[]; cite?: string }
  /** Set-aside callout: a tangent that shouldn't break the main thread. */
  | { k: 'aside'; title?: string; children: Block[] }
  /** Display math that is *prose*, not a bound equation — see EquationLayer. */
  | { k: 'mathBlock'; tex: string; caption?: Inline[] };

export type RichText = Block[];

/* ------------------------------------------------------------------ */
/* Layers                                                              */
/* ------------------------------------------------------------------ */

/** The seven layers, in canonical order. Order lives in `lib/layers.ts`. */
export type LayerId =
  | 'hook'
  | 'intuition'
  | 'play'
  | 'real'
  | 'math'
  | 'deeper'
  | 'connections';

/** Layers 1, 2, 4, 6 — prose. */
export interface RichLayer {
  body: RichText;
}

/** Layer 3 — the interactive one. */
export interface SimLayer {
  /**
   * Key into the sim registry, which is the sim's filename in `src/sims/`
   * without extension. String rather than a component import so module data
   * files stay pure data (serialisable, no React import, no bundle weight).
   */
  simKey: string;
  /** The knobs this sim exposes. The shell renders the controls, not the sim. */
  params: Param[];
  /**
   * What the sim quietly lies about. Rendered as a disclosure panel beside the
   * sim so the simplification is visible rather than implied — required, not
   * optional, because every sim makes approximations and pretending otherwise
   * is the failure mode this app exists to avoid.
   */
  approximations: string[];
  /** Optional framing above the sim: what to try, what to notice. */
  caption?: RichText;
}

/** One equation in layer 5. */
export interface Equation {
  id: string;
  /**
   * LaTeX template. `{{paramId}}` placeholders are substituted at render time
   * with either the param's `symbol` or its live formatted value, so the reader
   * can flip the same equation between algebra and arithmetic. Placeholders
   * that don't resolve render as the raw id — visible, not silent.
   */
  tex: string;
  /**
   * Param ids this equation binds. Drives the "used here" chips and lets the
   * shell verify (in dev) that every `{{…}}` corresponds to a real Param.
   */
  binds: string[];
  /** Optional derivation note or caveat under the equation. */
  note?: RichText;
}

/** Layer 5 — the math, reading the same Param objects the sim does. */
export interface EquationLayer {
  equations: Equation[];
  /** Optional lead-in prose before the first equation. */
  intro?: RichText;
}

/** Layer 7 — pointers to sibling modules. */
export interface ConnectionsLayer {
  links: { moduleId: string; reason: string }[];
}

export interface Layers {
  /** 1. Why you should care, in a few sentences. */
  hook: RichLayer;
  /** 2. The idea without the machinery. */
  intuition: RichLayer;
  /** 3. Play with it. */
  play: SimLayer;
  /** 4. The real picture — what actually happens out there. */
  real: RichLayer;
  /** 5. The math. */
  math: EquationLayer;
  /** 6. Going deeper — the parts the intuition layer papered over. */
  deeper: RichLayer;
  /** 7. Connections. */
  connections: ConnectionsLayer;
}

/* ------------------------------------------------------------------ */
/* Module                                                              */
/* ------------------------------------------------------------------ */

export interface Reference {
  /** What the link says: title, and whatever attribution belongs in the label. */
  label: string;
  url: string;
  /** Why this source is here — what it backs up, or what to read it for. */
  note?: string;
}

export interface Module {
  /** URL slug. Must match the data file's basename. */
  id: string;
  title: string;
  /** One line, shown on the index and under the title. */
  tagline: string;
  layers: Layers;
  references: Reference[];
  status: 'draft' | 'published';
}

/* ------------------------------------------------------------------ */
/* Sim contract                                                        */
/* ------------------------------------------------------------------ */

/**
 * Every sim component takes exactly this. Sliders, labels, units and formatting
 * are the shell's job — a sim receives already-validated SI numbers and draws.
 * `setValue` is for sims that are directly manipulable (drag the planet), which
 * writes back through the same store the sliders use.
 */
export interface SimProps {
  moduleId: string;
  params: Param[];
  values: ParamValues;
  setValue: (paramId: string, value: number) => void;
}
