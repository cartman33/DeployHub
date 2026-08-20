import { useState, useRef, useEffect, useMemo, useCallback } from "react"; // React 훅 임포트
import { 
  CheckCircleIcon,  // 체크 아이콘
  ListIcon, // 리스트 아이콘
  CodeIcon, // 코드 아이콘
  RocketIcon, // 로켓 아이콘 (배포 관련)
  ChevronDownIcon // 드롭다운 화살표 아이콘
} from "../../components/ui/Icons"; // UI 아이콘 컴포넌트 임포트
import { AlertModal } from "../../components/ui/AlertModal"; // 경고 모달 컴포넌트 임포트
import { createMainVersion, getMainVersionDetail, upsertSubVersion, updateMainVersion } from "../../services/api"; // API 호출 함수 임포트

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
  setActiveNavigation // 활성화된 내비게이션 탭 설정 함수
}) => {
  const dateInputRef = useRef(null); // 날짜 입력 필드에 접근하기 위한 ref 생성

  // ==========================================
  // 1. 상태(State) 선언부
  // ==========================================
  const [selectedDate, setSelectedDate] = useState(getTodayDateString()); // 사용자가 선택한 날짜 (기본값: 오늘)
  const [modeType, setModeType] = useState("new"); // "new" (신규 등록 모드) 또는 "edit" (수정 모드)
  const [editVersionMode, setEditVersionMode] = useState(""); // 수정 모드일 때 선택된 버전의 접미사 (예: "-1")
  const [submittedModeType, setSubmittedModeType] = useState("new"); // 제출 완료 시 성공 모달에서 보여줄 모드 타입
  
  const [rows, setRows] = useState([]); // 테이블에 렌더링될 서브버전 행 데이터 목록
  const [sqlScript, setSqlScript] = useState(""); // 입력된 SQL 스크립트 내용
  const [releaseNote, setReleaseNote] = useState(""); // 입력된 릴리즈 노트 내용
  const [alertMessage, setAlertMessage] = useState("");
    const [alertType, setAlertType] = useState("warning"); // 화면에 띄울 경고창 메시지

  const [showSuccessModal, setShowSuccessModal] = useState(false); // 성공 모달 표시 여부 플래그
  const [registeredVersionName, setRegisteredVersionName] = useState(""); // 방금 등록/수정 완료된 버전의 이름
  
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

  // 선택된 날짜에 버전이 존재하는지에 따라 폼 모드를 자동 전환하는 사이드 이펙트
  useEffect(() => {
    if (availableVersions.length > 0) {
      // 이미 해당 날짜에 등록된 버전이 있으면 자동으로 "수정" 모드로 전환
      setModeType("edit");
      const vName = availableVersions[0].versionName;
      setEditVersionMode(vName.includes('-') ? vName.split('-')[1] : ""); // 가장 최근 버전을 수정 대상으로 선택
    } else {
      // 해당 날짜에 등록된 버전이 없으면 "신규 등록" 모드로 설정
      setModeType("new");
      setEditVersionMode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // 주의: availableVersions 배열 전체를 의존성으로 넣으면 얕은 비교로 인해 무한 루프가 발생할 수 있음.
    // 따라서 배열의 길이(availableVersions.length)만을 의존성으로 지정하여 변경 감지의 프록시로 사용함.
  }, [selectedDate, availableVersions.length]);

  // ==========================================
  // 3. 주요 로직 (데이터 로딩 및 테이블 조작)
  // ==========================================

  /**
   * 백엔드 응답(JSON)을 테이블 형태(rows)로 변환하는 핵심 유틸리티 함수.
   * CC 컴포넌트의 특수 처리(API와 FE 통합), 담당자/노트 파싱, 상태 매핑 등의 복잡한 로직을 수행함.
   */
  const buildRowsFromDetail = (detailData, forcePending, clearNotes) => {
    if (!detailData || !detailData.subVersions || !detailData.subVersions.length) return [];
    return detailData.subVersions.map((sub, index) => {
      let pureNote = sub.note || "";
      if (clearNotes) pureNote = "";
      const existingStatus = sub.submitStatus || "UNCHANGED";
      const statusValue = forcePending 
        ? "pending" 
        : (existingStatus.toLowerCase() === "updated" ? "update" : existingStatus.toLowerCase() === "pending" ? "pending" : "unchanged");
      return {
        id: `row_${sub.code || index}_${Date.now()}`,
        subVersion: sub.code || "",
        component: sub.components?.length > 0 ? sub.components.map(c => c.imageTag).join('\n') : sub.code,
        tag: sub.version || "",
        note: pureNote,
        status: statusValue,
        desc: sub.code || "Custom Component"
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
    // [수정됨] editVersionMode가 빈 문자열("")일 때(즉, 오리지널 버전 선택시) falsy 취급되어 API 호출이 스킵되는 버그 수정
      if (modeType === "new" || editVersionMode !== null) {
      loadBaseline(); 
    }
  }, [modeType, editVersionMode, availableVersions.length, versions.length, loadBaseline]);

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
    setRows(newRows); // 변경된 배열로 상태 업데이트
    setDraggedIndex(null); // 드래그 인덱스 초기화
  };

  /**
   * 드래그 핸들(☰)을 마우스로 눌렀을 때 해당 행을 드래그 가능(draggable=true)하게 활성화.
   */
  const enableDrag = (index) => {
    if(trRefs.current[index]) {
      trRefs.current[index].draggable = true; // HTML5 드래그 앤 드롭 활성화
    }
  }

  /**
   * 마우스 클릭을 떼거나 벗어났을 때 해당 행의 드래그를 다시 비활성화.
   * 텍스트 입력창 등에서 텍스트 드래그와 충돌하는 것을 방지하기 위함.
   */
  const disableDrag = (index) => {
    if(trRefs.current[index]) {
      trRefs.current[index].draggable = false; // HTML5 드래그 앤 드롭 비활성화
    }
  }

  /**
   * 각 테이블 셀의 입력값이 변경될 때 rows 상태를 업데이트하는 핸들러
   */
  const handleRowChange = (index, field, value) => {
    const newRows = [...rows]; // 배열 복사
    newRows[index][field] = value; // 지정된 인덱스와 필드에 새로운 값 대입
    setRows(newRows); // 상태 업데이트
  };

  /**
   * 새로운 빈 서브버전 행을 테이블의 맨 아래에 추가하는 함수
   */
  const addRow = () => {
    setRows([...rows, {
      id: `custom_${Date.now()}`, // 고유 ID 발급
      subVersion: "NEW", // 기본값
      component: "new-component", // 기본값
      tag: "", // 빈 태그
      note: "", // 빈 노트
      status: "update", // 기본 상태
      desc: "Custom Component" // 커스텀 항목 설명
    }]);
  };

  /**
   * 특정 행을 삭제하는 함수
   */
  const removeRow = async (index) => {
    const row = rows[index];
    if (window.confirm(`[${row.subVersion}] 컴포넌트를 삭제하시겠습니까?\n(서버에 저장된 경우 DB에서도 삭제됩니다.)`)) {
      if (row.id && row.id.startsWith("row_extra_")) {
        const realId = row.id.split("_")[2];
        if (realId && !isNaN(Number(realId))) {
          setSaving(true);
          try {
            await deleteSubVersion(realId);
          } catch (err) {
            setSaving(false);
            const msg = err.payload?.message || err.message || "서브버전 삭제 중 오류가 발생했습니다.";
            alert(msg);
            return;
          }
          setSaving(false);
        }
      }
      const newRows = [...rows];
      newRows.splice(index, 1);
      setRows(newRows);
    }
  };

  /**
   * 신규 메인버전을 등록하고, 가장 최신의 매니페스트 데이터를 불러와 폼을 세팅하는 핸들러 (분리된 API 흐름)
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
   * 단건 서브버전을 저장(Upsert)하는 핸들러
   */
  const handleSaveRow = async (index) => {
    const row = rows[index];
    if (!row.tag) {
      setAlertType("warning"); setAlertMessage("버전(VERSION) 태그를 입력해야 저장할 수 있습니다.");
      return;
    }

    const prefix = selectedDate.replace(/-/g, '.');
    const targetVersionName = (editVersionMode ? `${prefix}-${editVersionMode}` : prefix);

    const desiredStatus = (row.status === "update") ? "UPDATED" : (row.status === "pending") ? "PENDING" : "UNCHANGED";

    const payload = {
      code: row.subVersion,
      version: row.tag,
      sortOrder: index,
      submitStatus: desiredStatus, // 상태도 함께 전송
    };

    const finalNote = row.note ? row.note.trim() : "";
    if (finalNote !== "") {
      payload.note = finalNote;
    }

    if (row.component) {
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

  const handleSubmit = async (e) => {
    e.preventDefault(); // 기본 폼 제출(페이지 새로고침) 동작 방지

    const prefix = selectedDate.replace(/-/g, '.'); // 버전 접두어 (YYYY.MM.DD)
    // 등록할 또는 수정할 타겟 버전 이름 생성
    const targetVersionName = modeType === "new" 
        ? (maxSuffix >= 0 ? `${prefix}-${maxSuffix + 1}` : prefix) 
        : (editVersionMode ? `${prefix}-${editVersionMode}` : prefix);

    setSaving(true); // 저장 로딩 상태 시작
    setSubmitError(""); // 이전 제출 에러 초기화

    try {
      if (modeType === "new") {
        try {
          // 신규 버전 생성 API 호출
          await createMainVersion(targetVersionName, {
            releaseNote: releaseNote || undefined,
            sqlScript: sqlScript || undefined,
          });
        } catch (error) {
          // 409(Conflict) 에러는 이미 버전이 생성되었음을 의미하므로 무시하고 진행
          if (error.status !== 409) {
            throw error; // 다른 에러는 그대로 던짐
          }
        }
      } else {
        // 기존 버전 수정 API 호출
        await updateMainVersion(targetVersionName, {
          releaseNote: releaseNote || undefined,
          sqlScript: sqlScript || undefined,
        });
      }

      // 상위 컴포넌트의 versions 목록 상태 갱신
      const exists = versions.some(v => v.versionName === targetVersionName); // 목록에 이미 존재하는지 확인
      
      if (!exists) {
        const newSummary = {
          versionName: targetVersionName,
          subVersionCount: 0,
          componentCount: 0,
          lastJob: null, // 최신 작업 내역 초기화
        };
        setVersions([newSummary, ...versions]); // 없으면 맨 앞에 추가
      }

      setSelectedVersionName(targetVersionName); // 컨텍스트의 선택된 버전 업데이트
      setRegisteredVersionName(targetVersionName); // 성공 모달에 표시될 버전명 기록
      setSubmittedModeType(modeType); // 성공 모달에 표시될 텍스트 모드 기록
      setShowSuccessModal(true); // 성공 모달 표시

      if (modeType === "new") {
        // 신규 등록이었다면, 다음 수정을 위해 모드를 'edit'으로 변경하고 인덱스를 올림
        setModeType("edit");
        setEditVersionMode(maxSuffix >= 0 ? (maxSuffix + 1).toString() : '');
      }
    } catch (error) {
      // 에러 처리: 화면 하단이나 모달로 에러 메시지 표시
      const message = error.payload?.message || error.message || "메인버전 등록/수정 중 오류가 발생했습니다.";
      setSubmitError(message);
      setAlertType("warning"); setAlertMessage(message);
    } finally {
      setSaving(false); // 저장 로딩 상태 해제
    }
  };

  /**
   * 성공 모달에서 '배포 파이프라인으로 이동' 버튼 클릭 시의 동작
   */
  const handleGoToDeployer = () => {
    setShowSuccessModal(false); // 성공 모달 닫기
    setActiveNavigation("deployer"); // 전역 네비게이션을 'deployer'(배포자 탭)으로 전환
  };

  // ==========================================
  // 6. UI 렌더링 (JSX)
  // ==========================================
  return (
    <div className="w-full max-w-[1920px] mx-auto p-8 flex flex-col gap-8">
      {/* 헤더 섹션: 타이틀 및 설명 */}
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

      {/* 메인 폼 래퍼 */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        
        {/* 섹션 1: 메인버전 정보 설정 */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b pb-4 border-slate-100">
            <ListIcon className="w-5 h-5 text-[#000666]" />
            <h2 className="text-2xl font-bold text-slate-800">메인버전 정보 설정</h2>
          </div>

          

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 날짜 선택 입력부 */}
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
                  value={selectedDate} // 현재 선택된 날짜 상태 바인딩
                  onChange={(e) => setSelectedDate(e.target.value)} // 날짜 변경 핸들러
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3.5 px-4 text-lg font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all cursor-pointer"
                />
              </div>
            </div>

            {/* 작업 모드 (신규/수정) 선택 및 버전 번호 지정부 */}
            <div className="flex flex-col gap-2">
              <label className="text-base font-bold text-slate-500 uppercase tracking-wider">
                작업 모드 선택 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3 items-center">
                {/* 모드 선택 드롭다운 */}
                <div className="relative w-40">
                  <select
                    value={modeType}
                    onChange={(e) => {
                      setModeType(e.target.value); // 신규 또는 수정 모드로 변경
                      // 수정 모드로 변경 시 선택된 버전이 없으면 가장 최신 버전을 기본 선택
                      if (e.target.value === "edit" && !editVersionMode && availableVersions.length > 0) {
                        setEditVersionMode(maxSuffix > 0 ? maxSuffix.toString() : '');
                      }
                    }}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-10 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all cursor-pointer"
                  >
                    <option value="new">신규 등록</option>
                    <option value="edit" disabled={availableVersions.length === 0}>버전 수정</option> {/* 버전이 없을 땐 수정 불가 */}
                  </select>
                  <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
                
                <div className="flex-1">
                  {modeType === "new" ? (
                    // 신규 모드일 땐 앞으로 등록될 버전을 계산해서 보여줌 (읽기 전용 표시)
                    <div className="w-full rounded-lg border border-indigo-200 bg-indigo-50 py-3.5 px-4 text-lg font-bold text-indigo-700 text-center">
                      등록될 버전명: {selectedDate.replace(/-/g, '.')}{maxSuffix >= 0 ? `-${maxSuffix + 1}` : ''}
                    </div>
                  ) : (
                    // 수정 모드일 땐 수정할 대상을 선택할 수 있는 드롭다운 렌더링
                    <div className="relative w-full">
                      <select
                        value={editVersionMode} // 선택된 수정 버전 번호
                        onChange={(e) => setEditVersionMode(e.target.value)} // 대상 변경 핸들러
                        className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-10 text-lg font-medium text-slate-700 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all cursor-pointer"
                      >
                        {/* 해당 날짜의 가능한 버전들 매핑 */}
                        {availableVersions.map(v => {
                            const suf = v.versionName.includes('-') ? v.versionName.split('-')[1] : '';
                            return <option key={suf || 'default'} value={suf}>{v.versionName}</option>;
                          })}
                      </select>
                      <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                  )}
                </div>
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
                {saving ? "처리 중..." : "신규 등록"}
              </button>
            </div>
          )}
        </section>

        {/* 섹션 2: SQL 및 릴리즈 노트 입력 영역 */}
        {modeType !== "new" && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b pb-4 border-slate-100">
            <ListIcon className="w-5 h-5 text-[#000666]" />
            <h2 className="text-2xl font-bold text-slate-800">SQL / Release Note</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-base font-bold text-slate-500 uppercase tracking-wider">SQL Script</label>
              {/* SQL 스크립트 입력 텍스트에리어 */}
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
              {/* 릴리즈 노트 입력 텍스트에리어 */}
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
        )}

        {/* 섹션 3: 매니페스트 (서브버전) 상세 정보 입력 테이블 */}
        {modeType !== "new" && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <RocketIcon className="w-5 h-5 text-[#000666]" />
              <h2 className="text-2xl font-bold text-slate-800">매니페스트 상세 입력</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1250px]">
              {/* 테이블 헤더 */}
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider w-[15%]">APP</th>
                  <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider w-[15%]">VERSION <span className="text-red-500">*</span></th>
                  <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider w-[23%]">IMAGE TAG <span className="text-red-500">*</span></th>
                  <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider w-[25%]">NOTE</th>
                  <th className="px-4 py-3.5 text-sm font-bold text-slate-500 uppercase tracking-wider w-[12%]">상태</th>
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
                        {/* 햄버거 아이콘: 이 부분을 드래그해야만 행 이동이 가능함 */}
                        <div 
                           className="cursor-grab text-slate-300 hover:text-slate-500 p-1 select-none"
                           onMouseDown={() => enableDrag(index)} // 마우스 누를 때 드래그 활성화
                           onMouseUp={() => disableDrag(index)} // 뗄 때 비활성화
                           onMouseLeave={() => disableDrag(index)} // 영역 벗어날 때 비활성화 (버그 방지)
                           title="드래그하여 순서 변경"
                        >
                          ☰
                        </div>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            required
                            value={row.subVersion} // 서브버전(앱) 코드
                            onChange={(e) => handleRowChange(index, "subVersion", e.target.value)}
                            className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm font-bold text-[#1a237e] focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all uppercase"
                          />
                          {/* 행 삭제 버튼 (x 표시) */}
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
                        required
                        value={row.component} // 컴포넌트 정보 및 이미지 태그들
                        onChange={(e) => handleRowChange(index, "component", e.target.value)}
                        placeholder="예: myapp-api:v2.0.27"
                        rows={2} // 멀티라인 지원 (CC의 경우 API/FE 두 줄)
                        className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all font-mono resize-y min-h-[42px]"
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
                    {/* 상태 열: 배포 대기(pending), 업데이트(update), 변동없음(unchanged) 선택 및 저장 버튼 */}
                    <td className="px-4 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <select
                            value={row.status} // 현재 상태값
                            onChange={(e) => handleRowChange(index, "status", e.target.value)}
                            className={`w-full appearance-none rounded-md border border-slate-200 py-2.5 pl-3.5 pr-8 text-sm font-bold outline-none transition-all ${
                              row.status === "update" ? "bg-[#0006661a] text-[#000666]" : // 파란색 강조 (update)
                              row.status === "pending" ? "bg-[#ffdbd0] text-[#7b2e12]" : // 붉은색 강조 (pending)
                              "bg-slate-100 text-slate-500" // 회색 (unchanged)
                            }`}
                          >
                            <option value="update" className="bg-white text-[#000666] font-bold">update</option>
                            <option value="pending" className="bg-white text-[#7b2e12] font-bold">pending</option>
                            <option value="unchanged" className="bg-white text-slate-500 font-bold">unchanged</option>
                          </select>
                          <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                        {modeType === "edit" && (
                          <button
                            type="button"
                            onClick={() => handleSaveRow(index)} // 서브버전 단건 저장 핸들러
                            disabled={saving}
                            className="shrink-0 px-3 py-2 text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-md transition-all shadow-sm active:scale-95 disabled:opacity-50"
                          >
                            저장
                          </button>
                        )}
                      </div>
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
        
        
      </form>

      {/* 완료 모달: 등록 성공 후 보여지는 오버레이 화면.
          참고: 추후 재사용 가능한 AlertModal이나 ConfirmModal 같은 별도의 컴포넌트로 추출(Extract)하는 것이 유지보수에 좋을 수 있으나, 현재로서는 인라인으로도 무방함. */}
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
              {/* 배포 파이프라인(디플로이어) 화면으로 넘어가는 버튼 */}
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
