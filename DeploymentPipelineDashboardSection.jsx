import { useState } from "react";
import icon from "./icon.svg";
import icon2 from "./icon-2.svg";
import icon3 from "./icon-3.svg";
import icon4 from "./icon-4.svg";
import icon5 from "./icon-5.svg";
import icon6 from "./icon-6.svg";
import icon7 from "./icon-7.svg";
import icon8 from "./icon-8.svg";
import icon9 from "./icon-9.svg";
import icon15 from "./icon-15.svg";
import icon16 from "./icon-16.svg";
import image from "./image.svg";
import vector from "./vector.svg";

const manifestRows = [
  {
    subVersion: "cc",
    component: "sb-cc-api",
    tag: "v2.0.24.8507",
    status: "신규",
    statusClass: "bg-[#0006661a] text-[#000666]",
  },
  {
    subVersion: "pips",
    component: "pips",
    tag: "1.0.15.0200",
    status: "신규",
    statusClass: "bg-[#0006661a] text-[#000666]",
  },
  {
    subVersion: "cids",
    component: "cids",
    tag: "v2.0.4.0101",
    status: "변경",
    statusClass: "bg-[#ffdbd0] text-[#7b2e12]",
    highlighted: true,
  },
];

const logEntries = [
  {
    time: "10:42:01",
    level: "[INFO]",
    levelClass: "text-blue-400",
    message: "Initializing deployment sequence...",
  },
  {
    time: "10:42:05",
    level: "[INFO]",
    levelClass: "text-blue-400",
    message: "Pulling Docker Image for sb-cc-api...",
  },
  {
    time: "10:42:12",
    level: "[SUCCESS]",
    levelClass: "text-[#4caf50]",
    message: "Downloaded sb-cc-api v2.0.24.8507",
  },
  {
    time: "10:42:15",
    level: "[INFO]",
    levelClass: "text-blue-400",
    message: "Connecting to SharePoint endpoint...",
  },
  {
    time: "10:42:18",
    level: "[INFO]",
    levelClass: "text-blue-400",
    message: "Uploading artifact 1 of 4 (25%)...",
  },
];

export const DeploymentPipelineDashboardSection = () => {
  const [version, setVersion] = useState("2026.07.27-1");
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [packagingStarted, setPackagingStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleRefresh = () => {
    setLastRefreshed("방금 새로고침됨");
  };

  const handleStartPackaging = () => {
    setPackagingStarted(true);
  };

  const handleCopyAll = async () => {
    const urls = ["sb-cc-api_v2.0.24.8507.tar.gz", "cids_model.zip"].join("\n");

    try {
      await navigator.clipboard.writeText(urls);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = urls;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleRetry = () => {
    setRetrying(true);
    window.setTimeout(() => setRetrying(false), 1600);
  };

  return (
    <main className="relative flex w-[1040px] self-stretch flex-col items-start overflow-y-auto px-0 pb-0 pt-16">
      <section
        className="relative flex w-full max-w-[1920px] flex-col items-start gap-8 p-8"
        aria-labelledby="deployment-pipeline-heading"
      >
        <header className="relative flex w-full flex-col items-start gap-2">
          <h1
            id="deployment-pipeline-heading"
            className="relative mt-[-1px] flex items-center self-stretch [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-2xl font-medium leading-8 tracking-[0] text-[#000666]"
          >
            배포 파이프라인
          </h1>
          <p className="relative mt-[-1px] flex items-center self-stretch [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-sm font-medium leading-5 tracking-[0] text-slate-500">
            자동화된 빌드 및 패키징 프로세스를 관리합니다.
          </p>
        </header>
        <div className="grid h-fit w-full grid-cols-12 grid-rows-[744px] gap-8">
          <div className="relative col-[1_/_7] row-[1_/_2] flex h-fit w-full flex-col items-start">
            <section
              className="relative flex w-full flex-col items-start gap-4 self-stretch rounded-lg border border-solid border-[#e0e4ec] bg-white p-6 shadow-[0px_1px_2px_#0000000d]"
              aria-labelledby="version-heading"
            >
              <div className="relative flex w-full items-center self-stretch">
                <div className="relative inline-flex flex-none flex-col items-start py-0 pl-0 pr-2">
                  <img
                    className="relative h-[19.3px] w-[19.3px]"
                    alt=""
                    src={icon3}
                  />
                </div>
                <h2
                  id="version-heading"
                  className="relative mt-[-1px] flex w-fit items-center whitespace-nowrap [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-lg font-medium leading-6 tracking-[0] text-[#1b1b21]"
                >
                  메인버전 선택
                </h2>
              </div>
              <div className="relative flex w-full flex-col items-start gap-2 self-stretch">
                <label
                  htmlFor="release-version"
                  className="relative mt-[-1px] flex items-center self-stretch [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-[11px] font-medium leading-4 tracking-[0.55px] text-[#5b5f61]"
                >
                  릴리즈 버전
                </label>
                <div className="relative w-full">
                  <select
                    id="release-version"
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    className="relative flex h-[42px] w-full appearance-none items-center rounded border border-solid border-[#e0e4ec] bg-slate-50 py-2.5 pl-4 pr-10 [font-family:'Inter-Regular',Helvetica] text-sm font-normal leading-5 tracking-[0] text-[#1b1b21] outline-none focus:border-[#000666] focus:ring-1 focus:ring-[#000666]"
                  >
                    <option value="2026.07.27-1">2026.07.27-1</option>
                    <option value="2026.07.20-2">2026.07.20-2</option>
                    <option value="2026.07.13-1">2026.07.13-1</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 inline-flex h-[21px] w-[21px] -translate-y-1/2 items-center justify-center">
                    <img className="h-[60%] w-[70%]" alt="" src={vector} />
                  </span>
                  <img
                    className="pointer-events-none absolute right-[17px] top-[18px] h-[7.4px] w-3 opacity-0"
                    alt=""
                    src={icon15}
                  />
                </div>
              </div>
            </section>
            <div className="relative flex w-full flex-col items-start self-stretch px-0 pb-0 pt-6">
              <section
                className="relative flex w-full flex-col items-start gap-4 self-stretch rounded-lg border border-solid border-[#e0e4ec] bg-white px-6 pb-[174px] pt-6 shadow-[0px_1px_2px_#0000000d]"
                aria-labelledby="manifest-heading"
              >
                <div className="relative flex w-full items-center justify-between self-stretch">
                  <div className="relative inline-flex items-center">
                    <div className="relative inline-flex flex-none flex-col items-start py-0 pl-0 pr-2">
                      <img
                        className="relative h-[18px] w-[18px]"
                        alt=""
                        src={icon16}
                      />
                    </div>
                    <h2
                      id="manifest-heading"
                      className="relative mt-[-1px] flex w-fit items-center whitespace-nowrap [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-lg font-medium leading-6 tracking-[0] text-[#1b1b21]"
                    >
                      매니페스트 확인
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="inline-flex items-center justify-center rounded-sm border border-solid border-[#00066633] px-3 py-1 [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-[11px] font-medium leading-4 tracking-[0.55px] text-[#000666] transition-colors hover:bg-[#0006660d] focus:outline-none focus:ring-2 focus:ring-[#000666]"
                  >
                    새로고침
                  </button>
                </div>
                <div className="relative w-full overflow-x-auto self-stretch">
                  <table
                    className="w-full min-w-[422px] border-collapse text-left"
                    aria-label="매니페스트 구성 목록"
                  >
                    <thead className="border-b border-solid border-[#e0e4ec] bg-slate-50">
                      <tr>
                        {["서브버전", "컴포넌트", "태그/버전", "상태"].map(
                          (label, index) => (
                            <th
                              key={label}
                              className={`px-3 py-2 [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-[11px] font-medium leading-4 tracking-[0.55px] text-[#5b5f61] ${
                                index === 0
                                  ? "w-[86.06px]"
                                  : index === 1
                                    ? "w-[112.63px]"
                                    : index === 2
                                      ? "w-[145.94px]"
                                      : "w-[77.38px]"
                              }`}
                            >
                              {label}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {manifestRows.map((row) => (
                        <tr
                          key={row.subVersion}
                          className={`border-t border-solid border-[#e0e4ec] ${row.highlighted ? "bg-[#f5f2fb]" : "bg-white"}`}
                        >
                          <td className="w-[86.06px] px-3 pb-3.5 pt-[13px] [font-family:'Inter-Regular',Helvetica] text-xs font-normal leading-4 tracking-[0] text-[#1b1b21]">
                            {row.subVersion}
                          </td>
                          <td className="w-[112.63px] px-3 pb-[13px] pt-3 [font-family:'JetBrains_Mono-Medium',Helvetica] text-[13px] font-medium leading-[18px] tracking-[-0.26px] text-[#1b1b21]">
                            {row.component}
                          </td>
                          <td className="w-[145.94px] px-3 py-[12.5px]">
                            <span className="inline-flex rounded-sm bg-[#e4e1ea] px-2 py-px [font-family:'Inter-Bold',Helvetica] text-[11px] font-bold leading-4 tracking-[0.55px] text-[#454652]">
                              {row.tag}
                            </span>
                          </td>
                          <td className="w-[77.38px] px-3 py-[12.5px]">
                            <span
                              className={`inline-flex rounded-sm px-2 py-px [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-[11px] font-medium leading-4 tracking-[0.55px] ${row.statusClass}`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-solid border-[#e0e4ec] bg-gray-50">
                        <td colSpan={4} className="px-6 pb-3 pt-[12.5px]">
                          <ul className="flex flex-col gap-[3.5px]">
                            {[
                              "런타임 환경변수 모두 제거",
                              "모델 명 간소화 (ci_text_01)",
                              "폴더 명 변경 및 mv 필요",
                            ].map((note, index) => (
                              <li
                                key={note}
                                className={`[font-family:'${index === 1 ? "Inter-Regular" : "WenQuanYi_Zen_Hei-Medium"}',Helvetica] text-xs ${index === 1 ? "font-normal" : "font-medium"} leading-4 tracking-[0] text-[#454652]`}
                              >
                                {note}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {lastRefreshed && (
                  <p className="sr-only" role="status">
                    {lastRefreshed}
                  </p>
                )}
              </section>
            </div>
            <div className="relative flex w-full flex-col items-start self-stretch px-0 pb-0 pt-6">
              <button
                type="button"
                onClick={handleStartPackaging}
                className="relative flex w-full items-center justify-center rounded-lg bg-[#000666] px-0 py-4 shadow-[0px_2px_4px_-2px_#0000001a,0px_4px_6px_-1px_#0000001a] transition-colors hover:bg-[#090d82] focus:outline-none focus:ring-2 focus:ring-[#000666] focus:ring-offset-2"
              >
                <img className="relative h-5 w-5" alt="" src={icon} />
                <span className="relative ml-2 [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-lg font-medium leading-6 tracking-[0] text-white">
                  {packagingStarted ? "패키징 진행중" : "패키징 시작"}
                </span>
              </button>
            </div>
          </div>
          <div className="relative col-[7_/_13] row-[1_/_2] flex h-fit w-full flex-col items-start">
            <section
              className="relative flex w-full flex-col items-start gap-6 self-stretch rounded-lg border border-solid border-[#e0e4ec] bg-white p-6 shadow-[0px_1px_2px_#0000000d]"
              aria-labelledby="monitoring-heading"
            >
              <div className="relative flex w-full items-center self-stretch">
                <div className="relative inline-flex flex-none flex-col items-start py-0 pl-0 pr-2">
                  <img
                    className="relative h-[18px] w-[18px]"
                    alt=""
                    src={image}
                  />
                </div>
                <h2
                  id="monitoring-heading"
                  className="relative mt-[-1px] flex w-fit items-center whitespace-nowrap [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-lg font-medium leading-6 tracking-[0] text-[#1b1b21]"
                >
                  진행 상태 모니터링
                </h2>
              </div>
              <div className="relative flex w-full flex-col items-start gap-5 self-stretch">
                <div className="relative flex w-full flex-col items-start gap-2 self-stretch">
                  <div className="relative flex w-full items-center justify-between self-stretch">
                    <span className="[font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-xs font-medium leading-4 tracking-[0] text-[#1b1b21]">
                      다운로드
                    </span>
                    <span className="rounded-sm bg-[#4caf501a] px-2 py-0.5 [font-family:'Inter-Bold',Helvetica] text-[11px] font-bold leading-4 tracking-[0.55px] text-[#4caf50]">
                      100% (완료)
                    </span>
                  </div>
                  <div
                    className="h-2 w-full rounded-xl bg-[#4caf50]"
                    role="progressbar"
                    aria-label="다운로드 진행 상태"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={100}
                  />
                </div>
                <div className="relative flex w-full flex-col items-start gap-2 self-stretch">
                  <div className="relative flex w-full items-center justify-between self-stretch">
                    <span className="[font-family:'Inter-Medium',Helvetica] text-xs font-medium leading-4 tracking-[0] text-[#1b1b21]">
                      SharePoint 업로드
                    </span>
                    <span className="rounded-sm bg-[#0006661a] px-2 py-0.5 [font-family:'Inter-Bold',Helvetica] text-[11px] font-bold leading-4 tracking-[0.55px] text-[#000666]">
                      75% (진행중)
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-xl bg-[#e4e1ea]"
                    role="progressbar"
                    aria-label="SharePoint 업로드 진행 상태"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={75}
                  >
                    <div className="h-2 w-[75%] rounded-xl bg-[#000666]" />
                  </div>
                </div>
              </div>
            </section>
            <div className="relative flex h-[304px] w-full flex-col items-start self-stretch px-0 pb-0 pt-6">
              <section
                className="relative flex h-[280px] w-full flex-col items-start self-stretch overflow-hidden rounded-lg border border-solid border-[#e0e4ec] bg-[#303036] shadow-[0px_1px_2px_#0000000d]"
                aria-labelledby="log-heading"
              >
                <header className="relative flex w-full items-center self-stretch border-b border-solid border-[#ffffff1a] px-4 py-3">
                  <div className="relative inline-flex flex-none flex-col items-start py-0 pl-0 pr-2">
                    <img
                      className="relative h-[9.33px] w-[11.67px]"
                      alt=""
                      src={icon2}
                    />
                  </div>
                  <h2
                    id="log-heading"
                    className="relative mt-[-1px] flex w-fit items-center whitespace-nowrap [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-sm font-medium leading-5 tracking-[0] text-[#c6c5d4]"
                  >
                    실행 로그
                  </h2>
                </header>
                <div
                  className="relative flex w-full flex-1 flex-col items-start gap-2 self-stretch overflow-auto rounded-b-lg bg-[#303036] p-4"
                  aria-live="polite"
                >
                  {logEntries.map((entry) => (
                    <div
                      key={`${entry.time}-${entry.message}`}
                      className="relative flex w-full items-start self-stretch whitespace-nowrap [font-family:'JetBrains_Mono-Medium',Helvetica] text-[13px] font-medium leading-[18px] tracking-[-0.26px]"
                    >
                      <time className="w-20 flex-none text-slate-500">
                        {entry.time}
                      </time>
                      <span
                        className={`w-[74px] flex-none ${entry.levelClass}`}
                      >
                        {entry.level}
                      </span>
                      <span className="text-white">{entry.message}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <div className="relative flex w-full flex-col items-start self-stretch px-0 pb-0 pt-6">
              <section
                className="relative flex w-full flex-col items-start gap-4 self-stretch overflow-hidden rounded-lg border border-solid border-[#e0e4ec] bg-white p-6 shadow-[0px_1px_2px_#0000000d]"
                aria-labelledby="result-heading"
              >
                <div className="absolute left-px top-px h-1 w-[calc(100%_-_2px)] bg-[linear-gradient(90deg,rgba(0,6,102,1)_0%,rgba(189,194,255,1)_50%,rgba(0,6,102,1)_100%)]" />
                <div className="relative flex w-full items-center justify-between self-stretch">
                  <div className="relative inline-flex items-center">
                    <div className="relative inline-flex flex-none flex-col items-start py-0 pl-0 pr-2">
                      <img className="relative h-2.5 w-5" alt="" src={icon4} />
                    </div>
                    <h2
                      id="result-heading"
                      className="relative mt-[-1px] flex w-fit items-center whitespace-nowrap [font-family:'Inter-SemiBold',Helvetica] text-lg font-semibold leading-6 tracking-[0] text-[#1b1b21]"
                    >
                      배포 결과 URL (Step 3)
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="relative inline-flex items-center rounded border border-solid border-[#e0e4ec] px-3 py-1.5 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#000666]"
                  >
                    <img
                      className="relative h-[11.67px] w-[9.92px]"
                      alt=""
                      src={icon5}
                    />
                    <span className="ml-1 [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-xs font-medium leading-4 tracking-[0] text-[#000666]">
                      {copied ? "복사됨" : "전체 복사"}
                    </span>
                  </button>
                </div>
                <div className="relative flex w-full flex-col items-start gap-3 self-stretch">
                  <div className="relative flex w-full items-center justify-between self-stretch rounded border border-solid border-[#e0e4ec] bg-slate-50 p-3">
                    <div className="relative inline-flex items-center pr-4">
                      <div className="relative inline-flex flex-none flex-col items-start py-0 pl-0 pr-3">
                        <img className="relative h-5 w-5" alt="" src={icon6} />
                      </div>
                      <span className="[font-family:'Inter-Medium',Helvetica] text-xs font-medium leading-4 tracking-[0] text-[#1b1b21]">
                        sb-cc-api_v2.0.24.8507.tar.gz
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyAll}
                      className="inline-flex items-center justify-center p-1 focus:outline-none focus:ring-2 focus:ring-[#000666]"
                      aria-label="sb-cc-api URL 복사"
                    >
                      <img
                        className="relative h-[11.67px] w-[9.92px]"
                        alt=""
                        src={icon7}
                      />
                    </button>
                  </div>
                  <div className="relative flex w-full items-center justify-between self-stretch rounded border border-solid border-[#f4433633] bg-slate-50 p-3">
                    <div className="relative inline-flex items-center pr-4">
                      <div className="relative inline-flex flex-none flex-col items-start py-0 pl-0 pr-3">
                        <img
                          className="relative h-[19px] w-[22px]"
                          alt=""
                          src={icon8}
                        />
                      </div>
                      <div className="relative inline-flex flex-col items-start">
                        <span className="[font-family:'Inter-Medium',Helvetica] text-xs font-medium leading-4 tracking-[0] text-[#1b1b21]">
                          cids_model.zip
                        </span>
                        <span className="[font-family:'Inter-Regular',Helvetica] text-xs font-normal leading-4 tracking-[0] text-[#f44336]">
                          {retrying
                            ? "재시도 중..."
                            : "다운로드 실패 (Timeout)"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={retrying}
                      className="relative inline-flex items-center rounded-sm border border-solid border-[#e0e4ec] px-2 py-1 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-[#000666]"
                    >
                      <img
                        className="relative h-[9.33px] w-[9.33px]"
                        alt=""
                        src={icon9}
                      />
                      <span className="ml-1 [font-family:'WenQuanYi_Zen_Hei-Medium',Helvetica] text-xs font-medium leading-4 tracking-[0] text-[#5b5f61]">
                        재시도
                      </span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
