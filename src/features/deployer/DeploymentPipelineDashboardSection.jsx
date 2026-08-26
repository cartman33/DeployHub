// 배포자 화면에서 상태, 부수 효과, 계산 결과, 함수와 렌더링 없는 내부 값을 관리할 React Hook을 가져온다.
// useState는 화면에 반영될 값, useEffect는 값 변화 후 작업, useMemo는 계산 결과를 기억한다.
// useCallback은 함수 자체를 기억하고 useRef는 리렌더링 없이 값이나 타이머를 기억한다.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// 프로젝트의 공통 알림 모달과 무한 스크롤 버전 선택 드롭다운을 가져온다.
import { AlertModal } from "../../components/ui/AlertModal";
import { VersionDropdown } from "../../components/ui/VersionDropdown";

// 메인버전 상세 조회, 패키징 가능 여부 확인, JOB 생성과 JOB 조회를 담당하는 API 함수를 가져온다.
import { getMainVersionDetail, getPackagingEligibility, createPackageJob, getPackageJob } from "../../services/api";

// APP을 서버 응답 순서가 아닌 팀에서 정한 고정 순서로 표시하기 위한 공통 상수를 가져온다.
import { SUBVERSION_ORDER } from '../../utils/constants';

/**
 * 글 속에 있는 인터넷 주소(URL)를 진짜 누를 수 있는 마법의 버튼(링크)으로 바꿔주는 함수예요.
 * 
 * @param {string} text - 글이나 메시지 원본 (Input)
 * @returns {Array<string | JSX.Element>} - 인터넷 주소가 클릭 가능한 버튼으로 변신한 결과물 (Output)
 * 
 * - 정규식 (https?:\/\/[^\s<>]+)/g 사용 이유: 'http/https'로 시작하는 주소를 괄호로 묶어서 잘라내면, 나중에 주소만 쏙 빼먹지 않고 같이 남겨둘 수 있어요.
 * - 왜 split을 쓰는지: 글자를 쪼갤 때(split) 자르는 기준이 된 주소도 결과에 남기 때문에, 일반 글자와 링크를 차례대로 예쁘게 보여주기 딱 좋아요.
 * - e.stopPropagation() 사용 이유: 링크를 눌렀을 때, 그 뒤에 있는 큰 박스(테이블 줄)까지 같이 눌리는 걸 막아주는 방패막이에요.
 */
const linkifyText = (text) => {
  // text가 빈 문자열, null, undefined처럼 내용이 없으면 변환하지 않고 그대로 반환한다.
  if (!text) return text;

  // /.../g는 문자열 전체에서 반복 검색할 정규식이고, https 또는 http로 시작하는 URL을 찾는다.
  const urlPattern = /(https?:\/\/[^\s<>]+)/g;

  // split은 URL을 경계로 문자열을 나누며, 정규식에 괄호가 있어 URL 자체도 결과 배열에 남는다.
  const parts = text.split(urlPattern);

  // map으로 각 문자열 조각을 검사해 URL은 <a> 링크로, 일반 문장은 문자열 그대로 반환한다.
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline break-all" onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    return part;
  });
};

// 체크 모양을 그려주는 도장(SVG 컴포넌트)이에요.
const CheckIcon = ({ className }) => (
  // svg는 해상도가 달라져도 선명한 벡터 그림이다. 부모가 전달한 className으로 크기와 색을 정한다.
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * [컴포넌트] 특정 버전에 어떤 상세 내용들이 있는지 예쁜 표(테이블)로 그려주는 화가 컴포넌트예요.
 * 
 * @param {string} versionName - 기준이 되는 버전 이름 (표 제목에도 쓰고, 장바구니에 담을 때 이름표로도 써요)
 * @param {object | null | "loading"} detail - 서버에서 받아온 상세 정보 (아직 가져오는 중이면 "loading"이라고 표시해요)
 * @param {boolean} selectable - true면 장바구니에 담을 수 있게 체크박스를 켜고(우측), false면 눈으로만 보게 꺼둬요(좌측)
 * @param {Array<{code, versionName, imageTags}>} selectedItems - 지금 장바구니에 담겨있는 물건들
 * @param {function} toggleItem - 물건 하나를 장바구니에 넣었다 뺐다 하는 스위치
 * @param {function} toggleAllItems - 물건 전체를 한 번에 쓸어 담거나 비우는 요술 스위치
 * @param {boolean} selectionDisabled - true면 어떤 문제 때문에 선택을 아예 막아버려요(예: 준비 중인 항목이 있을 때)
 */
const ManifestTable = ({ versionName, detail, selectable, selectedItems, toggleItem, toggleAllItems, selectionDisabled = false }) => {
  // 기억해두기(useMemo): 똑같은 표를 매번 다시 그리면 힘드니까, 한 번 그려둔 걸 기억해두고 재사용해요.
  // [detail, versionName]이 바뀔 때만 다시 그리는 이유: 정보가 달라졌을 때만 새로 그려야 낭비가 없거든요!
  const rows = useMemo(() => {
    if (!detail || detail === "loading") return [];
    
    const subVersions = detail.subVersions || [];
    const map = {};
    
    // 무조건 대문자로 맵핑하는 이유: 서버나 옛날 시스템에서 소문자로 보내도 찰떡같이 알아듣게 대문자로 통일하는 마법이에요.
    subVersions.forEach(sv => {
      map[(sv.code || "").toUpperCase()] = sv;
    });

    // SUBVERSION_ORDER 정렬 순서 사용 이유: 사람들이 약속해둔 순서대로 줄을 세워야 보는 사람이 헷갈리지 않겠죠?
    return SUBVERSION_ORDER.map(code => {
      const item = map[code];
      if (!item) {
        return {
          code,
          key: `${versionName}_${code}`, // 겹치지 않는 고유한 이름표
          tag: "-",
          imageTags: "",
          note: "-",
          sql: "-",
          releaseNote: "-",
          statusText: "UNCHANGED",
          statusClass: "bg-slate-100 text-slate-500",
          highlighted: false
        };
      }
      
      const statusValue = (item.submitStatus || "UNCHANGED").toUpperCase();
      let statusText = "UNCHANGED";
      let statusClass = "bg-slate-100 text-slate-500";
      
      // UPDATED와 UPDATE 둘 다 허용하는 이유: 옛날에 쓰던 말씨와 지금 쓰는 말씨가 조금 달라도 둘 다 융통성 있게 알아듣기 위해서예요.
      if (statusValue === "UPDATED" || statusValue === "UPDATE") {
        statusText = "UPDATED";
        statusClass = "bg-indigo-100 text-indigo-700 font-bold border border-indigo-200";
      } else if (statusValue === "PENDING") { 
        statusText = "PENDING";
        statusClass = "bg-orange-100 text-orange-700 font-bold border border-orange-200";
      }
      
      // imageTags를 줄바꿈('\n')으로 합치는 이유: 하나의 물건 꾸러미 안에 여러 이미지가 들어있을 때, 보기 좋게 차곡차곡 쌓아서 보여주기 위함이에요.
      const imageTags = item.components?.length > 0 ? item.components.map(c => c.imageTag).join('\n') : "";
      const pureNote = item.note || "-";
      
      return {
        ...item,
        code,
        tag: item.version || "-",
        imageTags: imageTags,
        note: pureNote,
        statusText,
        statusClass,
        highlighted: statusValue === "UPDATED" || statusValue === "UPDATE",
        // 랜덤 이름표(Math.random)를 쓰지 않는 이유: 화면을 그릴 때마다 이름표가 무작위로 바뀌면, 리액트가 헷갈려서 버벅거리거나 실수할 수 있어요. 안정적인 고유 이름표를 줍니다.
        key: item.id || `${versionName}_${code}`,
      };
    });
  }, [detail, versionName]);

  return (
    // 이 컴포넌트는 버전 하나의 배포 문서와 APP별 버전·이미지 태그·상태를 하나의 표로 반환한다.
    <div className="flex flex-col w-full bg-white border-b-4 border-slate-300">
      <div className="h-[154px] shrink-0 px-3 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-col gap-2 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-slate-800 text-base">VERSION: {versionName}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-1 bg-white p-2 rounded border border-slate-200 flex-1 min-h-0">
          <div className="flex flex-col min-w-0 min-h-0">
            <span className="text-xs font-bold text-slate-500 uppercase mb-1">SQL Script</span>
            <span className="text-[13px] text-slate-700 whitespace-pre-wrap break-words overflow-y-auto">{detail?.mainVersion?.sqlScript || "-"}</span>
          </div>
          <div className="flex flex-col min-w-0 min-h-0">
            <span className="text-xs font-bold text-slate-500 uppercase mb-1">Release Note</span>
            <span className="text-[13px] text-slate-700 whitespace-pre-wrap break-words overflow-y-auto">{detail?.mainVersion?.releaseNote || "-"}</span>
          </div>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[760px] text-left border-collapse table-fixed">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="h-[60px]">
              <th className="px-1 py-2 w-14 text-center align-middle">
                {selectable ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-extrabold text-slate-600 leading-none">선택</span>
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
              <th className="px-2 py-3 w-[12%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">APP</th>
              <th className="px-2 py-3 w-[14%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">VERSION</th>
              <th className="px-2 py-3 w-[27%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">IMAGE TAG</th>
              <th className="px-2 py-3 text-sm font-extrabold text-slate-600 uppercase tracking-wider">NOTE</th>
              <th className="px-2 py-3 w-[15%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => {
              const isSelected = selectedItems && selectedItems.some(i => i.code === row.code && i.versionName === versionName);
              const rowSelectionDisabled = selectionDisabled || !row.imageTags;
              
              return (
                <tr key={row.key} className={`h-[96px] transition-colors ${row.highlighted ? "bg-indigo-50/20" : "hover:bg-slate-50"}`}>
                  <td className="px-2 py-3 text-center align-middle">
                    {selectable ? (
                      <button
                        type="button"
                        onClick={() => toggleItem({ ...row, versionName })}
                        disabled={rowSelectionDisabled}
                        title={!row.imageTags ? "IMAGE TAG가 없어 패키징 대상이 아닙니다." : selectionDisabled ? "PENDING 항목이 있어 선택할 수 없습니다." : ""}
                        className={`w-7 h-7 rounded flex items-center justify-center border-2 transition-all shadow-sm mx-auto ${
                          isSelected 
                            ? "bg-green-500 border-green-500" 
                            : "bg-white border-slate-300 hover:border-indigo-400"
                        } ${rowSelectionDisabled ? "opacity-40 cursor-not-allowed bg-slate-100" : ""}`}
                      >
                        {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="h-[96px] px-2 py-3 text-sm font-extrabold text-slate-800 align-top overflow-hidden">{row.code}</td>
                  <td className="h-[96px] px-2 py-3 text-sm font-bold text-slate-700 align-top break-all overflow-hidden">
                    <div className="max-h-[72px] overflow-y-auto">{row.tag}</div>
                  </td>
                  <td className="h-[96px] px-2 py-3 align-top break-all overflow-hidden">
                    <div className="flex max-h-[72px] flex-col gap-1 overflow-y-auto">
                      {row.imageTags ? row.imageTags.split('\n').map((line, i) => (
                        <span key={i} className="text-[13px] font-bold text-slate-800 font-mono leading-tight">{line}</span>
                      )) : <span className="text-[13px] font-bold text-slate-400">없음</span>}
                    </div>
                  </td>
                  <td className="h-[96px] px-2 py-3 align-top break-keep text-justify overflow-hidden">
                    <div className="flex max-h-[72px] flex-col gap-1.5 overflow-y-auto">
                      {row.note.split('\n').map((line, i) => (
                        <span key={i} className="text-[14px] font-medium text-slate-800 leading-relaxed break-words">{linkifyText(line)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="h-[96px] px-2 py-3 align-top overflow-hidden">
                    <span className={`inline-block px-2.5 py-1.5 rounded text-xs tracking-wide whitespace-nowrap shadow-sm ${row.statusClass}`}>
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

/**
 * 날짜로 된 두 이름표(예: 2026.08.24)를 숫자 크기 비교하듯 겨루게 하는 함수예요.
 * 
 * @param {string} leftName - 왼쪽 선수의 버전 이름 (Input)
 * @param {string} rightName - 오른쪽 선수의 버전 이름 (Input)
 * @returns {number} 양수면 왼쪽이 이김(최신), 0이면 무승부, 음수면 오른쪽이 이김 (Output)
 * 
 * - 정규식 /^(\d{4})\.(\d{2})\.(\d{2})(?:-(\d+))?$/ 의미: '연도 4자리.월 2자리.일 2자리'라는 아주 엄격한 드레스 코드를 검사해요. 뒤에 '-숫자' 꼬리표는 선택사항이에요.
 * - 플랜 B(localeCompare) 가동 이유: 드레스 코드에 안 맞는 이상한 손님이 와도 파티(프로그램)를 망치지 않게, 단순하게 이름표 글자 순서로 비교하는 임시방편이에요.
 * - 결과가 left - right 인 이유: 왼쪽에서 오른쪽을 뺐을 때 양수(남는게 있음)면 왼쪽이 더 강하다(최신이다)라는 직관적인 뜻을 맞추기 위해서예요.
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

/**
 * 알아보기 힘든 에러 메시지를 우리가 읽기 편한 예쁜 편지로 번역해주는 함수예요.
 * 
 * @param {string | object | array | null} detail - 꼬불꼬불한 에러 내용 (Input)
 * @returns {string} 화면에 띄우기 좋게 다듬어진 에러 편지 (Output)
 */
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

const getErrorDetail = (error) => error?.payload?.details ?? error?.payload?.detail;

const getJobErrorData = (error, fallback) => {
  const message = error?.payload?.message || error?.message || fallback;
  const detail = formatErrorDetail(getErrorDetail(error));
  return { message, detail };
};

/**
 * 길 잃은(에러 난) 이미지 태그들이 어떤 앱(APP)의 것인지 장바구니에서 찾아 매칭해주는 셜록 홈즈 함수예요.
 * 
 * @param {any} detail - 에러 메시지 꾸러미 (Input)
 * @param {Array} selectedItems - 내 장바구니에 담긴 물건들 (Input)
 * @returns {Array<{app: string, imageTag: string}>} - 길 잃은 이미지와 그 주인의 이름(APP)을 짝지은 목록 (Output)
 * 
 * - '\n' 기준으로 쪼개서 매칭하는 이유: 하나의 앱 바구니 안에 여러 이미지가 차곡차곡 쌓여있을 수 있어서, 하나씩 다 꺼내서 살펴봐야 진짜 주인을 찾을 수 있어요.
 */
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

/**
 * [메인 컴포넌트] 배포를 돕는 마스터 대시보드(상황판) 컴포넌트예요.
 * 
 * @param {MainVersionSummary[]} versions - 전체 버전 목록 (항상 최신순으로 예쁘게 줄 서 있어요)
 * @param {(name: string) => void} setSelectedVersionName - 선택한 버전을 전체 앱에 알려주는 확성기 함수
 * @param {boolean} hasMore - 더 불러올 과거 버전이 남아있는지 알려주는 표지판
 * @param {boolean} loadingVersions - 처음 목록을 가져오는 중인지(로딩 중) 알려주는 신호등
 * @param {boolean} loadingMoreVersions - 추가 목록을 더 가져오는 중인지 알려주는 신호등
 * @param {() => void} loadMoreVersions - 더 많은 목록을 가져오라고 시키는 버튼 역할 함수
 * @param {(keyword: string) => Promise<MainVersionSummary[]>} searchVersionOptions - 서버에 "이 버전 찾아줘!" 하고 부탁하는 검색 함수
 * @param {(versionName: string) => Promise<MainVersionSummary[]>} ensureVersionLoaded - 내가 콕 찍은 버전이 목록에 확실히 있게 보장해주는 듬직한 보디가드 함수
 */
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
  // 왼쪽과 오른쪽 검색은 서로의 드롭다운 목록을 바꾸지 않도록 각각 독립된 상태를 사용한다.
  // @type {string} 왼쪽 창에서 검색하려고 적어둔 단어를 보관하는 곳
  const [leftSearch, setLeftSearch] = useState("");
  // @type {MainVersionSummary[] | null} 왼쪽 창에서 검색한 결과물들
  const [leftSearchResults, setLeftSearchResults] = useState(null);
  // @type {boolean} 왼쪽 창에서 열심히 검색 중인지 표시하는 깜빡이
  const [leftSearchLoading, setLeftSearchLoading] = useState(false);
  
  // @type {string} 오른쪽 창에서 검색하려고 적어둔 단어를 보관하는 곳
  const [rightSearch, setRightSearch] = useState("");
  // @type {MainVersionSummary[] | null} 오른쪽 창에서 검색한 결과물들
  const [rightSearchResults, setRightSearchResults] = useState(null);
  // @type {boolean} 오른쪽 창에서 열심히 검색 중인지 표시하는 깜빡이
  const [rightSearchLoading, setRightSearchLoading] = useState(false);
  
  // @type {string} 지금 어느 쪽(왼쪽? 오른쪽?) 버전을 고르는 중인지 기억하는 메모지
  const [selectingVersionSide, setSelectingVersionSide] = useState("");
  
  // @type {number} 왼쪽 창에서 보여줄 사진첩의 현재 페이지 번호 (0부터 시작해요)
  const [leftPage, setLeftPage] = useState(0);
  
  // @type {string} 왼쪽 창(과거/기준점)에 선택된 버전 이름표
  const [leftVersionName, setLeftVersionName] = useState("");
  // @type {string} 오른쪽 창(미래/업데이트 목표)에 선택된 버전 이름표
  const [rightVersionName, setRightVersionName] = useState("");

  // 왼쪽 드롭다운 메뉴 만들기(useMemo로 기억해두기)
  // 선택한 버전을 맨 앞에 끼워넣는 이유: 내가 손에 쥔 물건을 놓치지 않기! 다른 걸 검색하더라도 내가 고른 건 항상 눈에 보이게 맨 윗줄에 올려주는 센스예요.
  const leftVersionOptions = useMemo(() => {
    const filtered = leftSearchResults ?? versions;
    const selectedVersion = versions.find((version) => version.versionName === leftVersionName);
    return selectedVersion && !filtered.some((version) => version.versionName === leftVersionName)
      ? [selectedVersion, ...filtered]
      : filtered;
  }, [versions, leftSearchResults, leftVersionName]);

  // 오른쪽 드롭다운 메뉴 만들기 (왼쪽과 똑같은 센스를 발휘해요)
  const rightVersionOptions = useMemo(() => {
    const filtered = rightSearchResults ?? versions;
    const selectedVersion = versions.find((version) => version.versionName === rightVersionName);
    return selectedVersion && !filtered.some((version) => version.versionName === rightVersionName)
      ? [selectedVersion, ...filtered]
      : filtered;
  }, [versions, rightSearchResults, rightVersionName]);

  // 타임머신 금지 구역: 우리가 업데이트할 버전(오른쪽)이 현재(왼쪽)보다 옛날 거라면, 미래에서 과거로 가는 거라 말이 안 되죠? 이럴 땐 '삐- 무효!'를 외칩니다.
  const versionRangeInvalid = leftVersionName
    && rightVersionName
    && compareVersionNames(rightVersionName, leftVersionName) < 0;
  
  // @type {Record<string, object | null | "loading">} 정보 창고(캐시): 한 번 물어본 버전 정보는 창고에 쌓아둬서, 또 물어보는 귀찮은 일을 막아요.
  const [detailsCache, setDetailsCache] = useState({});
  // @type {Set<string>} 진행 중인 심부름 장부: 이미 조회를 부탁한 버전은 장부에 적어둬서, 중복으로 심부름꾼이 출발하지 않게 막습니다.
  const fetchingRef = useRef(new Set());
    
  // @type {Array<{code, versionName, imageTags}>} 장바구니 안에 담긴 물건들 상태
  const [selectedItems, setSelectedItems] = useState([]);

  // @type {boolean} 포장 작업(패키징)이 시작되었는지 알려주는 불빛
  const [packagingStarted, setPackagingStarted] = useState(false);
  // @type {object | null} 포장 작업의 상세 내역서
  const [jobDetail, setJobDetail] = useState(null);
  // @type {boolean} 포장 작업이 잘 되고 있는지 5초마다 찔러보는 중인지(폴링) 확인하는 불빛
  const [jobPolling, setJobPolling] = useState(false);
  // @type {string} 포장하다 문제가 생겼을 때의 에러 메시지
  const [jobError, setJobError] = useState("");
  // @type {string} 포장 에러에 대한 아주 자세한 돋보기 설명
  const [jobErrorDetail, setJobErrorDetail] = useState("");
  // @type {Array} 말썽을 피운(에러 난) 이미지들의 범인 목록
  const [jobErrorItems, setJobErrorItems] = useState([]);
  
  // @type {object | null} 이 버전을 포장해도 되는지(자격 검증) 확인한 합격증
  const [eligibility, setEligibility] = useState(null);
  // @type {boolean} 합격증 발급을 위해 심사(로딩) 중인지 알려주는 불빛
  const [eligibilityChecking, setEligibilityChecking] = useState(false);
  // @type {string} 합격 심사 중 발생한 에러 메시지
  const [eligibilityError, setEligibilityError] = useState("");
  
  // @type {string} 화면 전체에 띄울 경고창(알림 모달) 메시지
  const [alertMessage, setAlertMessage] = useState("");

  // 왼쪽 또는 오른쪽 검색창에서 Enter를 눌렀을 때 서버 검색을 수행한다.
  // side는 "left" 또는 "right"이며, 삼항 연산자로 해당 방향의 상태와 변경 함수를 선택한다.
  const handleVersionSearch = async (side) => {
    const keyword = side === "left" ? leftSearch.trim() : rightSearch.trim();
    const setResults = side === "left" ? setLeftSearchResults : setRightSearchResults;
    const setSearching = side === "left" ? setLeftSearchLoading : setRightSearchLoading;

    // 검색어가 비어 있으면 검색 결과 null로 되돌려 전체 versions 목록을 다시 사용한다.
    if (!keyword) {
      setResults(null);
      return;
    }

    setSearching(true);
    try {
      // await는 백엔드 검색 응답이 올 때까지 이 async 함수의 다음 줄 실행을 기다린다.
      setResults(await searchVersionOptions(keyword));
    } catch (error) {
      setAlertMessage(error.payload?.message || error.message || "버전 검색 중 오류가 발생했습니다.");
    } finally {
      setSearching(false);
    }
  };

  // 왼쪽의 현재 버전을 선택할 때 오른쪽 업데이트 버전보다 최신인지 먼저 검사한다.
  const handleLeftVersionChange = async (versionName) => {
    if (rightVersionName && compareVersionNames(versionName, rightVersionName) > 0) {
      setAlertMessage("현재 버전은 업데이트 버전보다 최신일 수 없습니다.");
      return;
    }

    setSelectingVersionSide("left");
    try {
      // 검색 결과에만 있던 버전이라도 전체 목록과 비교 구간에 포함되도록 필요한 페이지까지 불러온다.
      const loadedVersions = await ensureVersionLoaded(versionName);

      // some은 배열에 선택 버전이 하나라도 있으면 true를 반환한다.
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

  // 오른쪽 업데이트 버전을 선택하고, 앱 전체가 공유하는 선택 버전 상태도 같은 값으로 맞춘다.
  const handleRightVersionChange = async (versionName) => {
    // 업데이트 버전이 현재 버전보다 과거이면 잘못된 배포 범위이므로 선택을 막는다.
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

  // ?.는 eligibility가 아직 null이어도 오류 없이 속성을 읽는 선택적 연결 연산자다.
  // || []는 백엔드 값이 없을 때 빈 배열을 기본값으로 사용한다.
  const blockingSubVersionCodes = eligibility?.blockingSubVersionCodes || [];
  const selectionBlocked = eligibility?.eligible === false;

  // 아래 조건 중 하나라도 참이면 패키징 시작 버튼을 비활성화한다.
  // ||는 OR이므로 패키징 중, 빈 장바구니, 잘못된 범위, 검증 중·실패·불합격을 모두 차단한다.
  const packagingDisabled = packagingStarted
    || selectedItems.length === 0
    || versionRangeInvalid
    || eligibilityChecking
    || selectionBlocked
    || !!eligibilityError;

  // setTimeout이 반환한 타이머 id와 컴포넌트가 현재 화면에 존재하는지를 ref로 기억한다.
  // 이 값들은 화면에 표시할 필요가 없으므로 useState 대신 useRef가 적합하다.
  const pollTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  // 빈 의존성 배열 []을 가진 Effect는 컴포넌트가 처음 나타날 때 등록된다.
  useEffect(() => {
    isMountedRef.current = true;

    // Effect가 반환하는 함수는 컴포넌트가 사라질 때 실행되는 정리(cleanup) 함수다.
    return () => {
      isMountedRef.current = false;
      // 화면을 떠난 뒤 예약된 JOB 조회가 실행되지 않도록 기존 타이머를 취소한다.
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // 사진첩 만들기(핵심 로직): 전체 버전들은 최신순으로 줄을 서 있어요.
  // 우리가 고른 현재(왼쪽)와 미래(오른쪽) 사이의 구간을 싹둑 잘라서 '변화의 역사(leftSequence)'를 만들어요.
  // 왜 이렇게 하냐면, 최종 목표지점(오른쪽)은 항상 1곳으로 고정해두고, 출발지(왼쪽)에서 그곳까지 가는 과정을 파노라마처럼 쭉 보여주기 위해서예요.
  // 그리고 leftPage를 넘기며 이 사진첩을 한 장씩 볼 수 있게 도와줄 거예요.
  const { leftSequence, rightSequence } = useMemo(() => {
    if (!versions.length) return { leftSequence: [], rightSequence: [] };
    if (!leftVersionName || !rightVersionName) {
      return {
        leftSequence: [],
        rightSequence: rightVersionName ? [rightVersionName] : [],
      };
    }
    
    // findIndex는 선택한 버전이 최신순 versions 배열의 몇 번째 위치인지 찾는다. 없으면 -1이다.
    const leftIdx = versions.findIndex(v => v.versionName === leftVersionName);
    const rightIdx = versions.findIndex(v => v.versionName === rightVersionName);
    
    if (leftIdx === -1 || rightIdx === -1) return { leftSequence: [leftVersionName], rightSequence: [rightVersionName] };
    if (rightIdx > leftIdx) return { leftSequence: [], rightSequence: [rightVersionName] };
    
    // 오른쪽 목적지가 항상 1개인 이유: 우리가 도착할 최종 업데이트 역은 오직 하나니까요!
    const rSeq = [versions[rightIdx].versionName];
    const lSeq = [];
    if (rightIdx < leftIdx) {
      // for 반복문으로 오른쪽 목표 버전과 왼쪽 현재 버전 사이의 각 버전명을 차례로 수집한다.
      for (let i = rightIdx + 1; i <= leftIdx; i++) {
        if (versions[i]) lSeq.push(versions[i].versionName);
      }
    } else {
      lSeq.push(versions[leftIdx].versionName);
    }
    
    return { leftSequence: lSeq, rightSequence: rSeq };
  }, [versions, leftVersionName, rightVersionName]);

  // 메뉴판(버전 목록) 갱신 시 안전장치: 부모님이 메뉴판을 새로 바꿨는데, 내가 고른 메뉴가 거기 없다면? 당황하지 않게 내 선택도 싹 지워서 에러를 막아요.
  useEffect(() => {
    if (versions && versions.length > 0) {
      if (rightVersionName && !versions.find(v => v.versionName === rightVersionName)) {
        setRightVersionName("");
        if (setSelectedVersionName) setSelectedVersionName("");
      }
      if (leftVersionName && !versions.find(v => v.versionName === leftVersionName)) {
        setLeftVersionName("");
      }
    }
  }, [versions, rightVersionName, leftVersionName, setSelectedVersionName]);

  // 비교 대상이 바뀌면 사진첩 첫 장으로 돌리기: 구경할 대상을 바꿨으니, 당연히 사진첩도 맨 첫 장(0페이지)으로 덮어둬야 깔끔하겠죠?
  useEffect(() => {
    setLeftPage(0);
  }, [leftVersionName, rightVersionName]);

  useEffect(() => {
    // 함수형 상태 변경의 prev는 React가 보장하는 가장 최신 페이지 값이다.
    // Math.min/Math.max로 버전 수가 줄어도 페이지 번호가 배열 범위를 벗어나지 않게 제한한다.
    setLeftPage(prev => Math.min(prev, Math.max(leftSequence.length - 1, 0)));
  }, [leftSequence.length]);

  const currentLeftVersion = leftSequence[leftPage] || "";

  // 화면에 그릴 상세 정보들 가져오기 (창고 활용하기)
  // 심부름 장부(fetchingRef)로 중복 방지: 동일한 정보를 달라고 두 번씩 닦달하지 않도록, 이미 부탁한 일은 장부에 적어둬요.
  // "loading" 팻말 달기: "지금 열심히 가져오고 있으니까 조금만 기다려주세요~" 하고 화면에 빈자리를 예쁘게 알려주는 센스!
  useEffect(() => {
    const fetchDetails = async () => {
      // Set은 중복 값을 하나로 합친다. 펼침 연산자 ...로 다시 배열을 만들고 filter(Boolean)으로 빈 값을 제거한다.
      const needed = [...new Set([currentLeftVersion, ...rightSequence])].filter(Boolean);
      const toFetch = needed.filter(v => detailsCache[v] === undefined && !fetchingRef.current.has(v));
      if (toFetch.length === 0) return;

      toFetch.forEach(v => fetchingRef.current.add(v));

      setDetailsCache(prev => {
        // 상태 객체를 직접 수정하지 않고 ...prev로 복사한 새 객체를 만든다.
        let next = { ...prev };
        toFetch.forEach(v => { next[v] = "loading"; });
        return next;
      });

      // 여러 버전의 상세 정보를 하나씩 순서대로 조회해 versionName을 key로 캐시에 저장한다.
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
  }, [currentLeftVersion, rightSequence]);

  // 목표 버전(우측)이 바뀌면 자격증(Eligibility) 심사 새로 받기
  // cancelled 방패벽(가드) 치기: 내가 '짜장면'을 시켰다가 '짬뽕'으로 바꿨는데, 늦게 도착한 짜장면이 짬뽕을 엎어버리는 대참사를 막는 안전장치예요.
  useEffect(() => {
    // Effect가 실행될 때마다 새 요청을 위한 취소 표식을 만든다.
    let cancelled = false;
    const checkRightVersionStatus = async () => {
      setEligibilityChecking(true);
      setEligibility(null);
      try {
        // 먼저 선택한 목표 버전의 PENDING, IMAGE TAG 등 패키징 차단 사유를 백엔드에 검사한다.
        const elig = await getPackagingEligibility(rightVersionName);
        if (!cancelled) {
          setEligibility(elig);
          setEligibilityError("");
        }
      } catch (err) {
        if (!cancelled) {
          setEligibility(null);
          setEligibilityError(err.payload?.message || err.message || "패키징 가능 여부를 확인하는 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) setEligibilityChecking(false);
      }
      try {
        // 같은 버전에 이미 생성된 패키징 JOB이 있다면 현재 상태도 함께 조회한다.
        const j = await getPackageJob(rightVersionName);
        if (!cancelled) setJobDetail(j);
      } catch {
        if (!cancelled) setJobDetail(null);
      }
    };
    if (rightVersionName) {
      checkRightVersionStatus();
    } else {
      setEligibility(null);
      setEligibilityChecking(false);
      setJobDetail(null);
    }
    // 오른쪽 버전이 다시 바뀌면 이전 요청의 늦은 응답이 새 화면 상태를 덮지 못하도록 cancelled를 true로 바꾼다.
    return () => { cancelled = true; };
  }, [rightVersionName]);

  // 목표 버전이 바뀌면 장바구니 엎기: 다른 마트에 갔으면 장바구니도 싹 비워야죠! 실수로 엉뚱한 물건이 섞여 포장되는 대참사를 원천 봉쇄합니다.
  useEffect(() => {
    setSelectedItems([]);
  }, [rightVersionName]);

  useEffect(() => {
    setJobError("");
    setJobErrorDetail("");
    setJobErrorItems([]);
  }, [leftVersionName, rightVersionName]);

  // 불합격 판정(selectionBlocked) 시 장바구니 몰수: "이 버전은 포장 불가!" 딱지가 붙으면, 사용자가 몰래 담아둔 물건들도 얄짤없이 싹 다 제자리에 돌려놓아요.
  useEffect(() => {
    if (selectionBlocked) setSelectedItems([]);
  }, [selectionBlocked]);

  const toggleItem = (item) => {
    // 알맹이(imageTags) 없는 빈 껍데기 걸러내기: 껍데기만 있는 물건은 진짜 포장할 거리가 아니니까 장바구니에 담지 못하게 철벽 수비합니다.
    if (selectionBlocked || !item.imageTags) return;
    setSelectedItems(prev => {
      // 같은 버전과 APP code가 이미 장바구니에 있는지 검사한다.
      const exists = prev.some(i => i.code === item.code && i.versionName === item.versionName);
      if (exists) {
        // 이미 있으면 filter로 그 항목만 제외해 체크 해제한다.
        return prev.filter(i => !(i.code === item.code && i.versionName === item.versionName));
      } else {
        // 없으면 기존 항목 뒤에 새 item을 추가해 체크한다.
        return [...prev, item];
      }
    });
  };

  const toggleAllItems = (vName, rows) => {
    if (selectionBlocked) return;
    // 쓸모있는 물건들(packageableRows)만 골라 담기: "전부 다 담아!"라고 외쳐도, 알맹이(imageTags)가 있는 진짜배기들만 골라서 쏙쏙 담아주는 똑똑한 센스예요.
    const packageableRows = rows.filter(row => row.imageTags);
    setSelectedItems(prev => {
      const currentSelectedForVersion = prev.filter(i => i.versionName === vName);
      const newSelected = prev.filter(i => i.versionName !== vName);
      
      if (packageableRows.length > 0 && currentSelectedForVersion.length === packageableRows.length) {
        // 선택 가능한 항목이 모두 담겨 있으면 해당 버전의 항목 전체를 제거한다.
        return newSelected;
      } else {
        // 일부 또는 아무것도 선택하지 않았다면 패키징 가능한 행을 모두 버전명과 함께 추가한다.
        const itemsToAdd = packageableRows.map(row => ({ ...row, versionName: vName }));
        return [...newSelected, ...itemsToAdd];
      }
    });
  };

  // 퇴근 후 업무 금지(isMountedRef 확인): 화면이 꺼졌는데도 뒤에서 유령처럼 계속 일하면 안 되겠죠? 퇴근 안 했는지 확인하고 일하게 만들어요.
  // 5초 간격으로 찔러보기(setTimeout 패턴): 전화 끊고 나서 딱 5초 쉬고 다시 전화를 거는 방식이에요. 그래야 통화 중에 또 전화를 거는 실수를 막을 수 있어요.
  // 완료/실패 시 그만 찔러보기: 포장이 성공하든 실패하든 결과가 나왔으면 그만 물어보기! 서버도 좀 쉬어야죠.
  const pollJob = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      const j = await getPackageJob(rightVersionName);
      if (!isMountedRef.current) return;

      setJobDetail(j);
      // 응답 형태가 job.status 또는 최상위 status인 경우를 모두 허용하고, 둘 다 없으면 빈 문자열을 쓴다.
      const status = j?.job?.status || j?.status || "";
      
      if (status === "DONE" || status === "FAILED") {
        setJobPolling(false);
        setPackagingStarted(false);
        return;
      }
      
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      // JOB이 끝나지 않았다면 5초 뒤 pollJob을 다시 실행하도록 예약한다.
      pollTimerRef.current = setTimeout(pollJob, 5000);
      
    } catch (err) {
      if (!isMountedRef.current) return;
      const errorData = getJobErrorData(err, "패키징 상태 조회 중 오류가 발생했습니다.");
      setJobError(errorData.message);
      setJobErrorDetail(errorData.detail);
      setJobErrorItems([]);
      setJobPolling(false);
      setPackagingStarted(false);
    }
  }, [rightVersionName]);

  // 이중 잠금장치(핸들러 검증): 버튼이 안 눌리게 막아두긴 했지만, 혹시라도 찰나의 순간에 버튼이 눌리는 꼼수를 막기 위해 누를 때 한 번 더 꼼꼼히 검사해요.
  const handleStartPackaging = async () => {
    if (eligibilityChecking || !eligibility) {
      setAlertMessage("패키징 가능 여부를 확인한 후 다시 시도해주세요.");
      return;
    }
    if (selectedItems.length === 0) {
      setAlertMessage("패키징할 신규 변경사항을 장바구니에 담아주세요 (오른쪽 패널에서 체크).");
      return;
    }
    if (eligibilityError) {
      setAlertMessage(eligibilityError);
      return;
    }
    if (eligibility && eligibility.eligible === false) {
      setAlertMessage(eligibility.reason || "이 메인버전은 현재 패키징 가능 상태가 아닙니다.");
      return;
    }
    
    // 짐 보따리 풀어서 한 줄 기차 세우기(flatMap): 하나의 항목에 여러 이미지가 뭉쳐있다면, 싹 다 풀어서 길쭉하게 한 줄로 쭉~ 세워(평탄화) 담습니다.
    const tagsToPackage = selectedItems
      // flatMap은 APP별 여러 줄 IMAGE TAG를 하나의 평평한 배열로 합친다.
      .flatMap(i => (i.imageTags || "").split('\n'))
      // map으로 각 태그 앞뒤 공백을 제거하고 filter(Boolean)으로 빈 줄을 제거한다.
      .map(t => t.trim())
      .filter(Boolean);

    setPackagingStarted(true);
    setJobError("");
    setJobErrorDetail("");
    setJobErrorItems([]);
    
    try {
      // 규격 봉투에 담아 보내기: 서버가 "이렇게 넣어줘!"라고 정해둔 양식(계약서)에 딱 맞춰서 봉투(body)에 예쁘게 담아 보냅니다.
      const body = { imageTags: tagsToPackage };
      // 오른쪽 업데이트 버전명과 사용자가 고른 IMAGE TAG 배열을 백엔드에 보내 JOB을 생성한다.
      const res = await createPackageJob(rightVersionName, body);
      setJobDetail(res || null);
      setJobPolling(true);
      // JOB 생성 직후부터 완료 또는 실패할 때까지 상태 조회를 시작한다.
      pollJob();
    } catch (err) {
      const errorData = getJobErrorData(err, "패키지 Job 생성 중 오류가 발생했습니다.");
      setJobError(errorData.message);
      setJobErrorDetail(errorData.detail);
      setJobErrorItems(getRegistryErrorItems(getErrorDetail(err), selectedItems));
      setAlertMessage(errorData.message);
      setPackagingStarted(false);
    }
  };

  // ---------------- 화면 그리기 구조 설명 ----------------
  // - 명쾌한 좌우 분할 화면: 왼쪽(과거/현재)과 오른쪽(미래/업데이트 대상)을 나란히 배치해서, "아, 이렇게 변하는구나!" 하고 한눈에 비교할 수 있게 짠! 하고 보여줘요.
  // - 장바구니는 무조건 맨 위로(상단 고정): 마트 계산대처럼, 내가 고른 물건들과 최종 결제 버튼(패키징 시작)은 제일 눈에 잘 띄는 곳에 두어야 편하니까요.
  // - 구경용(좌) vs 쇼핑용(우) 스위치(selectable): 왼쪽은 박물관처럼 구경만 하는 진열대라서 체크박스를 끄고, 오른쪽은 직접 물건을 고르는 매대라서 체크박스를 켜줬어요.
  // - 리모컨으로 사진첩 넘기기(좌측 페이지네이션): 변화 과정이 길다면, 리모컨 버튼(이전/다음)을 톡톡 눌러서 한 장씩 차례대로 감상할 수 있게 해줘요.
  // return 안은 브라우저에 보여줄 JSX 구조다. className은 Tailwind CSS 디자인이고 { } 안은 JavaScript 표현식이다.
  return (
    // 가장 바깥 div는 배포자 모드 전체를 세로 방향으로 배치하고 배경색과 여백을 적용한다.
    <div className="flex flex-col w-full bg-[#e9eef5] p-4 gap-6">
      {/* && 조건부 렌더링: 버전 범위가 잘못된 경우에만 빨간 안내문을 화면에 만든다. */}
      {versionRangeInvalid && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          업데이트 버전은 현재 버전과 같거나 더 최신이어야 합니다.
        </div>
      )}

      {/* 패키징 장바구니와 실행 영역이다. 오른쪽 표에서 고른 APP과 패키징 시작 버튼을 보여준다. */}
      <section className="bg-white rounded-xl border border-slate-400 shadow-lg p-5 flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-extrabold text-lg text-slate-800">패키징 장바구니</span>
            </div>
            {/* 선택 항목이 하나 이상일 때만 장바구니 초기화 버튼을 표시한다. */}
            {selectedItems.length > 0 && (
              /* 클릭 시 빈 배열 []을 저장해 장바구니의 모든 항목을 제거한다. */
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
            {/* 삼항 연산자로 빈 장바구니 안내와 선택 항목 카드 중 하나만 표시한다. */}
            {selectedItems.length === 0 ? (
              <div className="flex h-full min-h-[40px] items-center justify-center text-sm font-bold text-slate-400">
                오른쪽 업데이트 버전에서 패키징할 APP을 선택해주세요.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {/* map으로 선택 항목 객체마다 작은 카드 하나를 만든다. key는 React가 각 카드를 구분하는 값이다. */}
                {selectedItems.map((item) => (
                  <span key={`${item.versionName}-${item.code}`} className="rounded border border-indigo-200 bg-indigo-100 px-2 py-1 text-xs font-extrabold text-indigo-800 shadow-sm">
                    {item.versionName} - {item.code}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* 패키징 JOB 생성 또는 조회 오류가 있을 때만 상세 오류 영역을 표시한다. */}
          {jobError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
              <div>{jobError}</div>
              {/* 레지스트리 오류 항목을 분석했다면 APP/IMAGE TAG 카드를, 아니면 원문 detail을 표시한다. */}
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
        {/* handleStartPackaging 뒤에 ()를 붙이지 않아 렌더링 중이 아니라 클릭할 때 실행한다.
            packagingDisabled가 true면 브라우저가 버튼 클릭을 받지 않는다. */}
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
            {/* 패키징 요청이 진행 중이면 버튼 문구를 변경한다. */}
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
              {/* 좌측 검색 입력창은 leftSearch 상태와 연결된 제어 input이다.
                  e.target.value는 현재 입력 문자열이며 Enter를 누르면 왼쪽 서버 검색을 실행한다. */}
              <input 
                type="text" 
                placeholder={leftSearchLoading ? "서버 검색 중..." : "전체 버전 검색 후 Enter"}
                value={leftSearch}
                onChange={(e) => setLeftSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVersionSearch("left")}
                disabled={leftSearchLoading}
                className="flex-1 min-w-[180px] appearance-none rounded-lg border border-slate-300 bg-white py-2 px-3 text-base font-bold text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-shadow"
              />
              {/* 좌측 버전 선택 드롭다운에 독립 검색 결과, 선택 함수와 다음 페이지 로딩 함수를 props로 전달한다. */}
              {/* 오른쪽보다 최신인 왼쪽 버전은 선택할 수 없도록 옵션 단위로 비활성화한다. */}
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

          {/* 비교할 버전이 있을 때만 한 페이지에 버전 하나를 넘겨 보는 이전/다음 도구를 표시한다. */}
          {leftSequence.length > 0 && (
            <div className="h-[58px] shrink-0 px-4 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
              {/* 함수형 상태 변경으로 최신 page에서 1을 빼되 0보다 작아지지 않게 한다. */}
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
                {/* 배열 index는 0부터 시작하므로 사용자에게 보여줄 현재 페이지 번호에는 1을 더한다. */}
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
              /* 왼쪽은 비교용이므로 selectable=false를 전달해 APP 체크박스를 만들지 않는다.
                 상세 조회 중에는 undefined를 전달해 ManifestTable이 로딩 화면을 표시하게 한다. */
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
              {/* 우측 검색은 rightSearch와 rightSearchResults만 바꾸므로 왼쪽 드롭다운에 영향을 주지 않는다. */}
              <input 
                type="text" 
                placeholder={rightSearchLoading ? "서버 검색 중..." : "전체 버전 검색 후 Enter"}
                value={rightSearch}
                onChange={(e) => setRightSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVersionSearch("right")}
                disabled={rightSearchLoading}
                className="flex-1 min-w-[180px] appearance-none rounded-lg border border-slate-300 bg-white py-2 px-3 text-base font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              />
              {/* 우측 드롭다운은 왼쪽 현재 버전보다 과거인 옵션을 비활성화한다. */}
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

          {/* 오른쪽 버전을 선택하면 백엔드 패키징 가능 여부의 로딩·차단·정상 메시지를 표시한다. */}
          {rightVersionName && (
            <div className={`h-[58px] shrink-0 border-b px-4 text-sm font-bold flex items-center ${
              selectionBlocked || eligibilityError
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-white text-slate-600"
            }`}>
              {/* 중첩 삼항 연산자로 검증 중, PENDING 차단, API 오류, 정상 안내 중 하나를 선택한다. */}
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
            {/* 오른쪽은 최종 목표 버전 하나를 선택 가능한 ManifestTable로 표시한다. */}
            {rightSequence.length > 0 ? rightSequence.map(vName => (
              /* selectable=true이면 각 APP과 전체 선택 체크박스를 사용할 수 있다. */
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

      {/* alertMessage가 있으면 공통 알림 모달을 열고, 닫을 때 메시지를 빈 문자열로 초기화한다. */}
      <AlertModal
        isOpen={!!alertMessage}
        message={alertMessage}
        type="warning"
        onClose={() => setAlertMessage("")}
      />
    </div>
  );
};
