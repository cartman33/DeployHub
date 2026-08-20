// 환경 변수에서 API 기본 URL을 가져옵니다. 설정되지 않은 경우 "/api"를 기본값으로 사용합니다.
const BASE_PATH = import.meta.env.VITE_API_BASE_URL || "/api";

/**
 * 공통 API 요청 함수입니다.
 * 모든 API 호출에서 사용되며, 기본 헤더 설정 및 응답 에러 처리를 담당합니다.
 * 
 * @param {string} path - 요청할 API 경로 (예: '/main-versions')
 * @param {RequestInit} options - fetch API에 전달할 추가 옵션 (method, body 등)
 * @returns {Promise<any>} - 파싱된 JSON 응답 데이터
 * @throws {Error} - HTTP 에러 상태(2xx가 아님)이거나 네트워크 통신 에러 시 발생
 */
async function request(path, options = {}) {
  // 기본 헤더 설정: JSON 형식으로 데이터를 주고받음을 명시합니다.
  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  // fetch를 사용하여 실제 HTTP 요청을 수행합니다.
  const response = await fetch(`${BASE_PATH}${path}`, {
    ...options, // 사용자 지정 옵션 병합
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}), // 사용자가 전달한 커스텀 헤더로 기본 헤더를 덮어쓰거나 추가합니다.
    },
  });

  // 응답 본문을 텍스트 형태로 우선 읽어옵니다.
  const text = await response.text();
  let payload = null;
  
  // 응답 내용(text)이 존재하는 경우
  if (text) {
    try {
      // 응답이 JSON 형식이면 파싱하여 객체로 만듭니다.
      payload = JSON.parse(text);
    } catch {
      // JSON 파싱에 실패하면(예: 일반 텍스트 에러 메시지) 텍스트 자체를 message 속성에 담습니다.
      payload = { message: text };
    }
  }

  // HTTP 상태 코드가 200번대(성공)가 아닌 경우 에러를 발생시킵니다.
  if (!response.ok) {
    // 서버가 제공한 에러 메시지가 있으면 사용하고, 없다면 상태 코드와 기본 텍스트를 조합합니다.
    const error = new Error(payload?.message || `${response.status} ${response.statusText}`);
    error.status = response.status; // 디버깅 및 에러 핸들링을 위해 HTTP 상태 코드를 에러 객체에 기록
    error.payload = payload;        // 서버에서 응답한 전체 에러 payload를 기록
    throw error;
  }

  // 정상적으로 요청이 처리된 경우 파싱된 데이터를 반환합니다.
  return payload;
}

/**
 * 메인 버전 목록을 페이지네이션 및 검색 조건과 함께 조회합니다.
 * 
 * @param {string} keyword - 검색할 버전명 또는 관련 키워드 (기본값: 빈 문자열)
 * @param {number} page - 조회할 페이지 번호 (0부터 시작, 기본값: 0)
 * @param {number} size - 한 페이지당 표시할 항목 수 (기본값: 50)
 * @returns {Promise<any>} - 서버에서 반환하는 버전 목록 데이터
 */
export async function listMainVersions(keyword = "", page = 0, size = 50) {
  // URL 쿼리 파라미터를 구성합니다.
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: 'versionName,desc' // [수정됨] 백엔드에서 최신 버전명 기준 내림차순 정렬을 보장받기 위해 강제 주입,
  });
  
  // 검색 키워드가 존재하는 경우에만 쿼리 파라미터에 추가합니다.
  if (keyword) {
    params.set("keyword", keyword);
  }
  
  // GET 요청으로 버전 목록을 가져옵니다.
  return request(`/main-versions?${params.toString()}`);
}

/**
 * 새로운 메인 버전을 생성합니다.
 * 
 * @param {string} versionName - 생성할 메인 버전의 이름
 * @param {Object} payload - 버전에 포함될 추가 데이터 (기본값: 빈 객체)
 * @returns {Promise<any>} - 생성된 메인 버전 정보
 */
export async function createMainVersion(versionName, payload = {}) {
  // POST 요청을 통해 새 버전을 등록합니다.
  return request(`/main-versions`, {
    method: "POST",
    body: JSON.stringify({ versionName, ...payload }),
  });
}

/**
 * 특정 메인 버전에 서브 버전 1건을 등록하거나 수정(Upsert)합니다.
 * 상태 변경도 이 API를 통해 한 번에 처리됩니다.
 * 
 * @param {string} versionName - 메인 버전 이름
 * @param {string} code - 서브 버전 코드
 * @param {Object} payload - 업서트할 서브 버전의 세부 데이터
 * @returns {Promise<any>} - 처리 결과 응답
 */
export async function upsertSubVersion(versionName, code, payload) {
  return request(`/main-versions/${encodeURIComponent(versionName)}/sub-versions/${encodeURIComponent(code)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * 특정 메인 버전의 상세 정보를 조회합니다.
 * 
 * @param {string} versionName - 조회할 메인 버전의 이름
 * @returns {Promise<any>} - 메인 버전의 상세 데이터
 * @throws {Error} - 버전 이름이 누락된 경우 예외 발생
 */
export async function getMainVersionDetail(versionName) {
  if (!versionName) throw new Error("versionName is required");
  return request(`/main-versions/${encodeURIComponent(versionName)}`);
}

/**
 * 특정 메인 버전이 패키징 가능한 상태인지 검사합니다.
 * 
 * @param {string} versionName - 확인할 메인 버전 이름
 * @returns {Promise<any>} - 패키징 가능 여부 데이터
 * @throws {Error} - 버전 이름이 누락된 경우 예외 발생
 */
export async function getPackagingEligibility(versionName) {
  if (!versionName) throw new Error("versionName is required");
  return request(`/main-versions/${encodeURIComponent(versionName)}/packaging-eligibility`);
}

/**
 * 시스템 레지스트리의 상태(Health Check)가 정상인지 확인합니다.
 * 
 * @returns {Promise<any>} - 레지스트리 상태 정보
 */
export async function registryHealth() {
  // GET 요청으로 레지스트리 헬스 체크를 수행합니다.
  return request(`/health/registry`);
}

/**
 * OneDrive (SharePoint) 연동의 상태(Health Check)가 정상인지 확인합니다.
 * 
 * @returns {Promise<any>} - OneDrive 상태 정보
 */
export async function onedriveHealth() {
  // GET 요청으로 SharePoint 헬스 체크를 수행합니다.
  return request(`/health/sharepoint`);
}

/**
 * 메인 버전에 대한 패키징 작업을 신규로 생성하고 백그라운드 처리를 시작합니다.
 * 
 * @param {string} versionName - 패키징할 메인 버전 이름
 * @param {Object} body - 패키지 생성에 필요한 설정 값
 * @returns {Promise<any>} - 생성된 패키지 작업의 상태 정보
 */
export async function createPackageJob(versionName, body) {
  // POST 요청으로 서버에 패키징 처리를 트리거합니다.
  return request(`/main-versions/${encodeURIComponent(versionName)}/package-job`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * 시스템 내에 존재하는 패키지 작업 목록을 조건에 따라 조회합니다.
 * 
 * @param {string} [status] - (선택사항) 특정 상태의 작업만 필터링하기 위한 상태값 (예: 'running', 'completed')
 * @returns {Promise<any>} - 패키지 작업 목록 데이터
 */
export async function listPackageJobs(status) {
  const params = new URLSearchParams();
  // 상태값이 인자로 주어진 경우 쿼리 스트링에 필터를 추가합니다.
  if (status) params.set("status", status);
  
  // GET 요청으로 작업 목록을 반환받습니다.
  return request(`/package-jobs?${params.toString()}`);
}

/**
 * 특정 패키징 작업의 현재 진행 상태 및 상세 결과를 조회합니다.
 * 
 * @param {string} versionName - 작업이 진행 중인 메인 버전 이름
 * @returns {Promise<any>} - 패키징 작업 상세 상태
 * @throws {Error} - 버전 이름이 누락된 경우 예외 발생
 */
export async function getPackageJob(versionName) {
  // 필수 파라미터 검증
  if (!versionName) throw new Error("versionName is required");
  
  // GET 요청으로 현재 상태를 폴링(Polling)하거나 조회합니다.
  return request(`/package-jobs/${encodeURIComponent(versionName)}`);
}

/**
 * 실패했거나 중단된 패키징 작업을 재시작(Retry)합니다.
 * 
 * @param {string} versionName - 재시도할 패키징 작업의 메인 버전 이름
 * @param {Object} body - 재시도 시점에 넘겨야 하는 설정 값
 * @returns {Promise<any>} - 작업 재시작 결과
 */
export async function retryPackageJob(versionName, body) {
  // POST 요청을 통해 작업 재시도를 서버에 지시합니다.
  return request(`/package-jobs/${encodeURIComponent(versionName)}/retry`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}


/**
 * 기존 메인 버전의 기본 정보나 속성을 수정합니다.
 * 
 * @param {string} versionName - 수정할 메인 버전 이름
 * @param {Object} payload - 변경할 속성들의 데이터
 * @returns {Promise<any>} - 업데이트 처리 결과
 */
export async function updateMainVersion(versionName, payload) {
  // PUT 요청으로 지정된 리소스의 정보를 업데이트합니다.
  return request(`/main-versions/${encodeURIComponent(versionName)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * 시스템 내 불필요한 데이터를 삭제하는 관리자용 정리(Cleanup) 작업을 수행합니다.
 * 
 * @param {boolean} dryRun - 실제로 삭제하지 않고 삭제될 대상만 시뮬레이션으로 보여줄지 여부 (기본값: true)
 * @returns {Promise<any>} - 정리 작업 대상 혹은 실행 결과
 */
export async function runAdminCleanup(dryRun = true) {
  // POST 요청과 함께 dryRun 플래그를 넘겨 실수로 삭제되는 일을 방지합니다.
  return request(`/admin/cleanup?dryRun=${dryRun}`, {
    method: "POST",
  });
}

/**
 * 특정 메인 버전의 패키징 작업 이후 생성된 결과물 파일 목록을 조회합니다.
 * 
 * @param {string} versionName - 조회를 원하는 메인 버전 이름
 * @returns {Promise<any>} - 빌드 결과 파일들의 정보 목록
 */
export async function getPackageJobFiles(versionName) {
  // GET 요청으로 산출물 파일 리스트를 가져옵니다.
  return request(`/package-jobs/${encodeURIComponent(versionName)}/files`);
}

/**
 * 시스템에 등록된 특정 서브 버전을 완전히 삭제합니다.
 * 
 * @param {string} id - 삭제할 서브 버전의 고유 ID
 * @returns {Promise<any>} - 삭제 작업 성공 여부
 */
export async function deleteSubVersion(id) {
  // DELETE 요청을 사용하여 리소스를 영구적으로 제거합니다.
  return request(`/sub-versions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/**
 * 성공적으로 빌드/패키징이 완료된 패키지 산출물 자체를 서버 저장소에서 삭제합니다.
 * 
 * @param {string} versionName - 산출물을 삭제할 메인 버전 이름
 * @returns {Promise<any>} - 패키지 삭제 결과
 */
export async function deletePackage(versionName) {
  // DELETE 요청으로 해당 버전의 결과 패키지 파일을 제거합니다.
  return request(`/package-jobs/${encodeURIComponent(versionName)}/package`, {
    method: "DELETE",
  });
}
