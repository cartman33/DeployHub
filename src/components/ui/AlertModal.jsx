/**
 * 시스템 전역에서 사용하는 단일 알림 모달 컴포넌트
 * 경고(warning)와 성공(success) 두 가지 타입으로 제공됩니다.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - [Input] 모달 열림 여부. (조건부 렌더링: 필요할 때만 무대 위에 올리고 안 쓰면 완전히 치워버려서 자리를 아끼는 마술입니다.)
 * @param {string} props.message - [Input] 사용자에게 보여줄 안내 방송 멘트
 * @param {function} props.onClose - [Input] 확인 버튼을 누르거나 창을 닫을 때 실행되는 리모콘 버튼(콜백)
 * @param {"warning" | "success"} [props.type="warning"] - [Input] 알림의 분위기(빨간색 경고할지 초록색 칭찬할지)를 결정합니다.
 * @returns {JSX.Element | null} [Output] 모달 화면을 보여주거나, 아무것도 안 보여줌(null)
 */
export const AlertModal = ({ isOpen, message, onClose, type = "warning" }) => {
  // 모달이 열려있지 않으면 무대(렌더 트리)에서 아예 내려버려요. 쓸데없이 자리를 차지하는 걸 막아줍니다.
  if (!isOpen) return null;

  return (
    // 배경 오버레이 레이어
    // - fixed inset-0: 화면 전체를 커다란 보자기처럼 꽉 덮어서, 스크롤을 내려도 항상 같은 자리에 있게 해요.
    // - z-50: 화면 겹침 방어를 위해 다른 모든 화면(헤더 등)보다 가장 높은 층(50층)에 올려서 무조건 보이게 합니다.
    // - backdrop-blur-sm: 배경을 안개 낀 것처럼 흐리게 만들어서, 사람들의 시선이 모달 창에만 딱 꽂히게 해줘요.
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      {/* 모달 창 본체 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center gap-5">
        
        {/* 모달 아이콘 표시 영역 (상황에 따라 다른 아이콘을 꺼내는 마술 - 조건부 렌더링) */}
        {type === "warning" ? (
          // 경고(warning) 타입: 붉은색 배경의 삼각형+느낌표 아이콘
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center shadow-inner">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        ) : (
          // 성공(success) 타입: 녹색 배경의 원+체크표시 아이콘
          <div className="w-16 h-16 rounded-full bg-green-50 text-green-500 flex items-center justify-center shadow-inner">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

        {/* 모달 텍스트 영역 */}
        <div className="flex flex-col gap-2">
          <h3 className="text-2xl font-bold text-slate-800">
            알림
          </h3>
          <p className="text-base text-slate-500 leading-relaxed px-2 break-keep">
            {message}
          </p>
        </div>

        {/* 확인 버튼 영역 */}
        <div className="flex flex-col gap-2 w-full mt-2">
          <button
            type="button" // 엉뚱하게 폼(form)이 제출되어버리는 사고를 막기 위해 "이건 그냥 버튼이야!" 라고 명찰을 붙여줍니다.
            onClick={onClose}
            className="w-full py-3 bg-[#000666] hover:bg-[#090d82] text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-100 transition-all text-base"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
