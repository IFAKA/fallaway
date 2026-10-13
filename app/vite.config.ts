import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './', // relative asset paths: the build works from any folder on any static host
  plugins: [react()],
  server: { port: 5199, fs: { allow: ['..'] } }, // the rules engine lives in ../core
})
