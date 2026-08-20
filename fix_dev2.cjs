const fs = require('fs');
let c = fs.readFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'utf8');

// 1. Fix prefix filtering
const oldPrefix = `const prefix = selectedDate.replace(/-/g, '.') + '-'; // 'YYYY-MM-DD' 형식을 'YYYY.MM.DD-' 형식으로 변환
      return versions.filter(v => v.versionName.startsWith(prefix)); // 이미 서버에서 내림차순 정렬되어 옴`;

const newPrefix = `const prefix = selectedDate.replace(/-/g, '.'); // 'YYYY-MM-DD' 형식을 'YYYY.MM.DD' 형식으로 변환
      return versions.filter(v => v.versionName === prefix || v.versionName.startsWith(prefix + '-')); // 이미 서버에서 내림차순 정렬되어 옴`;

c = c.replace(oldPrefix, newPrefix);

// 2. Fix maxSuffix calculation
const oldMaxSuffix = `const maxSuffix = availableVersions.length > 0 
    ? parseInt(availableVersions[0].versionName.split('-')[1] || "1", 10) 
    : 0;`;

const newMaxSuffix = `const maxSuffix = availableVersions.length > 0
    ? Math.max(...availableVersions.map(v => {
        if (v.versionName === selectedDate.replace(/-/g, '.')) return 0;
        const parts = v.versionName.split('-');
        return parts.length > 1 ? parseInt(parts[1], 10) : 0;
      }))
    : -1;`;

c = c.replace(oldMaxSuffix, newMaxSuffix);

// 3. Fix targetVersionName rendering
const oldRenderTarget = `등록될 버전명: {selectedDate.replace(/-/g, '.')}-{maxSuffix + 1}`;
const newRenderTarget = `등록될 버전명: {selectedDate.replace(/-/g, '.')}{maxSuffix >= 0 ? \`-\${maxSuffix + 1}\` : ''}`;
c = c.replace(oldRenderTarget, newRenderTarget);

// 4. Fix handleRegisterMainVersion target name
const oldTargetVar = `const targetVersionName = \`\${prefix}-\${maxSuffix + 1}\`;`;
const newTargetVar = `const targetVersionName = maxSuffix >= 0 ? \`\${prefix}-\${maxSuffix + 1}\` : prefix;`;
c = c.replace(oldTargetVar, newTargetVar);

// 5. Fix editVersionMode initialization
const oldEditVersion = `setEditVersionMode(availableVersions[0].versionName.split('-')[1] || "1");`;
const newEditVersion = `const vName = availableVersions[0].versionName;
      setEditVersionMode(vName.includes('-') ? vName.split('-')[1] : "");`;
c = c.replace(oldEditVersion, newEditVersion);

// 6. Fix <option> rendering in edit mode
const oldOptionMapping = `{availableVersions.map(v => {
                            const suf = v.versionName.split('-')[1] || "1"; // 접미사 추출
                            return <option key={suf} value={suf}>{v.versionName}</option>;
                          })}`;
const newOptionMapping = `{availableVersions.map(v => {
                            const suf = v.versionName.includes('-') ? v.versionName.split('-')[1] : "";
                            return <option key={suf || 'default'} value={suf}>{v.versionName}</option>;
                          })}`;
c = c.replace(oldOptionMapping, newOptionMapping);

// 7. Fix editVersionMode fallback if empty
const oldEditFallback = `if (e.target.value === "edit" && !editVersionMode && availableVersions.length > 0) {
                          setEditVersionMode(maxSuffix.toString());
                        }`;
const newEditFallback = `if (e.target.value === "edit" && editVersionMode === null && availableVersions.length > 0) {
                          const vName = availableVersions[0].versionName;
                          setEditVersionMode(vName.includes('-') ? vName.split('-')[1] : "");
                        }`;
c = c.replace(oldEditFallback, newEditFallback);

fs.writeFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', c, 'utf8');
