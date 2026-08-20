const fs = require('fs');
const path = 'src/features/developer/DeveloperVersionRegistrationSection.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Rewrite buildRowsFromDetail
let startIdx = content.indexOf('const buildRowsFromDetail = (detailData, forcePending, clearNotes) => {');
let endIdx = content.indexOf('return [...newRows, ...extraRows];', startIdx);
if (startIdx !== -1 && endIdx !== -1) {
  let endBlock = content.indexOf('};', endIdx) + 2;
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
  content = content.substring(0, startIdx) + new_build + content.substring(endBlock);
  console.log('buildRowsFromDetail replaced');
}

// 2. Rewrite removeRow
startIdx = content.indexOf('const removeRow = async (index) => {');
let tryBlock = content.indexOf('setSaving(true);', startIdx);
if (startIdx !== -1 && tryBlock !== -1) {
  let innerBody = content.substring(tryBlock, content.indexOf('catch (err) {', tryBlock) + 14) + `
              setSaving(false);
              const msg = err.payload?.message || err.message || "서브버전 삭제 중 오류가 발생했습니다.";
              alert(msg);
              return;
            }
            setSaving(false);
            const newRows = [...rows];
            newRows.splice(index, 1);
            setRows(newRows);
          }
        }
      }
    };`;
  
  let endBlock = content.indexOf('};', tryBlock) + 2;
  // wait, the innerBody replacement is tricky. Let's just find the end of the removeRow function.
  // The removeRow function ends before `// ==========================================`
  let functionEnd = content.indexOf('// ==========================================', startIdx);
  if(functionEnd === -1) functionEnd = content.indexOf('const handleSubmit = async (e) => {', startIdx);
  // Just find the matching closing brace.
}

// Actually let's just use replace with regex without whitespace constraints.
const old_remove = /const removeRow = async \(index\) => \{.*?const isDefault = defaultRows.*?if \(isDefault\) \{.*?\}.*?else \{.*?if \(window\.confirm\(\`\[\$\\\{row\.subVersion\}\] 커스텀 행을 삭제하시겠습니까\?\\n\(서버에 저장된 행인 경우 DB에서도 즉시 삭제됩니다\.\)\`\)\) \{(.*?)\}\n      \}\n    \};/s;
if(old_remove.test(content)) {
  content = content.replace(old_remove, (match, p1) => {
    return `const removeRow = async (index) => {
      const row = rows[index];
      if (window.confirm(\`[\${row.subVersion}] 컴포넌트를 삭제하시겠습니까?\\n(서버에 저장된 경우 DB에서도 삭제됩니다.)\`)) {${p1}}
    };`;
  });
  console.log('removeRow replaced');
} else {
  // Manual string slicing for removeRow
  let removeStart = content.indexOf('const removeRow = async (index) => {');
  let removeEnd = content.indexOf('const handleSubmit = async (e) => {', removeStart);
  if(removeStart !== -1 && removeEnd !== -1) {
     let originalBody = content.substring(removeStart, removeEnd);
     let setSavingStart = originalBody.indexOf('if (row.id && row.id.startsWith("row_extra_"))');
     if(setSavingStart !== -1) {
        let replacement = `const removeRow = async (index) => {
    const row = rows[index];
    if (window.confirm(\`[\${row.subVersion}] 컴포넌트를 삭제하시겠습니까?\\n(서버에 저장된 경우 DB에서도 삭제됩니다.)\`)) {
      ` + originalBody.substring(setSavingStart);
        // remove the extra closing braces from the `else {` block
        replacement = replacement.replace(/}\n\s*}\n\s*}\n\s*};\n\s*$/, '}\n    }\n  };\n  ');
        content = content.substring(0, removeStart) + replacement + content.substring(removeEnd);
        console.log('removeRow manual replaced');
     }
  }
}

fs.writeFileSync(path, content, 'utf8');
