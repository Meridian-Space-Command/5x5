import React, { useCallback, useRef, useState } from 'react'
import { Room, RoomConnectOptions, createLocalAudioTrack } from 'livekit-client'

export default function JoinTest() {
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [joining2, setJoining2] = useState(false)
  const [joined2, setJoined2] = useState(false)
  const roomRef = useRef<Room | null>(null)
  const room2Ref = useRef<Room | null>(null)

  const onJoin = useCallback(async () => {
    if (joining || joined) return
    setJoining(true)
    try {
      const identity = `user-${Math.random().toString(36).slice(2, 8)}`
      const roomName = `loop-test-${Date.now()}`
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, identity })
      })
      const data = await resp.json()
      if (!data.token) throw new Error('no token')

      const room = new Room({
        // Disable auto-reconnection to avoid state issues
        autoReconnect: false,
        // Disable adaptive stream
        adaptiveStream: false,
      })
      
      // Add basic ICE configuration
      const connectOptions = {
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      }
      
      await room.connect('ws://localhost:7880', data.token as string, connectOptions)
      roomRef.current = room

      // Publish mic
      const mic = await createLocalAudioTrack()
      await room.localParticipant.publishTrack(mic)

      setJoined(true)
    } catch (e) {
      console.error(e)
    } finally {
      setJoining(false)
    }
  }, [joining, joined])

  const onJoin2 = useCallback(async () => {
    if (joining2 || joined2) return
    setJoining2(true)
    try {
      const identity = `user-${Math.random().toString(36).slice(2, 8)}`
      const roomName = `loop-test-2-${Date.now()}`
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
      room2Ref.current = room

      // Publish mic to second room too
      const mic = await createLocalAudioTrack()
      await room.localParticipant.publishTrack(mic)

      setJoined2(true)
    } catch (e) {
      console.error(e)
    } finally {
      setJoining2(false)
    }
  }, [joining2, joined2])

  const onLeave = useCallback(async () => {
    const room = roomRef.current
    if (room) {
      await room.disconnect()
      roomRef.current = null
      setJoined(false)
    }
  }, [])

  const onLeave2 = useCallback(async () => {
    const room = room2Ref.current
    if (room) {
      await room.disconnect()
      room2Ref.current = null
      setJoined2(false)
    }
  }, [])

  return (
    <div>
      <h3>Loop 1</h3>
      {!joined ? (
        <button onClick={onJoin} disabled={joining}>{joining ? 'Joining...' : 'Join Loop 1'}</button>
      ) : (
        <button onClick={onLeave}>Leave Loop 1</button>
      )}
      
      <h3>Loop 2</h3>
      {!joined2 ? (
        <button onClick={onJoin2} disabled={joining2}>{joining2 ? 'Joining...' : 'Join Loop 2'}</button>
      ) : (
        <button onClick={onLeave2}>Leave Loop 2</button>
      )}
      
      <p>Status: Loop 1: {joined ? 'Connected' : 'Disconnected'}, Loop 2: {joined2 ? 'Connected' : 'Disconnected'}</p>
    </div>
  )
}


