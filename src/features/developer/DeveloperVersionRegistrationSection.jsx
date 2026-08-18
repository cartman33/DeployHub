import { useState, useRef, useEffect, useMemo, useCallback } from "react"; // React 훅 임포트
import { 
  CheckCircleIcon,  // 체크 아이콘
  ListIcon, // 리스트 아이콘
  CodeIcon, // 코드 아이콘
  RocketIcon, // 로켓 아이콘 (배포 관련)
  ChevronDownIcon // 드롭다운 화살표 아이콘
} from "../../components/ui/Icons"; // UI 아이콘 컴포넌트 임포트
import { AlertModal } from "../../components/ui/AlertModal"; // 경고 모달 컴포넌트 임포트
import { createMainVersion, getMainVersionDetail, upsertSubVersions, changeSubmitStatus, updateMainVersion } from "../../services/api"; // API 호출 함수 임포트

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

// 테이블에 기본적으로 표시할 서브버전(컴포넌트) 목록
const defaultRows = [
  { id: "cc", subVersion: "CC", component: "sb-cc-api:\nsb-cc-fe:", tag: "", note: "", status: "update", desc: "CC Component" }, // CC 컴포넌트
  { id: "fogger", subVersion: "FOGGER", component: "fogger-sb:", tag: "", note: "", status: "unchanged", desc: "Fogger Service" }, // Fogger 서비스
  { id: "swg", subVersion: "SWG", component: "swg-sb:", tag: "", note: "", status: "unchanged", desc: "SWG Proxy" }, // SWG 프록시
  { id: "stdapi", subVersion: "STDAPI", component: "sb-std-api:", tag: "", note: "", status: "unchanged", desc: "Standard API" }, // 표준 API
  { id: "piids", subVersion: "PIIDS", component: "piids-sb:", tag: "", note: "", status: "unchanged", desc: "PIIDS Detector" }, // PIIDS 탐지기
  { id: "pips", subVersion: "PIPS", component: "pips-sb:", tag: "", note: "", status: "unchanged", desc: "PIPS Engine" }, // PIPS 엔진
  { id: "cids", subVersion: "CIDS", component: "cids:", tag: "", note: "", status: "unchanged", desc: "CIDS Model" }, // CIDS 모델
  { id: "ext", subVersion: "EXT", component: "ext:", tag: "", note: "", status: "unchanged", desc: "Extractor" }, // Extractor (추출기)
  { id: "ocr", subVersion: "OCR", component: "ocr:", tag: "", note: "", status: "unchanged", desc: "OCR Engine" } // OCR 엔진
];

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
  
  const [rows, setRows] = useState([...defaultRows]); // 테이블에 렌더링될 서브버전 행 데이터 목록
  const [sqlScript, setSqlScript] = useState(""); // 입력된 SQL 스크립트 내용
  const [releaseNote, setReleaseNote] = useState(""); // 입력된 릴리즈 노트 내용
  const [alertMessage, setAlertMessage] = useState(""); // 화면에 띄울 경고창 메시지

  const [showSuccessModal, setShowSuccessModal] = useState(false); // 성공 모달 표시 여부 플래그
  const [registeredVersionName, setRegisteredVersionName] = useState(""); // 방금 등록/수정 완료된 버전의 이름
  
  const [saving, setSaving] = useState(false); // API 저장 중 여부를 나타내는 로딩 상태
  const [submitError, setSubmitError] = useState(""); // 제출 과정에서 발생한 에러 메시지
  const [loadingBase, setLoadingBase] = useState(false); // 기본 데이터(베이스라인)를 불러오는 중인지 여부
  const [baseStatus, setBaseStatus] = useState(""); // 기본 데이터 로딩과 관련된 상태 메시지
  const [loadError, setLoadError] = useState(""); // 데이터 로딩 중 발생한 에러 메시지

  // ==========================================
  // 2. 파생 상태 및 데이터 가공 (Computed Data)
  // ==========================================
  
  // 현재 선택된 날짜에 해당하는 버전 목록만 필터링하여 최신순(내림차순)으로 정렬
  const availableVersions = useMemo(() => {
    if (!selectedDate) return []; // 선택된 날짜가 없으면 빈 배열 반환
    const prefix = selectedDate.replace(/-/g, '.') + '-'; // 'YYYY-MM-DD' 형식을 'YYYY.MM.DD-' 형식으로 변환
    return versions.filter(v => v.versionName.startsWith(prefix)) // 해당 날짜 접두사로 시작하는 버전만 필터링
      .sort((a, b) => {
        // 하이픈(-) 뒷부분의 숫자(접미사)를 파싱하여 내림차순 정렬
        const aSuf = parseInt(a.versionName.split('-')[1] || "1", 10);
        const bSuf = parseInt(b.versionName.split('-')[1] || "1", 10);
        return bSuf - aSuf; // 큰 번호가 먼저 오도록 정렬 (descending)
      });
  }, [selectedDate, versions]); // 선택된 날짜나 전체 버전 목록이 변경될 때만 재계산

  // 필터링된 버전 중 가장 높은 접미사(인덱스) 계산
  const maxSuffix = availableVersions.length > 0 
    ? parseInt(availableVersions[0].versionName.split('-')[1] || "1", 10) 
    : 0; // 해당 날짜에 등록된 버전이 없으면 0

  // 선택된 날짜에 버전이 존재하는지에 따라 폼 모드를 자동 전환하는 사이드 이펙트
  useEffect(() => {
    if (availableVersions.length > 0) {
      // 이미 해당 날짜에 등록된 버전이 있으면 자동으로 "수정" 모드로 전환
      setModeType("edit");
      setEditVersionMode(availableVersions[0].versionName.split('-')[1] || "1"); // 가장 최근 버전을 수정 대상으로 선택
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
    // 상세 데이터나 서브버전 배열이 비어있으면 기본 행 목록을 고유한 ID와 함께 반환
    if (!detailData || !detailData.subVersions || detailData.subVersions.length === 0) {
      return defaultRows.map(dr => ({ ...dr, id: `row_${dr.id}_${Date.now()}` }));
    }
    
    const svList = detailData.subVersions; // 서버에서 받은 서브버전 목록
    
    // 1. 기본 제공되는 서브버전 항목들에 데이터를 매핑
    const newRows = defaultRows.map((dr) => {
      let tag = ""; // 이미지 태그의 버전명
      let component = dr.component; // 렌더링할 컴포넌트 문자열 (줄바꿈 포함)
      let existingStatus = "UNCHANGED"; // 서버에 저장된 기존 제출 상태
      let pureNote = ""; // 파싱된 실제 노트 텍스트

      // CC 컴포넌트는 API와 FE가 하나의 항목으로 묶여야 하므로 별도 파싱 처리
      if (dr.subVersion.toUpperCase() === "CC") {
        const ccItem = svList.find(s => s.code.toUpperCase() === "CC"); // 단일 CC 코드 확인
        const ccApiItem = svList.find(s => s.code.toUpperCase() === "CC API"); // CC API 코드 확인
        const ccFeItem = svList.find(s => s.code.toUpperCase() === "CC FE"); // CC FE 코드 확인
        
        if (ccItem) {
          // 단일 CC 코드로 등록된 경우의 처리
          tag = ccItem.version || "";
          component = ccItem.components?.length > 0 ? ccItem.components.map(c => c.imageTag).join('\n') : "sb-cc-api:\nsb-cc-fe:";
          existingStatus = ccItem.submitStatus || "UNCHANGED";
          pureNote = ccItem.note || "";
        } else if (ccApiItem || ccFeItem) {
          // CC API와 CC FE가 각각 나뉘어 있을 경우 이를 하나의 행으로 병합
          tag = (ccApiItem?.version || ccFeItem?.version) || "";
          const apiComp = ccApiItem?.components?.[0]?.imageTag || (ccApiItem ? `sb-cc-api:${ccApiItem.version}` : "sb-cc-api:");
          const feComp = ccFeItem?.components?.[0]?.imageTag || (ccFeItem ? `sb-cc-fe:${ccFeItem.version}` : "sb-cc-fe:");
          component = `${apiComp}\n${feComp}`; // 줄바꿈(\n)으로 API와 FE 컴포넌트를 합침
          existingStatus = ccApiItem?.submitStatus || ccFeItem?.submitStatus || "UNCHANGED";
          pureNote = ccApiItem?.note || ccFeItem?.note || "";
        }
      } else {
        // 일반적인 다른 컴포넌트 처리 (예: SWG, OCR 등)
        const item = svList.find(s => s.code.toUpperCase() === dr.subVersion.toUpperCase());
        if (item) {
          tag = item.version || "";
          component = item.components?.length > 0 ? item.components.map(c => c.imageTag).join('\n') : dr.component;
          existingStatus = item.submitStatus || "UNCHANGED";
          pureNote = item.note || "";
        }
      }

      // clearNotes 플래그가 true이면 노트를 초기화
      if (clearNotes) {
        pureNote = "";
      }

      // UI에 표시될 상태 값을 결정 (forcePending이 true면 모두 "pending"으로 초기화)
      const statusValue = forcePending 
        ? "pending" 
        : (existingStatus.toLowerCase() === "updated" ? "update" : existingStatus.toLowerCase() === "pending" ? "pending" : "unchanged");

      // 포맷팅이 완료된 단일 행 데이터 반환
      return {
        ...dr,
        id: `row_${dr.id}_${Date.now()}`, // React 리스트 렌더링을 위한 고유 ID 부여
        tag,
        component,
        note: pureNote,
        status: statusValue
      };
    });

    // 2. 기본 행에 포함되지 않은 사용자가 추가한 커스텀 서브버전(extraRows) 추출
    const defaultCodes = defaultRows.map(d => d.subVersion.toUpperCase()); // 기본 행의 코드 목록
    const extraRows = svList.filter(s => {
      const code = s.code.toUpperCase();
      // CC API/FE는 이미 위에서 기본 행(CC)으로 병합했으므로 커스텀 행에서 제외
      if (code === "CC API" || code === "CC FE") return false;
      // 기본 코드에 포함되지 않은 항목만 필터링
      return !defaultCodes.includes(code);
    }).map((sub, index) => {
      const noteStr = sub.note || ""; // 노트 문자열 가져오기
      let pureNote = noteStr; // 실제 노트 내용
      
      // clearNotes 플래그가 true이면 노트를 초기화
      if (clearNotes) {
        pureNote = "";
      }

      // 상태 매핑 로직 (위와 동일)
      const existingStatus = sub.submitStatus || "UNCHANGED";
      const statusValue = forcePending 
        ? "pending" 
        : (existingStatus.toLowerCase() === "updated" ? "update" : existingStatus.toLowerCase() === "pending" ? "pending" : "unchanged");

      // 커스텀 행 데이터 반환
      return {
        id: `row_extra_${sub.id || index}_${Date.now()}`, // 고유 ID 부여
        subVersion: sub.code || "",
        component: sub.components?.length > 0 ? sub.components.map(c => c.imageTag).join('\n') : sub.code,
        tag: sub.version || "",
        note: pureNote,
        status: statusValue,
        desc: "Custom Component" // 커스텀 컴포넌트임을 명시
      };
    });

    // 기본 행과 커스텀 행을 합쳐서 전체 테이블 데이터로 반환
    return [...newRows, ...extraRows];
  };

  /**
   * 모드(신규/수정) 전환 시, 이전 버전의 데이터를 바탕으로 폼(테이블, 텍스트박스 등)을 세팅하는 함수
   */
  const loadBaseline = async () => {
    if (!selectedDate) return; // 선택된 날짜가 없으면 종료
    setLoadingBase(true); // 로딩 상태 활성화
    setBaseStatus("데이터를 불러오는 중입니다..."); // 로딩 메시지 설정
    setLoadError(""); // 에러 초기화

    const prefix = selectedDate.replace(/-/g, '.'); // 'YYYY.MM.DD' 형태로 변환

    try {
      if (modeType === "new") {
        // [신규 등록 모드] 가장 최근 버전(baseline)의 데이터를 불러와서 복사함
        const baselineSummary = availableVersions.length > 0 ? availableVersions[0] : versions[0];
        if (baselineSummary) {
          const detail = await getMainVersionDetail(baselineSummary.versionName); // 상세 데이터 조회
          // 신규 등록이므로 상태를 모두 pending으로 강제 변경(forcePending=true), 노트/담당자 초기화(clearNotes=true)
          setRows(buildRowsFromDetail(detail, true, true));
          setSqlScript(""); // SQL 스크립트 초기화
          setReleaseNote(""); // 릴리즈 노트 초기화
          setBaseStatus(`최신 버전(${baselineSummary.versionName})을 기준으로 신규 등록을 준비합니다. (모든 상태가 pending으로 리셋됩니다)`);
        } else {
          // 복사할 이전 버전이 아예 없는 경우 빈 기본 행으로 시작
          setRows([...defaultRows]);
          setSqlScript("");
          setReleaseNote("");
          setBaseStatus("새로운 메인버전 등록을 준비합니다.");
        }
      } else {
        // [수정 모드] 선택된 기존 버전의 데이터를 그대로 불러옴
        const targetName = `${prefix}-${editVersionMode}`;
        const detail = await getMainVersionDetail(targetName);
        // 수정 모드이므로 상태 유지, 노트/담당자 유지 (forcePending=false, clearNotes=false)
        setRows(buildRowsFromDetail(detail, false, false));
        setSqlScript(detail.mainVersion?.sqlScript || ""); // 기존 SQL 스크립트 불러오기
        setReleaseNote(detail.mainVersion?.releaseNote || ""); // 기존 릴리즈 노트 불러오기
        setBaseStatus(`버전 ${targetName} 수정 모드입니다. (오타 및 상태 수정 가능)`);
      }
    } catch (error) {
      // 로딩 중 에러 발생 시 기본값으로 초기화
      setRows([...defaultRows]);
      setSqlScript("");
      setReleaseNote("");
      setLoadError(error.payload?.message || error.message || "데이터를 불러오는 중 오류가 발생했습니다."); // 에러 메시지 표시
      setBaseStatus("");
    } finally {
      setLoadingBase(false); // 로딩 상태 해제
    }
  };

  // 모드나 날짜가 변경될 때마다 폼(baseline) 데이터를 다시 로드하는 사이드 이펙트
  useEffect(() => {
    if (modeType === "new" || editVersionMode) {
      loadBaseline(); // 폼 세팅 함수 호출
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // 주의: versions나 loadBaseline 자체를 의존성에 포함하면 참조 변경으로 인한 무한 루프가 발생할 수 있어 생략함.
  }, [selectedDate, modeType, editVersionMode, versions]);

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
  const removeRow = (index) => {
    const newRows = [...rows]; // 배열 복사
    newRows.splice(index, 1); // 해당 인덱스의 요소 제거
    setRows(newRows); // 상태 업데이트
  };

  /**
   * 폼 입력 내용(서브버전, SQL, 릴리즈 노트)을 완전히 초기화하는 핸들러
   */
  const handleReset = () => {
    const isConfirmed = window.confirm("비우기 클릭 시 모든 상세 입력 내용이 삭제됩니다. 계속하시겠습니까?"); // 사용자 확인
    if (isConfirmed) {
      // 행 데이터들을 초기 상태의 값으로 리셋
      setRows(rows.map(r => {
        const defaultMatch = defaultRows.find(dr => dr.subVersion.toUpperCase() === r.subVersion.toUpperCase()); // 기본 제공 컴포넌트인지 확인
        const resetComponent = defaultMatch ? defaultMatch.component : ""; // 기본 컴포넌트 값이 있으면 복원
        return { ...r, component: resetComponent, tag: "", note: "", status: "unchanged" }; // 태그, 노트 등 모두 비움
      }));
      setSqlScript(""); // SQL 비움
      setReleaseNote(""); // 릴리즈노트 비움
    }
  };

  /**
   * 현재 모드(신규/수정)의 baseline 데이터를 서버에서 다시 불러와서 덮어쓰는 새로고침 핸들러
   */
  const handleReload = () => {
    const isConfirmed = window.confirm(
      modeType === "new" 
        ? "최신 버전의 데이터를 다시 불러오시겠습니까? 현재 입력된 내용은 덮어쓰기 됩니다."
        : "선택한 버전의 원본 데이터를 다시 불러오시겠습니까? 현재 변경사항은 덮어쓰기 됩니다."
    ); // 사용자 확인
    if (isConfirmed) {
      loadBaseline(); // baseline 재로딩 수행
    }
  };

  // ==========================================
  // 5. 폼 제출 로직 (Submit)
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault(); // 기본 폼 제출(페이지 새로고침) 동작 방지

    const prefix = selectedDate.replace(/-/g, '.'); // 버전 접두어 (YYYY.MM.DD)
    // 등록할 또는 수정할 타겟 버전 이름 생성
    const targetVersionName = modeType === "new" 
      ? `${prefix}-${maxSuffix + 1}` 
      : `${prefix}-${editVersionMode}`;

    // 테이블 rows 데이터를 API 요청 페이로드 형태로 가공
    const items = rows.map((row, index) => {
      if (!row.tag) return null; // 버전 태그가 입력되지 않은 항목은 무시함

      const payload = {
        code: row.subVersion, // 서브버전 코드
        version: row.tag, // 버전 태그
        sortOrder: index, // 정렬 순서 보장
      };

      const finalNote = row.note ? row.note.trim() : ""; // 노트 앞뒤 공백 제거
      if (finalNote !== "") {
        payload.note = finalNote; // 최종 노트 추가
      }

      if (row.component) {
        // 줄바꿈으로 입력된 컴포넌트 정보를 배열로 변환
        payload.imageTags = row.component.split('\n').map(t => t.trim()).filter(Boolean);
      }

      return payload; // 가공된 페이로드 반환
    }).filter(Boolean); // null로 반환된 무시된 항목들을 필터링하여 제거

    // 유효한 서브버전 항목이 하나도 없을 경우 경고
    if (items.length === 0) {
      setAlertMessage("하위 컴포넌트 태그를 하나 이상 입력하세요.");
      return;
    }

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

      // 생성/수정된 버전에 하위 서브버전 항목들 일괄 저장 (Upsert)
      await upsertSubVersions(targetVersionName, { items });

      // Upsert 이후 상태값 갱신을 위해 최신 상세 데이터를 다시 불러옴
      const detailAfterUpsert = await getMainVersionDetail(targetVersionName);
      const byCodeAfter = {}; // 코드 이름으로 맵핑할 객체
      (detailAfterUpsert.subVersions || []).forEach((s) => {
        if (s?.code) byCodeAfter[s.code] = s; // 코드를 키로 하여 데이터 저장
      });

      // UI에서 선택한 상태(status: update/pending/unchanged)를 개별 API로 갱신하기 위한 프로미스 배열
      const patchPromises = [];
      rows.forEach((row) => {
        if (!row.tag) return; // 무시된 항목 패스

        const saved = byCodeAfter[row.subVersion]; // 서버에 저장된 해당 코드의 데이터
        if (!saved || !saved.id) return; // 데이터가 없으면 패스

        // UI의 상태 문자열을 서버에서 요구하는 열거형(Enum) 대문자로 변환
        const desired = (row.status === "update") ? "UPDATED" : (row.status === "pending") ? "PENDING" : "UNCHANGED";
        const existing = (saved.submitStatus || "").toUpperCase(); // 현재 서버의 상태
        
        // 현재 상태와 목표 상태가 다를 때만 업데이트 API 호출
        if (existing !== desired) {
          patchPromises.push(
            changeSubmitStatus(saved.id, { status: desired })
              .then(() => ({ key: row.subVersion, ok: true })) // 성공 시 결과 저장
              .catch((err) => ({ key: row.subVersion, ok: false, error: err })) // 실패 시 에러 저장
          );
        }
      });

      // 생성된 상태 변경 프로미스를 병렬로 모두 실행
      const patchResults = patchPromises.length ? await Promise.all(patchPromises) : [];
      const failed = patchResults.filter(r => !r.ok); // 실패한 항목들 추출
      if (failed.length) {
        // 일부 항목의 상태 반영이 실패한 경우 경고창으로 알림
        const codes = failed.map(f => f.key).join(", ");
        setAlertMessage(`상태 반영 중 일부 항목이 실패했습니다: ${codes}`);
      }

      // 상위 컴포넌트의 versions 목록 상태 갱신
      const exists = versions.some(v => v.versionName === targetVersionName); // 목록에 이미 존재하는지 확인
      const newSummary = {
        versionName: targetVersionName,
        subVersionCount: items.length,
        componentCount: items.length,
        lastJob: null, // 최신 작업 내역 초기화
      };

      const updatedVersions = exists
        ? versions.map(v => (v.versionName === targetVersionName ? newSummary : v)) // 존재하면 덮어쓰기
        : [newSummary, ...versions]; // 없으면 맨 앞에 추가

      setVersions(updatedVersions); // 컨텍스트의 버전 목록 업데이트
      setSelectedVersionName(targetVersionName); // 컨텍스트의 선택된 버전 업데이트
      setRegisteredVersionName(targetVersionName); // 성공 모달에 표시될 버전명 기록
      setSubmittedModeType(modeType); // 성공 모달에 표시될 텍스트 모드 기록
      setShowSuccessModal(true); // 성공 모달 표시

      if (modeType === "new") {
        // 신규 등록이었다면, 다음 수정을 위해 모드를 'edit'으로 변경하고 인덱스를 올림
        setModeType("edit");
        setEditVersionMode((maxSuffix + 1).toString());
      } else {
        // 수정 모드였다면, 성공 후 바뀐 데이터를 다시 테이블에 로드하여 동기화
        const finalDetail = await getMainVersionDetail(targetVersionName);
        setRows(buildRowsFromDetail(finalDetail, false));
      }

    } catch (error) {
      // 에러 처리: 화면 하단이나 모달로 에러 메시지 표시
      const message = error.payload?.message || error.message || "메인버전 등록 중 오류가 발생했습니다.";
      setSubmitError(message);
      setAlertMessage(message);
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

          {/* 베이스라인 로딩 상태 알림창 */}
          <div className={`rounded-2xl border px-5 py-4 text-base font-medium ${modeType === "new" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
            {loadingBase ? (
              <div className="font-semibold text-slate-700">{baseStatus}</div> // 로딩 중 텍스트
            ) : loadError ? (
              <div className="text-red-600">{loadError}</div> // 에러 텍스트
            ) : (
              <div>{baseStatus || "준비 중입니다."}</div> // 로딩 완료 후 상태 안내 텍스트
            )}
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
                        setEditVersionMode(maxSuffix.toString());
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
                      등록될 버전명: {selectedDate.replace(/-/g, '.')}-{maxSuffix + 1}
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
                          const suf = v.versionName.split('-')[1] || "1"; // 접미사 추출
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
          
          {/* 입력 폼 리셋 및 새로고침 버튼 영역 */}
          <div className="flex justify-end pt-2 border-t border-slate-100 gap-3">
            <button
              type="button"
              onClick={handleReload} // 새로고침 핸들러
              className="py-2.5 px-8 text-base font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-all shadow-sm active:scale-95"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={handleReset} // 입력창 비우기 핸들러
              className="py-2.5 px-8 text-base font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all shadow-sm active:scale-95"
            >
              입력창 비우기
            </button>
          </div>
        </section>

        {/* 섹션 2: SQL 및 릴리즈 노트 입력 영역 */}
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

        {/* 섹션 3: 매니페스트 (서브버전) 상세 정보 입력 테이블 */}
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
                        placeholder="예: sb-cc-api:v2.0.27"
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
                    {/* 상태 열: 배포 대기(pending), 업데이트(update), 변동없음(unchanged) 선택 */}
                    <td className="px-4 py-3 border-b border-slate-100">
                      <div className="relative">
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

        {/* 제출 에러 발생 시 경고 메시지 영역 */}
        {submitError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
            {submitError}
          </div>
        )}
        
        {/* 메인 폼 제출 버튼 */}
        <button
          type="submit"
          disabled={saving} // 저장 중일 때는 버튼 비활성화
          className={`w-full py-5 rounded-xl text-white shadow-lg text-2xl font-bold tracking-wide transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 bg-[#000666] hover:bg-[#090d82] hover:shadow-indigo-200 ${saving ? "bg-slate-400 cursor-not-allowed" : ""}`}
        >
          <CheckCircleIcon className="w-6 h-6" />
          <span>{saving ? "처리 중..." : (modeType === "new" ? "새로운 메인버전 등록하기" : "메인버전 수정하기")}</span>
        </button>
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
        onClose={() => setAlertMessage("")} 
      />
    </div>
  );
};
