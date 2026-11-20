import { useParams } from 'react-router-dom';
import { Breadcrumbs, IconLinkGrid, LandingSection } from '../components/LandingParts';
import { ButtonLink, Chip } from '../components/ui';
import { useI18n } from '../i18n';
import { catalog } from '../lib/catalog';
import { categoryBySlug, categoryPath, iconsInCategory } from '../lib/icon-pages';
import { CONTAINER } from '../lib/layout';
import { FRAMEWORK_NAMES } from '../lib/links';
import NotFoundPage from './NotFoundPage';

export default function CategoryPage() {
  const { slug = '' } = useParams();
  const category = categoryBySlug(slug);
  const { t, label, list, n } = useI18n();
  if (!category) return <NotFoundPage />;

  const name = label('category', category.name, category.name);
  const icons = iconsInCategory(category.name);
  const styles = list(catalog.styles.map((s) => t(`style.${s}`)));

  return (
    <div className={`${CONTAINER} pb-24 pt-8 sm:pt-10`}>
      <Breadcrumbs items={[{ label: t('iconPage.allIcons'), to: '/' }, { label: name }]} />
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t('categoryPage.heading', { category: name })}</h1>
      <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">
        {t('categoryPage.intro', { count: n(category.count), category: name.toLowerCase(), styles, frameworks: list(FRAMEWORK_NAMES) })}
      </p>
      <div className="mt-6">
        <ButtonLink to={`/?${new URLSearchParams({ category: category.name })}`} variant="primary" size="lg" icon="palette">
          {t('categoryPage.customize')}
        </ButtonLink>
      </div>

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
