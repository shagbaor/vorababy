// Publishes firestore.rules to the Firebase project in .env.local:
//   pnpm db:rules
import { readFile } from 'node:fs/promises'
import { projectId, securityRules } from './firebase.mjs'

const source = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
const ruleset = await securityRules.releaseFirestoreRulesetFromSource(source)
console.log(`Firestore rules published to ${projectId} (ruleset ${ruleset.name}).`)
