import { useState, useRef, useEffect, useMemo, useCallback } from "react"; 
import { ChevronDownIcon } from "../../components/ui/Icons"; 
import { AlertModal } from "../../components/ui/AlertModal"; 
import { VersionDropdown } from "../../components/ui/VersionDropdown";
import { createMainVersion, deleteSubVersion, getMainVersionDetail, upsertSubVersion, updateMainVersion } from "../../services/api";

// ==========================================
// [도우미 함수 및 고정값] 
// 화면이 다시 그려질 때마다 똑같은 함수를 계속 새로 만들지 않도록, 부품(컴포넌트) 바깥에 따로 빼두었습니다.
// ==========================================

/**
 * 새 버전을 만들 때 오늘 날짜를 기본값으로 쏙 넣어주기 위해 
 * '연도-월-일' 모양의 글자로 바꿔주는 도우미 함수입니다.
 * 
 * @returns {string} 오늘 날짜 모양 (예: "2026-08-24")
 */
const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // 컴퓨터는 달(Month)을 0부터 세기 때문에 1을 더해줘야 진짜 이번 달이 됩니다.
  const dd = String(today.getDate()).padStart(2, '0'); // 날짜가 1~9일일 때 앞에 '0'을 붙여서 '01', '09'처럼 두 칸을 채워줍니다.
  return `${yyyy}-${mm}-${dd}`;
};

// ==========================================
// [메인 컴포넌트] 개발자 페이지에서 버전을 등록하고 수정하는 화면 부품
// ==========================================
/**
 * 개발자가 세상에 내보낼 새 버전을 등록하거나, 기존 버전에 포함된 작은 앱(서브버전)들의 목록을 관리하는 화면입니다.
 */
export const DeveloperVersionRegistrationSection = ({
  versions, // 전체 앱에서 공통으로 들고 있는(App.jsx) 모든 버전의 목록입니다.
  setVersions, // 공통 버전 목록을 새로운 내용으로 덮어쓸 때 사용하는 스위치(함수)입니다.
  setSelectedVersionName,
  hasMore,
  loadingVersions,
  loadingMoreVersions,
  loadMoreVersions,
}) => {
  // 날짜를 입력하는 칸에 마우스 커서를 강제로 깜빡이게 하거나 직접 건드려야 할 때, 그 칸을 콕 짚어내기 위한 '이름표'입니다.
  const dateInputRef = useRef(null); 

  // ==========================================
  // 1. 상태(변하는 값들) 선언부
  // ==========================================
  
  // 사용자가 달력에서 콕 찍은 날짜입니다. 이 날짜가 새 버전의 이름(예: 2026.08.24)을 짓는 뼈대가 됩니다.
  const [selectedDate, setSelectedDate] = useState(getTodayDateString()); 
  
  // 지금 화면이 어떤 상태인지 나타냅니다. - "new": 새 버전을 만드는 중 / "edit": 기존 버전을 고치는 중
  const [modeType, setModeType] = useState("new"); 
  
  // 같은 날에 여러 번 배포할 때 구별하려고 붙이는 꼬리표입니다 (예: 첫 번째는 "", 두 번째는 "-1").
  const [editVersionMode, setEditVersionMode] = useState(""); 

  const [rows, setRows] = useState([]); // 화면 아래쪽 표(테이블)에 그려질 줄(행) 하나하나의 정보입니다.
  const [sqlScript, setSqlScript] = useState(""); // 새 버전에 들어갈 데이터베이스(SQL) 명령어 내용입니다.
  const [releaseNote, setReleaseNote] = useState(""); // 고객들에게 "이번에 이런 걸 고쳤어요"라고 알려주는 안내문입니다.
  
  const [alertMessage, setAlertMessage] = useState(""); // 팝업창에 띄울 안내 말씀입니다.
  const [alertType, setAlertType] = useState("warning"); 

  const [saving, setSaving] = useState(false); // 저장 버튼을 연타했을 때 여러 번 저장되는 걸 막아주는 '잠금 장치'입니다.
  const [submitError, setSubmitError] = useState("");
  const [loadingBase, setLoadingBase] = useState(false); // '고치기' 모드로 들어갈 때, 서버에서 예전 기록을 가져오느라 기다리고 있는 상태인지 나타냅니다.
  const [baseStatus, setBaseStatus] = useState(""); 
  const [loadError, setLoadError] = useState(""); 

  // ==========================================
  // 2. 기존 재료로 새로 만들어낸 데이터 (파생 정보)
  // ==========================================

  /**
   * [availableVersions 설명]
   * 사용자가 달력에서 어떤 날짜(예: 2026-08-04)를 골랐을 때, 그 날짜로 만들어진 
   * 버전들("2026.08.04", "2026.08.04-1" 등)만 쏙쏙 뽑아냅니다. 이렇게 하면 다음 꼬리표 번호를 찾기 쉽습니다.
   * 화면이 그려질 때마다 계산하면 힘드니(useMemo), '선택된 날짜'나 '전체 목록'이 바뀔 때만 다시 계산하도록 기억해둡니다.
   */
  const availableVersions = useMemo(() => {
    if (!selectedDate) return []; 
    // '2026-08-24' 처럼 대시(-)로 된 날짜를 '2026.08.24' 처럼 점(.)으로 바꿔줍니다. (서버가 좋아하는 모양입니다)
    const prefix = selectedDate.replace(/-/g, '.');
    
    return versions
      .filter(v => v.versionName === prefix || v.versionName.startsWith(prefix + '-'))
      .sort((a, b) => {
        // [줄 세우기] 꼬리표에 있는 '-1', '-2' 같은 숫자를 떼어내서 가장 큰 숫자(가장 최신)가 맨 앞에 오도록 정렬합니다.
        const aSuf = parseInt(a.versionName.split('-')[1] || "1", 10);
        const bSuf = parseInt(b.versionName.split('-')[1] || "1", 10);
        return bSuf - aSuf;
      });
  }, [selectedDate, versions]); 

  /**
   * [maxSuffix(가장 큰 꼬리표 번호) 찾는 방법]
   * 같은 날짜에 만들어진 버전 중 제일 마지막 번호가 몇 번인지 찾아냅니다.
   * 꼬리표가 없으면 0, '-1'이 있으면 1입니다. 이 번호에 1을 더해서 
   * 새 버전 이름 뒤에 붙여주면(예: "2026.08.04-2"), 기존 이름과 겹치는 사고를 막을 수 있습니다.
   */
  const maxSuffix = availableVersions.length > 0
    ? Math.max(...availableVersions.map(v => {
      if (v.versionName === selectedDate.replace(/-/g, '.')) return 0;
      const parts = v.versionName.split('-');
      return parts.length > 1 ? parseInt(parts[1], 10) : 0;
    }))
    : -1; 

  const initializedVersionRef = useRef(false);

  // [처음 화면이 뜰 때 가장 최근 버전을 보여주기]
  // 화면이 맨 처음 열릴 때만, 목록에서 제일 위에 있는 따끈따끈한 최신 버전을 '고치기 모드'로 바로 열어줍니다.
  useEffect(() => {
    if (initializedVersionRef.current || versions.length === 0) return;

    const latestVersionName = versions[0].versionName;
    const [datePart, suffix = ""] = latestVersionName.split('-');
    setSelectedDate(datePart.replace(/\./g, '-'));
    setEditVersionMode(suffix);
    setModeType("edit");
    initializedVersionRef.current = true;
  }, [versions]);

  const selectedExistingVersionName = modeType === "edit"
    ? `${selectedDate.replace(/-/g, '.')}${editVersionMode ? `-${editVersionMode}` : ''}`
    : "";

  /**
   * 화면 위쪽의 목록 상자(드롭다운)에서 기존 버전을 하나 골랐을 때 실행되는 행동입니다.
   */
  const handleSelectExistingVersion = (versionName) => {
    const [datePart, suffix = ""] = versionName.split('-');
    setSelectedDate(datePart.replace(/\./g, '-'));
    setEditVersionMode(suffix);
    setModeType("edit"); // 이제부터 이 버전을 '고치는 모드'로 바꿉니다.
    setSubmitError("");
    setLoadError("");
  };

  /**
   * '+ 새 메인버전 만들기' 버튼을 누르면, 모든 입력칸을 깨끗하게 비우고 새 종이를 꺼냅니다.
   */
  const handleStartNewVersion = () => {
    setModeType("new");
    setSelectedDate(getTodayDateString());
    setEditVersionMode("");
    setRows([]); // 아래쪽 표(테이블)를 싹 비웁니다.
    setSqlScript(""); // SQL 명령어 입력칸도 비웁니다.
    setReleaseNote(""); 
    setSubmitError("");
    setLoadError("");
    setBaseStatus("");
  };

  // ==========================================
  // 3. 핵심 동작 (데이터 가져오고 표 다루기)
  // ==========================================

  /**
   * 서버에서 보내준 작은 앱들의 목록(detailData)을 화면의 입력칸에 쏙쏙 넣기 좋게 알맞은 모양(행 데이터)으로 바꿔줍니다.
   * 
   * [originalValues(처음 모습)와 originalStatus(처음 상태)가 필요한 이유]
   * 사용자가 글자를 고치거나 순서를 바꿨을 때, "아, 처음이랑 달라졌구나!(수정됨)" 하고 눈치채기 위해 
   * 처음 도착했을 때의 모습을 '원본 사진'처럼 간직해두는 것입니다.
   */
  const buildRowsFromDetail = (detailData, forcePending, clearNotes) => {
    if (!detailData || !detailData.subVersions || !detailData.subVersions.length) return [];
    
    return detailData.subVersions.map((sub, index) => {
      let pureNote = sub.note || "";
      // 새 버전을 만들 때는 이전 버전의 껍데기(앱 목록)만 밑바탕으로 빌려오고,
      // 그 안에 적혀있던 지난 작업 메모(note)는 필요 없으니 깨끗하게 지우는 역할입니다.
      if (clearNotes) pureNote = ""; 
      
      const existingStatus = sub.submitStatus || "UNCHANGED";
      // 새 버전을 밑바탕부터 새로 짤 때는, 모든 앱이 새로 나갈 준비를 하도록 강제로 '대기중(pending)' 딱지를 붙입니다.
      const statusValue = forcePending
        ? "pending"
        : (existingStatus.toLowerCase() === "updated" ? "updated" : existingStatus.toLowerCase() === "pending" ? "pending" : "unchanged");
        
      const component = sub.components?.length > 0
        ? sub.components.map(c => c.imageTag).join('\n') // 이름표가 여러 개면 엔터(줄바꿈)를 쳐서 세로로 예쁘게 보여줍니다.
        : "";
        
      const originalValues = {
        subVersion: sub.code || "",
        component,
        tag: sub.version || "",
        note: pureNote,
        sortOrder: index, // 처음 몇 번째 줄에 있었는지 기억해둡니다 (나중에 마우스로 끌어서 자리가 바뀌었는지 확인하기 위해)
      };
      
      return {
        id: `row_${sub.id || sub.code || index}`, // 화면에 표를 그릴 때 각각의 줄을 헷갈리지 않게 구별하는 '주민등록번호'입니다.
        serverId: sub.id ?? null, // [서버용 번호가 따로 있는 이유] 앱 이름(code)은 사용자가 마음대로 고칠 수 있어서, 나중에 지울 때 확실한 표식(서버 ID)이 필요합니다.
        subVersion: sub.code || "",
        component,
        tag: sub.version || "",
        note: pureNote,
        status: statusValue,
        originalStatus: statusValue,
        originalValues,
        desc: sub.code || "Custom Component",
        dirty: false, // 사용자가 손을 댔는지(수정했는지) 표시하는 깃발입니다. 처음엔 아직 안 고쳤으니 false입니다.
      };
    });
  };

  /**
   * 새 종이를 꺼내거나 다른 버전을 골랐을 때, 과거의 기록을 가져와서 폼의 '밑그림(기본 바탕)'으로 깔아주는 역할입니다.
   */
  const loadBaseline = useCallback(async () => {
    if (modeType === "edit" || editVersionMode) {
      setLoadingBase(true);
      setBaseStatus("버전 정보 로딩 중...");
      setLoadError("");
      try {
        const prefix = selectedDate.replace(/-/g, '.');
        const targetVersionName = editVersionMode ? `${prefix}-${editVersionMode}` : prefix;

        const detail = await getMainVersionDetail(targetVersionName);

        if (modeType === "new") {
          // 새 버전을 만들 때는 이전 뼈대만 빌려오니까, 상태는 '대기중'으로 맞추고 예전 메모는 싹 지워줍니다.
          setRows(buildRowsFromDetail(detail, true, true));
          setSqlScript(""); 
          setReleaseNote("");
          setBaseStatus(`이전 버전(${targetVersionName})을 기반으로 새 버전을 작성합니다.`);
        } else {
          // 기존 버전을 고칠 때는 예전 정보의 있는 모습 그대로를 가져옵니다.
          setRows(buildRowsFromDetail(detail, false, false));
          setSqlScript(detail.mainVersion?.sqlScript || "");
          setReleaseNote(detail.mainVersion?.releaseNote || "");
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
    // [소중한 작업물 보호하기] 내가 열심히 글 고치고 있는데 새로고침을 해버리면 다 날아가겠죠?
    // 그래서 화면에 조금이라도 '손댄(수정된)' 흔적이 있다면, 정말 덮어쓸 건지 한 번 더 물어보는 안전장치입니다.
    if (rows.some((row) => row.dirty)
      && !window.confirm("저장하지 않은 APP 정보가 있습니다. 서버의 최신 정보로 새로고침하시겠습니까?")) {
      return;
    }
    loadBaseline();
  };

  // ==========================================
  // 4. 표의 줄을 마우스로 끌어서 옮기는 기능 (드래그 앤 드롭)
  // ==========================================
  // 앱들이 화면에 보이는 순서는 나중에 실제 서비스에 나갈 때의 순서이기도 합니다.
  // 그래서 사용자가 마우스로 꾹 눌러서 위아래로 쉽게 순서를 바꿀 수 있도록 만들었습니다.
  const [draggedIndex, setDraggedIndex] = useState(null); 
  const trRefs = useRef([]); 

  const handleDragStart = (e, index) => {
    setDraggedIndex(index); 
    e.dataTransfer.effectAllowed = "move"; 
  };

  const handleDragOver = (e, index) => {
    e.preventDefault(); // 브라우저가 원래 하려던 딴짓(금지 마크 띄우기 등)을 막아야, 우리가 원하는 곳에 무사히 내려놓을 수 있습니다.
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault(); 
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newRows = [...rows]; 
    const draggedItem = newRows[draggedIndex]; 
    newRows.splice(draggedIndex, 1); // 원래 있던 자리에서 뽑아냅니다.
    newRows.splice(targetIndex, 0, draggedItem); // 마우스를 놓은 자리에 쏙 끼워 넣습니다.

    // 내가 옮긴 줄 때문에 다른 줄들도 위아래로 밀려나서 번호표가 바뀌었을 겁니다.
    // 그래서 모든 줄을 하나씩 보면서 "너 원래 자리랑 달라졌니?" 하고 확인하여 변경 표시를 해줍니다.
    setRows(newRows.map((row, index) => {
      const dirty = isRowChanged(row, index);
      return {
        ...row,
        dirty,
        // 안 고친 상태(unchanged)였던 줄이라도 자리가 바뀌었다면, 서버에 바뀐 자리를 알려줘야 하니 '수정됨(updated)'으로 슬쩍 바꿔줍니다.
        status: row.originalStatus === "unchanged" ? (dirty ? "updated" : "unchanged") : row.status,
      };
    })); 
    setDraggedIndex(null); 
  };

  // 언제나 드래그할 수 있게 열어두면, 글씨를 복사하려고 블록을 씌우려다 표 전체가 질질 끌려오는 답답한 일이 생깁니다.
  // 그래서 마우스로 "이동" 글자를 꾹 누를 때만 끌고 다닐 수 있게 잠금을 풀어줍니다.
  const enableDrag = (index) => {
    if (trRefs.current[index]) trRefs.current[index].draggable = true; 
  }
  const disableDrag = (index) => {
    if (trRefs.current[index]) trRefs.current[index].draggable = false; 
  }

  /**
   * 이 줄의 내용이나 자리가 처음과 달라졌는지(수정되었는지) 검사하는 탐정 같은 함수입니다.
   */
  const isRowChanged = (row, currentIndex) => {
    if (!row.originalValues) return true; // 방금 새로 만든(서버에 원본 사진이 없는) 줄은 무조건 새로 생긴 것이니 변경된 것으로 봅니다.
    
    return row.subVersion !== row.originalValues.subVersion
      || row.component !== row.originalValues.component
      || row.tag !== row.originalValues.tag
      || row.note !== row.originalValues.note
      || currentIndex !== row.originalValues.sortOrder; // 글자를 고친 것뿐만 아니라, 자리를 이동한 것도 바뀐 것이니 꼭 챙깁니다.
  };

  /**
   * 사용자가 표 안의 네모 칸에 글자를 타닥타닥 칠 때마다 실행되어 글자를 바꿔치기해주는 역할입니다.
   */
  const handleRowChange = (index, field, value) => {
    const newRows = [...rows]; 
    const nextRow = { ...newRows[index], [field]: value };
    
    if (field !== "status") {
      // [특별한 규칙] 'EXT'는 우리 동네가 아닌 바깥 동네에서 가져온 것이라서, 태그(IMAGE TAG)라는 이름표를 달 수 없습니다.
      // 사용자가 무심코 'EXT'라고 적으면, 헷갈리지 않게 태그 칸을 재빨리 지워버립니다.
      if (field === "subVersion" && value.trim().toUpperCase() === "EXT") {
        nextRow.component = "";
      }
      nextRow.dirty = isRowChanged(nextRow, index);
      
      if (nextRow.originalStatus === "unchanged") {
        nextRow.status = nextRow.dirty ? "updated" : "unchanged";
      }
    }
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
      
      // 이미 서버에 저장된 적이 있는 항목이라면, 서버에게도 "이거 지워줘!"라고 연락(DELETE API)을 합니다.
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
      // 내 화면(로컬)의 표에서도 이 줄을 지워버립니다.
      const newRows = [...rows];
      newRows.splice(index, 1);
      setRows(newRows);
    }
  };

  // ==========================================
  // 5. 다 쓴 서류 제출하기 (서버에 저장)
  // ==========================================

  /**
   * 새로운 버전을 담을 커다란 '빈 박스(메인 버전)'를 만듭니다. 
   * (아래쪽 표에 있는 작은 앱 정보들은 이 박스를 만든 뒤에 하나씩 따로따로 담아서 저장할 겁니다.)
   */
  const handleRegisterMainVersion = async () => {
    const prefix = selectedDate.replace(/-/g, '.');
    const targetVersionName = maxSuffix >= 0 ? `${prefix}-${maxSuffix + 1}` : prefix;
    setSaving(true);
    setSubmitError("");

    try {
      // 1. 서버 은행원(백엔드)에게 가서 "이 이름으로 새 버전을 만들어주세요!"라고 요청합니다. (SQL, 안내문 포함)
      await createMainVersion(targetVersionName, {
        releaseNote: releaseNote || undefined,
        sqlScript: sqlScript || undefined,
      });

      // 2. 우리가 모두 같이 보는 전체 버전 목록 장부 맨 앞줄에 방금 만든 따끈따끈한 버전을 적어넣습니다.
      const newSummary = {
        versionName: targetVersionName,
        subVersionCount: 0,
        componentCount: 0,
        lastJob: null,
      };
      setVersions([newSummary, ...versions]);
      setSelectedVersionName(targetVersionName);

      // 3. 박스 만들기에 성공했으니, 이제 화면을 '고치기' 상태로 바꿔서 표를 채울 수 있도록 문을 활짝 엽니다.
      setModeType("edit");
      setEditVersionMode(maxSuffix >= 0 ? (maxSuffix + 1).toString() : '');

      setAlertType("success"); setAlertMessage(`신규 메인버전(${targetVersionName})이 등록되었습니다. 아래에서 매니페스트 상세 정보를 작성 후 각각 저장해주세요.`);
    } catch (error) {
      if (error.status !== 409) {
        const message = error.payload?.message || error.message || "메인버전 등록 중 오류가 발생했습니다.";
        setSubmitError(message);
        setAlertType("warning"); setAlertMessage(message);
      } else {
        // 만약 내 옆자리에 앉은 동료가 0.1초 빨리 같은 이름으로 버전을 만들어 버렸다면(409 충돌 에러),
        setModeType("edit");
        setEditVersionMode(maxSuffix >= 0 ? (maxSuffix + 1).toString() : '');
        setAlertType("warning"); setAlertMessage("이미 등록된 버전입니다. 수정 모드로 전환되었습니다.");
      }
    } finally {
      setSaving(false);
    }
  };

  /**
   * 표에서 고른 딱 한 줄(앱 하나)의 정보만 서버에 새로 쓰거나 덮어씁니다.
   * [왜 따로 저장할까요?] 전체 버전에 딸린 수십 개의 앱 정보를 한 번에 큰 보따리로 묶어서 보내면, 
   * 보따리가 너무 무거워지고 가다가 하나만 넘어져도 다 실패할 수 있어서, 안전하게 하나씩 택배를 보내는 방식을 골랐습니다.
   */
  const handleSaveRow = async (index) => {
    const row = rows[index];
    if (!row.tag) {
      setAlertType("warning"); setAlertMessage("버전(VERSION) 태그를 입력해야 저장할 수 있습니다.");
      return;
    }

    const prefix = selectedDate.replace(/-/g, '.');
    const targetVersionName = (editVersionMode ? `${prefix}-${editVersionMode}` : prefix);
    const desiredStatus = (row.status === "updated") ? "UPDATED" : (row.status === "pending") ? "PENDING" : "UNCHANGED";

    // 내용을 고쳐놓고서 상태를 '안 바뀜(UNCHANGED)'으로 속여서 보내면, 나중에 배포 담당자가 모를 수 있으니 엄격하게 막습니다.
    if (row.dirty && desiredStatus === "UNCHANGED") {
      setAlertType("warning");
      setAlertMessage("APP 정보가 변경되었습니다. STATUS를 UPDATED 또는 PENDING으로 선택해주세요.");
      return;
    }

    const payload = {
      code: row.subVersion,
      version: row.tag,
      sortOrder: index, // 화면에서 몇 번째 줄에 있었는지 순서를 서버에 알려주어 영원히 기억하게 합니다.
      submitStatus: desiredStatus, 
    };

    const finalNote = row.note ? row.note.trim() : "";
    if (finalNote !== "") payload.note = finalNote;

    // [특별 대우] 바깥에서 온 'EXT' 친구는 태그라는 걸 가질 수 없으니, 억지로 빈 칸이라도 만들어서 서버가 당황하지 않게 도와줍니다.
    if (row.subVersion.trim().toUpperCase() === "EXT") {
      payload.imageTags = [];
    } else if (row.component) {
      // 여러 줄로 쓴 태그들을 엔터 키를 기준으로 하나씩 가위로 오려서 서버에 전달합니다.
      payload.imageTags = row.component.split('\n').map(t => t.trim()).filter(Boolean);
    }

    setSaving(true);
    setSubmitError("");
    try {
      await upsertSubVersion(targetVersionName, row.subVersion, payload);
      setAlertType("warning"); setAlertMessage(`${row.subVersion} 컴포넌트 정보가 저장되었습니다.`);

      // 한 줄 저장이 잘 끝났으니, 서버가 가진 가장 깨끗한 최신본으로 표 전체를 한 번 새로고침 해줍니다.
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

  /**
   * 커다란 박스 껍데기에 적힌 글씨(SQL 명령어, 릴리즈 노트)만 지우개로 지우고 새로 적어주는 함수입니다.
   */
  const handleUpdateMainVersionInfo = async () => {
    const prefix = selectedDate.replace(/-/g, '.');
    const targetVersionName = editVersionMode ? `${prefix}-${editVersionMode}` : prefix;

    setSaving(true);
    setSubmitError("");
    try {
      await updateMainVersion(targetVersionName, {
        releaseNote,
        sqlScript,
      });
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

  // ==========================================
  // 6. UI 렌더링 (JSX)
  // ==========================================
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
        {/* 섹션 1: 메인버전 정보 설정 */}
        <section className="bg-white rounded-xl border border-slate-300 shadow-md p-6 flex flex-col gap-6">
          <div className="border-b pb-4 border-slate-100">
            <h2 className="text-2xl font-bold text-slate-800">
              {modeType === "new" ? "새 메인버전 만들기" : "메인버전 관리"}
            </h2>
          </div>

          {/* 버전 조작부: 기존 선택 드롭다운과 신규생성 버튼 영역 */}
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

          {/* 신규 생성일 경우 날짜 피커(Calendar) 표시, 아닐 땐 읽기 전용 텍스트 배지 표시 */}
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
                  {selectedDate.replace(/-/g, '.')}{maxSuffix >= 0 ? `-${maxSuffix + 1}` : ''}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4">
              <span className="text-sm font-bold text-indigo-500">현재 편집 중</span>
              <strong className="text-xl text-[#000666]">{selectedExistingVersionName}</strong>
            </div>
          )}

          {/* 문서 입력 폼 */}
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

          {/* 메인 폼 컨트롤(저장/생성) 영역 */}
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

        {/* 섹션 3: 매니페스트 (서브버전) 상세 정보 입력 테이블 (새로 생성 중일 땐 미노출) */}
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
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">APP</th>
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">VERSION <span className="text-red-500">*</span></th>
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">IMAGE TAG <span className="text-red-500">*</span></th>
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
                      {/* APP (드래그 핸들 포함) */}
                      <td className="px-4 py-3 border-b border-slate-100 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <div
                            className="cursor-grab text-xs font-bold text-slate-400 hover:text-slate-600 p-1 select-none"
                            onMouseDown={() => enableDrag(index)} 
                            onMouseUp={() => disableDrag(index)} 
                            onMouseLeave={() => disableDrag(index)} 
                            title="드래그하여 순서 변경"
                          >
                            이동
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
                      {/* VERSION (Tag) */}
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
                      {/* IMAGE TAG (EXT일 경우 비활성화) */}
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
                      {/* NOTE */}
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
                      {/* STATUS (제어 드롭다운) */}
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
                      {/* 개별 행 저장 액션 버튼 (우측 고정) */}
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
                          {saving ? "저장중" : (row.dirty ? "저장 필요" : "저장 완료")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-slate-50/50 flex justify-center border-t border-slate-200">
                <button
                  type="button"
                  onClick={addRow}
                  className="py-2.5 px-6 flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all"
                >
                  <span>+</span> 빈 컴포넌트 행 추가
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
