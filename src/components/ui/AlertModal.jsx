export const AlertModal = ({ isOpen, message, onClose, type = "warning" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center gap-5">
        
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

        <div className="flex flex-col gap-2">
          <h3 className="text-2xl font-bold text-slate-800">
            알림
          </h3>
          <p className="text-base text-slate-500 leading-relaxed px-2 break-keep">
            {message}
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full mt-2">
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
