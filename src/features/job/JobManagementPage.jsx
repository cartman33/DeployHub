import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { listPackageJobs, getPackageJob, deletePackage, runAdminCleanup, retryPackageJob } from "../../services/api";

const PACKAGE_DELETE_ALLOWED_STATUSES = new Set(["DONE", "FAILED"]);
// E-0603(digest 불일치)는 같은 IMAGE TAG를 다시 받아도 재현되므로 자동 재시도에서 제외한다.
// 개발자가 메인버전의 IMAGE TAG를 재확정한 뒤 새 패키징 흐름으로 처리해야 한다.
const NON_AUTOMATIC_RETRY_CODES = new Set(["E-0603"]);

const getErrorCode = (source) => {
  // API 응답 형태가 도메인 오류와 fetch 오류에서 달라 직접 필드와 메시지 내 코드를 모두 지원한다.
  const directCode = source?.errorCode || source?.code;
  if (typeof directCode === "string" && /^E-\d{4}$/.test(directCode)) return directCode;

  const candidates = [source?.errorMessage, source?.message, source?.payload?.errorCode, source?.payload?.code, source?.payload?.message];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const matched = value.match(/E-\d{4}/);
    if (matched) return matched[0];
  }
  return "";
};

const getFailureStage = (item, jobStatus) => {
  // 현재 상세 API에는 failureStage가 없어 백엔드 ErrorCode 구간으로 표시 단계를 추론한다.
  // E-0604는 다운로드/업로드 양쪽에서 쓰일 수 있어 메시지의 '업로드' 표기를 함께 확인한다.
  const code = getErrorCode(item);
  const message = item?.errorMessage || "";
  if (/^E-11/.test(code) || /^E-045[1-3]$/.test(code) || (code === "E-0604" && message.includes("업로드"))) {
    return { key: "UPLOAD", label: "업로드", className: "border-violet-200 bg-violet-50 text-violet-700" };
  }
  if (/^E-06/.test(code)) {
    return { key: "DOWNLOAD", label: "다운로드", className: "border-sky-200 bg-sky-50 text-sky-700" };
  }
  if (/^E-05/.test(code)) {
    return { key: "VALIDATION", label: "검증", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  if (/^E-04/.test(code)) {
    return { key: "EXTERNAL", label: "외부 연동", className: "border-orange-200 bg-orange-50 text-orange-700" };
  }
  if (jobStatus === "FAILED" && item?.status === "PENDING") {
    return { key: "UNKNOWN", label: "미확인", className: "border-red-200 bg-red-50 text-red-700" };
  }
  return { key: "UNKNOWN", label: item?.status === "FAILED" ? "처리" : "-", className: "border-slate-200 bg-slate-50 text-slate-600" };
};

const getErrorDescription = (item) => (item?.errorMessage || "").replace(/^E-\d{4}\s*:\s*/, "");

const formatFileSize = (bytes) => {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return "-";
  const value = Number(bytes);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
};

const copyText = async (text) => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    textArea.remove();
    return copied;
  }
};

export const JobManagementPage = () => {
  // 상태 관리: Job 목록, 상태 필터, 로딩 상태, 에러 메시지
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryingVersionName, setRetryingVersionName] = useState("");
  const [expandedVersionName, setExpandedVersionName] = useState("");
  const [expandedJobDetail, setExpandedJobDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [copied, setCopied] = useState(false);

  const expandedItems = expandedJobDetail?.items || [];
  const failureDetailsMissing = expandedJobDetail?.job?.status === "FAILED"
    && !expandedItems.some((item) => getErrorCode(item) || item.errorMessage);

  // [개선/최적화] 컴포넌트 마운트 상태를 추적하여 언마운트 시 상태 업데이트 방지 (메모리 누수 방지)
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false; // 컴포넌트 언마운트 시 false로 변경
    };
  }, []);

  // [개선/최적화] Job 목록을 가져오는 함수 (메모이제이션으로 불필요한 재생성 방지)
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const statusParam = statusFilter === "ALL" ? undefined : statusFilter;
      const data = await listPackageJobs(statusParam);
      
      // 목록 응답의 deletedAt까지 그대로 사용한다. 항목별 /files 조회는 행을 펼칠 때만 수행해
      // JOB 개수만큼 상세 요청이 발생하는 N+1 문제를 피한다.
      const jobList = Array.isArray(data) ? data : (data?.items || []);
      
      // 컴포넌트가 마운트 상태일 때만 상태 갱신
      if (isMounted.current) {
        setJobs(jobList);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err.payload?.message || err.message || "Job 목록을 불러오는데 실패했습니다.");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleToggleDetails = async (versionName) => {
    setCopied(false);
    if (expandedVersionName === versionName) {
      setExpandedVersionName("");
      setExpandedJobDetail(null);
      setDetailError("");
      return;
    }

    setExpandedVersionName(versionName);
    setExpandedJobDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      // 배포 URL과 항목별 오류는 사용자가 선택한 JOB 한 건에 대해서만 지연 조회한다.
      const detail = await getPackageJob(versionName);
      if (isMounted.current) setExpandedJobDetail(detail);
    } catch (err) {
      if (isMounted.current) setDetailError(err.payload?.message || err.message || "JOB 상세 정보를 불러오지 못했습니다.");
    } finally {
      if (isMounted.current) setDetailLoading(false);
    }
  };

  const handleCopyResults = async (event) => {
    event.stopPropagation();
    const detail = expandedJobDetail;
    const urls = [
      detail?.job?.spFolderUrl,
      ...(detail?.items || []).map((item) => item.fileUrl),
    ].filter(Boolean);
    if (urls.length === 0) return;
    if (await copyText(urls.join("\n"))) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDelete = async (versionName, status) => {
    if (!PACKAGE_DELETE_ALLOWED_STATUSES.has(status)) {
      alert("진행 중인 Job의 패키지 산출물은 삭제할 수 없습니다.");
      return;
    }
    if (!window.confirm(`[${versionName}]의 패키지 산출물 파일을 삭제하시겠습니까?\nJob 이력은 삭제되지 않습니다.`)) {
      return;
    }
    try {
      await deletePackage(versionName);
      alert("패키지 산출물이 삭제되었습니다. Job 이력은 유지됩니다.");
      fetchJobs(); // 재로딩
    } catch (err) {
      alert(err.payload?.message || err.message || "패키지 산출물 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleRetry = async (versionName) => {
    setRetryingVersionName(versionName);
    try {
      const detail = expandedVersionName === versionName && expandedJobDetail
        ? expandedJobDetail
        : await getPackageJob(versionName);
      const failedItems = (detail?.items || []).filter((item) => item.status === "FAILED" && item.imageTag);
      const retryItems = failedItems.filter((item) => !NON_AUTOMATIC_RETRY_CODES.has(getErrorCode(item)));
      // 동일 IMAGE TAG가 중복 보고되어도 재시도 요청에는 한 번만 포함한다.
      const retryImageTags = [...new Set(retryItems.map((item) => item.imageTag))];
      const blockedItems = failedItems.filter((item) => NON_AUTOMATIC_RETRY_CODES.has(getErrorCode(item)));

      if (retryImageTags.length === 0) {
        const blockedMessage = blockedItems.length > 0
          ? "digest 불일치(E-0603)는 자동 재시도 대상이 아닙니다. 메인버전의 IMAGE TAG를 다시 확정해주세요."
          : "재시도할 FAILED 항목의 IMAGE TAG가 없습니다.";
        alert(blockedMessage);
        return;
      }

      const stageCounts = retryItems.reduce((counts, item) => {
        const stage = getFailureStage(item).label;
        counts[stage] = (counts[stage] || 0) + 1;
        return counts;
      }, {});
      const stageSummary = Object.entries(stageCounts).map(([stage, count]) => `${stage} ${count}건`).join(", ");
      const blockedNotice = blockedItems.length > 0 ? `\nE-0603 ${blockedItems.length}건은 자동 재시도에서 제외됩니다.` : "";
      if (!window.confirm(`[${versionName}] 실패 항목 ${retryImageTags.length}건만 재시도합니다.\n${stageSummary}${blockedNotice}\n\n계속하시겠습니까?`)) {
        return;
      }

      try {
        // 정상 재시도는 실패한 항목만 보낸다. 성공 항목을 다시 다운로드/업로드하지 않는다.
        await retryPackageJob(versionName, { imageTags: retryImageTags, force: false });
        alert(`실패 항목 ${retryImageTags.length}건의 재시도 요청이 접수되었습니다.`);
      } catch (err) {
        const errorCode = getErrorCode(err);
        // 409 전체를 강제 재시도로 취급하지 않는다. 작업 디렉터리 소실(E-0703)만
        // 백엔드 안내에 따라 force=true와 빈 목록(전체 재수집 의미)으로 복구한다.
        if (err.status !== 409 || errorCode !== "E-0703") throw err;

        const forceConfirmed = window.confirm(
          "작업 디렉터리가 소실되어 실패 항목만 재시도할 수 없습니다.\n\n전체 IMAGE TAG를 다시 수집하는 강제 재시도를 진행하시겠습니까?"
        );
        if (!forceConfirmed) return;

        await retryPackageJob(versionName, { imageTags: [], force: true });
        alert("강제 전체 재수집 요청이 접수되었습니다.");
      }

      await fetchJobs();
      if (expandedVersionName === versionName) {
        const refreshedDetail = await getPackageJob(versionName);
        if (isMounted.current) setExpandedJobDetail(refreshedDetail);
      }
    } catch (err) {
      const errorCode = getErrorCode(err);
      const prefix = errorCode ? `[${errorCode}] ` : "";
      alert(`${prefix}${err.payload?.message || err.message || "재시도 요청 중 오류가 발생했습니다."}`);
    } finally {
      setRetryingVersionName("");
    }
  };

  const handleCleanup = async () => {
    try {
      // 1. Dry run으로 대상 확인
      const dryResult = await runAdminCleanup(true);
      const localCount = dryResult?.localCleaned?.length || 0;
      const spCount = dryResult?.sharePointCleaned?.length || 0;
      
      if (localCount === 0 && spCount === 0) {
        alert("정리할 보존 기한 만료 패키지가 없습니다.");
        return;
      }

      // 2. 사용자 확인
      const msg = `정리 대상이 발견되었습니다.\n- 로컬 정리 대상: ${localCount}건\n- SharePoint 정리 대상: ${spCount}건\n\n정말로 스토리지 정리를 실행하시겠습니까?`;
      if (!window.confirm(msg)) {
        return;
      }

      // 3. 실제 정리 실행
      await runAdminCleanup(false);
      alert("일괄 정리가 성공적으로 완료되었습니다.");
      fetchJobs();
    } catch (err) {
      alert(err.payload?.message || err.message || "정리 배치 실행 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="p-8 max-w-[1920px] mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[#000666]">패키징 JOB 관리</h2>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 bg-white"
          >
            <option value="ALL">전체 상태</option>
            <option value="PENDING">PENDING</option>
            <option value="VALIDATING">VALIDATING</option>
            <option value="DOWNLOADING">DOWNLOADING</option>
            <option value="UPLOADING">UPLOADING</option>
            <option value="DONE">DONE</option>
            <option value="FAILED">FAILED</option>
          </select>
          <button
            onClick={handleCleanup}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-lg transition-colors border border-red-200"
          >
            오래된 JOB 일괄 정리
          </button>
          <button
            type="button"
            onClick={fetchJobs}
            disabled={loading}
            aria-label="JOB 목록 새로고침"
            title="새로고침"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={loading ? "animate-spin" : ""}>↻</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold animate-pulse">
            불러오는 중...
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-bold">
            등록된 Job이 없습니다.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">메인버전</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">진행률</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">상태</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">일시</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">결과 폴더</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">작업</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <Fragment key={job.versionName}>
                <tr
                  onClick={() => handleToggleDetails(job.versionName)}
                  className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-indigo-50/50 ${job.deletedAt ? "opacity-60 bg-slate-50" : ""}`}
                >
                  <td className="px-6 py-4 font-mono font-bold text-slate-800 flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span className={`text-xs text-slate-400 transition-transform ${expandedVersionName === job.versionName ? "rotate-90" : ""}`}>▶</span>
                      {job.versionName}
                    </span>
                    {job.deletedAt && <span className="text-[10px] text-red-500 font-bold">삭제됨</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3 text-xs font-medium leading-none text-slate-500">
                        <span className="w-9 shrink-0">{job.progress}%</span>
                        <span>{job.completedItems} / {job.totalItems}</span>
                      </div>
                      <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${job.deletedAt ? 'bg-slate-400' : job.status === 'FAILED' ? 'bg-red-500' : 'bg-indigo-500'}`} 
                          style={{ width: `${job.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      job.deletedAt ? "bg-slate-200 text-slate-500" :
                      job.status === "DONE" ? "bg-green-100 text-green-700" :
                      job.status === "FAILED" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {job.deletedAt ? "DELETED" : job.status || "UNKNOWN"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 flex flex-col gap-1">
                    <span><strong className="font-medium text-slate-600">시작:</strong> {job.createdAt ? new Date(job.createdAt).toLocaleString() : "-"}</span>
                    {job.deletedAt ? (
                      <span className="text-red-500"><strong className="font-medium">삭제일:</strong> {new Date(job.deletedAt).toLocaleString()}</span>
                    ) : (
                      job.finishedAt && <span><strong className="font-medium text-slate-600">종료:</strong> {new Date(job.finishedAt).toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 max-w-[200px] truncate">
                    {job.deletedAt ? (
                      <span className="text-slate-400 text-sm">만료됨</span>
                    ) : job.spFolderUrl ? (
                      <a 
                        href={job.spFolderUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="text-indigo-600 hover:text-indigo-800 text-sm hover:underline"
                        title={job.spFolderUrl}
                      >
                        폴더 열기
                      </a>
                    ) : (
                      <span className="text-slate-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {job.deletedAt ? (
                      <span className="px-4 py-1.5 text-slate-400 font-bold rounded text-sm bg-slate-100">
                        삭제됨
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {job.status === "FAILED" && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRetry(job.versionName);
                            }}
                            disabled={retryingVersionName === job.versionName}
                            className="px-4 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold rounded text-sm transition-colors border border-amber-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {retryingVersionName === job.versionName ? "재시도 중..." : "실패 항목 재시도"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(job.versionName, job.status);
                          }}
                          disabled={retryingVersionName === job.versionName || !PACKAGE_DELETE_ALLOWED_STATUSES.has(job.status)}
                          title={PACKAGE_DELETE_ALLOWED_STATUSES.has(job.status) ? "패키지 산출물 파일 삭제" : "진행 중인 Job의 패키지는 삭제할 수 없습니다."}
                          className="px-4 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          패키지 삭제
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {expandedVersionName === job.versionName && (
                  <tr className="border-b border-indigo-100 bg-slate-50/70">
                    <td colSpan={6} className="px-6 py-5">
                      {detailLoading ? (
                        <div className="py-8 text-center text-sm font-bold text-indigo-600 animate-pulse">패키징 상세 정보를 불러오는 중...</div>
                      ) : detailError ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{detailError}</div>
                      ) : expandedJobDetail ? (
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-extrabold text-slate-800">패키징 항목 및 배포 결과 URL</h3>
                              <p className="text-xs font-medium text-slate-500">{job.versionName} JOB의 항목별 처리 결과입니다.</p>
                            </div>
                            <button
                              type="button"
                              onClick={handleCopyResults}
                              disabled={!expandedJobDetail.job?.spFolderUrl && !(expandedJobDetail.items || []).some((item) => item.fileUrl)}
                              className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {copied ? "복사 완료" : "URL 전체 복사"}
                            </button>
                          </div>

                          {failureDetailsMissing && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                              JOB은 FAILED이지만 상세 API가 실패 항목의 오류 코드와 메시지를 제공하지 않았습니다.
                              PENDING 항목은 미완료로 표시하며, 정확한 실패 단계와 원인은 백엔드 응답이 필요합니다.
                            </div>
                          )}

                          <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="mb-1 text-xs font-bold text-slate-500">결과 폴더</div>
                            {expandedJobDetail.job?.spFolderUrl ? (
                              <a
                                href={expandedJobDetail.job.spFolderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="break-all text-sm font-bold text-indigo-600 underline hover:text-indigo-800"
                              >
                                {expandedJobDetail.job.spFolderUrl}
                              </a>
                            ) : (
                              <span className="text-sm font-medium text-slate-400">아직 생성된 결과 폴더가 없습니다.</span>
                            )}
                          </div>

                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full min-w-[1100px] text-left">
                              <thead className="border-b border-slate-200 bg-slate-100">
                                <tr>
                                  <th className="px-4 py-3 text-xs font-bold text-slate-600">IMAGE TAG</th>
                                  <th className="px-4 py-3 text-xs font-bold text-slate-600">STATUS</th>
                                  <th className="px-4 py-3 text-xs font-bold text-slate-600">실패 단계</th>
                                  <th className="px-4 py-3 text-xs font-bold text-slate-600">오류 코드</th>
                                  <th className="px-4 py-3 text-xs font-bold text-slate-600">FILE SIZE</th>
                                  <th className="px-4 py-3 text-xs font-bold text-slate-600">RETRY</th>
                                  <th className="px-4 py-3 text-xs font-bold text-slate-600">배포 결과 URL / 오류 내용</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(expandedJobDetail.items || []).map((item) => {
                                  const errorCode = getErrorCode(item);
                                  const unresolvedAfterFailure = expandedJobDetail.job?.status === "FAILED" && item.status === "PENDING";
                                  const failureStage = getFailureStage(item, expandedJobDetail.job?.status);
                                  const automaticRetryBlocked = NON_AUTOMATIC_RETRY_CODES.has(errorCode);
                                  return (
                                  <tr key={item.imageTag} className={item.status === "FAILED" ? "bg-red-50/30" : ""}>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-800 break-all">{item.imageTag}</td>
                                    <td className="px-4 py-3 text-xs font-bold">
                                      <span className={`rounded-full px-2.5 py-1 ${item.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                                        {item.status || "-"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold">
                                      <span className={`inline-flex rounded border px-2 py-1 ${failureStage.className}`}>{failureStage.label}</span>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-extrabold text-red-700">
                                      {errorCode || (unresolvedAfterFailure ? "미제공" : "-")}
                                      {automaticRetryBlocked && <div className="mt-1 whitespace-nowrap text-[10px] text-amber-700">자동 재시도 제외</div>}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-medium text-slate-600">{formatFileSize(item.fileSize)}</td>
                                    <td className="px-4 py-3 text-xs font-medium text-slate-600">{item.retryCount ?? 0}회</td>
                                    <td className="px-4 py-3 text-xs">
                                      {item.fileUrl ? (
                                        <a
                                          href={item.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(event) => event.stopPropagation()}
                                          className="break-all font-bold text-indigo-600 underline hover:text-indigo-800"
                                        >
                                          {item.fileUrl}
                                        </a>
                                      ) : item.errorMessage ? (
                                        <span className="font-bold text-red-600">{getErrorDescription(item)}</span>
                                      ) : unresolvedAfterFailure ? (
                                        <span className="font-bold text-red-600">JOB 실패 후 미완료 · 상세 오류 정보 미제공</span>
                                      ) : (
                                        <span className="text-slate-400">아직 생성되지 않음</span>
                                      )}
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
