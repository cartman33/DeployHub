// 환경 변수 파일(.env)에 적어둔 서버 주소를 가져옵니다. 만약 없다면 기본값으로 "/api"를 사용합니다.
const BASE_PATH = import.meta.env.VITE_API_BASE_URL || "/api";

/**
 * 프론트엔드 화면에서 백엔드 서버로 데이터를 요청할 때 공통으로 사용하는 함수입니다.
 * 
 * @param {string} path - 데이터를 요청할 서버의 상세 주소 (예: '/main-versions')
 * @param {object} options - 서버에 같이 보낼 추가 옵션 (예: POST 방식, 보낼 데이터 등)
 * @returns 요청이 성공하면 서버에서 보내준 데이터를 반환하고, 실패하면 에러를 뿜어냅니다.
 */
async function request(path, options = {}) {
  // 서버와 대화할 때 "우리는 JSON 형식으로 데이터를 주고받을 거야"라고 미리 알려주는 기본 설정입니다.
  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  // 인터넷 브라우저에 내장된 fetch 기능을 써서 실제로 서버에 요청을 보냅니다.
  const response = await fetch(`${BASE_PATH}${path}`, {
    ...options, 
    headers: {
      ...defaultHeaders, // 기본 설정을 깔아두고
      ...(options.headers || {}), // 혹시 특별히 추가한 설정이 있다면 덮어씌워 줍니다.
    },
  });

  // 서버가 준 응답을 먼저 일반 글자(텍스트) 형태로 읽어옵니다.
  // 서버가 가끔 정상적인 데이터 대신 HTML 에러 페이지 같은 걸 줄 수도 있기 때문에 안전하게 텍스트로 먼저 받습니다.
  const text = await response.text();
  let payload = null;
  
  if (text) {
    try {
      // 받아온 글자를 자바스크립트에서 쓸 수 있는 객체(JSON)로 변환해 봅니다.
      payload = JSON.parse(text);
    } catch {
      // 만약 객체로 변환이 안 되는 이상한 글자라면, 프로그램이 멈추지 않게 그냥 메시지 형태로 감싸줍니다.
      payload = { message: text };
    }
  }

  // 서버가 "성공(200번대)"이 아닌 "실패(400, 500 등)" 상태 코드를 돌려줬을 때의 처리입니다.
  if (!response.ok) {
    const error = new Error(payload?.message || `${response.status} ${response.statusText}`);
    // 에러가 났을 때, 화면에서 "몇 번 에러인지", "어떤 내용인지"를 보여주기 위해 에러 객체에 데이터를 달아줍니다.
    error.status = response.status;
    error.payload = payload;
    throw error; // 화면 쪽에 에러가 났다고 빵! 하고 던져줍니다.
  }

  return payload;
}

/**
 * 저장되어 있는 '메인 버전' 전체 목록을 서버에서 불러오는 함수입니다.
 * 
 * @param {string} keyword - 검색하고 싶은 단어
 * @param {number} page - 보고 싶은 페이지 번호 (0부터 시작)
 * @param {number} size - 한 페이지에 몇 개씩 볼 건지
 */
export async function listMainVersions(keyword = "", page = 0, size = 50) {
  // 주소창에 들어갈 검색어나 페이지 번호를 안전한 형태로 만들어 줍니다.
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    // 최신 버전이 가장 위에 보이도록 서버에 강제로 정렬 조건을 달아줍니다.
    sort: 'versionName,desc'
  });
  
  // 사용자가 검색어를 입력했을 때만 서버 주소 뒤에 검색어를 붙여줍니다.
  if (keyword) {
    params.set("keyword", keyword);
  }
  
  return request(`/main-versions?${params.toString()}`);
}

/**
 * 새로운 메인 버전을 하나 만들어달라고 서버에 요청(POST)하는 함수입니다.
 */
export async function createMainVersion(versionName, payload = {}) {
  return request(`/main-versions`, {
    method: "POST",
    body: JSON.stringify({ versionName, ...payload }),
  });
}

/**
 * 서브 버전을 등록하거나 수정해달라고 서버에 요청(PUT)하는 함수입니다.
 * (이미 있으면 수정하고, 없으면 새로 만듭니다)
 */
export async function upsertSubVersion(versionName, code, payload) {
  // 이름이나 코드에 특수문자(슬래시 등)가 들어가면 서버 주소가 망가질 수 있으므로, encodeURIComponent로 안전하게 바꿔서 보냅니다.
  return request(`/main-versions/${encodeURIComponent(versionName)}/sub-versions/${encodeURIComponent(code)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * 특정 메인 버전을 눌렀을 때, 그 안에 속한 상세 정보들(서브 버전 목록 등)을 불러오는 함수입니다.
 */
export async function getMainVersionDetail(versionName) {
  // 버전 이름이 안 들어왔으면 굳이 서버에 물어보지 않고 바로 에러를 냅니다.
  if (!versionName) throw new Error("versionName is required");
  return request(`/main-versions/${encodeURIComponent(versionName)}`);
}

/**
 * 배포 작업을 시작하기 전에, 지금 이 버전이 "패키징(빌드)을 시작해도 되는 상태인지" 서버에 물어보는 함수입니다.
 */
export async function getPackagingEligibility(versionName) {
  if (!versionName) throw new Error("versionName is required");
  return request(`/main-versions/${encodeURIComponent(versionName)}/packaging-eligibility`);
}

/**
 * 네이버 클라우드 레지스트리(NCR) 서버가 정상적으로 살아있는지 확인(Health Check)하는 함수입니다.
 */
export async function registryHealth() {
  return request(`/health/registry`);
}

/**
 * 원드라이브(SharePoint) 연동 서버가 정상적으로 살아있는지 확인(Health Check)하는 함수입니다.
 */
export async function onedriveHealth() {
  return request(`/health/sharepoint`);
}

/**
 * 선택한 이미지 태그들을 모아서 실제 패키징(빌드) 작업을 시작해달라고 서버에 요청하는 함수입니다.
 */
export async function createPackageJob(versionName, body) {
  return request(`/main-versions/${encodeURIComponent(versionName)}/package-job`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * 현재 서버에서 돌고 있는(또는 끝난) 패키징 작업들의 전체 목록을 불러오는 함수입니다.
 */
export async function listPackageJobs(status) {
  const params = new URLSearchParams();
  // PENDING, DONE 등 특정 상태의 작업만 보고 싶을 때 조건을 붙입니다.
  if (status) params.set("status", status);
  return request(`/package-jobs?${params.toString()}`);
}

/**
 * 실행 중인 특정 패키징 작업이 현재 몇 퍼센트나 진행되었는지, 에러는 없는지 상세 현황을 물어보는 함수입니다.
 */
export async function getPackageJob(versionName) {
  if (!versionName) throw new Error("versionName is required");
  return request(`/package-jobs/${encodeURIComponent(versionName)}`);
}

/**
 * 패키징 도중 에러가 났을 때, 실패한 작업들만 다시 시작(재시도)하게 해주는 함수입니다.
 */
export async function retryPackageJob(versionName, body) {
  return request(`/package-jobs/${encodeURIComponent(versionName)}/retry`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * 메인 버전에 적어둔 릴리즈 노트나 SQL 스크립트 등의 글 내용을 수정해달라고 서버에 요청하는 함수입니다.
 */
export async function updateMainVersion(versionName, payload) {
  return request(`/main-versions/${encodeURIComponent(versionName)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * 관리자가 서버 스토리지 용량을 차지하는 너무 오래된 찌꺼기 파일들을 일괄 정리(삭제)하는 함수입니다.
 * 
 * @param {boolean} dryRun - 이 값이 true면 "실제로 지우지는 말고, 지우면 몇 개가 지워질지 숫자만 알려줘"라는 뜻입니다. (안전장치)
 */
export async function runAdminCleanup(dryRun = true) {
  return request(`/admin/cleanup?dryRun=${dryRun}`, {
    method: "POST",
  });
}

/**
 * 패키징 작업이 무사히 끝난 뒤, 서버에 만들어진 압축 파일들(.zip 등)의 다운로드 주소 목록을 불러오는 함수입니다.
 */
export async function getPackageJobFiles(versionName) {
  return request(`/package-jobs/${encodeURIComponent(versionName)}/files`);
}

/**
 * 특정 서브 버전을 아예 삭제해 버리는 함수입니다.
 * (중복될 수 있는 이름 대신, 절대 안 변하는 고유 ID를 써서 실수로 엉뚱한 걸 지우지 않게 합니다)
 */
export async function deleteSubVersion(id) {
  return request(`/sub-versions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/**
 * 서버에 저장된 물리적인 결과물 파일(용량을 많이 차지하는 파일)만 삭제해 주는 함수입니다.
 * (이 함수를 써도 화면에 보이는 '작업 기록' 자체는 그대로 남아있습니다)
 */
export async function deletePackage(versionName) {
  return request(`/package-jobs/${encodeURIComponent(versionName)}/package`, {
    method: "DELETE",
  });
}
