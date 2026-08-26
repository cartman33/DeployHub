//백엔드 기본 주소 .env로 세팅 없으면 기본값 /api
const BASE_PATH = import.meta.env.VITE_API_BASE_URL || "/api";

//공동 통신 비동기 request 함수 

//path - 어떤 주소로? , options - get? post? 안에 무슨 데이터를 보낼지?
async function request(path, options = {}) {
  const defaultHeaders = {
    //보낼 형식은 json 형식
    "Content-Type": "application/json",
  };

  // 내장된 fetch 함수로 실제 서버에 요청을 보냄 
  const response = await fetch(`${BASE_PATH}${path}`, {
    ...options, //post나 get, body 등의 추가옵션을 전개 연산자로 덮어씌움
    headers: {
      ...defaultHeaders, //위에서 정의한 기본 헤더를 넣고 
      ...(options.headers || {}), //호출하는 쪽에서 헤더를 남기면 덮어씌우기 
    },
  });

  // 응답처리 결과는 순수한 text 형태로 먼저 읽어옴 
  const text = await response.text();
  let payload = null; //최종적으로 파싱된 데이터를 담을 변수 

  //응답 텍스트가 존재한다면 
  if (text) {
    try {
      payload = JSON.parse(text); //텍스트를 json으로 변환 
    } catch {
      payload = { message: text }; //json 형식이 아닌 일반 텍스트라면 객체 형태로 변경 => 단순히 텍스트 출력이 아닌 {} 형태로 객체형태로 담아서 출력 
    }
  }

  //실패 코드 ex) 잘못된 요청 400, 서버 에러 500 등 실패 코드를 보냈을때 
  //서버에서 준 에러 메시지가 없다면 에러 객체 생성후 상태, 상태 데이터를 조합한 객체 생성
  if (!response.ok) {
    const error = new Error(payload?.message || `${response.status} ${response.statusText}`);
    error.status = response.status; //에러 객체에 상태 저장
    error.payload = payload; //에러 객체에 상태 데이터 저장 
    throw error; //App.jsx에 에러를 catch로 던져서 처리 
  }

  // 성공한 통신이면 최종 데이터 반환
  return payload;
}

//메인버전 조회 GET 함수 
// 빈문자열, 0번째 페이지, 50개씩 비동기 함수로 전달 => app.js에선 20개씩 보여주는데 왜 다르냐? 이건 데이터를 가져오는것, app.js는 데이터를 보여주는 것이기 때문에 개수는 다를 수 있음 
export async function listMainVersions(keyword = "", page = 0, size = 50) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: 'versionName,desc' //버전명 내림차순 
  });
  
  //만약 검색어 입력시 ex) 2026 입력시 keyword가 2026인 것만 조회 
  if (keyword) {
    params.set("keyword", keyword);
  }
  
  //request에 전송 
  return request(`/main-versions?${params.toString()}`);
}

//메인 버전 생성 POST 함수 
export async function createMainVersion(versionName, payload = {}) {
  return request(`/main-versions`, {
    method: "POST", //데이터 생성이라 POST 
    //body는 versionName과 나머지 데이터를 합친 서버가 읽을 수 있는 Json형태의 string으로 전송 
    body: JSON.stringify({ versionName, ...payload }),
  });
}

//서브버전 생성 및 수정 PUT 함수 
export async function upsertSubVersion(versionName, code, payload) {
  //encodeURIComponent를 통해 versionName과 code를 URL로 안전하게 내보냄 ex) A/B/C 라면 A%2FB%2FC로 변환되어 서버에서 안전하게 보내짐
  return request(`/main-versions/${encodeURIComponent(versionName)}/sub-versions/${encodeURIComponent(code)}`, {
    method: "PUT",
    //Json형태의 string으로 전송 
    body: JSON.stringify(payload),
  });
}

//특정 메인 버전 상세 조회 GET 함수 
export async function getMainVersionDetail(versionName) {
  //versionName이 없을 경우 versionName is required 라는 에러 출력
  if (!versionName) throw new Error("versionName is required");
  //encdoeURIComponent로 안전하게 return 
  return request(`/main-versions/${encodeURIComponent(versionName)}`);
}

//패키징 가능 여부 확인 GET 함수 
export async function getPackagingEligibility(versionName) {
  if (!versionName) throw new Error("versionName is required");
  return request(`/main-versions/${encodeURIComponent(versionName)}/packaging-eligibility`);
}

//NCR 연결 상태 확인 GET 함수 
export async function registryHealth() {
  return request(`/health/registry`);
}

//Onedrive 연결 상태 확인 GET 함수 
export async function onedriveHealth() {
  return request(`/health/sharepoint`);
}

//패키징 작업 생성 및 실행 POST 함수 
export async function createPackageJob(versionName, body) {
  return request(`/main-versions/${encodeURIComponent(versionName)}/package-job`, {
    method: "POST",
    //Json형태의 string으로 전송 
    body: JSON.stringify(body),
  });
}

//패키징 작업 (Job) 전체 목록 조회 
//status = 작업 상태 
export async function listPackageJobs(status) {
  //빈상태로 생성 
  const params = new URLSearchParams();
  //만약 상태가 있다면 status에 추가 
  if (status) params.set("status", status);
  //?를 붙인 이유 : 뒤에 Status에 따라 조회가 달라지기 때문에 
  return request(`/package-jobs?${params.toString()}`);
}

//특정 패키징 작업 조회 GET 함수 
export async function getPackageJob(versionName) {
  //versionName 없으면 Error 출력 
  if (!versionName) throw new Error("versionName is required");
  return request(`/package-jobs/${encodeURIComponent(versionName)}`);
}

//패키징 작업 재시도 POST 함수 
export async function retryPackageJob(versionName, body) {
  //retry로 새로 다시 생성이기 떄문에 POST 방식 
  return request(`/package-jobs/${encodeURIComponent(versionName)}/retry`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

//메인 버전 정보 수정 PUT 함수 
export async function updateMainVersion(versionName, payload) {
  return request(`/main-versions/${encodeURIComponent(versionName)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

//관리자용 찌꺼기 청소 실행 POST 함수 = Job 관리 페이지에서 오래된 Job 일괄 정리 api
export async function runAdminCleanup(dryRun = true) {
  return request(`/admin/cleanup?dryRun=${dryRun}`, {
    method: "POST",
  });
}

//패키징 결과물 파일 목록 조회 GET 함수 
export async function getPackageJobFiles(versionName) {
  return request(`/package-jobs/${encodeURIComponent(versionName)}/files`);
}

//서브버전 삭제 DELETE 함수 
export async function deleteSubVersion(id) {
  //id를 encodeURIComponent로 안전하게 주소로 내보냄 
  return request(`/sub-versions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

//패키징 결과물 삭제 DELETE 함수 
export async function deletePackage(versionName) {
  return request(`/package-jobs/${encodeURIComponent(versionName)}/package`, {
    method: "DELETE",
  });
}
