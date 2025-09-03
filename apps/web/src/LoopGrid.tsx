import React, { useCallback, useRef, useState, useEffect } from 'react'
import { Room, createLocalAudioTrack, createLocalVideoTrack } from 'livekit-client'

interface LoopState {
  joining: boolean
  joined: boolean
  micMuted: boolean
  audioMuted: boolean
  videoEnabled: boolean
  room: Room | null
  videoTrack: any | null
}

export default function LoopGrid() {
  const [loops, setLoops] = useState<LoopState[]>([
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null },
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null },
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null },
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null },
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null },
    { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null },
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

      // Publish mic and video to this loop
      const mic = await createLocalAudioTrack()
      const video = await createLocalVideoTrack()
      
      // Publish tracks and wait for them to be ready
      const micPublication = await room.localParticipant.publishTrack(mic)
      const videoPublication = await room.localParticipant.publishTrack(video)
      
      // Wait a moment for tracks to be properly registered
      await new Promise(resolve => setTimeout(resolve, 100))

      setLoops(prev => prev.map((l, i) => 
        i === loopIndex ? { joining: false, joined: true, micMuted: false, audioMuted: false, videoEnabled: true, room, videoTrack: video } : l
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
      setLoops(prev => prev.map((l, i) => 
        i === loopIndex ? { joining: false, joined: false, micMuted: false, audioMuted: false, videoEnabled: false, room: null, videoTrack: null } : l
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
          
          // Re-attach video stream to element after unmuting
          setTimeout(() => {
            const videoElement = document.getElementById(`local-video-${loopIndex}`) as HTMLVideoElement
            if (videoElement && loop.videoTrack.mediaStream) {
              videoElement.srcObject = loop.videoTrack.mediaStream
              videoElement.play().catch(e => console.log('Video play error after unmute:', e))
              console.log(`Video stream re-attached after unmute for loop ${loopIndex + 1}`)
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
  }, [loops])

  // Effect to attach video streams to video elements when they become available
  useEffect(() => {
    loops.forEach((loop, i) => {
      if (loop.joined && loop.videoTrack && loop.videoEnabled) {
        const videoElement = document.getElementById(`local-video-${i}`) as HTMLVideoElement
        if (videoElement) {
          // Always re-attach the stream when video is enabled (handles toggle cases)
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
            
            {/* Video Display */}
            {loop.joined && (
              <div style={{ 
                width: '100%', 
                height: 120, 
                backgroundColor: '#222', 
                borderRadius: 4, 
                margin: '8px 0',
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
                    fontSize: 24,
                    color: '#666'
                  }}>
                    📷
                  </div>
                )}
              </div>
            )}
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
            
            {/* Video Toggle Button */}
            <button 
              onClick={() => toggleVideo(i)}
              disabled={!loop.joined}
              style={{ 
                padding: '6px 4px', 
                fontSize: 10,
                backgroundColor: !loop.joined ? '#4a4a4a' : (loop.videoEnabled ? '#2a4a2a' : '#6a2a2a'),
                color: !loop.joined ? '#666' : 'white',
                border: 'none',
                borderRadius: 4,
                cursor: !loop.joined ? 'not-allowed' : 'pointer'
              }}
            >
              {loop.videoEnabled ? '📹' : '📷'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
