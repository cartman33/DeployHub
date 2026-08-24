import { useEffect, useRef, useState } from "react";

/**
 * 무한 스크롤이 지원되는 커스텀 버전 드롭다운 컴포넌트입니다.
 * 
 * 
 * @param {Object} props
 * @param {string} props.id - HTML 이름표와 연결하기 위한 고유 이름
 * @param {string} props.value - 현재 선택된 버전명 (부모가 고삐를 쥐고 조종하는 상태)
 * @param {Array<{versionName: string}>} props.options - 드롭다운에 표시할 데이터 목록
 * @param {(versionName: string) => void} props.onChange - 새 버전을 선택할 때 부모에게 알려주는 무전기(콜백)
 * @param {string} [props.placeholder="버전을 선택하세요"] - 선택된 값이 없을 때 보여주는 안내 문구
 * @param {boolean} [props.disabled=false] - 드롭다운을 꽁꽁 얼려둘지(비활성화) 여부
 * @param {(option) => boolean} props.isOptionDisabled - 개별 옵션들을 얼려둘지 결정
 * @param {(option, disabled) => string} props.getOptionLabel - 드롭다운 옵션의 글자를 예쁘게 꾸며주는 붓
 * @param {boolean} [props.hasMore=false] - 창고(백엔드)에 꺼내올 다음 페이지가 더 남아있는지 여부
 * @param {boolean} [props.loading=false] - 열심히 데이터를 가져오는 중인지 여부 (중복 심부름 방지)
 * @param {() => void} props.onLoadMore - 스크롤이 바닥에 닿았을 때 창고지기에게 다음 페이지를 달라고 외치는 무전기
 * @param {string} [props.buttonClassName=""] - 드롭다운 버튼에 입힐 (Tailwind CSS)
 * @returns {JSX.Element}
 */
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

  // [바깥 클릭 감지 센서]
  // 드롭다운 바깥 공간을 클릭하면 창이 스르륵 닫히도록 감시하는 도둑 경보기 같은 역할이에요.
  // 마우스 버튼을 누르자마자(mousedown) 반응해서, 다른 곳으로 시선이 뺏기기 전에 재빨리 창을 닫아줍니다.
  useEffect(() => {
    const handleOutsideClick = (event) => {
      // 마우스가 콕 찍은 곳이 우리 집(containerRef) 안이 아니면 창문(open)을 닫아라!
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    
    // 이 컴포넌트가 화면에서 사라져서 퇴근할 때는 감시 카메라(이벤트 리스너)도 꼭 꺼줘야 합니다. 안 그러면 전기가 낭비돼요(메모리 누수).
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []); 

  // 드롭다운 스크롤 감지 및 무한 스크롤 페이징 트리거
  const handleScroll = (event) => {
    const element = event.currentTarget;
    // 전체 높이 - 스크롤된 위치 - 화면에 보이는 높이
    // 이 값이 40보다 작다는 건, 스크롤이 바닥에서 40px 안쪽으로 들어왔다는 뜻이에요. (여유를 두고 미리미리 다음 장을 넘길 준비!)
    // hasMore && !loading 조건: 창고에 물건이 남아있고, 아직 심부름꾼이 출발하지 않았을 때만 새로운 심부름을 시켜요.
    if (hasMore && !loading && element.scrollHeight - element.scrollTop - element.clientHeight < 40) {
      onLoadMore?.();
    }
  };

  return (
    // 드롭다운 레이아웃 구조를 잡는 최상위 컨테이너
    // relative를 주면 우리 집을 기준점으로 삼아서, 자식 요소가 절대 좌표(absolute)로 도망가도 우리 집 아래에 잘 매달려 있게 됩니다.
    <div ref={containerRef} className="relative flex-[2] min-w-[200px]">
      <button
        id={id}
        type="button"
        // onClick 시 (current) => !current 함수형 업데이트 사용 이유: 연속 클릭 시 옛날 기억(stale)을 꺼내오지 않고 가장 최신 기억을 바탕으로 행동하게 만들어요.
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        className={`flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-3 text-left text-base font-bold text-slate-800 transition-shadow focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className={value ? "truncate" : "truncate text-slate-400"}>{value || placeholder}</span>
        <span className={`ml-2 text-xs text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      
      {/* 옵션 패널: 버튼 클릭 시에만 나타나는 마술(조건부 렌더링). absolute를 써서 다른 친구들을 짓누르지 않고 허공에 둥둥 띄워요. */}
      {open && (
        <div
          onScroll={handleScroll}
          // z-50: 화면 겹침 방어를 위해 제일 꼭대기 층(50층)에 배치해서 다른 애들 밑에 깔리지 않게 해요.
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          {options.length === 0 && !loading && (
            <div className="px-3 py-3 text-sm font-bold text-slate-400">검색 결과가 없습니다.</div>
          )}
          
          {/* 전달된 버전을 순회하며 드롭다운 옵션 버튼 생성 */}
          {options.map((option) => {
            const optionDisabled = isOptionDisabled?.(option) || false;
            return (
              <button
                key={option.versionName}
                type="button"
                disabled={optionDisabled}
                onClick={() => {
                  setOpen(false); // 선택 후 드롭다운 닫기
                  onChange(option.versionName); // 부모에게 "이거 골랐어요!" 하고 알려주기
                }}
                className={`block w-full px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                  option.versionName === value
                    ? "bg-indigo-50 text-indigo-700" // 현재 선택된 값 하이라이트
                    : "text-slate-700 hover:bg-slate-50"
                } disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300`}
              >
                {getOptionLabel ? getOptionLabel(option, optionDisabled) : option.versionName}
              </button>
            );
          })}
          
          {/* 무한 스크롤 및 로딩 표시 인디케이터 */}
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
