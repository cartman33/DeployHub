const fs = require('fs');
let c = fs.readFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'utf8');

c = c.replace(/const maxSuffix = availableVersions\.length > 0[\s\S]*?:\s*-2;/, 
`const maxSuffix = availableVersions.length > 0
    ? Math.max(...availableVersions.map(v => {
        if (v.versionName === selectedDate.replace(/-/g, '.')) return 0;
        const parts = v.versionName.split('-');
        return parts.length > 1 ? parseInt(parts[1], 10) : 0;
      }))
    : -1;`);

c = c.replace(/const targetVersionName = modeType === "new"[\s\S]*?: \(editVersionMode \? `\$\{prefix\}-\$\{editVersionMode\}` : prefix\);/,
`const targetVersionName = modeType === "new" 
        ? (maxSuffix >= 0 ? \`\${prefix}-\${maxSuffix + 1}\` : prefix) 
        : (editVersionMode ? \`\${prefix}-\${editVersionMode}\` : prefix);`);

c = c.replace(/const targetVersionName = maxSuffix >= -1 \? `\$\{prefix\}-\$\{maxSuffix \+ 1\}` : prefix;/,
`const targetVersionName = maxSuffix >= 0 ? \`\${prefix}-\${maxSuffix + 1}\` : prefix;`);

c = c.replace(/등록될 버전명: \{selectedDate\.replace\(\/-\/g, '\.'\)\}\{maxSuffix >= -1 \? `-\$\{maxSuffix \+ 1\}` : ''\}/,
"등록될 버전명: {selectedDate.replace(/-/g, '.')}{maxSuffix >= 0 ? `-${maxSuffix + 1}` : ''}");

fs.writeFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', c, 'utf8');
