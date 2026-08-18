// Vite 설정을 정의하기 위한 헬퍼 함수를 불러옵니다.
import { defineConfig } from 'vite'
// Vite에서 React를 지원하기 위한 플러그인을 불러옵니다.
import react from '@vitejs/plugin-react'

// Vite 설정 객체를 내보냅니다.
export default defineConfig({
  // React 플러그인을 활성화하여 JSX 및 React 관련 기능을 사용합니다.
  plugins: [react()],
  
  // 개발 서버 설정
  server: {
    // 외부 접속이 가능하도록 호스트를 모든 네트워크 인터페이스(0.0.0.0)로 설정합니다.
    host: '0.0.0.0',
    // API 요청을 다른 서버로 전달하기 위한 프록시 설정입니다.
    proxy: {
      '/api': {
        // [주의] 프록시 대상 IP가 하드코딩되어 있습니다. (.env 파일과 설정이 중복되므로 주의가 필요합니다.)
        target: 'http://223.130.132.72:8080',
        // 대상 서버의 호스트 헤더를 프록시 대상에 맞게 변경합니다.
        changeOrigin: true,
        // 대상 서버가 HTTPS가 아니므로 보안 검사를 비활성화합니다.
        secure: false,
      },
    },
  },
  
  // 프로덕션 빌드 미리보기(preview) 서버 설정
  preview: {
    // server 설정과 동일한 프록시 설정이 중복으로 정의되어 있습니다. 두 환경 모두 프록시가 필요하므로 유지합니다.
    proxy: {
      '/api': {
        // [주의] 프록시 대상 IP가 하드코딩되어 있습니다. (.env 파일과 설정이 중복되므로 주의가 필요합니다.)
        target: 'http://223.130.132.72:8080',
        // 대상 서버의 호스트 헤더를 프록시 대상에 맞게 변경합니다.
        changeOrigin: true,
        // 대상 서버가 HTTPS가 아니므로 보안 검사를 비활성화합니다.
        secure: false,
      },
    },
  },
})