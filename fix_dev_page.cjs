const fs = require('fs');
let content = fs.readFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'utf8');

const correctLoadBaseline = `const loadBaseline = useCallback(async () => {
    if (modeType === "edit" || editVersionMode) {
      setLoadingBase(true);
      setBaseStatus("버전 정보 로딩 중...");
      setLoadError("");
      try {
        const prefix = selectedDate.replace(/-/g, '.');
        const targetVersionName = modeType === "new" 
          ? \`\${prefix}-\${editVersionMode}\` 
          : \`\${prefix}-\${editVersionMode}\`; 

        const detail = await getMainVersionDetail(targetVersionName);
        
        if (modeType === "new") {
          setRows(buildRowsFromDetail(detail, true, true));
          setSqlScript(""); 
          setReleaseNote(""); 
          setBaseStatus(\`이전 버전(\${targetVersionName})을 기반으로 새 버전을 작성합니다.\`);
        } else {
          setRows(buildRowsFromDetail(detail, false, false));
          setSqlScript(detail.mainVersion?.sqlScript || ""); 
          setReleaseNote(detail.mainVersion?.releaseNote || ""); 
          setBaseStatus(\`버전 \${targetVersionName} 수정 모드입니다. (오타 및 상태 수정 가능)\`);
        }
      } catch (error) {
        setRows([]);
        setSqlScript("");
        setReleaseNote("");
        setLoadError(error.payload?.message || error.message || "데이터를 불러오는 중 오류가 발생했습니다.");
        setBaseStatus("");
      } finally {
        setLoadingBase(false);
      }
    }
  }, [selectedDate, modeType, editVersionMode]);

  useEffect(() => {
    // skip intermediate state
    if (versions.length === 0) return;
    if (modeType === "new" && availableVersions.length > 0) return;
    if (modeType === "new" || editVersionMode) {
      loadBaseline(); 
    }
  }, [modeType, editVersionMode, availableVersions.length, versions.length, loadBaseline]);`;

content = content.replace(/const loadBaseline = useCallback\([\s\S]*?\}, \[selectedDate, modeType, editVersionMode, versions\]\);/g, correctLoadBaseline);

fs.writeFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', content, 'utf8');
