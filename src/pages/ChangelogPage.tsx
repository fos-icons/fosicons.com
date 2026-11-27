import { useEffect } from 'react';
import { UiIcon } from '../components/ui';
import { changelog } from '../data/changelog';
import { LocalLink, useI18n } from '../i18n';
import { displayName, gridPreviewPath, iconPath } from '../lib/icon-pages';
import { CONTAINER } from '../lib/layout';

export default function ChangelogPage() {
  const { locale, t } = useI18n();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' });

  // A dev or client-rendered deep link can arrive before the lazy route mounts.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (changelog.some((entry) => entry.id === id || entry.legacyIds?.includes(id))) {
      document.getElementById(id)?.scrollIntoView();
    }
  }, []);

  const indexLinks = (
    <ul lang="en" className="mt-2 space-y-1 text-sm leading-snug">
      {changelog.map(({ id, title }) => (
        <li key={id}>
          <a href={`#${id}`} className="-ms-2 block rounded-md px-2 py-1.5 text-muted hover:bg-sunken hover:text-ink">
            {title}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`${CONTAINER} pb-16 pt-12 sm:pb-24 sm:pt-16`}>
      <header className="mb-8 sm:mb-12">
        <h1 id="changelog" className="text-balance text-4xl font-semibold tracking-tight">
          {t('changelog.title')}
        </h1>
        <p className="mt-3 max-w-prose text-base leading-7 text-muted sm:text-lg">{t('changelog.intro')}</p>
      </header>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12.5rem] md:gap-12 lg:gap-16">
        <nav aria-label={t('changelog.index')} className="self-start border-y border-line md:sticky md:top-8 md:col-start-2 md:row-start-1 md:border-b-0 md:pt-5">
          <div className="hidden md:block">
            <h2 className="text-sm font-semibold">{t('changelog.index')}</h2>
            {indexLinks}
          </div>
          <details className="group md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              {t('changelog.index')}
              <UiIcon name="chevron-down" className="size-4 text-muted group-open:rotate-180" />
            </summary>
            <div className="pb-3">{indexLinks}</div>
          </details>
        </nav>

        <div className="min-w-0 md:col-start-1 md:row-start-1">
          {changelog.map(({ id, date, startDate, legacyIds, title, summary, highlights, icons, source }) => (
            <article
              key={id}
              id={id}
              lang="en"
              aria-labelledby={`${id}-title`}
              className="relative grid scroll-mt-6 gap-x-5 gap-y-2 border-b border-line py-7 target:border-b-brand/40 md:py-10 lg:grid-cols-[8rem_minmax(0,1fr)]"
            >
              {legacyIds?.map((legacyId) => <span key={legacyId} id={legacyId} aria-hidden="true" className="pointer-events-none absolute start-0 top-0 scroll-mt-6" />)}
              <h2 id={`${id}-title`} className="text-balance text-2xl font-semibold leading-tight lg:col-start-2 lg:row-start-1 lg:text-[1.7rem]">
                {title}
              </h2>
              <time dateTime={date} className="text-sm tabular-nums text-muted lg:col-start-1 lg:row-start-1 lg:pt-1.5">
                {startDate ? dateFormat.formatRange(new Date(startDate), new Date(date)) : dateFormat.format(new Date(date))}
              </time>
              <div className="min-w-0 max-w-2xl lg:col-start-2">
                <p className="max-w-prose text-base leading-7 text-muted">{summary}</p>
                {highlights && (
                  <ul className="mt-3 list-disc space-y-1 ps-5 text-sm leading-6 marker:text-faint">
                    {highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
                  </ul>
                )}
                {icons && (
                  <ul aria-label={t('changelog.featuredIcons')} className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
                    {icons.map((name) => (
                      <li key={name} className="min-w-0 bg-canvas">
                        <LocalLink
                          to={iconPath(name)}
                          className="flex min-h-21 flex-col items-center justify-center gap-2 px-2 py-3 text-center text-xs leading-tight text-muted hover:bg-sunken hover:text-ink focus-visible:outline-offset-[-3px]"
                        >
                          <span
                            aria-hidden="true"
                            className="size-7 bg-ink [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
                            style={{ maskImage: `url(${gridPreviewPath(name)})` }}
                          />
                          <span>{displayName(name)}</span>
                        </LocalLink>
                      </li>
                    ))}
                  </ul>
                )}
                <a
                  href={source}
                  aria-label={t('changelog.sourceFor', { title })}
                  className="mt-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-brand underline-offset-4 hover:underline"
                >
                  {t('changelog.source')}
                  <UiIcon name="link-external" className="size-3.5" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
