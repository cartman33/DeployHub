// React의 상태 관리 및 생명주기 훅을 불러옵니다.
import { useState, useEffect } from "react";
// 사용되는 아이콘 컴포넌트들을 불러옵니다.
import { 
  RocketIcon, 
  CodeIcon
} from "../components/ui/Icons";
// 배포자 모드 및 개발자 모드 대시보드 컴포넌트를 불러옵니다.
import { DeploymentPipelineDashboardSection } from "../features/deployer/DeploymentPipelineDashboardSection";
import { DeveloperVersionRegistrationSection } from "../features/developer/DeveloperVersionRegistrationSection";
import { JobManagementPage } from "../features/job/JobManagementPage";
// 백엔드 API 호출 함수들을 불러옵니다.
import { listMainVersions, registryHealth, onedriveHealth } from "../services/api";

// 불필요한 배열 생성을 방지하기 위한 기본 빈 배열입니다.
const defaultVersions = [];
const VERSION_PAGE_SIZE = 50;

/**
 * 앱의 메인 레이아웃 및 상태를 관리하는 최상위 컴포넌트입니다.
 */
export const HtmlBody = () => {
  // 현재 활성화된 네비게이션 모드를 관리합니다 ('deployer' 또는 'developer', 'job_management').
  const [activeNavigation, setActiveNavigation] = useState("deployer");
  // 메인 버전 목록 데이터를 관리합니다.
  const [versions, setVersions] = useState(defaultVersions);
  // 현재 선택된 버전의 이름을 관리합니다.
  const [selectedVersionName, setSelectedVersionName] = useState("");
  // 버전 목록 로딩 상태를 관리합니다.
  const [loadingVersions, setLoadingVersions] = useState(true);
  // [추가됨] 메인버전 목록 페이징을 위한 상태 (현재 페이지 번호)
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [totalVersionCount, setTotalVersionCount] = useState(0);
  const [loadingMoreVersions, setLoadingMoreVersions] = useState(false);
  // 버전 목록 로드 중 발생한 에러 메시지를 관리합니다.
  const [versionError, setVersionError] = useState("");

  /**
   * 백엔드에서 메인 버전 목록을 불러오는 비동기 함수입니다.
   */
  const loadVersions = async (keyword = "", requestedPage = 0, append = false) => {
    if (append) {
      setLoadingMoreVersions(true);
    } else {
      setLoadingVersions(true);
    }
    setVersionError("");

    try {
      const searchStr = typeof keyword === "string" ? keyword : "";
      const response = await listMainVersions(searchStr, requestedPage, VERSION_PAGE_SIZE);
      const items = response?.items || [];
      const responsePage = Number.isFinite(Number(response?.page))
        ? Number(response.page)
        : requestedPage;
      const responseSize = Number.isFinite(Number(response?.size))
        ? Number(response.size)
        : VERSION_PAGE_SIZE;
      const totalCount = Number.isFinite(Number(response?.totalCount))
        ? Number(response.totalCount)
        : items.length;

      // 서버 정렬 순서를 유지하면서 다음 페이지의 중복 버전만 제외합니다.
      setVersions((previousVersions) => {
        if (!append) return items;

        const loadedVersionNames = new Set(previousVersions.map((version) => version.versionName));
        const newItems = items.filter((version) => !loadedVersionNames.has(version.versionName));
        return [...previousVersions, ...newItems];
      });
      setPage(responsePage);
      setCurrentKeyword(searchStr);
      setTotalVersionCount(totalCount);
      setHasMore((responsePage + 1) * responseSize < totalCount);
    } catch (error) {
      setVersionError(error.payload?.message || error.message || "메인버전 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      if (append) {
        setLoadingMoreVersions(false);
      } else {
        setLoadingVersions(false);
      }
    }
  };

  const loadMoreVersions = () => {
    if (!hasMore || loadingMoreVersions) return;
    loadVersions(currentKeyword, page + 1, true);
  };

  const searchVersionOptions = async (keyword) => {
    const searchStr = typeof keyword === "string" ? keyword.trim() : "";
    if (!searchStr) return versions;

    const results = [];
    const loadedNames = new Set();
    let requestedPage = 0;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await listMainVersions(searchStr, requestedPage, VERSION_PAGE_SIZE);
      const items = response?.items || [];
      const responsePage = Number.isFinite(Number(response?.page)) ? Number(response.page) : requestedPage;
      const responseSize = Number.isFinite(Number(response?.size)) ? Number(response.size) : VERSION_PAGE_SIZE;
      const totalCount = Number.isFinite(Number(response?.totalCount)) ? Number(response.totalCount) : items.length;

      items.forEach((version) => {
        if (!loadedNames.has(version.versionName)) {
          loadedNames.add(version.versionName);
          results.push(version);
        }
      });

      hasNextPage = items.length > 0 && (responsePage + 1) * responseSize < totalCount;
      requestedPage = responsePage + 1;
    }

    return results;
  };

  const ensureVersionLoaded = async (versionName) => {
    if (!versionName || versions.some((version) => version.versionName === versionName) || !hasMore) {
      return versions;
    }

    setLoadingMoreVersions(true);
    try {
      let mergedVersions = [...versions];
      let nextPage = page + 1;
      let lastLoadedPage = page;
      let lastPageSize = VERSION_PAGE_SIZE;
      let serverTotalCount = totalVersionCount;
      let targetFound = false;

      while (!targetFound && (lastLoadedPage + 1) * lastPageSize < serverTotalCount) {
        const response = await listMainVersions("", nextPage, VERSION_PAGE_SIZE);
        const items = response?.items || [];
        const responsePage = Number.isFinite(Number(response?.page)) ? Number(response.page) : nextPage;
        const responseSize = Number.isFinite(Number(response?.size)) ? Number(response.size) : VERSION_PAGE_SIZE;
        serverTotalCount = Number.isFinite(Number(response?.totalCount)) ? Number(response.totalCount) : serverTotalCount;

        const loadedNames = new Set(mergedVersions.map((version) => version.versionName));
        mergedVersions = [
          ...mergedVersions,
          ...items.filter((version) => !loadedNames.has(version.versionName)),
        ];
        targetFound = mergedVersions.some((version) => version.versionName === versionName);
        lastLoadedPage = responsePage;
        lastPageSize = responseSize;
        nextPage = responsePage + 1;

        if (items.length === 0) break;
      }

      setVersions(mergedVersions);
      setPage(lastLoadedPage);
      setCurrentKeyword("");
      setTotalVersionCount(serverTotalCount);
      setHasMore((lastLoadedPage + 1) * lastPageSize < serverTotalCount);
      return mergedVersions;
    } finally {
      setLoadingMoreVersions(false);
    }
  };

  // NCR(네이버 클라우드 레지스트리) 연결 상태를 관리합니다.
  const [ncrStatus, setNcrStatus] = useState("checking");
  // 원드라이브(OneDrive) 연결 상태를 관리합니다.
  const [odStatus, setOdStatus] = useState("checking");

  // 컴포넌트 마운트 시 초기 데이터를 불러오고 연결 상태를 확인합니다.
  useEffect(() => {
    // 메모리 누수 방지를 위한 플래그 변수입니다.
    let mounted = true;

    // 초기 버전 목록을 불러옵니다.
    loadVersions('', 0, false);
    
    // NCR 헬스 체크를 수행하고 상태를 업데이트합니다.
    registryHealth()
      .then(() => mounted && setNcrStatus("connected"))
      .catch(() => mounted && setNcrStatus("disconnected"));
      
    // 원드라이브 헬스 체크를 수행하고 상태를 업데이트합니다.
    onedriveHealth()
      .then(() => mounted && setOdStatus("connected"))
      .catch(() => mounted && setOdStatus("disconnected"));

    // 컴포넌트 언마운트 시 플래그를 해제합니다.
    return () => {
      mounted = false;
    };
  }, []);

  return (
    // 전체 화면 레이아웃을 구성하는 최상위 컨테이너
    <div className="flex min-h-screen bg-[#f8fafc] font-sans">
      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 상단 헤더 영역 */}
        <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#e0e4ec] bg-white px-8 shadow-sm">
          <div className="flex items-center gap-4">
            {/* 로고 및 새로고침 버튼 */}
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer text-left focus:outline-none"
            >
              {/* 활성화된 모드에 따라 아이콘을 다르게 표시합니다. */}
              {activeNavigation === "deployer" ? (
                <RocketIcon className="w-6 h-6 text-[#000666]" />
              ) : activeNavigation === "developer" ? (
                <CodeIcon className="w-5 h-5 text-[#000666]" />
              ) : (
                <span className="text-xl">🛠️</span>
              )}
              <h1 className="text-xl font-bold tracking-tight text-[#000666]">
                Deploy Hub
              </h1>
            </button>
          </div>

          <div className="flex items-center gap-6">
            {/* 모드 전환 스위처 */}
            <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 shadow-inner">
              <button
                onClick={() => setActiveNavigation("deployer")}
                className={`px-4 py-1.5 text-sm font-extrabold rounded-md transition-all flex items-center gap-1.5 ${
                  activeNavigation === "deployer" ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>🚀</span> 배포자 모드
              </button>
              <button
                onClick={() => setActiveNavigation("developer")}
                className={`px-4 py-1.5 text-sm font-extrabold rounded-md transition-all flex items-center gap-1.5 ${
                  activeNavigation === "developer" ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>👨‍💻</span> 개발자 모드
              </button>
              <button
                onClick={() => setActiveNavigation("job_management")}
                className={`px-4 py-1.5 text-sm font-extrabold rounded-md transition-all flex items-center gap-1.5 ${
                  activeNavigation === "job_management" ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>🛠️</span> Job 관리
              </button>
            </div>

            {/* 구분선 */}
            <div className="h-6 w-px bg-slate-300"></div>

            {/* 연결 상태 뱃지 영역 */}
            <div className="flex items-center gap-2">
              {/* NCR 연결 상태 뱃지 */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                ncrStatus === "connected" ? "bg-green-50 border-green-200" :
                ncrStatus === "checking" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  ncrStatus === "connected" ? "bg-green-500 animate-pulse" :
                  ncrStatus === "checking" ? "bg-amber-500 animate-pulse" : "bg-red-500"
                }`}></div>
                <span className={`text-[11px] font-bold tracking-wide ${
                  ncrStatus === "connected" ? "text-green-700" :
                  ncrStatus === "checking" ? "text-amber-700" : "text-red-700"
                }`}>NCR {ncrStatus === "connected" ? "연결됨" : ncrStatus === "checking" ? "확인 중" : "연결 안됨"}</span>
              </div>
              
              {/* 원드라이브 연결 상태 뱃지 */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                odStatus === "connected" ? "bg-green-50 border-green-200" :
                odStatus === "checking" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  odStatus === "connected" ? "bg-green-500 animate-pulse" :
                  odStatus === "checking" ? "bg-amber-500 animate-pulse" : "bg-red-500"
                }`}></div>
                <span className={`text-[11px] font-bold tracking-wide ${
                  odStatus === "connected" ? "text-green-700" :
                  odStatus === "checking" ? "text-amber-700" : "text-red-700"
                }`}>ONEDRIVE {odStatus === "connected" ? "연결됨" : odStatus === "checking" ? "확인 중" : "연결 안됨"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* 동적 콘텐츠 영역 */}
        <main className="flex-1 flex flex-col relative">
          {/* 에러 메시지 표시 영역 */}
          {versionError && (
            <div className="mx-8 my-4 shrink-0 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
              {versionError}
            </div>
          )}
          
          {/* 활성화된 모드에 따라 해당하는 섹션을 렌더링합니다. */}
          {activeNavigation === "deployer" ? (
            <DeploymentPipelineDashboardSection 
              versions={versions}
              setSelectedVersionName={setSelectedVersionName}
              hasMore={hasMore}
              totalVersionCount={totalVersionCount}
              loadingVersions={loadingVersions}
              loadingMoreVersions={loadingMoreVersions}
              loadMoreVersions={loadMoreVersions}
              searchVersionOptions={searchVersionOptions}
              ensureVersionLoaded={ensureVersionLoaded}
            />
          ) : activeNavigation === "developer" ? (
            <DeveloperVersionRegistrationSection 
              versions={versions}
              setVersions={setVersions}
              setSelectedVersionName={setSelectedVersionName}
            />
          ) : (
            <JobManagementPage />
          )}
        </main>
      </div>
    </div>
  );
};
