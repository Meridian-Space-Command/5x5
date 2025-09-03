import React, { useCallback, useRef, useState, useEffect } from 'react'
import { Room, createLocalAudioTrack, createLocalVideoTrack } from 'livekit-client'

interface ChatMessage {
  id: string
  senderId: string
  senderLabel: string
  text: string
  ts: number
}

interface LoopState {
  joining: boolean
  joined: boolean
  micMuted: boolean
  audioMuted: boolean
  videoEnabled: boolean
  room: Room | null
  videoTrack: any | null
  roomName?: string
  identity?: string
  chatInput?: string
  messages?: ChatMessage[]
  participants: Map<string, any> // Track remote participants
}

interface LoopGridProps {
  theme: 'light' | 'dark'
  colors: {
    bg: string
    fg: string
  }
  globalMicMuted: boolean
  globalAudioMuted: boolean
  globalVideoEnabled: boolean
  dropAllVersion: number
}

export default function LoopGrid({ theme, colors, globalMicMuted, globalAudioMuted, globalVideoEnabled, dropAllVersion }: LoopGridProps) {
  const [loops, setLoops] = useState<LoopState[]>([
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null, messages: [], chatInput: '', participants: new Map() },
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null, messages: [], chatInput: '', participants: new Map() },
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null, messages: [], chatInput: '', participants: new Map() },
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null, messages: [], chatInput: '', participants: new Map() },
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null, messages: [], chatInput: '', participants: new Map() },
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null, messages: [], chatInput: '', participants: new Map() },
  ])
  const [activeChatLoop, setActiveChatLoop] = useState<number | null>(null)
  const converseInitializedRef = useRef(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const joinLoop = useCallback(async (loopIndex: number) => {
    const loop = loops[loopIndex]
    if (loop.joining || loop.joined) return

    setLoops(prev => prev.map((l, i) => 
      i === loopIndex ? { ...l, joining: true } : l
    ))

    try {
      const identity = `user-${Math.random().toString(36).slice(2, 8)}`
      const roomName = `loop-${loopIndex + 1}`
      
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

      // Publish mic and video to this loop
      const mic = await createLocalAudioTrack()
      const video = await createLocalVideoTrack()
      
      // Publish tracks and wait for them to be ready
      const micPublication = await room.localParticipant.publishTrack(mic)
      const videoPublication = await room.localParticipant.publishTrack(video)
      
      // Wait a moment for tracks to be properly registered
      await new Promise(resolve => setTimeout(resolve, 100))

      // Wire up data channel listener for chat
      room.on('dataReceived', (payload: Uint8Array, participant, kind, topic) => {
        try {
          const text = new TextDecoder().decode(payload)
          const msg = JSON.parse(text) as ChatMessage
          setLoops(prev => prev.map((l) => {
            if (l.room === room) {
              const messages = Array.isArray(l.messages) ? l.messages : []
              return { ...l, messages: [...messages, msg] }
            }
            return l
          }))
        } catch (e) {
          console.log('Failed to parse chat message', e)
        }
      })

      // Track participants joining/leaving
      room.on('participantConnected', (participant) => {
        setLoops(prev => prev.map((l) => {
          if (l.room === room) {
            const newParticipants = new Map(l.participants)
            newParticipants.set(participant.identity, participant)
            return { ...l, participants: newParticipants }
          }
          return l
        }))
      })

      room.on('participantDisconnected', (participant) => {
        setLoops(prev => prev.map((l) => {
          if (l.room === room) {
            const newParticipants = new Map(l.participants)
            newParticipants.delete(participant.identity)
            return { ...l, participants: newParticipants }
          }
          return l
        }))
      })

      setLoops(prev => prev.map((l, i) => 
        i === loopIndex ? { joining: false, joined: true, micMuted: false, audioMuted: false, videoEnabled: true, room, videoTrack: video, roomName, identity, messages: [], chatInput: '', participants: new Map() } : l
      ))

      // Attach video stream to the video element after state update
      setTimeout(() => {
        const videoElement = document.getElementById(`local-video-${loopIndex}`) as HTMLVideoElement
        console.log(`Looking for video element: local-video-${loopIndex}`, videoElement)
        console.log(`Video track:`, video.track)
        
        if (videoElement && video.mediaStream) {
          videoElement.srcObject = video.mediaStream
          console.log(`Video stream attached to element for loop ${loopIndex + 1}`, video.mediaStream)
          
          // Force play the video
          videoElement.play().catch(e => console.log('Video play error:', e))
        } else {
          console.log(`Failed to attach video - element: ${!!videoElement}, mediaStream: ${!!video.mediaStream}`)
          console.log(`Video object:`, video)
        }
      }, 200)
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
      
      // Chat cleanup (no external chat service to close)
      
      // Clear active chat if this was the active loop
      if (activeChatLoop === loopIndex) {
        setActiveChatLoop(null)
      }
      
      setLoops(prev => prev.map((l, i) => 
        i === loopIndex ? { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null, roomName: l.roomName, messages: [], chatInput: '', identity: l.identity, participants: new Map() } : l
      ))
    } catch (e) {
      console.error(`Failed to leave loop ${loopIndex + 1}:`, e)
    }
  }, [loops, activeChatLoop])

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

  const toggleVideo = useCallback(async (loopIndex: number) => {
    const loop = loops[loopIndex]
    if (!loop.room) return

    try {
      // Use the stored video track if available
      if (loop.videoTrack) {
        const isMuted = loop.videoTrack.isMuted
        
        if (isMuted) {
          await loop.videoTrack.unmute()
          setLoops(prev => prev.map((l, i) => 
            i === loopIndex ? { ...l, videoEnabled: true } : l
          ))
          console.log(`Video enabled for loop ${loopIndex + 1}`)
          
          // Re-attach video stream to elements after unmuting
          setTimeout(() => {
            const videoElement = document.getElementById(`local-video-${loopIndex}`) as HTMLVideoElement
            if (videoElement && loop.videoTrack.mediaStream) {
              videoElement.srcObject = loop.videoTrack.mediaStream
              videoElement.play().catch(e => console.log('Video play error after unmute:', e))
              console.log(`Video stream re-attached after unmute for loop ${loopIndex + 1}`)
            }
            
            // Also update chat video if this is the active chat loop
            if (activeChatLoop === loopIndex) {
              const chatVideoElement = document.getElementById(`chat-video-${loopIndex}`) as HTMLVideoElement
              if (chatVideoElement && loop.videoTrack.mediaStream) {
                chatVideoElement.srcObject = loop.videoTrack.mediaStream
                chatVideoElement.play().catch(e => console.log('Chat video play error after unmute:', e))
                console.log(`Chat video stream re-attached after unmute for loop ${loopIndex + 1}`)
              }
            }
          }, 100)
        } else {
          await loop.videoTrack.mute()
          setLoops(prev => prev.map((l, i) => 
            i === loopIndex ? { ...l, videoEnabled: false } : l
          ))
          console.log(`Video disabled for loop ${loopIndex + 1}`)
        }
      } else {
        // If no video track stored, try to get from published tracks
        const localParticipant = loop.room.localParticipant
        const videoTracks = localParticipant.videoTracks
        
        if (videoTracks && videoTracks.size > 0) {
          const videoTrack = Array.from(videoTracks.values())[0]
          const isMuted = videoTrack.track.isMuted
          
          if (isMuted) {
            await videoTrack.track.unmute()
            setLoops(prev => prev.map((l, i) => 
              i === loopIndex ? { ...l, videoEnabled: true, videoTrack: videoTrack.track } : l
            ))
            console.log(`Video enabled for loop ${loopIndex + 1}`)
          } else {
            await videoTrack.track.mute()
            setLoops(prev => prev.map((l, i) => 
              i === loopIndex ? { ...l, videoEnabled: false, videoTrack: videoTrack.track } : l
            ))
            console.log(`Video disabled for loop ${loopIndex + 1}`)
          }
        } else {
          console.log(`No video tracks found for loop ${loopIndex + 1}`)
        }
      }
    } catch (e) {
      console.error(`Failed to toggle video for loop ${loopIndex + 1}:`, e)
    }
  }, [loops, activeChatLoop])

  // Effect to attach video streams to video elements when they become available
  const prevVideoTracksRef = useRef<(any | null)[]>([])
  useEffect(() => {
    loops.forEach((loop, i) => {
      if (loop.joined && loop.videoTrack && loop.videoEnabled) {
        const prevTrack = prevVideoTracksRef.current[i]
        // Only re-attach if the video track actually changed
        if (prevTrack === loop.videoTrack) return
        prevVideoTracksRef.current[i] = loop.videoTrack
        
        const videoElement = document.getElementById(`local-video-${i}`) as HTMLVideoElement
        if (videoElement) {
          console.log(`Attaching video stream to element ${i} via useEffect`)
          console.log(`Video track object:`, loop.videoTrack)
          
          // The videoTrack is a LiveKit LocalVideoTrack object, we can use its mediaStream property
          if (loop.videoTrack.mediaStream) {
            videoElement.srcObject = loop.videoTrack.mediaStream
            videoElement.play().catch(e => console.log('Video play error:', e))
            console.log(`Video stream attached successfully for loop ${i}`)
          } else {
            console.log(`No media stream found for loop ${i}`)
          }
        }
      }
    })
  }, [loops])

  // Attach selected loop's video to the chat panel video when chat is opened
  // Attach video to chat pane only when loop/video changes, not on every keystroke
  const prevVideoRefs = useRef<(any | null)[]>([])
  const prevActiveChatLoop = useRef<number | null>(null)
  useEffect(() => {
    if (activeChatLoop == null) return
    const loop = loops[activeChatLoop]
    
    // Always update when activeChatLoop changes, or when video track changes
    const shouldUpdate = prevActiveChatLoop.current !== activeChatLoop || 
                        (loop.videoTrack && prevVideoRefs.current[activeChatLoop] !== loop.videoTrack)
    
    if (!shouldUpdate) return
    
    prevActiveChatLoop.current = activeChatLoop
    if (loop.videoTrack) {
      prevVideoRefs.current[activeChatLoop] = loop.videoTrack
    }
    
    const el = document.getElementById(`chat-video-${activeChatLoop}`) as HTMLVideoElement | null
    if (el) {
      if (loop.videoTrack && loop.videoEnabled && loop.videoTrack.mediaStream) {
        el.srcObject = loop.videoTrack.mediaStream
        el.play().catch(() => {})
        console.log(`Chat video updated for loop ${activeChatLoop + 1} - video enabled`)
      } else {
        // Don't clear the video element - the placeholder will be shown instead
        console.log(`Chat video placeholder shown for loop ${activeChatLoop + 1} - video disabled`)
      }
    }
  }, [activeChatLoop, loops])

  // Auto-scroll to bottom when new messages arrive in active chat
  useEffect(() => {
    if (activeChatLoop == null) return
    const container = document.getElementById('chat-scroll')
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [activeChatLoop, loops[activeChatLoop!]?.messages])

  // Apply global controls to all loops
  useEffect(() => {
    setLoops(prev => prev.map(loop => {
      if (loop.joined && loop.room) {
        const localParticipant = loop.room.localParticipant
        
        // Apply global mic mute to audio tracks
        const audioTracks = localParticipant.audioTracks
        if (audioTracks && audioTracks.size > 0) {
          const audioTrack = Array.from(audioTracks.values())[0]
          if (globalMicMuted && !audioTrack.track.isMuted) {
            audioTrack.track.mute().catch(console.error)
          } else if (!globalMicMuted && audioTrack.track.isMuted) {
            audioTrack.track.unmute().catch(console.error)
          }
        }
        
        // Apply global video toggle to video tracks
        if (loop.videoTrack) {
          if (!globalVideoEnabled && !loop.videoTrack.isMuted) {
            loop.videoTrack.mute().catch(console.error)
          } else if (globalVideoEnabled && loop.videoTrack.isMuted) {
            loop.videoTrack.unmute().catch(console.error)
          }
        }
        
        return {
          ...loop,
          micMuted: globalMicMuted,
          audioMuted: globalAudioMuted,
          videoEnabled: globalVideoEnabled
        }
      }
      return loop
    }))
  }, [globalMicMuted, globalAudioMuted, globalVideoEnabled])

  // Ensure video tracks are present and attached when global video is enabled
  useEffect(() => {
    const enableAllVideos = async () => {
      if (!globalVideoEnabled) return
      // For each joined loop, ensure a live video track and attach to element
      for (let i = 0; i < loops.length; i++) {
        const loop = loops[i]
        if (!loop.joined || !loop.room) continue
        try {
          let videoTrack = loop.videoTrack
          if (!videoTrack || videoTrack.isMuted || !videoTrack.mediaStream) {
            // (Re)create track and publish
            const newTrack = await createLocalVideoTrack()
            await loop.room.localParticipant.publishTrack(newTrack)
            videoTrack = newTrack
            // store
            setLoops(prev => prev.map((l, idx) => idx === i ? { ...l, videoTrack: newTrack, videoEnabled: true } : l))
          }
          // Attach to element
          const el = document.getElementById(`local-video-${i}`) as HTMLVideoElement | null
          if (el && videoTrack.mediaStream) {
            el.srcObject = videoTrack.mediaStream
            // play
            el.play().catch(() => {})
          }
        } catch (e) {
          console.log('Failed ensuring video for loop', i + 1, e)
        }
      }
    }
    enableAllVideos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalVideoEnabled])

  // Drop all loops when dropAllVersion changes
  useEffect(() => {
    const dropAll = async () => {
      const anyWindow = window as any
      
      for (let i = 0; i < loops.length; i++) {
        const loop = loops[i]
        if (loop.room) {
          try {
            await loop.room.disconnect()
            
            // Chat cleanup (no external chat service to close)
          } catch {}
        }
      }
      
      // Clear active chat
      setActiveChatLoop(null)
      setLoops(prev => prev.map(l => ({ joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null, participants: new Map() })))
    }
    dropAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropAllVersion])

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (activeChatLoop !== null && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [loops[activeChatLoop]?.messages, activeChatLoop])

  // Dynamic video grid component
  const renderVideoGrid = (loopIndex: number) => {
    const loop = loops[loopIndex]
    if (!loop || !loop.joined || !loop.room) return null

    const allParticipants = Array.from(loop.participants.values())
    const localParticipant = loop.room.localParticipant
    const totalVideos = allParticipants.length + 1 // +1 for local participant

    // Calculate grid layout based on number of participants
    let gridStyle: React.CSSProperties = {}
    
    if (totalVideos === 1) {
      // Single video fills the space
      gridStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    } else if (totalVideos === 2) {
      // Two videos side by side
      gridStyle = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr',
        gap: 4
      }
    } else if (totalVideos === 3) {
      // One centered at top, two side by side underneath
      gridStyle = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 4
      }
    } else if (totalVideos === 4) {
      // 2x2 grid
      gridStyle = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 4
      }
    } else if (totalVideos <= 6) {
      // 3x2 grid
      gridStyle = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 4
      }
    } else {
      // 3x3 grid for more participants
      gridStyle = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr 1fr',
        gap: 4
      }
    }

    return (
      <div style={{...gridStyle, height: '100%'}}>
        {/* Local participant video */}
        <div style={{ 
          position: 'relative', 
          backgroundColor: theme === 'light' ? '#ddd' : '#222', 
          borderRadius: 4, 
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {loop.videoEnabled && loop.videoTrack ? (
            <video 
              id={`chat-video-${loopIndex}`} 
              autoPlay 
              muted 
              playsInline 
              style={{ 
                height: '100%', 
                width: 'auto',
                maxWidth: '100%',
                objectFit: 'contain' 
              }} 
            />
          ) : (
            <div style={{ 
              height: '100%', 
              width: 'auto',
              maxWidth: '100%',
              aspectRatio: '16/9',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              backgroundColor: theme === 'light' ? '#bbb' : '#333',
              color: theme === 'light' ? '#666' : '#999',
              fontSize: 24
            }}>
              📷
            </div>
          )}
          <div style={{ 
            position: 'absolute', 
            bottom: 4, 
            left: 4, 
            background: 'rgba(0,0,0,0.7)', 
            color: 'white', 
            padding: '2px 6px', 
            borderRadius: 4, 
            fontSize: 10 
          }}>
            {localParticipant.identity} (You)
          </div>
        </div>

        {/* Remote participant videos */}
        {allParticipants.map((participant, index) => {
          const videoTrack = Array.from(participant.videoTracks.values())[0]?.track
          return (
            <div key={participant.identity} style={{ 
              position: 'relative', 
              backgroundColor: theme === 'light' ? '#ddd' : '#222', 
              borderRadius: 4, 
              overflow: 'hidden',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {videoTrack ? (
                <video 
                  autoPlay 
                  playsInline 
                  ref={(el) => {
                    if (el && videoTrack.mediaStream) {
                      el.srcObject = videoTrack.mediaStream
                    }
                  }}
                  style={{ 
                    height: '100%', 
                    width: 'auto',
                    maxWidth: '100%',
                    objectFit: 'contain' 
                  }} 
                />
              ) : (
                <div style={{ 
                  width: '100%', 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: '#333',
                  color: '#666',
                  fontSize: 12
                }}>
                  📷
                </div>
              )}
              <div style={{ 
                position: 'absolute', 
                bottom: 4, 
                left: 4, 
                background: 'rgba(0,0,0,0.7)', 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: 4, 
                fontSize: 10 
              }}>
                {participant.identity}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gridTemplateRows: '1fr 1fr 1fr', 
      gap: 12, 
      width: '100%', 
      height: '100%',
      minHeight: 0,
      flex: 1
    }}>
      {/* Left: Loop list (spans all 3 rows) */}
      <div style={{ 
        gridColumn: '1', 
        gridRow: '1 / 4', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 8,
        minHeight: 0
      }}>
      {loops.map((loop, i) => (
        <div 
          key={i} 
          style={{ 
            border: `1px solid ${theme === 'light' ? '#999' : '#444'}`, 
            borderRadius: 8, 
            padding: 6,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 62,
            backgroundColor: loop.joining
              ? (theme === 'light' ? '#bfbf4a' : '#8a8a2a')
              : (loop.joined
                ? (theme === 'light' ? '#4a8a4a' : '#2a4a2a')
                : (theme === 'light' ? '#e0e0e0' : '#333'))
          }}
        >
          {/* Left: name + thumbnail inline */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 220, flex: '1 1 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Loop {i + 1}</h3>
            </div>
            <div style={{ width: 56, height: 56 }}>
              {loop.joined && (
                <div style={{ 
                  width: '100%', 
                  height: '100%', 
                  backgroundColor: '#222', 
                  borderRadius: 4, 
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <video
                    id={`local-video-${i}`}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  {!loop.videoEnabled && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: '#333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      color: '#666'
                    }}>
                      📷
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Right: controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 32px)', gap: 4 }}>
            {/* Join/Leave Button */}
            <button 
              onClick={() => loop.joined ? leaveLoop(i) : joinLoop(i)}
              disabled={loop.joining}
              style={{ 
                width: 32,
                height: 32,
                padding: 0, 
                fontSize: 12,
                backgroundColor: loop.joined ? (theme === 'light' ? '#8a4a4a' : '#6a2a2a') : (theme === 'light' ? '#999' : '#4a4a4a'),
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
                width: 32,
                height: 32,
                padding: 0, 
                fontSize: 12,
                backgroundColor: !loop.joined ? (theme === 'light' ? '#999' : '#4a4a4a') : (loop.micMuted ? (theme === 'light' ? '#8a4a4a' : '#6a2a2a') : (theme === 'light' ? '#4a8a4a' : '#2a4a2a')),
                color: !loop.joined ? (theme === 'light' ? '#666' : '#666') : 'white',
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
                width: 32,
                height: 32,
                padding: 0, 
                fontSize: 12,
                backgroundColor: !loop.joined ? (theme === 'light' ? '#999' : '#4a4a4a') : (loop.audioMuted ? (theme === 'light' ? '#8a4a4a' : '#6a2a2a') : (theme === 'light' ? '#4a8a4a' : '#2a4a2a')),
                color: !loop.joined ? (theme === 'light' ? '#666' : '#666') : 'white',
                border: 'none',
                borderRadius: 4,
                cursor: !loop.joined ? 'not-allowed' : 'pointer'
              }}
            >
              {loop.audioMuted ? '🔇' : '🔊'}
            </button>
            
            {/* Video Toggle Button */}
            <button 
              onClick={() => toggleVideo(i)}
              disabled={!loop.joined}
              style={{ 
                width: 32,
                height: 32,
                padding: 0, 
                fontSize: 12,
                backgroundColor: !loop.joined ? (theme === 'light' ? '#999' : '#4a4a4a') : (loop.videoEnabled ? (theme === 'light' ? '#4a8a4a' : '#2a4a2a') : (theme === 'light' ? '#8a4a4a' : '#6a2a2a')),
                color: !loop.joined ? (theme === 'light' ? '#666' : '#666') : 'white',
                border: 'none',
                borderRadius: 4,
                cursor: !loop.joined ? 'not-allowed' : 'pointer'
              }}
            >
              {loop.videoEnabled ? '📹' : '📷'}
            </button>

            {/* Chat Toggle Button */}
            <button 
              onClick={() => setActiveChatLoop(prev => prev === i ? null : i)}
              disabled={!loop.joined}
              style={{ 
                width: 32,
                height: 32,
                padding: 0, 
                fontSize: 12,
                backgroundColor: !loop.joined ? (theme === 'light' ? '#999' : '#4a4a4a') : (activeChatLoop === i ? (theme === 'light' ? '#4a8a8a' : '#2a4a4a') : (theme === 'light' ? '#999' : '#4a4a4a')),
                color: !loop.joined ? (theme === 'light' ? '#666' : '#666') : 'white',
                border: 'none',
                borderRadius: 4,
                cursor: !loop.joined ? 'not-allowed' : 'pointer'
              }}
            >
              💬
            </button>
          </div>
        </div>
      ))}
      </div>

      {/* Right: Video grid (top row) */}
      {activeChatLoop != null && (
        <div style={{ 
          gridColumn: '2', 
          gridRow: '1',
          backgroundColor: theme === 'light' ? '#ddd' : '#222', 
          borderRadius: 8, 
          overflow: 'hidden', 
          padding: 4,
          minHeight: 0
        }}>
          {renderVideoGrid(activeChatLoop)}
        </div>
      )}

      {/* Right: Chat area (spans bottom 2 rows) */}
      {activeChatLoop != null && (
        <div style={{ 
          gridColumn: '2', 
          gridRow: '2 / 4',
          display: 'flex', 
          flexDirection: 'column', 
          border: `1px solid ${theme === 'light' ? '#999' : '#444'}`, 
          borderRadius: 8, 
          overflow: 'hidden',
          minHeight: 0
        }}>
              <div style={{ fontSize: 12, opacity: 0.7, padding: '8px 8px 4px 8px', background: theme === 'light' ? '#f2f2f2' : '#1e1e1e', borderBottom: `1px solid ${theme === 'light' ? '#ccc' : '#333'}` }}>
                Chat for Loop {activeChatLoop + 1}
              </div>
              <div ref={chatScrollRef} id="chat-scroll" style={{ 
                flex: 1, 
                padding: 8, 
                background: theme === 'light' ? '#f2f2f2' : '#1e1e1e', 
                overflowY: 'auto',
                minHeight: 0
              }}>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 6,
                  justifyContent: 'flex-end',
                  minHeight: '100%'
                }}>
                  {(loops[activeChatLoop]?.messages || []).map((m) => {
                    const date = new Date(m.ts)
                    const timestamp = date.getFullYear() + '-' + 
                      String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(date.getDate()).padStart(2, '0') + ' ' + 
                      String(date.getHours()).padStart(2, '0') + ':' + 
                      String(date.getMinutes()).padStart(2, '0') + ':' + 
                      String(date.getSeconds()).padStart(2, '0') + '.' + 
                      String(date.getMilliseconds()).padStart(3, '0')
                    
                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{timestamp} · {m.senderLabel}</div>
                        <div style={{ fontSize: 13 }}>{m.text}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: `1px solid ${theme === 'light' ? '#ccc' : '#333'}` }}>
                <input 
                  value={activeChatLoop != null ? (loops[activeChatLoop]?.chatInput || '') : ''}
                  onChange={(e) => {
                    const value = e.currentTarget.value
                    if (activeChatLoop == null) return
                    setLoops(prev => prev.map((l, idx) => idx === activeChatLoop ? { ...l, chatInput: value } : l))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (activeChatLoop == null) return
                      const loop = loops[activeChatLoop]
                      if (!loop || !loop.room) return
                      const text = (loop.chatInput || '').trim()
                      if (!text) return
                      const msg = { id: crypto.randomUUID(), senderId: loop.identity || 'me', senderLabel: loop.identity || 'me', text, ts: Date.now() }
                      const encoded = new TextEncoder().encode(JSON.stringify(msg))
                      loop.room.localParticipant.publishData(encoded).catch(console.error)
                      setLoops(prev => prev.map((l, idx) => idx === activeChatLoop ? { ...l, messages: [...(l.messages || []), msg], chatInput: '' } : l))
                    }
                  }}
                                    placeholder="Type a message..." 
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: `1px solid ${theme === 'light' ? '#bbb' : '#555'}`,
                    background: theme === 'light' ? '#fff' : '#2a2a2a',
                    color: colors.fg,
                    fontFamily: 'Courier New, monospace',
                    fontSize: 13
                  }} 
                />
                                <button onClick={() => {
                  if (activeChatLoop == null) return
                  const loop = loops[activeChatLoop]
                  if (!loop || !loop.room) return
                  const text = (loop.chatInput || '').trim()
                  if (!text) return
                  const msg = { id: crypto.randomUUID(), senderId: loop.identity || 'me', senderLabel: loop.identity || 'me', text, ts: Date.now() }
                  const encoded = new TextEncoder().encode(JSON.stringify(msg))
                  loop.room.localParticipant.publishData(encoded).catch(console.error)
                  setLoops(prev => prev.map((l, idx) => idx === activeChatLoop ? { ...l, messages: [...(l.messages || []), msg], chatInput: '' } : l))
                }} style={{
                  padding: '6px 10px',
                  border: 'none',
                  borderRadius: 4,
                  background: theme === 'light' ? '#4a8a4a' : '#2a4a2a',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'Courier New, monospace',
                  fontSize: 13
                }}>
                  Send
                </button>
              </div>
            </div>
        )}

      {/* Placeholder when no chat is active */}
      {activeChatLoop == null && (
        <div style={{ 
          gridColumn: '2', 
          gridRow: '1 / 4',
          border: `1px dashed ${theme === 'light' ? '#bbb' : '#555'}`, 
          borderRadius: 8, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: theme === 'light' ? '#666' : '#aaa', 
          fontSize: 12 
        }}>
          Select a loop chat to view video grid and messages
        </div>
      )}
    </div>
  )
}
