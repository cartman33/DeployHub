//Job 관리 페이지 

/*
용어 정리 
source : 에러 객체 정보 모음
statusFilter : 우측 상단 필터 값 (ALL, PENDING, DONE, FAILED 등)

api 통신 함수 
listPackageJobs : 서버에서 Job 전체 목록을 가져오는 함수
getPackageJob   : 특정 Job의 상세 정보(파일 목록, 에러 내역 등)를 가져오는 함수
deletePackage   : 특정 Job의 패키지 산출물을 스토리지에서 삭제 요청하는 함수
runAdminCleanup : 보존 기한이 만료된 오래된 패키지들을 일괄 정리(삭제)하는 함수
retryPackageJob : 실패한 Job 항목에 대해 서버에 재시도를 요청하는 함수
*/

import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { listPackageJobs, getPackageJob, deletePackage, runAdminCleanup, retryPackageJob } from "../../services/api";

//Done이거나 Failed 일때만 삭제 가능 
const PACKAGE_DELETE_ALLOWED_STATUSES = new Set(["DONE", "FAILED"]);

//digest 불일치(E-0603) 에러 발생시 재시도 차단 => 이미지 태그 다시 세팅 , digest는 해시값으로 같은 버전명이여도 해시값이 다를 수도 있기 때문에
const NON_AUTOMATIC_RETRY_CODES = new Set(["E-0603"]);

//에러 객체들 E-xxxx 형태의 에러 코드만 검색하는 함수 
const getErrorCode = (source) => {
  const directCode = source?.errorCode || source?.code;
  //정규식 테스트, 테스트에 해당하는 에러 코드가 있다면 directCode로 return 
  if (typeof directCode === "string" && /^E-\d{4}$/.test(directCode)) return directCode;

  //위의 정규식을 통과하지 못한 에러 코드들은 다음과 같은 payload에 있을 확률이 높음
  const candidates = [source?.errorMessage, source?.message, source?.payload?.errorCode, source?.payload?.code, source?.payload?.message];
  for (const value of candidates) {
    //값이 비어있거나 string이 아니라면 continue 
    if (typeof value !== "string") continue;
    //글자와 혼합되어 있는 에러코드를 찾기 위해 ^,$ 제외 정규식 테스트 
    const matched = value.match(/E-\d{4}/);
    //결과물 반환 matched[0]은 정규식에 매칭된 첫번째 결과물
    if (matched) return matched[0];
  }
  //그럼에도 없으면 빈 문자열 반환 
  return "";
};

//에러 발생 분류 함수 
//item과 작업 상태를 getFailureStage에 받음 
const getFailureStage = (item, jobStatus) => {

  //getErrorCode 호출 => E-xxxx 형태로
  const code = getErrorCode(item);
  //에러 메시지도 포함 
  const message = item?.errorMessage || "";
  
  //각각의 에러 코드 정규식에 따라 분류 

  //업로드 에러 
  if (/^E-11/.test(code) || /^E-045[1-3]$/.test(code) || (code === "E-0604" && message.includes("업로드"))) {
    return { key: "UPLOAD", label: "업로드", className: "border-violet-200 bg-violet-50 text-violet-700" };
  }

  //다운로드 에러 
  if (/^E-06/.test(code)) {
    return { key: "DOWNLOAD", label: "다운로드", className: "border-sky-200 bg-sky-50 text-sky-700" };
  }

  //검증 에러 
  if (/^E-05/.test(code)) {
    return { key: "VALIDATION", label: "검증", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }

  //외부 연동 에러 
  if (/^E-04/.test(code)) {
    return { key: "EXTERNAL", label: "외부 연동", className: "border-orange-200 bg-orange-50 text-orange-700" };
  }

  //Failed해서 끝났는데 Pending 상태인 경우 미확인으로 처리 
  if (jobStatus === "FAILED" && item?.status === "PENDING") {
    return { key: "UNKNOWN", label: "미확인", className: "border-red-200 bg-red-50 text-red-700" };
  }
  //위 조건에 아무것도 맞지 않다면 기본값 반환 -> 실패한 item -> 처리 , 정상 -> -
  return { key: "UNKNOWN", label: item?.status === "FAILED" ? "처리" : "-", className: "border-slate-200 bg-slate-50 text-slate-600" };
};

//에러 코드 제외 후 원인 설명을 위한 함수 
const getErrorDescription = (item) => (item?.errorMessage || "").replace(/^E-\d{4}\s*:\s*/, "");

//byte를 읽기 쉬운 gb,mb,kb로 변환하는 함수 
const formatFileSize = (bytes) => {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return "-";
  const value = Number(bytes);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
};

//sharepoint url를 복사 함수 
//copyText라는 비동기 함수 생성 
const copyText = async (text) => {
  //복사할 게 없다면 false를 return 
  if (!text) return false;
  try {
    //최신 브라우저에서 지원하는 복사 방식을 먼저 시도 
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    //구형 브라우저에서 지원하는 복사 방식을 최신 방식 실패시 시도 
    //textarea를 생성하고 body에 붙인 후 select()로 선택하고 execCommand("copy")로 복사 후 제거
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    //복사가 끝나면 textArea 삭제 
    textArea.remove();
    return copied;
  }
};

//Job 관리 페이지 컴포넌트 
export const JobManagementPage = () => {
  //페이지 전체 목록 상태 
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL"); //성공, 실패, 진행중 상태 
  const [loading, setLoading] = useState(true); //로딩중 여부 
  const [error, setError] = useState("");
  
  //재시도 상태
  const [retryingVersionName, setRetryingVersionName] = useState("");
  
  //상세정보 상태 
  const [expandedVersionName, setExpandedVersionName] = useState("");
  const [expandedJobDetail, setExpandedJobDetail] = useState(null);
  
  //상세정보 로딩, UI 상태 (펼쳐진 상세정보)
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [copied, setCopied] = useState(false);

  //옵셔널 체이닝 ?.를 사용해 items를 안전하게 꺼내옴
  const expandedItems = expandedJobDetail?.items || [];

  //작업 실패시 실패원인이 데이터에 있는지 확인하는 함수 
  const failureDetailsMissing = expandedJobDetail?.job?.status === "FAILED"
  //some을 통해 하나도 없다면 true 
    && !expandedItems.some((item) => getErrorCode(item) || item.errorMessage);

  //컴포넌트 마운트 상태 추적 (화면 랜더링 확인용)
  const isMounted = useRef(true);

  //컴포넌트 생명주기, 화면이 나타나면 true, 페이지 이동이나 화면이 없어지면 false 
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);


  //서버에서 Job 목록을 가져오는 함수
  //fecthJobs라는 비동기 함수 생성 
  //useCallback은 불필요한 재랜더링을 막기 위함 
  const fetchJobs = useCallback(async () => {
    //로딩상태 
    setLoading(true);
    setError("");
    try {
      //필터 조건 생성 , ALL이면 전부, sucess나 failed라면 해당 글자를 넘겨 필터링 
      const statusParam = statusFilter === "ALL" ? undefined : statusFilter;

      //api.js에서 listPackageJobs를 호출하고 서버와 통신해 await 함수를 통해 실제 데이터를 받을때까지 대기 받으면 data에 넣음 
      const data = await listPackageJobs(statusParam);
      
      //받은 데이터형식을 배열에 안전하게 저장 
      const jobList = Array.isArray(data) ? data : (data?.items || []);
      
      //현재 페이지에서 잘 보여지고 있는지 확인
      if (isMounted.current) {
        setJobs(jobList);
      }
      //에러 발생시 에러메시지 출력
    } catch (err) {
      if (isMounted.current) {
        setError(err.payload?.message || err.message || "Job 목록을 불러오는데 실패했습니다.");
      }
    } finally {
      //성공이던 실패던 로딩은 false로 종료 
      if (isMounted.current) {
        setLoading(false);
      }
    }
    //필터 sucess, failed, all에 맞춰서 새로고침 
  }, [statusFilter]);

  //페이지가 처음 렌더링될 때 fetchJobs를 호출하여 Job 목록을 가져옴 => 필터를 조건을 바꿀때마다 fetchJobs이 갱신되고 useEffect으로 화면 갱신 
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  //상세정보 열기, 닫기 토글 함수 
  const handleToggleDetails = async (versionName) => {
    setCopied(false);
    if (expandedVersionName === versionName) {
      setExpandedVersionName("");
      setExpandedJobDetail(null);
      setDetailError("");
      return; //함수는 여기서 끝 
    }

    //상세정보 열기 
    setExpandedVersionName(versionName);
    setExpandedJobDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      //안전하게 api 통신 시작 Job의 versionName을 보내 상세정보를 불러옴
      const detail = await getPackageJob(versionName);
      //성공시 detail 
      if (isMounted.current) setExpandedJobDetail(detail);
    } catch (err) {
      //에러 발생시 에러 메시지 출력 
      if (isMounted.current) setDetailError(err.payload?.message || err.message || "JOB 상세 정보를 불러오지 못했습니다.");
    } finally {
      //성공이던 실패던 로딩중 종료 
      if (isMounted.current) setDetailLoading(false);
    }
  };

  //상세정보와 전체 Job 목록 새로고침 함수
  const handleRefreshJobs = async () => {
    //UI 변화 방지 
    const versionNameToRefresh = expandedVersionName;
    //전체 목록과 상세정보 새로고침 동시 진행 
    if (versionNameToRefresh) {
      setDetailLoading(true);
      setDetailError("");
    }

    //Promise.allSettled를 사용하여 fetchJobs(전체 Job 목록)와 getPackageJob(해당 Job 상세정보)을 동시에 실행하고, 각각의 결과를 배열로 받음
    const [, detailResult] = await Promise.allSettled([
      fetchJobs(),
      versionNameToRefresh ? getPackageJob(versionNameToRefresh) : Promise.resolve(null),
    ]);

    //페이지 이동시 return으로 새로고침 함수 종료 
    if (!isMounted.current || !versionNameToRefresh) return;
    
    //Promise.allSettled 성공시 상태 fulfilled 
    if (detailResult.status === "fulfilled") {
      //최신데이터를 화면상태(setExpandedJobDetail)로 업데이트
      setExpandedJobDetail(detailResult.value);
    } else {
      //아니라면 에러메시지 출력 
      const err = detailResult.reason;
      setDetailError(err?.payload?.message || err?.message || "JOB 상세 정보를 새로고침하지 못했습니다.");
    }
    setDetailLoading(false);
  };

  //사용자가 URL 복사 버튼 클릭(event)시 실행되는 비동기 handleCopyResults 함수 
  const handleCopyResults = async (event) => {
    event.stopPropagation();
    //detail에 Job의 상세 정보를 담음 
    const detail = expandedJobDetail; 
    const urls = [
      //?.으로 sharepoint 폴더 url로 안전하게 가져오기 
      detail?.job?.spFolderUrl,
      //item배열에서 map으로 fileUrl만 뽑아냄 
      ...(detail?.items || []).map((item) => item.fileUrl),
      //filter(Boolean)로 null, undefined, 빈 문자열 제거
    ].filter(Boolean);
    
    //url없으면 함수 종료 
    if (urls.length === 0) return;
    
    //줄바꿈 기호 넣어서 한번에 긴 url로 만듬 
    //copyText 함수 호출해 복사 
    if (await copyText(urls.join("\n"))) {
      //성공시 true
      setCopied(true);
      //1.8초 후에 다시 false로 timeout 
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  //삭제 버튼 클릭시 Job 패키지 삭제, versionName과 status를 매개변수로 받아 처리 
  const handleDelete = async (versionName, status) => {
    //진행중인 패키지를 걸러내기 위한 if문 , 조건에 걸리면 경고문 출력
    if (!PACKAGE_DELETE_ALLOWED_STATUSES.has(status)) {
      alert("진행 중인 Job의 패키지 산출물은 삭제할 수 없습니다.");
      return;
    }
    
    //사용자 확인, 삭제 버튼 클릭시 경고창
    if (!window.confirm(`[${versionName}]의 패키지 산출물 파일을 삭제하시겠습니까?\nJob 이력은 삭제되지 않습니다.`)) {
      return;
    }
    
    //실제 삭제 시작 
    try {
      await deletePackage(versionName);
      alert("패키지 산출물이 삭제되었습니다. Job 이력은 유지됩니다.");
      //삭제시 fetchJobs 호출로 Job 목록 새로고침
      fetchJobs();
      //실패시 에러메시지 출력 
    } catch (err) {
      alert(err.payload?.message || err.message || "패키지 산출물 삭제 중 오류가 발생했습니다.");
    }
  };

  //실패한 Job 항목 비동기 재시도 함수, versionName을 매개변수로 받아 처리
  const handleRetry = async (versionName) => {
    setRetryingVersionName(versionName);
    try {
      //상세정보가 이미 펼쳐져 있고 expandedJobDetail이 존재하면 그대로 사용, 아니면 getPackageJob 호출 => 캐싱 활용
      const detail = expandedVersionName === versionName && expandedJobDetail
        ? expandedJobDetail
        : await getPackageJob(versionName);
        
      //재시도 항목 대상들 걸러내기 
      const failedItems = (detail?.items || []).filter((item) => item.status === "FAILED" && item.imageTag);
      const retryItems = failedItems.filter((item) => !NON_AUTOMATIC_RETRY_CODES.has(getErrorCode(item)));
      
      //걸러낸 대상들 중의 imageTag만 map으로 추출 및 다시 retryImageTags 배열로 만듬 
      const retryImageTags = [...new Set(retryItems.map((item) => item.imageTag))];
      //걸러진 대상들은 blockedItems에 모아서 사용자에게 전달 
      const blockedItems = failedItems.filter((item) => NON_AUTOMATIC_RETRY_CODES.has(getErrorCode(item)));

      //재시도 가능한 ImageTags가 없다면 에러메시지 출력 
      if (retryImageTags.length === 0) {
        const blockedMessage = blockedItems.length > 0
          ? "digest 불일치(E-0603)는 자동 재시도 대상이 아닙니다. 메인버전의 IMAGE TAG를 다시 확정해주세요."
          : "재시도할 FAILED 항목의 IMAGE TAG가 없습니다.";
        alert(blockedMessage);
        return;
      }

      //재시도 요약 정리 reduce 함수 , item을 돌면서 counts 안에 집어넣음 
      const stageCounts = retryItems.reduce((counts, item) => {
        const stage = getFailureStage(item).label;
        counts[stage] = (counts[stage] || 0) + 1;
        return counts;
      }, {});

      //빌드 N건, 배포 N건을 보여주기 위한 문자열 생성 및 출력 
      const stageSummary = Object.entries(stageCounts).map(([stage, count]) => `${stage} ${count}건`).join(", ");
      //blockedItems가 있다면 E-0603 N건은 자동 재시도에서 제외됩니다. 출력
      const blockedNotice = blockedItems.length > 0 ? `\nE-0603 ${blockedItems.length}건은 자동 재시도에서 제외됩니다.` : "";
      
      //재시도 요약, 빌드,배포 건수, 재시도 제외 한번에 confirm으로 출력 
      if (!window.confirm(`[${versionName}] 실패 항목 ${retryImageTags.length}건만 재시도합니다.\n${stageSummary}${blockedNotice}\n\n계속하시겠습니까?`)) {
        return;
      }

      //재시도 요청 및 예외처리 
      try {
        //await 함수를 통해 요청 및 응답 대기 
        await retryPackageJob(versionName, { imageTags: retryImageTags, force: false });
        alert(`실패 항목 ${retryImageTags.length}건의 재시도 요청이 접수되었습니다.`);
      } catch (err) {
        //실패시 getErrorCode를 얻고 
        const errorCode = getErrorCode(err);
        
        //409에러나 E-0703(작업디렉터리 소실)에러가 아니라면 err를 던짐 
        if (err.status !== 409 || errorCode !== "E-0703") throw err;

        //E-0703 에러시 출력 
        const forceConfirmed = window.confirm(
          "작업 디렉터리가 소실되어 실패 항목만 재시도할 수 없습니다.\n\n전체 IMAGE TAG를 다시 수집하는 강제 재시도를 진행하시겠습니까?"
        );
        //재시도 안하고 종료 
        if (!forceConfirmed) return;

        //재시도 요청 성공시 성공 메시지 출력
        await retryPackageJob(versionName, { imageTags: [], force: true });
        alert("강제 전체 재수집 요청이 접수되었습니다.");
      }

      //재시도 요청 성공 이후 화면 업데이트 
      //전체 Job 목록을 불러옴 
      await fetchJobs();
      if (expandedVersionName === versionName) {
        //상세 정보들도 업데이트 요청 
        const refreshedDetail = await getPackageJob(versionName);
        if (isMounted.current) setExpandedJobDetail(refreshedDetail);
      }
    } catch (err) {
      //실패시 에러코드 출력 
      const errorCode = getErrorCode(err);
      const prefix = errorCode ? `[${errorCode}] ` : "";
      alert(`${prefix}${err.payload?.message || err.message || "재시도 요청 중 오류가 발생했습니다."}`);
    } finally {
      setRetryingVersionName("");
    }
  };

  //패키지 일괄 정리 함수 
  const handleCleanup = async () => {
    try {
      //dry run으로 정리 요청 후 몇 개나 지워지는지 목록을 추출해서 먼저 봉줌 
      const dryResult = await runAdminCleanup(true);
      const localCount = dryResult?.localCleaned?.length || 0;
      const spCount = dryResult?.sharePointCleaned?.length || 0;
      
      //지워질게 없다면 메시지 출력 후 return 종료
      if (localCount === 0 && spCount === 0) {
        alert("정리할 보존 기한 만료 패키지가 없습니다.");
        return;
      }

      //지워질게 있다면 구체적인 안내 메시지 출력 및 confirm으로 확인창 띄우기 
      const msg = `정리 대상이 발견되었습니다.\n- 로컬 정리 대상: ${localCount}건\n- SharePoint 정리 대상: ${spCount}건\n\n정말로 스토리지 정리를 실행하시겠습니까?`;
      if (!window.confirm(msg)) {
        return;
      }

      //실제로 삭제 
      await runAdminCleanup(false);
      alert("일괄 정리가 성공적으로 완료되었습니다.");
      fetchJobs();
      //삭제 중 에러 발생시 메시지 출력 
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
            <option value="DELETED">DELETED</option>
          </select>
          <button
            onClick={handleCleanup}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-lg transition-colors border border-red-200"
          >
            오래된 JOB 일괄 정리
          </button>
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
