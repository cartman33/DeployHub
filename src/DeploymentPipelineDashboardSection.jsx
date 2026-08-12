import { useState, useEffect, useMemo } from "react";
import { 
  RocketIcon, 
  DashboardIcon, 
  SettingsIcon, 
  CheckCircleIcon, 
  AlertTriangleIcon, 
  RefreshIcon, 
  CopyIcon,
  PlayIcon,
  TerminalIcon,
  MonitorIcon,
  ListIcon,
  ChevronDownIcon,
  ClockIcon
} from "./Icons";
import { getMainVersionDetail, getPackagingEligibility, createPackageJob, getPackageJob, retryPackageJob, getChangedComponents } from "./api";

export const DeploymentPipelineDashboardSection = ({ 
  versions, 
  selectedVersionName, 
  setSelectedVersionName,
  reloadVersions
}) => {
  const [packagingStarted, setPackagingStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [jobDetail, setJobDetail] = useState(null);
  const [jobPolling, setJobPolling] = useState(false);
  const [jobError, setJobError] = useState("");
  const getCurrentUser = () => {
    try {
      return window.__DEPLOY_HUB_USER__ || localStorage.getItem('deployHubUser') || 'frontend';
    } catch {
      return 'frontend';
    }
  };
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityError, setEligibilityError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [changedComponents, setChangedComponents] = useState([]);
  const [loadingChanged, setLoadingChanged] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  const handleSearch = () => {
    if (reloadVersions) {
      reloadVersions(searchKeyword);
    }
  };

  const hasVersions = versions.length > 0;
  const activeVersionName = selectedVersionName || versions[0]?.versionName || "";

  const versionSummary = useMemo(() => {
    return versions.find(v => v.versionName === activeVersionName) || null;
  }, [versions, activeVersionName]);

  const loadEligibility = async (signal) => {
    if (!activeVersionName) {
      setEligibility(null);
      setEligibilityError("");
      return;
    }

    setEligibilityError("");
    setEligibility(null);
    try {
      const response = await getPackagingEligibility(activeVersionName);
      if (signal && signal.aborted) return;
      setEligibility(response);
    } catch (error) {
      if (signal && signal.aborted) return;
      setEligibilityError(error.payload?.message || error.message || "패키징 가능 여부를 확인하는 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    if (!activeVersionName) {
      setDetail(null);
      return;
    }

    let mounted = true;
    const controller = new AbortController();

    const loadDetail = async () => {
      setLoadingDetail(true);
      setDetailError("");
      setDetail(null);

      try {
        const response = await getMainVersionDetail(activeVersionName);
        if (!mounted || controller.signal.aborted) return;
        setDetail(response);
      } catch (error) {
        if (!mounted || controller.signal.aborted) return;
        setDetailError(error.payload?.message || error.message || "메인버전 상세 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        if (!mounted || controller.signal.aborted) return;
        setLoadingDetail(false);
      }
    };

    const loadChanged = async () => {
      if (!activeVersionName) {
        setChangedComponents([]);
        return;
      }
      setLoadingChanged(true);
      try {
        const list = await getChangedComponents(activeVersionName);
        if (!mounted || controller.signal.aborted) return;
        setChangedComponents(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!mounted || controller.signal.aborted) return;
        setChangedComponents([]);
      } finally {
        if (!mounted || controller.signal.aborted) return;
        setLoadingChanged(false);
      }
    };

    loadDetail();
    loadEligibility(controller.signal);
    loadChanged();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [activeVersionName]);

  const manifestRows = useMemo(() => {
    const subVersions = detail?.subVersions || [];
    return subVersions.map((item) => {
      const statusValue = (item.submitStatus || "UNCHANGED").toUpperCase();
      let statusText = "유지";
      let statusClass = "bg-slate-100 text-slate-500";

      if (statusValue === "UPDATED" || statusValue === "UPDATE") {
        statusText = "신규";
        statusClass = "bg-[#0006661a] text-[#000666]";
      } else if (statusValue === "PENDING") {
        statusText = "보류";
        statusClass = "bg-[#ffdbd0] text-[#7b2e12]";
      }

      const imageTag = item.components?.[0]?.imageTag || `${item.code}:${item.version}`;

      return {
        ...item,
        key: item.id,
        displayLabel: item.code,
        tag: item.version,
        component: item.components?.[0]?.imageTag ? item.components[0].imageTag.split(":")[0] : item.code,
        note: item.note || "-",
        statusText,
        statusClass,
        highlighted: statusValue === "PENDING",
        imageTag,
      };
    });
  }, [detail]);

  const pendingResults = manifestRows.filter((r) => r.statusText === "보류");
  const successResults = manifestRows.filter((r) => r.statusText === "신규");

  const handleStartPackaging = () => {
    if (!hasVersions || !activeVersionName) {
      window.alert("등록된 메인 버전이 없습니다. 먼저 개발자 도구에서 메인버전을 등록해주세요.");
      return;
    }

    if (pendingResults.length > 0) {
      window.alert("아직 보류 중인 파일이 있습니다. 패키징을 시작할 수 없습니다.");
      return;
    }

    if (eligibility && eligibility.eligible === false) {
      const message = eligibilityError || "이 메인버전은 현재 패키징 가능 상태가 아닙니다.";
      window.alert(message);
      return;
    }

    (async () => {
      setPackagingStarted(true);
      setJobError("");
      try {
        // create package job (createdBy required per spec)
        const body = { createdBy: getCurrentUser() };
        const res = await createPackageJob(activeVersionName, body);
        // start polling job status
        setJobDetail(res || null);
        setJobPolling(true);
        pollJob();
      } catch (err) {
        setJobError(err.payload?.message || err.message || "패키지 Job 생성 중 오류가 발생했습니다.");
        setPackagingStarted(false);
      }
    })();
  };

  const pollJob = async () => {
    try {
      const j = await getPackageJob(activeVersionName);
      setJobDetail(j);
      const status = j?.job?.status || j?.status || "";
      if (status === "DONE" || status === "FAILED") {
        setJobPolling(false);
        setPackagingStarted(false);
        // refresh details and versions
        if (reloadVersions) await reloadVersions();
        await refreshDetails();
        return;
      }
      // continue polling
      setTimeout(pollJob, 5000);
    } catch (err) {
      setJobError(err.payload?.message || err.message || "패키지 Job 상태 조회 중 오류가 발생했습니다.");
      setJobPolling(false);
      setPackagingStarted(false);
    }
  };

  const refreshDetails = async () => {
    setRefreshing(true);
    setDetailError("");
    setEligibilityError("");

    try {
      if (reloadVersions) {
        await reloadVersions();
      }

      const [detailResponse, eligibilityResponse] = await Promise.all([
        getMainVersionDetail(activeVersionName),
        getPackagingEligibility(activeVersionName),
      ]);

      setDetail(detailResponse);
      setEligibility(eligibilityResponse);
    } catch (error) {
      setDetailError(error.payload?.message || error.message || "메인버전 상세 정보를 불러오는 중 오류가 발생했습니다.");
      setEligibilityError(error.payload?.message || error.message || "패키징 가능 여부를 확인하는 중 오류가 발생했습니다.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyAll = async () => {
    const urls = manifestRows
      .map((r) => r.imageTag)
      .filter(Boolean)
      .join("\n");

    if (urls) {
      await navigator.clipboard.writeText(urls);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      alert("복사할 항목이 없습니다.");
    }
  };

  const handleRetry = () => {
    // preserved for generic fallback
    setRetrying(true);
    window.setTimeout(() => setRetrying(false), 1600);
  };

  const handleRetryForImage = async (imageTag) => {
    setRetrying(true);
    setJobError("");
    try {
      await retryPackageJob(activeVersionName, { imageTags: [imageTag] });
      // refresh job detail once
      const j = await getPackageJob(activeVersionName);
      setJobDetail(j);
    } catch (err) {
      setJobError(err.payload?.message || err.message || "재시도 중 오류가 발생했습니다.");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto p-8 flex flex-col gap-10">
      {/* Header Section */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <RocketIcon className="w-9 h-9 text-[#000666]" />
          <h1 className="text-4xl font-bold tracking-tight text-[#000666]">
            배포 파이프라인
          </h1>
        </div>
        <p className="text-slate-500 text-base font-medium ml-12">
          자동화된 빌드 및 패키징 프로세스를 관리합니다.
        </p>
      </header>

      {/* TOP-DOWN Layout */}
      <div className="flex flex-col gap-8 w-full">
        
        {/* 1. Version Selection Card - Full Width */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4 w-full">
          <div className="flex items-center gap-2 border-b pb-4 border-slate-100">
            <ListIcon className="w-5 h-5 text-[#000666]" />
            <h2 className="text-xl font-bold text-slate-800">메인버전 선택</h2>
          </div>
          <div className="flex flex-col gap-4 max-w-2xl">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                메인 버전 검색
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="버전 검색어 입력..." 
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 appearance-none rounded-lg border border-slate-200 bg-slate-50 py-3 pl-4 pr-4 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all"
                />
                <button 
                  onClick={handleSearch}
                  className="px-6 py-3 bg-[#000666] text-white rounded-lg font-bold hover:bg-[#090d82] transition-colors whitespace-nowrap"
                >
                  검색
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="release-version" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                검색된 메인 버전 선택
              </label>
              <div className="relative">
                <select
                  id="release-version"
                  value={selectedVersionName}
                  onChange={(e) => setSelectedVersionName(e.target.value)}
                  disabled={!hasVersions}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-3 pl-4 pr-10 text-base font-medium text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none transition-all disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {hasVersions ? versions.map(v => (
                    <option key={v.versionName} value={v.versionName}>{v.versionName}</option>
                  )) : (
                    <option value="">등록된 메인 버전이 없습니다</option>
                  )}
                </select>
                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </section>

        {/* 2. Manifest Table Card - Full Width */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4 overflow-hidden w-full">
          <div className="flex items-center justify-between border-b pb-4 border-slate-100">
            <div className="flex items-center gap-2">
              <MonitorIcon className="w-5 h-5 text-[#000666]" />
              <h2 className="text-xl font-bold text-slate-800">매니페스트 확인</h2>
            </div>
            <button
              type="button"
              onClick={refreshDetails}
              disabled={refreshing}
              className={`text-sm font-bold text-[#000666] px-4 py-2 rounded-md transition-colors border border-[#00066620] ${refreshing ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "hover:bg-[#0006660d]"}`}
            >
              {refreshing ? "새로고침 중..." : "새로고침"}
            </button>
          </div>
          
          <div className="overflow-x-auto">
            {hasVersions ? (
              <table className="w-full text-left border-collapse min-w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {["서브버전", "컴포넌트", "태그/버전", "note", "상태"].map((h) => (
                      <th key={h} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {manifestRows.map((row) => (
                    <tr key={row.key} className={`hover:bg-slate-50 transition-colors ${row.highlighted ? "bg-indigo-50/30" : ""}`}>
                      <td className="px-6 py-5 text-sm font-bold text-slate-700 uppercase whitespace-nowrap">{row.displayLabel}</td>
                      <td className="px-6 py-5 text-base font-bold text-slate-800 font-mono">{row.component || "-"}</td>
                      <td className="px-6 py-5">
                        <span className="px-3 py-1.5 rounded bg-slate-100 text-sm font-bold text-slate-600 border border-slate-200">
                          {row.tag || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1 min-w-[300px]">
                          {row.note.split('\n').map((line, i) => (
                            <span key={i} className="text-sm text-slate-500 leading-relaxed">
                              {line}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap ${row.statusClass}`}>
                          {row.statusText}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-8 py-12 text-center">
                <p className="text-lg font-bold text-slate-700">아직 등록된 메인 버전이 없습니다.</p>
                <p className="mt-2 text-sm text-slate-500">개발자 도구에서 메인버전을 먼저 등록하면 여기에서 확인할 수 있습니다.</p>
              </div>
            )}
          </div>
        </section>

        {/* 3. Start Button - Full Width */}
        {/* 변경 컴포넌트 요약 UI는 노출되지 않도록 제거 (API 바인딩 유지) */}
        <button
          onClick={handleStartPackaging}
          disabled={
            packagingStarted || !hasVersions || pendingResults.length > 0 || (eligibility && eligibility.eligible === false)
          }
          className={`w-full py-6 rounded-xl flex items-center justify-center gap-4 shadow-lg transition-all transform active:scale-[0.99] ${
            packagingStarted || !hasVersions || pendingResults.length > 0 || (eligibility && eligibility.eligible === false)
              ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
              : "bg-[#000666] text-white hover:bg-[#090d82] hover:shadow-indigo-200"
          }`}
        >
          {packagingStarted ? <ClockIcon className="w-8 h-8 animate-spin" /> : <PlayIcon className="w-8 h-8 fill-current" />}
          <span className="text-3xl font-bold tracking-widest uppercase">
            {packagingStarted ? "패키징 진행중..." : hasVersions ? "패키징 시작" : "패키징 시작 불가"}
          </span>
        </button>

        {/* 4. Deployment Results Card - Full Width */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col gap-6 relative overflow-hidden w-full">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
          <div className="flex items-center justify-between border-b pb-5 border-slate-100">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="w-6 h-6 text-green-500" />
              <h2 className="text-2xl font-bold text-slate-800">배포 결과 및 URL 복사</h2>
            </div>
            <button 
              onClick={handleCopyAll}
              className="flex items-center gap-2 text-base font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-6 py-3 rounded-xl transition-all border border-indigo-100 shadow-sm"
            >
              <CopyIcon className="w-5 h-5" />
              {copied ? "복사완료!" : "전체 URL 복사"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eligibilityError && (
              <div className="col-span-full rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
                {eligibilityError}
              </div>
            )}
            {successResults.length > 0 ? successResults.map((res) => (
              <div key={res.key} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-200 group hover:border-indigo-200 transition-all shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-xl text-green-600 shadow-inner">
                    <CheckCircleIcon className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-green-600 uppercase tracking-wider mb-0.5">Success</span>
                    <span className="text-base font-bold text-slate-800 font-mono">
                      {res.imageTag}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(res.imageTag || "");
                  }}
                  className="p-3 text-slate-400 hover:text-indigo-600 transition-colors bg-white rounded-lg border border-slate-100 group-hover:border-indigo-100"
                >
                  <CopyIcon className="w-5 h-5" />
                </button>
              </div>
            )) : (
              <div className="col-span-full text-center py-10 text-slate-400 text-base italic border-2 border-dashed border-slate-100 rounded-2xl">
                신규 업데이트 항목이 없어 배포 결과가 존재하지 않습니다.
              </div>
            )}

            {pendingResults.length > 0 && pendingResults.map((res) => (
              <div key={res.key} className="flex items-center justify-between p-5 bg-red-50/30 rounded-2xl border border-red-100 group hover:border-red-200 transition-all shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-100 rounded-xl text-red-600 animate-pulse shadow-inner">
                    <AlertTriangleIcon className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-red-600 uppercase tracking-wider mb-0.5">Failed</span>
                    <span className="text-base font-bold text-slate-800 font-mono">{res.imageTag || res.component}</span>
                    <span className="text-sm font-bold text-red-500 mt-1">
                      {retrying ? "자동 재시도 중..." : "다운로드/패키징 실패"}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleRetryForImage(res.imageTag || res.component)}
                  disabled={retrying}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
                    retrying 
                      ? "bg-slate-100 text-slate-400" 
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <RefreshIcon className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
                  재시도
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
