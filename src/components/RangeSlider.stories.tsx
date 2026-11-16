import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { RangeSlider } from './ui';

/**
 * The size and stroke sliders: ticks under the track (labels on a subset),
 * a brand fill up to an oval brand handle. Arrow keys step; the value text
 * is what screen readers announce.
 */
const meta = {
  title: 'Primitives/RangeSlider',
  component: RangeSlider,
  args: {
    id: 'size',
    label: 'Size',
    min: 16,
    max: 64,
    step: 4,
    value: 48,
    onChange: () => {},
    marks: [16, 24, 32, 40, 48, 56, 64],
    labels: [16, 24, 32, 48, 64],
    format: (v: number) => `${v}px`,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div className="max-w-[340px]">
        <RangeSlider {...args} value={value} onChange={setValue} valueText={args.format(value)} />
        <p className="mt-2 text-xs text-muted">{args.format(value)}</p>
      </div>
    );
  },
} satisfies Meta<typeof RangeSlider>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Size: Story = {};
export const Stroke: Story = {
  args: { id: 'stroke', label: 'Stroke width', min: 0.5, max: 2.5, step: 0.05, value: 0.85, marks: [0.5, 1, 1.5, 2, 2.5], labels: undefined },
};
