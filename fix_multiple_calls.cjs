const fs = require('fs');

let c = fs.readFileSync('src/features/deployer/DeploymentPipelineDashboardSection.jsx', 'utf8');

const targetFetch = `      setDetailsCache(prevCache => {
        // 아직 캐시에 없는 버전만 필터링
        const toFetch = needed.filter(v => prevCache[v] === undefined);
        
        // 새로 받아올 정보가 없다면 기존 캐시 그대로 반환
        if (toFetch.length === 0) return prevCache;
        
        // 비동기 요청을 실행할 함수 선언 (상태 업데이트 안에서는 async/await 대기가 불가능하므로 분리)
        const loadMissing = async () => {
          const newEntries = {};
          for (const ver of toFetch) {
            try {
              newEntries[ver] = await getMainVersionDetail(ver);
            } catch (e) {
              console.error(e);
              newEntries[ver] = null;
            }
          }
          // 받아온 데이터를 기존 캐시에 병합
          setDetailsCache(old => ({ ...old, ...newEntries }));
        };
        
        // 비동기 함수 실행 (주의: 상태 업데이트 시점에 pending 상태 등을 즉시 반영하고 싶다면 별도 처리가 필요할 수 있음)
        loadMissing();
        
        // 이 시점에서는 캐시 상태가 변경되지 않음 (비동기 처리 후 위에서 업데이트됨)
        // 하지만 빈 객체나 현재 상태를 그대로 반환하면, 비동기 완료 전까지 needed 배열 내의 누락 항목들이
        // 다음 렌더링 사이클에서 다시 toFetch로 잡혀 중복 호출을 유발할 수 있습니다.
        // 이를 방지하기 위해 임시로 'loading' 상태 같은 객체를 심어둘 수도 있지만, 여기서는 간단히 prevCache를 반환합니다.
        // (단, 의존성 배열에 leftSequence, rightSequence만 있으므로 컴포넌트 리렌더링이 무한 반복되지는 않습니다.)
        return prevCache;
      });`;

const replaceFetch = `      setDetailsCache(prevCache => {
        const toFetch = needed.filter(v => prevCache[v] === undefined);
        if (toFetch.length === 0) return prevCache;
        
        const nextCache = { ...prevCache };
        for (const ver of toFetch) {
          nextCache[ver] = "loading";
        }

        const loadMissing = async () => {
          const newEntries = {};
          for (const ver of toFetch) {
            try {
              newEntries[ver] = await getMainVersionDetail(ver);
            } catch (e) {
              console.error(e);
              newEntries[ver] = null;
            }
          }
          setDetailsCache(old => ({ ...old, ...newEntries }));
        };
        
        loadMissing();
        return nextCache;
      });`;

c = c.replace(targetFetch, replaceFetch);
c = c.replace(/detail=\{detailsCache\[vName\]\}/g, 'detail={detailsCache[vName] === "loading" ? undefined : detailsCache[vName]}');

fs.writeFileSync('src/features/deployer/DeploymentPipelineDashboardSection.jsx', c, 'utf8');
