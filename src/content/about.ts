/**
 * The About page, as content rather than markup.
 *
 * This page is prose, and prose on this site lives in the rich-text AST — the
 * same one every module uses, rendered by the same component. Writing it as JSX
 * would fork the typography the moment either side changed, and would put the
 * page's words somewhere the authoring standards do not reach.
 *
 * Not a Module: it has no layers, no params and no simulation, so it does not
 * pretend to the Module type or sit in `content/modules/` where the registry
 * would find it. Its own small shape, kept here beside the text it describes.
 */
import type { RichText } from './types';
import { p, prose } from './rich';

export interface AboutSection {
  /** Rendered as the section's heading. */
  heading: string;
  body: RichText;
}

export const aboutTitle = 'How Lodestar is built';

export const aboutSections: AboutSection[] = [
  {
    heading: 'One module, three readers',
    body: prose(
      p(
        'Every topic on this site is a single module that unfolds in seven layers: from a ',
        'one-sentence hook, through an analogy, a live simulation, and the evidence itself, down ',
        'to the derivation and the open research questions. Technical terms are dotted-underlined ',
        'at first meeting, each one tap from a plain-language definition. A depth setting controls ',
        'which layers open by default, and nothing else: there are no beginner pages and no ',
        'advanced pages, because parallel versions of the same idea drift apart and quietly start ',
        'contradicting each other. One text, written once, read at the depth you choose.',
      ),
    ),
  },
  {
    heading: 'The honesty rule',
    body: prose(
      p(
        'Every simulation runs on real physical values in SI units. The sliders wear friendly ',
        'labels, but underneath each one is a real quantity with a unit and a symbol. The ',
        'math layer reads the same parameter objects the animation does. Drag a mass slider and ',
        'the number that appears in the equation is the number in the physics loop. Nothing is ',
        'staged for the visual.',
      ),
      p(
        'The discipline has teeth. Constants are defined once, cited to CODATA and the IAU, and ',
        'never inlined. Every approximation a simulation makes — circular orbits, no atmosphere, ',
        'a trapezoid where reality curves — is disclosed beside the simulation itself, because a ',
        'reader who knows the field will spot it in seconds, and should find that the site said ',
        'it first. Every module cites primary sources, and no figure ships unchecked: claims that ',
        'can be computed are recomputed through the site’s own physics code before publication, ',
        'and claims that can’t are verified against the paper they cite.',
      ),
    ),
  },
  {
    heading: 'Built solo, with an AI pair',
    body: prose(
      p(
        'Lodestar is a solo project built in collaboration with Claude Code, and the interesting ',
        'part is the division of labour: decisions, not typing. The physics calls, the editorial ',
        'judgements, what is cut, what is corrected, and what counts as true stay with the ',
        'author; the AI drafts to that direction, prose and code both, and nothing ships unread. ',
        'The project’s authoring standards — the seven-layer format, the terminology rules, the ',
        'SI discipline — live in the repository as machine-readable skills the agent loads on ',
        'every task, so consistency is enforced rather than remembered.',
      ),
      p(
        'Verification runs the same way it would on a team. A sanity suite recomputes known ',
        'physics (Earth’s year, escape velocity, the Schwarzschild radius of the Sun) through ',
        'the same code paths the simulations use, on every change. Unit tests snapshot every ',
        'published equation. An end-to-end suite drives the deployed site in a real browser, at ',
        'phone and desktop widths, and reads the pixels. It has caught real bugs the unit layer ',
        'could not see, which is the point of having both.',
      ),
    ),
  },
  {
    heading: 'The stack',
    body: prose(
      p(
        'Vite, React 18, TypeScript in strict mode, Tailwind, Zustand, Framer Motion, KaTeX, and ',
        'hand-drawn Canvas 2D. Content is typed data, not a CMS: a new module is one data file ',
        'and one simulation component, and the shell discovers both. Deployed on Vercel; tested ',
        'in CI on every push. The repository is private; the build, the tests, and the history ',
        'described here are available to reviewers on request.',
      ),
    ),
  },
];
