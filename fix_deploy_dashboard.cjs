const fs = require('fs');

let c = fs.readFileSync('src/features/deployer/DeploymentPipelineDashboardSection.jsx', 'utf8');

// 1. Remove the rightVersionName fallback useEffect completely
const oldEffect = `    useEffect(() => {
      if (versions && versions.length > 0) {
        // 우측 버전이 목록에 없는 경우 첫 번째 버전으로 재설정합니다.
        if (!versions.find(v => v.versionName === rightVersionName)) {
          const newRight = versions[0].versionName;
          setRightVersionName(newRight);
          if (setSelectedVersionName) setSelectedVersionName(newRight);
        }
        // 좌측 버전이 목록에 없는 경우 적절한 인덱스의 버전으로 재설정합니다.
        if (!versions.find(v => v.versionName === leftVersionName)) {
          const newLeft = versions.length > 1 ? versions[1].versionName : versions[0].versionName;
          setLeftVersionName(newLeft);
        }
      }
    }, [versions, rightVersionName, leftVersionName, setSelectedVersionName]);`;
c = c.replace(oldEffect, "");

// 2. Fix the rightVersionName <select> options mapping
const oldSelectRight = `{(versions.some(v => v.versionName === leftVersionName) ? versions : [{ versionName: leftVersionName }, ...versions]).map(v => (`;
// We only want to replace the SECOND occurrence (which is under rightVersionName select)
const idxLeft = c.indexOf(oldSelectRight);
const idxRight = c.indexOf(oldSelectRight, idxLeft + 1);
if (idxRight !== -1) {
    const newSelectRight = `{(versions.some(v => v.versionName === rightVersionName) ? versions : [{ versionName: rightVersionName }, ...versions]).map(v => (`;
    c = c.substring(0, idxRight) + newSelectRight + c.substring(idxRight + oldSelectRight.length);
}

// 3. Inject AlertModal component rendering right before the final closing div/section
const oldClosing = `          </section>
  
        </div>`;
const newClosing = `          </section>
  
        </div>
        
        {/* 경고 모달 */}
        {alertMessage && (
          <AlertModal 
            message={alertMessage} 
            onClose={() => setAlertMessage("")} 
          />
        )}`;
c = c.replace(oldClosing, newClosing);

fs.writeFileSync('src/features/deployer/DeploymentPipelineDashboardSection.jsx', c, 'utf8');
