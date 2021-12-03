import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

const pkg = require('./package.json');

export default {
  input: `src/index.ts`,
  output: { dir: 'dist', format: 'es', sourcemap: true },
  watch: {
    clearScreen: false,
  },
  external: [
    ...Object.keys(pkg.dependencies).filter(
      (key) => !key.includes('json-viewer') && !key.includes('@vaadin')
    ),
    'lit/directives/style-map.js',
    'lit/directives/class-map.js',
    /lodash-es/,
  ],
  plugins: [
    replace({
      'customElements.define(JsonViewer.is, JsonViewer);': '',
      'customElements.define(GridColumn.is, GridColumn);': '',
      'customElements.define(Grid.is, Grid);': '',
    }),
    json(),
    typescript(),
    resolve({
      preferBuiltins: false,
      browser: true,
      mainFields: ['browser', 'module', 'main'],
    }),
    commonjs(),
  ],
};
