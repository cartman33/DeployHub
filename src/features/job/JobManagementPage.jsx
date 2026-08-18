import { useState, useEffect } from "react";
import { listPackageJobs, deletePackage } from "../../services/api";

export const JobManagementPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listPackageJobs();
      setJobs(Array.isArray(data) ? data : (data?.items || []));
    } catch (err) {
      setError(err.payload?.message || err.message || "Job 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleDelete = async (versionName) => {
    if (!window.confirm(`정말로 [${versionName}]의 패키지 Job을 삭제하시겠습니까?`)) {
      return;
    }
    try {
      await deletePackage(versionName);
      alert("성공적으로 삭제되었습니다.");
      fetchJobs(); // 재로딩
    } catch (err) {
      alert(err.payload?.message || err.message || "삭제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[#000666]">패키지 Job 관리</h2>
        <button
          onClick={fetchJobs}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
        >
          새로고침
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold animate-pulse">
            불러오는 중...
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-bold">
            등록된 Job이 없습니다.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">메인버전</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">상태</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">등록일</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">작업</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-slate-800">
                    {job.versionName}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      job.status === "DONE" ? "bg-green-100 text-green-700" :
                      job.status === "FAILED" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {job.status || "UNKNOWN"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {job.createdAt ? new Date(job.createdAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDelete(job.versionName)}
                      className="px-4 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded text-sm transition-colors"
                    >
                      패키지 삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
