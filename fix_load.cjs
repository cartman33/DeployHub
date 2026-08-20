const fs = require('fs');
let c = fs.readFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'utf8');

c = c.replace(/const targetVersionName = modeType === "new"\s*\n\s*\? \(maxSuffix >= 0 \? `\$\{prefix\}-\$\{maxSuffix \+ 1\}` : prefix\)\s*\n\s*: \(editVersionMode \? `\$\{prefix\}-\$\{editVersionMode\}` : prefix\);/, 
  'const targetVersionName = editVersionMode ? `\${prefix}-\${editVersionMode}` : prefix;');

fs.writeFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', c, 'utf8');
