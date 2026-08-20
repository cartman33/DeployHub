const fs = require('fs');
let c = fs.readFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'utf8');

c = c.replace(/const targetVersionName = modeType === "new"\s*\n\s*\? `\$\{prefix\}-\$\{maxSuffix \+ 1\}`\s*\n\s*: \(editVersionMode \? `\$\{prefix\}-\$\{editVersionMode\}` : prefix\);/g, 
`const targetVersionName = modeType === "new" 
        ? (maxSuffix >= 0 ? \`\${prefix}-\${maxSuffix + 1}\` : prefix) 
        : (editVersionMode ? \`\${prefix}-\${editVersionMode}\` : prefix);`);

c = c.replace(/setEditVersionMode\(\(maxSuffix \+ 1\)\.toString\(\)\);/g, 
  "setEditVersionMode(maxSuffix >= 0 ? (maxSuffix + 1).toString() : '');");

c = c.replace(/setEditVersionMode\(maxSuffix\.toString\(\)\);/g, 
  "setEditVersionMode(maxSuffix > 0 ? maxSuffix.toString() : '');");

fs.writeFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', c, 'utf8');
