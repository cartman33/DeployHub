const fs = require('fs');
let c = fs.readFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'utf8');

c = c.replace(/\`\$\{prefix\}-\$\{editVersionMode\}\`/g, '(editVersionMode ? `\${prefix}-\${editVersionMode}` : prefix)');

fs.writeFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', c, 'utf8');
