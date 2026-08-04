import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '@/shared/ui/Badge';

const meta = {
  title: 'Primitivas/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Revisado' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};
export const Teal: Story = { args: { tone: 'teal' } };
export const Alert: Story = { args: { tone: 'amber', children: 'PAGER yellow' } };
export const Critical: Story = { args: { tone: 'critical', children: 'Respuesta inválida' } };
