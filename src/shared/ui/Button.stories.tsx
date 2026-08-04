import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download } from 'lucide-react';

import { Button } from '@/shared/ui/Button';

const meta = {
  title: 'Primitivas/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Consultar USGS' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const WithIcon: Story = {
  args: {
    variant: 'primary',
    children: (
      <>
        <Download size={15} aria-hidden="true" /> Exportar CSV
      </>
    ),
  },
};
export const Disabled: Story = { args: { disabled: true, children: 'Consultando…' } };
