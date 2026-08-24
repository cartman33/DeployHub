import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { listPackageJobs, getPackageJob, deletePackage, runAdminCleanup, retryPackageJob } from "../../services/api";

// (REQ-11 대응) 공장이 멈춘 상태에서만 물건(파일)을 폐기할 수 있도록 허용하는 상태 목록입니다.
// 공장이 아직 돌아가고 있다면(작업 중) 물건을 버리면 안 되니까요. 작업이 완전히 끝난(성공했거나 실패한) 상태만 적어두었습니다.
const PACKAGE_DELETE_ALLOWED_STATUSES = new Set(["DONE", "FAILED"]);

// E-0603 에러는 "설계도 자체가 잘못된 경우"입니다. 설계도가 틀렸는데 공장 기계를 다시 돌린다고(자동 재시도) 해결되지 않겠죠?
// 그래서 이 에러는 기계가 혼자 다시 시도하지 않게 막아두고, 사람이 직접 설계도(IMAGE TAG)를 고치도록 하는 오류 코드입니다.
const NON_AUTOMATIC_RETRY_CODES = new Set(["E-0603"]);

/**
 * 서버(백엔드)가 보내준 복잡한 편지에서 에러 코드를 찾아내는 탐정 같은 함수입니다.
 * 
 * [왜 이렇게 여러 곳을 뒤져보나요?]
 * 편지를 보낸 사람(서버의 여러 부서)마다 에러 코드를 적어놓는 위치가 제각각이기 때문입니다.
 * 어떤 부서는 제목에, 어떤 부서는 내용에 적어두기 때문에, 편지 구석구석을 다 뒤져서 'E-0000' 모양으로 생긴 에러 코드를 찾아냅니다.
 * 
 * @param {Object} source - 에러 정보가 담긴 객체
 * @returns {string} - 추출된 에러 코드 (예: "E-0603") 또는 빈 문자열
 */
const getErrorCode = (source) => {
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

/**
 * 찾은 에러 번호표를 보고 "공장의 어느 단계에서 사고가 났는지" 짐작하는 함수입니다.
 * 서버가 "어디서 망했어요!"라고 친절하게 알려주지 않기 때문에, 에러 번호의 앞자리를 보고 (예: 11번대는 포장팀 사고, 06번대는 배송팀 사고) 유추해 냅니다.
 */
const getFailureStage = (item, jobStatus) => {
  const code = getErrorCode(item);
  const message = item?.errorMessage || "";
  
  // E-11XX (SharePoint 업로드 관련), E-045X 대역, 혹은 E-0604 중 "업로드" 단어 포함 시 업로드 단계로 분류
  if (/^E-11/.test(code) || /^E-045[1-3]$/.test(code) || (code === "E-0604" && message.includes("업로드"))) {
    return { key: "UPLOAD", label: "업로드", className: "border-violet-200 bg-violet-50 text-violet-700" };
  }
  // E-06XX 대역 (주로 다운로드 관련)
  if (/^E-06/.test(code)) {
    return { key: "DOWNLOAD", label: "다운로드", className: "border-sky-200 bg-sky-50 text-sky-700" };
  }
  // E-05XX 대역 (유효성 검증)
  if (/^E-05/.test(code)) {
    return { key: "VALIDATION", label: "검증", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  // E-04XX 대역 (외부 연동)
  if (/^E-04/.test(code)) {
    return { key: "EXTERNAL", label: "외부 연동", className: "border-orange-200 bg-orange-50 text-orange-700" };
  }
  // 공장 전체는 멈췄다(FAILED)고 떴는데, 이 부품은 아직 "작업 대기 중(PENDING)"이라고 우기고 있는 상황입니다. 원인을 알 수 없으니 "미확인" 사고로 처리합니다.
  if (jobStatus === "FAILED" && item?.status === "PENDING") {
    return { key: "UNKNOWN", label: "미확인", className: "border-red-200 bg-red-50 text-red-700" };
  }
  return { key: "UNKNOWN", label: item?.status === "FAILED" ? "처리" : "-", className: "border-slate-200 bg-slate-50 text-slate-600" };
};

/**
 * 에러 메시지에 붙어있는 "E-XXXX :" 같은 딱딱한 꼬리표를 떼어내고, 사람들이 읽기 편한 진짜 원인만 남겨주는 함수입니다.
 */
const getErrorDescription = (item) => (item?.errorMessage || "").replace(/^E-\d{4}\s*:\s*/, "");

/**
 * 컴퓨터가 이해하는 숫자(Byte)를 사람이 한눈에 알아보기 쉬운 크기(KB, MB, GB)로 예쁘게 포장해 주는 함수입니다.
 */
const formatFileSize = (bytes) => {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return "-";
  const value = Number(bytes);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
};

/**
 * 텍스트(예: 인터넷 주소)를 복사하기 위해 사용하는 함수입니다.
 * 먼저 최신 방식(navigator API)으로 깔끔하게 복사를 시도해 보고, 안 되면 예전 방식(투명한 메모장을 몰래 만들어서 복사하기)을 사용해서라도 기필코 복사해 냅니다.
 */
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

/**
 * @component JobManagementPage
 * @description 패키징 작업(JOB)들이 어떻게 진행되고 있는지 한눈에 볼 수 있는 공장 관제탑 화면입니다. 
 * 잘 돌아가는지 확인하고, 멈춘 기계는 다시 돌려보거나(재시도), 다 만든 물건을 폐기(파일 삭제)할 수 있습니다.
 */
export const JobManagementPage = () => {
  // [공장 관제탑에 필요한 상태(장부)들 준비하기]
  const [jobs, setJobs] = useState([]); // 서버에서 가져온 전체 작업 목록(작업 지시서 뭉치)
  const [statusFilter, setStatusFilter] = useState("ALL"); // 보고 싶은 상태만 걸러서 보기 위한 필터 (예: 성공한 것만 보여줘!)
  const [loading, setLoading] = useState(true); // 데이터를 가져오는 중인지(로딩 중) 확인하는 깃발
  const [error, setError] = useState(""); // 문제가 생겼을 때 방송할 에러 메시지
  
  // 사용자가 "다시 시도!" 버튼을 여러 번 다다닥 누르는 걸 막기 위해, 지금 어떤 작업이 재시도 중인지 적어두는 메모장
  const [retryingVersionName, setRetryingVersionName] = useState("");
  
  // 사용자가 "이 작업 자세히 볼래!"하고 클릭해서 서랍장을 연 작업의 이름
  const [expandedVersionName, setExpandedVersionName] = useState("");
  // 서랍장을 열었을 때 보이는 자세한 내용물(하위 아이템들)
  const [expandedJobDetail, setExpandedJobDetail] = useState(null);
  
  const [detailLoading, setDetailLoading] = useState(false); // 서랍장 내용물을 가져오는 중인지 확인하는 깃발
  const [detailError, setDetailError] = useState(""); // 서랍장 내용물을 가져오다 에러가 났을 때 보여줄 메시지
  const [copied, setCopied] = useState(false); // "복사 완료!"라고 잠깐 보여주기 위한 깃발

  const expandedItems = expandedJobDetail?.items || [];
  // 서버가 제대로 답을 주지 않은 상황을 알아채기 위한 안전망
  const failureDetailsMissing = expandedJobDetail?.job?.status === "FAILED"
    && !expandedItems.some((item) => getErrorCode(item) || item.errorMessage);

  // [관제탑이 철수했는지 확인하는 안전장치]
  // 데이터를 요청해놓고 기다리는 동안, 사용자가 다른 화면으로 넘어가버려서 이 화면(관제탑)이 사라졌을 수도 있습니다. 
  // 화면이 사라졌는데 허공에 대고 데이터를 업데이트하려다 에러가 나는 걸 막기 위해 '지금 이 화면이 열려있는지' 체크합니다.
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * 서버 창고에 가서 작업(JOB) 목록을 가져옵니다.
   * useCallback을 써서, 화면이 다시 그려질 때마다 '목록 가져오는 방법'을 처음부터 다시 외우지 않고 한 번 외운 걸 계속 써먹도록(최적화) 합니다.
   */
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // "전부 다 보여줘(ALL)"일 때는 필터라는 체를 아예 치워버려서 서버가 모든 걸 주게 만듭니다.
      const statusParam = statusFilter === "ALL" ? undefined : statusFilter;
      const data = await listPackageJobs(statusParam);
      
      // [속도를 높이는 똑똑한 전략]
      // 처음에 전체 작업 목록을 가져올 때는 서랍장 겉모습만 가져옵니다(내용물은 안 가져옴). 
      // 처음부터 모든 서랍을 다 열어보면 너무 무겁고 느려지니까요. 
      // 나중에 사용자가 "이 서랍 열어볼래!" 할 때만 그 서랍의 내용물(상세 내역)을 가져오는 방식(지연 로딩)을 씁니다.
      const jobList = Array.isArray(data) ? data : (data?.items || []);
      
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

  // 화면을 처음 열었을 때, 혹은 보고 싶은 필터를 바꿨을 때 목록을 새로 가져옵니다.
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  /**
   * 리스트에서 한 줄을 클릭했을 때, 서랍장을 스르륵 열어서 자세한 내용을 보여주거나 다시 닫는 역할을 합니다.
   */
  const handleToggleDetails = async (versionName) => {
    setCopied(false);
    // 이미 열려있는 서랍장을 한 번 더 클릭하면 닫아줍니다.
    if (expandedVersionName === versionName) {
      setExpandedVersionName("");
      setExpandedJobDetail(null);
      setDetailError("");
      return;
    }

    // 닫혀있는 서랍장을 클릭하면 활짝 열고, 서버에 그 안의 내용물을 달라고 요청합니다.
    setExpandedVersionName(versionName);
    setExpandedJobDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const detail = await getPackageJob(versionName);
      if (isMounted.current) setExpandedJobDetail(detail);
    } catch (err) {
      if (isMounted.current) setDetailError(err.payload?.message || err.message || "JOB 상세 정보를 불러오지 못했습니다.");
    } finally {
      if (isMounted.current) setDetailLoading(false);
    }
  };

  /**
   * '새로고침' 버튼을 눌렀을 때 실행되는 함수입니다.
   * 겉 목록(전체 리스트)을 새로고침하면서, 혹시 열어둔 서랍장(상세 내역)이 있다면 그 안의 내용물도 동시에 같이 새로고침합니다.
   */
  const handleRefreshJobs = async () => {
    const versionNameToRefresh = expandedVersionName;
    if (versionNameToRefresh) {
      setDetailLoading(true);
      setDetailError("");
    }

    // 심부름꾼 2명을 동시에 출발시킵니다(병렬 실행). 한 명은 전체 목록을, 다른 한 명은 열려있는 서랍장의 상세 내역을 가져오게 해서 시간을 절약합니다.
    const [, detailResult] = await Promise.allSettled([
      fetchJobs(),
      versionNameToRefresh ? getPackageJob(versionNameToRefresh) : Promise.resolve(null),
    ]);

    if (!isMounted.current || !versionNameToRefresh) return;
    
    // 심부름꾼이 가져온 상세 정보를 받아 화면에 채워 넣습니다.
    if (detailResult.status === "fulfilled") {
      setExpandedJobDetail(detailResult.value);
    } else {
      const err = detailResult.reason;
      setDetailError(err?.payload?.message || err?.message || "JOB 상세 정보를 새로고침하지 못했습니다.");
    }
    setDetailLoading(false);
  };

  /**
   * 여러 개의 주소(URL)들을 하나하나 드래그해서 복사할 필요 없이, 이 버튼 한 번이면 전체 주소를 싹 다 복사해주는 편리한 기능입니다.
   */
  const handleCopyResults = async (event) => {
    event.stopPropagation();
    const detail = expandedJobDetail;
    const urls = [
      detail?.job?.spFolderUrl,
      ...(detail?.items || []).map((item) => item.fileUrl),
    ].filter(Boolean); // 비어있거나 쓸모없는 값(null, undefined)은 버리고 진짜 주소만 남깁니다.
    
    if (urls.length === 0) return;
    
    if (await copyText(urls.join("\n"))) {
      setCopied(true);
      // '복사 완료!'라고 외친 뒤 1.8초가 지나면 다시 'URL 전체 복사'로 글자를 되돌려 놓습니다.
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  /**
   * 작업이 다 끝나고 나온 결과물(파일)만 쏙 지워주는 청소기 역할의 함수입니다.
   */
  const handleDelete = async (versionName, status) => {
    // 공장 기계가 한창 돌아가며 물건을 만들고 있는데, 다 만들어지지도 않은 물건을 버리겠다고 하면 안 되겠죠? 그래서 막습니다.
    if (!PACKAGE_DELETE_ALLOWED_STATUSES.has(status)) {
      alert("진행 중인 Job의 패키지 산출물은 삭제할 수 없습니다.");
      return;
    }
    
    // "내 기록까지 싹 다 날아가는 거 아니야?" 하고 불안해할 사용자를 위해 "기록은 남겨둡니다!"라고 친절하게 알려줍니다.
    if (!window.confirm(`[${versionName}]의 패키지 산출물 파일을 삭제하시겠습니까?\nJob 이력은 삭제되지 않습니다.`)) {
      return;
    }
    
    try {
      await deletePackage(versionName);
      alert("패키지 산출물이 삭제되었습니다. Job 이력은 유지됩니다.");
      fetchJobs(); // 파일이 지워졌으니, 화면도 최신 상태로 새로고침해서 보여줍니다.
    } catch (err) {
      alert(err.payload?.message || err.message || "패키지 산출물 삭제 중 오류가 발생했습니다.");
    }
  };

  /**
   * 실패한 작업들을 모아서 "포기하지 말고 다시 한번 해봐!"라고 기계를 다시 돌리는(재시도) 함수입니다.
   */
  const handleRetry = async (versionName) => {
    setRetryingVersionName(versionName);
    try {
      // 1. 다시 돌리기 전에, 정말로 실패한 게 맞는지 최신 상태를 확실하게 한 번 더 체크합니다.
      const detail = expandedVersionName === versionName && expandedJobDetail
        ? expandedJobDetail
        : await getPackageJob(versionName);
        
      // 2. 실패한 녀석들 중에서도 '다시 시도할 설계도(imageTag)'가 있는 애들만 따로 빼놓습니다.
      const failedItems = (detail?.items || []).filter((item) => item.status === "FAILED" && item.imageTag);
      // 3. 아까 말한 E-0603 에러("설계도 자체가 틀려먹은 녀석")는 다시 돌려봐야 시간 낭비이므로 뺍니다.
      const retryItems = failedItems.filter((item) => !NON_AUTOMATIC_RETRY_CODES.has(getErrorCode(item)));
      
      // 똑같은 설계도를 쓰는 녀석들이 여러 번 실패했다면, 설계도는 하나만 보내서 효율적으로 재시도합니다(중복 제거).
      const retryImageTags = [...new Set(retryItems.map((item) => item.imageTag))];
      const blockedItems = failedItems.filter((item) => NON_AUTOMATIC_RETRY_CODES.has(getErrorCode(item)));

      if (retryImageTags.length === 0) {
        const blockedMessage = blockedItems.length > 0
          ? "digest 불일치(E-0603)는 자동 재시도 대상이 아닙니다. 메인버전의 IMAGE TAG를 다시 확정해주세요."
          : "재시도할 FAILED 항목의 IMAGE TAG가 없습니다.";
        alert(blockedMessage);
        return;
      }

      // 사용자가 "도대체 뭐가 얼마나 실패한 거야?"라고 궁금해하지 않도록 친절하게 요약해서 보여줍니다.
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
        // 이미 성공해서 100점 맞은 애들은 놔두고, 실패한 애들만 따로 모아서 백엔드에 "얘네만 다시 테스트해 줘!"라고 보냅니다 (부분 재시도).
        await retryPackageJob(versionName, { imageTags: retryImageTags, force: false });
        alert(`실패 항목 ${retryImageTags.length}건의 재시도 요청이 접수되었습니다.`);
      } catch (err) {
        const errorCode = getErrorCode(err);
        
        // 백엔드에서 "작업하던 공간이 날아가서 실패한 것만 골라낼 수 없어!"라고(E-0703 에러) 할 때만, "그럼 처음부터 싹 다 다시 할까요?"라고 물어봅니다.
        if (err.status !== 409 || errorCode !== "E-0703") throw err;

        const forceConfirmed = window.confirm(
          "작업 디렉터리가 소실되어 실패 항목만 재시도할 수 없습니다.\n\n전체 IMAGE TAG를 다시 수집하는 강제 재시도를 진행하시겠습니까?"
        );
        if (!forceConfirmed) return;

        // 싹 다 지우고 아예 처음부터(force: true) 새 마음 새 뜻으로 모든 과정을 다시 시작하라고 백엔드에 지시합니다.
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

  /**
   * 창고(서버)에 오랫동안 쌓인 먼지 낀 옛날 작업물들을 한 번에 싹 청소해 주는 대청소 버튼 역할의 함수입니다.
   */
  const handleCleanup = async () => {
    try {
      // 1. [모의 훈련] 진짜로 버리기 전에, 미리 청소기를 빈(가짜)으로 돌려봐서 버릴 게 몇 개나 되는지 알아봅니다.
      const dryResult = await runAdminCleanup(true);
      const localCount = dryResult?.localCleaned?.length || 0;
      const spCount = dryResult?.sharePointCleaned?.length || 0;
      
      if (localCount === 0 && spCount === 0) {
        alert("정리할 보존 기한 만료 패키지가 없습니다.");
        return;
      }

      // 2. "이만큼 버릴 건데 진짜 버릴까요?" 하고 관리자에게 마지막으로 도장을 받습니다.
      const msg = `정리 대상이 발견되었습니다.\n- 로컬 정리 대상: ${localCount}건\n- SharePoint 정리 대상: ${spCount}건\n\n정말로 스토리지 정리를 실행하시겠습니까?`;
      if (!window.confirm(msg)) {
        return;
      }

      // 3. 결재가 떨어졌으니 진짜 모드로(false) 청소기를 돌려 다 지워버립니다.
      await runAdminCleanup(false);
      alert("일괄 정리가 성공적으로 완료되었습니다.");
      fetchJobs();
    } catch (err) {
      alert(err.payload?.message || err.message || "정리 배치 실행 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="p-8 max-w-[1920px] mx-auto w-full">
      {/* 화면 제목 및 우측 컨트롤 버튼 영역 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[#000666]">패키징 JOB 관리</h2>
        <div className="flex gap-2">
          {/* 상태 필터 드롭다운 */}
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
            <option value="DELETED">DELETED</option>
          </select>
          {/* 관리자용 정리 버튼 */}
          <button
            onClick={handleCleanup}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-lg transition-colors border border-red-200"
          >
            오래된 JOB 일괄 정리
          </button>
          {/* 새로고침 버튼 */}
          <button
            type="button"
            onClick={handleRefreshJobs}
            disabled={loading || detailLoading}
            className="flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {/* JOB 목록 테이블 영역 */}
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
                {/* 1) JOB 목록 행 (클릭 시 아코디언 토글) */}
                <tr
                  onClick={() => handleToggleDetails(job.versionName)}
                  className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-indigo-50/50 ${job.deletedAt ? "opacity-60 bg-slate-50" : ""}`}
                >
                  {/* 메인 버전명 렌더링 */}
                  <td className="px-6 py-4 font-mono font-bold text-slate-800 flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      {/* 펼쳐짐 여부에 따라 화살표 90도 회전 CSS 애니메이션 */}
                      <span className={`text-xs text-slate-400 transition-transform ${expandedVersionName === job.versionName ? "rotate-90" : ""}`}>▶</span>
                      {job.versionName}
                    </span>
                    {job.deletedAt && <span className="text-[10px] text-red-500 font-bold">삭제됨</span>}
                  </td>
                  {/* 진행률 렌더링 */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3 text-xs font-medium leading-none text-slate-500">
                        <span className="w-9 shrink-0">{job.progress}%</span>
                        <span>{job.completedItems} / {job.totalItems}</span>
                      </div>
                      {/* 프로그레스 바 UI */}
                      <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${job.deletedAt ? 'bg-slate-400' : job.status === 'FAILED' ? 'bg-red-500' : 'bg-indigo-500'}`} 
                          style={{ width: `${job.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  {/* 상태값(DONE, FAILED 등)에 따른 배지 색상 */}
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
                  {/* 생성 및 종료 시간 포맷팅 */}
                  <td className="px-6 py-4 text-xs text-slate-500 flex flex-col gap-1">
                    <span><strong className="font-medium text-slate-600">시작:</strong> {job.createdAt ? new Date(job.createdAt).toLocaleString() : "-"}</span>
                    {job.deletedAt ? (
                      <span className="text-red-500"><strong className="font-medium">삭제일:</strong> {new Date(job.deletedAt).toLocaleString()}</span>
                    ) : (
                      job.finishedAt && <span><strong className="font-medium text-slate-600">종료:</strong> {new Date(job.finishedAt).toLocaleString()}</span>
                    )}
                  </td>
                  {/* OneDrive 업로드된 폴더 URL 링크 */}
                  <td className="px-6 py-4 max-w-[200px] truncate">
                    {job.deletedAt ? (
                      <span className="text-slate-400 text-sm">만료됨</span>
                    ) : job.spFolderUrl ? (
                      <a 
                        href={job.spFolderUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()} // a 태그 클릭 시 부모 행(TR)의 Toggle 이벤트 전파 차단
                        className="text-indigo-600 hover:text-indigo-800 text-sm hover:underline"
                        title={job.spFolderUrl}
                      >
                        폴더 열기
                      </a>
                    ) : (
                      <span className="text-slate-400 text-sm">-</span>
                    )}
                  </td>
                  {/* 행 별 액션 버튼 모음 */}
                  <td className="px-6 py-4">
                    {job.deletedAt ? (
                      <span className="px-4 py-1.5 text-slate-400 font-bold rounded text-sm bg-slate-100">
                        삭제됨
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {/* 실패한 JOB일 경우에만 재시도 버튼 노출 */}
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
                
                {/* 2) 확장된 상세 내역 테이블 영역 (클릭된 JOB만 렌더링) */}
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
                                      {/* 재시도가 불가한 에러일 경우 부가 안내 문구 렌더링 */}
                                      {automaticRetryBlocked && <div className="mt-1 whitespace-nowrap text-[10px] text-amber-700">자동 재시도 제외</div>}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-medium text-slate-600">{formatFileSize(item.fileSize)}</td>
                                    <td className="px-4 py-3 text-xs font-medium text-slate-600">{item.retryCount ?? 0}회</td>
                                    <td className="px-4 py-3 text-xs">
                                      {/* 항목 처리 결과(성공=URL링크 / 실패=에러메시지 텍스트) 분기 렌더링 */}
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
