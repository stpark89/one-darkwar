import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const SIGNAL_CHANNEL = 'guild-voice-signal'

type SignalMsg =
  | { type: 'join'; from: string; name: string }
  | { type: 'here'; from: string; name: string }
  | { type: 'leave'; from: string }
  | { type: 'offer'; from: string; to: string; name: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }

export interface VoiceUser {
  id: string
  name: string
}

export function useVoiceChat(userId: string, userName: string) {
  const [isInVoice, setIsInVoice] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([])
  const [micError, setMicError] = useState<string | null>(null)

  // 최신 userId/userName 을 항상 ref로 참조 — stale closure 방지
  const userIdRef = useRef(userId)
  const userNameRef = useRef(userName)
  useEffect(() => { userIdRef.current = userId }, [userId])
  useEffect(() => { userNameRef.current = userName }, [userName])

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const audioElemsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const isInVoiceRef = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const speakTimerRef = useRef<number | null>(null)

  const sendSignal = useCallback((msg: SignalMsg) => {
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg })
  }, [])

  const removeAudio = useCallback((remoteId: string) => {
    const audio = audioElemsRef.current.get(remoteId)
    if (audio) { audio.srcObject = null; audio.remove(); audioElemsRef.current.delete(remoteId) }
  }, [])

  const createPeer = useCallback((remoteId: string): RTCPeerConnection => {
    const existing = peersRef.current.get(remoteId)
    if (existing) { existing.close(); peersRef.current.delete(remoteId) }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!)
    })

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal({ type: 'ice', from: userIdRef.current, to: remoteId, candidate: e.candidate.toJSON() })
      }
    }

    pc.ontrack = (e) => {
      const stream = e.streams[0]
      let audio = audioElemsRef.current.get(remoteId)
      if (!audio) {
        audio = document.createElement('audio')
        audio.autoplay = true
        document.body.appendChild(audio)
        audioElemsRef.current.set(remoteId, audio)
      }
      audio.srcObject = stream
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        pc.close()
        peersRef.current.delete(remoteId)
        removeAudio(remoteId)
        setVoiceUsers((prev) => prev.filter((u) => u.id !== remoteId))
      }
    }

    peersRef.current.set(remoteId, pc)
    return pc
  }, [sendSignal, removeAudio])

  // 항상 최신 핸들러를 ref로 유지 — 채널 리스너의 stale closure 방지
  const handleSignalRef = useRef<((msg: SignalMsg) => Promise<void>) | null>(null)
  handleSignalRef.current = async (msg: SignalMsg) => {
    if (!isInVoiceRef.current) return
    const myId = userIdRef.current
    const myName = userNameRef.current
    if (msg.from === myId) return

    if (msg.type === 'join') {
      setVoiceUsers((prev) => prev.some((u) => u.id === msg.from) ? prev : [...prev, { id: msg.from, name: msg.name }])
      sendSignal({ type: 'here', from: myId, name: myName })
      const pc = createPeer(msg.from)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendSignal({ type: 'offer', from: myId, to: msg.from, name: myName, sdp: offer })
    }

    else if (msg.type === 'here') {
      setVoiceUsers((prev) => prev.some((u) => u.id === msg.from) ? prev : [...prev, { id: msg.from, name: msg.name }])
    }

    else if (msg.type === 'leave') {
      peersRef.current.get(msg.from)?.close()
      peersRef.current.delete(msg.from)
      removeAudio(msg.from)
      setVoiceUsers((prev) => prev.filter((u) => u.id !== msg.from))
    }

    else if (msg.type === 'offer' && msg.to === myId) {
      setVoiceUsers((prev) => {
        const exists = prev.find((u) => u.id === msg.from)
        if (exists) return exists.name === '...' ? prev.map((u) => u.id === msg.from ? { ...u, name: msg.name } : u) : prev
        return [...prev, { id: msg.from, name: msg.name }]
      })
      const pc = createPeer(msg.from)
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendSignal({ type: 'answer', from: myId, to: msg.from, sdp: answer })
    }

    else if (msg.type === 'answer' && msg.to === myId) {
      const pc = peersRef.current.get(msg.from)
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
      }
    }

    else if (msg.type === 'ice' && msg.to === myId) {
      const pc = peersRef.current.get(msg.from)
      if (pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)) } catch { /* ignore */ }
      }
    }
  }

  const joinVoice = useCallback(async () => {
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      isInVoiceRef.current = true
      setIsInVoice(true)
      setIsMuted(false)
      setVoiceUsers([{ id: userIdRef.current, name: userNameRef.current }])

      // 음성 감지
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      audioCtxRef.current = audioCtx
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const THRESHOLD = 18
      const poll = () => {
        if (!isInVoiceRef.current) return
        analyser.getByteFrequencyData(buf)
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length
        setIsSpeaking(avg > THRESHOLD)
        speakTimerRef.current = window.setTimeout(poll, 80)
      }
      poll()

      const channel = supabase.channel(SIGNAL_CHANNEL)
      channelRef.current = channel

      channel
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          // ref를 통해 항상 최신 핸들러 호출
          handleSignalRef.current?.(payload as SignalMsg)
        })
        .subscribe(() => {
          sendSignal({ type: 'join', from: userIdRef.current, name: userNameRef.current })
        })
    } catch (err) {
      console.error('Voice join error', err)
      setMicError('마이크 접근 권한이 필요합니다.')
      isInVoiceRef.current = false
    }
  }, [sendSignal])

  const leaveVoice = useCallback(() => {
    if (!isInVoiceRef.current) return
    sendSignal({ type: 'leave', from: userIdRef.current })

    peersRef.current.forEach((pc) => pc.close())
    peersRef.current.clear()

    audioElemsRef.current.forEach((audio) => { audio.srcObject = null; audio.remove() })
    audioElemsRef.current.clear()

    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null

    if (speakTimerRef.current) { clearTimeout(speakTimerRef.current); speakTimerRef.current = null }
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    setIsSpeaking(false)

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    isInVoiceRef.current = false
    setIsInVoice(false)
    setVoiceUsers([])
    setIsMuted(false)
  }, [sendSignal])

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsMuted(!track.enabled)
  }, [])

  useEffect(() => () => { leaveVoice() }, [leaveVoice])

  return { isInVoice, isMuted, isSpeaking, voiceUsers, micError, joinVoice, leaveVoice, toggleMute }
}
