import { spawnSync } from 'node:child_process'
import { devNull } from 'node:os'

const env = { ...process.env }
delete env.npm_config_allow_scripts
delete env.NPM_CONFIG_ALLOW_SCRIPTS

const npmCli = process.env.npm_execpath
const command = npmCli ? process.execPath : 'npm'
const args = npmCli
  ? [npmCli, 'audit', '--omit=dev', `--userconfig=${devNull}`]
  : ['audit', '--omit=dev', `--userconfig=${devNull}`]
const result = spawnSync(command, args, {
  env,
  stdio: 'inherit',
})

if (result.error) {
  console.error(`Could not start npm audit: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
