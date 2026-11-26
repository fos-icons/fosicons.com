import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Segmented } from './ui';

const STYLES = [
  { value: 'regular', label: 'Regular' },
  { value: 'filled', label: 'Filled' },
  { value: 'duocolor', label: 'Duocolor' },
  { value: 'duotone', label: 'Duotone' },
];

/**
 * Single-choice tabs (radio group semantics, arrow keys move). Used for the
 * style switcher on the home grid, the icon page, and the side pane.
 */
const meta = {
  title: 'Primitives/Segmented',
  component: Segmented,
  args: { label: 'Icon style', value: 'regular', options: STYLES, onChange: () => {}, size: 'md', fill: false },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md'] } },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <Segmented {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof Segmented<string>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: 'sm' } };
/** Below the sm breakpoint the options share the full width. */
export const Fill: Story = { args: { fill: true }, globals: { viewport: { value: 'mobile1' } } };
