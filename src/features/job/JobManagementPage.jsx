import { useState, useEffect } from "react";
import { listPackageJobs, deletePackage, runAdminCleanup, getPackageJobFiles } from "../../services/api";

export const JobManagementPage = () => {
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const statusParam = statusFilter === "ALL" ? undefined : statusFilter;
      const data = await listPackageJobs(statusParam);
      let jobList = Array.isArray(data) ? data : (data?.items || []);
      
      // N+1 호출을 감수하고 각 Job의 파일 정보를 조회하여 삭제 여부(deletedAt)를 확인합니다.
      const enrichedJobs = await Promise.all(
        jobList.map(async (job) => {
          try {
            const filesData = await getPackageJobFiles(job.versionName);
            return { ...job, deletedAt: filesData.deletedAt };
          } catch (e) {
            return job;
          }
        })
      );
      
      setJobs(enrichedJobs);
    } catch (err) {
      setError(err.payload?.message || err.message || "Job 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [statusFilter]);

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

  const handleCleanup = async () => {
    try {
      // 1. Dry run으로 대상 확인
      const dryResult = await runAdminCleanup(true);
      const localCount = dryResult?.localCleaned?.length || 0;
      const spCount = dryResult?.sharePointCleaned?.length || 0;
      
      if (localCount === 0 && spCount === 0) {
        alert("정리할 보존 기한 만료 패키지가 없습니다.");
        return;
      }

      // 2. 사용자 확인
      const msg = `정리 대상이 발견되었습니다.\n- 로컬 정리 대상: ${localCount}건\n- SharePoint 정리 대상: ${spCount}건\n\n정말로 스토리지 정리를 실행하시겠습니까?`;
      if (!window.confirm(msg)) {
        return;
      }

      // 3. 실제 정리 실행
      await runAdminCleanup(false);
      alert("일괄 정리가 성공적으로 완료되었습니다.");
      fetchJobs();
    } catch (err) {
      alert(err.payload?.message || err.message || "정리 배치 실행 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="p-8 max-w-[1920px] mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[#000666]">패키지 Job 관리</h2>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 bg-white"
          >
            <option value="ALL">전체 상태</option>
            <option value="PENDING">PENDING</option>
            <option value="VALIDATING">VALIDATING</option>
            <option value="DOWNLOADING">DOWNLOADING</option>
            <option value="UPLOADING">UPLOADING</option>
            <option value="DONE">DONE</option>
            <option value="FAILED">FAILED</option>
          </select>
          <button
            onClick={handleCleanup}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-lg transition-colors border border-red-200"
          >
            오래된 Job 일괄 정리
          </button>
          <button
            onClick={fetchJobs}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
          >
            새로고침
          </button>
        </div>
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
                <th className="px-6 py-4 text-sm font-bold text-slate-600">진행률</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">결과 폴더</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">일시</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">작업</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, idx) => (
                <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${job.deletedAt ? "opacity-60 bg-slate-50" : ""}`}>
                  <td className="px-6 py-4 font-mono font-bold text-slate-800 flex flex-col gap-1">
                    {job.versionName}
                    {job.deletedAt && <span className="text-[10px] text-red-500 font-bold">삭제됨</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      job.deletedAt ? "bg-slate-200 text-slate-500" :
                      job.status === "DONE" ? "bg-green-100 text-green-700" :
                      job.status === "FAILED" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {job.deletedAt ? "DELETED" : job.status || "UNKNOWN"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs font-medium text-slate-500">
                        <span>{job.progress}%</span>
                        <span>{job.completedItems} / {job.totalItems}</span>
                      </div>
                      <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${job.deletedAt ? 'bg-slate-400' : job.status === 'FAILED' ? 'bg-red-500' : 'bg-indigo-500'}`} 
                          style={{ width: `${job.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-[200px] truncate">
                    {job.deletedAt ? (
                      <span className="text-slate-400 text-sm">만료됨</span>
                    ) : job.spFolderUrl ? (
                      <a 
                        href={job.spFolderUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 text-sm hover:underline"
                        title={job.spFolderUrl}
                      >
                        폴더 열기
                      </a>
                    ) : (
                      <span className="text-slate-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 flex flex-col gap-1">
                    <span><strong className="font-medium text-slate-600">시작:</strong> {job.createdAt ? new Date(job.createdAt).toLocaleString() : "-"}</span>
                    {job.deletedAt ? (
                      <span className="text-red-500"><strong className="font-medium">삭제일:</strong> {new Date(job.deletedAt).toLocaleString()}</span>
                    ) : (
                      job.finishedAt && <span><strong className="font-medium text-slate-600">종료:</strong> {new Date(job.finishedAt).toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {job.deletedAt ? (
                      <span className="px-4 py-1.5 text-slate-400 font-bold rounded text-sm bg-slate-100">
                        삭제됨
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDelete(job.versionName)}
                        className="px-4 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded text-sm transition-colors"
                      >
                        삭제
                      </button>
                    )}
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
