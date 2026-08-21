import { useState, useRef, useEffect, useMemo, useCallback } from "react"; // React 훅 임포트
import {
  ChevronDownIcon // 드롭다운 화살표 아이콘
} from "../../components/ui/Icons"; // UI 아이콘 컴포넌트 임포트
import { AlertModal } from "../../components/ui/AlertModal"; // 경고 모달 컴포넌트 임포트
import { VersionDropdown } from "../../components/ui/VersionDropdown";
import { createMainVersion, deleteSubVersion, getMainVersionDetail, upsertSubVersion, updateMainVersion } from "../../services/api"; // API 호출 함수 임포트

// ==========================================
// [Utility & Constants] 
// 렌더링 시마다 불필요하게 다시 생성되지 않도록 컴포넌트 외부로 분리
// ==========================================

/**
 * 오늘 날짜를 YYYY-MM-DD 형식의 문자열로 반환하는 헬퍼 함수
 */
const getTodayDateString = () => {
  const today = new Date(); // 현재 날짜 객체 생성
  const yyyy = today.getFullYear(); // 연도 추출
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // 월 추출 (0부터 시작하므로 1 더함) 및 2자리 포맷팅
  const dd = String(today.getDate()).padStart(2, '0'); // 일 추출 및 2자리 포맷팅
  return `${yyyy}-${mm}-${dd}`; // 조립된 문자열 반환
};



// ==========================================
// [Main Component] 개발자 페이지 메인버전 등록/수정 컴포넌트
// ==========================================
/**
 * 메인 버전을 등록하거나 수정하는 폼 컴포넌트
 */
export const DeveloperVersionRegistrationSection = ({
  versions, // 전체 버전 목록
  setVersions, // 버전 목록 업데이트 함수
  setSelectedVersionName, // 선택된 버전명 업데이트 함수
  hasMore,
  loadingVersions,
  loadingMoreVersions,
  loadMoreVersions,
}) => {
  const dateInputRef = useRef(null); // 날짜 입력 필드에 접근하기 위한 ref 생성

  // ==========================================
  // 1. 상태(State) 선언부
  // ==========================================
  const [selectedDate, setSelectedDate] = useState(getTodayDateString()); // 사용자가 선택한 날짜 (기본값: 오늘)
  const [modeType, setModeType] = useState("new"); // "new" (신규 등록 모드) 또는 "edit" (수정 모드)
  const [editVersionMode, setEditVersionMode] = useState(""); // 수정 모드일 때 선택된 버전의 접미사 (예: "-1")

  const [rows, setRows] = useState([]); // 테이블에 렌더링될 서브버전 행 데이터 목록
  const [sqlScript, setSqlScript] = useState(""); // 입력된 SQL 스크립트 내용
  const [releaseNote, setReleaseNote] = useState(""); // 입력된 릴리즈 노트 내용
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("warning"); // 화면에 띄울 경고창 메시지


  const [saving, setSaving] = useState(false); // API 저장 중 여부를 나타내는 로딩 상태
  const [submitError, setSubmitError] = useState("");
  const [loadingBase, setLoadingBase] = useState(false); // 기본 데이터(베이스라인)를 불러오는 중인지 여부
  const [baseStatus, setBaseStatus] = useState(""); // 기본 데이터 로딩과 관련된 상태 메시지
  const [loadError, setLoadError] = useState(""); // 데이터 로딩 중 발생한 에러 메시지

  // ==========================================
  // 2. 파생 상태 및 데이터 가공 (Computed Data)
  // ==========================================

  // 현재 선택된 날짜에 해당하는 버전 목록만 필터링하여 최신순(내림차순)으로 정렬
  const availableVersions = useMemo(() => {
    if (!selectedDate) return []; // 선택된 날짜가 없으면 빈 배열 반환
    const prefix = selectedDate.replace(/-/g, '.');
    return versions.filter(v => v.versionName === prefix || v.versionName.startsWith(prefix + '-')) // 해당 날짜 접두사로 시작하는 버전만 필터링
      .sort((a, b) => {
        // 하이픈(-) 뒷부분의 숫자(접미사)를 파싱하여 내림차순 정렬
        const aSuf = parseInt(a.versionName.split('-')[1] || "1", 10);
        const bSuf = parseInt(b.versionName.split('-')[1] || "1", 10);
        return bSuf - aSuf; // 큰 번호가 먼저 오도록 정렬 (descending)
      });
  }, [selectedDate, versions]); // 선택된 날짜나 전체 버전 목록이 변경될 때만 재계산

  // 필터링된 버전 중 가장 높은 접미사(인덱스) 계산
  // [수정됨] 해당 날짜에 배포된 버전들 중 가장 높은 인덱스 번호를 계산
  // "2026.08.04" 오리지널 버전이 존재하면 0, "2026.08.04-1"이 존재하면 1 반환. 아예 없으면 -1 반환
  const maxSuffix = availableVersions.length > 0
    ? Math.max(...availableVersions.map(v => {
      if (v.versionName === selectedDate.replace(/-/g, '.')) return 0;
      const parts = v.versionName.split('-');
      return parts.length > 1 ? parseInt(parts[1], 10) : 0;
    }))
    : -1; // 해당 날짜에 등록된 버전이 없으면 0

  const initializedVersionRef = useRef(false);

  useEffect(() => {
    // 최초 목록 로딩 때만 최신 버전을 선택한다. 이후 목록 갱신이 사용자의 편집 대상이나
    // 신규 작성 모드를 임의로 덮어쓰지 않도록 ref로 초기화를 한 번만 허용한다.
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

  const handleSelectExistingVersion = (versionName) => {
    const [datePart, suffix = ""] = versionName.split('-');
    setSelectedDate(datePart.replace(/\./g, '-'));
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
    setSubmitError("");
    setLoadError("");
    setBaseStatus("");
  };

  // ==========================================
  // 3. 주요 로직 (데이터 로딩 및 테이블 조작)
  // ==========================================

  /**
   * 메인버전 상세 응답을 편집 가능한 행으로 변환한다.
   * originalValues/originalStatus는 화면 표시용 복사본이 아니라 변경 여부를 판정하는 기준점이다.
   */
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
        // code는 사용자가 수정할 수 있으므로 DELETE 식별자로 쓸 수 없다.
        // 서버가 발급한 불변 ID를 별도로 보관해 실제 저장 행만 삭제 API에 전달한다.
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

  /**
   * 모드(신규/수정) 전환 시, 이전 버전의 데이터를 바탕으로 폼(테이블, 텍스트박스 등)을 세팅하는 함수
   */
  const loadBaseline = useCallback(async () => {
    if (modeType === "edit" || editVersionMode) {
      setLoadingBase(true);
      setBaseStatus("버전 정보 로딩 중...");
      setLoadError("");
      try {
        const prefix = selectedDate.replace(/-/g, '.');
        // [수정됨] editVersionMode가 "" 이면 오리지널 버전(ex: 2026.08.04)을 타겟으로 API 조회 (404 버그 해결)
        const targetVersionName = editVersionMode ? `${prefix}-${editVersionMode}` : prefix;

        const detail = await getMainVersionDetail(targetVersionName);

        if (modeType === "new") {
          setRows(buildRowsFromDetail(detail, true, true));
          setSqlScript("");
          setReleaseNote("");
          setBaseStatus(`이전 버전(${targetVersionName})을 기반으로 새 버전을 작성합니다.`);
        } else {
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
        setBaseStatus("");
      } finally {
        setLoadingBase(false);
      }
    }
  }, [selectedDate, modeType, editVersionMode]);

  useEffect(() => {
    if (modeType === "edit" && versions.length > 0) loadBaseline();
  }, [modeType, versions.length, loadBaseline]);

  const handleRefreshAppInfo = () => {
    // 여러 개발자가 같은 버전을 편집할 수 있어 서버 값을 다시 읽되,
    // 로컬의 미저장 변경을 조용히 잃지 않도록 명시적인 확인을 거친다.
    if (rows.some((row) => row.dirty)
      && !window.confirm("저장하지 않은 APP 정보가 있습니다. 서버의 최신 정보로 새로고침하시겠습니까?")) {
      return;
    }
    loadBaseline();
  };

  // ==========================================
  // 4. 테이블 행 드래그 앤 드롭 로직
  // ==========================================
  const [draggedIndex, setDraggedIndex] = useState(null); // 현재 드래그 중인 행의 인덱스를 저장하는 상태
  const trRefs = useRef([]); // 테이블 행(<tr>)의 DOM 요소에 접근하기 위한 refs 배열

  /**
   * 드래그가 시작될 때 호출되는 핸들러. 
   * 드래그 중인 항목의 인덱스를 상태에 저장하고 브라우저 이펙트를 'move'로 설정함.
   */
  const handleDragStart = (e, index) => {
    setDraggedIndex(index); // 드래그하는 아이템의 인덱스 기록
    e.dataTransfer.effectAllowed = "move"; // 마우스 커서를 이동 모양으로 설정
  };

  /**
   * 드래그 중인 항목이 다른 항목 위에 있을 때 호출되는 핸들러.
   * 기본 브라우저 동작을 막아야 drop 이벤트가 발생할 수 있음.
   */
  const handleDragOver = (e, index) => {
    e.preventDefault(); // 기본 이벤트 방지하여 drop 허용
  };

  /**
   * 드래그한 항목을 놓았을 때 호출되는 핸들러.
   * 항목들의 순서를 교체하고 rows 상태를 업데이트함.
   */
  const handleDrop = (e, targetIndex) => {
    e.preventDefault(); // 기본 이벤트 방지
    // 드래그 인덱스가 유효하지 않거나 제자리에 놓은 경우엔 무시
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newRows = [...rows]; // 원본 배열 복사 (불변성 유지)
    const draggedItem = newRows[draggedIndex]; // 드래그된 아이템 객체 백업
    newRows.splice(draggedIndex, 1); // 배열에서 드래그된 아이템 제거
    newRows.splice(targetIndex, 0, draggedItem); // 타겟 위치에 아이템 삽입하여 순서 변경
    // 이동한 행 외에도 밀려난 행의 sortOrder가 바뀌므로 전체 행을 원본 순서와 다시 비교한다.
    setRows(newRows.map((row, index) => {
      const dirty = isRowChanged(row, index);
      return {
        ...row,
        dirty,
        status: row.originalStatus === "unchanged"
          ? (dirty ? "updated" : "unchanged")
          : row.status,
      };
    })); // 순서가 원래와 달라진 행만 변경 상태로 표시
    setDraggedIndex(null); // 드래그 인덱스 초기화
  };

  /**
   * 드래그 핸들을 마우스로 눌렀을 때 해당 행을 드래그 가능(draggable=true)하게 활성화.
   */
  const enableDrag = (index) => {
    if (trRefs.current[index]) {
      trRefs.current[index].draggable = true; // HTML5 드래그 앤 드롭 활성화
    }
  }

  /**
   * 마우스 클릭을 떼거나 벗어났을 때 해당 행의 드래그를 다시 비활성화.
   * 텍스트 입력창 등에서 텍스트 드래그와 충돌하는 것을 방지하기 위함.
   */
  const disableDrag = (index) => {
    if (trRefs.current[index]) {
      trRefs.current[index].draggable = false; // HTML5 드래그 앤 드롭 비활성화
    }
  }

  const isRowChanged = (row, currentIndex) => {
    // 입력 필드뿐 아니라 드래그로 바뀐 순서도 서버에 저장되는 값이므로 변경으로 취급한다.
    // 원본과 다시 같아지면 false가 되어 UPDATED 상태도 UNCHANGED로 복원될 수 있다.
    if (!row.originalValues) return true;
    return row.subVersion !== row.originalValues.subVersion
      || row.component !== row.originalValues.component
      || row.tag !== row.originalValues.tag
      || row.note !== row.originalValues.note
      || currentIndex !== row.originalValues.sortOrder;
  };

  /**
   * 각 테이블 셀의 입력값이 변경될 때 rows 상태를 업데이트하는 핸들러
   */
  const handleRowChange = (index, field, value) => {
    const newRows = [...rows]; // 배열 복사
    const nextRow = { ...newRows[index], [field]: value };
    if (field !== "status") {
      // EXT는 외부 산출물이라 IMAGE TAG를 갖지 않는다는 API 계약을 입력 단계에서도 강제한다.
      if (field === "subVersion" && value.trim().toUpperCase() === "EXT") {
        nextRow.component = "";
      }
      nextRow.dirty = isRowChanged(nextRow, index);
      // 서버에서 UNCHANGED였던 행만 자동 상태 전환 대상으로 삼는다.
      // 이미 PENDING/UPDATED인 서버 상태는 단순 입력만으로 되돌리지 않는다.
      if (nextRow.originalStatus === "unchanged") {
        nextRow.status = nextRow.dirty ? "updated" : "unchanged";
      }
    }
    newRows[index] = nextRow;
    setRows(newRows); // 상태 업데이트
  };

  /**
   * 새로운 빈 서브버전 행을 테이블의 맨 아래에 추가하는 함수
   */
  const addRow = () => {
    setRows([...rows, {
      id: `custom_${Date.now()}`, // 고유 ID 발급
      subVersion: "NEW", // 기본값
      component: "", // IMAGE TAG는 선택 입력
      tag: "", // 빈 태그
      note: "", // 빈 노트
      status: "updated", // 기본 상태
      originalStatus: null,
      originalValues: null,
      desc: "Custom Component", // 커스텀 항목 설명
      dirty: true,
    }]);
  };

  /**
   * 특정 행을 삭제하는 함수
   */
  const removeRow = async (index) => {
    const row = rows[index];
    if (window.confirm(`[${row.subVersion}] 컴포넌트를 삭제하시겠습니까?\n(서버에 저장된 경우 DB에서도 삭제됩니다.)`)) {
      // 아직 저장하지 않은 새 행은 로컬에서만 제거하고, 서버 ID가 있는 행만 실제 DELETE 한다.
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

  /**
   * 메인버전 컨테이너를 먼저 생성한다. APP별 데이터는 생성 후 각 행의 저장 API로 별도 등록한다.
   */
  const handleRegisterMainVersion = async () => {
    const prefix = selectedDate.replace(/-/g, '.');
    const targetVersionName = maxSuffix >= 0 ? `${prefix}-${maxSuffix + 1}` : prefix;
    setSaving(true);
    setSubmitError("");

    try {
      // 1. 백엔드에 신규 메인 버전 등록 API 호출
      await createMainVersion(targetVersionName, {
        releaseNote: releaseNote || undefined,
        sqlScript: sqlScript || undefined,
      });

      // 2. 컨텍스트의 버전 목록 상태 갱신
      const newSummary = {
        versionName: targetVersionName,
        subVersionCount: 0,
        componentCount: 0,
        lastJob: null,
      };
      setVersions([newSummary, ...versions]);
      setSelectedVersionName(targetVersionName);

      // 3. 모드를 '수정' 모드로 변경하여 매니페스트 편집 활성화 (loadBaseline 자동 실행)
      setModeType("edit");
      setEditVersionMode(maxSuffix >= 0 ? (maxSuffix + 1).toString() : '');

      setAlertType("success"); setAlertMessage(`신규 메인버전(${targetVersionName})이 등록되었습니다. 아래에서 매니페스트 상세 정보를 작성 후 각각 저장해주세요.`);
    } catch (error) {
      if (error.status !== 409) {
        const message = error.payload?.message || error.message || "메인버전 등록 중 오류가 발생했습니다.";
        setSubmitError(message);
        setAlertType("warning"); setAlertMessage(message);
      } else {
        // 이미 등록된 경우 모드만 변경
        setModeType("edit");
        setEditVersionMode(maxSuffix >= 0 ? (maxSuffix + 1).toString() : '');
        setAlertType("warning"); setAlertMessage("이미 등록된 버전입니다. 수정 모드로 전환되었습니다.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // 5. 폼 제출 로직 (Submit)
  // ==========================================

  /**
   * 단건 서브버전을 저장한다. 메인버전 문서(SQL/Release Note) 저장과 API 책임이 분리되어 있다.
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

    // 변경 데이터가 UNCHANGED로 저장되어 배포 비교에서 누락되는 모순을 프론트에서도 차단한다.
    if (row.dirty && desiredStatus === "UNCHANGED") {
      setAlertType("warning");
      setAlertMessage("APP 정보가 변경되었습니다. STATUS를 UPDATED 또는 PENDING으로 선택해주세요.");
      return;
    }

    const payload = {
      code: row.subVersion,
      version: row.tag,
      sortOrder: index,
      submitStatus: desiredStatus, // 상태도 함께 전송
    };

    const finalNote = row.note ? row.note.trim() : "";
    // NOTE는 선택 필드다. 빈 값은 필드를 생략해 선택값이라는 API 계약을 유지한다.
    if (finalNote !== "") {
      payload.note = finalNote;
    }

    // EXT는 IMAGE TAG가 없는 APP이므로 명시적으로 빈 배열을 전송한다.
    if (row.subVersion.trim().toUpperCase() === "EXT") {
      payload.imageTags = [];
    } else if (row.component) {
      payload.imageTags = row.component.split('\n').map(t => t.trim()).filter(Boolean);
    }

    setSaving(true);
    setSubmitError("");
    try {
      // 단건 서브버전 저장 API 호출
      await upsertSubVersion(targetVersionName, row.subVersion, payload);

      setAlertType("warning"); setAlertMessage(`${row.subVersion} 컴포넌트 정보가 저장되었습니다.`);

      // 최신 데이터를 다시 불러와서 테이블 갱신
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
    const targetVersionName = editVersionMode ? `${prefix}-${editVersionMode}` : prefix;

    setSaving(true);
    setSubmitError("");
    try {
      // 빈 문자열도 그대로 보내 사용자가 기존 SQL/Release Note를 지우는 동작을 지원한다.
      await updateMainVersion(targetVersionName, {
        releaseNote,
        sqlScript,
      });
      setAlertType("success");
      setAlertMessage(`메인버전 ${targetVersionName}의 SQL과 Release Note가 수정되었습니다.`);
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
      {/* 헤더 섹션: 타이틀 및 설명 */}
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

      {/* 메인 편집 영역 */}
      <div className="flex flex-col gap-8">

        {/* 섹션 1: 메인버전 정보 설정 */}
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
          </div>

          {/* 입력 폼 리셋 및 새로고침 버튼 영역 대신 신규 등록 버튼 표시 */}
          {modeType === "new" && (
            <div className="flex justify-end pt-2 border-t border-slate-100 gap-3">
              <button
                type="button"
                onClick={handleRegisterMainVersion} // 신규 등록 핸들러
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

        {/* 섹션 3: 매니페스트 (서브버전) 상세 정보 입력 테이블 */}
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
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                title="선택한 메인버전의 최신 APP 정보를 서버에서 다시 불러옵니다."
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
                {/* 테이블 헤더 */}
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">APP</th>
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">VERSION <span className="text-red-500">*</span></th>
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">IMAGE TAG <span className="text-red-500">*</span></th>
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">NOTE</th>
                    <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider">STATUS</th>
                    <th className="sticky right-0 z-10 bg-slate-50 px-4 py-3.5 text-right text-sm font-bold text-slate-500 uppercase tracking-wider shadow-[-1px_0_0_#e2e8f0]"></th>
                  </tr>
                </thead>
                {/* 테이블 바디 (서브버전 행 매핑) */}
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => (
                    <tr
                      key={row.id} // 고유 식별자
                      className="hover:bg-slate-50/50 transition-colors group"
                      ref={el => trRefs.current[index] = el} // 드래그 제어를 위해 DOM ref 연결
                      onDragStart={(e) => handleDragStart(e, index)} // 드래그 시작 이벤트
                      onDragOver={(e) => handleDragOver(e, index)} // 드래그 오버(드롭 허용) 이벤트
                      onDrop={(e) => handleDrop(e, index)} // 드롭(순서 변경) 이벤트
                    >
                      {/* APP 열: 앱 코드 입력 및 드래그/삭제 기능 */}
                      <td className="px-4 py-3 border-b border-slate-100 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          {/* 이동 텍스트를 잡을 때만 행 드래그를 활성화합니다. */}
                          <div
                            className="cursor-grab text-xs font-bold text-slate-400 hover:text-slate-600 p-1 select-none"
                            onMouseDown={() => enableDrag(index)} // 마우스 누를 때 드래그 활성화
                            onMouseUp={() => disableDrag(index)} // 뗄 때 비활성화
                            onMouseLeave={() => disableDrag(index)} // 영역 벗어날 때 비활성화 (버그 방지)
                            title="드래그하여 순서 변경"
                          >
                            이동
                          </div>
                          <div className="relative flex-1">
                            <input
                              type="text"
                              required
                              value={row.subVersion} // 서브버전(앱) 코드
                              onChange={(e) => handleRowChange(index, "subVersion", e.target.value)}
                              className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-3.5 pr-12 text-sm font-bold text-[#1a237e] focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all uppercase"
                            />
                            {/* 행 삭제 버튼 */}
                            <button
                              type="button"
                              onClick={() => removeRow(index)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-red-500 font-bold"
                              title="항목 삭제"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </td>
                      {/* VERSION 열: 버전 태그 입력 */}
                      <td className="px-4 py-3 border-b border-slate-100">
                        <input
                          type="text"
                          required
                          value={row.tag} // 버전명 (예: v1.2.3)
                          onChange={(e) => handleRowChange(index, "tag", e.target.value)}
                          placeholder="예: v1.0.0"
                          className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-bold text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all"
                        />
                      </td>
                      {/* IMAGE TAG 열: 도커 이미지 정보 입력 */}
                      <td className="px-4 py-3 border-b border-slate-100">
                        <textarea
                          disabled={row.subVersion.trim().toUpperCase() === "EXT"}
                          value={row.component} // 컴포넌트 정보 및 이미지 태그들
                          onChange={(e) => handleRowChange(index, "component", e.target.value)}
                          placeholder={row.subVersion.trim().toUpperCase() === "EXT" ? "IMAGE TAG 없음" : "예: myapp-api:v2.0.27"}
                          rows={2} // 멀티라인 지원 (CC의 경우 API/FE 두 줄)
                          className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all font-mono resize-y min-h-[42px] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        />
                      </td>
                      {/* NOTE 열: 해당 컴포넌트의 변경 사항 기록 */}
                      <td className="px-4 py-3 border-b border-slate-100">
                        <textarea
                          value={row.note} // 기록 텍스트
                          onChange={(e) => handleRowChange(index, "note", e.target.value)}
                          onKeyDown={(e) => {
                            // Shift 없이 Enter를 누르면 엔터키의 기본 동작(폼 제출)을 막음 (줄바꿈만 허용하기 위함이 아니라 텍스트박스 내부의 의도치 않은 폼제출 방지)
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                            }
                          }}
                          placeholder="변경 사항 기록 (Shift+Enter 줄바꿈)"
                          rows={2} // 멀티라인 지원
                          className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all resize-y min-h-[42px]"
                        />
                      </td>
                      {/* 상태 열: 배포 대기(pending), 업데이트(updated), 변동없음(unchanged) 선택 */}
                      <td className="px-4 py-3 border-b border-slate-100">
                        <div className="relative w-full">
                          <select
                            value={row.status} // 현재 상태값
                            onChange={(e) => handleRowChange(index, "status", e.target.value)}
                            className={`w-full appearance-none rounded-md border border-slate-200 py-2.5 pl-3.5 pr-8 text-sm font-bold outline-none transition-all ${row.status === "updated" ? "bg-[#0006661a] text-[#000666]" : // 파란색 강조 (updated)
                              row.status === "pending" ? "bg-[#ffdbd0] text-[#7b2e12]" : // 붉은색 강조 (pending)
                                "bg-slate-100 text-slate-500" // 회색 (unchanged)
                              }`}
                          >
                            <option value="updated" className="bg-white text-[#000666] font-bold">UPDATED</option>
                            <option value="pending" className="bg-white text-[#7b2e12] font-bold">PENDING</option>
                            <option value="unchanged" disabled={row.dirty} className="bg-white text-slate-500 font-bold">UNCHANGED</option>
                          </select>
                          <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </td>
                      {/* 저장 버튼은 입력 필드와 분리하여 행의 가장 오른쪽에 고정 배치 */}
                      <td className="sticky right-0 z-10 border-b border-slate-100 bg-white px-4 py-3 text-right shadow-[-1px_0_0_#e2e8f0] group-hover:bg-slate-50">
                        {modeType === "edit" && (
                          <button
                            type="button"
                            onClick={() => handleSaveRow(index)} // 서브버전 단건 저장 핸들러
                            disabled={saving}
                            className="whitespace-nowrap px-3 py-2 text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-md transition-all shadow-sm active:scale-95 disabled:opacity-50"
                          >
                            저장
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 테이블 하단 서브버전 추가 버튼 */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
              <button
                type="button"
                onClick={addRow} // 새 행 추가 핸들러
                className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 hover:border-[#000666] hover:text-[#000666] text-slate-600 font-bold rounded-lg shadow-sm transition-all"
              >
                <span className="text-xl leading-none">+</span>
                <span>빈 서브버전 항목 추가하기</span>
              </button>
            </div>
          </section>
        )}

        {/* 제출 에러 발생 시 경고 메시지 영역 */}
        {submitError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
            {submitError}
          </div>
        )}


      </div>

      {/* 전역적으로 사용되는 알림창 컴포넌트 */}
      <AlertModal
        isOpen={!!alertMessage}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertMessage("")}
      />
    </div>
  );
};
