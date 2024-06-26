/**
 * @fileoverview WIP package template generator
 */

import { intro, outro, cancel, text, multiselect, select, group, spinner } from '@clack/prompts'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'

import prettier_raw from './configs/prettier.config.json' with { type: 'text' }
import tsup_raw from './configs/tsup.config.js' with { type: 'text' }
import tsconfig from './configs/tsconfig.json' with { type: 'text' }
import jsr_raw from './configs/jsr.json' with { type: 'text' }
import pkgjson from './configs/package.json'

type Bundler = 'tsup' | 'tsc'
type BundlerCfg = Record<Bundler, { default?: boolean; scripts: { dev: string; build: string } }>

const dirname = new URL(import.meta.url).pathname
const here = dirname.replace(`/${basename(dirname)}`, '')

const CFG = {
	useTemp: false, // use a temporary folder for testing
	temp_dir: 'tmp',
	dest_dir: '../../packages', // used when useTemp is false
	default_bundler: 'tsup',
	bundler: {
		tsup: {
			default: true,
			scripts: {
				dev: 'tsup -d --watch',
				build: 'tsup',
			},
		},
		tsc: {
			scripts: {
				dev: 'tsc -w',
				build: 'tsc',
			},
		},
	} as BundlerCfg,
} as const

const tmpFolder = join(here, 'tmp')
const packagesFolder = join(here, CFG.dest_dir)

const files = new Map<string, string>([
	[
		'.gitignore',
		`node_modules
.DS_Store
`,
	],
])

//· Main / Prompt ···································································¬

intro(`bopo create 📦`)

/** visual seperator */
const SEP = '\n\x1b[30m|\x1b[0m'

const res = await group(
	{
		scope: () => {
			return text({
				message: 'scope ' + em('(optional)') + SEP,
				defaultValue: '@braebo',
				placeholder: '@braebo',
				initialValue: '@braebo',
				validate: v => {
					if (!v || !v.startsWith('@')) {
						return 'Scope must start with "@"'
					}
				},
			})
		},
		name: () => {
			return text({
				message: 'name ' + SEP,
				defaultValue: 'my-package',
				placeholder: 'my-package',
			})
		},
		description: () => {
			return text({
				message: 'description ' + em('(optional)') + SEP,
				placeholder: 'a zero-dependency cure for cancer',
				defaultValue: 'TODO',
				initialValue: 'TODO',
			})
		},
		entry: () => {
			return text({
				message: 'entry' + SEP,
				defaultValue: 'index',
				placeholder: 'index',
			})
		},
		bundler: () => {
			return select({
				message: 'bundler' + SEP,
				options: [
					...Object.keys(CFG.bundler).map(k => {
						return {
							value: k as Bundler,
							label: k,
							hint: k === CFG.default_bundler ? 'default' : '',
						}
					}),
				],
				initialValue: CFG.default_bundler as Bundler,
			})
		},
		addons: () => {
			return multiselect({
				message: 'addons \x1b[2m\x1b[3m(spacebar to disable)\x1b[0m' + SEP,
				options: [
					{ value: 'prettier', label: 'prettier' },
					{ value: 'vitest', label: 'vitest' },
					{ value: 'jsr', label: 'jsr' },
				],
				initialValues: ['prettier', 'vitest', 'jsr'],
			})
		},
	},
	{
		onCancel: () => {
			cancel('᙮᙮᙮ cancelled')
			process.exit(0)
		},
	},
)

const s = spinner()
s.start('Generating project...')

files.set('tsconfig.json', tsconfig as any as string)

//* Update package.json

const bundler_op = CFG.bundler[res.bundler as Bundler]
pkgjson.name = res.name
pkgjson.description = res.description
pkgjson.scripts.dev = bundler_op.scripts.dev
pkgjson.scripts.build = bundler_op.scripts.build

//* Addons

if (res.bundler === 'tsup') {
	files.set('tsup.config.ts', tsup_raw.replace(/_PATH_/g, res.entry))
}

if (res.addons.includes('prettier')) {
	files.set('.prettierrc', prettier_raw as any as string)
}

if (res.addons.includes('jsr')) {
	files.set(
		'jsr.json',
		(jsr_raw as any as string).replace(/_NAME_/, res.name).replaceAll(/_PATH_/g, res.entry),
	)
}

if (res.addons.includes('vitest')) {
	// @ts-expect-error
	const current = pkgjson.devDependencies['vite']
	let latest = ''
	try {
		const { version } = await (await fetch('https://registry.npmjs.org/vite/latest')).json()
		latest = version
	} catch (e) {}

	if (latest && current !== latest) {
		s.message(`Upgrading vite version to ${latest}`)
		// @ts-expect-error
		pkgjson.devDependencies['vite'] = `^${latest}`
	}
}

//* Now we can create the package.json file.

files.set('package.json', JSON.stringify(pkgjson, null, 2).replaceAll(/_PATH_/g, res.entry))

//* Determine the output folder.

const outputFolder = join(CFG.useTemp ? tmpFolder : packagesFolder, res.name)

//* Write the files.

if (existsSync(outputFolder)) {
	s.message('Removing existing folder...')
	rmSync(outputFolder, { recursive: true })
}

mkdirSync(join(outputFolder), { recursive: true })

s.message('Generating files...')

for (const [name, content] of files) {
	Bun.write(join(outputFolder, name), content)
}

mkdirSync(join(outputFolder, 'src'))

Bun.write(
	join(outputFolder, 'src', `${res.entry}.ts`),
	`/**
 * @module A blank package template.
 */

export const foo = 'bar'`,
)

s.stop('Project generated: ' + em(outputFolder))

outro(`You're all set!`)
//⌟

function em(str: string) {
	return `\x1b[2m\x1b[3m${str}\x1b[0m`
}
