import { useState, useEffect, useMemo, useCallback, useRef } from "react";
// UI 구성요소 및 아이콘을 임포트합니다.
import { AlertModal } from "../../components/ui/AlertModal";
import { VersionDropdown } from "../../components/ui/VersionDropdown";
// 백엔드 API 호출을 위한 서비스 함수들을 임포트합니다.
import { getMainVersionDetail, getPackagingEligibility, createPackageJob, getPackageJob } from "../../services/api";

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
        // 상태 텍스트를 UPDATED로 설정합니다.
        statusText = "UPDATED";
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
      <div className="h-[154px] shrink-0 px-3 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-col gap-2 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between">
          {/* 해당 테이블의 기준 버전명 표시 */}
          <span className="font-extrabold text-slate-800 text-base">VERSION: {versionName}</span>
        </div>
        {/* SQL 및 릴리즈 노트를 2단 컬럼으로 배치 */}
        <div className="grid grid-cols-2 gap-4 mt-1 bg-white p-2 rounded border border-slate-200 flex-1 min-h-0">
          <div className="flex flex-col min-w-0 min-h-0">
            <span className="text-xs font-bold text-slate-500 uppercase mb-1">SQL Script</span>
            {/* SQL 스크립트 텍스트 렌더링 */}
            <span className="text-[13px] text-slate-700 whitespace-pre-wrap break-words overflow-y-auto">{detail?.mainVersion?.sqlScript || "-"}</span>
          </div>
          <div className="flex flex-col min-w-0 min-h-0">
            <span className="text-xs font-bold text-slate-500 uppercase mb-1">Release Note</span>
            {/* 릴리즈 노트 텍스트 렌더링 */}
            <span className="text-[13px] text-slate-700 whitespace-pre-wrap break-words overflow-y-auto">{detail?.mainVersion?.releaseNote || "-"}</span>
          </div>
        </div>
      </div>
      {/* 하단: 서브버전 목록 테이블 영역 */}
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[760px] text-left border-collapse table-fixed">
          {/* 테이블 헤더 정의 */}
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="h-[60px]">
              {/* 좌우 열 위치를 맞추기 위해 선택 열은 양쪽 모두 동일한 폭으로 유지합니다. */}
              <th className="px-1 py-2 w-14 text-center align-middle">
                {selectable ? (
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
                ) : (
                  <span className="text-xs font-extrabold text-slate-400">비교</span>
                )}
              </th>
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
                <tr key={row.key} className={`h-[96px] transition-colors ${row.highlighted ? "bg-indigo-50/20" : "hover:bg-slate-50"}`}>
                  {/* 선택 가능 여부와 관계없이 같은 폭의 첫 번째 열을 유지합니다. */}
                  <td className="px-2 py-3 text-center align-middle">
                    {selectable ? (
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
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  {/* APP(코드) 셀 */}
                  <td className="h-[96px] px-2 py-3 text-sm font-extrabold text-slate-800 align-top overflow-hidden">
                    {row.code}
                  </td>
                  {/* VERSION 셀 */}
                  <td className="h-[96px] px-2 py-3 text-sm font-bold text-slate-700 align-top break-all overflow-hidden">
                    <div className="max-h-[72px] overflow-y-auto">{row.tag}</div>
                  </td>
                  {/* IMAGE TAG 셀 */}
                  <td className="h-[96px] px-2 py-3 align-top break-all overflow-hidden">
                    <div className="flex max-h-[72px] flex-col gap-1 overflow-y-auto">
                      {/* 줄바꿈 단위로 이미지 태그들을 분리하여 렌더링 */}
                      {row.imageTags ? row.imageTags.split('\n').map((line, i) => (
                        <span key={i} className="text-[13px] font-bold text-slate-800 font-mono leading-tight">{line}</span>
                      )) : <span className="text-[13px] font-bold text-slate-400">없음</span>}
                    </div>
                  </td>
                  {/* NOTE 셀 */}
                  <td className="h-[96px] px-2 py-3 align-top break-keep text-justify overflow-hidden">
                    <div className="flex max-h-[72px] flex-col gap-1.5 overflow-y-auto">
                      {/* 노트를 줄바꿈 기준으로 나누고, 내부의 URL은 링크화하여 렌더링 */}
                      {row.note.split('\n').map((line, i) => (
                        <span key={i} className="text-[14px] font-medium text-slate-800 leading-relaxed break-words">{linkifyText(line)}</span>
                      ))}
                    </div>
                  </td>
                  {/* STATUS 셀 */}
                  <td className="h-[96px] px-2 py-3 align-top overflow-hidden">
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
/**
 * YYYY.MM.DD와 YYYY.MM.DD-N을 숫자 단위로 비교합니다.
 * 형식이 다른 레거시 값은 numeric localeCompare로 폴백해 화면이 중단되지 않게 합니다.
 */
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

// API 오류 상세는 엔드포인트에 따라 문자열·배열·객체로 올 수 있어 사용자 표시용 문자열로 정규화합니다.
const formatErrorDetail = (detail) => {
  if (detail == null || detail === "") return "";
  if (Array.isArray(detail)) {
    return detail.map((item) => `- ${typeof item === "object" ? JSON.stringify(item) : item}`).join("\n");
  }
  if (typeof detail === "object") {
    return Object.entries(detail).map(([key, value]) => {
      const formattedValue = Array.isArray(value)
        ? value.join(", ")
        : typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : String(value);
      return `${key}: ${formattedValue}`;
    }).join("\n");
  }
  return String(detail);
};

// 패키징 API의 실제 계약은 details(복수)를 사용하며, 기존/다른 오류 응답의 detail(단수)도 호환합니다.
const getErrorDetail = (error) => error?.payload?.details ?? error?.payload?.detail;

const getJobErrorData = (error, fallback) => {
  const message = error?.payload?.message || error?.message || fallback;
  const detail = formatErrorDetail(getErrorDetail(error));
  return { message, detail };
};

// 레지스트리에서 찾지 못한 IMAGE TAG를 장바구니 행과 역매칭해 사용자가 수정할 APP을 함께 보여줍니다.
const getRegistryErrorItems = (detail, selectedItems) => {
  const imageTags = Array.isArray(detail)
    ? detail.filter((item) => typeof item === "string")
    : [];

  return imageTags.map((imageTag) => {
    const matchingItem = selectedItems.find((item) => (item.imageTags || "")
      .split("\n")
      .map((tag) => tag.trim())
      .includes(imageTag));
    return {
      app: matchingItem?.code || "APP 확인 필요",
      imageTag,
    };
  });
};

export const DeploymentPipelineDashboardSection = ({ 
  versions, 
  setSelectedVersionName,
  hasMore,
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
  // 백엔드에서 반환된 Job(작업)의 상세 내역 상태입니다.
  const [jobDetail, setJobDetail] = useState(null);
  // Job이 완료되었는지 확인하기 위해 폴링 중인지 여부를 나타냅니다.
  const [jobPolling, setJobPolling] = useState(false);
  // 패키징 진행 중 발생한 에러 메시지를 보관합니다.
  const [jobError, setJobError] = useState("");
  const [jobErrorDetail, setJobErrorDetail] = useState("");
  const [jobErrorItems, setJobErrorItems] = useState([]);
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
  // 패키징 버튼은 단순히 장바구니 유무만 보지 않고 범위·자격 조회·PENDING 상태를 모두 통과해야 활성화합니다.
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

  // versions는 서버 최신순 정렬을 유지합니다. 따라서 두 인덱스 사이가 곧 비교해야 할 메인버전 범위입니다.
  // 우측은 최종 업데이트 버전 1개, 좌측은 그 사이 이력을 버전별 페이지로 보여줍니다.
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

  // 비교 기준이 바뀌면 이전 범위의 페이지 번호를 재사용하지 않도록 첫 페이지로 돌아갑니다.
  useEffect(() => {
    setLeftPage(0);
  }, [leftVersionName, rightVersionName]);

  // 추가 페이지 로딩 등으로 비교 범위 길이가 바뀌어도 현재 페이지가 범위를 벗어나지 않게 보정합니다.
  useEffect(() => {
    setLeftPage(prev => Math.min(prev, Math.max(leftSequence.length - 1, 0)));
  }, [leftSequence.length]);

  const currentLeftVersion = leftSequence[leftPage] || "";

  // 현재 좌측 페이지와 우측 버전에 필요한 상세만 지연 조회합니다.
  // fetchingRef는 React 재렌더 사이에도 진행 중 요청을 기억해 같은 버전의 중복 조회를 막습니다.
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

  // 우측 버전은 실제 패키징 대상이므로 선택 즉시 자격(PENDING 포함)과 기존 JOB을 함께 확인합니다.
  // cancelled 가드는 빠르게 버전을 바꿨을 때 이전 응답이 최신 선택 상태를 덮어쓰는 경쟁 조건을 막습니다.
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

  // 다른 업데이트 버전의 항목이 섞여 패키징되지 않도록 대상 버전 변경 시 장바구니를 비웁니다.
  useEffect(() => {
    setSelectedItems([]);
  }, [rightVersionName]);

  // 패키징 오류는 선택 당시 버전에 종속되므로 좌우 버전이 바뀌면 이전 오류를 제거합니다.
  useEffect(() => {
    setJobError("");
    setJobErrorDetail("");
    setJobErrorItems([]);
  }, [leftVersionName, rightVersionName]);

  // 자격 조회 결과 PENDING 등이 확인되면 이미 선택했던 항목도 즉시 제거합니다.
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

  // 전체 선택에서도 IMAGE TAG가 없는 EXT 등의 행은 API 요청 대상에 포함하지 않습니다.
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
      const errorData = getJobErrorData(err, "패키징 상태 조회 중 오류가 발생했습니다.");
      setJobError(errorData.message);
      setJobErrorDetail(errorData.detail);
      setJobErrorItems([]);
      setJobPolling(false);
      setPackagingStarted(false);
    }
  }, [rightVersionName]); // 우측 버전에 의존성을 가집니다.

  // 모든 화면 가드를 다시 확인한 뒤 선택된 IMAGE TAG만 JOB 생성 API로 전송합니다.
  // 버튼 disabled만 신뢰하지 않고 핸들러에서도 검증해 키보드/비동기 상태 변화에 대비합니다.
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
    setJobErrorDetail("");
    setJobErrorItems([]);
    
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
      const errorData = getJobErrorData(err, "패키지 Job 생성 중 오류가 발생했습니다.");
      setJobError(errorData.message);
      setJobErrorDetail(errorData.detail);
      setJobErrorItems(getRegistryErrorItems(getErrorDetail(err), selectedItems));
      setAlertMessage(errorData.message);
      setPackagingStarted(false);
    }
  };

  // 최상위 JSX 구조 렌더링 영역입니다.
  return (
    <div className="flex flex-col w-full bg-[#e9eef5] p-4 gap-6">
      {versionRangeInvalid && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          업데이트 버전은 현재 버전과 같거나 더 최신이어야 합니다.
        </div>
      )}

      {/* 패키징 장바구니와 실행 영역 */}
      <section className="bg-white rounded-xl border border-slate-400 shadow-lg p-5 flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-extrabold text-lg text-slate-800">패키징 장바구니</span>
            </div>
            {selectedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedItems([])}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded transition-colors shadow-sm"
              >
                초기화
              </button>
            )}
          </div>
          <div className="min-h-[62px] max-h-[110px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2.5">
            {selectedItems.length === 0 ? (
              <div className="flex h-full min-h-[40px] items-center justify-center text-sm font-bold text-slate-400">
                오른쪽 업데이트 버전에서 패키징할 APP을 선택해주세요.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedItems.map((item) => (
                  <span key={`${item.versionName}-${item.code}`} className="rounded border border-indigo-200 bg-indigo-100 px-2 py-1 text-xs font-extrabold text-indigo-800 shadow-sm">
                    {item.versionName} - {item.code}
                  </span>
                ))}
              </div>
            )}
          </div>
          {jobError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
              <div>{jobError}</div>
              {jobErrorItems.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {jobErrorItems.map((item, index) => (
                    <div
                      key={`${item.imageTag}-${index}`}
                      className="flex min-w-0 items-center gap-2 rounded border border-red-200 bg-white px-2.5 py-1.5 shadow-sm"
                    >
                      <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs font-extrabold text-red-700">
                        {item.app}
                      </span>
                      <span className="break-all font-mono text-xs font-bold text-red-700">
                        {item.imageTag}
                      </span>
                    </div>
                  ))}
                </div>
              ) : jobErrorDetail ? (
                <div className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">{jobErrorDetail}</div>
              ) : null}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleStartPackaging}
          disabled={packagingDisabled}
          className={`min-h-[88px] w-full shrink-0 rounded-xl px-8 flex items-center justify-center gap-2 shadow-md transition-all duration-200 xl:w-[280px] ${
            packagingDisabled
              ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              : "bg-[#000666] text-white hover:bg-[#090d82] active:scale-[0.98] active:shadow-sm"
          }`}
        >
          <span className="text-xl font-extrabold uppercase tracking-wide">
            {packagingStarted ? "진행중..." : "패키징 시작"}
          </span>
        </button>
      </section>
      
      {/* 메인 좌우 분할 영역 (이전 버전 비교 및 최신 버전 선택) */}
      <div className="w-full flex flex-col xl:flex-row gap-6">
        
        {/* 좌측 영역: 이전 버전 기록 (버전별 매니페스트 변경 이력을 세로로 길게 표시) */}
        <section className="flex-1 min-w-0 overflow-hidden bg-white rounded-xl border border-slate-400 shadow-lg flex flex-col h-[820px]">
          {/* 상단 툴바 및 필터 영역 */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 sticky top-0 z-20">
            <div>
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
              <VersionDropdown
                value={leftVersionName}
                options={leftVersionOptions}
                onChange={handleLeftVersionChange}
                disabled={selectingVersionSide === "left"}
                isOptionDisabled={(version) => !!rightVersionName && compareVersionNames(version.versionName, rightVersionName) > 0}
                getOptionLabel={(version, optionDisabled) => `${version.versionName}${optionDisabled ? " (업데이트 버전보다 최신)" : ""}`}
                hasMore={leftSearchResults === null && hasMore}
                loading={loadingVersions || loadingMoreVersions}
                onLoadMore={loadMoreVersions}
              />
            </div>
          </div>

          {leftSequence.length > 0 && (
            <div className="h-[58px] shrink-0 px-4 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
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
          <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
            {currentLeftVersion ? (
              <ManifestTable 
                key={`left-${currentLeftVersion}`}
                versionName={currentLeftVersion}
                detail={detailsCache[currentLeftVersion] === "loading" ? undefined : detailsCache[currentLeftVersion]}
                selectable={false}
              />
            ) : (
              <div className="m-5 flex min-h-[180px] items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-base font-bold text-slate-500 shadow-sm">
                {!leftVersionName
                  ? "현재 버전을 선택해주세요."
                  : !rightVersionName
                    ? "업데이트 버전을 선택해주세요."
                    : "비교할 이전 버전이 없습니다."}
              </div>
            )}
          </div>
        </section>

        {/* 우측 영역: 배포 대상 최신 버전 (패키징할 서브버전을 선택하는 단일 테이블 영역) */}
        <section className="flex-1 min-w-0 overflow-hidden bg-white rounded-xl border border-slate-400 shadow-lg flex flex-col h-[820px]">
          {/* 상단 툴바 및 필터 영역 */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 sticky top-0 z-20">
            <div className="flex items-center justify-between">
              <div>
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
                className="flex-1 min-w-[180px] appearance-none rounded-lg border border-slate-300 bg-white py-2 px-3 text-base font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              />
              {/* 우측 버전 선택 드롭다운 */}
              <VersionDropdown
                value={rightVersionName}
                options={rightVersionOptions}
                onChange={handleRightVersionChange}
                disabled={selectingVersionSide === "right"}
                isOptionDisabled={(version) => !!leftVersionName && compareVersionNames(version.versionName, leftVersionName) < 0}
                getOptionLabel={(version, optionDisabled) => `${version.versionName}${optionDisabled ? " (현재 버전보다 이전)" : ""}`}
                hasMore={rightSearchResults === null && hasMore}
                loading={loadingVersions || loadingMoreVersions}
                onLoadMore={loadMoreVersions}
              />
            </div>
          </div>

          {rightVersionName && (
            <div className={`h-[58px] shrink-0 border-b px-4 text-sm font-bold flex items-center ${
              selectionBlocked || eligibilityError
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-white text-slate-600"
            }`}>
              {eligibilityChecking
                ? "패키징 가능 여부를 확인하고 있습니다."
                : selectionBlocked
                  ? `PENDING 항목이 있어 패키징할 수 없습니다: ${blockingSubVersionCodes.map(code => code.toUpperCase()).join(", ")}`
                  : eligibilityError || "패키징할 APP을 선택해주세요."
              }
            </div>
          )}
          {/* 하단 버전 상세 정보 및 선택 가능한 테이블 영역 */}
          <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
            {rightSequence.length > 0 ? rightSequence.map(vName => (
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
            )) : (
              <div className="m-5 flex min-h-[180px] items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-base font-bold text-slate-500 shadow-sm">
                업데이트 버전을 선택해주세요.
              </div>
            )}
          </div>
        </section>

      </div>

      <AlertModal
        isOpen={!!alertMessage}
        message={alertMessage}
        type="warning"
        onClose={() => setAlertMessage("")}
      />
    </div>
  );
};
