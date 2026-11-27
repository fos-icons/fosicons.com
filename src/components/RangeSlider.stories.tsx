import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { RangeSlider } from './ui';

/** Drag the handle, use arrow keys, or type a value and press Enter. */
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
    defaultValue: 24,
    unit: 'px',
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div className="max-w-[340px]">
        <RangeSlider {...args} value={value} onChange={setValue} valueText={`${value}${args.unit ?? ''}`} />
      </div>
    );
  },
} satisfies Meta<typeof RangeSlider>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Size: Story = {};
export const Stroke: Story = {
  args: {
    id: 'stroke',
    label: 'Stroke width',
    min: 0.5,
    max: 2.5,
    step: 0.05,
    value: 0.85,
    defaultValue: 1.25,
    tooltip: 'The stroke width is measured in pixels.',
  },
};
