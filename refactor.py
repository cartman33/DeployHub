import re

path = 'src/features/developer/DeveloperVersionRegistrationSection.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove defaultRows
content = re.sub(r'// 테이블에 기본적으로 표시할.*?\];', '', content, flags=re.DOTALL)

# 2. Fix useState([...defaultRows]) -> useState([])
content = content.replace('useState([...defaultRows])', 'useState([])')

# 3. Fix loadBaseline catch blocks and else block
content = content.replace('setRows([...defaultRows]);', 'setRows([]);')

# 4. Rewrite buildRowsFromDetail
old_build = r'const buildRowsFromDetail = \(detailData, forcePending, clearNotes\) => \{.*?return \[\.\.\.newRows, \.\.\.extraRows\];\n  \};'
new_build = '''const buildRowsFromDetail = (detailData, forcePending, clearNotes) => {
    if (!detailData || !detailData.subVersions || detailData.subVersions.length === 0) return [];
    return detailData.subVersions.map((sub, index) => {
      let pureNote = sub.note || "";
      if (clearNotes) pureNote = "";
      const existingStatus = sub.submitStatus || "UNCHANGED";
      const statusValue = forcePending 
        ? "pending" 
        : (existingStatus.toLowerCase() === "updated" ? "update" : existingStatus.toLowerCase() === "pending" ? "pending" : "unchanged");
      return {
        id: ow__,
        subVersion: sub.code || "",
        component: sub.components?.length > 0 ? sub.components.map(c => c.imageTag).join('\\n') : sub.code,
        tag: sub.version || "",
        note: pureNote,
        status: statusValue,
        desc: sub.code || "Custom Component"
      };
    });
  };'''
content = re.sub(old_build, new_build, content, flags=re.DOTALL)

# 5. Rewrite removeRow
old_remove = r'const removeRow = async \(index\) => \{.*?const isDefault = defaultRows.*?if \(isDefault\) \{.*?\}.*?else \{.*?if \(window.confirm\(\[\$\{row.subVersion\}\] 커스텀 행을 삭제하시겠습니까\?\\n\(서버에 저장된 행인 경우 DB에서도 즉시 삭제됩니다\.\)\)\) \{(.*?)\}\n      \}\n    \};'
new_remove = '''const removeRow = async (index) => {
      const row = rows[index];
      if (window.confirm([] 컴포넌트를 삭제하시겠습니까?\\n(서버에 저장된 경우 DB에서도 삭제됩니다.))) {\\1}
    };'''
content = re.sub(old_remove, new_remove, content, flags=re.DOTALL)

# 6. Fix first useEffect (availableVersions)
content = re.sub(r'// eslint-disable-next-line react-hooks/exhaustive-deps\n\s*// 주의: availableVersions 배열 전체를.*?\n\s*\}, \[selectedDate, availableVersions.length\]\);', '  }, [selectedDate, availableVersions]);', content, flags=re.DOTALL)

# 7. Fix loadBaseline useCallback and second useEffect
content = re.sub(r'const loadBaseline = async \(\) => \{', 'const loadBaseline = useCallback(async () => {', content)
content = re.sub(r'setLoadingBase\(false\); // 로딩 상태 해제\n    \}\n  \};', 'setLoadingBase(false); // 로딩 상태 해제\n    }\n  }, [selectedDate, modeType, availableVersions, versions, editVersionMode]);', content)

content = re.sub(r'// eslint-disable-next-line react-hooks/exhaustive-deps\n\s*// 주의: versions나 loadBaseline 자체를.*?\n\s*\}, \[selectedDate, modeType, editVersionMode, versions\]\);', '  }, [modeType, editVersionMode, loadBaseline]);', content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
