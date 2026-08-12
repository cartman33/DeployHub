import { ApplicationNavigationSection } from "./ApplicationNavigationSection";
import { DeploymentPipelineDashboardSection } from "./DeploymentPipelineDashboardSection";
import icon10 from "./src/assets/icons/icon-10.svg";

export const HtmlBody = () => {
  return (
    <div className="relative flex min-h-screen items-start bg-[linear-gradient(0deg,rgba(248,250,252,1)_0%,rgba(248,250,252,1)_100%),linear-gradient(0deg,rgba(255,255,255,1)_0%,rgba(255,255,255,1)_100%)] py-0 pl-60 pr-0">
      <main aria-label="대시보드" className="contents">
        <DeploymentPipelineDashboardSection />
      </main>
      <header className="absolute left-60 top-0 flex h-16 w-[1040px] items-center justify-between border-b border-[#e0e4ec] bg-slate-50 px-6 py-0">
        <h1 className="relative mt-[-1.00px] flex w-fit items-center whitespace-nowrap [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-lg font-medium leading-6 tracking-[0] text-[#000666]">
          대시보드
        </h1>
        <div className="inline-flex items-center">
          <button
            type="button"
            aria-label="알림"
            className="inline-flex flex-none items-center justify-center rounded-xl p-2"
          >
            <img
              className="h-[16.67px] w-[13.33px]"
              alt=""
              aria-hidden="true"
              src={icon10}
            />
          </button>
          <div className="h-4 w-8" aria-hidden="true" />
        </div>
      </header>
      <ApplicationNavigationSection />
    </div>
  );
};
