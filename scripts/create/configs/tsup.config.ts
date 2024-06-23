import { defineConfig } from 'tsup'

export default defineConfig([
	{
		entry: {
			'_PATH_.min': 'src/_PATH_.ts',
		},
		minify: !0,
		name: 'standard',
		format: ['esm'],
		clean: true,
		dts: !!0,
	},
	{
		entry: ['src/_PATH_.ts'],
		name: 'standard',
		format: ['esm'],
		clean: true,
		dts: true,
	},
])
