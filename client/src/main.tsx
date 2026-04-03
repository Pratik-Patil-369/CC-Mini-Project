import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import ProblemList from './pages/ProblemList'
import ProblemSolver from './pages/ProblemSolver'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProblemList />} />
        <Route path="/problem/:id" element={<ProblemSolver />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
