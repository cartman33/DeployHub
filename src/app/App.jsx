// 화면 상태를 기억해주는 useState와, 화면이 켜지거나 꺼질 때 특정 작업을 시켜주는 useEffect를 가져옵니다.
import { useState, useEffect } from "react";
// 우리 앱의 3가지 핵심 화면(배포자 모드, 개발자 모드, JOB 관리 화면)을 가져옵니다.
import { DeploymentPipelineDashboardSection } from "../features/deployer/DeploymentPipelineDashboardSection";
import { DeveloperVersionRegistrationSection } from "../features/developer/DeveloperVersionRegistrationSection";
import { JobManagementPage } from "../features/job/JobManagementPage";
// 백엔드 서버와 데이터를 주고받을 때 쓰는 함수들을 가져옵니다.
import { listMainVersions, registryHealth, onedriveHealth } from "../services/api";

// 텅 빈 배열을 바깥에 따로 만들어 둡니다.
// 화면 안에서 []를 계속 새로 만들면 리액트가 "어? 데이터가 바뀌었네?" 하고 착각해서 화면을 헛고생하며 다시 그릴 수 있기 때문입니다.
const defaultVersions = [];

// 무한 스크롤을 할 때, 한 번에 서버에서 몇 개씩 데이터를 가져올지 정해둡니다.
const VERSION_PAGE_SIZE = 20;

// 새로고침을 해도 사용자가 방금 전까지 보고 있던 탭(예: 개발자 모드)을 기억하기 위해 브라우저 저장소에 쓸 이름표(키)입니다.
const ACTIVE_NAVIGATION_STORAGE_KEY = "deployHub.activeNavigation";
const VALID_NAVIGATIONS = new Set(["deployer", "developer", "job_management"]);

/**
 * 브라우저 저장소에서 사용자가 마지막으로 보던 탭이 어딘지 기억을 꺼내옵니다.
 */
const getInitialNavigation = () => {
  try {
    const savedNavigation = window.localStorage.getItem(ACTIVE_NAVIGATION_STORAGE_KEY);
    // 혹시라도 이상한 글자가 저장되어 있으면 안전하게 '배포자 모드(deployer)'를 기본 화면으로 띄워줍니다.
    return VALID_NAVIGATIONS.has(savedNavigation) ? savedNavigation : "deployer";
  } catch {
    // 인터넷 방문 기록이 남지 않는 시크릿 모드 등에서는 에러가 날 수 있으므로, 이때도 기본 화면을 띄워줍니다.
    return "deployer";
  }
};

/**
 * @component HtmlBody
 * @description 우리 앱의 가장 큰 뼈대(전체 화면)입니다.
 * 제일 위쪽에 공통 헤더 메뉴를 보여주고, 사용자가 탭을 누르면 그에 맞는 화면으로 쏙쏙 바꿔 끼워주는 역할을 합니다.
 * 
 * [데이터 흐름]
 * 여기서 서버에서 받아온 전체 '버전 목록' 데이터를 꽉 쥐고 있다가, 
 * 화면 아래에 있는 각 컴포넌트들(개발자, 배포자 모드)에게 필요한 데이터를 쏙쏙 나누어 줍니다.
 */
export const HtmlBody = () => {
  // 사용자가 현재 보고 있는 탭이 어디인지 기억하는 상태입니다.
  const [activeNavigation, setActiveNavigation] = useState(getInitialNavigation);
  
  // 서버에서 받아온 전체 버전 목록 데이터들을 담아두는 상자입니다.
  const [versions, setVersions] = useState(defaultVersions);
  
  // 여러 화면에서 공통으로 "지금 내가 콕 찍어서 선택한 버전 이름"이 무엇인지 기억합니다.
  const [selectedVersionName, setSelectedVersionName] = useState("");
  
  // 처음에 화면이 켜지거나 검색할 때, 빙글빙글 도는 로딩 화면을 보여줄지 말지 결정합니다.
  const [loadingVersions, setLoadingVersions] = useState(true);
  
  // 무한 스크롤에 필요한 상태들입니다. (지금 몇 쪽을 보고 있는지, 뒤에 더 가져올 데이터가 남아있는지 등)
  const [page, setPage] = useState(0); 
  const [hasMore, setHasMore] = useState(false); 
  const [currentKeyword, setCurrentKeyword] = useState(""); 
  const [totalVersionCount, setTotalVersionCount] = useState(0); 
  
  // 무한 스크롤로 밑바닥에 닿아서 다음 페이지를 덧붙여 부를 때만 띄워주는 미니 로딩 상태입니다.
  const [loadingMoreVersions, setLoadingMoreVersions] = useState(false);
  
  // 목록을 불러오다가 서버 에러가 났을 때 보여줄 빨간색 경고 문구입니다.
  const [versionError, setVersionError] = useState("");

  // 사용자가 다른 탭(메뉴)을 누를 때마다, 그 기록을 브라우저에 몰래몰래 저장해 둡니다. (새로고침 방어용)
  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_NAVIGATION_STORAGE_KEY, activeNavigation);
    } catch {
      // 무시
    }
  }, [activeNavigation]);

  /**
   * 서버에서 버전 목록을 가져와서 우리 화면(상태)에 척척 채워넣는 함수입니다.
   * 
   * @param {string} keyword - 검색할 단어
   * @param {number} requestedPage - 불러올 페이지 번호
   * @param {boolean} append - true면 기존 목록 밑에 덧붙이고(스크롤), false면 싹 지우고 새로 씁니다(새로고침).
   */
  const loadVersions = async (keyword = "", requestedPage = 0, append = false) => {
    if (append) setLoadingMoreVersions(true);
    else setLoadingVersions(true);
    setVersionError("");

    try {
      const searchStr = typeof keyword === "string" ? keyword : "";
      // 백엔드 통신 함수(api.js)를 호출해서 데이터를 진짜로 받아옵니다.
      const response = await listMainVersions(searchStr, requestedPage, VERSION_PAGE_SIZE);
      const items = response?.items || [];
      
      // 혹시 서버가 이상한 값을 줘도 뻗지 않게 안전하게 숫자로 바꿔줍니다.
      const responsePage = Number.isFinite(Number(response?.page)) ? Number(response.page) : requestedPage;
      const responseSize = Number.isFinite(Number(response?.size)) ? Number(response.size) : VERSION_PAGE_SIZE;
      const totalCount = Number.isFinite(Number(response?.totalCount)) ? Number(response.totalCount) : items.length;

      setVersions((previousVersions) => {
        // 새로고침 상황이면 새로 받아온 데이터로 싹 덮어씌웁니다.
        if (!append) return items;

        // 무한 스크롤로 덧붙이는 상황일 때는 '똑같은 이름'이 혹시나 두 번 들어오지 않도록
        // 겹치는 애들은 쏙쏙 빼고 새로운 애들만 밑에 이어붙여 줍니다. (중복 방지)
        const loadedVersionNames = new Set(previousVersions.map((version) => version.versionName));
        const newItems = items.filter((version) => !loadedVersionNames.has(version.versionName));
        return [...previousVersions, ...newItems];
      });
      
      setPage(responsePage);
      setCurrentKeyword(searchStr);
      setTotalVersionCount(totalCount);
      // '지금까지 본 개수'보다 '서버에 있는 전체 개수'가 더 크면 아직 긁어올 데이터가 남았다는 뜻입니다.
      setHasMore((responsePage + 1) * responseSize < totalCount);
    } catch (error) {
      setVersionError(error.payload?.message || error.message || "메인버전 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      if (append) setLoadingMoreVersions(false);
      else setLoadingVersions(false);
    }
  };

  /**
   * 화면 스크롤이 맨 바닥에 닿았을 때 "다음 페이지 가져와!" 하고 부르는 녀석입니다.
   */
  const loadMoreVersions = () => {
    // 더 가져올 데이터가 없거나 이미 부르고 있는 중이면 아무것도 안 하고 가만히 있습니다.
    if (!hasMore || loadingMoreVersions) return;
    loadVersions(currentKeyword, page + 1, true);
  };

  /**
   * 사용자가 드롭다운(선택창) 안에서 특정 글자로 검색을 했을 때 결과를 찾아주는 함수입니다.
   */
  const searchVersionOptions = async (keyword) => {
    const searchStr = typeof keyword === "string" ? keyword.trim() : "";
    if (!searchStr) return versions; // 검색어가 없으면 원래 목록을 그냥 줍니다.

    const results = [];
    const loadedNames = new Set();
    let requestedPage = 0;
    let hasNextPage = true;

    // 검색창에서는 스크롤을 내리는 게 귀찮으니, 서버에 다음 페이지가 없을 때까지 끝까지 쭉 돌면서 데이터를 싹 다 긁어모읍니다.
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

  /**
   * 내가 지금 콕 찍어서 보려는 버전이 현재 화면에 안 보일 때(아직 스크롤을 안 내려서),
   * 그 버전이 화면에 나타날 때까지 서버에서 다음 페이지들을 연속으로 알아서 불러주는 똑똑한 함수입니다.
   */
  const ensureVersionLoaded = async (versionName) => {
    if (!versionName || versions.some((version) => version.versionName === versionName) || !hasMore) {
      return versions; // 이미 화면에 있거나 더 부를 게 없으면 그냥 리턴합니다.
    }

    setLoadingMoreVersions(true);
    try {
      let mergedVersions = [...versions];
      let nextPage = page + 1;
      let lastLoadedPage = page;
      let lastPageSize = VERSION_PAGE_SIZE;
      let serverTotalCount = totalVersionCount;
      let targetFound = false;

      // 내가 찾는 버전을 발견할 때까지 서버에 계속 다음 페이지를 달라고 조릅니다.
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

      // 화면에 상태를 싹 다 업데이트 해줍니다.
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

  // 우측 상단에 떠 있는 외부 연동 서버들의 상태 불빛(초록/노랑/빨강)을 관리합니다.
  const [ncrStatus, setNcrStatus] = useState("checking");
  const [odStatus, setOdStatus] = useState("checking");

  // 화면이 처음 인터넷 브라우저에 짠! 하고 나타날 때 딱 한 번만 실행되는 초기화 작업입니다.
  useEffect(() => {
    // 만약 데이터가 오기도 전에 사용자가 뒤로 가기를 눌러버렸다면 에러가 날 수 있으니 
    // "지금 이 화면이 켜져 있나요?" 하고 체크하는 안전장치입니다.
    let mounted = true; 

    loadVersions('', 0, false);
    
    // 네이버 클라우드 서버가 살아있는지 찔러봅니다.
    registryHealth()
      .then(() => mounted && setNcrStatus("connected"))
      .catch(() => mounted && setNcrStatus("disconnected"));
      
    // 원드라이브(SharePoint) 서버가 살아있는지 찔러봅니다.
    onedriveHealth()
      .then(() => mounted && setOdStatus("connected"))
      .catch(() => mounted && setOdStatus("disconnected"));

    return () => {
      // 화면이 꺼질 때(다른 페이지로 넘어갈 때) 이 변수를 끄면서 정리를 해줍니다.
      mounted = false; 
    };
  }, []);

  return (
    // 전체를 감싸는 회색 배경 도화지입니다.
    <div className="flex min-h-screen bg-[#eef2f7] font-sans">
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* 화면을 내려도 천장에 찰싹 붙어있는 공통 헤더 메뉴바 영역입니다. */}
        <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#e0e4ec] bg-white px-8 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="hover:opacity-80 transition-opacity cursor-pointer text-left focus:outline-none"
            >
              <h1 className="text-xl font-bold tracking-tight text-[#000666]">
                Deploy Hub
              </h1>
            </button>
          </div>

          <div className="flex items-center gap-6">
            {/* 탭 메뉴: 여기 버튼들을 누르면 activeNavigation 글자가 바뀌면서 아래 화면도 마술처럼 휙휙 바뀝니다. */}
            <div className="flex items-center gap-3">
              <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 shadow-inner">
                <button
                  onClick={() => setActiveNavigation("deployer")}
                  className={`px-4 py-1.5 text-sm font-extrabold rounded-md transition-all ${
                    activeNavigation === "deployer" ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  배포자 모드
                </button>
                <button
                  onClick={() => setActiveNavigation("job_management")}
                  className={`px-4 py-1.5 text-sm font-extrabold rounded-md transition-all ${
                    activeNavigation === "job_management" ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  JOB 관리
                </button>
              </div>
              <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 shadow-inner">
                <button
                  onClick={() => setActiveNavigation("developer")}
                  className={`px-4 py-1.5 text-sm font-extrabold rounded-md transition-all ${
                    activeNavigation === "developer" ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  개발자 모드
                </button>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-300"></div>

            {/* 외부 서버들이 안녕한지 깜빡깜빡 알려주는 신호등 뱃지 영역입니다. */}
            <div className="flex items-center gap-2">
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

        {/* 탭 버튼을 눌렀을 때 실제로 화면이 갈아끼워지는 메인 무대입니다. */}
        <main className="flex-1 flex flex-col relative">
          {/* 목록을 가져오다 실패하면 보여주는 빨간색 안내창입니다. */}
          {versionError && (
            <div className="mx-8 my-4 shrink-0 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
              {versionError}
            </div>
          )}
          
          {/* 
            자, 여기서 마술이 일어납니다.
            activeNavigation이 뭐냐에 따라 아래 3가지 화면 중 딱 하나만 화면에 띄워줍니다.
            그리고 "옛다, 데이터!" 하면서 자식 화면들에게 필요한 버전 목록이나 함수들을 넘겨줍니다. (이걸 프롭스(Props)라고 부릅니다)
          */}
          {activeNavigation === "deployer" ? (
            <DeploymentPipelineDashboardSection 
              versions={versions}
              setSelectedVersionName={setSelectedVersionName}
              hasMore={hasMore}
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
              hasMore={hasMore}
              loadingVersions={loadingVersions}
              loadingMoreVersions={loadingMoreVersions}
              loadMoreVersions={loadMoreVersions}
            />
          ) : (
            <JobManagementPage />
          )}
        </main>
      </div>
    </div>
  );
};
