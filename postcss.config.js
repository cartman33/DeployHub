// PostCSS 설정을 내보냅니다.
export default {
  // PostCSS에서 사용할 플러그인 목록을 정의합니다.
  plugins: {
    // Tailwind CSS를 컴파일하기 위한 플러그인입니다.
    tailwindcss: {},
    // 브라우저 호환성을 위해 CSS 속성에 벤더 프리픽스를 자동으로 추가하는 플러그인입니다.
    autoprefixer: {},
  },
}