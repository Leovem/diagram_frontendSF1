import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // nuevo plugin de Tailwind 4.1+

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // lo agregas aquí
  ],
});
