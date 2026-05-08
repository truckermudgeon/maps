import { autorun, type IReactionDisposer } from 'mobx';
import type { SessionStore } from '../stores/types';

/**
 * Mirrors `session.themeMode` to the html element's
 * `data-joy-color-scheme` and `data-mui-color-scheme` attributes,
 * which is how Joy/Material pick up the active theme. Returns a
 * disposer for cleanup.
 */
export function applyThemeReaction(session: SessionStore): IReactionDisposer {
  return autorun(() => {
    const html = document.documentElement;
    html.setAttribute('data-joy-color-scheme', session.themeMode);
    html.setAttribute('data-mui-color-scheme', session.themeMode);
  });
}
