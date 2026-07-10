import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const VOICE_CHANNEL = 'guild-voice'

type SignalMsg =
  | { type: 'offer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
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

  const removeAudio = (remoteId: string) => {
    const audio = audioElemsRef.current.get(remoteId)
    if (audio) { audio.srcObject = null; audio.remove(); audioElemsRef.current.delete(remoteId) }
  }

  const sendSignal = useCallback((msg: SignalMsg) => {
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg })
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
      }
    }

    peersRef.current.set(remoteId, pc)
    return pc
  }, [sendSignal])

  // 항상 최신 핸들러 유지
  const handleSignalRef = useRef<((msg: SignalMsg) => Promise<void>) | null>(null)
  handleSignalRef.current = async (msg: SignalMsg) => {
    if (!isInVoiceRef.current) return
    const myId = userIdRef.current
    if (msg.from === myId) return

    if (msg.type === 'offer' && msg.to === myId) {
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

      // 음성 감지
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      audioCtxRef.current = audioCtx
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const poll = () => {
        if (!isInVoiceRef.current) return
        analyser.getByteFrequencyData(buf)
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length
        setIsSpeaking(avg > 18)
        speakTimerRef.current = window.setTimeout(poll, 80)
      }
      poll()

      const channel = supabase.channel(VOICE_CHANNEL, {
        config: { presence: { key: userIdRef.current } },
      })
      channelRef.current = channel

      // Presence sync — 참여자 목록 자동 동기화
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string }>()
        const users: VoiceUser[] = Object.entries(state).map(([id, presences]) => ({
          id,
          name: presences[0]?.name ?? id,
        }))
        setVoiceUsers(users)
      })

      // 새 참여자 입장 — userId 비교로 한쪽만 offer 발신 (중복 방지)
      channel.on('presence', { event: 'join' }, ({ key: remoteId }) => {
        if (!isInVoiceRef.current) return
        const myId = userIdRef.current
        if (remoteId === myId) return
        // userId 문자열 비교 — 작은 쪽이 offer 발신 (양쪽 중복 방지)
        if (myId < remoteId) {
          const pc = createPeer(remoteId)
          pc.createOffer().then((offer) => {
            pc.setLocalDescription(offer).then(() => {
              sendSignal({ type: 'offer', from: myId, to: remoteId, sdp: offer })
            })
          })
        }
      })

      // 퇴장 — 피어 연결 정리
      channel.on('presence', { event: 'leave' }, ({ key: remoteId }) => {
        peersRef.current.get(remoteId)?.close()
        peersRef.current.delete(remoteId)
        removeAudio(remoteId)
      })

      // WebRTC 시그널 수신
      channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
        handleSignalRef.current?.(payload as SignalMsg)
      })

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: userNameRef.current })
        }
      })
    } catch (err) {
      console.error('Voice join error', err)
      setMicError('마이크 접근 권한이 필요합니다.')
      isInVoiceRef.current = false
      setIsInVoice(false)
    }
  }, [sendSignal, createPeer])

  const leaveVoice = useCallback(() => {
    if (!isInVoiceRef.current) return

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
  }, [])

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsMuted(!track.enabled)
  }, [])

  useEffect(() => () => { leaveVoice() }, [leaveVoice])

  return { isInVoice, isMuted, isSpeaking, voiceUsers, micError, joinVoice, leaveVoice, toggleMute }
}
