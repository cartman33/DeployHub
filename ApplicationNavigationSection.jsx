import { useState } from "react";
import icon11 from "./icon-11.svg";
import icon12 from "./icon-12.svg";
import icon13 from "./icon-13.svg";
import icon14 from "./icon-14.svg";

const navigationItems = [
  {
    id: "dashboard",
    label: "대시보드",
    icon: icon12,
    iconClassName: "w-[18px] h-[18px]",
  },
  {
    id: "settings",
    label: "설정",
    icon: icon13,
    iconClassName: "w-[20.1px] h-5",
  },
];

export const ApplicationNavigationSection = () => {
  const [activeNavigation, setActiveNavigation] = useState("dashboard");

  return (
    <aside
      className="flex flex-col w-60 h-[1024px] items-start justify-between px-0 py-6 absolute top-0 left-0 bg-[#1a237e]"
      aria-label="Deploy Hub navigation"
    >
      <header className="flex pt-0 pb-8 px-0 self-stretch w-full flex-col items-start relative flex-[0_0_auto]">
        <div className="flex items-center px-6 py-0 relative self-stretch w-full flex-[0_0_auto]">
          <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
            <img
              className="relative w-[24.71px] h-[24.71px]"
              alt=""
              aria-hidden="true"
              src={icon11}
            />
          </div>
          <div className="inline-flex pl-3 pr-0 py-0 flex-col items-start relative flex-[0_0_auto]">
            <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
              <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
                <div className="mt-[-1.00px] [font-family:'Inter-Bold',Helvetica] font-bold text-white text-lg tracking-[-0.45px] leading-6 relative flex items-center w-fit whitespace-nowrap">
                  Deploy Hub
                </div>
              </div>
              <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
                <div className="mt-[-1.00px] [font-family:'Inter-Regular',Helvetica] font-normal text-[#ffffffb2] text-xs tracking-[0] leading-4 relative flex items-center w-fit whitespace-nowrap">
                  Automated Deployment
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <nav
        className="flex flex-col items-start gap-1 pt-1 pb-[740px] px-4 relative flex-1 self-stretch w-full grow"
        aria-label="Primary navigation"
      >
        {navigationItems.map((item) => {
          const isActive = activeNavigation === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNavigation(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center px-4 py-3 relative self-stretch w-full flex-[0_0_auto] rounded border-0 text-left appearance-none cursor-pointer ${
                isActive ? "bg-[#1a237e] opacity-90" : "bg-transparent"
              }`}
            >
              <span className="inline-flex pl-0 pr-3 py-0 flex-col items-start relative flex-[0_0_auto]">
                <img
                  className={`relative ${item.iconClassName}`}
                  alt=""
                  aria-hidden="true"
                  src={item.icon}
                />
              </span>
              <span className="inline-flex flex-col items-start relative flex-[0_0_auto]">
                <span
                  className={`mt-[-1.00px] [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] font-medium text-[11px] tracking-[0.55px] leading-4 relative flex items-center w-fit whitespace-nowrap ${
                    isActive ? "text-[#8690ee]" : "text-[#343d96]"
                  }`}
                >
                  {item.label}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
      <footer className="flex flex-col items-start px-6 py-4 relative self-stretch w-full flex-[0_0_auto]">
        <div className="flex items-center relative self-stretch w-full flex-[0_0_auto]">
          <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
            <img
              className="relative w-[15px] h-[15px]"
              alt=""
              aria-hidden="true"
              src={icon14}
            />
          </div>
          <div className="inline-flex pl-3 pr-0 py-0 flex-col items-start relative flex-[0_0_auto]">
            <div className="mt-[-1.00px] [font-family:'Inter-Regular',Helvetica] font-normal text-[#ffffffb2] text-xs tracking-[0] leading-4 relative flex items-center w-fit whitespace-nowrap">
              v 2.4.1
            </div>
          </div>
        </div>
      </footer>
    </aside>
  );
};
