import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useI18n } from '../i18n';
import { iconNameForMetadata, pageFor, pageUrl, type PageMeta } from './seo-meta';

function setMeta(selector: string, value: string) {
  document.head.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value);
}

/**
 * Keep the document language, tab title, description, and canonical link in
 * step with the route. The static HTML for each page already carries the
 * full set (see postbuild); this covers client-side navigation and crawlers
 * that run JavaScript.
 */
export function useDocumentMeta() {
  const { pathname, search } = useLocation();
  const i18n = useI18n();
  useEffect(() => {
    document.documentElement.lang = i18n.config.code;
    document.documentElement.dir = i18n.dir;
  }, [i18n]);
  useEffect(() => {
    function update(page: PageMeta) {
      const url = pageUrl(page, i18n.config.code);
      document.title = page.title;
      setMeta('meta[name="description"]', page.description);
      setMeta('meta[property="og:title"]', page.title);
      setMeta('meta[property="og:description"]', page.description);
      setMeta('meta[property="og:url"]', url);
      setMeta('meta[name="twitter:title"]', page.title);
      setMeta('meta[name="twitter:description"]', page.description);
      setMeta('meta[name="robots"]', page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1');
      let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (page.noindex) {
        canonical?.remove();
      } else {
        if (!canonical) {
          canonical = document.createElement('link');
          canonical.rel = 'canonical';
          document.head.append(canonical);
        }
        canonical.href = url;
      }
    }

    if (!iconNameForMetadata(pathname)) {
      update(pageFor(pathname, search, i18n));
      return;
    }

    // Keep the prerendered metadata until the icon's catalog is available.
    let active = true;
    import('./catalog').then(({ iconsByName }) => {
      if (active) update(pageFor(pathname, search, i18n, (name) => iconsByName.get(name)));
    }, (error: unknown) => {
      if (!active) return;
      console.error('Unable to load icon metadata', error);
    });
    return () => { active = false; };
  }, [pathname, search, i18n]);
}
