const fs = require('fs');
const file = 'src/features/developer/DeveloperVersionRegistrationSection.jsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/setLoadingBase\(false\); \/\/ 로딩 상태 해제\n    \}\n  \};\n/g, "setLoadingBase(false); // 로딩 상태 해제\n    }\n  }, [availableVersions, modeType, editVersionMode, selectedDate, versions]);\n");
fs.writeFileSync(file, content);
