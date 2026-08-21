import { useState, useEffect, useMemo, useCallback, useRef } from "react";
// UI 구성요소 및 아이콘을 임포트합니다.
import { 
  CheckCircleIcon, 
  CopyIcon,
  PlayIcon,
  MonitorIcon,
  ListIcon,
  ClockIcon,
  ShoppingCartIcon
} from "../../components/ui/Icons";
import { AlertModal } from "../../components/ui/AlertModal";
// 백엔드 API 호출을 위한 서비스 함수들을 임포트합니다.
import { getMainVersionDetail, getPackagingEligibility, createPackageJob, getPackageJob, retryPackageJob } from "../../services/api";

// 서브버전 항목들의 기본 정렬 순서를 정의합니다.
import { SUBVERSION_ORDER } from '../../utils/constants';

// [리팩토링 후보] 범용 유틸리티 함수이므로 향후 utils.js 등으로 분리하는 것을 고려할 수 있습니다.
// 텍스트 내의 URL(http/https)을 클릭 가능한 링크(a 태그)로 변환하는 유틸리티 함수입니다.
const linkifyText = (text) => {
  // 텍스트가 없으면 원본을 그대로 반환합니다.
  if (!text) return text;
  // URL을 찾는 정규 표현식입니다.
  const urlPattern = /(https?:\/\/[^\s<>]+)/g;
  // 정규식을 기준으로 텍스트를 분할합니다.
  const parts = text.split(urlPattern);
  // 분할된 파트들을 순회하며 링크 컴포넌트를 생성합니다.
  return parts.map((part, i) => {
    // 파트가 URL 형태인 경우 a 태그로 감싸서 반환합니다.
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline break-all" onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    // 일반 텍스트인 경우 그대로 반환합니다.
    return part;
  });
};

// [리팩토링 후보] 범용 유틸리티 함수이므로 향후 utils.js 등으로 분리하는 것을 고려할 수 있습니다.
// 클립보드 복사 유틸리티 함수 (http 환경 등 navigator.clipboard가 없는 경우를 위한 폴백 포함)입니다.
const copyToClipboard = async (text) => {
  // 최신 브라우저 환경에서 navigator.clipboard API 시도
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      // 텍스트 복사를 비동기적으로 실행합니다.
      await navigator.clipboard.writeText(text);
      // 성공 시 true를 반환합니다.
      return true;
    } catch (err) {
      // 실패 시 경고 로그를 출력하고 폴백 로직으로 이동합니다.
      console.warn("Clipboard API failed, trying fallback...", err);
    }
  }
  
  // Fallback: document.execCommand('copy') 사용
  try {
    // 임시 텍스트 영역(textarea) 요소를 생성합니다.
    const textArea = document.createElement("textarea");
    // 복사할 텍스트를 요소에 할당합니다.
    textArea.value = text;
    // fixed로 설정하여 화면 스크롤 이동을 방지합니다.
    textArea.style.position = "fixed"; 
    // 화면 밖으로 숨김 처리합니다.
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    // body에 임시 요소를 추가합니다.
    document.body.appendChild(textArea);
    // 요소에 포커스를 맞춥니다.
    textArea.focus();
    // 텍스트를 선택합니다.
    textArea.select();
    
    // 복사 명령어를 실행하여 텍스트를 클립보드에 담습니다.
    const successful = document.execCommand('copy');
    // 임시 요소를 화면에서 제거합니다.
    textArea.remove();
    // 복사 성공 여부를 반환합니다.
    return successful;
  } catch (err) {
    // 폴백 에러 발생 시 로그를 출력하고 false를 반환합니다.
    console.error("Fallback clipboard copy failed", err);
    return false;
  }
};

// [리팩토링 후보] 내부에서만 사용되므로 여기에 두었으나, 향후 Icons.jsx로 이동할 수 있는 로컬 SVG 아이콘 컴포넌트입니다.
// 체크 모양 SVG 아이콘 컴포넌트입니다.
const CheckIcon = ({ className }) => (
  // SVG 엘리먼트를 생성합니다.
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    {/* 체크 표시를 그리기 위한 폴리라인 */}
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * [컴포넌트] 개별 버전의 서브버전 상세 목록을 그리는 테이블 컴포넌트
 * @param {string} versionName - 버전의 이름
 * @param {object} detail - 해당 버전에 대한 상세 정보
 * @param {boolean} selectable - 아이템 선택 가능 여부 플래그
 * @param {array} selectedItems - 현재 장바구니에 선택된 항목들
 * @param {function} toggleItem - 단일 아이템 토글 핸들러
 * @param {function} toggleAllItems - 전체 선택 토글 핸들러
 */
const ManifestTable = ({ versionName, detail, selectable, selectedItems, toggleItem, toggleAllItems, selectionDisabled = false }) => {
  // 매번 렌더링되지 않도록 상세 데이터를 기반으로 행(row) 데이터를 메모이제이션합니다.
  const rows = useMemo(() => {
    // 상세 정보가 없으면 빈 배열을 반환합니다.
    if (!detail) return [];
    // 서브버전 목록을 가져오며 없으면 빈 배열을 사용합니다.
    const subVersions = detail.subVersions || [];
    // 서브버전 코드를 키로 하여 맵을 생성합니다.
    const map = {};
    // 각 서브버전을 순회하며 맵에 채웁니다.
    subVersions.forEach(sv => {
      // 코드를 대문자로 변환하여 맵핑합니다.
      map[(sv.code || "").toUpperCase()] = sv;
    });

    // 정의된 정렬 순서(SUBVERSION_ORDER)대로 순회하며 행 데이터를 구성합니다.
    return SUBVERSION_ORDER.map(code => {
      // 맵에서 해당하는 코드가 있는지 확인합니다.
      const item = map[code];
      // 해당 서브버전 아이템이 없다면 기본 빈 값을 반환합니다.
      if (!item) {
        return {
          code, // 서브버전 코드
          key: code, // React key prop용 고유 식별자
          tag: "-", // 태그 표시 안함
          imageTags: "", // 이미지 태그 없음
          note: "-", // 노트 내용 없음
          sql: "-", // SQL 스크립트 없음
          releaseNote: "-", // 릴리즈 노트 없음
          statusText: "UNCHANGED", // 기본 상태
          statusClass: "bg-slate-100 text-slate-500", // 기본 색상 클래스
          highlighted: false // 강조 효과 끄기
        };
      }
      
      // 제출 상태(submitStatus)를 대문자로 변환합니다 (기본값 UNCHANGED).
      const statusValue = (item.submitStatus || "UNCHANGED").toUpperCase();
      // 화면에 표시될 상태 텍스트의 초기값입니다.
      let statusText = "UNCHANGED";
      // 화면에 표시될 상태 스타일의 초기값입니다.
      let statusClass = "bg-slate-100 text-slate-500";
      
      // 업데이트가 발생한 상태인 경우
      if (statusValue === "UPDATED" || statusValue === "UPDATE") {
        // 상태 텍스트를 UPDATE로 설정합니다.
        statusText = "UPDATE";
        // 상태 스타일을 파란색 톤으로 변경합니다.
        statusClass = "bg-indigo-100 text-indigo-700 font-bold border border-indigo-200";
      } else if (statusValue === "PENDING") { 
        // 대기 상태인 경우
        statusText = "PENDING";
        // 상태 스타일을 주황색 톤으로 변경합니다.
        statusClass = "bg-orange-100 text-orange-700 font-bold border border-orange-200";
      }
      
      // 실제 컴포넌트가 없으면 IMAGE TAG를 임의로 만들지 않습니다.
      const imageTags = item.components?.length > 0 ? item.components.map(c => c.imageTag).join('\n') : "";
      // 노트 텍스트 초기화 (없으면 '-')
      const pureNote = item.note || "-";
      
      // 완성된 단일 행 데이터를 반환합니다.
      return {
        ...item, // 기존 아이템 속성 복사
        code, // 서브버전 코드
        tag: item.version || "-", // 태그(버전)
        imageTags: imageTags, // 처리된 이미지 태그
        note: pureNote, // 담당자 정보가 제외된 노트
        statusText, // 표시할 상태 텍스트
        statusClass, // 표시할 상태 CSS 클래스
        highlighted: statusValue === "UPDATED" || statusValue === "UPDATE", // 업데이트 상태면 배경 강조
        // [최적화] Math.random()을 키로 사용하는 안티패턴을 수정하여 리액트가 안정적으로 리렌더링하도록 개선했습니다.
        key: item.id || `${versionName}_${code}`,
      };
    });
  }, [detail, versionName]); // detail과 versionName이 변경될 때만 재계산합니다.

  // 렌더링될 메인 UI 블록입니다.
  return (
    <div className="flex flex-col w-full bg-white border-b-4 border-slate-300">
      {/* 상단: 버전 정보 및 SQL/Release Note 요약 영역 */}
      <div className="px-3 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-col gap-2 shadow-sm">
        <div className="flex items-center justify-between">
          {/* 해당 테이블의 기준 버전명 표시 */}
          <span className="font-extrabold text-slate-800 text-base">버전: {versionName}</span>
        </div>
        {/* SQL 및 릴리즈 노트를 2단 컬럼으로 배치 */}
        <div className="grid grid-cols-2 gap-4 mt-1 bg-white p-2 rounded border border-slate-200">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 uppercase mb-1">SQL Script</span>
            {/* SQL 스크립트 텍스트 렌더링 */}
            <span className="text-[13px] text-slate-700 whitespace-pre-wrap break-words">{detail?.mainVersion?.sqlScript || "-"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 uppercase mb-1">Release Note</span>
            {/* 릴리즈 노트 텍스트 렌더링 */}
            <span className="text-[13px] text-slate-700 whitespace-pre-wrap break-words">{detail?.mainVersion?.releaseNote || "-"}</span>
          </div>
        </div>
      </div>
      {/* 하단: 서브버전 목록 테이블 영역 */}
      <div className="w-full">
        <table className="w-full text-left border-collapse table-fixed">
          {/* 테이블 헤더 정의 */}
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {/* 선택 가능 모드일 경우 체크박스 및 전체선택 버튼 헤더를 렌더링 */}
              {selectable && (
                <th className="px-1 py-2 w-14 text-center align-middle">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-extrabold text-slate-600 leading-none">선택</span>
                    {/* 전체 항목을 토글하는 버튼 */}
                    <button
                      type="button"
                      onClick={() => toggleAllItems && toggleAllItems(versionName, rows)}
                      disabled={selectionDisabled || !rows.some(row => row.imageTags)}
                      className="text-[10px] font-bold bg-white border border-slate-300 hover:border-indigo-400 hover:bg-slate-50 text-slate-700 px-1 py-0.5 rounded shadow-sm whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      전체선택
                    </button>
                  </div>
                </th>
              )}
              {/* 컬럼명 정의 */}
              <th className="px-2 py-3 w-[12%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">APP</th>
              <th className="px-2 py-3 w-[14%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">VERSION</th>
              <th className="px-2 py-3 w-[27%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">IMAGE TAG</th>
              <th className="px-2 py-3 text-sm font-extrabold text-slate-600 uppercase tracking-wider">NOTE</th>
              <th className="px-2 py-3 w-[15%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">STATUS</th>
            </tr>
          </thead>
          {/* 테이블 본문(행) 정의 */}
          <tbody className="divide-y divide-slate-200">
            {/* 사전에 계산된 rows 배열을 순회하며 렌더링 */}
            {rows.map((row) => {
              // 현재 항목이 장바구니(selectedItems)에 담겨있는지 여부 확인
              const isSelected = selectedItems && selectedItems.some(i => i.code === row.code && i.versionName === versionName);
              const rowSelectionDisabled = selectionDisabled || !row.imageTags;
              
              return (
                <tr key={row.key} className={`transition-colors ${row.highlighted ? "bg-indigo-50/20" : "hover:bg-slate-50"}`}>
                  {/* 체크박스 셀 렌더링 (선택 모드일 때만) */}
                  {selectable && (
                    <td className="px-2 py-3 text-center align-middle">
                      {/* 항목을 선택/해제하는 토글 버튼 */}
                      <button
                        type="button"
                        onClick={() => toggleItem({ ...row, versionName })}
                        disabled={rowSelectionDisabled}
                        title={!row.imageTags ? "IMAGE TAG가 없어 패키징 대상이 아닙니다." : selectionDisabled ? "PENDING 항목이 있어 선택할 수 없습니다." : ""}
                        className={`w-7 h-7 rounded flex items-center justify-center border-2 transition-all shadow-sm mx-auto ${
                          isSelected 
                            ? "bg-green-500 border-green-500" // 선택된 상태의 스타일
                            : "bg-white border-slate-300 hover:border-indigo-400" // 선택되지 않은 상태의 스타일
                        } ${rowSelectionDisabled ? "opacity-40 cursor-not-allowed bg-slate-100" : ""
                        }`}
                      >
                        {/* 선택 시 체크 아이콘 표시 */}
                        {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
                      </button>
                    </td>
                  )}
                  {/* APP(코드) 셀 */}
                  <td className="px-2 py-3 text-sm font-extrabold text-slate-800 align-top">
                    {row.code}
                  </td>
                  {/* VERSION 셀 */}
                  <td className="px-2 py-3 text-sm font-bold text-slate-700 align-top break-all">
                    {row.tag}
                  </td>
                  {/* IMAGE TAG 셀 */}
                  <td className="px-2 py-3 align-top break-all">
                    <div className="flex flex-col gap-1">
                      {/* 줄바꿈 단위로 이미지 태그들을 분리하여 렌더링 */}
                      {row.imageTags ? row.imageTags.split('\n').map((line, i) => (
                        <span key={i} className="text-[13px] font-bold text-slate-800 font-mono leading-tight">{line}</span>
                      )) : <span className="text-[13px] font-bold text-slate-400">없음</span>}
                    </div>
                  </td>
                  {/* NOTE 셀 */}
                  <td className="px-2 py-3 align-top break-keep text-justify">
                    <div className="flex flex-col gap-1.5">
                      {/* 노트를 줄바꿈 기준으로 나누고, 내부의 URL은 링크화하여 렌더링 */}
                      {row.note.split('\n').map((line, i) => (
                        <span key={i} className="text-[14px] font-medium text-slate-800 leading-relaxed break-words">{linkifyText(line)}</span>
                      ))}
                    </div>
                  </td>
                  {/* STATUS 셀 */}
                  <td className="px-2 py-3 align-top">
                    <span className={`inline-block px-2.5 py-1.5 rounded text-xs tracking-wide whitespace-nowrap shadow-sm ${row.statusClass}`}>
                      {/* 현재 상태 텍스트 렌더링 */}
                      {row.statusText}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==========================================
// [Main Component] 배포자(Deployer) 대시보드 메인 컴포넌트
// ==========================================
const compareVersionNames = (leftName, rightName) => {
  const parseVersionName = (versionName) => {
    const match = /^(\d{4})\.(\d{2})\.(\d{2})(?:-(\d+))?$/.exec(versionName || "");
    return match ? match.slice(1).map((value) => Number(value || 0)) : null;
  };
  const leftParts = parseVersionName(leftName);
  const rightParts = parseVersionName(rightName);

  if (!leftParts || !rightParts) {
    return String(leftName).localeCompare(String(rightName), undefined, { numeric: true });
  }
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
};

export const DeploymentPipelineDashboardSection = ({ 
  versions, 
  setSelectedVersionName,
  hasMore,
  totalVersionCount,
  loadingVersions,
  loadingMoreVersions,
  loadMoreVersions,
  searchVersionOptions,
  ensureVersionLoaded
}) => {
  // 좌측 패널의 검색어 상태를 관리합니다.
  const [leftSearch, setLeftSearch] = useState("");
  const [leftSearchResults, setLeftSearchResults] = useState(null);
  const [leftSearchLoading, setLeftSearchLoading] = useState(false);
  // 우측 패널의 검색어 상태를 관리합니다.
  const [rightSearch, setRightSearch] = useState("");
  const [rightSearchResults, setRightSearchResults] = useState(null);
  const [rightSearchLoading, setRightSearchLoading] = useState(false);
  const [selectingVersionSide, setSelectingVersionSide] = useState("");
  // [추가됨] 배포자 페이지 좌측 컴포넌트 목록 페이징 처리 상태
  const [leftPage, setLeftPage] = useState(0);
  
  // 좌측 기준 버전의 기본값을 결정합니다 (두 번째 요소가 있으면 두 번째, 없으면 첫 번째).
  // 배포자 모드에 처음 진입하면 사용자가 비교할 버전을 직접 선택하도록 비워 둡니다.
  const [leftVersionName, setLeftVersionName] = useState("");
  // 우측 패널(배포 대상)에 선택된 버전명을 관리하는 상태입니다.
  const [rightVersionName, setRightVersionName] = useState("");

  const leftVersionOptions = useMemo(() => {
    const filtered = leftSearchResults ?? versions;
    const selectedVersion = versions.find((version) => version.versionName === leftVersionName);

    return selectedVersion && !filtered.some((version) => version.versionName === leftVersionName)
      ? [selectedVersion, ...filtered]
      : filtered;
  }, [versions, leftSearchResults, leftVersionName]);

  const rightVersionOptions = useMemo(() => {
    const filtered = rightSearchResults ?? versions;
    const selectedVersion = versions.find((version) => version.versionName === rightVersionName);

    return selectedVersion && !filtered.some((version) => version.versionName === rightVersionName)
      ? [selectedVersion, ...filtered]
      : filtered;
  }, [versions, rightSearchResults, rightVersionName]);

  const versionRangeInvalid = leftVersionName
    && rightVersionName
    && compareVersionNames(rightVersionName, leftVersionName) < 0;
  
  // API 호출을 줄이기 위해 불러온 버전의 상세 정보를 임시로 저장하는 상태입니다.
  const [detailsCache, setDetailsCache] = useState({});
    const fetchingRef = useRef(new Set());
    // [추가됨] 페이지 이동 시 스크롤을 상단으로 리셋하기 위한 Ref
    
    // 패키징할 목적으로 선택된(체크된) 서브버전 아이템들을 보관하는 장바구니 상태입니다.
  const [selectedItems, setSelectedItems] = useState([]);

  // 패키징 작업이 시작되었는지를 나타내는 상태입니다.
  const [packagingStarted, setPackagingStarted] = useState(false);
  // URL 복사가 성공적으로 완료되었는지 알리기 위한 임시 상태입니다.
  const [copied, setCopied] = useState(false);
  // 백엔드에서 반환된 Job(작업)의 상세 내역 상태입니다.
  const [jobDetail, setJobDetail] = useState(null);
  // Job이 완료되었는지 확인하기 위해 폴링 중인지 여부를 나타냅니다.
  const [jobPolling, setJobPolling] = useState(false);
  // 패키징 진행 중 발생한 에러 메시지를 보관합니다.
  const [jobError, setJobError] = useState("");
  // 현재 버전이 패키징 가능한 상태인지에 대한 자격 여부 정보입니다.
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityChecking, setEligibilityChecking] = useState(false);
  // 자격 여부 확인 중 발생한 에러 메시지입니다.
  const [eligibilityError, setEligibilityError] = useState("");
  // 사용자에게 띄울 안내/경고 메시지입니다.
  const [alertMessage, setAlertMessage] = useState("");

  const handleVersionSearch = async (side) => {
    const keyword = side === "left" ? leftSearch.trim() : rightSearch.trim();
    const setResults = side === "left" ? setLeftSearchResults : setRightSearchResults;
    const setSearching = side === "left" ? setLeftSearchLoading : setRightSearchLoading;

    if (!keyword) {
      setResults(null);
      return;
    }

    setSearching(true);
    try {
      setResults(await searchVersionOptions(keyword));
    } catch (error) {
      setAlertMessage(error.payload?.message || error.message || "버전 검색 중 오류가 발생했습니다.");
    } finally {
      setSearching(false);
    }
  };

  const handleLeftVersionChange = async (versionName) => {
    if (rightVersionName && compareVersionNames(versionName, rightVersionName) > 0) {
      setAlertMessage("현재 버전은 업데이트 버전보다 최신일 수 없습니다.");
      return;
    }

    setSelectingVersionSide("left");
    try {
      const loadedVersions = await ensureVersionLoaded(versionName);
      if (!loadedVersions.some((version) => version.versionName === versionName)) {
        setAlertMessage("선택한 버전을 전체 목록에서 불러오지 못했습니다.");
        return;
      }
      setLeftVersionName(versionName);
    } catch (error) {
      setAlertMessage(error.payload?.message || error.message || "선택한 버전을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setSelectingVersionSide("");
    }
  };

  const handleRightVersionChange = async (versionName) => {
    if (leftVersionName && compareVersionNames(versionName, leftVersionName) < 0) {
      setAlertMessage("업데이트 버전은 현재 버전보다 이전일 수 없습니다.");
      return;
    }

    setSelectingVersionSide("right");
    try {
      const loadedVersions = await ensureVersionLoaded(versionName);
      if (!loadedVersions.some((version) => version.versionName === versionName)) {
        setAlertMessage("선택한 버전을 전체 목록에서 불러오지 못했습니다.");
        return;
      }
      setRightVersionName(versionName);
      setSelectedVersionName(versionName);
    } catch (error) {
      setAlertMessage(error.payload?.message || error.message || "선택한 버전을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setSelectingVersionSide("");
    }
  };

  const blockingSubVersionCodes = eligibility?.blockingSubVersionCodes || [];
  const selectionBlocked = eligibility?.eligible === false;
  const packagingDisabled = packagingStarted
    || selectedItems.length === 0
    || versionRangeInvalid
    || eligibilityChecking
    || selectionBlocked
    || !!eligibilityError;

  // [개선/최적화] 폴링 시 컴포넌트 언마운트로 인한 메모리 누수 방지 및 타이머 관리를 위한 Ref 추가
  const pollTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current); // 탭 이동 등 언마운트 시 타이머 강제 종료
    };
  }, []);

  // 선택된 기준 버전에 따라 좌/우 영역에 표시할 연관 버전 목록을 계산합니다.
  const { leftSequence, rightSequence } = useMemo(() => {
    // 버전 목록이 비어있으면 빈 배열을 반환합니다.
    if (!versions.length) return { leftSequence: [], rightSequence: [] };
    if (!leftVersionName || !rightVersionName) {
      return {
        leftSequence: [],
        rightSequence: rightVersionName ? [rightVersionName] : [],
      };
    }
    
    // 선택된 좌/우 버전의 인덱스를 찾습니다.
    const leftIdx = versions.findIndex(v => v.versionName === leftVersionName);
    const rightIdx = versions.findIndex(v => v.versionName === rightVersionName);
    
    // 어느 하나라도 목록에 없으면 선택된 것만 반환합니다.
    if (leftIdx === -1 || rightIdx === -1) return { leftSequence: [leftVersionName], rightSequence: [rightVersionName] };
    if (rightIdx > leftIdx) return { leftSequence: [], rightSequence: [rightVersionName] };
    
    // 우측 영역에는 하나의 버전만 표시합니다.
    const rSeq = [versions[rightIdx].versionName];
    // 좌측 영역에 표시할 버전들을 담을 배열입니다.
    const lSeq = [];
    // 우측 버전이 좌측 버전보다 더 최신(인덱스가 작음)인 경우, 그 사이의 변경 이력들을 좌측에 나열합니다.
    if (rightIdx < leftIdx) {
      for (let i = rightIdx + 1; i <= leftIdx; i++) {
        if (versions[i]) lSeq.push(versions[i].versionName);
      }
    } else {
      // 그렇지 않으면 좌측 기준 버전 하나만 나열합니다.
      lSeq.push(versions[leftIdx].versionName);
    }
    
    // 계산된 좌/우 배열들을 반환합니다.
    return { leftSequence: lSeq, rightSequence: rSeq };
  }, [versions, leftVersionName, rightVersionName]); // 의존성 배열에 관련 상태 포함

  // 부모로부터 받은 versions가 업데이트될 때 선택된 버전들이 유효한지 검증하는 사이드 이펙트입니다.
  useEffect(() => {
    if (versions && versions.length > 0) {
      // 우측 버전이 목록에 없는 경우 첫 번째 버전으로 재설정합니다.
      if (rightVersionName && !versions.find(v => v.versionName === rightVersionName)) {
        setRightVersionName("");
        if (setSelectedVersionName) setSelectedVersionName("");
      }
      // 좌측 버전이 목록에 없는 경우 적절한 인덱스의 버전으로 재설정합니다.
      if (leftVersionName && !versions.find(v => v.versionName === leftVersionName)) {
        setLeftVersionName("");
      }
    }
  }, [versions, rightVersionName, leftVersionName, setSelectedVersionName]);

  useEffect(() => {
    setLeftPage(0);
  }, [leftVersionName, rightVersionName]);

  useEffect(() => {
    setLeftPage(prev => Math.min(prev, Math.max(leftSequence.length - 1, 0)));
  }, [leftSequence.length]);

  const currentLeftVersion = leftSequence[leftPage] || "";

  // [개선/최적화] 이전 코드에서는 detailsCache 자체를 의존성에 두고 있어 무한 루프의 위험이 있었습니다.
  // 상태 업데이트 시 함수형 업데이트(functional update)를 사용하여 의존성 배열에서 detailsCache를 제거하고 성능과 안정성을 높였습니다.
      useEffect(() => {
    const fetchDetails = async () => {
      const needed = [...new Set([currentLeftVersion, ...rightSequence])].filter(Boolean);
      
      const toFetch = needed.filter(v => detailsCache[v] === undefined && !fetchingRef.current.has(v));
      if (toFetch.length === 0) return;

      toFetch.forEach(v => fetchingRef.current.add(v));

      setDetailsCache(prev => {
        let next = { ...prev };
        toFetch.forEach(v => { next[v] = "loading"; });
        return next;
      });

      for (const ver of toFetch) {
        try {
          const detail = await getMainVersionDetail(ver);
          setDetailsCache(curr => ({ ...curr, [ver]: detail }));
        } catch (e) {
          setDetailsCache(curr => ({ ...curr, [ver]: null }));
        } finally {
          fetchingRef.current.delete(ver);
        }
      }
    };
    fetchDetails();
  }, [currentLeftVersion, rightSequence]); // detailsCache 의존성 제거 완료

  // 우측(배포 대상) 버전이 변경될 때마다 해당 버전의 패키징 자격 및 현재 Job 상태를 확인합니다.
  useEffect(() => {
    let cancelled = false;
    const checkRightVersionStatus = async () => {
      // 1. 패키징 가능 여부(Eligibility) 확인
      setEligibilityChecking(true);
      setEligibility(null);
      try {
        const elig = await getPackagingEligibility(rightVersionName);
        if (!cancelled) {
          setEligibility(elig);
          setEligibilityError(""); // 에러 초기화
        }
      } catch (err) {
        if (!cancelled) {
          setEligibility(null);
          // 에러 메시지 추출
          setEligibilityError(err.payload?.message || err.message || "패키징 가능 여부를 확인하는 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) setEligibilityChecking(false);
      }
      // 2. 진행 중이거나 완료된 패키지 Job 조회
      try {
        const j = await getPackageJob(rightVersionName);
        if (!cancelled) setJobDetail(j); // Job 상태 업데이트
      } catch {
        if (!cancelled) setJobDetail(null); // 에러 발생 시 Job 정보 없음 처리
      }
    };
    // 우측 버전이 유효하면 확인 시작
    if (rightVersionName) {
      checkRightVersionStatus();
    } else {
      setEligibility(null);
      setEligibilityChecking(false);
      setJobDetail(null);
    }
    return () => { cancelled = true; };
  }, [rightVersionName]); // 우측 버전이 변경될 때만 실행

  useEffect(() => {
    setSelectedItems([]);
  }, [rightVersionName]);

  useEffect(() => {
    if (selectionBlocked) setSelectedItems([]);
  }, [selectionBlocked]);

  // 개별 서브버전 아이템을 장바구니에 추가/제거(토글)하는 함수입니다.
  const toggleItem = (item) => {
    if (selectionBlocked || !item.imageTags) return;
    setSelectedItems(prev => {
      // 기존 배열에 동일한 아이템이 있는지 검사합니다.
      const exists = prev.some(i => i.code === item.code && i.versionName === item.versionName);
      if (exists) {
        // 이미 있으면 필터링하여 제거합니다.
        return prev.filter(i => !(i.code === item.code && i.versionName === item.versionName));
      } else {
        // 없으면 배열 끝에 추가합니다.
        return [...prev, item];
      }
    });
  };

  // 특정 버전에 속한 모든 서브버전을 한 번에 장바구니에 넣거나 빼는 전체 선택 함수입니다.
  const toggleAllItems = (vName, rows) => {
    if (selectionBlocked) return;
    const packageableRows = rows.filter(row => row.imageTags);
    setSelectedItems(prev => {
      // 현재 장바구니에서 해당 버전에 속한 항목들만 추려냅니다.
      const currentSelectedForVersion = prev.filter(i => i.versionName === vName);
      // 현재 장바구니에서 해당 버전에 속하지 않은 다른 항목들을 추려냅니다.
      const newSelected = prev.filter(i => i.versionName !== vName);
      
      // 만약 해당 버전의 모든 행(row)이 이미 선택되어 있다면
      if (packageableRows.length > 0 && currentSelectedForVersion.length === packageableRows.length) {
        // 전부 선택 해제 처리합니다.
        return newSelected;
      } else {
        // 그렇지 않다면, 버전명 속성을 부여하여 전부 선택 상태로 만들어 추가합니다.
        const itemsToAdd = packageableRows.map(row => ({ ...row, versionName: vName }));
        return [...newSelected, ...itemsToAdd];
      }
    });
  };

  // 배포 성공 시 반환되는 URL 목록을 렌더링하기 쉽게 포맷팅하는 메모이제이션 데이터입니다.
  const deploymentUrls = useMemo(() => {
    // 항목 배열이 없거나 유효하지 않으면 빈 배열 반환
    if (!jobDetail?.items || !Array.isArray(jobDetail.items)) return [];
    // fileUrl이 존재하는 항목만 추출하여 매핑합니다.
    return jobDetail.items
      .filter(item => item.fileUrl)
      .map(item => ({
        imageTag: item.imageTag,
        fileUrl: item.fileUrl,
      }));
  }, [jobDetail]); // jobDetail이 변경될 때만 재계산

  // [개선/최적화] 이전 코드의 재귀적 setTimeout 호출 시, 컴포넌트 언마운트 시 상태 변경을 시도하는 메모리 누수가 발생할 수 있었습니다.
  // 추가된 마운트 상태(isMountedRef)를 확인하고, 진행 중인 타이머를(pollTimerRef) 해제할 수 있도록 최적화했습니다.
  const pollJob = useCallback(async () => {
    if (!isMountedRef.current) return; // 언마운트 시 즉시 폴링 종료 (메모리 보호)

    try {
      // 패키지 작업 상태 API 호출
      const j = await getPackageJob(rightVersionName);
      
      if (!isMountedRef.current) return; // API 응답 대기 중 화면을 이탈했을 경우를 대비한 가드

      // 작업 상태 업데이트
      setJobDetail(j);
      const status = j?.job?.status || j?.status || "";
      
      // 완료(DONE) 또는 실패(FAILED)인 경우 폴링 루프 중지
      if (status === "DONE" || status === "FAILED") {
        setJobPolling(false);
        setPackagingStarted(false);
        return;
      }
      
      // 아직 진행 중이라면 5초 뒤 다시 폴링 (이전 타이머가 있다면 삭제 방어)
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = setTimeout(pollJob, 5000);
      
    } catch (err) {
      if (!isMountedRef.current) return; // 에러 캐치 직후에도 언마운트 확인
      
      // 에러가 발생한 경우 상태를 기록하고 폴링 종료
      setJobError(err.message);
      setJobPolling(false);
      setPackagingStarted(false);
    }
  }, [rightVersionName]); // 우측 버전에 의존성을 가집니다.

  // [최적화] 비동기 즉시 실행 함수(IIFE) 패턴을 제거하고, 함수 자체를 async/await로 수정하여 가독성을 높였습니다.
  // 사용자가 선택한 항목들을 패키징해달라고 백엔드에 요청하는 핵심 핸들러입니다.
  const handleStartPackaging = async () => {
    if (eligibilityChecking || !eligibility) {
      setAlertMessage("패키징 가능 여부를 확인한 후 다시 시도해주세요.");
      return;
    }
    // 장바구니가 비어있는지 확인합니다.
    if (selectedItems.length === 0) {
      setAlertMessage("패키징할 신규 변경사항을 장바구니에 담아주세요 (오른쪽 패널에서 체크).");
      return; // 비어있다면 중단합니다.
    }
    // 사전에 에러(예: API 실패 등)로 인해 자격 확인을 실패한 경우
    if (eligibilityError) {
      setAlertMessage(eligibilityError);
      return; // 중단
    }
    // 현재 버전이 패키징 자격이 없는 상태인 경우
    if (eligibility && eligibility.eligible === false) {
      setAlertMessage(eligibility.reason || "이 메인버전은 현재 패키징 가능 상태가 아닙니다.");
      return; // 중단
    }
    
    // 선택된 아이템들로부터 빌드할 대상 이미지 태그들을 모두 모읍니다 (개행으로 분리된 것들도 평탄화).
    const tagsToPackage = selectedItems
      .flatMap(i => (i.imageTags || "").split('\n'))
      .map(t => t.trim())
      .filter(Boolean); // 유효한 값만 남깁니다.

    // 패키징 시작 상태를 켭니다 (로딩 스피너 활성화).
    setPackagingStarted(true);
    // 기존 발생했던 에러 메시지를 초기화합니다.
    setJobError("");
    
    try {
      // API에 전달할 요청 본문을 생성합니다.
      // 패키징 요청 본문을 구성합니다 (작성자명 미포함 - 회의 결정 사항).
      const body = { imageTags: tagsToPackage };
      // 패키지 작업 생성 API를 호출합니다.
      const res = await createPackageJob(rightVersionName, body);
      // 결과를 저장합니다.
      setJobDetail(res || null);
      // 폴링 플래그를 켭니다.
      setJobPolling(true);
      // 폴링 루프를 시작합니다.
      pollJob();
    } catch (err) {
      // 에러 발생 시 UI에 에러를 표시하고 로딩 상태를 해제합니다.
      setJobError(err.payload?.message || err.message || "패키지 Job 생성 중 오류가 발생했습니다.");
      setAlertMessage(err.payload?.message || err.message || "패키지 Job 생성 중 오류가 발생했습니다.");
      setPackagingStarted(false);
    }
  };

  // 실패한 패키지 작업을 재시도하는 핸들러입니다.
  const handleRetry = async () => {
    // 에러 상태를 초기화합니다.
    setJobError("");
    // 로딩 상태를 활성화합니다.
    setPackagingStarted(true);
    try {
      // 재시도 API를 호출합니다 (이전에 넘긴 태그 정보를 서버가 알 수 있도록 재요청).
      const res = await retryPackageJob(rightVersionName, { imageTags: [], force: true });
      // 상태 업데이트 후 다시 폴링을 시작합니다.
      setJobDetail(res || null);
      setJobPolling(true);
      pollJob();
    } catch (err) {
      // 실패 시 사용자에게 알림을 표시합니다.
      setJobError(err.payload?.message || err.message || "재시도 요청 중 오류가 발생했습니다.");
      setAlertMessage(err.payload?.message || err.message || "재시도 요청 중 오류가 발생했습니다.");
      setPackagingStarted(false);
    }
  };

  // 생성된 배포 URL 전부를 클립보드에 일괄 복사하는 기능입니다.
  const handleCopyAll = async () => {
    // URL 목록이 있으면 파일 URL들을 수집하고, 없으면 선택된 이미지 태그들을 수집합니다.
    const urls = deploymentUrls.length > 0
      ? deploymentUrls.map((r) => r.fileUrl).join("\n")
      : selectedItems.map((r) => r.imageTags).filter(Boolean).join("\n");

    if (urls) {
      // 복사 유틸리티를 호출합니다.
      await copyToClipboard(urls);
      // '복사 완료' 텍스트를 보여주기 위해 상태를 토글합니다.
      setCopied(true);
      // 1.8초 뒤에 원래 상태로 되돌립니다.
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      // 복사할 대상이 없으면 알림을 띄웁니다.
      setAlertMessage("복사할 항목이 없습니다.");
    }
  };

  // 최상위 JSX 구조 렌더링 영역입니다.
  return (
    <div className="flex flex-col w-full bg-slate-100 p-4 gap-6">
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-sm font-bold text-slate-600">
          {loadingVersions
            ? "버전 목록을 불러오는 중입니다."
            : `버전 ${versions.length} / ${totalVersionCount}개 불러옴`}
        </span>
        {hasMore && (
          <button
            type="button"
            onClick={loadMoreVersions}
            disabled={loadingMoreVersions}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-extrabold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMoreVersions ? "불러오는 중..." : "버전 더 불러오기"}
          </button>
        )}
      </div>
      {versionRangeInvalid && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          업데이트 버전은 현재 버전과 같거나 더 최신이어야 합니다.
        </div>
      )}
      
      {/* 메인 좌우 분할 영역 (이전 버전 비교 및 최신 버전 선택) */}
      <div className="w-full flex flex-col xl:flex-row gap-6">
        
        {/* 좌측 영역: 이전 버전 기록 (버전별 매니페스트 변경 이력을 세로로 길게 표시) */}
        <section className="flex-1 min-w-0 bg-white rounded-xl border border-slate-300 shadow-md flex flex-col h-[820px]">
          {/* 상단 툴바 및 필터 영역 */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 sticky top-0 z-20">
            <div className="flex items-center gap-2">
              <ListIcon className="w-6 h-6 text-[#000666]" />
              <h2 className="text-xl font-extrabold text-slate-800">현재 버전</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* 좌측 검색 입력창 */}
              <input 
                type="text" 
                placeholder={leftSearchLoading ? "서버 검색 중..." : "전체 버전 검색 후 Enter"}
                value={leftSearch}
                onChange={(e) => setLeftSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVersionSearch("left")}
                disabled={leftSearchLoading}
                className="flex-1 min-w-[180px] appearance-none rounded-lg border border-slate-300 bg-white py-2 px-3 text-base font-bold text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-shadow"
              />
              {/* 좌측 버전 선택 드롭다운 */}
              <select
                value={leftVersionName}
                onChange={(e) => handleLeftVersionChange(e.target.value)}
                disabled={selectingVersionSide === "left"}
                className="flex-[2] min-w-[200px] appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-base font-bold text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-shadow cursor-pointer"
              >
                <option value="" disabled>버전을 선택하세요</option>
                {leftVersionOptions.length === 0 && <option value="" disabled>검색 결과가 없습니다</option>}
                {leftVersionOptions.map(v => {
                  const disabled = !!rightVersionName && compareVersionNames(v.versionName, rightVersionName) > 0;
                  return (
                    <option key={v.versionName} value={v.versionName} disabled={disabled}>
                      {v.versionName}{disabled ? " (업데이트 버전보다 최신)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {leftSequence.length > 0 && (
            <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setLeftPage(page => Math.max(page - 1, 0))}
                disabled={leftPage === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                이전 버전
              </button>
              <div className="text-center min-w-0">
                <div className="text-sm font-extrabold text-[#000666] truncate">{currentLeftVersion}</div>
                <div className="text-xs font-bold text-slate-500">{leftPage + 1} / {leftSequence.length}</div>
              </div>
              <button
                type="button"
                onClick={() => setLeftPage(page => Math.min(page + 1, leftSequence.length - 1))}
                disabled={leftPage >= leftSequence.length - 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음 버전
              </button>
            </div>
          )}
          
          {/* 하단 버전 목록 리스트 렌더링 영역 */}
          <div className="flex-1 flex flex-col bg-slate-100 overflow-y-auto">
            {currentLeftVersion ? (
              <ManifestTable 
                key={`left-${currentLeftVersion}`}
                versionName={currentLeftVersion}
                detail={detailsCache[currentLeftVersion] === "loading" ? undefined : detailsCache[currentLeftVersion]}
                selectable={false}
              />
            ) : (
              <div className="flex items-center justify-center p-12 text-base font-bold text-slate-400">
                {!leftVersionName || !rightVersionName
                  ? "왼쪽과 오른쪽에서 비교할 버전을 선택해주세요."
                  : "선택한 범위에 해당하는 이전 버전이 없습니다."}
              </div>
            )}
          </div>
        </section>

        {/* 우측 영역: 배포 대상 최신 버전 (패키징할 서브버전을 선택하는 단일 테이블 영역) */}
        <section className="flex-1 min-w-0 bg-white rounded-xl border-2 border-indigo-200 shadow-lg flex flex-col h-[820px]">
          {/* 상단 툴바 및 필터 영역 */}
          <div className="p-4 border-b border-indigo-100 bg-indigo-50/60 flex flex-col gap-3 sticky top-0 z-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MonitorIcon className="w-6 h-6 text-indigo-700" />
                <h2 className="text-xl font-extrabold text-indigo-900">업데이트 버전</h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* 우측 검색 입력창 */}
              <input 
                type="text" 
                placeholder={rightSearchLoading ? "서버 검색 중..." : "전체 버전 검색 후 Enter"}
                value={rightSearch}
                onChange={(e) => setRightSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVersionSearch("right")}
                disabled={rightSearchLoading}
                className="flex-1 min-w-[180px] appearance-none rounded-lg border border-indigo-200 bg-white py-2 px-3 text-base font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              />
              {/* 우측 버전 선택 드롭다운 */}
              <select
                value={rightVersionName}
                onChange={(e) => handleRightVersionChange(e.target.value)}
                disabled={selectingVersionSide === "right"}
                className="flex-[2] min-w-[200px] appearance-none rounded-lg border border-indigo-200 bg-white py-2 pl-3 pr-8 text-base font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow cursor-pointer"
              >
                <option value="" disabled>버전을 선택하세요</option>
                {rightVersionOptions.length === 0 && <option value="" disabled>검색 결과가 없습니다</option>}
                {rightVersionOptions.map(v => {
                  const disabled = !!leftVersionName && compareVersionNames(v.versionName, leftVersionName) < 0;
                  return (
                    <option key={v.versionName} value={v.versionName} disabled={disabled}>
                      {v.versionName}{disabled ? " (현재 버전보다 이전)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {rightVersionName && (eligibilityChecking || selectionBlocked || eligibilityError) && (
            <div className={`mx-4 mt-4 rounded-lg border px-4 py-3 text-sm font-bold ${
              selectionBlocked || eligibilityError
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}>
              {eligibilityChecking
                ? "패키징 가능 여부를 확인하고 있습니다."
                : selectionBlocked
                  ? `PENDING 항목이 있어 패키징할 수 없습니다: ${blockingSubVersionCodes.map(code => code.toUpperCase()).join(", ")}`
                  : eligibilityError}
            </div>
          )}
          
          {/* 하단 버전 상세 정보 및 선택 가능한 테이블 영역 */}
          <div className="flex-1 flex flex-col bg-white overflow-y-auto">
            {rightSequence.map(vName => (
              // 배포 대상이 되는 최신 버전을 그립니다 (선택 가능 모드).
              <ManifestTable 
                key={`right-${vName}`}
                versionName={vName}
                detail={detailsCache[vName] === "loading" ? undefined : detailsCache[vName]}
                selectable={true}
                selectedItems={selectedItems}
                toggleItem={toggleItem}
                toggleAllItems={toggleAllItems}
                selectionDisabled={versionRangeInvalid || eligibilityChecking || selectionBlocked || !!eligibilityError}
              />
            ))}
          </div>
        </section>

      </div>

      {/* 하단 영역: 배포 결과 및 로그 (좌측) & 패키징 액션 버튼 (우측) */}
      <section className="bg-white rounded-xl border border-slate-300 shadow-lg p-5 flex flex-col xl:flex-row gap-6">
        {/* 좌측 패널: 배포 결과 및 파일 URL 링크 표시 */}
        <div className="w-full xl:w-2/3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-6 h-6 text-green-500" />
              <h3 className="text-xl font-extrabold text-slate-800">배포 결과 및 URL</h3>
            </div>
            <div className="flex items-center gap-2">
              {/* 전체 결과 복사 버튼 */}
              <button 
                onClick={handleCopyAll}
                className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors border border-indigo-200 shadow-sm"
              >
                <CopyIcon className="w-4 h-4" />
                {copied ? "복사 완료!" : "전체 복사"}
              </button>
              {/* 이전 작업이 실패했을 경우 보여지는 재시도 버튼 */}
              {jobDetail?.job?.status === "FAILED" && (
                <button
                  onClick={handleRetry}
                  disabled={packagingStarted}
                  className="flex items-center gap-1.5 text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg transition-colors border border-red-200 shadow-sm"
                >
                  <ClockIcon className={`w-4 h-4 ${packagingStarted ? "animate-spin" : ""}`} />
                  재시도
                </button>
              )}
            </div>
          </div>
          
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col gap-3 max-h-[220px] overflow-y-auto">
            {/* 에러 발생 시 경고 상자 표시 */}
            {jobError && (
              <div className="text-base font-bold text-red-600 p-3 bg-red-50 rounded-lg border border-red-200">
                {jobError}
              </div>
            )}
            
            {/* 결과 폴더(OneDrive/SharePoint 등) URL이 있다면 표시 */}
            {jobDetail?.job?.spFolderUrl && (
              <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-extrabold text-slate-500 uppercase mb-0.5 tracking-wider">OneDrive Folder</span>
                  <a href={jobDetail.job.spFolderUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-mono font-bold text-slate-700 hover:text-indigo-600 underline truncate">
                    {jobDetail.job.spFolderUrl}
                  </a>
                </div>
                {/* 개별 복사 버튼 */}
                <button onClick={() => copyToClipboard(jobDetail.job.spFolderUrl)} className="p-2 text-slate-400 hover:text-indigo-600 ml-3 rounded hover:bg-indigo-50 transition-colors">
                  <CopyIcon className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* 개별 배포 파일 URL 목록을 렌더링합니다. */}
            {deploymentUrls.length > 0 ? (
              deploymentUrls.map((res) => (
                <div key={res.imageTag} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-extrabold text-green-600 uppercase mb-0.5 tracking-wider">{res.imageTag}</span>
                    <span className="text-sm font-mono font-bold text-slate-700 truncate">{res.fileUrl}</span>
                  </div>
                  {/* 개별 복사 버튼 */}
                  <button onClick={() => copyToClipboard(res.fileUrl)} className="p-2 text-slate-400 hover:text-indigo-600 ml-3 rounded hover:bg-indigo-50 transition-colors">
                    <CopyIcon className="w-5 h-5" />
                  </button>
                </div>
              ))
            ) : packagingStarted ? (
              // 패키징 진행 중 표시되는 안내 문구
              <div className="flex items-center justify-center h-16 text-base font-bold text-indigo-600 animate-pulse">
                패키징이 진행중입니다. 잠시만 기다려주세요...
              </div>
            ) : (
              // 대기 상태 표시 문구
              <div className="flex items-center justify-center h-16 text-sm font-bold text-slate-400 italic">
                패키징을 시작하면 결과 URL이 여기에 표시됩니다.
              </div>
            )}
          </div>
        </div>

        {/* 우측 패널: 선택된 장바구니 내역 및 패키징 시작 버튼 */}
        <div className="w-full xl:w-1/3 flex flex-col justify-between xl:border-l border-slate-200 xl:pl-6 gap-3">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCartIcon className="w-5 h-5 text-slate-700" />
                <span className="font-extrabold text-lg text-slate-800">패키징 장바구니</span>
              </div>
              {/* 장바구니 비우기(초기화) 버튼 */}
              {selectedItems.length > 0 && (
                <button
                  onClick={() => setSelectedItems([])}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded transition-colors shadow-sm"
                >
                  초기화
                </button>
              )}
            </div>
            {/* 담긴 아이템 목록 칩(Chip) 렌더링 */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 flex-1 p-2.5 max-h-[90px] overflow-y-auto">
              {selectedItems.length === 0 ? (
                // 비어있는 경우
                <div className="flex items-center justify-center h-full text-sm font-bold text-slate-400">
                  선택된 항목이 없습니다.
                </div>
              ) : (
                // 항목이 있는 경우
                <div className="flex flex-wrap gap-1.5">
                  {selectedItems.map((item, idx) => (
                    <span key={idx} className="bg-indigo-100 border border-indigo-200 text-indigo-800 px-2 py-1 rounded text-xs font-extrabold shadow-sm">
                      {item.versionName} - {item.code}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* 패키징 시작 메인 액션 버튼 */}
          <button
            onClick={handleStartPackaging}
            disabled={packagingDisabled}
            className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all duration-200 shrink-0 ${
              packagingDisabled
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" 
                : "bg-[#000666] text-white hover:bg-[#090d82] active:scale-[0.98] active:shadow-sm"
            }`}
          >
            {/* 상태에 따라 스피너 또는 플레이 아이콘 표시 */}
            {packagingStarted ? <ClockIcon className="w-6 h-6 animate-spin" /> : <PlayIcon className="w-6 h-6 fill-current" />}
            <span className="text-xl font-extrabold uppercase tracking-wide">
              {packagingStarted ? "진행중..." : "패키징 시작"}
            </span>
          </button>
        </div>
      </section>

      <AlertModal
        isOpen={!!alertMessage}
        message={alertMessage}
        type="warning"
        onClose={() => setAlertMessage("")}
      />
    </div>
  );
};
