import preprocess from 'svelte-preprocess';
import vercel from '@sveltejs/adapter-vercel';

export default {
	kit: {
		adapter: vercel()
		// other options if needed
	},
	preprocess: preprocess({
		scss: {
			prependData: `@import 'src/styles/global.scss';`
		},
		postcss: true
	})
};
