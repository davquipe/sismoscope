import type { Meta, StoryObj } from '@storybook/react-vite';

import { MagnitudeIndicator } from '@/entities/earthquake/ui/MagnitudeIndicator';

const meta = {
  title: 'Terremotos/MagnitudeIndicator',
  component: MagnitudeIndicator,
  tags: ['autodocs'],
  args: { magnitude: 4.7 },
} satisfies Meta<typeof MagnitudeIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Moderate: Story = {};
export const Micro: Story = { args: { magnitude: 0.8 } };
export const Strong: Story = { args: { magnitude: 7.4 } };
export const Missing: Story = { args: { magnitude: null } };
export const Compact: Story = { args: { compact: true, magnitude: 5.2 } };
