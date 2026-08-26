// React가 제공하는 Hook을 가져온다.
// useState: 화면에 반영되어야 하는 값을 기억하고 변경한다.
// useRef: 화면을 다시 그리지 않고 값이나 실제 HTML 요소를 기억한다.
// useEffect: 화면이 그려진 뒤 특정 값의 변화에 맞춰 작업을 실행한다.
// useMemo: 같은 입력값으로 만든 계산 결과를 재사용한다.
// useCallback: 같은 의존값을 사용하는 함수 자체를 재사용한다.
import { useState, useRef, useEffect, useMemo, useCallback } from "react"; 

// 프로젝트 안에서 공통으로 사용하는 아래 방향 아이콘, 알림창, 버전 선택 드롭다운을 가져온다.
// "../../"는 현재 developer 폴더에서 두 단계 위인 src 폴더로 이동한다는 상대 경로다.
import { ChevronDownIcon } from "../../components/ui/Icons"; 
import { AlertModal } from "../../components/ui/AlertModal"; 
import { VersionDropdown } from "../../components/ui/VersionDropdown";

// services/api.js에 정의된 백엔드 통신 함수를 가져온다.
// 이 컴포넌트는 요청 주소나 fetch 사용법을 직접 알 필요 없이 목적에 맞는 함수를 호출한다.
import { createMainVersion, deleteSubVersion, getMainVersionDetail, upsertSubVersion, updateMainVersion } from "../../services/api";

/**
 * 현재 날짜를 HTML 날짜 입력창이 이해하는 "연도-월-일" 문자열로 만든다.
 * 예: 2026년 8월 6일 -> "2026-08-06"
 *
 * const는 getTodayDateString이라는 이름에 함수를 저장한다는 뜻이다.
 * ()는 이 함수가 호출할 때 별도의 입력값을 받지 않는다는 뜻이다.
 * =>는 왼쪽의 입력을 받아 오른쪽 코드를 실행하는 화살표 함수 문법이다.
 */
const getTodayDateString = () => {
  // new Date()는 사용자의 컴퓨터를 기준으로 현재 날짜와 시간을 나타내는 객체를 만든다.
  const today = new Date();

  // Date 객체에서 연도, 월, 일을 각각 꺼낸다.
  const yyyy = today.getFullYear();

  // getMonth()는 1월을 0으로 반환하므로 실제 월을 만들기 위해 1을 더한다.
  // String(...)은 숫자를 문자열로 바꾸고, padStart(2, "0")은 한 자리 월 앞에 0을 붙인다.
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  // 백틱(`) 문자열에서는 ${값}을 이용해 문자열 안에 변수의 값을 끼워 넣을 수 있다.
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * 개발자 모드 화면 전체를 담당하는 React 함수 컴포넌트다.
 * export를 붙였기 때문에 App.jsx 같은 다른 파일에서 import하여 사용할 수 있다.
 *
 * 부모 컴포넌트인 App.jsx가 아래 값과 함수를 props로 전달한다.
 * - versions: 서버에서 불러온 메인버전 목록
 * - setVersions: 메인버전 목록을 변경하는 상태 변경 함수
 * - setSelectedVersionName: 앱 전체에서 공유하는 선택 버전명을 변경하는 함수
 * - hasMore: 서버에 다음 버전 페이지가 더 남아 있는지 여부
 * - loadingVersions: 첫 번째 버전 목록을 불러오는 중인지 여부
 * - loadingMoreVersions: 다음 버전 페이지를 추가로 불러오는 중인지 여부
 * - loadMoreVersions: 드롭다운 끝에 도달했을 때 다음 페이지를 요청하는 함수
 *
 * 매개변수의 { ... }는 props 객체에서 필요한 속성만 바로 꺼내는 객체 구조 분해 문법이다.
 */
export const DeveloperVersionRegistrationSection = ({
  versions,
  setVersions,
  setSelectedVersionName,
  hasMore,
  loadingVersions,
  loadingMoreVersions,
  loadMoreVersions,
}) => {
  // 날짜 input의 실제 HTML 요소를 가리키기 위한 ref다.
  // 아직 화면 요소와 연결되기 전이므로 초기값은 "값이 없음"을 뜻하는 null이다.
  const dateInputRef = useRef(null); 

  // 사용자가 선택한 날짜를 기억한다. 처음 화면을 열었을 때는 오늘 날짜로 시작한다.
  // 배열의 첫 번째 값 selectedDate는 현재 상태이고, 두 번째 setSelectedDate는 상태 변경 함수다.
  const [selectedDate, setSelectedDate] = useState(getTodayDateString()); 

  // 개발자 화면이 새 메인버전 생성(new) 중인지 기존 버전 수정(edit) 중인지 기억한다.
  const [modeType, setModeType] = useState("new"); 

  // 같은 날짜 뒤에 붙는 서브 번호를 기억한다. 예: "2026.08.26-2"에서 "2"에 해당한다.
  // 번호가 없는 기본 버전은 빈 문자열 ""로 표현한다.
  const [editVersionMode, setEditVersionMode] = useState(""); 

  // APP별 입력 행 전체를 배열로 기억한다. 처음에는 행이 없으므로 빈 배열 []이다.
  const [rows, setRows] = useState([]);

  // 현재 메인버전에 속한 SQL Script와 Release Note 입력값을 각각 기억한다.
  const [sqlScript, setSqlScript] = useState("");
  const [releaseNote, setReleaseNote] = useState("");

  // 공통 알림 모달에 표시할 문구와 알림 종류를 기억한다.
  // alertMessage가 빈 문자열이면 알림창을 닫고, 값이 있으면 알림창을 연다.
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("warning"); 

  // 저장·조회 과정의 진행 여부와 오류 문구를 관리한다.
  // boolean 상태는 true/false 두 값만 가지며 버튼 비활성화와 로딩 문구에 사용한다.
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loadingBase, setLoadingBase] = useState(false);
  const [baseStatus, setBaseStatus] = useState(""); 
  const [loadError, setLoadError] = useState(""); 

  // 선택한 날짜에 해당하는 버전만 고르고, 같은 날짜의 높은 번호가 먼저 오도록 정렬한다.
  // useMemo는 selectedDate나 versions가 바뀌지 않았다면 이전 계산 결과를 재사용한다.
  const availableVersions = useMemo(() => {
    // !는 참/거짓을 반대로 바꾼다. 날짜가 비어 있으면 계산할 수 없으므로 빈 배열을 즉시 반환한다.
    if (!selectedDate) return []; 

    // HTML 날짜 형식 "2026-08-26"을 서버 버전 형식 "2026.08.26"으로 바꾼다.
    // /-/g는 문자열에 들어 있는 모든 하이픈(-)을 찾는 정규식이다.
    const prefix = selectedDate.replace(/-/g, '.');

    // filter는 조건에 맞는 버전만 남기고, sort는 남은 버전의 순서를 정한다.
    return versions
      // => 앞의 v는 versions 배열에서 현재 검사 중인 버전 객체 하나다.
      // ===는 값과 자료형이 모두 같은지 비교하고, ||는 두 조건 중 하나만 참이어도 참이다.
      .filter(v => v.versionName === prefix || v.versionName.startsWith(prefix + '-'))
      .sort((a, b) => {
        // "2026.08.26-2"를 하이픈으로 나누고 [1] 위치의 "2"를 정수로 변환한다.
        // || "1"은 번호가 없을 때 사용할 기본값이고, parseInt의 10은 10진수로 읽으라는 뜻이다.
        const aSuf = parseInt(a.versionName.split('-')[1] || "1", 10);
        const bSuf = parseInt(b.versionName.split('-')[1] || "1", 10);

        // sort에서 음수/0/양수를 반환해 순서를 정한다. b에서 a를 빼면 큰 번호가 앞으로 온다.
        return bSuf - aSuf;
      });
  // 의존성 배열이다. 선택 날짜 또는 전체 버전 목록이 바뀔 때만 위 계산을 다시 수행한다.
  }, [selectedDate, versions]); 

  // 선택 날짜에 이미 존재하는 버전들 중 가장 큰 뒤 번호를 계산한다.
  // 삼항 연산자 "조건 ? 참일 때 값 : 거짓일 때 값"을 여러 줄로 작성한 코드다.
  const maxSuffix = availableVersions.length > 0
    // ...은 배열 항목을 Math.max의 개별 인수로 펼치는 전개 문법이다.
    ? Math.max(...availableVersions.map(v => {
      // 번호가 없는 기본 날짜 버전은 뒤 번호를 0으로 취급한다.
      if (v.versionName === selectedDate.replace(/-/g, '.')) return 0;
      const parts = v.versionName.split('-');
      // 하이픈 뒤 값이 있으면 숫자로 바꾸고, 없으면 0을 반환한다.
      return parts.length > 1 ? parseInt(parts[1], 10) : 0;
    }))
    // 같은 날짜의 버전이 하나도 없으면 -1로 두어 새 버전이 번호 없는 기본 버전이 되게 한다.
    : -1; 

  // 버전 목록을 처음 받은 뒤 최신 버전을 자동 선택하는 작업이 이미 끝났는지 기억한다.
  // ref의 current를 바꿔도 화면을 다시 그리지 않으므로 내부 실행 제어용 값에 적합하다.
  const initializedVersionRef = useRef(false);

  // versions가 준비되었을 때 최신 버전을 최초 한 번만 수정 대상으로 선택한다.
  // useEffect는 렌더링이 끝난 뒤 실행되며, 아래 [versions]가 바뀔 때 실행 여부를 다시 판단한다.
  useEffect(() => {
    // ||는 OR 조건이다. 이미 초기화했거나 버전이 하나도 없으면 아래 작업을 실행하지 않는다.
    if (initializedVersionRef.current || versions.length === 0) return;

    // 버전 목록은 최신순이므로 배열의 0번째 항목을 최신 버전으로 사용한다.
    const latestVersionName = versions[0].versionName;

    // 배열 구조 분해로 날짜 부분과 번호 부분을 나눠 담는다. 번호가 없으면 suffix는 ""가 된다.
    const [datePart, suffix = ""] = latestVersionName.split('-');

    // 서버 형식의 점(.)을 날짜 input 형식의 하이픈(-)으로 바꾸고 수정 모드로 전환한다.
    setSelectedDate(datePart.replace(/\./g, '-'));
    setEditVersionMode(suffix);
    setModeType("edit");

    // 이후 versions가 다시 바뀌어도 사용자의 선택을 강제로 최신 버전으로 되돌리지 않도록 기록한다.
    initializedVersionRef.current = true;
  }, [versions]);

  // 드롭다운 value에 전달할 완성된 기존 버전명을 만든다.
  // 수정 모드가 아니면 아무 버전도 선택되지 않은 것처럼 빈 문자열을 사용한다.
  const selectedExistingVersionName = modeType === "edit"
    ? `${selectedDate.replace(/-/g, '.')}${editVersionMode ? `-${editVersionMode}` : ''}`
    : "";

  // 사용자가 기존 메인버전을 드롭다운에서 선택했을 때 실행되는 이벤트 처리 함수다.
  const handleSelectExistingVersion = (versionName) => {
    // 선택된 전체 버전명을 날짜와 뒤 번호로 분리한다.
    const [datePart, suffix = ""] = versionName.split('-');
    setSelectedDate(datePart.replace(/\./g, '-'));
    setEditVersionMode(suffix);
    setModeType("edit");

    // 이전 버전에서 발생했던 오류 메시지가 새 선택에 남지 않도록 초기화한다.
    setSubmitError("");
    setLoadError("");
  };

  // "+ 새 메인버전 만들기" 버튼을 눌렀을 때 모든 입력 상태를 신규 작성용으로 초기화한다.
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

  /**
   * 백엔드에서 받은 메인버전 상세 응답을 화면의 APP 입력 행 형식으로 변환한다.
   * detailData: 백엔드 상세 응답
   * forcePending: 모든 행의 상태를 PENDING으로 시작시킬지 여부
   * clearNotes: 기존 NOTE를 비워서 새 버전으로 복사할지 여부
   */
  const buildRowsFromDetail = (detailData, forcePending, clearNotes) => {
    // 상세 정보, subVersions 배열 또는 배열 항목이 없으면 화면에 만들 행도 없으므로 []를 반환한다.
    if (!detailData || !detailData.subVersions || !detailData.subVersions.length) return [];

    // map은 서버의 서브버전 하나를 화면 행 객체 하나로 변환해 새로운 배열을 만든다.
    return detailData.subVersions.map((sub, index) => {
      // let은 이후 값을 다시 대입할 수 있는 변수다. NOTE가 null/undefined면 빈 문자열을 사용한다.
      let pureNote = sub.note || "";
      if (clearNotes) pureNote = ""; 

      // 서버에 상태가 없을 경우 안전한 기본값으로 UNCHANGED를 사용한다.
      const existingStatus = sub.submitStatus || "UNCHANGED";

      // forcePending이 true면 무조건 pending, 아니면 서버 상태를 화면용 소문자로 변환한다.
      const statusValue = forcePending
        ? "pending"
        : (existingStatus.toLowerCase() === "updated" ? "updated" : existingStatus.toLowerCase() === "pending" ? "pending" : "unchanged");

      // ?.는 components가 null/undefined여도 오류를 내지 않는 선택적 연결 연산자다.
      // 여러 imageTag를 줄바꿈 문자 \n으로 합쳐 textarea 한 칸에 표시한다.
      const component = sub.components?.length > 0
        ? sub.components.map(c => c.imageTag).join('\n')
        : "";

      // 사용자가 값을 바꾼 뒤 원래 값으로 되돌렸는지 비교하기 위해 최초 값을 별도로 보관한다.
      const originalValues = {
        subVersion: sub.code || "",
        component,
        tag: sub.version || "",
        note: pureNote,
        sortOrder: index,
      };

      // 서버 응답을 화면에서 편집하기 편한 하나의 행 객체로 만들어 반환한다.
      return {
        // 백엔드 id가 없을 수도 있으므로 code와 배열 index까지 사용해 React용 고유 id를 만든다.
        id: `row_${sub.id || sub.code || index}`,
        // ??는 왼쪽 값이 null 또는 undefined일 때만 오른쪽 값 null을 사용한다.
        serverId: sub.id ?? null,
        subVersion: sub.code || "",
        component,
        tag: sub.version || "",
        note: pureNote,
        status: statusValue,
        originalStatus: statusValue,
        originalValues,
        desc: sub.code || "Custom Component",
        // dirty는 사용자가 원본에서 값을 변경했는지 나타낸다. 처음 불러왔으므로 false다.
        dirty: false,
      };
    });
  };

  // 현재 선택된 메인버전 상세 정보를 백엔드에서 불러오는 비동기 함수다.
  // useCallback은 의존값이 그대로라면 같은 함수 객체를 재사용해 아래 useEffect의 불필요한 재실행을 막는다.
  const loadBaseline = useCallback(async () => {
    // 기존 버전을 수정 중이거나 뒤 번호가 지정된 경우에만 상세 조회를 진행한다.
    if (modeType === "edit" || editVersionMode) {
      // 조회 시작을 화면에 알리고 이전 오류를 지운다.
      setLoadingBase(true);
      setBaseStatus("버전 정보 로딩 중...");
      setLoadError("");

      // try는 성공할 것으로 기대하는 코드를 실행하고, 오류가 발생하면 아래 catch로 이동한다.
      try {
        const prefix = selectedDate.replace(/-/g, '.');
        const targetVersionName = editVersionMode ? `${prefix}-${editVersionMode}` : prefix;

        // await는 백엔드 응답이 올 때까지 이 async 함수의 다음 줄 실행을 기다린다.
        const detail = await getMainVersionDetail(targetVersionName);

        if (modeType === "new") {
          // 새 버전의 기반으로 복사할 때는 APP 상태를 PENDING으로 만들고 NOTE와 배포 문서를 비운다.
          setRows(buildRowsFromDetail(detail, true, true));
          setSqlScript(""); 
          setReleaseNote("");
          setBaseStatus(`이전 버전(${targetVersionName})을 기반으로 새 버전을 작성합니다.`);
        } else {
          // 기존 버전 수정이면 서버에서 받은 APP 행과 배포 문서를 원래 값 그대로 화면에 넣는다.
          setRows(buildRowsFromDetail(detail, false, false));
          // ?.로 mainVersion이 없어도 오류를 막고, || ""로 값이 없으면 빈 입력창을 만든다.
          setSqlScript(detail.mainVersion?.sqlScript || "");
          setReleaseNote(detail.mainVersion?.releaseNote || "");
          setBaseStatus(`버전 ${targetVersionName} 수정 모드입니다. (오타 및 상태 수정 가능)`);
        }
      } catch (error) {
        // 조회가 실패하면 이전 데이터가 다른 버전 정보처럼 보이지 않도록 입력값을 비운다.
        setRows([]);
        setSqlScript("");
        setReleaseNote("");
        // 백엔드 응답 메시지, 일반 Error 메시지, 기본 문구 순서로 사용할 오류 문구를 선택한다.
        const message = error.payload?.message || error.message || "데이터를 불러오는 중 오류가 발생했습니다.";
        setLoadError(message);
        setAlertType("warning");
        setAlertMessage(message);
      } finally {
        // finally는 성공과 실패 어느 쪽이든 마지막에 실행되므로 로딩 상태를 종료하기 적합하다.
        setLoadingBase(false);
      }
    }
  // 함수 내부에서 사용하는 값이 바뀌면 최신 값을 바라보는 새 loadBaseline 함수를 만든다.
  }, [selectedDate, modeType, editVersionMode]);

  // 수정 모드로 들어갔고 버전 목록도 준비되면 선택한 버전의 상세 데이터를 불러온다.
  // loadBaseline이 useCallback으로 고정되어 있어 관련 값이 실제로 바뀔 때만 Effect가 다시 실행된다.
  useEffect(() => {
    if (modeType === "edit" && versions.length > 0) loadBaseline();
  }, [modeType, versions.length, loadBaseline]);

  // APP별 정보 영역의 새로고침 버튼을 눌렀을 때 실행한다.
  const handleRefreshAppInfo = () => {
    // some은 배열에서 조건을 만족하는 행이 하나라도 있으면 true를 반환한다.
    // 저장하지 않은 변경이 있으면 confirm으로 사용자에게 사라져도 되는지 먼저 확인한다.
    if (rows.some((row) => row.dirty)
      && !window.confirm("저장하지 않은 APP 정보가 있습니다. 서버의 최신 정보로 새로고침하시겠습니까?")) {
      // 사용자가 취소하면 return으로 함수를 즉시 끝내므로 서버 데이터를 다시 불러오지 않는다.
      return;
    }
    loadBaseline();
  };

  // 현재 드래그 중인 행 번호를 기억한다. 드래그 중이 아니면 null이다.
  const [draggedIndex, setDraggedIndex] = useState(null); 

  // 화면에 만들어진 각 <tr> HTML 요소를 배열로 가리킨다. ref이므로 값 변경만으로 리렌더링하지 않는다.
  const trRefs = useRef([]); 

  // 사용자가 APP 행의 "이동" 손잡이를 끌기 시작할 때 실행한다.
  const handleDragStart = (e, index) => {
    // 어떤 행을 옮기는지 배열 위치(index)를 기억한다.
    setDraggedIndex(index); 

    // e는 브라우저가 전달한 drag 이벤트 객체이며, dataTransfer에 이동 작업임을 표시한다.
    e.dataTransfer.effectAllowed = "move"; 
  };

  // 드래그 중인 행이 다른 행 위를 지나갈 때 브라우저의 기본 동작을 막아 drop 이벤트를 허용한다.
  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  // 끌고 있던 APP 행을 특정 위치에 놓았을 때 배열 순서를 실제로 변경한다.
  const handleDrop = (e, targetIndex) => {
    e.preventDefault(); 

    // 드래그 대상이 없거나 출발 위치와 도착 위치가 같으면 바꿀 것이 없으므로 종료한다.
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    // [...rows]는 기존 상태 배열을 직접 수정하지 않기 위해 새 배열로 얕게 복사하는 전개 문법이다.
    const newRows = [...rows]; 
    const draggedItem = newRows[draggedIndex]; 

    // splice(위치, 삭제 개수)는 기존 위치에서 행을 제거한다.
    newRows.splice(draggedIndex, 1);

    // splice(위치, 0, 값)는 아무것도 삭제하지 않고 목표 위치에 드래그한 행을 삽입한다.
    newRows.splice(targetIndex, 0, draggedItem);

    // 순서가 바뀐 각 행을 원본과 다시 비교해 dirty와 자동 STATUS를 계산한다.
    setRows(newRows.map((row, index) => {
      const dirty = isRowChanged(row, index);
      return {
        // ...row는 기존 행의 모든 속성을 복사하고, 뒤의 dirty/status 값으로 필요한 속성만 덮어쓴다.
        ...row,
        dirty,
        // 원래 UNCHANGED였던 행만 변경 여부에 따라 UPDATED와 UNCHANGED를 자동 전환한다.
        status: row.originalStatus === "unchanged" ? (dirty ? "updated" : "unchanged") : row.status,
      };
    })); 

    // 행 이동을 마쳤으므로 현재 드래그 대상을 다시 null로 초기화한다.
    setDraggedIndex(null); 
  };

  // "이동" 손잡이를 누르는 동안에만 해당 테이블 행의 HTML draggable 속성을 켠다.
  // 행 전체를 항상 draggable로 만들면 사용자가 input의 글자를 선택하기 어려워질 수 있다.
  const enableDrag = (index) => {
    if (trRefs.current[index]) trRefs.current[index].draggable = true; 
  }

  // 마우스를 놓거나 손잡이 밖으로 벗어나면 드래그 기능을 다시 끈다.
  const disableDrag = (index) => {
    if (trRefs.current[index]) trRefs.current[index].draggable = false; 
  }

  // 현재 행의 입력값 또는 표시 순서가 서버에서 처음 받은 원본과 달라졌는지 검사한다.
  const isRowChanged = (row, currentIndex) => {
    // 새로 추가한 행은 비교할 originalValues가 없으므로 항상 변경된 행으로 처리한다.
    if (!row.originalValues) return true;

    // !==는 값이나 자료형이 다르면 true다. ||로 연결했으므로 하나라도 다르면 전체 결과가 true다.
    return row.subVersion !== row.originalValues.subVersion
      || row.component !== row.originalValues.component
      || row.tag !== row.originalValues.tag
      || row.note !== row.originalValues.note
      || currentIndex !== row.originalValues.sortOrder;
  };

  // APP 행의 input, textarea 또는 STATUS 값이 변경될 때 rows 상태를 갱신한다.
  // index는 몇 번째 행인지, field는 바꿀 속성 이름, value는 사용자가 입력한 새 값이다.
  const handleRowChange = (index, field, value) => {
    // React 상태를 직접 수정하지 않고 새 배열과 새 행 객체를 만든다.
    const newRows = [...rows]; 

    // [field]는 변수에 들어 있는 문자열을 객체의 속성 이름으로 사용하는 계산된 속성 문법이다.
    // 예: field가 "tag"라면 { ...기존행, tag: value }와 같다.
    const nextRow = { ...newRows[index], [field]: value };

    // 사용자가 STATUS 자체만 바꾼 경우에는 입력값 변경 여부를 다시 계산하지 않는다.
    if (field !== "status") {
      // EXT는 IMAGE TAG를 갖지 않는 APP이므로 APP 이름이 EXT가 되면 기존 IMAGE TAG를 비운다.
      // trim은 앞뒤 공백 제거, toUpperCase는 영문 대문자 변환이다.
      if (field === "subVersion" && value.trim().toUpperCase() === "EXT") {
        nextRow.component = "";
      }

      // 입력이 원본과 달라졌는지 다시 계산한다.
      nextRow.dirty = isRowChanged(nextRow, index);

      // 서버에서 처음 받은 상태가 UNCHANGED였던 행은 입력 변화에 맞춰 STATUS도 자동 변경한다.
      // 다시 원래 값을 입력하면 dirty가 false가 되어 STATUS도 unchanged로 돌아온다.
      if (nextRow.originalStatus === "unchanged") {
        nextRow.status = nextRow.dirty ? "updated" : "unchanged";
      }
    }

    // 변경한 행을 복사한 배열의 같은 위치에 넣고 React 상태를 갱신한다.
    newRows[index] = nextRow;
    setRows(newRows);
  };

  // 사용자가 "빈 컴포넌트 행 추가" 버튼을 누르면 새 APP 입력 행을 배열 끝에 추가한다.
  const addRow = () => {
    // 기존 rows를 ...rows로 펼친 뒤 새 객체를 마지막 항목으로 넣어 새로운 배열을 만든다.
    setRows([...rows, {
      // Date.now()는 현재 시각을 밀리초 숫자로 반환하므로 임시 행의 고유 id로 사용한다.
      id: `custom_${Date.now()}`, 
      subVersion: "NEW", 
      component: "", 
      tag: "", 
      note: "", 
      status: "updated", 
      originalStatus: null,
      originalValues: null,
      desc: "Custom Component",
      // 서버에서 받은 원본이 없는 신규 행이므로 처음부터 저장이 필요한 dirty 상태다.
      dirty: true,
    }]);
  };

  // APP 행의 삭제 버튼을 눌렀을 때 화면과 필요한 경우 백엔드에서도 삭제한다.
  const removeRow = async (index) => {
    const row = rows[index];

    // window.confirm은 확인/취소를 묻고 확인이면 true, 취소이면 false를 반환한다.
    // \n은 알림 문장 안에서 줄을 바꾸는 특수 문자다.
    if (window.confirm(`[${row.subVersion}] 컴포넌트를 삭제하시겠습니까?\n(서버에 저장된 경우 DB에서도 삭제됩니다.)`)) {

      // serverId가 있다는 것은 이미 서버 DB에 저장된 행이라는 뜻이므로 삭제 API도 호출해야 한다.
      if (row.serverId != null) {
        setSaving(true);
        try {
          // await로 삭제 API 응답을 기다린 뒤 성공했을 때만 화면 배열에서도 제거한다.
          await deleteSubVersion(row.serverId);
        } catch (err) {
          setSaving(false);
          const msg = err.payload?.message || err.message || "서브버전 삭제 중 오류가 발생했습니다.";
          alert(msg);

          // 서버 삭제가 실패한 행을 화면에서만 지우면 실제 데이터와 달라지므로 여기서 중단한다.
          return;
        }
        setSaving(false);
      }

      // 아직 저장하지 않은 신규 행이거나 서버 삭제가 성공한 행을 화면 배열에서 제거한다.
      const newRows = [...rows];
      newRows.splice(index, 1);
      setRows(newRows);
    }
  };

  // 신규 모드에서 "메인버전 생성" 버튼을 눌렀을 때 메인버전을 백엔드에 등록한다.
  const handleRegisterMainVersion = async () => {
    const prefix = selectedDate.replace(/-/g, '.');

    // 같은 날짜 버전이 있으면 가장 큰 번호에 1을 더하고, 없으면 날짜만 사용한다.
    // 예: 기존 최대가 2026.08.26-2라면 새 버전은 2026.08.26-3이다.
    const targetVersionName = maxSuffix >= 0 ? `${prefix}-${maxSuffix + 1}` : prefix;
    setSaving(true);
    setSubmitError("");

    try {
      // 빈 문자열은 undefined로 바꿔 신규 등록 요청에서 선택 입력 필드를 생략한다.
      await createMainVersion(targetVersionName, {
        releaseNote: releaseNote || undefined,
        sqlScript: sqlScript || undefined,
      });

      // 서버 등록이 성공하면 전체 목록을 다시 받기 전에도 드롭다운에 즉시 보이도록 요약 객체를 만든다.
      const newSummary = {
        versionName: targetVersionName,
        subVersionCount: 0,
        componentCount: 0,
        lastJob: null,
      };

      // 새 버전을 기존 versions 배열 맨 앞에 추가하고 앱 전체의 선택 버전도 새 버전으로 맞춘다.
      setVersions([newSummary, ...versions]);
      setSelectedVersionName(targetVersionName);

      // 생성 직후 같은 버전의 APP 정보를 이어서 입력할 수 있도록 수정 모드로 전환한다.
      setModeType("edit");
      setEditVersionMode(maxSuffix >= 0 ? (maxSuffix + 1).toString() : '');

      setAlertType("success"); setAlertMessage(`신규 메인버전(${targetVersionName})이 등록되었습니다. 아래에서 매니페스트 상세 정보를 작성 후 각각 저장해주세요.`);
    } catch (error) {
      // HTTP 409는 같은 버전이 이미 존재한다는 충돌 응답이므로 일반 오류와 다르게 처리한다.
      if (error.status !== 409) {
        const message = error.payload?.message || error.message || "메인버전 등록 중 오류가 발생했습니다.";
        setSubmitError(message);
        setAlertType("warning"); setAlertMessage(message);
      } else {
        // 이미 존재한다면 새로 만들지 않고 해당 버전을 수정하는 흐름으로 전환한다.
        setModeType("edit");
        setEditVersionMode(maxSuffix >= 0 ? (maxSuffix + 1).toString() : '');
        setAlertType("warning"); setAlertMessage("이미 등록된 버전입니다. 수정 모드로 전환되었습니다.");
      }
    } finally {
      // 성공/실패와 관계없이 저장 중 상태를 종료해 버튼을 다시 사용할 수 있게 한다.
      setSaving(false);
    }
  };

  // APP 행 오른쪽의 저장 버튼을 눌렀을 때 해당 행 하나만 백엔드에 저장한다.
  const handleSaveRow = async (index) => {
    const row = rows[index];

    // VERSION은 필수값이므로 빈 값이면 API를 호출하지 않고 사용자에게 먼저 알린다.
    if (!row.tag) {
      setAlertType("warning"); setAlertMessage("버전(VERSION) 태그를 입력해야 저장할 수 있습니다.");
      return;
    }

    const prefix = selectedDate.replace(/-/g, '.');
    const targetVersionName = (editVersionMode ? `${prefix}-${editVersionMode}` : prefix);

    // 화면에서는 소문자 상태를 사용하지만 백엔드 계약에 맞춰 대문자로 변환한다.
    const desiredStatus = (row.status === "updated") ? "UPDATED" : (row.status === "pending") ? "PENDING" : "UNCHANGED";

    // 내용이 바뀌었는데 STATUS가 UNCHANGED라면 서로 모순되므로 저장을 막는다.
    if (row.dirty && desiredStatus === "UNCHANGED") {
      setAlertType("warning");
      setAlertMessage("APP 정보가 변경되었습니다. STATUS를 UPDATED 또는 PENDING으로 선택해주세요.");
      return;
    }

    // 백엔드 API가 요구하는 서브버전 저장 요청 본문을 만든다.
    const payload = {
      code: row.subVersion,
      version: row.tag,
      sortOrder: index,
      submitStatus: desiredStatus, 
    };

    // NOTE는 선택값이다. 앞뒤 공백을 제거한 뒤 내용이 있을 때만 요청 객체에 추가한다.
    const finalNote = row.note ? row.note.trim() : "";
    if (finalNote !== "") payload.note = finalNote;

    // EXT는 IMAGE TAG가 없는 특별한 APP이므로 빈 배열을 명시해서 보낸다.
    if (row.subVersion.trim().toUpperCase() === "EXT") {
      payload.imageTags = [];
    } else if (row.component) {
      // 일반 APP은 textarea의 각 줄을 이미지 태그 하나로 보고 배열로 변환한다.
      // filter(Boolean)은 trim 후 빈 문자열이 된 항목을 제거한다.
      payload.imageTags = row.component.split('\n').map(t => t.trim()).filter(Boolean);
    }

    setSaving(true);
    setSubmitError("");
    try {
      // targetVersionName 아래의 APP code를 기준으로 신규 등록 또는 기존 정보 수정을 수행한다.
      await upsertSubVersion(targetVersionName, row.subVersion, payload);
      setAlertType("warning"); setAlertMessage(`${row.subVersion} 컴포넌트 정보가 저장되었습니다.`);

      // 저장 성공 후 서버의 최종 값을 다시 조회해 id, 상태, 원본 비교값까지 정확히 동기화한다.
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

  // 기존 메인버전의 SQL Script와 Release Note를 한 번에 수정한다.
  const handleUpdateMainVersionInfo = async () => {
    const prefix = selectedDate.replace(/-/g, '.');
    const targetVersionName = editVersionMode ? `${prefix}-${editVersionMode}` : prefix;

    setSaving(true);
    setSubmitError("");
    try {
      // 수정 API에서는 빈 문자열도 그대로 전송한다.
      // 따라서 사용자가 기존 내용을 모두 지우고 저장하면 백엔드의 기존 값도 삭제된다.
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

  // return 뒤의 괄호 안은 이 컴포넌트가 브라우저에 보여줄 JSX 화면 구조다.
  // JSX는 HTML과 비슷하지만 JavaScript 안에서 사용하므로 class 대신 className을 쓴다.
  // 중괄호 { } 안에는 상태값, 함수 호출, 조건식 같은 JavaScript 표현식을 넣을 수 있다.
  return (
    // 가장 바깥 div는 개발자 모드 전체의 최대 너비, 가운데 정렬, 여백과 세로 배치를 담당한다.
    <div className="w-full max-w-[1920px] mx-auto p-8 flex flex-col gap-8">
      {/* 개발자 모드의 화면 제목과 이 페이지에서 할 수 있는 일을 안내하는 머리말 영역이다. */}
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

      {/* 메인버전 관리 카드와 APP별 정보 카드를 세로로 배치하는 컨테이너다. */}
      <div className="flex flex-col gap-8">
        {/* 메인버전 선택·생성 및 SQL Script·Release Note를 관리하는 첫 번째 카드다. */}
        <section className="bg-white rounded-xl border border-slate-300 shadow-md p-6 flex flex-col gap-6">
          <div className="border-b pb-4 border-slate-100">
            <h2 className="text-2xl font-bold text-slate-800">
              {/* 삼항 연산자로 현재 모드에 맞는 제목 하나만 보여준다. */}
              {modeType === "new" ? "새 메인버전 만들기" : "메인버전 관리"}
            </h2>
          </div>

          {/* 기존 메인버전 선택 드롭다운과 신규 생성 모드 전환 버튼을 한 줄에 배치한다. */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
            <div className="flex flex-col gap-2">
              <label htmlFor="existing-main-version" className="text-base font-bold text-slate-500 uppercase tracking-wider">
                관리할 메인버전
              </label>
              {/* 공통 VersionDropdown에 현재 값과 목록, 이벤트 함수, 페이징 상태를 props로 전달한다.
                  수정 모드일 때만 선택값을 보여주고 신규 모드일 때는 빈 값으로 보인다.
                  버전을 고르면 handleSelectExistingVersion이 선택된 versionName을 받아 실행된다. */}
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
            {/* form 제출 목적이 아닌 일반 버튼이다. 함수 뒤에 ()를 붙이지 않았으므로 지금 실행하지 않고,
                사용자가 클릭할 때 실행할 handleStartNewVersion 함수 자체를 전달한다. */}
            <button
              type="button"
              onClick={handleStartNewVersion}
              className="py-3.5 px-6 text-base font-bold text-[#000666] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all whitespace-nowrap"
            >
              + 새 메인버전 만들기
            </button>
          </div>

          {/* 조건 ? A : B 형태로 신규 모드와 수정 모드 중 한 화면만 렌더링한다.
              신규 모드에서는 날짜 입력과 앞으로 생성될 버전명을 미리 보여준다. */}
          {modeType === "new" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="main-version-date" className="text-base font-bold text-slate-500 uppercase tracking-wider">
                  메인 버전 날짜 <span className="text-red-500">*</span>
                </label>
                {/* ref는 실제 input 요소를 dateInputRef.current에 연결한다.
                    required는 필수 입력이라는 HTML 속성이다.
                    value와 onChange로 React 상태가 input 값을 관리한다.
                    이벤트 e의 target은 값을 변경한 input이고 target.value는 현재 입력값이다. */}
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
                  {/* 날짜의 하이픈을 점으로 바꾸고, 같은 날짜 버전이 있으면 다음 번호를 붙인다. */}
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

          {/* SQL Script와 Release Note는 APP 행이 아니라 메인버전 자체에 속하는 배포 문서다. */}
          <div className="flex flex-col gap-4 border-t border-slate-100 pt-6">
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                {modeType === "new" ? "초기 배포 문서" : "배포 문서 (SQL / Release Note)"}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-base font-bold text-slate-500 uppercase tracking-wider">SQL Script</label>
                {/* sqlScript 상태를 화면 값으로 사용하고 입력할 때마다 상태를 갱신한다. */}
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
                {/* releaseNote 역시 React 상태와 연결된 제어 입력 요소다. */}
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

          {/* && 조건부 렌더링: 신규 모드일 때만 오른쪽의 메인버전 생성 버튼을 만든다. */}
          {modeType === "new" && (
            <div className="flex justify-end pt-2 border-t border-slate-100 gap-3">
              {/* 저장 중에는 중복 요청을 막기 위해 버튼을 비활성화한다.
                  백틱 문자열의 ${...}로 saving 상태에 따른 Tailwind 클래스를 추가한다. */}
              <button
                type="button"
                onClick={handleRegisterMainVersion} 
                disabled={saving}
                className={`py-2.5 px-8 text-base font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-all shadow-sm active:scale-95 ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {/* 저장 중인지에 따라 버튼 글자도 변경한다. */}
                {saving ? "처리 중..." : "메인버전 생성"}
              </button>
            </div>
          )}
          {/* 기존 버전 수정 모드에서는 생성 버튼 대신 배포 문서 저장 버튼을 보여준다. */}
          {modeType !== "new" && (
            <div className="flex justify-end pt-2 border-t border-slate-100">
              {/* 저장 중이거나 상세 데이터를 불러오는 중에는 수정 요청을 막는다. */}
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

        {/* 신규 메인버전 자체를 먼저 생성해야 APP을 연결할 수 있으므로 수정 모드에서만 APP 카드를 보여준다. */}
        {modeType !== "new" && (
          <section className="bg-white rounded-xl border border-slate-300 shadow-md flex flex-col overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b border-slate-100">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">APP별 정보</h2>
              </div>
              {/* 다른 개발자가 저장한 최신 서버 데이터를 다시 받을 수 있는 새로고침 버튼이다. */}
              <button
                type="button"
                onClick={handleRefreshAppInfo}
                disabled={saving || loadingBase}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
              >
                {loadingBase ? "불러오는 중..." : "새로고침"}
              </button>
            </div>

            {/* 화면이 좁을 때 표가 찌그러지지 않고 가로 스크롤되도록 감싸는 영역이다. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1160px] table-fixed text-left border-collapse">
                {/* 각 열의 너비를 미리 지정해 APP별 입력 행이 일정하게 정렬되도록 한다. */}
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
                  {/* map으로 rows 배열의 각 객체를 테이블 행 <tr> 하나로 반복 변환한다. */}
                  {rows.map((row, index) => (
                    /* key는 React가 행의 추가·삭제·순서 변경을 구분하기 위한 고유 식별자다.
                       ref는 실제 tr 요소를 trRefs.current 배열의 같은 위치에 저장한다.
                       드래그 이벤트는 브라우저 이벤트 e와 현재 행 번호를 처리 함수로 전달한다. */
                    <tr
                      key={row.id} 
                      className="hover:bg-slate-50/50 transition-colors group"
                      ref={el => trRefs.current[index] = el} 
                      onDragStart={(e) => handleDragStart(e, index)} 
                      onDragOver={(e) => handleDragOver(e, index)} 
                      onDrop={(e) => handleDrop(e, index)} 
                    >
                      {/* APP 이름 입력과 순서 이동 손잡이, 삭제 버튼이 들어가는 첫 번째 열이다. */}
                      <td className="px-4 py-3 border-b border-slate-100 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          {/* 마우스를 누른 동안만 draggable을 켜서 일반 입력 동작과 충돌하지 않게 한다. */}
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
                            {/* 현재 행의 subVersion 값을 보여주고, 입력 시 해당 속성만 변경한다. */}
                            <input
                              type="text"
                              required
                              value={row.subVersion}
                              onChange={(e) => handleRowChange(index, "subVersion", e.target.value)}
                              className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-3.5 pr-12 text-sm font-bold text-[#1a237e] focus:ring-2 focus:ring-[#1a237e] outline-none uppercase"
                            />
                            {/* 화살표 함수로 감싸 클릭 시점에 현재 index를 넣어 removeRow를 호출한다. */}
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
                      {/* APP의 VERSION을 입력하는 필수 열이다. */}
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
                      {/* IMAGE TAG 입력 열이다. 여러 태그는 textarea에서 한 줄에 하나씩 입력한다. */}
                      <td className="px-4 py-3 border-b border-slate-100">
                        {/* EXT는 IMAGE TAG를 사용하지 않으므로 APP 이름이 EXT이면 입력을 막는다. */}
                        <textarea
                          disabled={row.subVersion.trim().toUpperCase() === "EXT"}
                          value={row.component} 
                          onChange={(e) => handleRowChange(index, "component", e.target.value)}
                          placeholder={row.subVersion.trim().toUpperCase() === "EXT" ? "IMAGE TAG 없음" : "예: myapp-api:v2.0.27"}
                          rows={2} 
                          className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] outline-none font-mono resize-y min-h-[42px] disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </td>
                      {/* 선택값인 NOTE를 입력하는 열이다. */}
                      <td className="px-4 py-3 border-b border-slate-100">
                        <textarea
                          value={row.note} 
                          onChange={(e) => handleRowChange(index, "note", e.target.value)}
                          onKeyDown={(e) => {
                            // 이벤트 함수의 중괄호 안은 JavaScript 영역이므로 여기서는 // 주석을 사용한다.
                            // Enter만 누르면 기본 줄바꿈을 막고, Shift+Enter를 누른 경우에만 줄바꿈을 허용한다.
                            if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
                          }}
                          placeholder="변경 사항 기록 (Shift+Enter 줄바꿈)"
                          rows={2} 
                          className="w-full rounded-md border border-slate-200 bg-white py-2.5 px-3.5 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] outline-none resize-y min-h-[42px]"
                        />
                      </td>
                      {/* 백엔드에 저장할 APP 상태를 선택하는 열이다. */}
                      <td className="px-4 py-3 border-b border-slate-100">
                        <div className="relative w-full">
                          {/* STATUS 값에 따라 서로 다른 배경색과 글자색을 적용한다. */}
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
                            {/* 입력값이 원본과 다르면 dirty가 true이므로 모순된 UNCHANGED 선택을 막는다. */}
                            <option value="unchanged" disabled={row.dirty} className="bg-white text-slate-500 font-bold">UNCHANGED</option>
                          </select>
                          {/* select 기본 화살표 대신 공통 아이콘을 오른쪽에 겹쳐 표시한다. */}
                          <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </td>
                      {/* 현재 행 하나만 저장하는 버튼을 표 오른쪽 끝에 고정한다. */}
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
                          {/* 저장 중/변경됨/변경 없음의 세 상태에 맞춰 사용자에게 버튼 문구를 보여준다. */}
                          {saving ? "저장중" : (row.dirty ? "저장 필요" : "저장 완료")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* 정해진 APP 외에 사용자가 직접 새 APP 행을 추가하는 버튼 영역이다. */}
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

      {/* alertMessage가 있으면 공통 알림 모달을 연다.
          !!는 값을 boolean으로 바꾼다. 빈 문자열은 false, 내용이 있는 문자열은 true다.
          모달을 닫으면 메시지를 빈 문자열로 바꿔 isOpen도 false가 되게 한다. */}
      <AlertModal 
        isOpen={!!alertMessage} 
        message={alertMessage} 
        type={alertType}
        onClose={() => setAlertMessage("")} 
      />
    </div>
  );
};
