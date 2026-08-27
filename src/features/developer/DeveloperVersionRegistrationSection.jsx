import { useState, useRef, useEffect, useMemo, useCallback } from "react"; 
import { ChevronDownIcon } from "../../components/ui/Icons"; 
import { AlertModal } from "../../components/ui/AlertModal"; 
import { VersionDropdown } from "../../components/ui/VersionDropdown";
import { createMainVersion, deleteSubVersion, getMainVersionDetail, upsertSubVersion, updateMainVersion } from "../../services/api";

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const DeveloperVersionRegistrationSection = ({
  versions,
  setVersions,
  setSelectedVersionName,
  hasMore,
  loadingVersions,
  loadingMoreVersions,
  loadMoreVersions,
  setHasUnsavedChanges,
}) => {
  const dateInputRef = useRef(null); 

  const [selectedDate, setSelectedDate] = useState(getTodayDateString()); 
  
  const [modeType, setModeType] = useState("new"); 
  
  const [editVersionMode, setEditVersionMode] = useState(""); 

  const [rows, setRows] = useState([]);
  const [sqlScript, setSqlScript] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  const [originalSqlScript, setOriginalSqlScript] = useState("");
  const [originalReleaseNote, setOriginalReleaseNote] = useState("");
  
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("warning"); 

  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loadingBase, setLoadingBase] = useState(false);
  const [baseStatus, setBaseStatus] = useState(""); 
  const [loadError, setLoadError] = useState(""); 

  const availableVersions = useMemo(() => {
    if (!selectedDate) return []; 
    const prefix = selectedDate.replace(/-/g, '.');
    
    return versions
      .filter(v => v.versionName.startsWith(prefix + '.'))
      .sort((a, b) => {
        const partsA = a.versionName.split('.');
        const partsB = b.versionName.split('.');
        const aSuf = partsA.length > 3 ? parseInt(partsA[3], 10) : 1;
        const bSuf = partsB.length > 3 ? parseInt(partsB[3], 10) : 1;
        return bSuf - aSuf;
      });
  }, [selectedDate, versions]); 

  const maxSuffix = availableVersions.length > 0
    ? Math.max(...availableVersions.map(v => {
      const parts = v.versionName.split('.');
      return parts.length > 3 ? parseInt(parts[3], 10) : 0;
    }))
    : 0; 

  const initializedVersionRef = useRef(false);

  useEffect(() => {
    if (setHasUnsavedChanges) {
      const isRowsDirty = rows.some(row => row.dirty);
      const isDocsDirty = sqlScript !== originalSqlScript || releaseNote !== originalReleaseNote;
      setHasUnsavedChanges(isRowsDirty || isDocsDirty);
    }
  }, [rows, sqlScript, releaseNote, originalSqlScript, originalReleaseNote, setHasUnsavedChanges]);

  useEffect(() => {
    if (initializedVersionRef.current || versions.length === 0) return;

    const latestVersionName = versions[0].versionName;
    const parts = latestVersionName.split('.');
    const datePart = parts.slice(0, 3).join('-');
    const suffix = parts.length > 3 ? parts[3] : "";
    setSelectedDate(datePart);
    setEditVersionMode(suffix);
    setModeType("edit");
    initializedVersionRef.current = true;
  }, [versions]);

  const selectedExistingVersionName = modeType === "edit"
    ? `${selectedDate.replace(/-/g, '.')}${editVersionMode ? `.${editVersionMode}` : ''}`
    : "";

  const handleSelectExistingVersion = (versionName) => {
    const parts = versionName.split('.');
    const datePart = parts.slice(0, 3).join('-');
    const suffix = parts.length > 3 ? parts[3] : "";
    setSelectedDate(datePart);
    setEditVersionMode(suffix);
    setModeType("edit");
    setSubmitError("");
    setLoadError("");
  };

  const handleStartNewVersion = () => {
    setModeType("new");
    setSelectedDate(getTodayDateString());
    setEditVersionMode("");
    setRows([]);
    setSqlScript("");
    setReleaseNote(""); 
    setOriginalSqlScript("");
    setOriginalReleaseNote("");
    setSubmitError("");
    setLoadError("");
    setBaseStatus("");
  };

  const buildRowsFromDetail = (detailData, forcePending, clearNotes) => {
    if (!detailData || !detailData.subVersions || !detailData.subVersions.length) return [];
    
    return detailData.subVersions.map((sub, index) => {
      let pureNote = sub.note || "";
      if (clearNotes) pureNote = ""; 
      
      const existingStatus = sub.submitStatus || "UNCHANGED";
      const statusValue = forcePending
        ? "pending"
        : (existingStatus.toLowerCase() === "updated" ? "updated" : existingStatus.toLowerCase() === "pending" ? "pending" : "unchanged");
        
      const component = sub.components?.length > 0
        ? sub.components.map(c => c.imageTag).join('\n')
        : "";
        
      const originalValues = {
        subVersion: sub.code || "",
        component,
        tag: sub.version || "",
        note: pureNote,
        sortOrder: index,
      };
      
      return {
        id: `row_${sub.id || sub.code || index}`,
        serverId: sub.id ?? null,
        subVersion: sub.code || "",
        component,
        tag: sub.version || "",
        note: pureNote,
        status: statusValue,
        originalStatus: statusValue,
        originalValues,
        desc: sub.code || "Custom Component",
        dirty: false,
      };
    });
  };

  const loadBaseline = useCallback(async () => {
    if (modeType === "edit" || editVersionMode) {
      setLoadingBase(true);
      setBaseStatus("버전 정보 로딩 중...");
      setLoadError("");
      try {
        const prefix = selectedDate.replace(/-/g, '.');
        const targetVersionName = editVersionMode ? `${prefix}.${editVersionMode}` : prefix;

        const detail = await getMainVersionDetail(targetVersionName);

        if (modeType === "new") {
          setRows(buildRowsFromDetail(detail, true, true));
          setSqlScript(""); 
          setReleaseNote("");
          setOriginalSqlScript("");
          setOriginalReleaseNote("");
          setBaseStatus(`이전 버전(${targetVersionName})을 기반으로 새 버전을 작성합니다.`);
        } else {
          setRows(buildRowsFromDetail(detail, false, false));
          const initialSql = detail.mainVersion?.sqlScript || "";
          const initialNote = detail.mainVersion?.releaseNote || "";
          setSqlScript(initialSql);
          setReleaseNote(initialNote);
          setOriginalSqlScript(initialSql);
          setOriginalReleaseNote(initialNote);
          setBaseStatus(`버전 ${targetVersionName} 수정 모드입니다. (오타 및 상태 수정 가능)`);
        }
      } catch (error) {
        setRows([]);
        setSqlScript("");
        setReleaseNote("");
        const message = error.payload?.message || error.message || "데이터를 불러오는 중 오류가 발생했습니다.";
        setLoadError(message);
        setAlertType("warning");
        setAlertMessage(message);
      } finally {
        setLoadingBase(false);
      }
    }
  }, [selectedDate, modeType, editVersionMode]);

  useEffect(() => {
    if (modeType === "edit" && versions.length > 0) loadBaseline();
  }, [modeType, versions.length, loadBaseline]);

  const handleRefreshAppInfo = () => {
    if (rows.some((row) => row.dirty)
      && !window.confirm("저장하지 않은 APP 정보가 있습니다. 서버의 최신 정보로 새로고침하시겠습니까?")) {
      return;
    }
    loadBaseline();
  };

  const [draggedIndex, setDraggedIndex] = useState(null); 
  const trRefs = useRef([]); 

  const handleDragStart = (e, index) => {
    setDraggedIndex(index); 
    e.dataTransfer.effectAllowed = "move"; 
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault(); 
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newRows = [...rows]; 
    const draggedItem = newRows[draggedIndex]; 
    newRows.splice(draggedIndex, 1);
    newRows.splice(targetIndex, 0, draggedItem);

    setRows(newRows.map((row, index) => {
      let tempRow = { ...row };
      const isContentOrOrderChanged = !tempRow.originalValues || 
        tempRow.subVersion !== tempRow.originalValues.subVersion ||
        tempRow.component !== tempRow.originalValues.component ||
        tempRow.tag !== tempRow.originalValues.tag ||
        tempRow.note !== tempRow.originalValues.note ||
        index !== tempRow.originalValues.sortOrder;
        
      if (tempRow.originalStatus === "unchanged") {
        tempRow.status = isContentOrOrderChanged ? "updated" : "unchanged";
      }
      tempRow.dirty = isRowChanged(tempRow, index);
      return tempRow;
    })); 
    setDraggedIndex(null); 
  };

  const enableDrag = (index) => {
    if (trRefs.current[index]) trRefs.current[index].draggable = true; 
  }
  const disableDrag = (index) => {
    if (trRefs.current[index]) trRefs.current[index].draggable = false; 
  }

  const isRowChanged = (row, currentIndex) => {
    if (!row.originalValues) return true;
    
    return row.subVersion !== row.originalValues.subVersion
      || row.component !== row.originalValues.component
      || row.tag !== row.originalValues.tag
      || row.note !== row.originalValues.note
      || row.status !== row.originalStatus
      || currentIndex !== row.originalValues.sortOrder;
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows]; 
    const nextRow = { ...newRows[index], [field]: value };
    
    if (field === "subVersion" && value.trim().toUpperCase() === "EXT") {
      nextRow.component = "";
    }

    if (field !== "status") {
      const isContentChanged = nextRow.subVersion !== nextRow.originalValues?.subVersion
        || nextRow.component !== nextRow.originalValues?.component
        || nextRow.tag !== nextRow.originalValues?.tag
        || nextRow.note !== nextRow.originalValues?.note;
        
      if (nextRow.originalStatus === "unchanged") {
        nextRow.status = isContentChanged ? "updated" : "unchanged";
      }
    }
    
    nextRow.dirty = isRowChanged(nextRow, index);
    
    newRows[index] = nextRow;
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, {
      id: `custom_${Date.now()}`, 
      subVersion: "NEW", 
      component: "", 
      tag: "", 
      note: "", 
      status: "updated", 
      originalStatus: null,
      originalValues: null,
      desc: "Custom Component",
      dirty: true,
    }]);
  };

  const removeRow = async (index) => {
    const row = rows[index];
    if (window.confirm(`[${row.subVersion}] 컴포넌트를 삭제하시겠습니까?\n(서버에 저장된 경우 DB에서도 삭제됩니다.)`)) {
      
      if (row.serverId != null) {
        setSaving(true);
        try {
          await deleteSubVersion(row.serverId);
        } catch (err) {
          setSaving(false);
          const msg = err.payload?.message || err.message || "서브버전 삭제 중 오류가 발생했습니다.";
          alert(msg);
          return;
        }
        setSaving(false);
      }
      const newRows = [...rows];
      newRows.splice(index, 1);
      setRows(newRows);
    }
  };

  const handleRegisterMainVersion = async () => {
    const prefix = selectedDate.replace(/-/g, '.');
    const nextSuffix = String(maxSuffix + 1).padStart(3, '0');
    const targetVersionName = `${prefix}.${nextSuffix}`;
    setSaving(true);
    setSubmitError("");

    try {
      await createMainVersion(targetVersionName, {
        releaseNote: releaseNote || undefined,
        sqlScript: sqlScript || undefined,
      });

      setOriginalSqlScript(sqlScript);
      setOriginalReleaseNote(releaseNote);

      const newSummary = {
        versionName: targetVersionName,
        subVersionCount: 0,
        componentCount: 0,
        lastJob: null,
      };
      setVersions([newSummary, ...versions]);
      setSelectedVersionName(targetVersionName);

      setModeType("edit");
      setEditVersionMode(nextSuffix);

      setAlertType("success"); setAlertMessage(`신규 메인버전(${targetVersionName})이 등록되었습니다. 아래에서 매니페스트 상세 정보를 작성 후 각각 저장해주세요.`);
    } catch (error) {
      if (error.status !== 409) {
        const message = error.payload?.message || error.message || "메인버전 등록 중 오류가 발생했습니다.";
        setSubmitError(message);
        setAlertType("warning"); setAlertMessage(message);
      } else {
        setModeType("edit");
        setEditVersionMode(nextSuffix);
        setAlertType("warning"); setAlertMessage("이미 등록된 버전입니다. 수정 모드로 전환되었습니다.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRow = async (index) => {
    const row = rows[index];
    if (!row.tag) {
      setAlertType("warning"); setAlertMessage("버전(VERSION) 태그를 입력해야 저장할 수 있습니다.");
      return;
    }

    const prefix = selectedDate.replace(/-/g, '.');
    const targetVersionName = (editVersionMode ? `${prefix}.${editVersionMode}` : prefix);
    const desiredStatus = (row.status === "updated") ? "UPDATED" : (row.status === "pending") ? "PENDING" : "UNCHANGED";

    const isImageTagChanged = !row.originalValues || row.component !== row.originalValues.component;

    if (isImageTagChanged && desiredStatus === "UNCHANGED") {
      setAlertType("warning");
      setAlertMessage("IMAGE TAG가 변경되었습니다. STATUS를 UPDATED 또는 PENDING으로 선택해주세요.");
      return;
    }

    if (!isImageTagChanged && desiredStatus === "UPDATED" && row.subVersion.trim().toUpperCase() !== "EXT") {
      setAlertType("warning");
      setAlertMessage("IMAGE TAG가 기존 버전과 동일합니다. 이미지 태그를 변경하거나 상태를 UNCHANGED 또는 PENDING으로 설정해주세요.");
      return;
    }

    const payload = {
      code: row.subVersion,
      version: row.tag,
      sortOrder: index,
      submitStatus: desiredStatus, 
    };

    const finalNote = row.note ? row.note.trim() : "";
    if (finalNote !== "") payload.note = finalNote;

    if (row.subVersion.trim().toUpperCase() === "EXT") {
      payload.imageTags = [];
    } else if (row.component) {
      payload.imageTags = row.component.split('\n').map(t => t.trim()).filter(Boolean);
    }

    setSaving(true);
    setSubmitError("");
    try {
      await upsertSubVersion(targetVersionName, row.subVersion, payload);
      setAlertType("success"); setAlertMessage(`${row.subVersion} 컴포넌트 정보가 저장되었습니다.`);

      const finalDetail = await getMainVersionDetail(targetVersionName);
      setRows(buildRowsFromDetail(finalDetail, false));
    } catch (error) {
      const message = error.payload?.message || error.message || "서브버전 저장 중 오류가 발생했습니다.";
      setSubmitError(message);
      setAlertType("warning"); setAlertMessage(message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMainVersionInfo = async () => {
    const prefix = selectedDate.replace(/-/g, '.');
    const targetVersionName = editVersionMode ? `${prefix}.${editVersionMode}` : prefix;

    setSaving(true);
    setSubmitError("");
    try {
      await updateMainVersion(targetVersionName, {
        releaseNote,
        sqlScript,
      });
      setOriginalSqlScript(sqlScript);
      setOriginalReleaseNote(releaseNote);
      setAlertType("success");
      setAlertMessage(`메인버전 ${targetVersionName}의 배포 문서가 수정되었습니다.`);
    } catch (error) {
      const message = error.payload?.message || error.message || "메인버전 정보 수정 중 오류가 발생했습니다.";
      setSubmitError(message);
      setAlertType("warning");
      setAlertMessage(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllRows = async () => {
    const dirtyRows = rows.map((row, index) => ({ row, index })).filter(item => item.row.dirty);
    
    if (dirtyRows.length === 0) {
      setAlertType("warning"); 
      setAlertMessage("저장할 변경사항이 없습니다.");
      return;
    }

    const invalidRow = dirtyRows.find(item => !item.row.tag);
    if (invalidRow) {
      setAlertType("warning"); 
      setAlertMessage("버전(VERSION) 태그를 입력해야 저장할 수 있습니다. (컴포넌트: " + invalidRow.row.subVersion + ")");
      return;
    }

    const prefix = selectedDate.replace(/-/g, '.');
    const targetVersionName = (editVersionMode ? `${prefix}.${editVersionMode}` : prefix);

    setSaving(true);
    setSubmitError("");
    
    try {
      for (const { row, index } of dirtyRows) {
        const desiredStatus = (row.status === "updated") ? "UPDATED" : (row.status === "pending") ? "PENDING" : "UNCHANGED";
        
        const isImageTagChanged = !row.originalValues || row.component !== row.originalValues.component;

        if (isImageTagChanged && desiredStatus === "UNCHANGED") {
          throw new Error(`[${row.subVersion}] IMAGE TAG가 변경되었습니다. STATUS를 UPDATED 또는 PENDING으로 선택해주세요.`);
        }

        if (!isImageTagChanged && desiredStatus === "UPDATED" && row.subVersion.trim().toUpperCase() !== "EXT") {
          throw new Error(`[${row.subVersion}] IMAGE TAG가 기존 버전과 동일합니다. 이미지 태그를 변경하거나 상태를 UNCHANGED 또는 PENDING으로 설정해주세요.`);
        }

        const payload = {
          code: row.subVersion,
          version: row.tag,
          sortOrder: index,
          submitStatus: desiredStatus, 
        };

        const finalNote = row.note ? row.note.trim() : "";
        if (finalNote !== "") payload.note = finalNote;

        if (row.subVersion.trim().toUpperCase() === "EXT") {
          payload.imageTags = [];
        } else if (row.component) {
          payload.imageTags = row.component.split('\n').map(t => t.trim()).filter(Boolean);
        }

        await upsertSubVersion(targetVersionName, row.subVersion, payload);
      }
      
      setAlertType("success"); 
      setAlertMessage("모든 변경사항이 일괄 저장되었습니다.");

      const finalDetail = await getMainVersionDetail(targetVersionName);
      setRows(buildRowsFromDetail(finalDetail, false));
    } catch (error) {
      const message = error.payload?.message || error.message || "서브버전 일괄 저장 중 오류가 발생했습니다.";
      setSubmitError(message);
      setAlertType("warning"); setAlertMessage(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto p-8 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#000666]">
            개발자 모드
          </h1>
        </div>
        <p className="text-slate-500 text-base font-medium">
          새 메인버전을 만들거나 기존 버전의 배포 문서와 APP 정보를 관리합니다.
        </p>
      </header>

      <div className="flex flex-col gap-8">
        <section className="bg-white rounded-xl border border-slate-300 shadow-md p-6 flex flex-col gap-6">
          <div className="border-b pb-4 border-slate-100">
            <h2 className="text-2xl font-bold text-slate-800">
              {modeType === "new" ? "새 메인버전 만들기" : "메인버전 관리"}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
            <div className="flex flex-col gap-2">
              <label htmlFor="existing-main-version" className="text-base font-bold text-slate-500 uppercase tracking-wider">
                관리할 메인버전
              </label>
              <VersionDropdown
                id="existing-main-version"
                value={modeType === "edit" ? selectedExistingVersionName : ""}
                options={versions}
                onChange={handleSelectExistingVersion}
                placeholder="기존 메인버전을 선택하세요"
                hasMore={hasMore}
                loading={loadingVersions || loadingMoreVersions}
                onLoadMore={loadMoreVersions}
                buttonClassName="bg-slate-50 py-3.5 pl-4 pr-4 text-lg border-slate-200"
              />
            </div>
            <button
              type="button"
              onClick={handleStartNewVersion}
              className="py-3.5 px-6 text-base font-bold text-[#000666] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all whitespace-nowrap"
            >
              + 새 메인버전 만들기
            </button>
          </div>

          {modeType === "new" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="main-version-date" className="text-base font-bold text-slate-500 uppercase tracking-wider">
                  메인 버전 날짜 <span className="text-red-500">*</span>
                </label>
                <input
                  id="main-version-date"
                  type="date"
                  ref={dateInputRef}
                  required
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-3.5 px-4 text-lg font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-base font-bold text-slate-500 uppercase tracking-wider">생성될 버전명</span>
                <div className="rounded-lg border border-indigo-200 bg-white py-3.5 px-4 text-lg font-bold text-indigo-700 text-center">
                  {selectedDate.replace(/-/g, '.')}.{String(maxSuffix + 1).padStart(3, '0')}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4">
              <span className="text-sm font-bold text-indigo-500">현재 편집 중</span>
              <strong className="text-xl text-[#000666]">{selectedExistingVersionName}</strong>
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-slate-100 pt-6">
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                {modeType === "new" ? "초기 배포 문서" : "배포 문서 (SQL / Release Note)"}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-base font-bold text-slate-500 uppercase tracking-wider">SQL Script</label>
                <textarea
                  value={sqlScript}
                  onChange={(e) => setSqlScript(e.target.value)}
                  placeholder="이번 배포에 적용할 DB SQL 스크립트를 입력하세요."
                  rows={6}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3.5 px-4 text-base font-mono text-slate-800 focus:ring-2 focus:ring-[#1a237e] outline-none transition-all resize-y"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-base font-bold text-slate-500 uppercase tracking-wider">Release Note</label>
                <textarea
                  value={releaseNote}
                  onChange={(e) => setReleaseNote(e.target.value)}
                  placeholder="고객사 전달용 릴리즈 노트를 입력하세요."
                  rows={6}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3.5 px-4 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] outline-none transition-all resize-y"
                />
              </div>
            </div>
          </div>

          {modeType === "new" && (
            <div className="flex justify-end pt-2 border-t border-slate-100 gap-3">
              <button
                type="button"
                onClick={handleRegisterMainVersion} 
                disabled={saving}
                className={`py-2.5 px-8 text-base font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-all shadow-sm active:scale-95 ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {saving ? "처리 중..." : "메인버전 생성"}
              </button>
            </div>
          )}
          {modeType !== "new" && (
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleUpdateMainVersionInfo}
                disabled={saving || loadingBase}
                className={`py-2.5 px-8 text-base font-bold text-white bg-[#000666] hover:bg-[#090d82] rounded-lg transition-all shadow-sm active:scale-95 ${saving || loadingBase ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {saving ? "저장 중..." : "배포 문서 저장"}
              </button>
            </div>
          )}
        </section>

        {modeType !== "new" && (
          <section className="bg-white rounded-xl border border-slate-300 shadow-md flex flex-col overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b border-slate-100">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">APP별 정보</h2>
              </div>
              <button
                type="button"
                onClick={handleRefreshAppInfo}
                disabled={saving || loadingBase}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
              >
                {loadingBase ? "불러오는 중..." : "새로고침"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1160px] table-fixed text-left border-collapse">
                <colgroup>
                  <col className="w-[180px]" />
                  <col className="w-[140px]" />
                  <col className="w-[28%]" />
                  <col />
                  <col className="w-[155px]" />
                  <col className="w-[140px]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">APP <span className="text-red-500">*</span></th>
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">VERSION <span className="text-red-500">*</span></th>
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">IMAGE TAG</th>
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">NOTE</th>
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">STATUS</th>
                    <th className="sticky right-0 z-10 bg-slate-50 px-4 py-3.5 text-right text-sm font-bold text-slate-500 shadow-[-1px_0_0_#e2e8f0]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => (
                    <tr
                      key={row.id} 
                      className="hover:bg-slate-50/50 transition-colors group"
                      ref={el => trRefs.current[index] = el} 
                      onDragStart={(e) => handleDragStart(e, index)} 
                      onDragOver={(e) => handleDragOver(e, index)} 
                      onDrop={(e) => handleDrop(e, index)} 
                    >
                      <td className="px-4 py-3 border-b border-slate-100 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <div
                            className="cursor-grab text-slate-400 hover:text-slate-600 p-1 select-none flex items-center justify-center"
                            onMouseDown={() => enableDrag(index)} 
                            onMouseUp={() => disableDrag(index)} 
                            onMouseLeave={() => disableDrag(index)} 
                            title="드래그하여 순서 변경"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>
                          <div className="relative flex-1">
                            <input
                              type="text"
                              required
                              value={row.subVersion}
                              onChange={(e) => handleRowChange(index, "subVersion", e.target.value)}
                              className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-3.5 pr-12 text-sm font-bold text-[#1a237e] focus:ring-2 focus:ring-[#1a237e] outline-none uppercase"
                            />
                            <button
                              type="button"
                              onClick={() => removeRow(index)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-red-500 font-bold"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100">
                        <input
                          type="text"
                          required
                          value={row.tag}
                          onChange={(e) => handleRowChange(index, "tag", e.target.value)}
                          placeholder="예: v1.0.0"
                          className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-bold text-slate-800 focus:ring-2 focus:ring-[#1a237e] outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100">
                        <textarea
                          disabled={row.subVersion.trim().toUpperCase() === "EXT"}
                          value={row.component} 
                          onChange={(e) => handleRowChange(index, "component", e.target.value)}
                          placeholder={row.subVersion.trim().toUpperCase() === "EXT" ? "IMAGE TAG 없음" : "예: myapp-api:v2.0.27"}
                          rows={2} 
                          className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] outline-none font-mono resize-y min-h-[42px] disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100">
                        <textarea
                          value={row.note} 
                          onChange={(e) => handleRowChange(index, "note", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
                          }}
                          placeholder="변경 사항 기록 (Shift+Enter 줄바꿈)"
                          rows={2} 
                          className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] outline-none resize-y min-h-[42px]"
                        />
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100">
                        <div className="relative w-full">
                          <select
                            value={row.status} 
                            onChange={(e) => handleRowChange(index, "status", e.target.value)}
                            className={`w-full appearance-none rounded-md border border-slate-200 py-2.5 pl-3.5 pr-8 text-sm font-bold outline-none ${
                              row.status === "updated" ? "bg-[#0006661a] text-[#000666]" : 
                              row.status === "pending" ? "bg-[#ffdbd0] text-[#7b2e12]" : 
                              "bg-slate-100 text-slate-500" 
                            }`}
                          >
                            <option value="updated" className="bg-white text-[#000666] font-bold">UPDATED</option>
                            <option value="pending" className="bg-white text-[#7b2e12] font-bold">PENDING</option>
                            <option value="unchanged" disabled={row.dirty} className="bg-white text-slate-500 font-bold">UNCHANGED</option>
                          </select>
                          <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </td>
                      <td className="sticky right-0 z-10 border-b border-slate-100 bg-white px-4 py-3 text-right shadow-[-1px_0_0_#e2e8f0] group-hover:bg-slate-50">
                        <button
                          type="button"
                          onClick={() => handleSaveRow(index)} 
                          disabled={saving}
                          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all shadow-sm active:scale-95 whitespace-nowrap ${
                            row.dirty 
                              ? "bg-[#000666] text-white hover:bg-[#090d82]" 
                              : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                          } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {saving ? "저장중" : (row.dirty ? "저장" : "저장 완료")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-slate-50/50 flex justify-center gap-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={addRow}
                  className="py-2.5 px-6 flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all"
                >
                  <span>+</span> 빈 컴포넌트 행 추가
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllRows}
                  disabled={saving}
                  className={`py-2.5 px-6 flex items-center gap-2 text-sm font-bold text-white bg-[#000666] hover:bg-[#090d82] border border-transparent rounded-lg transition-all ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  일괄저장
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      <AlertModal 
        isOpen={!!alertMessage} 
        message={alertMessage} 
        type={alertType}
        onClose={() => setAlertMessage("")} 
      />
    </div>
  );
};
