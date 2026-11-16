import type { Meta, StoryObj } from '@storybook/react-vite';
import { iconsByName } from '../lib/catalog';
import { KeywordTags } from './LandingParts';
import { Chip, Tag } from './ui';

/**
 * Small links to a set of icons. `Tag` (brand tint) is a keyword search;
 * `Chip` (outlined pill) is a category, with its count.
 */
const meta = {
  title: 'Primitives/Tag',
  component: Tag,
  args: { to: '/?q=assistant', children: 'assistant', size: 'md' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md'] } },
} satisfies Meta<typeof Tag>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: 'sm' } };

/** An icon's keywords, as on its page (md) and in the side pane (sm). Untagged icons render nothing. */
export const Keywords: Story = {
  render: () => (
    <div className="space-y-4">
      <KeywordTags icon={iconsByName.get('agent')!} />
      <KeywordTags icon={iconsByName.get('agent')!} size="sm" />
    </div>
  ),
};

export const CategoryChips: Story = {
  render: () => (
    <ul className="flex flex-wrap gap-2">
      {[['Communication', '99'], ['AI & agents', '48'], ['Files', '106']].map(([name, count]) => (
        <li key={name}><Chip to={`/?category=${encodeURIComponent(name)}`} count={count}>{name}</Chip></li>
      ))}
    </ul>
  ),
};
