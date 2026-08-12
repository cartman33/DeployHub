// React의 핵심 훅(Hook)들을 불러옵니다.
// useState: 변하는 데이터(상태)를 관리하기 위함
// useEffect: 컴포넌트가 화면에 나타날 때(mount) 특정 동작(API 호출 등)을 수행하기 위함
import { useState, useEffect } from "react";
import { 
  RocketIcon, 
  DashboardIcon, 
  SettingsIcon,
  CodeIcon,
  BellIcon
} from "../components/ui/Icons";
import { DeploymentPipelineDashboardSection } from "../features/deployer/DeploymentPipelineDashboardSection";
import { DeveloperVersionRegistrationSection } from "../features/developer/DeveloperVersionRegistrationSection";
import { listMainVersions, registryHealth, sharepointHealth } from "../services/api";

const defaultVersions = [];

export const HtmlBody = () => {
  const [activeNavigation, setActiveNavigation] = useState("deployer");
  const [versions, setVersions] = useState(defaultVersions);
  const [selectedVersionName, setSelectedVersionName] = useState("");
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [versionError, setVersionError] = useState("");

  // 버전 목록을 백엔드에서 불러오는 비동기(async) 함수입니다.
  const loadVersions = async (keyword = "") => {
    setLoadingVersions(true);
    setVersionError("");

    try {
      const searchStr = typeof keyword === 'string' ? keyword : "";
      const response = await listMainVersions(searchStr, 0, 50);
      const items = response?.items || [];
      setVersions(items);
      if (!selectedVersionName && items.length > 0) {
        setSelectedVersionName(items[0].versionName);
      }
    } catch (error) {
      setVersionError(error.payload?.message || error.message || "메인버전 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoadingVersions(false);
    }
  };

  const [ncrStatus, setNcrStatus] = useState("checking");
  const [spStatus, setSpStatus] = useState("checking");

  useEffect(() => {
    //메모리 누수(Mermory Leak) 방지를 위한 플래그 변수 
    let mounted = true;

    if (mounted) {
      loadVersions();
      
      registryHealth()
        .then(() => mounted && setNcrStatus("connected"))
        .catch(() => mounted && setNcrStatus("disconnected"));
        
      sharepointHealth()
        .then(() => mounted && setSpStatus("connected"))
        .catch(() => mounted && setSpStatus("disconnected"));
    }

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans">
      {/* Main Content Area - Responsive Flex-Grow */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Full Width relative to content area */}
        <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#e0e4ec] bg-white px-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {activeNavigation === "deployer" ? (
                <RocketIcon className="w-6 h-6 text-[#000666]" />
              ) : (
                <CodeIcon className="w-5 h-5 text-[#000666]" />
              )}
              <h1 className="text-xl font-bold tracking-tight text-[#000666]">
                Deploy Hub
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Mode Switcher */}
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
            </div>

            <div className="h-6 w-px bg-slate-300"></div>

            {/* Connection Status Badges - Made smaller as requested */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                ncrStatus === "connected" ? "bg-green-50 border-green-200" :
                ncrStatus === "checking" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  ncrStatus === "connected" ? "bg-green-500" :
                  ncrStatus === "checking" ? "bg-amber-500 animate-pulse" : "bg-red-500"
                }`}></div>
                <span className={`text-[11px] font-bold tracking-wide ${
                  ncrStatus === "connected" ? "text-green-700" :
                  ncrStatus === "checking" ? "text-amber-700" : "text-red-700"
                }`}>NCR {ncrStatus === "connected" ? "연결됨" : ncrStatus === "checking" ? "확인 중" : "연결 안됨"}</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                spStatus === "connected" ? "bg-green-50 border-green-200" :
                spStatus === "checking" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  spStatus === "connected" ? "bg-green-500" :
                  spStatus === "checking" ? "bg-amber-500 animate-pulse" : "bg-red-500"
                }`}></div>
                <span className={`text-[11px] font-bold tracking-wide ${
                  spStatus === "connected" ? "text-green-700" :
                  spStatus === "checking" ? "text-amber-700" : "text-red-700"
                }`}>SHAREPOINT {spStatus === "connected" ? "연결됨" : spStatus === "checking" ? "확인 중" : "연결 안됨"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content Area - Responsive Width */}
        <main className="flex-1 flex flex-col relative">
          {versionError && (
            <div className="mx-8 my-4 shrink-0 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
              {versionError}
            </div>
          )}
          {activeNavigation === "deployer" ? (
            <DeploymentPipelineDashboardSection 
              versions={versions}
              selectedVersionName={selectedVersionName}
              setSelectedVersionName={setSelectedVersionName}
              reloadVersions={loadVersions}
            />
          ) : (
            <DeveloperVersionRegistrationSection 
              versions={versions}
              setVersions={setVersions}
              setSelectedVersionName={setSelectedVersionName}
              setActiveNavigation={setActiveNavigation}
            />
          )}
        </main>
      </div>
    </div>
  );
};
