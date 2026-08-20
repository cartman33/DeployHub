import re

with open('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

broken = """      setBaseStatus("");
    } finally {
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps"""
fixed = """      setBaseStatus("");
    } finally {
      setLoadingBase(false);
    }
  }, [availableVersions, modeType, editVersionMode, selectedDate, versions]);

  useEffect(() => {
    if (availableVersions.length > 0 && modeType === "new") return; // Skip intermediate state
    if (modeType === "new" || editVersionMode) {
      loadBaseline(); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps"""

content = content.replace(broken, fixed)

with open('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
