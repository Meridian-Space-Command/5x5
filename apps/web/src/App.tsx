import React, { useMemo, useState } from 'react'

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
      </aside>
      <main style={{ flex: 1, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ aspectRatio: '1 / 1', border: `1px solid ${theme==='light'?'#999':'#444'}`, borderRadius: 8, padding: 12 }}>
              Loop {i+1}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}


