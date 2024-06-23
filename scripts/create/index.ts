/**
 * @fileoverview WIP package template generator
 */

import { $, type BunFile } from 'bun'

import { intro, outro, cancel, text, multiselect, select, group, spinner } from '@clack/prompts'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'

import prettier_raw from './configs/prettier.config.json' with { type: 'text' }
import tsup_raw from './configs/tsup.config.js' with { type: 'text' }
import tsconfig from './configs/tsconfig.json' with { type: 'text' }
import jsr_raw from './configs/jsr.json' with { type: 'text' }
import pkgjson from './configs/package.json'

/**
 * Generates the package into the `tmp` dir instead of the `packages` dir.
 */
const USE_TMP = true

// interface Options {
// 	bundler: 'tsc' | 'tsup'  | 'vite'
// }

interface PkgScripts {
	dev: string
	build: string
}

const OPS = {
	bundler: {
		tsup: {
			scripts: {
				dev: 'tsup -d --watch',
				build: 'tsup',
			},
			config: {
				'tsup.config.js': (entry_filename = 'index') =>
					tsup_raw.replace(/_PATH_/g, entry_filename),
			},
		},
		tsc: {
			scripts: {
				dev: 'tsc -w',
				build: 'tsc',
			},
			config: null,
		},
	},
	'jsr.json': (package_name: string, entry_filename: string) =>
		(jsr_raw as any as string)
			.replace(/_NAME_/, package_name)
			.replaceAll(/_PATH_/g, entry_filename),
} as const

const data = {
	package_name: 'my-package' as string,
	entrypoint_filename: 'index',
	bundler: 'tsup' as keyof typeof OPS.bundler,
	files: new Map<string, string>(),
} as const

data.files.set(
	'.gitignore',
	`node_modules
.DS_Store
`,
)

// console.log('here:', here)
// const templateFolder = findDir('template')
// const folderContents = readdirSync(templateFolder)
// const outputFolder = join(here, data.package_name)
// console.log(`${b('\nfolderContents')}: ${j(folderContents)}\n`)

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
					...Object.keys(OPS.bundler).map(k => {
						return {
							value: k as keyof typeof OPS.bundler,
							label: k,
							hint: data.bundler === k ? 'default' : '',
						}
					}),
				],
				initialValue: data.bundler,
			})
		},
		addons: () => {
			return multiselect({
				message: 'addons \x1b[2m\x1b[3m(spacebar to disable)\x1b[0m',
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

data.files.set('tsconfig.json', tsconfig as any as string)

//* Update package.json

const bundler_op = OPS.bundler[res.bundler as keyof typeof OPS.bundler]
pkgjson.name = res.name
pkgjson.scripts.dev = bundler_op.scripts.dev
pkgjson.scripts.build = bundler_op.scripts.build

//* Addons

if (res.bundler === 'tsup') {
	data.files.set(
		'tsup.config.js',
		OPS.bundler.tsup.config['tsup.config.js'](data.entrypoint_filename),
	)
}

if (res.addons.includes('prettier')) {
	data.files.set('.prettierrc', prettier_raw as any as string)
}

if (res.addons.includes('jsr')) {
	data.files.set('jsr.json', OPS['jsr.json'](res.name, data.entrypoint_filename))
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
		pkgjson.devDependencies['vite'] = latest
	}
}

//* Now we can create the package.json file.

data.files.set(
	'package.json',
	JSON.stringify(pkgjson, null, 2).replaceAll(/_PATH_/g, data.entrypoint_filename),
)

const _ = new URL(import.meta.url).pathname
const here = _.replace(`/${basename(_)}`, '')
const outputFolder = join(here, USE_TMP ? 'tmp' : '', data.package_name)

if (existsSync(outputFolder)) {
	s.message('Removing existing folder...')
	rmSync(outputFolder, { recursive: true })
}

// recreate it
mkdirSync(join(outputFolder, data.package_name), { recursive: true })

s.message('Generating files...')

for (const [name, content] of data.files) {
	Bun.write(join(outputFolder, name), content)
}

mkdirSync(join(outputFolder, 'src'))

Bun.write(
	join(outputFolder, 'src', `${data.entrypoint_filename}.ts`),
	`/**
 * @module A blank package template.
 */

export const foo = 'bar'`,
)

s.stop('Project generated: ' + em(outputFolder))

outro(`You're all set!`)
//⌟

//· Utils ···································································¬

function findDir(dir: string, maxDepth = 2) {
	let found

	function look(depth = 0) {
		const path = join(here, '../'.repeat(depth), dir)
		found = existsSync(path)
		if (found) return path
		if (depth > maxDepth) {
			throw new Error(`Failed to find folder: "${dir}".`)
		}
		return look(depth + 1)
	}

	return look()
}

function file(path: string) {
	return Bun.file(join(here, path))
}

function b(str: string) {
	return `\x1b[34m${str}\x1b[0m`
}
function j(obj: {}) {
	return JSON.stringify(obj, null, 2)
}

function em(str: string) {
	return `\x1b[2m\x1b[3m${str}\x1b[0m`
}
//⌟
