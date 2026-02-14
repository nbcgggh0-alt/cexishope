/**
 * Comprehensive Function & Handler Audit Script
 * 
 * Checks:
 * 1. Every function imported in index.js actually exists in its handler module
 * 2. Every function exported from handlers is imported in index.js
 * 3. All require() calls resolve to existing files
 * 4. All database methods called in handlers exist in database.js
 * 5. Cross-handler imports resolve correctly
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HANDLERS_DIR = path.join(ROOT, 'handlers');
const UTILS_DIR = path.join(ROOT, 'utils');

let totalIssues = 0;

function logIssue(severity, file, message) {
    const icon = severity === 'ERROR' ? '❌' : severity === 'WARN' ? '⚠️' : 'ℹ️';
    console.log(`  ${icon} [${severity}] ${path.basename(file)}: ${message}`);
    if (severity === 'ERROR') totalIssues++;
}

function logOk(message) {
    console.log(`  ✅ ${message}`);
}

// ──────────────────────────────────────────────────────
// 1. Parse index.js imports
// ──────────────────────────────────────────────────────
function parseIndexImports() {
    const indexPath = path.join(ROOT, 'index.js');
    const content = fs.readFileSync(indexPath, 'utf8');

    const imports = [];
    // Match: const { fn1, fn2 } = require('./handlers/xxx')
    const regex = /const\s*\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const functions = match[1].split(',').map(f => {
            f = f.trim();
            // Handle aliased imports like "handleFilterCallback: handleProductFilterCallback"
            if (f.includes(':')) {
                const parts = f.split(':').map(p => p.trim());
                return { original: parts[0], alias: parts[1] };
            }
            return { original: f, alias: f };
        }).filter(f => f.original);

        const modulePath = match[2];
        imports.push({ modulePath, functions });
    }

    return imports;
}

// ──────────────────────────────────────────────────────
// 2. Parse handler exports
// ──────────────────────────────────────────────────────
function parseHandlerExports(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');

        const exports = [];
        // Match: module.exports = { fn1, fn2 }
        const moduleExportsMatch = content.match(/module\.exports\s*=\s*\{([^}]+)\}/);
        if (moduleExportsMatch) {
            const fns = moduleExportsMatch[1].split(',').map(f => f.trim()).filter(Boolean);
            exports.push(...fns);
        }

        return exports;
    } catch (err) {
        return null; // File doesn't exist
    }
}

// ──────────────────────────────────────────────────────
// 3. Check require() calls in all handler files
// ──────────────────────────────────────────────────────
function checkRequireCalls(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];

    const regex = /require\(['"]([^'"]+)['"]\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const moduleName = match[1];

        // Skip node_modules
        if (!moduleName.startsWith('.') && !moduleName.startsWith('/')) continue;

        // Resolve relative to file
        const dir = path.dirname(filePath);
        let resolved = path.resolve(dir, moduleName);

        // Try with .js extension
        if (!fs.existsSync(resolved) && !fs.existsSync(resolved + '.js') && !fs.existsSync(resolved + '/index.js')) {
            issues.push(`require('${moduleName}') — file not found`);
        }
    }

    return issues;
}

// ──────────────────────────────────────────────────────
// 4. Check db.xxx() calls in handlers match database.js methods
// ──────────────────────────────────────────────────────
function getDbMethods() {
    const dbPath = path.join(UTILS_DIR, 'database.js');
    const content = fs.readFileSync(dbPath, 'utf8');

    const methods = [];
    // Match: async methodName( or methodName(
    const regex = /^\s+(?:async\s+)?(\w+)\s*\(/gm;
    let match;

    while ((match = regex.exec(content)) !== null) {
        if (match[1] !== 'constructor' && match[1] !== 'Database') {
            methods.push(match[1]);
        }
    }

    return methods;
}

function checkDbCallsInFile(filePath, validMethods) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];

    // Match: db.xxx(
    const regex = /\bdb\.(\w+)\s*\(/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const method = match[1];
        if (!validMethods.includes(method)) {
            issues.push(`db.${method}() — method does not exist in database.js`);
        }
    }

    return [...new Set(issues)]; // Deduplicate
}

// ──────────────────────────────────────────────────────
// 5. Check for function definitions that don't match exports
// ──────────────────────────────────────────────────────
function checkFunctionDefinitions(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];

    // Get all function definitions
    const funcDefs = [];
    const funcRegex = /^(?:async\s+)?function\s+(\w+)/gm;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
        funcDefs.push(match[1]);
    }

    // Get exports
    const exports = parseHandlerExports(filePath) || [];

    // Check if exports reference undefined functions
    for (const exp of exports) {
        if (!funcDefs.includes(exp)) {
            // Could be a const = async () => pattern
            const constRegex = new RegExp(`(?:const|let|var)\\s+${exp}\\s*=`);
            if (!constRegex.test(content)) {
                issues.push(`Exports '${exp}' but no function/const definition found`);
            }
        }
    }

    return issues;
}

// ──────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────
async function main() {
    console.log('='.repeat(70));
    console.log('  COMPREHENSIVE FUNCTION & HANDLER AUDIT');
    console.log('='.repeat(70));
    console.log();

    // 1. Parse index.js imports
    console.log('📋 CHECK 1: Index.js imports vs Handler exports');
    console.log('─'.repeat(70));

    const indexImports = parseIndexImports();
    let importedCount = 0;
    let missingFromHandler = 0;
    let extraInHandler = 0;

    for (const imp of indexImports) {
        const modulePath = imp.modulePath;
        if (!modulePath.startsWith('./handlers/')) continue;

        const handlerFile = path.join(ROOT, modulePath + '.js');
        const handlerExports = parseHandlerExports(handlerFile);

        if (handlerExports === null) {
            logIssue('ERROR', handlerFile, `Handler file not found: ${modulePath}`);
            continue;
        }

        // Check each imported function exists in handler exports
        for (const fn of imp.functions) {
            importedCount++;
            if (!handlerExports.includes(fn.original)) {
                logIssue('ERROR', handlerFile, `Imports '${fn.original}' but handler doesn't export it`);
                missingFromHandler++;
            }
        }

        // Check handler exports NOT imported in index.js
        const importedOriginals = imp.functions.map(f => f.original);
        for (const exp of handlerExports) {
            if (!importedOriginals.includes(exp)) {
                // Some exports are used internally (like isAdmin, getDiscountedPrice)
                // Only flag if they look like handler functions
                if (exp.startsWith('handle') || exp.startsWith('process')) {
                    logIssue('WARN', handlerFile, `Exports '${exp}' but NOT imported in index.js`);
                    extraInHandler++;
                }
            }
        }
    }

    logOk(`${importedCount} functions imported from handlers`);
    if (missingFromHandler === 0) logOk('All imported functions exist in their handlers');
    if (extraInHandler > 0) console.log(`  ℹ️  ${extraInHandler} handler exports not imported in index.js (may be used internally)`);
    console.log();

    // 2. Check require() calls
    console.log('📋 CHECK 2: require() calls resolve to existing files');
    console.log('─'.repeat(70));

    const allJsFiles = [
        path.join(ROOT, 'index.js'),
        ...fs.readdirSync(HANDLERS_DIR).filter(f => f.endsWith('.js')).map(f => path.join(HANDLERS_DIR, f)),
        ...fs.readdirSync(UTILS_DIR).filter(f => f.endsWith('.js')).map(f => path.join(UTILS_DIR, f)),
    ];

    let requireIssueCount = 0;
    for (const filePath of allJsFiles) {
        const issues = checkRequireCalls(filePath);
        for (const issue of issues) {
            logIssue('ERROR', filePath, issue);
            requireIssueCount++;
        }
    }

    if (requireIssueCount === 0) logOk('All require() calls resolve correctly');
    console.log();

    // 3. Check db method calls
    console.log('📋 CHECK 3: db.xxx() calls match database.js methods');
    console.log('─'.repeat(70));

    const validDbMethods = getDbMethods();
    console.log(`  ℹ️  Database.js has ${validDbMethods.length} methods: ${validDbMethods.join(', ')}`);
    console.log();

    let dbIssueCount = 0;
    const handlerFiles = fs.readdirSync(HANDLERS_DIR).filter(f => f.endsWith('.js')).map(f => path.join(HANDLERS_DIR, f));

    for (const filePath of handlerFiles) {
        const issues = checkDbCallsInFile(filePath, validDbMethods);
        for (const issue of issues) {
            logIssue('ERROR', filePath, issue);
            dbIssueCount++;
        }
    }

    // Also check utils and scripts
    for (const dir of [UTILS_DIR, path.join(ROOT, 'scripts')]) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => path.join(dir, f));
        for (const filePath of files) {
            if (path.basename(filePath) === 'database.js') continue; // Skip self
            const issues = checkDbCallsInFile(filePath, validDbMethods);
            for (const issue of issues) {
                logIssue('ERROR', filePath, issue);
                dbIssueCount++;
            }
        }
    }

    if (dbIssueCount === 0) logOk('All db.xxx() calls match existing database methods');
    console.log();

    // 4. Check function definitions match exports
    console.log('📋 CHECK 4: Handler exports match function definitions');
    console.log('─'.repeat(70));

    let defIssueCount = 0;
    for (const filePath of handlerFiles) {
        const issues = checkFunctionDefinitions(filePath);
        for (const issue of issues) {
            logIssue('WARN', filePath, issue);
            defIssueCount++;
        }
    }

    if (defIssueCount === 0) logOk('All handler exports have matching definitions');
    console.log();

    // 5. Check for common anti-patterns
    console.log('📋 CHECK 5: Common anti-patterns');
    console.log('─'.repeat(70));

    let antiPatternCount = 0;
    for (const filePath of handlerFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);

        // Check for console.log without context (just console.log())
        const emptyLogs = (content.match(/console\.log\(\s*\)/g) || []).length;
        if (emptyLogs > 0) {
            logIssue('WARN', filePath, `${emptyLogs} empty console.log() calls`);
            antiPatternCount++;
        }

        // Check for TODO/FIXME/HACK comments
        const todos = (content.match(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)/gi) || []).length;
        if (todos > 0) {
            logIssue('INFO', filePath, `${todos} TODO/FIXME/HACK comments`);
        }

        // Check for unreachable code after return
        const unreachable = (content.match(/return[^;]*;\s*\n\s+[a-zA-Z]/g) || []);
        // This is too broad, skip for now
    }

    if (antiPatternCount === 0) logOk('No common anti-patterns found');
    console.log();

    // Summary
    console.log('='.repeat(70));
    if (totalIssues === 0) {
        console.log('  ✅ ALL CHECKS PASSED! No critical issues found.');
    } else {
        console.log(`  ❌ Found ${totalIssues} critical issue(s) that need fixing.`);
    }
    console.log('='.repeat(70));
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
