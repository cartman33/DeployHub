const fs = require('fs');
let c = fs.readFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'utf8');

c = c.replace(/if \(modeType === "new" \|\| editVersionMode\) \{/g, 'if (modeType === "new" || editVersionMode !== null) {');

fs.writeFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', c, 'utf8');
