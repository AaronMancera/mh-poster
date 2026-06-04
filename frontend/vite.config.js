import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/mh-poster/',  // nombre exacto de tu repositorio en GitHub
})