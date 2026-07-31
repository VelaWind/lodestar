---
name: module-authoring
description: How to write, structure, and review a Lodestar learning module — the seven-layer format, depth tiers, the beginner voice, terminology rules, parameter definitions, references, and cross-links. Use this whenever adding a new topic, drafting or editing module copy, defining a module's sliders, writing the math or going-deeper layers, or reviewing an existing module for consistency. Trigger it even when the request just says "add a module about X" or "write the intro for the black hole page" without naming this skill.
---

# Authoring a Lodestar module

Every topic in Lodestar is a **module**. A module is one concept, unfolded in
seven layers, serving three audiences from the same source text: someone who has
never studied physics, a student who wants the working, and someone who already
knows the field and came for the depth.

The framework only works if every module has the same shape. Do not invent a new
layout for a topic because it "feels different." If a topic genuinely does not
fit the seven layers, that is a signal to split it into two modules, not to bend
the structure.

## Depth tiers

The reader picks a depth once and it persists across the site. Depth controls
which layers are **expanded by default** — it never changes the text.

| Tier | Expanded | Collapsed |
|---|---|---|
| Curious | 1, 2, 3 | 4, 5, 6, 7 |
| Student | 1, 2, 3, 4, 5 | 6, 7 |
| Deep | 4, 5, 6, 7 | 1, 2, 3 |

**Write one module, not three.** The single most damaging thing you can do to
this project is author separate beginner and advanced versions of a topic. They
will drift, they will contradict each other, and the authoring cost triples.
Every layer is written once, at its own level, and disclosure does the rest.

Every layer stays reachable at every tier. A curious reader can always open the
math; an expert can always collapse back to the analogy.

## The seven layers

Write them in order. Each must stand alone — a reader who stops after layer 2
should still have learned something true.

### 1. Hook
One or two sentences plus one striking visual. No jargon, no exponents, no
definitions. The job is to make someone want the next paragraph.

Good: "Light from the nearest star has been travelling for four years. You are
always looking at the past."
Bad: "Proxima Centauri is located at a distance of 4.24 light-years."

### 2. Intuition
The everyday analogy. Still no math, still no technical terms.

- **One analogy per module.** Two competing analogies confuse more than they help.
- **It must be physically honest.** If the analogy would give the reader a wrong
  prediction, it is the wrong analogy.
- **State where it breaks.** Every analogy fails somewhere; say so in one
  sentence. "This works for the distances, but not the sizes — the planets would
  be far too small to see."

### 3. Play with it
The interactive simulation. The reader manipulates the concept before it is
formally explained. Sliders show `friendlyLabel` at Curious and Student tier,
`symbol` at Deep tier.

The simulation is the spine of the module. If a topic has no meaningful thing to
manipulate, reconsider whether it is a module at all — it may be a section
inside another module.

**Any approximation the sim makes is disclosed here, next to the sim itself** —
not buried in layer 4 prose. One line: "Orbits are circular here; real ones are
ellipses." An expert notices a simplification within seconds, and an undisclosed
one costs you their trust for the entire site.

### 4. The real picture
Now, and only now, introduce correct terminology, real figures, and caveats.
Every technical term used anywhere in the module is defined here.

- Define a term the first time it appears, inline, in one clause.
- Include the honest caveats: what is still unsettled, where the numbers come
  from, how they are measured.
- If a common misconception exists, name it and correct it explicitly.

This is the entry point for Deep-tier readers, so it must read well cold —
without the analogy above it having been seen.

### 5. The math
The key relation, bound to values the reader has already been dragging.

- Every equation ties to a live `Param`. A formula the reader cannot plug their
  own slider values into does not belong here.
- One worked example with real numbers.
- Each symbol explained in words, beside the equation.
- Never introduce a quantity here that has no `Param` in the sim.

Keep this layer tight — one to three equations. Depth goes in layer 6, not here.

### 6. Going deeper
Optional per module, collapsed except at Deep tier. This is where the audience
that already knows the field is served, and it is the layer that stops Lodestar
being a toy.

Include as the topic warrants:
- The derivation, or a sketch of it with the non-obvious step shown.
- The assumptions being made, stated as assumptions.
- The regime of validity, and what happens outside it — where the Newtonian
  version fails, where the approximation diverges, what the relativistic or
  quantum correction looks like.
- The open questions. Where the measurements disagree, what is actively
  contested, what a current paper would be about.

Write this for a reader who does not need encouragement. Precise language, no
hedging, no re-explaining terms already defined in layer 4.

### 7. Connections
Two to four links to other modules, each with one sentence saying *why* a reader
would go there next. Not a "related topics" list — a reason.

If the target module does not exist yet, still write the link. Missing targets
are a useful backlog.

## References

Every module carries a `references` array: primary sources for the figures and
claims. Papers, mission data from NASA or ESA, review articles, IAU or CODATA
values.

```ts
references: [
  { label: 'Planck 2018 results VI: Cosmological parameters',
    url: 'https://...', note: 'Source for the age and expansion figures' },
]
```

This is not decoration. Readers who know the field judge a site by whether it
cites, and readers who do not yet know the field deserve a path onward. Prefer
the primary source over the summary. Never cite a figure you have not checked.

## Voice

The reader is an intelligent adult. Layers 1–3 assume no physics; layers 4–6
assume increasing fluency. None of them assume youth.

- Short sentences. Active voice. Second person where it helps.
- No exclamation marks, no "amazing", "mind-blowing", "incredible". The subject
  is already impressive; announcing that it is is what makes it read like a
  children's museum placard.
- No rhetorical questions as section openers.
- Never say "simply", "just", "obviously", or "of course". If it were obvious,
  the module would not exist.
- In layers 1–4, numbers get a human comparison on first appearance.
  "1.5 × 10¹¹ metres — about four thousand trips around the Earth."
- Prefer the concrete noun to the category. "The Sun", not "a typical G-type
  star", until layer 4.
- In layers 5–6, drop the hand-holding entirely. Precision over warmth.

## Terminology discipline

**A technical term may not appear before layer 4 unless it is defined in the
same sentence.**

Layers 1–3 use plain language: "how far away", not "distance modulus"; "how
heavy", not "mass"; "how spread out", not "angular diameter". Layer 4 then makes
the handoff visible: "What we have been calling *how far away* is what
astronomers call *distance*, measured in..."

From layer 4 onward the rule inverts: use the correct term, and do not
apologise for it.

## Defining parameters

Every slider is a `Param` with a real SI quantity underneath. Never invent a
unitless "amount" slider.

```ts
{
  id: 'distance',
  symbol: 'd',
  friendlyLabel: 'How far away?',
  technicalLabel: 'Distance',
  unit: 'm',
  min: 1e9, max: 1e27, default: 1.5e11,
  scale: 'log',
  format: { notation: 'scientific', digits: 3 },
}
```

- `friendlyLabel` is a question or plain phrase; shown at Curious and Student.
- `technicalLabel` and `symbol` are shown at Deep tier and in layers 5–6.
- `min` / `max` / `default` are in SI base units, always.
- Use `scale: 'log'` when the range spans more than about three orders of
  magnitude — in astronomy, usually.

`format` is declarative data, never a function — module files must stay
serialisable.

See the `physics-accuracy` skill for constants, unit handling, formula
conventions, and number formatting.

## Length targets

Guides, not limits, but a module far outside them usually has a structural
problem.

| Layer | Target |
|---|---|
| 1 Hook | 1–2 sentences |
| 2 Intuition | 100–200 words |
| 3 Play with it | 3–5 params, 1 sim |
| 4 Real picture | 250–450 words |
| 5 The math | 1–3 equations |
| 6 Going deeper | 300–700 words, or omitted |
| 7 Connections | 2–4 links |
| references | 2–5 sources |

## Review checklist

- [ ] A reader who stops after layer 2 has learned something true and complete
- [ ] Layer 4 reads well cold, without layers 1–3 above it
- [ ] Exactly one analogy, and its breaking point is stated
- [ ] No technical term appears before layer 4 undefined
- [ ] Every approximation in the sim is disclosed beside the sim
- [ ] Every slider maps to a real SI quantity
- [ ] Every equation in layer 5 uses a param the reader already dragged
- [ ] One worked example with real numbers
- [ ] Layer 6 contains something a knowledgeable reader did not already know
- [ ] At least one stated caveat or open question
- [ ] References are primary sources, and every figure cited has been checked
- [ ] Every connection has a reason, not just a name
- [ ] Nothing in the module would make a working astronomer wince
