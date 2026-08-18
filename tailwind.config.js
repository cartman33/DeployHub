/** @type {import('tailwindcss').Config} */
// Tailwind CSS 설정 객체를 내보냅니다.
module.exports = {
  // Tailwind 클래스가 사용될 파일들의 경로를 지정하여 사용되지 않는 CSS를 제거(Tree-shaking)합니다.
  content: [
    // HTML 진입점 파일입니다.
    "./index.html", 
    // src 폴더 내의 모든 자바스크립트 및 타입스크립트 파일들입니다.
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  // 프로젝트의 디자인 시스템 테마를 설정합니다.
  theme: {
    // 기본 테마를 확장하거나 덮어쓰기 위한 커스텀 설정을 추가할 수 있습니다.
    extend: {},
  },
  // Tailwind 기능을 확장할 외부 플러그인을 추가하는 배열입니다.
  plugins: [],
};