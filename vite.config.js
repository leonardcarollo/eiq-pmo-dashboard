import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// IMPORTANT: change `base` below to match your GitHub repo name
export default defineConfig({
  plugins: [react()],
  base: '/eiq-pmo-dashboard/',
})
