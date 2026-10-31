import { Client } from '@stomp/stompjs'

const WS_URL = 'ws://localhost:8080/ws'

let client
let activeConversationId = null
let activeSubscription = null
let messageHandler = () => {}
let statusHandler = () => {}
let reconnectAttempt = 0

function notifyStatus(status, detail = '') {
  statusHandler({ status, detail, reconnectAttempt })
}

function subscribeToActiveConversation() {
  if (!client?.connected || activeConversationId == null) return
  activeSubscription?.unsubscribe()
  const subscribedConversationId = activeConversationId
  activeSubscription = client.subscribe(
    `/topic/conversation/${subscribedConversationId}`,
    (frame) => {
      try {
        messageHandler(JSON.parse(frame.body), subscribedConversationId)
      } catch {
        notifyStatus('error', 'Received an unreadable chat message.')
      }
    },
    { id: `conversation-${activeConversationId}` },
  )
}

export function connectChatSocket({ onMessage, onStatus } = {}) {
  messageHandler = onMessage || (() => {})
  statusHandler = onStatus || (() => {})

  const token = localStorage.getItem('chatapp_token')
  if (!token) {
    notifyStatus('error', 'Sign in before connecting to chat.')
    return
  }

  if (client?.active) return

  client = new Client({
    brokerURL: WS_URL,
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      reconnectAttempt = 0
      notifyStatus('connected')
      subscribeToActiveConversation()
    },
    onStompError: (frame) => {
      const detail = frame.headers.message || 'Chat server rejected the WebSocket request.'
      if (/(missing|invalid|expired).*jwt|jwt.*(missing|invalid|expired)/i.test(detail)) {
        localStorage.removeItem('chatapp_token')
        localStorage.removeItem('chatapp_user')
        window.dispatchEvent(new Event('chatapp:unauthorized'))
      }
      notifyStatus('error', detail)
    },
    onWebSocketError: () => {
      reconnectAttempt += 1
      notifyStatus('reconnecting', 'Cannot connect to the chat server. Retrying...')
    },
    onWebSocketClose: () => {
      if (client?.active) {
        reconnectAttempt += 1
        notifyStatus('reconnecting', 'Connection lost. Reconnecting...')
      }
    },
  })

  notifyStatus('connecting')
  client.activate()
}

export function subscribeToConversation(conversationId) {
  activeSubscription?.unsubscribe()
  activeSubscription = null
  activeConversationId = String(conversationId)
  subscribeToActiveConversation()
}

export function unsubscribeFromConversation() {
  activeSubscription?.unsubscribe()
  activeSubscription = null
  activeConversationId = null
}

export function sendChatMessage(conversationId, content) {
  if (!client?.connected) throw new Error('Chat is reconnecting. Wait until it is connected to send a message.')
  if (String(conversationId) !== String(activeConversationId)) {
    throw new Error('Open the conversation before sending a message.')
  }
  client.publish({
    destination: '/app/chat.send',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversationId: String(conversationId), content }),
  })
}

export function disconnectChatSocket() {
  activeSubscription?.unsubscribe()
  activeSubscription = null
  activeConversationId = null
  if (client) {
    const currentClient = client
    client = undefined
    currentClient.deactivate()
  }
}

export function isChatSocketConnected() {
  return Boolean(client?.connected)
}
