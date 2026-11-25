import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArtwork } from '../lib/artwork';
import { catalog, chunksFor, iconsByName, type StyleId } from '../lib/catalog';
import uiIcons from '../data/ui-icons.json';
import { Glyph, IconLinkGrid, useStyleVars } from './LandingParts';
import { UiIcon, type UiIconName } from './ui';

/** How icons are drawn: library artwork (Glyph), link tiles (IconLinkGrid), and the site's own UI icons. */
const meta = {
  title: 'Content/Icons',
  component: IconLinkGrid,
  args: { icons: ['agent', 'annotation', 'bell', 'inbox', 'face-smile', 'at-sign', 'head-profile', 'search'].map((n) => iconsByName.get(n)!) },
} satisfies Meta<typeof IconLinkGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Link tiles to icon pages, as in "More … icons" and on category pages. */
export const LinkGrid: Story = {};

function StyleRow({ style }: { style: StyleId }) {
  const svg = useArtwork(style, ['annotation'], chunksFor).annotation;
  return (
    <div className="flex items-end gap-6" style={useStyleVars(style)}>
      <span className="w-20 text-sm text-muted">{style}</span>
      {(['size-4', 'size-5', 'size-6', 'size-8', 'size-24'] as const).map((size) => (
        <Glyph key={size} svg={svg} idPrefix={`${style}-${size}-`} className={size} />
      ))}
    </div>
  );
}

/** Library artwork in every style, at the actual sizes the icon page shows and large. */
export const Glyphs: Story = {
  render: () => <div className="space-y-5">{catalog.styles.map((s) => <StyleRow key={s} style={s} />)}</div>,
};

/** Interface icons bundled with the site (scripts/sync-icons.mjs UI_ICONS). */
export const UiIcons: Story = {
  render: () => (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
      {(Object.keys(uiIcons).filter((k) => !k.startsWith('$')) as UiIconName[]).map((name) => (
        <li key={name} className="flex items-center gap-2 text-xs text-muted">
          <UiIcon name={name} className="size-5 text-ink" /> {name}
        </li>
      ))}
    </ul>
  ),
};
