/**
 * Framer Motion's animation features, in a chunk of their own.
 *
 * The app renders `m` components inside `LazyMotion`, so the entry chunk
 * carries only the thin renderer and these features arrive just after it. They
 * are `domMax` rather than the smaller `domAnimation` because the depth
 * control's sliding pill is a shared-layout animation (`layoutId`), which only
 * `domMax` includes; every animation on the site is kept exactly as it was.
 */
export { domMax as default } from 'framer-motion';
