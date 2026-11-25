import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Breadcrumbs, IconLinkGrid, LandingSection } from '../components/LandingParts';
import { Button, ButtonLink, Chip, useToast } from '../components/ui';
import { useI18n } from '../i18n';
import { errorText } from '../i18n/errors';
import { catalog, iconsInCategory } from '../lib/catalog';
import { buildCategorySet, categorySetName } from '../lib/download-all';
import { downloadBlob } from '../lib/export';
import { categoryBySlug, categoryPath } from '../lib/icon-pages';
import { CONTAINER } from '../lib/layout';
import { FRAMEWORK_NAMES } from '../lib/links';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { usePlan } from '../lib/plan';
import NotFoundPage from './NotFoundPage';

export default function CategoryPage() {
  const { slug = '' } = useParams();
  const i18n = useI18n();
  const { t, label, list, n } = i18n;
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const zip = usePlan().can('zip');
  const category = categoryBySlug(slug);
  if (!category) return <NotFoundPage />;

  const name = label('category', category.name, category.name);
  const icons = iconsInCategory(category.name);
  const styles = list(catalog.styles.map((s) => t(`style.${s}`)));

  const download = async () => {
    if (!zip) return;
    setDownloading(true);
    try {
      const name = categorySetName(slug);
      downloadBlob(await buildCategorySet(category.name), name);
      toast('success', t('download.done', { file: name }));
    } catch (error) {
      toast('error', errorText(error, i18n, 'error.download'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`${CONTAINER} pb-24 pt-8 sm:pt-10`}>
      <Breadcrumbs items={[{ label: t('iconPage.allIcons'), to: '/' }, { label: name }]} />
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t('categoryPage.heading', { category: name })}</h1>
      <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">
        {t('categoryPage.intro', { count: n(category.count), category: name.toLowerCase(), styles, frameworks: list(FRAMEWORK_NAMES) })}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink to={`${categoryPath(category.name)}?view=editor`} variant="primary" size="lg" icon="palette" className="min-h-11">
          {t('categoryPage.customize')}
        </ButtonLink>
        <Button size="lg" icon="download" onClick={download} disabled={downloading || !zip} aria-busy={downloading} aria-describedby="category-download-format" className="min-h-11">
          {downloading ? t('download.preparing') : t('categoryPage.download', { count: icons.length })}
        </Button>
      </div>
      <p id="category-download-format" className="mt-2 text-sm text-muted">
        {t('categoryPage.downloadFormat')}
      </p>
      {!zip && <UpgradePrompt feature="zip" className="mt-1 text-sm text-muted" />}

      <div className="mt-10">
        <IconLinkGrid icons={icons} />
      </div>

      <LandingSection id="other-categories" title={t('categoryPage.others')} className="mt-14">
        <ul className="flex flex-wrap gap-2">
          {catalog.categories.filter((c) => c.name !== category.name).map((c) => (
            <li key={c.name}>
              <Chip to={categoryPath(c.name)} count={n(c.count)}>{label('category', c.name, c.name)}</Chip>
            </li>
          ))}
        </ul>
      </LandingSection>
    </div>
  );
}
