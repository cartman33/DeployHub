import { 
  RocketIcon, 
  SettingsIcon,
  CodeIcon
} from "../../components/ui/Icons";
import { useEffect, useState } from "react";
import { registryHealth, sharepointHealth } from "../../services/api";

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

export const ApplicationNavigationSection = ({ activeNavigation, setActiveNavigation }) => {
  const [registryStatus, setRegistryStatus] = useState("error");
  const [sharepointStatus, setSharepointStatus] = useState("error");

  const mapHealth = (payload) => {
    if (!payload) return "error";
    if (typeof payload.healthy === "boolean") {
      return payload.healthy ? "ready" : "pending";
    }
    return "error";
  };

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

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const r = await registryHealth();
        if (!mounted) return;
        setRegistryStatus(mapHealth(r));
      } catch (e) {
        if (mounted) setRegistryStatus("error");
      }

      try {
        const s = await sharepointHealth();
        if (!mounted) return;
        setSharepointStatus(mapHealth(s));
      } catch (e) {
        if (mounted) setSharepointStatus("error");
      }
    };

    check();
    const id = setInterval(check, 30000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <aside
      className="hidden lg:flex flex-col w-64 shrink-0 items-start justify-between px-0 py-6 bg-[#1a237e] z-50 shadow-xl"
      aria-label="Deploy Hub navigation"
    >
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
      <footer className="flex flex-col items-start gap-3 px-6 py-4 relative self-stretch w-full flex-[0_0_auto]">
        <div className="text-xs font-semibold text-[#ffffff66] uppercase tracking-widest">연결 상태</div>
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2" title={registryStatus === "ready" ? "NCR 연결 준비됨" : registryStatus === "pending" ? "NCR 연결 대기" : "NCR 연결 불가(권한/오류)"}>
            <div className={`${statusColor(registryStatus)} w-2 h-2 rounded-full`} />
            <div className="font-normal text-[#ffffffb2] text-sm leading-4">NCR</div>
          </div>
          <div className="flex items-center gap-2" title={sharepointStatus === "ready" ? "SharePoint 연결 준비됨" : sharepointStatus === "pending" ? "SharePoint 연결 대기" : "SharePoint 연결 불가(권한/오류)"}>
            <div className={`${statusColor(sharepointStatus)} w-2 h-2 rounded-full`} />
            <div className="font-normal text-[#ffffffb2] text-sm leading-4">SharePoint</div>
          </div>
        </div>
      </footer>
    </aside>
  );
};
