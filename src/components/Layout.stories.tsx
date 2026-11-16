import type { Meta, StoryObj } from '@storybook/react-vite';
import { Breadcrumbs, LandingSection } from './LandingParts';
import { Button, useToast } from './ui';

/** Page furniture on the landing pages: breadcrumbs, sections, and toasts. */
const meta = {
  title: 'Content/Page parts',
  component: Breadcrumbs,
  args: { items: [{ label: 'Icons', to: '/' }, { label: 'Communication', to: '/categories/communication' }, { label: 'annotation' }] },
} satisfies Meta<typeof Breadcrumbs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Crumbs: Story = {};

/** A section with a full-width divider; `narrow` centers it in a reading column. */
export const Sections: Story = {
  render: () => (
    <div className="space-y-12">
      <LandingSection id="wide" title="More communication icons"><p className="text-sm text-muted">Full width.</p></LandingSection>
      <LandingSection id="narrow" title="Use the annotation icon" narrow><p className="text-sm text-muted">Centered, 768px wide.</p></LandingSection>
    </div>
  ),
};

function ToastDemo() {
  const toast = useToast();
  return (
    <div className="flex gap-2">
      <Button onClick={() => toast('success', 'SVG copied')}>Success toast</Button>
      <Button onClick={() => toast('error', 'Could not copy.')}>Error toast</Button>
    </div>
  );
}

export const Toasts: Story = { render: () => <ToastDemo /> };
