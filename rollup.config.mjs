import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
    },
    {
      file: 'dist/index.es.js',
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'GrapesjsPluginApidoc',
      sourcemap: true,
      globals: { grapesjs: 'grapesjs' },
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist',
    }),
    terser(),
  ],
  external: ['grapesjs'],
};
