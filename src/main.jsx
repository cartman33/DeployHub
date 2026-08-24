/**
 * @file main.jsx
 * @description 이 파일은 우리가 작성한 React 앱을 브라우저의 HTML 화면(index.html)에 연결하여 띄워주는 진입점(Entry Point) 역할을 합니다.
 *
 * 실행 흐름:
 *   index.html(빈 화면) → main.jsx(연결고리) → App.jsx(전체 레이아웃) → 각 화면 컴포넌트
 */

// 화면을 그리기 위해 필요한 React의 기본 도구들을 가져옵니다.
import React from 'react'

// 우리가 만든 화면을 인터넷 브라우저에 연결해 주는 도구입니다.
import ReactDOM from 'react-dom/client'

// 웹페이지의 가장 큰 틀(헤더, 메뉴 등)이 담겨있는 App 컴포넌트를 가져옵니다.
import { HtmlBody } from './app/App.jsx'

// 웹페이지를 예쁘게 꾸며주기 위한 전체 디자인(Tailwind CSS) 파일을 가져옵니다.
import './tailwind.css'

// HTML 파일(index.html) 안에서 이름이 'root'인 빈 상자를 찾은 다음, 
// 그 안에 우리가 만든 전체 화면(<HtmlBody />)을 쏙 집어넣어(렌더링) 줍니다.
ReactDOM.createRoot(document.getElementById('root')).render(
  // React.StrictMode: 개발 중에 혹시나 발생할 수 있는 숨은 에러를 찾아주기 위해 
  // 화면을 일부러 두 번씩 그려보는 안전장치입니다. (실제 서비스 배포 시에는 자동으로 꺼집니다)
  <React.StrictMode>
    {/* 앱의 전체 화면을 보여주는 최상위 컴포넌트입니다. */}
    <HtmlBody />
  </React.StrictMode>
)