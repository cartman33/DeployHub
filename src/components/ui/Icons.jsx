/**
 * @file Icons.jsx
 * @description SVG 아이콘 컴포넌트 모음 파일입니다.
 *              각 아이콘은 className prop을 받아 외부에서 크기/색상을 제어할 수 있습니다.
 *              React 18의 새로운 JSX Transform을 사용하므로 import React 구문이 불필요합니다.
 */

/**
 * 로켓 아이콘 - 배포(Deploy) 관련 UI에서 사용됩니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 * @usage App.jsx (헤더), deployer 대시보드, developer 페이지, layout 네비게이션
 */
export const RocketIcon = ({ className }) => (
  // SVG 컨테이너: viewBox 24x24 기준, stroke 기반 아이콘
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 로켓 하단부 불꽃 경로 */}
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.71-2.13.09-2.91a2.18 2.18 0 0 0-3.09-.09z" />
    {/* 로켓 본체 경로 */}
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    {/* 로켓 좌측 날개 경로 */}
    <path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3" />
    {/* 로켓 우측 날개 경로 */}
    <path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5" />
  </svg>
);

/**
 * [미사용] 대시보드 아이콘 - 4개의 사각형 격자 형태입니다.
 * @description 현재 App.jsx에서 import가 제거되어 직접 사용되는 곳이 없습니다.
 *              향후 대시보드 탭 추가 시 사용할 수 있어 보존합니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 */
export const DashboardIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 좌상단 사각형 */}
    <rect x="3" y="3" width="7" height="7" />
    {/* 우상단 사각형 */}
    <rect x="14" y="3" width="7" height="7" />
    {/* 우하단 사각형 */}
    <rect x="14" y="14" width="7" height="7" />
    {/* 좌하단 사각형 */}
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

/**
 * [미사용] 설정 아이콘 - 톱니바퀴(기어) 형태입니다.
 * @description 레거시 사이드바(ApplicationNavigationSection)에서만 import되며,
 *              해당 컴포넌트 자체가 현재 사용되지 않습니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 */
export const SettingsIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 톱니바퀴 외곽 경로 */}
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    {/* 중앙 원형 (설정 핵심 영역) */}
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * 코드 아이콘 - 꺾쇠 괄호(<>) 형태로, 개발자 모드를 나타냅니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 * @usage App.jsx (헤더 아이콘), developer 페이지, layout 네비게이션
 */
export const CodeIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 우측 꺾쇠 괄호 (>) */}
    <polyline points="16 18 22 12 16 6" />
    {/* 좌측 꺾쇠 괄호 (<) */}
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

/**
 * 체크 원형 아이콘 - 성공/완료 상태를 나타냅니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 * @usage deployer 대시보드 (배포 결과), developer 페이지 (등록 완료 모달)
 */
export const CheckCircleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 원형 배경 경로 */}
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    {/* 체크 표시 경로 */}
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

/**
 * [미사용] 경고 삼각형 아이콘 - 오류/경고 상태를 나타냅니다.
 * @description src/DeploymentPipelineDashboardSection.jsx(레거시)에서만 사용됩니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 */
export const AlertTriangleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 삼각형 외곽 경로 */}
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    {/* 느낌표 세로 획 */}
    <line x1="12" y1="9" x2="12" y2="13" />
    {/* 느낌표 점 */}
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/**
 * [미사용] 새로고침 아이콘 - 순환 화살표 형태입니다.
 * @description src/DeploymentPipelineDashboardSection.jsx(레거시)에서만 사용됩니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 */
export const RefreshIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 상단 반원 화살표 */}
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    {/* 상단 화살촉 */}
    <path d="M3 3v5h5" />
    {/* 하단 반원 화살표 */}
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    {/* 하단 화살촉 */}
    <path d="M16 16h5v5" />
  </svg>
);

/**
 * 복사 아이콘 - 클립보드 복사 기능에 사용됩니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 * @usage deployer 대시보드 (URL 복사 버튼)
 */
export const CopyIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 전면 문서 사각형 */}
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    {/* 후면 문서 경로 */}
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

/**
 * [미사용] 벨 아이콘 - 알림 기능에 사용됩니다.
 * @description App.jsx에서 import가 제거되어 현재 사용되는 곳이 없습니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 */
export const BellIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 벨 본체 */}
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    {/* 벨 하단 추 */}
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

/**
 * [미사용] 터미널 아이콘 - 커맨드 라인 인터페이스를 나타냅니다.
 * @description 프로젝트 내 어디에서도 사용되지 않습니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 */
export const TerminalIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 커서 꺾쇠 (>) 표시 */}
    <polyline points="4 17 10 11 4 5" />
    {/* 하단 밑줄 */}
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

/**
 * 재생 아이콘 - 패키징 시작 버튼에 사용됩니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 * @usage deployer 대시보드 (패키징 시작 버튼)
 */
export const PlayIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 삼각형 재생 버튼 */}
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

/**
 * 시계 아이콘 - 진행 중/로딩 상태에 사용됩니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 * @usage deployer 대시보드 (패키징 진행중 + 재시도 버튼)
 */
export const ClockIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 시계 외곽 원 */}
    <circle cx="12" cy="12" r="10" />
    {/* 시계 바늘 (시침+분침) */}
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/**
 * 셰브론 다운 아이콘 - 드롭다운 화살표에 사용됩니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 * @usage developer 페이지 (select 드롭다운 화살표)
 */
export const ChevronDownIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 아래쪽 화살표 꺾쇠 (∨) */}
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/**
 * 모니터 아이콘 - 매니페스트 확인 등 모니터링 UI에 사용됩니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 * @usage deployer 대시보드 (업데이트 버전 섹션 헤더)
 */
export const MonitorIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 모니터 화면 */}
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    {/* 모니터 받침대 가로선 */}
    <line x1="8" y1="21" x2="16" y2="21" />
    {/* 모니터 받침대 세로선 */}
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

/**
 * 리스트 아이콘 - 버전 목록 등 리스트 UI에 사용됩니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 * @usage deployer 대시보드 (현재 버전 헤더), developer 페이지 (메인버전 정보 설정)
 */
export const ListIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 리스트 항목 1 - 가로선 */}
    <line x1="8" y1="6" x2="21" y2="6" />
    {/* 리스트 항목 2 - 가로선 */}
    <line x1="8" y1="12" x2="21" y2="12" />
    {/* 리스트 항목 3 - 가로선 */}
    <line x1="8" y1="18" x2="21" y2="18" />
    {/* 리스트 항목 1 - 불릿 포인트 */}
    <line x1="3" y1="6" x2="3.01" y2="6" />
    {/* 리스트 항목 2 - 불릿 포인트 */}
    <line x1="3" y1="12" x2="3.01" y2="12" />
    {/* 리스트 항목 3 - 불릿 포인트 */}
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

/**
 * 장바구니 아이콘 - 패키징 장바구니 UI에 사용됩니다.
 * @param {{ className: string }} props - Tailwind CSS 클래스를 전달받습니다.
 * @usage deployer 대시보드 (패키징 장바구니 섹션)
 */
export const ShoppingCartIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 장바구니 좌측 바퀴 */}
    <circle cx="9" cy="21" r="1" />
    {/* 장바구니 우측 바퀴 */}
    <circle cx="20" cy="21" r="1" />
    {/* 장바구니 본체 및 손잡이 */}
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);
