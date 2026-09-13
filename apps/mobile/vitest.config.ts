import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, './src/__tests__/__mocks__/react-native.ts'),
      'react-native-svg': path.resolve(__dirname, './src/__tests__/__mocks__/react-native-svg.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
