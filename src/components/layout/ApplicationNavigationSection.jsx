/**
 * [레거시 컴포넌트]
 * 이 컴포넌트는 현재 사용되지 않습니다. (App.jsx에서 사이드바 대신 헤더 기반의 모드 스위처를 사용 중입니다.)
 * 레거시 참조용으로 남겨두었습니다.
 */

// UI 아이콘들을 불러옵니다.
import { 
  RocketIcon, 
  SettingsIcon,
  CodeIcon
} from "../../components/ui/Icons";
// React 훅을 불러옵니다.
import { useEffect, useState } from "react";
// API 상태 체크 함수들을 불러옵니다.
import { registryHealth, onedriveHealth } from "../../services/api";

// 사이드바 네비게이션 항목들을 정의합니다.
const navigationItems = [
  {
    id: "deployer",
    label: "배포자",
    icon: RocketIcon,
    iconClassName: "w-5 h-5",
  },
  {
    id: "developer",
    label: "개발자",
    icon: CodeIcon,
    iconClassName: "w-5 h-5",
  },
];

/**
 * 앱의 좌측 사이드바 네비게이션 역할을 하던 레거시 컴포넌트입니다.
 */
export const ApplicationNavigationSection = ({ activeNavigation, setActiveNavigation }) => {
  // NCR 레지스트리와 원드라이브의 상태를 관리합니다.
  const [registryStatus, setRegistryStatus] = useState("error");
  const [onedriveStatus, setOnedriveStatus] = useState("error");

  /**
   * API 응답 데이터를 바탕으로 상태 문자열("ready", "pending", "error")을 반환합니다.
   */
  const mapHealth = (payload) => {
    if (!payload) return "error";
    if (typeof payload.healthy === "boolean") {
      return payload.healthy ? "ready" : "pending";
    }
    return "error";
  };

  /**
   * 상태 문자열에 따라 UI에 표시할 색상 클래스를 반환합니다.
   */
  const statusColor = (s) => {
    switch (s) {
      case "ready":
        return "bg-green-400";
      case "pending":
        return "bg-yellow-400";
      case "error":
      default:
        return "bg-red-500";
    }
  };

  // 컴포넌트 마운트 시 주기적으로 상태 체크 API를 호출합니다.
  // 주의: 현재 App.jsx에서도 중복으로 상태 체크를 수행하고 있습니다.
  useEffect(() => {
    let mounted = true;
    
    // 비동기로 상태를 확인하는 내부 함수입니다.
    const check = async () => {
      try {
        const r = await registryHealth();
        if (!mounted) return;
        setRegistryStatus(mapHealth(r));
      } catch (e) {
        if (mounted) setRegistryStatus("error");
      }

      try {
        const s = await onedriveHealth();
        if (!mounted) return;
        setOnedriveStatus(mapHealth(s));
      } catch (e) {
        if (mounted) setOnedriveStatus("error");
      }
    };

    // 초기 상태 체크 수행
    check();
    // 30초마다 주기적으로 상태 체크를 수행합니다.
    const id = setInterval(check, 30000);
    
    // 언마운트 시 인터벌을 정리하고 마운트 플래그를 해제합니다.
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    // 사이드바 레이아웃 컨테이너
    <aside
      className="hidden lg:flex flex-col w-64 shrink-0 items-start justify-between px-0 py-6 bg-[#1a237e] z-50 shadow-xl"
      aria-label="Deploy Hub navigation"
    >
      {/* 상단 로고 및 타이틀 영역 */}
      <header className="flex pt-0 pb-8 px-0 self-stretch w-full flex-col items-start relative flex-[0_0_auto]">
        <div className="flex items-center px-6 py-0 relative self-stretch w-full flex-[0_0_auto]">
          <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
            <RocketIcon className="w-8 h-8 text-white" />
          </div>
          <div className="inline-flex pl-3 pr-0 py-0 flex-col items-start relative flex-[0_0_auto]">
            <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
              <div className="flex flex-col items-start relative self-stretch w-full">
                <div className="font-bold text-white text-xl tracking-tight leading-6 relative flex items-center w-fit whitespace-nowrap">
                  Deploy Hub
                </div>
              </div>
              <div className="flex flex-col items-start relative self-stretch w-full">
                <div className="font-normal text-[#ffffffb2] text-sm leading-4 relative flex items-center w-fit whitespace-nowrap">
                  Automated Deployment
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* 네비게이션 메뉴 영역 */}
      <nav
        className="flex flex-col items-start gap-2 pt-1 px-4 relative flex-1 self-stretch w-full grow"
        aria-label="Primary navigation"
      >
        {navigationItems.map((item) => {
          const isActive = activeNavigation === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNavigation(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center px-4 py-3 relative self-stretch w-full rounded-lg border-0 text-left appearance-none cursor-pointer transition-all ${
                isActive ? "bg-[#ffffff1a] text-white" : "text-[#ffffffb2] hover:bg-[#ffffff0d] hover:text-white"
              }`}
            >
              <span className="inline-flex pr-3">
                <Icon className={`${item.iconClassName} ${isActive ? "text-[#8690ee]" : "text-current"}`} />
              </span>
              <span className="inline-flex">
                <span
                  className={`font-semibold text-base tracking-wide leading-5 relative flex items-center w-fit whitespace-nowrap`}
                >
                  {item.label}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
      
      {/* 하단 연결 상태 표시 영역 */}
      <footer className="flex flex-col items-start gap-3 px-6 py-4 relative self-stretch w-full flex-[0_0_auto]">
        <div className="text-xs font-semibold text-[#ffffff66] uppercase tracking-widest">연결 상태</div>
        <div className="flex flex-col gap-2 w-full">
          {/* NCR 상태 */}
          <div className="flex items-center gap-2" title={registryStatus === "ready" ? "NCR 연결 준비됨" : registryStatus === "pending" ? "NCR 연결 대기" : "NCR 연결 불가(권한/오류)"}>
            <div className={`${statusColor(registryStatus)} w-2 h-2 rounded-full`} />
            <div className="font-normal text-[#ffffffb2] text-sm leading-4">NCR</div>
          </div>
          {/* OneDrive 상태 */}
          <div className="flex items-center gap-2" title={onedriveStatus === "ready" ? "OneDrive 연결 준비됨" : onedriveStatus === "pending" ? "OneDrive 연결 대기" : "OneDrive 연결 불가(권한/오류)"}>
            <div className={`${statusColor(onedriveStatus)} w-2 h-2 rounded-full`} />
            <div className="font-normal text-[#ffffffb2] text-sm leading-4">OneDrive</div>
          </div>
        </div>
      </footer>
    </aside>
  );
};
