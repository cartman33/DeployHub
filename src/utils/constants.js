/**
 * @file constants.js
 * @description 애플리케이션 전역에서 공유되는 상수(변하지 않는 고정값)들을 정의하는 파일입니다.
 *
 * [상수를 별도 파일로 분리한 이유]
 * - 여러 곳에서 같은 값을 쓸 때, "여기 있는 게 무조건 정답이야!(Single Source of Truth)" 라고 기준점을 만들어줍니다.
 * - 컴포넌트(화면 조각) 안쪽에 적어두면 화면이 깜빡(리렌더링)할 때마다 계속 새롭게 복사본을 찍어내서 전기가 낭비되지만,
 *   이렇게 바깥(모듈 최상위)에 빼두면 앱을 켤 때 딱 한 번만 만들고 두고두고 써서 아주 효율적이에요.
 * - 나중에 값을 바꿔야 할 때도 여기저기 숨바꼭질할 필요 없이 이 파일 하나만 고치면 끝이랍니다!
 */

/**
 * 배포 패키지 자동 수집 시스템에서 서브버전(APP)의 표준 표시 순서를 정의하는 배열입니다.
 *
 * @constant {string[]} SUBVERSION_ORDER
 *
 * ---
 * [자료구조: 배열(Array)을 선택한 이유]
 * - 단순 객체나 주머니(Set)도 넣은 순서를 기억하긴 하지만, "명확하게 줄을 세우는(정렬 기준)" 용도로는
 *   기차 칸처럼 순서대로 착착 들어있는 배열이 가장 직관적이고 다루기 쉽기 때문이에요.
 * - 표나 화면을 그릴 때 이 배열의 기차 칸 순서대로 줄을 세워 그립니다.
 *
 * [컴포넌트 바깥(모듈 스코프)에 꺼내둔 이유]
 * - 화면 조각(컴포넌트) 안에 놔두면 화면이 새로고침(리렌더링)될 때마다 똑같은 리스트를 계속 새로 찍어내요.
 * - 이렇게 맨 위에 꺼내두면 앱이 켜져있는 동안 내내 "처음에 만든 딱 하나"만 돌려쓰게 됩니다.
 * - 굳이 복잡한 기술(useMemo 등)을 쓰지 않아도 자연스럽게 튼튼한 금고(참조 안정성)에 보관되는 셈이에요.
 *
 * [Confluence 문서 표기 순서와 일치시킨 이유]
 * - 배포 현황 표가 회사 문서(Confluence)에 적혀있는 순서와 똑같아야
 *   담당자가 화면과 문서를 번갈아볼 때 헷갈리지 않고 편하게 일할 수 있어요.
 * - 순서를 바꿔야 한다면 회사 문서와 이 코드를 같이 수정해야 합니다.
 *
 * ---
 * [각 코드(서브버전)의 의미]
 *
 * @property {string} CC      - Control Center: 시스템 전체를 제어·관리하는 컨트롤 센터 모듈
 * @property {string} FOGGER  - 포거(Fogger) 모듈: 데이터 수집·처리를 담당하는 모듈
 * @property {string} SWG     - Switch Gateway(스위치게이트웨이): 네트워크 스위칭 및 게이트웨이 모듈
 * @property {string} STDAPI  - Standard API(표준 API): 외부 시스템 연동을 위한 표준화된 API 서버
 * @property {string} PIIDS   - PIIDS 서비스: 개인정보 식별·관리 서비스
 * @property {string} PIPS    - PIPS 서비스: PIPS 관련 처리 서비스
 * @property {string} CIDS    - CIDS 서비스: CIDS 관련 처리 서비스
 * @property {string} EXT     - External(외부 산출물): 외부에서 제공되는 산출물로 IMAGE TAG가 존재하지 않음.
 *                              ※ NCP Container Registry 자동 수집 대상이 아니므로 수동 처리가 필요합니다.
 * @property {string} OCR     - OCR 서비스: 광학 문자 인식(Optical Character Recognition) 서비스
 */
export const SUBVERSION_ORDER = ["CC", "FOGGER", "SWG", "STDAPI", "PIIDS", "PIPS", "CIDS", "EXT", "OCR"];
