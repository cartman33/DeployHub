const fs = require('fs');

// 1. App.jsx - Add pagination
let app = fs.readFileSync('src/app/App.jsx', 'utf8');

const oldLoad = `  const loadVersions = async (keyword = "") => {
    setLoadingVersions(true);
    setVersionError("");

    try {
      const searchStr = typeof keyword === 'string' ? keyword : "";
      const response = await listMainVersions(searchStr, 0, 50);
      const items = response?.items || [];
      // Server handles sorting.
      setVersions(items);
      // 선택된 버전이 없고 목록이 존재하면 첫 번째 버전을 기본값으로 설정합니다.
      if (!selectedVersionName && items.length > 0) {
        setSelectedVersionName(items[0].versionName);
      }
    } catch (error) {
      // 에러 발생 시 사용자에게 보여줄 메시지를 설정합니다.
      setVersionError(error.payload?.message || error.message || "메인버전 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoadingVersions(false);
    }
  };`;

const newLoad = `  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadVersions = async (keyword = "", pageToLoad = 0, append = false) => {
    setLoadingVersions(true);
    setVersionError("");

    try {
      const searchStr = typeof keyword === 'string' ? keyword : "";
      const response = await listMainVersions(searchStr, pageToLoad, 50);
      const items = response?.items || [];
      
      setVersions(prev => append ? [...prev, ...items] : items);
      setPage(pageToLoad);
      setHasMore(items.length > 0 && response.totalCount > (pageToLoad + 1) * 50);

      if (!append && !selectedVersionName && items.length > 0) {
        setSelectedVersionName(items[0].versionName);
      }
    } catch (error) {
      setVersionError(error.payload?.message || error.message || "메인버전 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoadingVersions(false);
    }
  };

  const loadMoreVersions = () => {
    if (hasMore && !loadingVersions) {
      loadVersions(currentKeyword, page + 1, true);
    }
  };`;

app = app.replace(oldLoad, newLoad);

const oldHeaderRight = `<button 
                onClick={() => window.location.reload()}`;
const newHeaderRight = `{hasMore && (
                <button
                  onClick={loadMoreVersions}
                  disabled={loadingVersions}
                  className="mr-2 px-3 py-1.5 text-sm font-bold bg-indigo-50 text-indigo-700 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors"
                >
                  {loadingVersions ? '로딩중...' : '과거 버전 더 보기'}
                </button>
              )}
              <button 
                onClick={() => window.location.reload()}`;

app = app.replace(oldHeaderRight, newHeaderRight);
fs.writeFileSync('src/app/App.jsx', app, 'utf8');

// 2. api.js - Fix listMainVersions sort
let api = fs.readFileSync('src/services/api.js', 'utf8');
api = api.replace(/size: String\(size\),/g, "size: String(size),\n    sort: 'versionName,desc',");
fs.writeFileSync('src/services/api.js', api, 'utf8');
