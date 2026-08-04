import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatePanel } from '@/shared/ui/StatePanel';

const meta = {
  title: 'Estados/StatePanel',
  component: StatePanel,
  tags: ['autodocs'],
  args: {
    type: 'empty',
    title: 'Sin eventos con estos criterios',
    description: 'Amplía el rango temporal o reduce la magnitud mínima.',
  },
  decorators: [
    (Story) => (
      <div className="panel" style={{ width: 620 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Error: Story = {
  args: {
    type: 'error',
    title: 'USGS no respondió',
    description: 'La consulta falló de forma recuperable; tus filtros permanecen intactos.',
    onRetry: () => undefined,
  },
};
export const Offline: Story = {
  args: {
    type: 'offline',
    title: 'Sin conexión',
    description: 'Reconecta este dispositivo para solicitar nuevos datos.',
  },
};
