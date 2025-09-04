#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const EXCLUDED_DIRS = [
    'node_modules',
    '.git',
    '.idea',
    'dist',
    'build',
    'coverage',
    '.nyc_output',
    'auth_sessions',
    'downloads',
    'uploads',
    'sessions',
    '.media'
];

const EXCLUDED_FILES = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    'package-lock.json',
    'yarn.lock',
    'tailwind.config.js',
    'vite.config.js',
    'postcss.config.js',
    'eslint.config.js',
    'webpack.config.js',
    'babel.config.js',
    'jest.config.js'
];

const SUPPORTED_EXTENSIONS = [
    '.js',
    '.jsx',
    '.ts',
    '.tsx'
];

function shouldProcessFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    
    if (EXCLUDED_FILES.some(excludedFile => fileName.startsWith(excludedFile))) {
        return false;
    }
    
    return SUPPORTED_EXTENSIONS.includes(ext);
}

function shouldSkipDirectory(dirName) {
    return EXCLUDED_DIRS.includes(dirName);
}

function removeComments(content, filePath) {
    const lines = content.split('\n');
    const processedLines = [];
    let inMultiLineComment = false;
    let modifiedCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        if (inMultiLineComment) {
            const multiCommentEnd = line.indexOf('*/');
            if (multiCommentEnd !== -1) {
                line = line.substring(multiCommentEnd + 2);
                inMultiLineComment = false;
                modifiedCount++;
            } else {
                processedLines.push('');
                modifiedCount++;
                continue;
            }
        }
        
        let inString = false;
        let stringChar = null;
        let result = '';
        let j = 0;
        
        while (j < line.length) {
            const char = line[j];
            const nextChar = line[j + 1];
            
            if (!inString && (char === '"' || char === "'" || char === '`')) {
                inString = true;
                stringChar = char;
                result += char;
                j++;
            } else if (inString && char === stringChar && (j === 0 || line[j - 1] !== '\\')) {
                inString = false;
                stringChar = null;
                result += char;
                j++;
            } else if (!inString && char === '/' && nextChar === '/') {
                if (j > 0 && line[j - 1] === ':') {
                    result += char;
                    j++;
                } else {
                    modifiedCount++;
                    break;
                }
            } else if (!inString && char === '/' && nextChar === '*') {
                const multiCommentEnd = line.indexOf('*/', j + 2);
                if (multiCommentEnd !== -1) {
                    j = multiCommentEnd + 2;
                    modifiedCount++;
                } else {
                    inMultiLineComment = true;
                    modifiedCount++;
                    break;
                }
            } else {
                result += char;
                j++;
            }
        }
        
        processedLines.push(result.trimEnd());
    }
    
    return {
        content: processedLines.join('\n'),
        modified: modifiedCount > 0,
        removedLines: modifiedCount
    };
}

function processFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const result = removeComments(content, filePath);
        
        if (result.modified) {
            fs.writeFileSync(filePath, result.content, 'utf8');
            console.log(`✅ ${filePath} - Removed ${result.removedLines} comment lines`);
            return { processed: true, modified: true, removedLines: result.removedLines };
        } else {
            console.log(`⏭️  ${filePath} - No comments found`);
            return { processed: true, modified: false, removedLines: 0 };
        }
    } catch (error) {
        console.error(`❌ Error processing ${filePath}: ${error.message}`);
        return { processed: false, modified: false, removedLines: 0 };
    }
}

function walkDirectory(dir, stats = { processed: 0, modified: 0, totalRemoved: 0, errors: 0 }) {
    try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                if (!shouldSkipDirectory(item)) {
                    walkDirectory(itemPath, stats);
                } else {
                    console.log(`⏭️  Skipping directory: ${itemPath}`);
                }
            } else if (stat.isFile() && shouldProcessFile(itemPath)) {
                const result = processFile(itemPath);
                stats.processed++;
                if (result.modified) {
                    stats.modified++;
                    stats.totalRemoved += result.removedLines;
                }
                if (!result.processed) {
                    stats.errors++;
                }
            }
        }
    } catch (error) {
        console.error(`❌ Error reading directory ${dir}: ${error.message}`);
        stats.errors++;
    }
    
    return stats;
}

function main() {
    console.log('🚀 Starting comment removal process...\n');
    console.log('Supported file extensions:', SUPPORTED_EXTENSIONS.join(', '));
    console.log('Excluded directories:', EXCLUDED_DIRS.join(', '));
    console.log('─'.repeat(60));
    
    const startTime = Date.now();
    const projectRoot = process.cwd();
    
    console.log(`\n📁 Processing project: ${projectRoot}\n`);
    
    const stats = walkDirectory(projectRoot);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(60));
    console.log(`📄 Files processed: ${stats.processed}`);
    console.log(`✏️  Files modified: ${stats.modified}`);
    console.log(`🗑️  Comment lines removed: ${stats.totalRemoved}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log(`⏱️  Duration: ${duration}s`);
    
    if (stats.modified > 0) {
        console.log('\n✅ Comment removal completed successfully!');
    } else {
        console.log('\n💤 No comments were found to remove.');
    }
}

if (require.main === module) {
    main();
}

module.exports = { removeComments, processFile, walkDirectory };