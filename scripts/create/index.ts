/**
 * @fileoverview WIP package template generator
 */

import { $, type BunFile } from 'bun'

import {
	intro,
	outro,
	isCancel,
	cancel,
	text,
	multiselect,
	select,
	group,
	confirm,
	groupMultiselect,
} from '@clack/prompts'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

import prettier_raw from './configs/prettier.config.json' with { type: 'text' }
import tsup_raw from './configs/tsup.config.js' with { type: 'text' }
import jsr_raw from './configs/jsr.json' with { type: 'text' }
import pkgjson from './configs/package.json'

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
	'.prettierrc': prettier_raw,
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

const _ = new URL(import.meta.url).pathname
const here = _.replace(`/${basename(_)}`, '')
// console.log('here:', here)

const templateFolder = findDir('template')
const folderContents = readdirSync(templateFolder)
// const outputFolder = join(here, data.package_name)
const outputFolder = join(here, 'tmp', data.package_name)
console.log(`${b('\nfolderContents')}: ${j(folderContents)}\n`)

//· Main / Prompt ···································································¬

intro(`bopo create 📦`)

/** visual seperator */
const SEP = '\n\x1b[30m|\x1b[0m'

const res = await group(
	{
		name: () => {
			return text({
				message: 'name' + SEP,
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

console.log({
	name: res.name,
	bundler: res.bundler,
	addons: res.addons,
})

const bundler_op = OPS.bundler[res.bundler as keyof typeof OPS.bundler]
pkgjson.name = res.name
pkgjson.scripts.dev = bundler_op.scripts.dev
pkgjson.scripts.build = bundler_op.scripts.build

data.files.set('package.json', JSON.stringify(pkgjson, null, 2))

// if (bundler_op.config) {
if (res.bundler === 'tsup') {
	data.files.set(
		'tsup.config.js',
		OPS.bundler.tsup.config['tsup.config.js'](data.entrypoint_filename),
	)
}

if (res.addons.includes('prettier')) {
	console.log('adding prettier')
	data.files.set('.prettierrc', prettier_raw as any as string)
}

if (res.addons.includes('jsr')) {
	console.log('adding jsr')
	data.files.set('jsr.json', OPS['jsr.json'](res.name, data.entrypoint_filename))
}

if (res.addons.includes('vitest')) {
	console.log('adding vitest')
	// @ts-expect-error
	const current = pkgjson.devDependencies['vite']
	console.warn('current vite:', current)
	let latest = ''
	try {
		const { version } = await (await fetch('https://registry.npmjs.org/vite/latest')).json()
		latest = version
	} catch (e) {}

	console.log('latest vite:', latest)

	if (latest && current !== latest) {
		// @ts-expect-error
		pkgjson.devDependencies['vite'] = latest
	}
}

console.log('data:', j(data))
console.log('files', debrief(Object.fromEntries(data.files.entries()), { siblings: 10 }))

console.log('Creating output folder...', outputFolder)
mkdirSync(outputFolder, { recursive: true })

console.log('Generating files...')

for (const [name, content] of data.files) {
	Bun.write(join(outputFolder, name), content)
}

outro(`You're all set!`)
//⌟

//· Utils ···································································¬

function findDir(dir: string, maxDepth = 2) {
	let found

	function look(depth = 0) {
		const path = join(here, '../'.repeat(depth), dir)
		console.log('path:', path, 'depth:', depth)
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
//⌟

/**
 * Configuration for {@link debrief}.
 */
export interface DebriefOptions {
	/**
	 * The max depth to traverse.
	 * @default 2
	 */
	depth?: number

	/**
	 * The max number of object or array entries before truncating.
	 * @default 4
	 */
	siblings?: number

	/**
	 * If `true` the {@link siblings} limit is bypassed on the top level.
	 * @default false
	 */
	preserveRootSiblings?: boolean

	/**
	 * The max number of chars per string before truncating.
	 * @default 30
	 */
	trim?: number

	/**
	 * The max number of decimal places to round numbers to.
	 * @default 3
	 */
	round?: number | false
}

/**
 * Like `tree` for objects, with options for depth, max siblings, and max string length.
 */
export function debrief<T>(
	obj: unknown,
	{
		depth = 2,
		siblings = 4,
		preserveRootSiblings = false,
		trim = 30,
		round = 3,
	}: DebriefOptions = {},
) {
	function parse(o: unknown, d: number): unknown {
		if (o === null) {
			return o
		}

		switch (typeof o) {
			case 'boolean':
			case 'symbol':
			case 'undefined': {
				return o
			}
			case 'string': {
				// Trim strings that are too long.
				if (o.length < trim + 3) return o
				return o.slice(0, trim) + '...'
			}
			case 'number': {
				// Trim numbers that are too long.
				const s = round ? o.toFixed(round) : o.toString()
				if (s.length > trim + 3) {
					return +s.slice(0, trim) + '...'
				}
				return +s
			}
			case 'bigint': {
				// Bigints can't be serialized, so we have to trim them.
				return +o.toString().slice(0, trim)
			}
			case 'function': {
				return o.name
			}
			case 'object': {
				const depthReached = d > depth

				if (Array.isArray(o)) {
					// if (depthReached) return `[...${o.length} ${o.length === 1 ? 'item' : 'items'}]`
					if (depthReached) return `[ ...${o.length} ]`
					if (o.length <= siblings || d === 0) return o.map(s => parse(s, d + 1))

					return [
						...o.slice(0, siblings).map(s => parse(s, d)),
						`...${o.length - siblings} more`,
					]
				}

				const keyCount = Object.keys(o).length

				if (depthReached) {
					return `{...${keyCount} ${keyCount === 1 ? 'entry' : 'entries'}}`
				}

				if (keyCount <= siblings || (preserveRootSiblings && d === 0)) {
					return Object.fromEntries(
						Object.entries(o).map(([k, v]) => [k, parse(v, d + 1)]),
					)
				}

				return Object.fromEntries(
					Object.entries(o)
						.slice(0, siblings)
						.concat([['...', `${keyCount - siblings} more`]])
						.map(([k, v]) => [k, parse(v, d + 1)]),
				)
			}
		}

		return o
	}

	return parse(obj, 0) as T
}
