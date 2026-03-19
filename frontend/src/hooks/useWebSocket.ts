import { useEffect, useRef, useCallback } from 'react'
import type { WSEvent } from '../types'

export function useWebSocket(onMessage: (evt: WSEvent) => void) {
  const ws = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    const url = `ws://${window.location.host}/ws`
    const socket = new WebSocket(url)
    ws.current = socket

    socket.onopen = () => {
      console.log('[WS] connected')
      const ping = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send('ping')
      }, 30_000)
      socket.onclose = () => clearInterval(ping)
    }

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WSEvent
        if (parsed.event !== 'pong') onMessageRef.current(parsed)
      } catch (_) {
        /* ignore */
      }
    }

    socket.onerror = () => console.warn('[WS] error — will reconnect')
    socket.onclose = () => {
      console.log('[WS] disconnected — reconnecting in 3s')
      setTimeout(connect, 3000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      ws.current?.close()
    }
  }, [connect])
}
