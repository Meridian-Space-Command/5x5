import React, { useCallback, useRef, useState } from 'react'
import { Room, createLocalAudioTrack } from 'livekit-client'

interface LoopState {
  joining: boolean
  joined: boolean
  micMuted: boolean
  audioMuted: boolean
  room: Room | null
}

export default function LoopGrid() {
  const [loops, setLoops] = useState<LoopState[]>([
    { joining: false, joined: false, micMuted: false, audioMuted: false, room: null },
    { joining: false, joined: false, micMuted: false, audioMuted: false, room: null },
    { joining: false, joined: false, micMuted: false, audioMuted: false, room: null },
    { joining: false, joined: false, micMuted: false, audioMuted: false, room: null },
    { joining: false, joined: false, micMuted: false, audioMuted: false, room: null },
    { joining: false, joined: false, micMuted: false, audioMuted: false, room: null },
  ])

  const joinLoop = useCallback(async (loopIndex: number) => {
    const loop = loops[loopIndex]
    if (loop.joining || loop.joined) return

    setLoops(prev => prev.map((l, i) => 
      i === loopIndex ? { ...l, joining: true } : l
    ))

    try {
      const identity = `user-${Math.random().toString(36).slice(2, 8)}`
      const roomName = `loop-${loopIndex + 1}-${Date.now()}`
      
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, identity })
      })
      const data = await resp.json()
      if (!data.token) throw new Error('no token')

      const room = new Room({
        autoReconnect: false,
        adaptiveStream: false,
      })
      
      const connectOptions = {
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      }
      
      await room.connect('ws://localhost:7880', data.token as string, connectOptions)

      // Publish mic to this loop
      const mic = await createLocalAudioTrack()
      await room.localParticipant.publishTrack(mic)

      setLoops(prev => prev.map((l, i) => 
        i === loopIndex ? { joining: false, joined: true, micMuted: false, audioMuted: false, room } : l
      ))
    } catch (e) {
      console.error(`Failed to join loop ${loopIndex + 1}:`, e)
      setLoops(prev => prev.map((l, i) => 
        i === loopIndex ? { ...l, joining: false } : l
      ))
    }
  }, [loops])

  const leaveLoop = useCallback(async (loopIndex: number) => {
    const loop = loops[loopIndex]
    if (!loop.room) return

    try {
      await loop.room.disconnect()
      setLoops(prev => prev.map((l, i) => 
        i === loopIndex ? { joining: false, joined: false, micMuted: false, audioMuted: false, room: null } : l
      ))
    } catch (e) {
      console.error(`Failed to leave loop ${loopIndex + 1}:`, e)
    }
  }, [loops])

  const toggleMic = useCallback(async (loopIndex: number) => {
    const loop = loops[loopIndex]
    if (!loop.room) return

    try {
      // Get the first audio track from the local participant
      const localParticipant = loop.room.localParticipant
      
      // Try different ways to access the audio track
      let audioTrack = null
      
      // Method 1: Check audioTracks collection
      if (localParticipant.audioTracks && localParticipant.audioTracks.size > 0) {
        audioTrack = Array.from(localParticipant.audioTracks.values())[0]
      }
      
      // Method 2: Check publishedTracks collection
      if (!audioTrack && localParticipant.publishedTracks && localParticipant.publishedTracks.size > 0) {
        const publishedTracks = Array.from(localParticipant.publishedTracks.values())
        audioTrack = publishedTracks.find(track => track.kind === 'audio')
      }
      
      // Method 3: Check trackPublications collection
      if (!audioTrack && localParticipant.trackPublications && localParticipant.trackPublications.size > 0) {
        const trackPublications = Array.from(localParticipant.trackPublications.values())
        audioTrack = trackPublications.find(track => track.kind === 'audio')
      }
      
      if (audioTrack && audioTrack.track) {
        const isMuted = audioTrack.track.isMuted
        // Use the correct LiveKit API method - mute/unmute instead of enable/disable
        if (isMuted) {
          await audioTrack.track.unmute()
          setLoops(prev => prev.map((l, i) => 
            i === loopIndex ? { ...l, micMuted: false } : l
          ))
          console.log(`Mic unmuted for loop ${loopIndex + 1}`)
        } else {
          await audioTrack.track.mute()
          setLoops(prev => prev.map((l, i) => 
            i === loopIndex ? { ...l, micMuted: true } : l
          ))
          console.log(`Mic muted for loop ${loopIndex + 1}`)
        }
      } else {
        console.log(`No audio tracks found for loop ${loopIndex + 1}. Available collections:`, {
          audioTracks: localParticipant.audioTracks?.size || 0,
          publishedTracks: localParticipant.publishedTracks?.size || 0,
          trackPublications: localParticipant.trackPublications?.size || 0
        })
      }
    } catch (e) {
      console.error(`Failed to toggle mic for loop ${loopIndex + 1}:`, e)
    }
  }, [loops])

  const toggleAudio = useCallback(async (loopIndex: number) => {
    const loop = loops[loopIndex]
    if (!loop.room) return

    // For now, just toggle the state - actual audio muting would require more complex audio mixing
    setLoops(prev => prev.map((l, i) => 
      i === loopIndex ? { ...l, audioMuted: !l.audioMuted } : l
    ))
    console.log(`Audio ${loop.audioMuted ? 'unmuted' : 'muted'} for loop ${loopIndex + 1}`)
  }, [loops])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {loops.map((loop, i) => (
        <div 
          key={i} 
          style={{ 
            aspectRatio: '1 / 1', 
            border: '1px solid #444', 
            borderRadius: 8, 
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: loop.joined ? '#2a4a2a' : '#333'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Loop {i + 1}</h3>
            <p style={{ margin: '4px 0', fontSize: 12, opacity: 0.7 }}>
              {loop.joining ? 'Joining...' : loop.joined ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
            {/* Join/Leave Button */}
            <button 
              onClick={() => loop.joined ? leaveLoop(i) : joinLoop(i)}
              disabled={loop.joining}
              style={{ 
                padding: '6px 4px', 
                fontSize: 10,
                backgroundColor: loop.joined ? '#6a2a2a' : '#4a4a4a',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: loop.joining ? 'not-allowed' : 'pointer'
              }}
            >
              {loop.joining ? '⏳' : loop.joined ? '⏹️' : '▶️'}
            </button>
            
            {/* Mic Mute/Unmute */}
            <button 
              onClick={() => toggleMic(i)}
              disabled={!loop.joined}
              style={{ 
                padding: '6px 4px', 
                fontSize: 10,
                backgroundColor: !loop.joined ? '#4a4a4a' : (loop.micMuted ? '#6a2a2a' : '#2a4a2a'),
                color: !loop.joined ? '#666' : 'white',
                border: 'none',
                borderRadius: 4,
                cursor: !loop.joined ? 'not-allowed' : 'pointer'
              }}
            >
              {loop.micMuted ? '🔇' : '🎤'}
            </button>
            
            {/* Audio Mute/Unmute */}
            <button 
              onClick={() => toggleAudio(i)}
              disabled={!loop.joined}
              style={{ 
                padding: '6px 4px', 
                fontSize: 10,
                backgroundColor: !loop.joined ? '#4a4a4a' : (loop.audioMuted ? '#6a2a2a' : '#2a4a2a'),
                color: !loop.joined ? '#666' : 'white',
                border: 'none',
                borderRadius: 4,
                cursor: !loop.joined ? 'not-allowed' : 'pointer'
              }}
            >
              {loop.audioMuted ? '🔇' : '🔊'}
            </button>
            
            {/* Chat Button (non-functional) */}
            <button 
              disabled
              style={{ 
                padding: '6px 4px', 
                fontSize: 10,
                backgroundColor: '#4a4a4a',
                color: '#666',
                border: 'none',
                borderRadius: 4,
                cursor: 'not-allowed'
              }}
            >
              💬
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
