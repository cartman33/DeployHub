/**
 * @file Icons.jsx
 * @description 애플리케이션 전반에서 사용되는 모든 SVG 벡터 아이콘 컴포넌트를 모아 중앙 집중식으로 관리하는 모듈입니다.
 * 
 * [설계 원칙 및 아키텍처 가이드]
 * 1. 단일 책임 원칙 (Single Responsibility Principle):
 *    - 모든 SVG 그래픽 에셋을 별도 파일로 분산하지 않고 단일 파일에서 통합 관리하여
 *      아이콘의 일관성을 유지하고 유지보수성을 극대화합니다.
 * 2. 외부 스타일 제어 (Prop Interface):
 *    - 모든 아이콘 컴포넌트는 오직 `className` prop(string)만을 입력(Input)으로 받습니다.
 *    - 내부에서 고정 크기나 색상을 지정하지 않고, 외부에서 Tailwind CSS 클래스
 *      (예: `w-5 h-5 text-blue-600`)를 전달하여 크기·색상·애니메이션을 유연하게 제어합니다.
 * 3. React 18 JSX Transform:
 *    - React 18의 새로운 JSX Transform(`react/jsx-runtime`)을 사용하므로
 *      파일 상단에 명시적인 `import React from 'react'` 구문이 불필요합니다.
 * 4. SVG 공통 렌더링 속성 설명:
 *    - `viewBox="0 0 24 24"`: 가로 24px, 세로 24px 기준의 뷰포트 좌표계를 정의하여
 *      어떤 크기로 렌더링되어도 왜곡 없는 벡터 그래픽을 유지합니다.
 *    - `fill="none"`: 도형 내부 면을 채우지 않고 윤곽선(Stroke) 기반으로 렌더링합니다.
 *    - `stroke="currentColor"`: 부모 요소의 CSS `color` 속성값을 상속받아 선 색상을 결정하므로,
 *      Tailwind 텍스트 색상 클래스(`text-gray-500`, `text-indigo-600` 등)가 즉시 반영됩니다.
 *    - `strokeWidth="2"`: 선의 두께를 기준 좌표계 2단위로 균일하게 설정합니다.
 *    - `strokeLinecap="round"`: 선의 시작점과 끝점을 둥글게 마감하여 부드러운 인상을 줍니다.
 *    - `strokeLinejoin="round"`: 선이 만나는 모서리 연결 부위를 둥글게 다듬어 시각적 완성도를 높입니다.
 */

/**
 * 로켓 아이콘 컴포넌트
 * @description 배포(Deploy) 트리거, 배포 단계 화면 전환 등 배포 관련 주요 UI 및 네비게이션에 사용됩니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열 (크기, 색상, 마진 등)
 * @returns {JSX.Element} [Output] 24x24 기준의 로켓 모양 SVG 엘리먼트
 * @usage App.jsx (헤더 배포 모드 탭), deployer 대시보드, developer 페이지, layout 네비게이션
 */
export const RocketIcon = ({ className }) => (
  // SVG 컨테이너: 24x24 뷰포트 기준, 선 색상은 부모 텍스트 색상(currentColor) 상속
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 로켓 하단부 추진 불꽃 경로 */}
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.71-2.13.09-2.91a2.18 2.18 0 0 0-3.09-.09z" />
    {/* 로켓 본체(원뿔형 동체) 궤적 */}
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    {/* 로켓 좌측 보조 날개 */}
    <path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3" />
    {/* 로켓 우측 보조 날개 */}
    <path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5" />
  </svg>
);

/**
 * [미사용] 대시보드 아이콘 컴포넌트
 * @description 4개의 사각형 격자(Grid) 형태로 구성된 대시보드 아이콘입니다.
 *              현재 App.jsx 및 하위 뷰에서 직접 호출되지 않으나, 향후 메인 통합 대시보드 탭이나
 *              그리드 뷰 네비게이션 메뉴 확장 시 일관된 디자인 셋 유지를 위해 보존합니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 4분할 격자 대시보드 SVG 엘리먼트
 * @usage [미사용] 향후 대시보드 탭 메뉴 구현 시 재사용 예정
 */
export const DashboardIcon = ({ className }) => (
  // 4개의 7x7 사각형 격자로 대시보드 위젯 그리드를 형상화
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 좌상단 위젯 사각형 */}
    <rect x="3" y="3" width="7" height="7" />
    {/* 우상단 위젯 사각형 */}
    <rect x="14" y="3" width="7" height="7" />
    {/* 우하단 위젯 사각형 */}
    <rect x="14" y="14" width="7" height="7" />
    {/* 좌하단 위젯 사각형 */}
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

/**
 * [미사용] 설정 아이콘 컴포넌트
 * @description 회전하는 톱니바퀴(기어) 형태의 설정 아이콘입니다.
 *              레거시 사이드바(ApplicationNavigationSection) 리팩토링 후 현재 뷰에서 호출되지 않으나,
 *              향후 환경설정·시스템 파라미터 관리·사용자 설정 모달 개발 시 재사용하기 위해 보존합니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 톱니바퀴 형태의 SVG 엘리먼트
 * @usage [미사용] 향후 설정/환경구성 모달 메뉴에서 재사용 예정
 */
export const SettingsIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 톱니바퀴 외곽 돌기 및 궤적 (12방향 톱니 패턴) */}
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    {/* 기어 중앙 회전축 원 (중심 cx=12, cy=12, 반지름 r=3) */}
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * 코드 아이콘 컴포넌트
 * @description 꺾쇠 괄호(<>) 형태의 소스코드 태그 아이콘으로, 개발자 모드를 상징합니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 꺾쇠 괄호 형태의 코드 SVG 엘리먼트
 * @usage App.jsx (헤더 개발자 모드 탭), developer 페이지 (모듈 관리 헤더), layout 네비게이션
 */
export const CodeIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 우측 닫는 꺾쇠 괄호 (>) */}
    <polyline points="16 18 22 12 16 6" />
    {/* 좌측 여는 꺾쇠 괄호 (<) */}
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

/**
 * 체크 원형 아이콘 컴포넌트
 * @description 원형 테두리 내부에 체크 표시가 들어간 아이콘으로, 작업의 성공/완료/유효 상태를 나타냅니다.
 *              체크 표시는 (22,4) → (12,14.01) → (9,11.01) 좌표를 연결하는 폴리라인으로 구성됩니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 체크 완료 표시 원형 SVG 엘리먼트
 * @usage deployer 대시보드 (배포 성공/완료 상태 카드), developer 페이지 (모듈 등록 완료 모달)
 */
export const CheckCircleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 체크 마크와 겹치지 않도록 열려 있는 원형 외곽 호(Arc) 경로 */}
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    {/* 완료 체크 표시: (22,4) → (12,14.01) → (9,11.01) 좌표를 연결하는 폴리라인 */}
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

/**
 * [미사용] 경고 삼각형 아이콘 컴포넌트
 * @description 삼각형 테두리 내부에 느낌표가 위치한 경고/오류 알림 아이콘입니다.
 *              레거시 대시보드(DeploymentPipelineDashboardSection)에서 분리되었으며,
 *              향후 배포 실패 안내·유효성 검증 경고 배너·위험 작업 확인 모달 등에서 재사용하기 위해 보존합니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 삼각형 경고 SVG 엘리먼트
 * @usage [미사용] 향후 에러 알림 및 유효성 검증 경고 컴포넌트에서 재사용 예정
 */
export const AlertTriangleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 모서리가 둥근 경고 삼각형 외곽 테두리 */}
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    {/* 느낌표 상단 세로 직선 (x=12, y=9~13) */}
    <line x1="12" y1="9" x2="12" y2="13" />
    {/* 느낌표 하단 점 (x=12, y=17 / strokeLinecap="round"로 점 표현) */}
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/**
 * [미사용] 새로고침 아이콘 컴포넌트
 * @description 시계 방향으로 순환하는 두 개의 원형 화살표로 데이터 갱신 및 재조회를 상징합니다.
 *              레거시 대시보드에서 분리되었으며, 향후 배포 이력 새로고침·재시도 버튼 등에서 재사용하기 위해 보존합니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 순환 화살표 형태의 새로고침 SVG 엘리먼트
 * @usage [미사용] 향후 데이터 동기화 및 목록 새로고침 버튼에서 재사용 예정
 */
export const RefreshIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 상단 반원 궤적 곡선 */}
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    {/* 상단 화살촉 (좌측 상단으로 꺾임) */}
    <path d="M3 3v5h5" />
    {/* 하단 반원 궤적 곡선 */}
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    {/* 하단 화살촉 (우측 하단으로 꺾임) */}
    <path d="M16 16h5v5" />
  </svg>
);

/**
 * 복사 아이콘 컴포넌트
 * @description 두 장의 문서가 겹쳐진 형태로, 클립보드 복사(Copy to Clipboard) 기능을 나타냅니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 중첩 문서 형태의 복사 SVG 엘리먼트
 * @usage deployer 대시보드 (배포 완료 아티팩트 URL 및 SharePoint 주소 복사 버튼)
 */
export const CopyIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 전면에 위치한 둥근 사각형 문서 (x=9, y=9, 13x13 크기) */}
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    {/* 후면에 겹쳐진 문서의 노출된 외곽선 경로 */}
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

/**
 * [미사용] 벨 아이콘 컴포넌트
 * @description 알림(Notification) 및 이벤트 알람을 상징하는 종 형태의 아이콘입니다.
 *              현재 App.jsx 헤더 간소화로 인해 직접 사용되지 않으나,
 *              향후 배포 상태 변경 푸시 알림·실시간 이벤트 알림 센터 구현 시 재사용하기 위해 보존합니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 종 모양의 알림 SVG 엘리먼트
 * @usage [미사용] 향후 알림 센터 및 푸시 알림 드롭다운 메뉴에서 재사용 예정
 */
export const BellIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 종 본체 및 상단 고리 궤적 */}
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    {/* 종 하단 진동 추 (반원형 호) */}
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

/**
 * [미사용] 터미널 아이콘 컴포넌트
 * @description 명령줄 인터페이스(CLI) 및 콘솔 터미널 프롬프트를 나타냅니다.
 *              현재 직접 참조하는 화면은 없으나, 향후 서버 빌드 로그 스트리밍·
 *              터미널 콘솔 뷰어·스크립트 실행 제어창 구현 시 재사용하기 위해 보존합니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 터미널 프롬프트 SVG 엘리먼트
 * @usage [미사용] 향후 빌드 로그 뷰어 및 터미널 콘솔 UI에서 재사용 예정
 */
export const TerminalIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 커맨드라인 프롬프트 꺾쇠 화살표 (>) */}
    <polyline points="4 17 10 11 4 5" />
    {/* 프롬프트 입력 커서 밑줄 (_) */}
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

/**
 * 재생 아이콘 컴포넌트
 * @description 오른쪽 방향의 삼각형 모양으로 프로세스 시작 및 패키징 빌드 실행 트리거 버튼에 사용됩니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 삼각형 재생 SVG 엘리먼트
 * @usage deployer 대시보드 (패키징 시작 및 빌드 트리거 액션 버튼)
 */
export const PlayIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 세 꼭짓점 (5,3), (19,12), (5,21)을 연결한 우향 삼각형 폴리곤 */}
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

/**
 * 시계 아이콘 컴포넌트
 * @description 원형 테두리와 시계 바늘로 구성되어, 작업 진행 중(In-Progress)·로딩 대기 상태에 사용됩니다.
 *              시침·분침은 12시 방향(12,6)에서 중심(12,12)을 지나 2시 방향(16,14)으로 이어집니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 원형 시계 SVG 엘리먼트
 * @usage deployer 대시보드 (패키징 진행 중 스피너 상태 표시, 재시도 대기 버튼)
 */
export const ClockIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 시계 외곽 테두리 원 (중심 cx=12, cy=12, 반지름 r=10) */}
    <circle cx="12" cy="12" r="10" />
    {/* 12시 방향(12,6)에서 중심(12,12)을 거쳐 2시 방향(16,14)으로 이어지는 시침+분침 */}
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/**
 * 셰브론 다운 아이콘 컴포넌트
 * @description 아래쪽을 가리키는 꺾쇠 화살표(∨)로, 셀렉트 박스나 아코디언 드롭다운 펼침 상태를 나타냅니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 하향 꺾쇠 화살표 SVG 엘리먼트
 * @usage developer 페이지 (버전 선택·모듈 분류 등 셀렉트 드롭다운 화살표 표시)
 */
export const ChevronDownIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* (6,9) → 하단 중앙 (12,15) → (18,9)로 이어지는 아래쪽 V자 꺾쇠선 */}
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/**
 * 모니터 아이콘 컴포넌트
 * @description 디스플레이 모니터와 스탠드 형태로, 화면 표시·매니페스트 확인 등 모니터링 섹션을 나타냅니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 데스크톱 모니터 SVG 엘리먼트
 * @usage deployer 대시보드 (업데이트 버전 섹션 헤더 및 화면 모니터링 UI)
 */
export const MonitorIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 모니터 디스플레이 화면 패널 (모서리 둥근 사각형) */}
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    {/* 모니터 받침대 가로 바닥선 */}
    <line x1="8" y1="21" x2="16" y2="21" />
    {/* 화면 패널과 받침대를 연결하는 수직 기둥선 */}
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

/**
 * 리스트 아이콘 컴포넌트
 * @description 3개의 불릿 포인트와 가로 목록선으로 구성되어, 목록·버전 리스트·항목 관리를 나타냅니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 불릿 목록 형태의 리스트 SVG 엘리먼트
 * @usage deployer 대시보드 (현재 버전 목록 헤더), developer 페이지 (메인버전 정보 설정 테이블 헤더)
 */
export const ListIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 1행 텍스트 가로선 */}
    <line x1="8" y1="6" x2="21" y2="6" />
    {/* 2행 텍스트 가로선 */}
    <line x1="8" y1="12" x2="21" y2="12" />
    {/* 3행 텍스트 가로선 */}
    <line x1="8" y1="18" x2="21" y2="18" />
    {/* 1행 불릿 포인트 (strokeLinecap="round"로 점 형태 표현) */}
    <line x1="3" y1="6" x2="3.01" y2="6" />
    {/* 2행 불릿 포인트 */}
    <line x1="3" y1="12" x2="3.01" y2="12" />
    {/* 3행 불릿 포인트 */}
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

/**
 * 장바구니 아이콘 컴포넌트
 * @description 쇼핑 카트 모양의 아이콘으로, 배포 대상 모듈들을 담고 일괄 처리하는 패키징 장바구니 기능을 나타냅니다.
 * @param {Object} props - 컴포넌트 프로퍼티
 * @param {string} [props.className] - [Input] Tailwind CSS 클래스 문자열
 * @returns {JSX.Element} [Output] 쇼핑 카트 모양의 SVG 엘리먼트
 * @usage deployer 대시보드 (패키징 대상 모듈을 담는 패키징 장바구니 섹션 헤더)
 */
export const ShoppingCartIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 카트 앞바퀴 원 (cx=9, cy=21, r=1) */}
    <circle cx="9" cy="21" r="1" />
    {/* 카트 뒷바퀴 원 (cx=20, cy=21, r=1) */}
    <circle cx="20" cy="21" r="1" />
    {/* 카트 손잡이 및 바구니 본체 궤적 */}
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);
