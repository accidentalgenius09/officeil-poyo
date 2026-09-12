import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { FinancePage } from './components/finance/FinancePage'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    <Toaster
      position="top-right"
      reverseOrder={false}
      toastOptions={{
        duration: 4500,
        className: 'app-toast',
        style: {
          maxWidth: '26rem',
          padding: '0.85rem 1rem',
          borderRadius: '14px',
          border: '1px solid var(--border-strong)',
          background: 'var(--surface-solid)',
          color: 'var(--ink)',
          boxShadow: 'var(--shadow)',
          fontSize: '0.92rem',
          lineHeight: '1.4',
        },
        error: {
          iconTheme: {
            primary: 'var(--danger)',
            secondary: 'var(--surface-solid)',
          },
        },
        success: {
          iconTheme: {
            primary: 'var(--brand)',
            secondary: 'var(--surface-solid)',
          },
        },
      }}
    />
  </StrictMode>,
)
