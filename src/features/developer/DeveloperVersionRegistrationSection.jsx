import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { 
  CheckCircleIcon, 
  ListIcon,
  CodeIcon,
  RocketIcon,
  ChevronDownIcon
} from "../../components/ui/Icons";
import { createMainVersion, getMainVersionDetail, upsertSubVersions, changeSubmitStatus, updateMainVersion } from "../../services/api";

// ==========================================
// [Utility & Constants] 
// 렌더링 시마다 불필요하게 다시 생성되지 않도록 컴포넌트 외부로 분리
// ==========================================

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const defaultRows = [
  { id: "cc", subVersion: "CC", component: "sb-cc-api:\nsb-cc-fe:", tag: "", note: "", assignee: "", status: "update", desc: "CC Component" },
  { id: "fogger", subVersion: "FOGGER", component: "fogger-sb:", tag: "", note: "", assignee: "", status: "unchanged", desc: "Fogger Service" },
  { id: "swg", subVersion: "SWG", component: "swg-sb:", tag: "", note: "", assignee: "", status: "unchanged", desc: "SWG Proxy" },
  { id: "stdapi", subVersion: "STDAPI", component: "sb-std-api:", tag: "", note: "", assignee: "", status: "unchanged", desc: "Standard API" },
  { id: "piids", subVersion: "PIIDS", component: "piids-sb:", tag: "", note: "", assignee: "", status: "unchanged", desc: "PIIDS Detector" },
  { id: "pips", subVersion: "PIPS", component: "pips-sb:", tag: "", note: "", assignee: "", status: "unchanged", desc: "PIPS Engine" },
  { id: "cids", subVersion: "CIDS", component: "cids:", tag: "", note: "", assignee: "", status: "unchanged", desc: "CIDS Model" },
  { id: "ext", subVersion: "EXT", component: "ext:", tag: "", note: "", assignee: "", status: "unchanged", desc: "Extractor" },
  { id: "ocr", subVersion: "OCR", component: "ocr:", tag: "", note: "", assignee: "", status: "unchanged", desc: "OCR Engine" }
];

// ==========================================
// [Main Component] 개발자 페이지 메인버전 등록/수정 컴포넌트
// ==========================================
export const DeveloperVersionRegistrationSection = ({ 
  versions, 
  setVersions, 
  setSelectedVersionName, 
  setActiveNavigation 
}) => {
  const dateInputRef = useRef(null);

  // ==========================================
  // 1. 상태(State) 선언부
  // ==========================================
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [modeType, setModeType] = useState("new"); // "new" (신규) | "edit" (수정)
  const [editVersionMode, setEditVersionMode] = useState("");
  const [submittedModeType, setSubmittedModeType] = useState("new");
  
  const [rows, setRows] = useState([...defaultRows]); // 테이블에 표시될 서브버전 항목들
  const [sqlScript, setSqlScript] = useState("");
  const [releaseNote, setReleaseNote] = useState("");

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registeredVersionName, setRegisteredVersionName] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loadingBase, setLoadingBase] = useState(false);
  const [baseStatus, setBaseStatus] = useState("");
  const [loadError, setLoadError] = useState("");

  // 유저 정보 가져오기 (전역 윈도우 객체 혹은 로컬 스토리지)
  const getCurrentUser = () => {
    try {
      return window.__DEPLOY_HUB_USER__ || localStorage.getItem("deployHubUser") || "frontend";
    } catch {
      return "frontend";
    }
  };

  // ==========================================
  // 2. 파생 상태 및 데이터 가공 (Computed Data)
  // ==========================================
  // 현재 선택된 날짜에 해당하는 버전들 필터링
  const availableVersions = useMemo(() => {
    if (!selectedDate) return [];
    const prefix = selectedDate.replace(/-/g, '.') + '-';
    return versions.filter(v => v.versionName.startsWith(prefix))
      .sort((a, b) => {
        const aSuf = parseInt(a.versionName.split('-')[1] || "1", 10);
        const bSuf = parseInt(b.versionName.split('-')[1] || "1", 10);
        return bSuf - aSuf; // descending
      });
  }, [selectedDate, versions]);

  const maxSuffix = availableVersions.length > 0 
    ? parseInt(availableVersions[0].versionName.split('-')[1] || "1", 10) 
    : 0;

  useEffect(() => {
    if (availableVersions.length > 0) {
      setModeType("edit");
      setEditVersionMode(availableVersions[0].versionName.split('-')[1] || "1");
    } else {
      setModeType("new");
      setEditVersionMode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, availableVersions.length]);

  // ==========================================
  // 3. 주요 로직 (데이터 로딩 및 테이블 조작)
  // ==========================================

  // 백엔드 응답(JSON)을 테이블 형태(rows)로 변환하는 핵심 유틸리티
  const buildRowsFromDetail = (detailData, forcePending, clearNotes) => {
    if (!detailData || !detailData.subVersions || detailData.subVersions.length === 0) {
      return defaultRows.map(dr => ({ ...dr, id: `row_${dr.id}_${Date.now()}` }));
    }
    
    const svList = detailData.subVersions;
    
    const newRows = defaultRows.map((dr) => {
      let tag = "";
      let component = dr.component;
      let existingStatus = "UNCHANGED";
      let pureNote = "";
      let assignee = "";

      // CC 컴포넌트는 API/FE가 분리되어 있을 수 있어 별도 처리
      if (dr.subVersion.toUpperCase() === "CC") {
        const ccItem = svList.find(s => s.code.toUpperCase() === "CC");
        const ccApiItem = svList.find(s => s.code.toUpperCase() === "CC API");
        const ccFeItem = svList.find(s => s.code.toUpperCase() === "CC FE");
        
        if (ccItem) {
          tag = ccItem.version || "";
          component = ccItem.components?.length > 0 ? ccItem.components.map(c => c.imageTag).join('\n') : "sb-cc-api:\nsb-cc-fe:";
          existingStatus = ccItem.submitStatus || "UNCHANGED";
          pureNote = ccItem.note || "";
        } else if (ccApiItem || ccFeItem) {
          tag = (ccApiItem?.version || ccFeItem?.version) || "";
          const apiComp = ccApiItem?.components?.[0]?.imageTag || (ccApiItem ? `sb-cc-api:${ccApiItem.version}` : "sb-cc-api:");
          const feComp = ccFeItem?.components?.[0]?.imageTag || (ccFeItem ? `sb-cc-fe:${ccFeItem.version}` : "sb-cc-fe:");
          component = `${apiComp}\n${feComp}`;
          existingStatus = ccApiItem?.submitStatus || ccFeItem?.submitStatus || "UNCHANGED";
          pureNote = ccApiItem?.note || ccFeItem?.note || "";
        }
      } else {
        const item = svList.find(s => s.code.toUpperCase() === dr.subVersion.toUpperCase());
        if (item) {
          tag = item.version || "";
          component = item.components?.length > 0 ? item.components.map(c => c.imageTag).join('\n') : dr.component;
          existingStatus = item.submitStatus || "UNCHANGED";
          pureNote = item.note || "";
        }
      }

      if (!clearNotes && pureNote !== "") {
        const match = pureNote.match(/^\[담당자:\s*(.+?)\]\s*([\s\S]*)$/);
        if (match) {
          assignee = match[1];
          pureNote = match[2] || "";
        }
      } else if (clearNotes) {
        pureNote = "";
        assignee = "";
      }

      const statusValue = forcePending 
        ? "pending" 
        : (existingStatus.toLowerCase() === "updated" ? "update" : existingStatus.toLowerCase() === "pending" ? "pending" : "unchanged");

      return {
        ...dr,
        id: `row_${dr.id}_${Date.now()}`,
        tag,
        component,
        note: pureNote,
        assignee,
        status: statusValue
      };
    });

    const defaultCodes = defaultRows.map(d => d.subVersion.toUpperCase());
    const extraRows = svList.filter(s => {
      const code = s.code.toUpperCase();
      if (code === "CC API" || code === "CC FE") return false;
      return !defaultCodes.includes(code);
    }).map((sub, index) => {
      const noteStr = sub.note || "";
      let assignee = "";
      let pureNote = noteStr;
      
      if (!clearNotes && pureNote !== "") {
        const match = pureNote.match(/^\[담당자:\s*(.+?)\]\s*([\s\S]*)$/);
        if (match) {
          assignee = match[1];
          pureNote = match[2] || "";
        }
      } else if (clearNotes) {
        pureNote = "";
        assignee = "";
      }

      const existingStatus = sub.submitStatus || "UNCHANGED";
      const statusValue = forcePending 
        ? "pending" 
        : (existingStatus.toLowerCase() === "updated" ? "update" : existingStatus.toLowerCase() === "pending" ? "pending" : "unchanged");

      return {
        id: `row_extra_${sub.id || index}_${Date.now()}`,
        subVersion: sub.code || "",
        component: sub.components?.length > 0 ? sub.components.map(c => c.imageTag).join('\n') : sub.code,
        tag: sub.version || "",
        note: pureNote,
        assignee,
        status: statusValue,
        desc: "Custom Component"
      };
    });

    return [...newRows, ...extraRows];
  };

  // 모드 전환 시 이전 버전의 데이터를 바탕으로 폼 세팅 (최적화로 useCallback 적용 가능하지만 일단 로직 유지)
  const loadBaseline = async () => {
    if (!selectedDate) return;
    setLoadingBase(true);
    setBaseStatus("데이터를 불러오는 중입니다...");
    setLoadError("");

    const prefix = selectedDate.replace(/-/g, '.');

    try {
      if (modeType === "new") {
        const baselineSummary = availableVersions.length > 0 ? availableVersions[0] : versions[0];
        if (baselineSummary) {
          const detail = await getMainVersionDetail(baselineSummary.versionName);
          setRows(buildRowsFromDetail(detail, true, true));
          setSqlScript("");
          setReleaseNote("");
          setBaseStatus(`최신 버전(${baselineSummary.versionName})을 기준으로 신규 등록을 준비합니다. (모든 상태가 pending으로 리셋됩니다)`);
        } else {
          setRows([...defaultRows]);
          setSqlScript("");
          setReleaseNote("");
          setBaseStatus("새로운 메인버전 등록을 준비합니다.");
        }
      } else {
        const targetName = `${prefix}-${editVersionMode}`;
        const detail = await getMainVersionDetail(targetName);
        setRows(buildRowsFromDetail(detail, false, false));
        setSqlScript(detail.mainVersion?.sqlScript || "");
        setReleaseNote(detail.mainVersion?.releaseNote || "");
        setBaseStatus(`버전 ${targetName} 수정 모드입니다. (오타 및 상태 수정 가능)`);
      }
    } catch (error) {
      setRows([...defaultRows]);
      setSqlScript("");
      setReleaseNote("");
      setLoadError(error.payload?.message || error.message || "데이터를 불러오는 중 오류가 발생했습니다.");
      setBaseStatus("");
    } finally {
      setLoadingBase(false);
    }
  };

  useEffect(() => {
    if (modeType === "new" || editVersionMode) {
      loadBaseline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, modeType, editVersionMode, versions]);

  // ==========================================
  // 4. 테이블 행 드래그 앤 드롭 로직
  // ==========================================
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
    setRows(newRows);
    setDraggedIndex(null);
  };

  const enableDrag = (index) => {
    if(trRefs.current[index]) {
      trRefs.current[index].draggable = true;
    }
  }

  const disableDrag = (index) => {
    if(trRefs.current[index]) {
      trRefs.current[index].draggable = false;
    }
  }

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, {
      id: `custom_${Date.now()}`,
      subVersion: "NEW",
      component: "new-component",
      tag: "",
      note: "",
      assignee: "",
      status: "update",
      desc: "Custom Component"
    }]);
  };

  const removeRow = (index) => {
    const newRows = [...rows];
    newRows.splice(index, 1);
    setRows(newRows);
  };

  const handleReset = () => {
    const isConfirmed = window.confirm("비우기 클릭 시 모든 상세 입력 내용이 삭제됩니다. 계속하시겠습니까?");
    if (isConfirmed) {
      setRows(rows.map(r => {
        const defaultMatch = defaultRows.find(dr => dr.subVersion.toUpperCase() === r.subVersion.toUpperCase());
        const resetComponent = defaultMatch ? defaultMatch.component : "";
        return { ...r, component: resetComponent, tag: "", note: "", assignee: "", status: "unchanged" };
      }));
      setSqlScript("");
      setReleaseNote("");
    }
  };

  const handleReload = () => {
    const isConfirmed = window.confirm(
      modeType === "new" 
        ? "최신 버전의 데이터를 다시 불러오시겠습니까? 현재 입력된 내용은 덮어쓰기 됩니다."
        : "선택한 버전의 원본 데이터를 다시 불러오시겠습니까? 현재 변경사항은 덮어쓰기 됩니다."
    );
    if (isConfirmed) {
      loadBaseline();
    }
  };

  // ==========================================
  // 5. 폼 제출 로직 (Submit)
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    const prefix = selectedDate.replace(/-/g, '.');
    const targetVersionName = modeType === "new" 
      ? `${prefix}-${maxSuffix + 1}` 
      : `${prefix}-${editVersionMode}`;

    const items = rows.map((row, index) => {
      if (!row.tag) return null;

      const payload = {
        code: row.subVersion,
        version: row.tag,
        sortOrder: index,
      };

      let finalNote = row.note ? row.note.trim() : "";
      if (row.assignee && row.assignee.trim() !== "") {
        finalNote = `[담당자: ${row.assignee.trim()}] ${finalNote}`;
      }
      if (finalNote !== "") {
        payload.note = finalNote;
      }

      if (row.component) {
        payload.imageTags = row.component.split('\n').map(t => t.trim()).filter(Boolean);
      }

      return payload;
    }).filter(Boolean);

    if (items.length === 0) {
      window.alert("하위 컴포넌트 태그를 하나 이상 입력하세요.");
      return;
    }

    setSaving(true);
    setSubmitError("");

    try {
      if (modeType === "new") {
        try {
          await createMainVersion(targetVersionName, {
            releaseNote: releaseNote || undefined,
            sqlScript: sqlScript || undefined,
          });
        } catch (error) {
          if (error.status !== 409) {
            throw error;
          }
        }
      } else {
        await updateMainVersion(targetVersionName, {
          releaseNote: releaseNote || undefined,
          sqlScript: sqlScript || undefined,
        });
      }

      await upsertSubVersions(targetVersionName, { items });

      const detailAfterUpsert = await getMainVersionDetail(targetVersionName);
      const byCodeAfter = {};
      (detailAfterUpsert.subVersions || []).forEach((s) => {
        if (s?.code) byCodeAfter[s.code] = s;
      });

      const patchPromises = [];
      rows.forEach((row) => {
        if (!row.tag) return;

        const saved = byCodeAfter[row.subVersion];
        if (!saved || !saved.id) return;

        const desired = (row.status === "update") ? "UPDATED" : (row.status === "pending") ? "PENDING" : "UNCHANGED";
        const existing = (saved.submitStatus || "").toUpperCase();
        if (existing !== desired) {
          patchPromises.push(
            changeSubmitStatus(saved.id, { status: desired, submittedBy: getCurrentUser() })
              .then(() => ({ key: row.subVersion, ok: true }))
              .catch((err) => ({ key: row.subVersion, ok: false, error: err }))
          );
        }
      });

      const patchResults = patchPromises.length ? await Promise.all(patchPromises) : [];
      const failed = patchResults.filter(r => !r.ok);
      if (failed.length) {
        const codes = failed.map(f => f.key).join(", ");
        window.alert(`상태 반영 중 일부 항목이 실패했습니다: ${codes}`);
      }

      const exists = versions.some(v => v.versionName === targetVersionName);
      const newSummary = {
        versionName: targetVersionName,
        subVersionCount: items.length,
        componentCount: items.length,
        lastJob: null,
      };

      const updatedVersions = exists
        ? versions.map(v => (v.versionName === targetVersionName ? newSummary : v))
        : [newSummary, ...versions];

      setVersions(updatedVersions);
      setSelectedVersionName(targetVersionName);
      setRegisteredVersionName(targetVersionName);
      setSubmittedModeType(modeType);
      setShowSuccessModal(true);

      if (modeType === "new") {
        setModeType("edit");
        setEditVersionMode((maxSuffix + 1).toString());
      } else {
        const finalDetail = await getMainVersionDetail(targetVersionName);
        setRows(buildRowsFromDetail(finalDetail, false));
      }

    } catch (error) {
      const message = error.payload?.message || error.message || "메인버전 등록 중 오류가 발생했습니다.";
      setSubmitError(message);
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleGoToDeployer = () => {
    setShowSuccessModal(false);
    setActiveNavigation("deployer");
  };

  // ==========================================
  // 6. UI 렌더링 (JSX)
  // ==========================================
  return (
    <div className="w-full max-w-[1920px] mx-auto p-8 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <CodeIcon className="w-9 h-9 text-[#000666]" />
          <h1 className="text-4xl font-bold tracking-tight text-[#000666]">
            개발자 페이지
          </h1>
        </div>
        <p className="text-slate-500 text-base font-medium ml-12">
          새로운 메인버전을 등록하거나, 패키징 전인 메인버전의 오타를 수정하고 매니페스트 정보를 관리할 수 있습니다.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b pb-4 border-slate-100">
            <ListIcon className="w-5 h-5 text-[#000666]" />
            <h2 className="text-2xl font-bold text-slate-800">메인버전 정보 설정</h2>
          </div>

          <div className={`rounded-2xl border px-5 py-4 text-base font-medium ${modeType === "new" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
            {loadingBase ? (
              <div className="font-semibold text-slate-700">{baseStatus}</div>
            ) : loadError ? (
              <div className="text-red-600">{loadError}</div>
            ) : (
              <div>{baseStatus || "준비 중입니다."}</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="main-version-date" className="text-base font-bold text-slate-500 uppercase tracking-wider">
                메인 버전 날짜 선택 <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <input
                  id="main-version-date"
                  type="date"
                  ref={dateInputRef}
                  required
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3.5 px-4 text-lg font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-base font-bold text-slate-500 uppercase tracking-wider">
                작업 모드 선택 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3 items-center">
                <div className="relative w-40">
                  <select
                    value={modeType}
                    onChange={(e) => {
                      setModeType(e.target.value);
                      if (e.target.value === "edit" && !editVersionMode && availableVersions.length > 0) {
                        setEditVersionMode(maxSuffix.toString());
                      }
                    }}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-10 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all cursor-pointer"
                  >
                    <option value="new">신규 등록</option>
                    <option value="edit" disabled={availableVersions.length === 0}>버전 수정</option>
                  </select>
                  <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
                
                <div className="flex-1">
                  {modeType === "new" ? (
                    <div className="w-full rounded-lg border border-indigo-200 bg-indigo-50 py-3.5 px-4 text-lg font-bold text-indigo-700 text-center">
                      등록될 버전명: {selectedDate.replace(/-/g, '.')}-{maxSuffix + 1}
                    </div>
                  ) : (
                    <div className="relative w-full">
                      <select
                        value={editVersionMode}
                        onChange={(e) => setEditVersionMode(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-10 text-lg font-medium text-slate-700 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all cursor-pointer"
                      >
                        {availableVersions.map(v => {
                          const suf = v.versionName.split('-')[1] || "1";
                          return <option key={suf} value={suf}>{v.versionName}</option>;
                        })}
                      </select>
                      <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-2 border-t border-slate-100 gap-3">
            <button
              type="button"
              onClick={handleReload}
              className="py-2.5 px-8 text-base font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-all shadow-sm active:scale-95"
            >
              {modeType === "new" ? "최신버전 불러오기" : "원본 불러오기"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="py-2.5 px-8 text-base font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all shadow-sm active:scale-95"
            >
              입력창 비우기
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b pb-4 border-slate-100">
            <ListIcon className="w-5 h-5 text-[#000666]" />
            <h2 className="text-2xl font-bold text-slate-800">SQL / Release Note</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-base font-bold text-slate-500 uppercase tracking-wider">SQL Script</label>
              <textarea
                value={sqlScript}
                onChange={(e) => setSqlScript(e.target.value)}
                placeholder="이번 배포에 적용할 DB SQL 스크립트를 입력하세요."
                rows={6}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3.5 px-4 text-base font-mono text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all resize-y"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-base font-bold text-slate-500 uppercase tracking-wider">Release Note</label>
              <textarea
                value={releaseNote}
                onChange={(e) => setReleaseNote(e.target.value)}
                placeholder="고객사 전달용 릴리즈 노트를 입력하세요."
                rows={6}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3.5 px-4 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all resize-y"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <RocketIcon className="w-5 h-5 text-[#000666]" />
              <h2 className="text-2xl font-bold text-slate-800">매니페스트 상세 입력</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1250px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider w-[15%]">APP</th>
                  <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider w-[15%]">VERSION <span className="text-red-500">*</span></th>
                  <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider w-[23%]">IMAGE TAG <span className="text-red-500">*</span></th>
                  <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider w-[20%]">NOTE</th>
                  <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider w-[15%]">담당자</th>
                  <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider w-[12%]">상태</th>
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
                           className="cursor-grab text-slate-300 hover:text-slate-500 p-1 select-none"
                           onMouseDown={() => enableDrag(index)} 
                           onMouseUp={() => disableDrag(index)}
                           onMouseLeave={() => disableDrag(index)}
                           title="드래그하여 순서 변경"
                        >
                          ☰
                        </div>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            required
                            value={row.subVersion}
                            onChange={(e) => handleRowChange(index, "subVersion", e.target.value)}
                            className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm font-bold text-[#1a237e] focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all uppercase"
                          />
                          <button 
                            type="button" 
                            onClick={() => removeRow(index)} 
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 font-bold"
                            title="항목 삭제"
                          >
                            ✕
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
                        className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-bold text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all"
                      />
                    </td>
                    <td className="px-4 py-3 border-b border-slate-100">
                      <textarea
                        required
                        value={row.component}
                        onChange={(e) => handleRowChange(index, "component", e.target.value)}
                        placeholder="예: sb-cc-api:v2.0.27"
                        rows={2}
                        className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all font-mono resize-y min-h-[42px]"
                      />
                    </td>
                    <td className="px-4 py-3 border-b border-slate-100">
                      <textarea
                        value={row.note}
                        onChange={(e) => handleRowChange(index, "note", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                          }
                        }}
                        placeholder="변경 사항 기록 (Shift+Enter 줄바꿈)"
                        rows={2}
                        className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all resize-y min-h-[42px]"
                      />
                    </td>
                    <td className="px-4 py-3 border-b border-slate-100">
                      <input
                        type="text"
                        value={row.assignee}
                        onChange={(e) => handleRowChange(index, "assignee", e.target.value)}
                        placeholder="담당자명"
                        className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all"
                      />
                    </td>
                    <td className="px-4 py-3 border-b border-slate-100">
                      <div className="relative">
                        <select
                          value={row.status}
                          onChange={(e) => handleRowChange(index, "status", e.target.value)}
                          className={`w-full appearance-none rounded-md border border-slate-200 py-2.5 pl-3.5 pr-8 text-sm font-bold outline-none transition-all ${
                            row.status === "update" ? "bg-[#0006661a] text-[#000666]" :
                            row.status === "pending" ? "bg-[#ffdbd0] text-[#7b2e12]" :
                            "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <option value="update" className="bg-white text-[#000666] font-bold">update</option>
                          <option value="pending" className="bg-white text-[#7b2e12] font-bold">pending</option>
                          <option value="unchanged" className="bg-white text-slate-500 font-bold">unchanged</option>
                        </select>
                        <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
            <button 
              type="button" 
              onClick={addRow} 
              className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 hover:border-[#000666] hover:text-[#000666] text-slate-600 font-bold rounded-lg shadow-sm transition-all"
            >
              <span className="text-xl leading-none">+</span>
              <span>빈 서브버전 항목 추가하기</span>
            </button>
          </div>
        </section>

        {submitError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
            {submitError}
          </div>
        )}
        
        <button
          type="submit"
          disabled={saving}
          className={`w-full py-5 rounded-xl text-white shadow-lg text-2xl font-bold tracking-wide transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 bg-[#000666] hover:bg-[#090d82] hover:shadow-indigo-200 ${saving ? "bg-slate-400 cursor-not-allowed" : ""}`}
        >
          <CheckCircleIcon className="w-6 h-6" />
          <span>{saving ? "처리 중..." : (modeType === "new" ? "새로운 메인버전 등록하기" : "메인버전 수정하기")}</span>
        </button>
      </form>

      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-full bg-green-50 text-green-500 flex items-center justify-center shadow-inner">
              <CheckCircleIcon className="w-10 h-10" />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-3xl font-bold text-slate-800">
                {submittedModeType === "new" ? "버전 등록 완료!" : "버전 수정 완료!"}
              </h3>
              <p className="text-base text-slate-500 leading-relaxed px-2">
                메인 버전 <strong className="text-[#000666] font-mono">{registeredVersionName}</strong>의 매니페스트가 성공적으로 처리되었습니다.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              <button
                type="button"
                onClick={handleGoToDeployer}
                className="w-full py-3 bg-[#000666] hover:bg-[#090d82] text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-100 transition-all text-base"
              >
                배포 파이프라인(배포자)으로 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
