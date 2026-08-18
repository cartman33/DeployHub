// React의 핵심 라이브러리를 불러옵니다.
import React from 'react'
// React 컴포넌트를 DOM에 렌더링하기 위한 클라이언트 메서드를 불러옵니다.
import ReactDOM from 'react-dom/client'
// 앱의 메인 레이아웃 및 진입점 역할을 하는 HtmlBody 컴포넌트를 불러옵니다.
import { HtmlBody } from './app/App.jsx'
// Tailwind CSS 스타일을 적용하기 위해 전역 CSS 파일을 불러옵니다.
import './tailwind.css'

// HTML의 'root' id를 가진 요소를 찾아 React 앱의 루트로 설정하고 렌더링합니다.
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode를 통해 개발 환경에서 잠재적인 문제를 감지하고 경고합니다.
  <React.StrictMode>
    {/* 앱의 메인 컨텐츠를 렌더링하는 컴포넌트입니다. */}
    <HtmlBody />
  </React.StrictMode>
)