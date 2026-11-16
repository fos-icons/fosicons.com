import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './ui';

/** A square, icon-only action. `label` is its accessible name and tooltip. */
const meta = {
  title: 'Primitives/IconButton',
  component: IconButton,
  args: { icon: 'x', label: 'Clear selection' },
  argTypes: { icon: { control: 'select', options: ['x', 'plus', 'layout-sidebar-right', 'menu', 'copy'] } },
} satisfies Meta<typeof IconButton>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
