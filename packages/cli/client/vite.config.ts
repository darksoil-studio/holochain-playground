import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	build: {
		watch: {
			include: ['../../../**/*/dist'],
		},
	},
});
