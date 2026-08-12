import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  CheckCircleIcon, 
  CopyIcon,
  PlayIcon,
  MonitorIcon,
  ListIcon,
  ClockIcon,
  ShoppingCartIcon
} from "../../components/ui/Icons";
import { getMainVersionDetail, getPackagingEligibility, createPackageJob, getPackageJob } from "../../services/api";

// 서브버전 항목들의 기본 정렬 순서 정의
const SUBVERSION_ORDER = ["CC", "FOGGER", "SWG", "STDAPI", "PIIDS", "PIPS", "CIDS", "EXT", "OCR"];

// 텍스트 내의 URL(http/https)을 클릭 가능한 링크(a 태그)로 변환하는 유틸리티 함수
const linkifyText = (text) => {
  if (!text) return text;
  const urlPattern = /(https?:\/\/[^\s<>]+)/g;
  const parts = text.split(urlPattern);
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

const CheckIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// [컴포넌트] 개별 버전의 서브버전 상세 목록을 그리는 테이블 컴포넌트
const ManifestTable = ({ versionName, detail, selectable, selectedItems, toggleItem, toggleAllItems }) => {
  const rows = useMemo(() => {
    if (!detail) return [];
    const subVersions = detail.subVersions || [];
    const map = {};
    subVersions.forEach(sv => {
      map[(sv.code || "").toUpperCase()] = sv;
    });

    return SUBVERSION_ORDER.map(code => {
      const item = map[code];
      if (!item) {
        return {
          code,
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
      if (statusValue === "UPDATED" || statusValue === "UPDATE") {
        statusText = "UPDATE";
        statusClass = "bg-indigo-100 text-indigo-700 font-bold border border-indigo-200";
      } else if (statusValue === "PENDING") {
        statusText = "PENDING";
        statusClass = "bg-orange-100 text-orange-700 font-bold border border-orange-200";
      }
      
      const imageTags = item.components?.length > 0 ? item.components.map(c => c.imageTag).join('\n') : `${item.code}:${item.version}`;
      let pureNote = item.note || "-";
      const match = pureNote.match(/^\[담당자:\s*(.+?)\]\s*([\s\S]*)$/);
      if (match) pureNote = match[2] || "-";
      
      return {
        ...item,
        code,
        tag: item.version || "-",
        imageTags: imageTags,
        note: pureNote,
        sql: detail.mainVersion?.sqlScript || "-",
        releaseNote: detail.mainVersion?.releaseNote || "-",
        statusText,
        statusClass,
        highlighted: statusValue === "UPDATED" || statusValue === "UPDATE",
        key: item.id || `temp_${Math.random()}`,
      };
    });
  }, [detail]);

  return (
    <div className="flex flex-col w-full bg-white border-b-4 border-slate-300">
      <div className="px-3 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between shadow-sm">
        <span className="font-extrabold text-slate-800 text-base">버전: {versionName}</span>
      </div>
      <div className="w-full">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {selectable && (
                <th className="px-1 py-2 w-14 text-center align-middle">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-extrabold text-slate-600 leading-none">선택</span>
                    <button
                      type="button"
                      onClick={() => toggleAllItems && toggleAllItems(versionName, rows)}
                      className="text-[10px] font-bold bg-white border border-slate-300 hover:border-indigo-400 hover:bg-slate-50 text-slate-700 px-1 py-0.5 rounded shadow-sm whitespace-nowrap transition-colors"
                    >
                      전체선택
                    </button>
                  </div>
                </th>
              )}
              <th className="px-2 py-3 w-[10%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">APP</th>
              <th className="px-2 py-3 w-[25%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">IMAGE TAG</th>
              <th className="px-2 py-3 text-sm font-extrabold text-slate-600 uppercase tracking-wider">NOTE</th>
              <th className="px-2 py-3 w-[12%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">SQL</th>
              <th className="px-2 py-3 w-[15%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">RELEASE NOTE</th>
              <th className="px-2 py-3 w-[12%] text-sm font-extrabold text-slate-600 uppercase tracking-wider">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => {
              const isSelected = selectedItems && selectedItems.some(i => i.imageTags === row.imageTags && i.versionName === versionName);
              
              return (
                <tr key={row.code} className={`transition-colors ${row.highlighted ? "bg-indigo-50/20" : "hover:bg-slate-50"}`}>
                  {selectable && (
                    <td className="px-2 py-3 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => toggleItem({ ...row, versionName })}
                        className={`w-7 h-7 rounded flex items-center justify-center border-2 transition-all shadow-sm mx-auto ${
                          isSelected 
                            ? "bg-green-500 border-green-500" 
                            : "bg-white border-slate-300 hover:border-indigo-400"
                        }`}
                      >
                        {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
                      </button>
                    </td>
                  )}
                  <td className="px-2 py-3 text-sm font-extrabold text-slate-800 align-top">
                    {row.code}
                  </td>
                  <td className="px-2 py-3 align-top break-all">
                    <div className="flex flex-col gap-1">
                      {row.imageTags ? row.imageTags.split('\n').map((line, i) => (
                        <span key={i} className="text-[13px] font-bold text-slate-800 font-mono leading-tight">{line}</span>
                      )) : <span className="text-[13px] text-slate-400">-</span>}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top break-keep text-justify">
                    <div className="flex flex-col gap-1.5">
                      {row.note.split('\n').map((line, i) => (
                        <span key={i} className="text-[14px] font-medium text-slate-800 leading-relaxed break-words">{linkifyText(line)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="text-[13px] font-medium text-slate-700 whitespace-pre-wrap break-words leading-relaxed">{row.sql}</div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="text-[13px] font-medium text-slate-700 whitespace-pre-wrap break-words leading-relaxed">{row.releaseNote}</div>
                  </td>
                  <td className="px-2 py-3 align-top">
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

// ==========================================
// [Main Component] 배포자(Deployer) 대시보드 메인 컴포넌트
// ==========================================
export const DeploymentPipelineDashboardSection = ({ 
  versions, 
  selectedVersionName, 
  setSelectedVersionName,
  reloadVersions
}) => {
  // 화면 좌/우측의 검색창 상태
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  
  // 좌/우측에서 선택된 기준 버전명
  const defaultLeft = versions.length > 1 ? versions[1]?.versionName : versions[0]?.versionName;
  const [leftVersionName, setLeftVersionName] = useState(defaultLeft || "");
  const [rightVersionName, setRightVersionName] = useState(selectedVersionName || versions[0]?.versionName || "");
  
  // API 호출 최소화를 위한 버전 상세 정보 캐시
  const [detailsCache, setDetailsCache] = useState({});
  // 장바구니에 담긴(선택된) 패키징 대상 서브버전 아이템 목록
  const [selectedItems, setSelectedItems] = useState([]);

  const [packagingStarted, setPackagingStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jobDetail, setJobDetail] = useState(null);
  const [jobPolling, setJobPolling] = useState(false);
  const [jobError, setJobError] = useState("");
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityError, setEligibilityError] = useState("");

  // 현재 사용자 아이디 가져오기
  const getCurrentUser = () => {
    try { return window.__DEPLOY_HUB_USER__ || localStorage.getItem('deployHubUser') || 'frontend'; } 
    catch { return 'frontend'; }
  };

  // 선택된 좌/우 기준 버전에 따라 화면에 렌더링할 버전 목록 계산
  const { leftSequence, rightSequence } = useMemo(() => {
    if (!versions.length) return { leftSequence: [], rightSequence: [] };
    
    const leftIdx = versions.findIndex(v => v.versionName === leftVersionName);
    const rightIdx = versions.findIndex(v => v.versionName === rightVersionName);
    
    if (leftIdx === -1 || rightIdx === -1) return { leftSequence: [leftVersionName], rightSequence: [rightVersionName] };
    
    const rSeq = [versions[rightIdx].versionName];
    const lSeq = [];
    if (rightIdx < leftIdx) {
      for (let i = rightIdx + 1; i <= leftIdx; i++) {
        if (versions[i]) lSeq.push(versions[i].versionName);
      }
    } else {
      lSeq.push(versions[leftIdx].versionName);
    }
    
    return { leftSequence: lSeq, rightSequence: rSeq };
  }, [versions, leftVersionName, rightVersionName]);

  useEffect(() => {
    if (versions && versions.length > 0) {
      if (!versions.find(v => v.versionName === rightVersionName)) {
        const newRight = versions[0].versionName;
        setRightVersionName(newRight);
        if (setSelectedVersionName) setSelectedVersionName(newRight);
      }
      if (!versions.find(v => v.versionName === leftVersionName)) {
        const newLeft = versions.length > 1 ? versions[1].versionName : versions[0].versionName;
        setLeftVersionName(newLeft);
      }
    }
  }, [versions, rightVersionName, leftVersionName, setSelectedVersionName]);

  // 선택된 버전들의 매니페스트 상세 데이터를 백엔드에서 불러와 캐시(detailsCache)에 저장
  useEffect(() => {
    const fetchDetails = async () => {
      const needed = [...new Set([...leftSequence, ...rightSequence])];
      const toFetch = needed.filter(v => !detailsCache[v]);
      if (toFetch.length === 0) return;
      
      const newCache = { ...detailsCache };
      for (const ver of toFetch) {
        try {
          const detail = await getMainVersionDetail(ver);
          newCache[ver] = detail;
        } catch (e) {
          console.error(e);
          newCache[ver] = null;
        }
      }
      setDetailsCache(newCache);
    };
    fetchDetails();
  }, [leftSequence, rightSequence, detailsCache]);

  // 우측(배포 대상) 버전이 패키징 가능한 상태인지, 현재 동작 중인 Job이 있는지 확인
  useEffect(() => {
    const checkRightVersionStatus = async () => {
      try {
        const elig = await getPackagingEligibility(rightVersionName);
        setEligibility(elig);
        setEligibilityError("");
      } catch (err) {
        setEligibility(null);
        setEligibilityError(err.payload?.message || err.message || "패키징 가능 여부를 확인하는 중 오류가 발생했습니다.");
      }
      try {
        const j = await getPackageJob(rightVersionName);
        setJobDetail(j);
      } catch {
        setJobDetail(null);
      }
    };
    if (rightVersionName) {
      checkRightVersionStatus();
    }
  }, [rightVersionName]);

  // 개별 서브버전을 장바구니(selectedItems)에 추가/제거하는 토글 함수
  const toggleItem = (item) => {
    setSelectedItems(prev => {
      const exists = prev.some(i => i.imageTags === item.imageTags && i.versionName === item.versionName);
      if (exists) {
        return prev.filter(i => !(i.imageTags === item.imageTags && i.versionName === item.versionName));
      } else {
        return [...prev, item];
      }
    });
  };

  // 특정 버전의 전체 서브버전을 한 번에 장바구니에 추가/제거하는 함수 (전체선택 기능)
  const toggleAllItems = (vName, rows) => {
    setSelectedItems(prev => {
      const currentSelectedForVersion = prev.filter(i => i.versionName === vName);
      const newSelected = prev.filter(i => i.versionName !== vName);
      
      if (currentSelectedForVersion.length === rows.length) {
        return newSelected;
      } else {
        const itemsToAdd = rows.map(row => ({ ...row, versionName: vName }));
        return [...newSelected, ...itemsToAdd];
      }
    });
  };

  const deploymentUrls = useMemo(() => {
    if (!jobDetail?.items || !Array.isArray(jobDetail.items)) return [];
    return jobDetail.items
      .filter(item => item.fileUrl)
      .map(item => ({
        imageTag: item.imageTag,
        fileUrl: item.fileUrl,
      }));
  }, [jobDetail]);

  // 패키징 작업(Job) 상태를 5초 주기로 확인(Polling)하여 완료 여부를 체크하는 함수
  const pollJob = useCallback(async () => {
    try {
      const j = await getPackageJob(rightVersionName);
      setJobDetail(j);
      const status = j?.job?.status || j?.status || "";
      if (status === "DONE" || status === "FAILED") {
        setJobPolling(false);
        setPackagingStarted(false);
        return;
      }
      setTimeout(pollJob, 5000);
    } catch (err) {
      setJobError(err.message);
      setJobPolling(false);
      setPackagingStarted(false);
    }
  }, [rightVersionName]);

  // 장바구니에 담긴 항목들의 태그를 추출하여 실제 패키징(빌드) 작업을 서버에 요청
  const handleStartPackaging = () => {
    if (selectedItems.length === 0) {
      window.alert("패키징할 신규 변경사항을 장바구니에 담아주세요 (오른쪽 패널에서 체크).");
      return;
    }
    if (eligibility && eligibility.eligible === false) {
      window.alert(eligibilityError || "이 메인버전은 현재 패키징 가능 상태가 아닙니다.");
      return;
    }
    
    const tagsToPackage = selectedItems
      .flatMap(i => (i.imageTags || "").split('\n'))
      .map(t => t.trim())
      .filter(Boolean);

    (async () => {
      setPackagingStarted(true);
      setJobError("");
      try {
        const body = { createdBy: getCurrentUser(), imageTags: tagsToPackage };
        const res = await createPackageJob(rightVersionName, body);
        setJobDetail(res || null);
        setJobPolling(true);
        pollJob();
      } catch (err) {
        setJobError(err.payload?.message || err.message || "패키지 Job 생성 중 오류가 발생했습니다.");
        setPackagingStarted(false);
      }
    })();
  };

  // 패키징 완료 후 생성된 모든 URL 목록을 클립보드에 일괄 복사
  const handleCopyAll = async () => {
    const urls = deploymentUrls.length > 0
      ? deploymentUrls.map((r) => r.fileUrl).join("\n")
      : selectedItems.map((r) => r.imageTags).filter(Boolean).join("\n");

    if (urls) {
      await navigator.clipboard.writeText(urls);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      alert("복사할 항목이 없습니다.");
    }
  };

  return (
    <div className="flex flex-col w-full bg-slate-100 p-4 gap-6">
      
      {/* 메인 좌우 분할 영역 (이전 버전 비교 및 최신 버전 선택) */}
      <div className="w-full flex flex-col xl:flex-row gap-6">
        
        {/* 좌측 영역: 이전 버전 기록 (버전별 매니페스트 변경 이력을 세로로 길게 표시) */}
        <section className="flex-1 min-w-0 bg-white rounded-xl border border-slate-300 shadow-md flex flex-col h-[820px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 sticky top-0 z-20">
            <div className="flex items-center gap-2">
              <ListIcon className="w-6 h-6 text-[#000666]" />
              <h2 className="text-xl font-extrabold text-slate-800">현재 버전</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input 
                type="text" 
                placeholder="버전 검색..." 
                value={leftSearch}
                onChange={(e) => setLeftSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && reloadVersions && reloadVersions(leftSearch)}
                className="flex-1 min-w-[180px] appearance-none rounded-lg border border-slate-300 bg-white py-2 px-3 text-base font-bold text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-shadow"
              />
              <select
                value={leftVersionName}
                onChange={(e) => setLeftVersionName(e.target.value)}
                className="flex-[2] min-w-[200px] appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-base font-bold text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-shadow cursor-pointer"
              >
                {versions.map(v => (
                  <option key={v.versionName} value={v.versionName}>{v.versionName}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col bg-slate-100 overflow-y-auto">
            {leftSequence.length > 0 ? leftSequence.map(vName => (
              <ManifestTable 
                key={`left-${vName}`}
                versionName={vName}
                detail={detailsCache[vName]}
                selectable={false}
              />
            )) : (
              <div className="flex items-center justify-center p-12 text-base font-bold text-slate-400">
                선택한 범위에 해당하는 이전 버전이 없습니다.
              </div>
            )}
          </div>
        </section>

        {/* 우측 영역: 배포 대상 최신 버전 (패키징할 서브버전을 선택하는 단일 테이블 영역) */}
        <section className="flex-1 min-w-0 bg-white rounded-xl border-2 border-indigo-200 shadow-lg flex flex-col h-[820px]">
          <div className="p-4 border-b border-indigo-100 bg-indigo-50/60 flex flex-col gap-3 sticky top-0 z-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MonitorIcon className="w-6 h-6 text-indigo-700" />
                <h2 className="text-xl font-extrabold text-indigo-900">업데이트 버전</h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input 
                type="text" 
                placeholder="버전 검색..." 
                value={rightSearch}
                onChange={(e) => setRightSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && reloadVersions && reloadVersions(rightSearch)}
                className="flex-1 min-w-[180px] appearance-none rounded-lg border border-indigo-200 bg-white py-2 px-3 text-base font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              />
              <select
                value={rightVersionName}
                onChange={(e) => { setRightVersionName(e.target.value); setSelectedVersionName(e.target.value); }}
                className="flex-[2] min-w-[200px] appearance-none rounded-lg border border-indigo-200 bg-white py-2 pl-3 pr-8 text-base font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow cursor-pointer"
              >
                {versions.map(v => (
                  <option key={v.versionName} value={v.versionName}>{v.versionName}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col bg-white overflow-y-auto">
            {rightSequence.map(vName => (
              <ManifestTable 
                key={`right-${vName}`}
                versionName={vName}
                detail={detailsCache[vName]}
                selectable={true}
                selectedItems={selectedItems}
                toggleItem={toggleItem}
                toggleAllItems={toggleAllItems}
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
            <button 
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors border border-indigo-200 shadow-sm"
            >
              <CopyIcon className="w-4 h-4" />
              {copied ? "복사 완료!" : "전체 복사"}
            </button>
          </div>
          
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col gap-3 max-h-[160px] overflow-y-auto">
            {jobError && (
              <div className="text-base font-bold text-red-600 p-3 bg-red-50 rounded-lg border border-red-200">
                {jobError}
              </div>
            )}
            
            {deploymentUrls.length > 0 ? (
              deploymentUrls.map((res) => (
                <div key={res.imageTag} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-extrabold text-green-600 uppercase mb-0.5 tracking-wider">{res.imageTag}</span>
                    <span className="text-sm font-mono font-bold text-slate-700 truncate">{res.fileUrl}</span>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(res.fileUrl)} className="p-2 text-slate-400 hover:text-indigo-600 ml-3 rounded hover:bg-indigo-50 transition-colors">
                    <CopyIcon className="w-5 h-5" />
                  </button>
                </div>
              ))
            ) : packagingStarted ? (
              <div className="flex items-center justify-center h-16 text-base font-bold text-indigo-600 animate-pulse">
                패키징이 진행중입니다. 잠시만 기다려주세요...
              </div>
            ) : (
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
              {selectedItems.length > 0 && (
                <button
                  onClick={() => setSelectedItems([])}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded transition-colors shadow-sm"
                >
                  초기화
                </button>
              )}
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 flex-1 p-2.5 max-h-[90px] overflow-y-auto">
              {selectedItems.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm font-bold text-slate-400">
                  선택된 항목이 없습니다.
                </div>
              ) : (
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
          <button
            onClick={handleStartPackaging}
            disabled={packagingStarted || selectedItems.length === 0}
            className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all duration-200 shrink-0 ${
              packagingStarted || selectedItems.length === 0
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" 
                : "bg-[#000666] text-white hover:bg-[#090d82] active:scale-[0.98] active:shadow-sm"
            }`}
          >
            {packagingStarted ? <ClockIcon className="w-6 h-6 animate-spin" /> : <PlayIcon className="w-6 h-6 fill-current" />}
            <span className="text-xl font-extrabold uppercase tracking-wide">
              {packagingStarted ? "진행중..." : "패키징 시작"}
            </span>
          </button>
        </div>
      </section>
      
    </div>
  );
};
