import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-auto';

export default {
	kit: {
		adapter: adapter()
	},
	preprocess: preprocess({
		scss: {
			prependData: `@import 'src/styles/global.scss';` // Optioneel: importeer globale SCSS bestanden
		},
		postcss: true // Optioneel: voor postprocessing zoals autoprefixer
	})
};