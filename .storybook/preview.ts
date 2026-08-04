import type { Preview } from '@storybook/react-vite';

import '../src/app/styles/global.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    a11y: { test: 'todo' },
    backgrounds: {
      options: {
        canvas: { name: 'Canvas claro', value: '#f2f0ea' },
        dark: { name: 'Canvas oscuro', value: '#101715' },
      },
    },
  },
};

export default preview;
