import { useEffect, useRef, useCallback } from 'react'
import type { WSEvent } from '../types'

interface Options {
  onMessage: (evt: WSEvent) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export function useWebSocket({ onMessage, onConnect, onDisconnect }: Options) {
  const ws = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)
  onMessageRef.current = onMessage
  onConnectRef.current = onConnect
  onDisconnectRef.current = onDisconnect

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws`
    const socket = new WebSocket(url)
    ws.current = socket

    socket.onopen = () => {
      console.log('[WS] connected')
      onConnectRef.current?.()
      const ping = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send('ping')
      }, 30_000)
      // inner onclose only clears the ping interval, outer onclose handles reconnect
      const innerClose = () => clearInterval(ping)
      socket.addEventListener('close', innerClose, { once: true })
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
      onDisconnectRef.current?.()
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
