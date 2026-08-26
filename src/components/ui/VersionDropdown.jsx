import { useEffect, useRef, useState } from "react";

export const VersionDropdown = ({
  id,
  value,
  options,
  onChange,
  placeholder = "버전을 선택하세요",
  disabled = false,
  isOptionDisabled,
  getOptionLabel,
  hasMore = false,
  loading = false,
  onLoadMore,
  buttonClassName = "",
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []); 

  const handleScroll = (event) => {
    const element = event.currentTarget;
    if (hasMore && !loading && element.scrollHeight - element.scrollTop - element.clientHeight < 40) {
      onLoadMore?.();
    }
  };

  return (
    <div ref={containerRef} className="relative flex-[2] min-w-[200px]">
      <button
        id={id}
        type="button"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        className={`flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-3 text-left text-base font-bold text-slate-800 transition-shadow focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className={value ? "truncate" : "truncate text-slate-400"}>{value || placeholder}</span>
        <span className={`ml-2 text-xs text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      
      {open && (
        <div
          onScroll={handleScroll}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          {options.length === 0 && !loading && (
            <div className="px-3 py-3 text-sm font-bold text-slate-400">검색 결과가 없습니다.</div>
          )}
          
          {options.map((option) => {
            const optionDisabled = isOptionDisabled?.(option) || false;
            return (
              <button
                key={option.versionName}
                type="button"
                disabled={optionDisabled}
                onClick={() => {
                  setOpen(false);
                  onChange(option.versionName);
                }}
                className={`block w-full px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                  option.versionName === value
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-700 hover:bg-slate-50"
                } disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300`}
              >
                {getOptionLabel ? getOptionLabel(option, optionDisabled) : option.versionName}
              </button>
            );
          })}
          
          {(loading || hasMore) && (
            <div className="px-3 py-2 text-center text-xs font-bold text-slate-400">
              {loading ? "버전을 불러오는 중..." : "아래로 스크롤하면 다음 버전을 불러옵니다."}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
