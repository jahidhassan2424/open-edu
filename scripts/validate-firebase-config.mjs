#!/usr/bin/env node

/**
 * Firebase Configuration Validation Script
 * 
 * Validates that all Firebase collections and schemas are consistent across:
 * - src/lib/firebase/collections.ts
 * - src/lib/firebase/schemas.ts 
 * - scripts/firebase-collections.mjs
 * - the Firestore rules file configured in firebase.json
 * 
 * Helps prevent collection naming mismatches and schema validation issues.
 */

import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { pathToFileURL } from 'url'

// Colors for console output
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m'
}

function colorize(color, text) {
	return `${colors[color]}${text}${colors.reset}`
}

async function loadCollectionsFromTypeScript() {
	try {
		const collectionsPath = resolve('src/lib/firebase/collections.ts')
		const content = await readFile(collectionsPath, 'utf-8')
		
		// Extract collection definitions using regex (simple parser)
		const collectionsMatch = content.match(/export const COLLECTIONS = {([^}]+)}/s)
		if (!collectionsMatch) {
			throw new Error('Could not find COLLECTIONS export in collections.ts')
		}
		
		const collectionsStr = collectionsMatch[1]
		const collections = {}
		
		// Parse each line like "USERS: 'users',"
		const lines = collectionsStr.split('\n')
		for (const line of lines) {
			const match = line.trim().match(/([A-Z_]+):\s*['"`]([^'"`]+)['"`]/)
			if (match) {
				collections[match[1]] = match[2]
			}
		}
		
		return collections
	} catch (error) {
		throw new Error(`Failed to load TypeScript collections: ${error.message}`)
	}
}

async function loadCollectionsFromJavaScript() {
	try {
		const collectionsPath = pathToFileURL(resolve('scripts/firebase-collections.mjs')).href
		const module = await import(collectionsPath)
		return module.COLLECTIONS
	} catch (error) {
		throw new Error(`Failed to load JavaScript collections: ${error.message}`)
	}
}

async function loadSchemasFromTypeScript() {
	try {
		const schemasPath = resolve('src/lib/firebase/schemas.ts')
		const content = await readFile(schemasPath, 'utf-8')
		
		// Extract schema names (look for "export const [name]Schema")
		const schemaMatches = content.match(/export const (\w+)Schema/g) || []
		const schemas = schemaMatches.map(match => {
			const name = match.replace('export const ', '').replace('Schema', '')
			return name.charAt(0).toLowerCase() + name.slice(1) // camelCase
		})
		
		return schemas
	} catch (error) {
		throw new Error(`Failed to load TypeScript schemas: ${error.message}`)
	}
}

async function loadFirestoreRules() {
	try {
		const firebaseConfig = JSON.parse(await readFile(resolve('firebase.json'), 'utf-8'))
		const rulesFile = firebaseConfig.firestore?.rules
		if (!rulesFile) throw new Error('firebase.json does not configure firestore.rules')
		const rulesPath = resolve(rulesFile)
		const content = await readFile(rulesPath, 'utf-8')
		
		// Extract collection references from rules (look for match /collection/{document})
		const collectionMatches = content.match(/match \/([A-Za-z0-9-]+)\/\{[^}]+\}/g) || []
		const collections = collectionMatches.map(match => {
			const collectionMatch = match.match(/match \/([A-Za-z0-9-]+)\//)
			return collectionMatch ? collectionMatch[1] : null
		}).filter(Boolean)
		
		return [...new Set(collections)] // Remove duplicates
	} catch (error) {
		throw new Error(`Failed to load Firestore rules: ${error.message}`)
	}
}

function validateCollectionConsistency(tsCollections, jsCollections) {
	const errors = []
	const warnings = []
	
	// Check if JavaScript collections match TypeScript collections
	for (const [key, value] of Object.entries(tsCollections)) {
		if (!(key in jsCollections)) {
			errors.push(`Missing collection '${key}' in JavaScript collections`)
		} else if (jsCollections[key] !== value) {
			errors.push(`Collection value mismatch for '${key}': TS='${value}' vs JS='${jsCollections[key]}'`)
		}
	}
	
	// Check for extra JavaScript collections
	for (const key of Object.keys(jsCollections)) {
		if (!(key in tsCollections)) {
			warnings.push(`Extra collection '${key}' in JavaScript collections (not in TypeScript)`)
		}
	}
	
	return { errors, warnings }
}

function validateSchemaAlignment(collections, schemas) {
	const warnings = []

	// Check if we have schemas for major collections
	const expectedSchemas = ['user', 'course', 'enrollment', 'courseProgress']
	for (const expected of expectedSchemas) {
		if (!schemas.includes(expected)) {
			warnings.push(`Missing schema for '${expected}' - consider adding ${expected}Schema`)
		}
	}
	
	return { warnings }
}

function validateFirestoreRules(collections, rulesCollections) {
	const warnings = []
	const collectionValues = Object.values(collections)
	
	// Check if Firestore rules cover our collections
	for (const collection of collectionValues) {
		if (!rulesCollections.includes(collection)) {
			warnings.push(`Collection '${collection}' not found in Firestore rules`)
		}
	}
	
	// Check for rules that reference unknown collections
	for (const ruleCollection of rulesCollections) {
		if (!collectionValues.includes(ruleCollection)) {
			warnings.push(`Firestore rule references unknown collection '${ruleCollection}'`)
		}
	}
	
	return { warnings }
}

async function main() {
	console.log(colorize('blue', '🔍 Firebase Configuration Validation'))
	console.log(colorize('blue', '=' .repeat(50)))
	console.log()
	
	try {
		// Load all configuration sources
		console.log('📄 Loading configuration files...')
		const [tsCollections, jsCollections, schemas, rulesCollections] = await Promise.all([
			loadCollectionsFromTypeScript(),
			loadCollectionsFromJavaScript(),
			loadSchemasFromTypeScript(),
			loadFirestoreRules()
		])
		
		console.log(colorize('green', '✅ All configuration files loaded successfully'))
		console.log()
		
		// Display loaded data
		console.log(colorize('magenta', '📋 Configuration Summary:'))
		console.log(`TypeScript Collections: ${Object.keys(tsCollections).length}`)
		console.log(`JavaScript Collections: ${Object.keys(jsCollections).length}`)
		console.log(`Zod Schemas: ${schemas.length}`)
		console.log(`Firestore Rules: ${rulesCollections.length} collections`)
		console.log()
		
		// Validate collection consistency
		console.log(colorize('blue', '🔄 Validating collection consistency...'))
		const { errors: collectionErrors, warnings: collectionWarnings } = validateCollectionConsistency(tsCollections, jsCollections)
		
		// Validate schema alignment
		console.log(colorize('blue', '📊 Validating schema alignment...'))
		const { warnings: schemaWarnings } = validateSchemaAlignment(tsCollections, schemas)
		
		// Validate Firestore rules
		console.log(colorize('blue', '🔒 Validating Firestore rules...'))
		const { warnings: rulesWarnings } = validateFirestoreRules(tsCollections, rulesCollections)
		
		// Report results
		const allErrors = [...collectionErrors]
		const allWarnings = [...collectionWarnings, ...schemaWarnings, ...rulesWarnings]
		
		console.log()
		console.log(colorize('blue', '📊 Validation Results'))
		console.log(colorize('blue', '-'.repeat(30)))
		
		if (allErrors.length === 0) {
			console.log(colorize('green', '✅ No errors found!'))
		} else {
			console.log(colorize('red', `❌ Found ${allErrors.length} error(s):`))
			allErrors.forEach(error => {
				console.log(colorize('red', `  • ${error}`))
			})
		}
		
		if (allWarnings.length === 0) {
			console.log(colorize('green', '✅ No warnings'))
		} else {
			console.log(colorize('yellow', `⚠️  Found ${allWarnings.length} warning(s):`))
			allWarnings.forEach(warning => {
				console.log(colorize('yellow', `  • ${warning}`))
			})
		}
		
		console.log()
		
		if (allErrors.length === 0) {
			console.log(colorize('green', '🎉 Firebase configuration validation passed!'))
			process.exit(0)
		} else {
			console.log(colorize('red', '💥 Firebase configuration validation failed!'))
			console.log(colorize('red', 'Please fix the errors above before deploying.'))
			process.exit(1)
		}
		
	} catch (error) {
		console.error(colorize('red', `❌ Validation failed: ${error.message}`))
		process.exit(1)
	}
}

main()
