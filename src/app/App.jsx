/*
용어 정리 
items : 버전 정보들의 묶음 ex) items[0] = {versionName: "v1.0.0", versionDescription: "첫번째 버전", ...}
append : 기존에 로딩된 버전 목록에 이어붙일지 여부, true면 이어붙임, false면 새로 로딩
page : 현재 페이지 번호, 0부터 시작
size : 한 페이지에 보여줄 버전 개수
totalCount : 서버에 존재하는 전체 버전 개수
hasMore : 서버에 더 많은 버전이 존재하는지 여부, true면 더 있음, false면 없음
*/

//컴포넌트 내부의 값(상태)를 기억하고 값이 바뀌면 화면을 다시 랜더링하는 useState와 초기에 NCR과 Onedrive 연결 상태를 확인하는 useEffect import
import { useState, useEffect } from "react";
//화면을 구성하는 배포자, 개발자, Job 관리 기능별 컴포넌트 import 
import { DeploymentPipelineDashboardSection } from "../features/deployer/DeploymentPipelineDashboardSection";
import { DeveloperVersionRegistrationSection } from "../features/developer/DeveloperVersionRegistrationSection";
import { JobManagementPage } from "../features/job/JobManagementPage";
//api.js에서 백엔드와 통신할 api 함수 import (메인버전 리스트와 NCR, Onedrive 연결 체크함수) 
import { listMainVersions, registryHealth, onedriveHealth } from "../services/api";

//버전 목록의 기본값을 빈 배열로 설정
const defaultVersions = [];

//한번에 가져올 버전의 개수를 20개로 설정
const VERSION_PAGE_SIZE = 20;

// 로컬 스토리지에 저장할 활성화된 네비게이션 키와 유효한 네비게이션 값들을 설정
const ACTIVE_NAVIGATION_STORAGE_KEY = "deployHub.activeNavigation";
const VALID_NAVIGATIONS = new Set(["deployer", "developer", "job_management"]);

//이전에 보던 페이지를 기억하기 위한 함수
const getInitialNavigation = () => {
  try {
    const savedNavigation = window.localStorage.getItem(ACTIVE_NAVIGATION_STORAGE_KEY);
    return VALID_NAVIGATIONS.has(savedNavigation) ? savedNavigation : "deployer";
  } catch { //없거나 오류가 생기면 배포자 페이지로 return 
    return "deployer";
  }
};

//HtmlBody 컴포넌트 선언 및 외부 파일에서 가져다 쓸 수 있게 export
export const HtmlBody = () => {
  //현재 사용자가 보고있는 페이지 기억, 
  const [activeNavigation, setActiveNavigation] = useState(getInitialNavigation);
  
  //서버에서 받아온 버전 목록 데이터, 초기값은 defaultVersions로 설정
  const [versions, setVersions] = useState(defaultVersions);
  
  //사용자가 목록 중에서 특정 버전 선택시 버전의 이름을 문자열로 저장, 처음엔 빈 문자열
  const [selectedVersionName, setSelectedVersionName] = useState("");
  
  //서버에서 버전 목록을 가져오는 중인지 여부를 확인하는 상태, 초기값은 로딩중 (true)
  const [loadingVersions, setLoadingVersions] = useState(true);
  
  //현재 페이지 번호 저장 0부터 시작 
  const [page, setPage] = useState(0);

  //서버에서 더 많은 버전이 있는지 여부를 확인하는 상태, 초기값은 false 
  const [hasMore, setHasMore] = useState(false); 

  //현재 검색 키워드 저장, 초기값은 빈 문자열
  const [currentKeyword, setCurrentKeyword] = useState(""); 

  //서버에서 가져온 전체 버전 개수를 저장하는 상태, 초기값은 0
  const [totalVersionCount, setTotalVersionCount] = useState(0); 
  
  //서버에서 더 많은 버전을 가져오는 중인지 여부를 확인하는 상태, 초기값은 false
  const [loadingMoreVersions, setLoadingMoreVersions] = useState(false);
  

  //버전 데이터를 불러오거나 처리할때 에러 발생시 에러 메세지 저장, 없으면 빈 문자열 저장
  const [versionError, setVersionError] = useState("");

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleNavigation = (destination) => {
    if (activeNavigation === destination) return;
    if (hasUnsavedChanges) {
      if (!window.confirm("저장하지 않은 변경사항이 있습니다. 정말로 다른 페이지로 이동하시겠습니까?\n이동하면 변경사항이 저장되지 않고 사라집니다.")) {
        return;
      }
    }
    setHasUnsavedChanges(false);
    setActiveNavigation(destination);
  };

//useEffect 컴포넌트가 처음 화면에 나타나거나 배열 안의 상태(activeNavigation)의 변할때마다 실행 
  useEffect(() => {
    try {
      //현재 보고 있는 페이지나 페이지 위치를 로컬 스토리지에 저장
      window.localStorage.setItem(ACTIVE_NAVIGATION_STORAGE_KEY, activeNavigation);
    } catch {
      //시크릿모드 등 브라우저 설정에 따라 로컬 스토리지 접근이 제한될 경우 에러 발생을 막기 위해 catch문을 비워 에러 패스
    }
  }, [activeNavigation]); //activeNavigation 상태가 변할때마다 실행

  //서버에서 버전을 로딩하기 위한 async 비동기 함수 기본값은 keyword(검색어)는 빈 문자열, requestedPage(요청할 페이지)는 0번, append(기존 목록에 이어붙일지 여부)는 false
  const loadVersions = async (keyword = "", requestedPage = 0, append = false) => {
    //append가 true이면 기존목록에 이어붙일 수 있음 -> 무한 스크롤 가능 
    if (append) setLoadingMoreVersions(true);
    //false면 처음 검색이나 페이지를 새로 열기 때문에 전체 로딩 상태를 true로 설정
    else setLoadingVersions(true);
    //데이터 새로 불러오기 전 이전 요청에서 발생한 에러메시지 빈 문자열로 초기화
    setVersionError("");

    try {

      //keyword가 string 문자열이 맞는지 확인 
      const searchStr = typeof keyword === "string" ? keyword : "";

      //실제 서버에 데이터를 요청하는 listMainversions를 await 함수로 호출하여 response에 저장, 요청할 페이지와 한 페이지에 가져올 버전 개수도 함께 전달
      //await 함수를 사용한 이유 : 실제 데이터 값을 받은 뒤에 다음 코드 실행을 위함 
      const response = await listMainVersions(searchStr, requestedPage, VERSION_PAGE_SIZE);

      //items에 배열이 있다면 가져오고 없거나 에러 발생시 빈 배열로 처리 
      // ?. 는 옵셔널 체이닝으로 null, undefined가 될 경우에 에러 대신 undefined 으로 처리 
      const items = response?.items || [];
      
      //페이지 번호와 페이지 개수, 데이터의 총 개수가 정상적인 숫자인지 확인 및 비정상일시 페이지 번호는 요청한 페이지로, 페이지 개수는 위에서 정한 상수 20개로, 데이터의 총 개수는 방금 받은 개수로 사용
      const responsePage = Number.isFinite(Number(response?.page)) ? Number(response.page) : requestedPage;
      const responseSize = Number.isFinite(Number(response?.size)) ? Number(response.size) : VERSION_PAGE_SIZE;
      const totalCount = Number.isFinite(Number(response?.totalCount)) ? Number(response.totalCount) : items.length;

      //버전을 저장하는 상태를 변경하는 함수 setVersions, 이전버전 previousVersions를 받아 최신 상태로 유지
      setVersions((previousVersions) => {
        //이어붙이기가 아닐 경우 (최초 로딩, 다른 버전 검색시) items를 반환해 새 데이터 보여주기 
        if (!append) return items;

        //이전 버전 previousVersions들을 map(순회)하면서 versionName을 Set 집합으로 저장해 중복된 버전이 이어붙여지지 않도록 처리
        //Set을 쓴 이유 : 중복된 값을 허용하지않고 특정 값이 존재하는지 빠르게 찾아볼 수 있기 때문에
        //이어붙일 items 중에서 이전에 로딩된 버전이 아닌 것만 필터링하여 새로운 배열 newItems 생성
        const loadedVersionNames = new Set(previousVersions.map((version) => version.versionName));
        const newItems = items.filter((version) => !loadedVersionNames.has(version.versionName));
        // ... 전개 연산자로 previousVersions와 newItems 배열들을 합친 새로운 배열을 return 
        //새로운 배열로 계속 만드는 이유 : 1. 배포자페이지에서 버전들을 비교하기 위해 무한 스크롤 기능을 넣었기 때문에 2. 리액트에선 기존 배열에 추가한다고 화면이 새로고침되지 않아서 
        return [...previousVersions, ...newItems];
      });
      
      //서버로 성공적으로 받아온 페이지 번호 저장 
      setPage(responsePage);
      //서버로 성공적으로 받아온 검색어 저장 
      setCurrentKeyword(searchStr);
      //서버에 존재하는 전체 데이터 개수 저장 
      setTotalVersionCount(totalCount);
      //더 불러올 페이지가 있는지 계산해서 현재 페이지 + 1이 전체 페이지보다 작으면 다음 페이지가 존재함을 확인 ex) 현 2페이지, 총 페이지 3페이지 2 + 1 < 3 만족을 안함으로 
      setHasMore((responsePage + 1) * responseSize < totalCount);
    } catch (error) { // 오류 발생시 아래와 같은 에러 메시지 출력
      setVersionError(error.payload?.message || error.message || "메인버전 목록을 불러오는 중 오류가 발생했습니다.");
    } finally { //append(이어붙일지)의 유무에 따라 로딩화면 종료 
      if (append) setLoadingMoreVersions(false);
      else setLoadingVersions(false);
    }
  };

  //배포자페이지에서 버전을 선택하세요. 클릭 후 버전목록이 끝까지 스크롤되면 loadMoreVersions 함수가 실행되어 다음 페이지의 버전들을 불러오게함
  const loadMoreVersions = () => {
    if (!hasMore || loadingMoreVersions) return;
    //이어붙이기 위해 함수 재호출 및 true상태로 변경
    loadVersions(currentKeyword, page + 1, true);
  };


  //검색어 입력 및 일치 확인 코드 

  //searchVersionOptions 함수는 사용자가 입력한 검색어(keyword)를 받아서 서버에서 해당 검색어와 일치하는 버전들을 찾아 반환하는 비동기 함수(응답이 올때까지 기다림)
  const searchVersionOptions = async (keyword) => {

    //trim으로 keyword의 앞뒤 공백 제거 후에 searchStr에 저장 
    const searchStr = typeof keyword === "string" ? keyword.trim() : "";

    //검색어 없으면 그냥 versions return 
    if (!searchStr) return versions; 

    //검색 결과를 저장할 results, 중복을 거르기위한 Set 집합의 loadedNames, 요청 페이지는 0으로 초기화 및 다음에 올 페이지는 true로 변경 
    const results = [];
    const loadedNames = new Set();
    let requestedPage = 0;
    let hasNextPage = true;

    //while문을 사용해 hasNextPage가 true일때까지 반복 
    while (hasNextPage) {
      //await 비동기 함수를 이용해 값을 받을때까지 계속 반복 
      const response = await listMainVersions(searchStr, requestedPage, VERSION_PAGE_SIZE);

      //items에 배열이 있다면 가져오고 없거나 에러 발생시 빈 배열로 처리 
      // ?. 는 옵셔널 체이닝으로 null, undefined가 될 경우에 에러 대신 undefined 으로 처리
      const items = response?.items || [];

      //정상적인 숫자인지 확인 
      const responsePage = Number.isFinite(Number(response?.page)) ? Number(response.page) : requestedPage;
      const responseSize = Number.isFinite(Number(response?.size)) ? Number(response.size) : VERSION_PAGE_SIZE;
      const totalCount = Number.isFinite(Number(response?.totalCount)) ? Number(response.totalCount) : items.length;

      //items를 하나씩 꺼내서 중복을 거르는 loadedNames에 없다면 results에 push 
      items.forEach((version) => {
        if (!loadedNames.has(version.versionName)) {
          loadedNames.add(version.versionName);
          results.push(version);
        }
      });

      //지금까지 본 개수가 totalCount보다 작다면 다음 페이지가 존재함을 확인하고 requestedPage를 증가시켜 다음 페이지를 요청
      hasNextPage = items.length > 0 && (responsePage + 1) * responseSize < totalCount;
      requestedPage = responsePage + 1;
    }

    //while문이 끝나면 results(중복없는 결과물)를 반환 
    return results;
  };

  //찾는 버전이나, 이미 버전이 있거나, 더 보여줄 다음 페이지가 없다면 종료하게하는 ensureVersionLoaded 함수 
  const ensureVersionLoaded = async (versionName) => {
    if (!versionName || versions.some((version) => version.versionName === versionName) || !hasMore) {
      return versions; 
    }

    //원하는 버전이 나올때까지 다음 페이지를 탐색하는 setLoadingMoreVersions 함수 
    setLoadingMoreVersions(true);
    try {
      //while 반복문을 돌면서 값이 계속 바뀌어야 되기 때문에(값 갱신) let 사용 
      let mergedVersions = [...versions]; //현재 화면에 있던 데이터 복사 
      let nextPage = page + 1; // 페이지 증가 
      let lastLoadedPage = page; //방금 로딩된 페이지 번호 = 계속 갱신됨
      let lastPageSize = VERSION_PAGE_SIZE; //버전 개수 = 계속 갱신됨
      let serverTotalCount = totalVersionCount; //서버에 존재하는 전체 버전 개수 = 계속 갱신됨
      let targetFound = false; //찾는 버전이 있는지? 

      //찾는 버전이 없거나, 서버에 로딩할 페이지가 더 있다면 반복 
      while (!targetFound && (lastLoadedPage + 1) * lastPageSize < serverTotalCount) {
        //await 비동기 함수로 실제 값을 받아야 종료하게끔 함, 
        const response = await listMainVersions("", nextPage, VERSION_PAGE_SIZE); 

        //items에 배열이 있다면 가져오고 없거나 에러 발생시 빈 배열로 처리 
        // ?. 는 옵셔널 체이닝으로 null, undefined가 될 경우에 에러 대신 undefined 으로 처리
        const items = response?.items || [];

        //정상적인 숫자인지 확인
        const responsePage = Number.isFinite(Number(response?.page)) ? Number(response.page) : nextPage;
        const responseSize = Number.isFinite(Number(response?.size)) ? Number(response.size) : VERSION_PAGE_SIZE;
        serverTotalCount = Number.isFinite(Number(response?.totalCount)) ? Number(response.totalCount) : serverTotalCount;

        //이전 버전 previousVersions들을 map(순회)하면서 versionName을 Set 집합으로 저장해 중복된 버전이 이어붙여지지 않도록 처리
        //Set을 쓴 이유 : 중복된 값을 허용하지않고 특정 값이 존재하는지 빠르게 찾아볼 수 있기 때문에
        const loadedNames = new Set(mergedVersions.map((version) => version.versionName));
        mergedVersions = [
          ...mergedVersions,
          ...items.filter((version) => !loadedNames.has(version.versionName)),
        ];
        //some을 통해 단 하나라도 존재하는지 검사, 찾는다면 targetFound가 True가 되어서 while 탈출 
        targetFound = mergedVersions.some((version) => version.versionName === versionName);
        //마지막로딩페이지 저장 
        lastLoadedPage = responsePage;
        //마지막페이지크기 저장 
        lastPageSize = responseSize;
        nextPage = responsePage + 1;

        //빈 배열이면 탈출 
        if (items.length === 0) break; 
      }

      // 데이터 업데이트, 값 갱신 및 검색어 초기화 
      setVersions(mergedVersions);
      setPage(lastLoadedPage);
      setCurrentKeyword("");
      setTotalVersionCount(serverTotalCount);
      // 전체 데이터 개수가 현재 로딩된 데이터보다 적다면 계속 업데이트 
      setHasMore((lastLoadedPage + 1) * lastPageSize < serverTotalCount);
      //업데이트 배열 반환 
      return mergedVersions;
    } finally {
      setLoadingMoreVersions(false);
    }
  };

  //외부 api인 NCR과 Onedrive 연결상태 확인 코드 

  //연결 상태 State 기록 
  const [ncrStatus, setNcrStatus] = useState("checking");
  const [odStatus, setOdStatus] = useState("checking");

  //처음 화면이 나타날때 useEffect으로 한번 실행 
  useEffect(() => {
    let mounted = true; //나중에 false 상태 변화로 let으로 선언

    loadVersions('', 0, false); //메인버전은 빈 채로 기존 목록에 덮어씌움
    
    //NCR과 onedrive에 연결상태 확인 후 연결되면 connected, 연결 안되면 disconnected로 상태 변경
    //then은 성공시 처리, catch는 실패시 처리하는 비동기 함수이고, 헬스체크 같은 백그라운드 작업이라 사용 
    registryHealth()
      .then(() => mounted && setNcrStatus("connected")) 
      .catch(() => mounted && setNcrStatus("disconnected"));
      
    onedriveHealth()
      .then(() => mounted && setOdStatus("connected"))
      .catch(() => mounted && setOdStatus("disconnected"));

    //화면 전환시나 종료시 UseEffect 종료
    return () => {
      mounted = false; 
    };
  }, []);

  //화면 UI 배치 코드 
  return (
    <div className="flex min-h-screen bg-[#eef2f7] font-sans">
      <div className="flex-1 flex flex-col min-w-0">
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
            <div className="flex items-center gap-3">
              <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 shadow-inner">
                <button
                  onClick={() => handleNavigation("deployer")}
                  className={`px-4 py-1.5 text-sm font-extrabold rounded-md transition-all ${
                    activeNavigation === "deployer" ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  배포자 모드
                </button>
                <button
                  onClick={() => handleNavigation("job_management")}
                  className={`px-4 py-1.5 text-sm font-extrabold rounded-md transition-all ${
                    activeNavigation === "job_management" ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  JOB 관리
                </button>
              </div>
              <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 shadow-inner">
                <button
                  onClick={() => handleNavigation("developer")}
                  className={`px-4 py-1.5 text-sm font-extrabold rounded-md transition-all ${
                    activeNavigation === "developer" ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  개발자 모드
                </button>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-300"></div>

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
        <main className="flex-1 flex flex-col relative">
          {versionError && (
            <div className="mx-8 my-4 shrink-0 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
              {versionError}
            </div>
          )}
          
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
              setHasUnsavedChanges={setHasUnsavedChanges}
            />
          ) : (
            <JobManagementPage />
          )}
        </main>
      </div>
    </div>
  );
};
