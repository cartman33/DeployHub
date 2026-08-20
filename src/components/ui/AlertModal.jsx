/**
 * 사용자에게 알림을 표시하는 모달 컴포넌트
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {string} message - 표시할 알림 메시지 내용
 * @param {function} onClose - 모달 닫기 이벤트 핸들러
 */
export const AlertModal = ({ isOpen, message, onClose, type = "warning" }) => {
  // 모달이 열려있지 않으면 아무것도 렌더링하지 않음
  if (!isOpen) return null;

  return (
    // 모달 배경 및 화면 중앙 정렬을 위한 래퍼 (페이드 인 애니메이션 적용)
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      {/* 모달 컨텐츠를 감싸는 메인 컨테이너 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center gap-5">
        
        {/* 모달 상단 경고/알림 아이콘을 표시하는 원형 배경 영역 */}
        {type === "warning" ? (
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center shadow-inner">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-green-50 text-green-500 flex items-center justify-center shadow-inner">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

        {/* 텍스트 내용을 감싸는 컨테이너 */}
        <div className="flex flex-col gap-2">
          {/* 모달 제목 */}
          <h3 className="text-2xl font-bold text-slate-800">
            알림
          </h3>
          {/* 전달받은 메시지 본문 */}
          <p className="text-base text-slate-500 leading-relaxed px-2 break-keep">
            {message}
          </p>
        </div>

        {/* 하단 버튼을 감싸는 영역 */}
        <div className="flex flex-col gap-2 w-full mt-2">
          {/* 모달을 닫는 확인 버튼 */}
          <button
            type="button"
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
