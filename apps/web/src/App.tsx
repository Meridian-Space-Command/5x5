import React, { useMemo, useState } from 'react'
import LoopGrid from './LoopGrid'

type Theme = 'light' | 'dark'

export default function App() {
  const [theme, setTheme] = useState<Theme>('light')
  const [globalMicMuted, setGlobalMicMuted] = useState(false)
  const [globalAudioMuted, setGlobalAudioMuted] = useState(false)
  const [globalVideoEnabled, setGlobalVideoEnabled] = useState(true)
  const [dropAllVersion, setDropAllVersion] = useState(0)
  
  const colors = useMemo(() => theme === 'light' ? {
    bg: '#cccccc', // 20% black
    fg: '#000000',
  } : {
    bg: '#333333', // 80% black
    fg: '#ffffff',
  }, [theme])

  const globalBtnStyle = {
    width: 110,
    height: 32,
    padding: 0,
    fontSize: 12,
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center' as const,
    gap: 6,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Courier New, monospace', backgroundColor: colors.bg, color: colors.fg }}>
      {/* Title Bar */}
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: `1px solid ${theme==='light'?'#999':'#444'}`,
        backgroundColor: theme === 'light' ? '#e0e0e0' : '#2a2a2a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>5x5</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Global Mic Control */}
            <button
              onClick={() => setGlobalMicMuted(!globalMicMuted)}
              style={{
                ...globalBtnStyle,
                backgroundColor: globalMicMuted ? (theme === 'light' ? '#8a4a4a' : '#6a2a2a') : (theme === 'light' ? '#4a8a4a' : '#2a4a2a'),
              }}
            >
              {globalMicMuted ? '🔇' : '🎤'} {globalMicMuted ? 'Muted' : 'Mic'}
            </button>
            
            {/* Global Audio Control */}
            <button
              onClick={() => setGlobalAudioMuted(!globalAudioMuted)}
              style={{
                ...globalBtnStyle,
                backgroundColor: globalAudioMuted ? (theme === 'light' ? '#8a4a4a' : '#6a2a2a') : (theme === 'light' ? '#4a8a4a' : '#2a4a2a'),
              }}
            >
              {globalAudioMuted ? '🔇' : '🔊'} {globalAudioMuted ? 'Muted' : 'Audio'}
            </button>
            
            {/* Global Video Control */}
            <button
              onClick={() => setGlobalVideoEnabled(!globalVideoEnabled)}
              style={{
                ...globalBtnStyle,
                backgroundColor: globalVideoEnabled ? (theme === 'light' ? '#4a8a4a' : '#2a4a2a') : (theme === 'light' ? '#8a4a4a' : '#6a2a2a'),
              }}
            >
              {globalVideoEnabled ? '📹' : '📷'} {globalVideoEnabled ? 'Video' : 'Off'}
            </button>

            {/* Drop All Loops */}
            <button
              onClick={() => setDropAllVersion(v => v + 1)}
              style={{
                ...globalBtnStyle,
                backgroundColor: theme === 'light' ? '#8a4a4a' : '#6a2a2a',
              }}
            >
              ⏹️ Drop All
            </button>
          </div>
        </div>
        <button 
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            backgroundColor: theme === 'light' ? '#333' : '#666',
            color: theme === 'light' ? '#fff' : '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Toggle Theme
        </button>
      </header>
      
      {/* Main Content */}
      <main style={{ flex: 1, padding: 12, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <LoopGrid 
          theme={theme} 
          colors={colors}
          globalMicMuted={globalMicMuted}
          globalAudioMuted={globalAudioMuted}
          globalVideoEnabled={globalVideoEnabled}
          dropAllVersion={dropAllVersion}
        />
      </main>
    </div>
  )
}


