import React, { useMemo, useState } from 'react'
import LoopGrid from './LoopGrid'

type Theme = 'light' | 'dark'

export default function App() {
  const [theme, setTheme] = useState<Theme>('dark')
  const colors = useMemo(() => theme === 'light' ? {
    bg: '#cccccc', // 20% black
    fg: '#000000',
  } : {
    bg: '#333333', // 80% black
    fg: '#ffffff',
  }, [theme])

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Courier New, monospace', backgroundColor: colors.bg, color: colors.fg }}>
      <aside style={{ width: 240, borderRight: `1px solid ${theme==='light'?'#999':'#444'}`, padding: 12 }}>
        <div style={{ marginBottom: 12, fontWeight: 700 }}>5x5</div>
        <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>Toggle Theme</button>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Global Controls</div>
          <div style={{ marginTop: 8, fontSize: 11 }}>
            <div>Global Mic: <span style={{ color: '#4a9' }}>ON</span></div>
            <div>Volume: <span style={{ color: '#4a9' }}>75%</span></div>
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 12 }}>
        <LoopGrid />
      </main>
    </div>
  )
}


