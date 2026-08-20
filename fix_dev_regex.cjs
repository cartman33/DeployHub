const fs = require('fs');
let c = fs.readFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'utf8');

c = c.replace(/const prefix = selectedDate\.replace\(\/-\/g, '\.'\) \+ '-';[^\n]*\n\s*return versions\.filter\(v => v\.versionName\.startsWith\(prefix\)\)/, 
  "const prefix = selectedDate.replace(/-/g, '.');\n      return versions.filter(v => v.versionName === prefix || v.versionName.startsWith(prefix + '-'))");

c = c.replace(/const maxSuffix = availableVersions\.length > 0[\s\S]*?:\s*0;/, 
  "const maxSuffix = availableVersions.length > 0\n    ? Math.max(...availableVersions.map(v => {\n        if (v.versionName === selectedDate.replace(/-/g, '.')) return -1;\n        const parts = v.versionName.split('-');\n        return parts.length > 1 ? parseInt(parts[1], 10) : -1;\n      }))\n    : -2;");

c = c.replace(/등록될 버전명: \{selectedDate\.replace\(\/-\/g, '\.'\)\}-\{maxSuffix \+ 1\}/, 
  "등록될 버전명: {selectedDate.replace(/-/g, '.')}{maxSuffix >= -1 ? `-${maxSuffix + 1}` : ''}");

c = c.replace(/const targetVersionName = maxSuffix >= 0 \? `\$\{prefix\}-\$\{maxSuffix \+ 1\}` : prefix;/, 
  "const targetVersionName = maxSuffix >= -1 ? `${prefix}-${maxSuffix + 1}` : prefix;");

c = c.replace(/setEditVersionMode\(availableVersions\[0\]\.versionName\.split\('-'\)\[1\] \|\| \"1\"\);/, 
  "const vName = availableVersions[0].versionName;\n      setEditVersionMode(vName.includes('-') ? vName.split('-')[1] : '');");

c = c.replace(/\{availableVersions\.map\(v => \{\s*const suf = v\.versionName\.split\('-'\)\[1\] \|\| \"1\";[^\n]*\n\s*return <option key=\{suf\} value=\{suf\}>\{v\.versionName\}<\/option>;\s*\}\)\}/, 
  "{availableVersions.map(v => {\n                            const suf = v.versionName.includes('-') ? v.versionName.split('-')[1] : '';\n                            return <option key={suf || 'default'} value={suf}>{v.versionName}</option>;\n                          })}");

fs.writeFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', c, 'utf8');
