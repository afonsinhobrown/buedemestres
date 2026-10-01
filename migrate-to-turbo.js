const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 1. Criar pastas do Monorepo
const dirs = [
  'apps/web',
  'apps/cliente',
  'apps/pro',
  'packages/ui',
  'packages/api',
  'packages/validators',
  'packages/domain',
  'packages/providers'
]

dirs.forEach(d => fs.mkdirSync(path.join(__dirname, d), { recursive: true }))

// 2. Mover código actual para apps/web
const filesToMove = [
  'src',
  'public',
  'next.config.ts',
  'tsconfig.json',
  'package.json', // Vamos renomear e modificar isto logo a seguir
  'eslint.config.mjs',
  'postcss.config.mjs',
  'next-env.d.ts',
  'components.json'
]

filesToMove.forEach(f => {
  if (fs.existsSync(path.join(__dirname, f))) {
    fs.renameSync(path.join(__dirname, f), path.join(__dirname, 'apps/web', f))
  }
})

// 3. Criar package.json raiz para o PNPM/Turborepo
const rootPkg = {
  "name": "buedemestres-monorepo",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "turbo": "^2.1.2",
    "prettier": "^3.2.5"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
fs.writeFileSync(path.join(__dirname, 'package.json'), JSON.stringify(rootPkg, null, 2))

// 4. Criar pnpm-workspace.yaml
const pnpmWorkspace = `packages:
  - 'apps/*'
  - 'packages/*'
`
fs.writeFileSync(path.join(__dirname, 'pnpm-workspace.yaml'), pnpmWorkspace)

// 5. Criar turbo.json
const turboJson = {
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {}
  }
}
fs.writeFileSync(path.join(__dirname, 'turbo.json'), JSON.stringify(turboJson, null, 2))

// 6. Ajustar o package.json do apps/web
const webPkgPath = path.join(__dirname, 'apps/web/package.json')
if (fs.existsSync(webPkgPath)) {
  const webPkg = JSON.parse(fs.readFileSync(webPkgPath, 'utf8'))
  webPkg.name = "web"
  fs.writeFileSync(webPkgPath, JSON.stringify(webPkg, null, 2))
}

console.log('Migração para estrutura Monorepo concluída!')
