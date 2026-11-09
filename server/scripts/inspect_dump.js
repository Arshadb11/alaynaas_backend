const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'database', 'old_products.sql');
const content = fs.readFileSync(filePath, 'utf8');

// Find all CREATE TABLE definitions
const tableRegex = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\) ENGINE/g;
let match;
const tables = {};

while ((match = tableRegex.exec(content)) !== null) {
  const tableName = match[1];
  const body = match[2];
  const columns = body.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('`'))
    .map(line => {
      const colMatch = line.match(/^`([^`]+)`\s+([a-zA-Z0-9_()]+)/);
      return colMatch ? { name: colMatch[1], type: colMatch[2] } : null;
    })
    .filter(Boolean);
  
  tables[tableName] = columns;
}

console.log('=== TABLES & COLUMNS ===');
for (const [tbl, cols] of Object.entries(tables)) {
  console.log(`\nTable: ${tbl} (${cols.length} columns)`);
  console.log(cols.map(c => `  - ${c.name} (${c.type})`).join('\n'));
}

// Approximate rows per table by counting lines in INSERT blocks
console.log('\n=== ROW ESTIMATES ===');
const lines = content.split('\n');
let currentInsertTable = null;
const rowCounts = {};

for (const line of lines) {
  const insertMatch = line.match(/INSERT INTO `([^`]+)`/);
  if (insertMatch) {
    currentInsertTable = insertMatch[1];
    rowCounts[currentInsertTable] = (rowCounts[currentInsertTable] || 0);
  }
  if (currentInsertTable && line.trim().startsWith('(')) {
    // each row usually starts with (id, ...)
    rowCounts[currentInsertTable] = (rowCounts[currentInsertTable] || 0) + 1;
  }
}

for (const [tbl, cnt] of Object.entries(rowCounts)) {
  console.log(`Table ${tbl}: ~${cnt} rows`);
}
