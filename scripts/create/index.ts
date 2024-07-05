/**
 * @fileoverview WIP package template generator
 */

import {
	multiselect,
	spinner,
	confirm,
	select,
	cancel,
	outro,
	intro,
	group,
	text,
} from '@clack/prompts'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'
import pkgjson from './configs/package.json' with { type: 'json' }

type Bundler = 'tsup' | 'tsc' | 'bun'
type BundlerCfg = Record<
	Bundler,
	{
		default?: boolean
		deps: string[]
		hint: string
		scripts: {
			dev: string
			build: string
			'build:watch': string
		}
	}
>

const devDependencies = Object.keys(pkgjson.devDependencies)

const here = `/${new URL(import.meta.url).pathname.split('/').slice(1, -1).join('/')}`
const args = process?.argv?.slice(2)

const temp = args.includes('--temp') || args.includes('-t')
const help = args.includes('--help') || args.includes('-h')

if (help) {
	console.log(`
\x1b[36m\x1b[2m  b o p o \x1b[0m  c r e a t e

\x1b[2m  NPM \x1b[0m\x1b[2m+\x1b[33m JSR \x1b[0m\x1b[2mpackage template generator
\x1b[0m

  help

    pnpm create bopo \x1b[2m[options]
\x1b[0m
    -t, --temp   \x1b[2mwrite generated files to the temporary testing folder\x1b[0m
    -h, --help   \x1b[2mthis screen \x1b[0m
`)

	process?.exit(0)
	// @ts-expect-error
	Deno?.exit()
}

const CFG = {
	useTemp: temp,
	temp_dir: 'tmp', // used when useTemp is `false`
	dest_dir: '../../packages',
	default_bundler: 'tsup',
	// todo - {runtime, bundler} ??  willow says yes
	// runtime: {
	// 	vite_node: {},
	// 	bun: {},
	// 	deno: {},
	// },
	bundler: {
		tsup: {
			default: true,
			scripts: {
				dev: 'vite-node --watch src/_PATH_',
				build: 'tsup',
				'build:watch': 'tsup --watch',
			},
			hint: 'default',
			deps: ['tsup', 'vite-node'],
		},
		bun: {
			scripts: {
				dev: 'bun run src/_PATH_ --watch',
				build: 'bun build src/_PATH_ --out-dir dist',
				'build:watch': 'bun build src/_PATH_ --out-dir dist -w',
			},
			hint: '',
			deps: process.env.PATH?.includes('bun') ? ['bun', '@types/bun'] : ['@types/bun'],
		},
		tsc: {
			scripts: {
				dev: 'vite-node --watch',
				build: 'tsc',
				'build:watch': 'tsc --watch',
			},
			hint: 'no bundler',
			deps: ['vite-node'],
		},
	} satisfies BundlerCfg,
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

const folders = new Set<string>()

//· Main / Prompt ···································································¬

const prettier_raw = readFileSync(join(here, 'configs/prettier.config.json'), 'utf-8')
const workflow_raw = readFileSync(join(here, 'configs/workflow.yml'), 'utf-8')
const tsup_raw = readFileSync(join(here, 'configs/tsup.config.ts'), 'utf-8')
const tsconfig = readFileSync(join(here, 'configs/tsconfig.json'), 'utf-8')
const jsr_raw = readFileSync(join(here, 'configs/jsr.json'), 'utf-8')

/** leading `|` */
const SEP = '\n\x1b[2m│\x1b[0m'

console.clear()

intro(`
\x1b[2m│\x1b[0m
\x1b[2m│\x1b[36m  b o p o \x1b[0m  c r e a t e${temp ? '  \x1b[2m temp\x1b[0m' : ''}
\x1b[2m│\x1b[0m`)

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
				placeholder: 'the best javascript package ever!',
				defaultValue: '',
				initialValue: '',
			})
		},
		entry: () => {
			return text({
				message: 'entry' + SEP,
				defaultValue: 'index',
				placeholder: 'index.ts',
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
							hint: CFG.bundler[k as Bundler].hint,
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
					{
						value: 'ghWorkflow',
						label: 'github action',
						hint: em('Changesets / JSR'),
					},
				],
				initialValues: ['prettier', 'vitest', 'jsr', 'ghWorkflow'],
			})
		},
		install: () => {
			return confirm({
				message: 'install dependencies?' + SEP,
				active: 'yes',
				inactive: 'no',
				initialValue: true,
			})
		},
	},
	{
		onCancel: () => {
			cancel('cancelled')
			process.exit(0)
		},
	},
)

const s = spinner()
s.start('Generating project...')

files.set('tsconfig.json', tsconfig as any as string)

//* Update package.json

const bundler_cfg = CFG.bundler[res.bundler as Bundler]
pkgjson.name = `${res.scope}/${res.name}`
pkgjson.description = res.description

pkgjson.scripts.dev = bundler_cfg.scripts.dev.replace(/_PATH_/, res.entry)
pkgjson.scripts.build = bundler_cfg.scripts.build.replace(/_PATH_/, res.entry)
pkgjson.scripts['build:watch'] = bundler_cfg.scripts['build:watch'].replace(/_PATH_/, res.entry)

devDependencies.push(...bundler_cfg.deps)

//* Addons
s.message('adding bundler')
switch (res.bundler) {
	case 'tsup': {
		files.set('tsup.config.ts', tsup_raw.replace(/_PATH_/g, res.entry))
		break
	}
	// todo - bun/deno init stuff
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
	devDependencies.push('vitest')
}

if (res.addons.includes('ghWorkflow')) {
	folders.add('.github/workflows')
	files.set('.github/workflows/release.yml', workflow_raw)
}

//* Now we can create the package.json file.
s.message('resolving latest dependency versions')
const deps = await resolveDeps(devDependencies)
Object.assign(pkgjson.devDependencies, deps)

s.message('writing package.json')
files.set('package.json', JSON.stringify(pkgjson, null, 2).replaceAll(/_PATH_/g, res.entry))

//* Determine the output folder.

const outputFolder = join(CFG.useTemp ? tmpFolder : packagesFolder, res.name)

//* Write the files.

if (existsSync(outputFolder)) {
	rmSync(outputFolder, { recursive: true })
}
mkdirSync(join(outputFolder), { recursive: true })

if (folders.size) {
	for (const folder of folders) {
		mkdirSync(join(outputFolder, folder), { recursive: true })
	}
}

s.message('Generating files')

for (const [name, content] of files) {
	const filepath = join(outputFolder, name)
	try {
		writeFileSync(join(outputFolder, name), content, {
			encoding: 'utf-8',
		})
	} catch (e) {
		console.log('\n\n\x1b[31mError writing file\x1b[0m', filepath, '\n')
		console.error(e)
		s.stop('Error')
	}
}

mkdirSync(join(outputFolder, 'src'))

writeFileSync(
	join(outputFolder, 'src', `${res.entry}.ts`),
	`/**
 * @module ${res.description ?? 'A blank package template.'}
 */

export const foo = (msg: string) => console.log(msg)

foo('hello world')
`,
)

if (res.install) {
	s.message('Installing dependencies')
	try {
		execSync(`cd ${resolve(here, outputFolder)} && pnpm update --latest`, { stdio: 'inherit' })
	} catch (e) {
		console.error(e)
		s.stop('❌ \x1b[31mError\x1b[0m')
		process.exit(1)
	}
}

s.stop(`\x1b[32m✔️\x1b[0m  ${em(outputFolder)}`)
outro(`b o p o   \x1b[32mc r e a t e d\x1b[0m`)
process.exit(0)
//⌟

async function resolveDeps(arr: string[]): Promise<Record<string, string>> {
	const res = await fetch(`https://npm.antfu.dev/${arr.join('+')}`)
	let data = (await res.json()) as { version: string; name: string }[]

	if (!Array.isArray(data)) data = [data]

	return data.reduce(
		(acc, { name, version }) => {
			acc[name] = version
			return acc
		},
		{} as Record<string, string>,
	)
}

function em(str: string) {
	return `\x1b[2m\x1b[3m${str}\x1b[0m`
}
