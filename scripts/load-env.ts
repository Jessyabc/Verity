/**
 * Load `.env.local` then `.env` from the project root (npm scripts run with cwd = repo root).
 */
import { resolve } from 'node:path'
import { config } from 'dotenv'

const root = process.cwd()
config({ path: resolve(root, '.env.local') })
config({ path: resolve(root, '.env') })
