//main.jsx는 웹브라우저가 화면을 띄우기 위해 가장 먼저 실행되는 엔트리 포인트 

//리액트 라이브러리 import 
import React from 'react'
//리액트 컴포넌트를 웹브라우저 DOM(HTML)에 랜더링하기 위한 도구 import 
import ReactDOM from 'react-dom/client'
//HtmlBody라고 명시된 컴포넌트를 App.jsx에서 import 
import { HtmlBody } from './app/App.jsx'
//HtmlBody라고 명시된 최상위 컴포넌트를 App.jsx에서 import
import './tailwind.css'
// HTML 문서에서 id가 'root'인 요소를 찾아 ReactDOM.createRoot()로 리액트 환경을 준비한 뒤, 그 안에 컴포넌트를 렌더링함
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HtmlBody />
  </React.StrictMode>
)