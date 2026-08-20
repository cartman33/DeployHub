const fs = require('fs');

let c = fs.readFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'utf8');

// Remove sort
const oldSort = `      return versions.filter(v => v.versionName.startsWith(prefix)) // 해당 날짜 접두어로 시작하는 버전만 필터링
        .sort((a, b) => {
          // 하이픈(-) 뒷부분의 숫자(인덱스)를 파싱하여 내림차순 정렬
          const aSuf = parseInt(a.versionName.split('-')[1] || "1", 10);
          const bSuf = parseInt(b.versionName.split('-')[1] || "1", 10);
          return bSuf - aSuf; // 끝번호가 먼저 오도록 정렬 (descending)
        });`;
const newSort = `      return versions.filter(v => v.versionName.startsWith(prefix)); // 이미 서버에서 내림차순 정렬되어 옴`;
c = c.replace(oldSort, newSort);

// Replace defaultRows with SUBVERSION_ORDER mapping
const oldDefaultRows = `  // 새 버전을 등록할 때 사용할 기본 서브버전 폼 데이터 템플릿입니다.
  const defaultRows = [
    { subVersion: "CC", tag: "acme/sb-cc-api:v", note: "" },
    { subVersion: "FE", tag: "acme/sb-cc-fe:v", note: "" },
    { subVersion: "SWG", tag: "acme/swg-tls-proxy:v", note: "" },
    { subVersion: "FOGGER", tag: "acme/fogger-sb:v", note: "" },
    { subVersion: "SCREENCAP", tag: "acme/screencap-sb:v", note: "" },
    { subVersion: "CIDS", tag: "acme/cids:v", note: "" },
    { subVersion: "OCR", tag: "acme/ocr:v", note: "" },
    { subVersion: "DLP", tag: "acme/dlp-dlp:v", note: "" },
    { subVersion: "DB", tag: "acme/sb-cc-db:v", note: "" },
  ];`;

const newDefaultRows = `  // 새 버전을 등록할 때 사용할 기본 서브버전 폼 데이터 템플릿입니다.
  const defaultRows = SUBVERSION_ORDER.map(code => ({
    subVersion: code,
    tag: \`acme/\${code.toLowerCase()}:v\`,
    note: ""
  }));`;
c = c.replace(oldDefaultRows, newDefaultRows);

fs.writeFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', c, 'utf8');
