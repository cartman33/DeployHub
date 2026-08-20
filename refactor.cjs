const fs = require('fs');
const path = 'src/features/developer/DeveloperVersionRegistrationSection.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove defaultRows
content = content.replace(/\/\/\s*테이블에 기본적으로 표시할.*?\];/s, '');

// 2. Fix useState
content = content.replace(/useState\(\[\.\.\.defaultRows\]\)/g, 'useState([])');

// 3. Fix loadBaseline catch blocks and else block
content = content.replace(/setRows\(\[\.\.\.defaultRows\]\);/g, 'setRows([]);');

// 4. Rewrite buildRowsFromDetail
const old_build = /const buildRowsFromDetail = \(detailData, forcePending, clearNotes\) => \{.*?return \[\.\.\.newRows, \.\.\.extraRows\];\n  \};/s;
const new_build = `const buildRowsFromDetail = (detailData, forcePending, clearNotes) => {
    if (!detailData || !detailData.subVersions || !detailData.subVersions.length) return [];
    return detailData.subVersions.map((sub, index) => {
      let pureNote = sub.note || "";
      if (clearNotes) pureNote = "";
      const existingStatus = sub.submitStatus || "UNCHANGED";
      const statusValue = forcePending 
        ? "pending" 
        : (existingStatus.toLowerCase() === "updated" ? "update" : existingStatus.toLowerCase() === "pending" ? "pending" : "unchanged");
      return {
        id: \`row_\${sub.code || index}_\${Date.now()}\`,
        subVersion: sub.code || "",
        component: sub.components?.length > 0 ? sub.components.map(c => c.imageTag).join('\\n') : sub.code,
        tag: sub.version || "",
        note: pureNote,
        status: statusValue,
        desc: sub.code || "Custom Component"
      };
    });
  };`;
content = content.replace(old_build, new_build);

// 5. Rewrite removeRow
const old_remove = /const removeRow = async \(index\) => \{.*?const isDefault = defaultRows.*?if \(isDefault\) \{.*?\}.*?else \{.*?if \(window\.confirm\(\`\[\$\\\{row\.subVersion\}\] 커스텀 행을 삭제하시겠습니까\?\\n\(서버에 저장된 행인 경우 DB에서도 즉시 삭제됩니다\.\)\`\)\) \{(.*?)\}\n      \}\n    \};/s;
content = content.replace(old_remove, (match, p1) => {
  return `const removeRow = async (index) => {
      const row = rows[index];
      if (window.confirm(\`[\${row.subVersion}] 컴포넌트를 삭제하시겠습니까?\\n(서버에 저장된 경우 DB에서도 삭제됩니다.)\`)) {${p1}}
    };`;
});

// 6. Fix first useEffect (availableVersions)
content = content.replace(/\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\n\s*\/\/ 주의: availableVersions 배열 전체를.*?\n\s*\}, \[selectedDate, availableVersions\.length\]\);/s, '  }, [selectedDate, availableVersions]);');

// 7. Fix loadBaseline useCallback and second useEffect
content = content.replace(/const loadBaseline = async \(\) => \{/, 'const loadBaseline = useCallback(async () => {');
content = content.replace(/setLoadingBase\(false\); \/\/ 로딩 상태 해제\n    \}\n  \};/, 'setLoadingBase(false); // 로딩 상태 해제\n    }\n  }, [selectedDate, modeType, availableVersions, versions, editVersionMode]);');

content = content.replace(/\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\n\s*\/\/ 주의: versions나 loadBaseline 자체를.*?\n\s*\}, \[selectedDate, modeType, editVersionMode, versions\]\);/s, '  }, [modeType, editVersionMode, loadBaseline]);');

fs.writeFileSync(path, content, 'utf8');
console.log("Done!");
