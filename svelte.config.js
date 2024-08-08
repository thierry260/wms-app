import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false
    }),
    // Ensure correct paths
    paths: {
      base: '',  // Use the correct base path if any
      assets: '',  // Ensure assets path is correctly set
    },
  },
  preprocess: preprocess({
    scss: {
      includePaths: ['src/styles'],
      prependData: `@import 'global.scss';`, // Ensure this is correct
    },
  }),
  onwarn: (warning, handler) => {
    if (warning.code === "css-unused-selector") {
      return;
    }
    handler(warning);
  },
};

export default config;