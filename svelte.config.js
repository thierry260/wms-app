import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-static';

export default {
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html' // This sets up the fallback for a single-page application
		}),
		prerender: {
			// Add any necessary options here
		}
	},
	preprocess: preprocess({
		scss: {
			prependData: `@import 'src/styles/global.scss';`
		},
		postcss: true
	})
};