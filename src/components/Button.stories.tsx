import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, ButtonAnchor, ButtonLink } from './ui';

/**
 * Every button on the site. `Button` is an action; `ButtonLink` styles a page
 * on this site and `ButtonAnchor` a file or another site the same way.
 * Use one `primary` per region.
 */
const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Download SVG', variant: 'secondary', size: 'md', disabled: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'quiet'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    icon: { control: 'select', options: [undefined, 'download', 'copy', 'palette', 'search', 'arrow-left'] },
    iconEnd: { control: 'select', options: [undefined, 'link-external', 'arrow-right'] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args} variant="primary" icon="download">Primary</Button>
      <Button {...args} variant="secondary">Secondary</Button>
      <Button {...args} variant="ghost" icon="palette">Ghost</Button>
      <Button {...args} variant="quiet" icon="copy">Quiet</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="space-y-3">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-2">
          <Button {...args} size={size} variant="primary" icon="download">Download</Button>
          <Button {...args} size={size}>Download PNG</Button>
          <span className="text-xs text-muted">{size}</span>
        </div>
      ))}
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true, variant: 'primary', icon: 'download' } };

/** The icon page's main pair: a file download and a generated PNG. */
export const IconPageActions: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ButtonAnchor href="/svg/regular/agent.svg" download="agent-regular.svg" variant="primary" size="lg" icon="download">
        Download Regular SVG
      </ButtonAnchor>
      <Button size="lg">Download PNG</Button>
    </div>
  ),
};

export const AsLinks: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ButtonLink to="/docs" icon="book-open">A page here</ButtonLink>
      <ButtonAnchor href="https://github.com/fos-icons/fos-icons" external iconEnd="link-external">Another site</ButtonAnchor>
      <ButtonLink to="/" variant="quiet" size="sm" icon="arrow-left">Back to icons</ButtonLink>
    </div>
  ),
};
