import '../style.css'
import { authApi, conversationApi, messageApi, userApi } from '../api/chatApi'
import { connectChatSocket, disconnectChatSocket, isChatSocketConnected, sendChatMessage, subscribeToConversation, unsubscribeFromConversation } from '../websocket/stompClient'

const app = document.querySelector('#app')

const state = {
  page: location.hash.replace('#', '') || (localStorage.getItem('chatapp_token') ? 'chats' : 'login'),
  registerStep: 'mobile',
  mobileNumber: '',
  otp: '',
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  showPassword: false,
  loading: false,
  error: '',
  notice: '',
  chats: [],
  selectedChat: null,
  messages: [],
  previews: {},
  searchUser: null,
  profileOpen: false,
  chatsLoading: false,
  messagesLoading: false,
  sending: false,
  socketStatus: 'disconnected',
  socketError: '',
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('chatapp_user') || 'null')
  } catch {
    return null
  }
}

function icon(name, extraClass = '') {
  const paths = {
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
    person: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    back: '<path d="m15 18-6-6 6-6"/><path d="M20 12H9"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  }
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`
}

function loader(label = 'Loading...') {
  return `<div class="status-message"><span class="spinner-border spinner-border-sm text-success" aria-hidden="true"></span><span>${escapeHtml(label)}</span></div>`
}

function authAlert() {
  if (state.error) return `<div class="alert alert-danger py-2 small" role="alert">${escapeHtml(state.error)}</div>`
  if (state.notice) return `<div class="alert alert-success py-2 small" role="status">${escapeHtml(state.notice)}</div>`
  return ''
}

function loginView() {
  return `
    <main class="auth-page">
      <section class="card auth-card shadow-sm">
        <div class="card-body p-4 p-md-5">
          <a class="brand auth-brand" href="#login">${icon('chat')}<span>ChatApp</span></a>
          <h1 class="h3 mt-4 mb-2">Sign in</h1>
          <p class="text-secondary small mb-4">Enter your email and password to continue.</p>
          ${authAlert()}
          <form id="login-form" novalidate>
            <div class="mb-3">
              <label class="form-label small fw-semibold" for="login-email">Email address</label>
              <input class="form-control" id="login-email" type="email" autocomplete="email" placeholder="you@example.com" value="${escapeHtml(state.email)}" required>
            </div>
            <div class="mb-4">
              <label class="form-label small fw-semibold" for="login-password">Password</label>
              <div class="input-group">
                <input class="form-control" id="login-password" type="${state.showPassword ? 'text' : 'password'}" autocomplete="current-password" placeholder="Enter your password" value="${escapeHtml(state.password)}" required>
                <button class="btn btn-outline-secondary" type="button" data-action="toggle-password" aria-label="Show or hide password">${icon('eye')}</button>
              </div>
            </div>
            <button class="btn btn-success w-100" type="submit" ${state.loading ? 'disabled' : ''}>
              ${state.loading ? '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...' : 'Sign in'}
            </button>
          </form>
          <p class="small text-center text-secondary mt-4 mb-0">Don't have an account? <a href="#register">Register</a></p>
        </div>
      </section>
    </main>`
}

function registerView() {
  let fields = ''
  if (state.registerStep === 'mobile') {
    fields = `
      <form id="send-otp-form" novalidate>
        <div class="mb-3">
          <label class="form-label small fw-semibold" for="register-mobile">Mobile number</label>
          <input class="form-control" id="register-mobile" type="tel" inputmode="tel" autocomplete="tel" placeholder="e.g. 9876543210" value="${escapeHtml(state.mobileNumber)}" required>
          <div class="form-text">Include country code if needed.</div>
        </div>
        <button class="btn btn-success w-100" type="submit" ${state.loading ? 'disabled' : ''}>${state.loading ? '<span class="spinner-border spinner-border-sm me-2"></span>Sending...' : 'Send OTP'}</button>
      </form>`
  } else if (state.registerStep === 'otp') {
    fields = `
      <form id="verify-otp-form" novalidate>
        <div class="mb-3">
          <label class="form-label small fw-semibold" for="register-otp">Verification code</label>
          <input class="form-control" id="register-otp" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="Enter the OTP" maxlength="8" value="${escapeHtml(state.otp)}" required>
          <div class="form-text">Check the Spring Boot console for the OTP in local testing.</div>
        </div>
        <button class="btn btn-success w-100 mb-2" type="submit" ${state.loading ? 'disabled' : ''}>${state.loading ? '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...' : 'Verify OTP'}</button>
        <button class="btn btn-link btn-sm w-100" type="button" data-action="change-mobile">Change mobile number</button>
      </form>`
  } else {
    fields = `
      <div class="verified-number mb-3">${icon('person')}<span>Verified: ${escapeHtml(state.mobileNumber)}</span><button type="button" class="btn btn-link btn-sm ms-auto p-0" data-action="change-mobile">Change</button></div>
      <form id="register-form" novalidate>
        <div class="mb-3"><label class="form-label small fw-semibold" for="register-name">Full name</label><input class="form-control" id="register-name" autocomplete="name" placeholder="Your full name" value="${escapeHtml(state.name)}" required></div>
        <div class="mb-3"><label class="form-label small fw-semibold" for="register-email">Gmail address</label><input class="form-control" id="register-email" type="email" autocomplete="email" placeholder="you@gmail.com" value="${escapeHtml(state.email)}" required></div>
        <div class="mb-3"><label class="form-label small fw-semibold" for="register-password">Password</label><input class="form-control" id="register-password" type="${state.showPassword ? 'text' : 'password'}" autocomplete="new-password" placeholder="At least 6 characters" value="${escapeHtml(state.password)}" required></div>
        <div class="mb-4"><label class="form-label small fw-semibold" for="register-confirm">Confirm password</label><div class="input-group"><input class="form-control" id="register-confirm" type="${state.showPassword ? 'text' : 'password'}" autocomplete="new-password" placeholder="Re-enter password" value="${escapeHtml(state.confirmPassword)}" required><button class="btn btn-outline-secondary" type="button" data-action="toggle-password" aria-label="Show or hide password">${icon('eye')}</button></div></div>
        <button class="btn btn-success w-100" type="submit" ${state.loading ? 'disabled' : ''}>${state.loading ? '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...' : 'Create account'}</button>
      </form>`
  }
  return `
    <main class="auth-page">
      <section class="card auth-card shadow-sm">
        <div class="card-body p-4 p-md-5">
          <a class="brand auth-brand" href="#login">${icon('chat')}<span>ChatApp</span></a>
          <h1 class="h3 mt-4 mb-2">${state.registerStep === 'mobile' ? 'Create account' : state.registerStep === 'otp' ? 'Verify your number' : 'Complete registration'}</h1>
          <p class="text-secondary small mb-4">${state.registerStep === 'mobile' ? 'Start by verifying your mobile number.' : state.registerStep === 'otp' ? `Enter the code sent to ${escapeHtml(state.mobileNumber)}.` : 'Add your details to finish creating your account.'}</p>
          ${authAlert()}
          ${fields}
          <p class="small text-center text-secondary mt-4 mb-0">Already registered? <a href="#login">Sign in</a></p>
        </div>
      </section>
    </main>`
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function mergeMessages(current, incoming) {
  const byId = new Map()
  for (const message of [...current, ...incoming]) {
    const key = message.messageId == null
      ? `${message.senderId}:${message.sentAt}:${message.content}`
      : String(message.messageId)
    if (!byId.has(key)) byId.set(key, message)
  }
  return [...byId.values()].sort((first, second) => {
    const firstTime = new Date(first.sentAt).getTime() || 0
    const secondTime = new Date(second.sentAt).getTime() || 0
    return firstTime - secondTime
  })
}

function updateChatPreview(conversationId, message) {
  if (!message) return
  state.previews[String(conversationId)] = {
    content: message.content,
    sentAt: message.sentAt,
  }
}

function handleSocketMessage(message, conversationId) {
  updateChatPreview(conversationId, message)
  if (String(state.selectedChat?.conversationId) === String(conversationId)) {
    state.messages = mergeMessages(state.messages, [message])
  }
  if (state.page === 'chats') render()
}

function startSocket() {
  connectChatSocket({
    onMessage: handleSocketMessage,
    onStatus: ({ status, detail }) => {
      state.socketStatus = status
      state.socketError = status === 'error' || status === 'reconnecting' ? detail : ''
      if (state.page === 'chats') render()
    },
  })
}

function chatListView() {
  if (state.chatsLoading) return loader('Loading conversations...')
  if (!state.chats.length) return `<div class="empty-chats"><div class="empty-chat-icon">${icon('chat')}</div><strong>No chats yet</strong><span>Search for a user to start a conversation.</span></div>`
  return state.chats.map((chat) => {
    const id = String(chat.conversationId)
    const preview = state.previews[id]
    return `
      <button class="chat-list-item ${String(state.selectedChat?.conversationId) === id ? 'active' : ''}" type="button" data-chat-id="${escapeHtml(id)}">
        <span class="chat-avatar">${escapeHtml((chat.name || '?').charAt(0).toUpperCase())}</span>
        <span class="chat-item-content">
          <span class="chat-item-top"><strong>${escapeHtml(chat.name)}</strong><small>${formatTime(preview?.sentAt)}</small></span>
          <span class="chat-preview">${escapeHtml(preview?.content || chat.mobileNumber || '')}</span>
        </span>
      </button>`
  }).join('')
}

function searchResultView() {
  if (!state.searchUser) return ''
  return `<div class="search-result">
    <span class="chat-avatar">${escapeHtml((state.searchUser.name || '?').charAt(0).toUpperCase())}</span>
    <span class="search-user-info"><strong>${escapeHtml(state.searchUser.name)}</strong><small>${escapeHtml(state.searchUser.mobileNumber)}</small></span>
    <button class="btn btn-sm btn-success" type="button" data-action="start-chat" ${state.loading ? 'disabled' : ''}>${state.loading ? '...' : 'Chat'}</button>
  </div>`
}

function messageArea() {
  if (state.messagesLoading) return loader('Loading messages...')
  if (state.error && !state.messages.length) return `<div class="alert alert-danger small">${escapeHtml(state.error)}</div>`
  if (!state.messages.length) return `<div class="empty-messages"><strong>Start your conversation</strong><span>Send a message to ${escapeHtml(state.selectedChat.name)}.</span></div>`
  const userId = getUser()?.userId ?? getUser()?.id
  return `<div class="message-list">${state.messages.map((message) => {
    const mine = String(message.senderId) === String(userId)
    return `<div class="message-row ${mine ? 'mine' : ''}"><article class="message-bubble ${mine ? 'mine' : ''}">
      ${mine ? '' : `<strong class="message-sender">${escapeHtml(message.senderName || '')}</strong>`}
      <div class="message-content">${escapeHtml(message.content)}</div>
      <time>${formatTime(message.sentAt)}</time>
    </article></div>`
  }).join('')}<div id="message-bottom"></div></div>`
}

function dashboardView() {
  const user = getUser() || {}
  if (!localStorage.getItem('chatapp_token')) {
    state.page = 'login'
    return loginView()
  }
  const chat = state.selectedChat
  return `
    <main class="chat-app">
      <header class="app-header">
        <a class="brand" href="#chats">${icon('chat')}<span>ChatApp</span></a>
        <div class="profile-area">
        <span class="connection-badge ${state.socketStatus === 'connected' ? 'is-connected' : 'is-disconnected'}">
          <i></i>${state.socketStatus === 'connected' ? 'Live' : state.socketStatus === 'connecting' || state.socketStatus === 'reconnecting' ? 'Connecting' : 'Offline'}
        </span>
        <button type="button" class="profile-button" data-action="profile" aria-expanded="${state.profileOpen}"><span class="profile-initial">${escapeHtml((user.name || 'U').charAt(0).toUpperCase())}</span><span class="profile-name">${escapeHtml(user.name || 'Profile')}</span><span aria-hidden="true">⌄</span></button>
          ${state.profileOpen ? `<div class="profile-menu"><strong>${escapeHtml(user.name || '')}</strong><span>${escapeHtml(user.email || '')}</span><span>${escapeHtml(user.mobileNumber || '')}</span><button class="btn btn-outline-danger btn-sm mt-2" type="button" data-action="logout">${icon('logout')} Log out</button></div>` : ''}
        </div>
      </header>
      <div class="chat-layout">
        <aside class="chat-sidebar ${chat ? 'mobile-hidden' : ''}">
          <div class="sidebar-title"><div><h1>Chats</h1><p>Find a friend by mobile number</p></div><button class="btn btn-sm btn-outline-success" type="button" data-action="new-chat" aria-label="New chat">${icon('plus')}</button></div>
          <form id="search-form" class="search-form" novalidate>
            <div class="input-group"><span class="input-group-text">${icon('search')}</span><input id="search-mobile" class="form-control" type="tel" inputmode="tel" placeholder="Search mobile number" value="${escapeHtml(state.searchValue || '')}"><button class="btn btn-outline-secondary" type="submit" ${state.loading ? 'disabled' : ''}>Search</button></div>
          </form>
          ${state.error && !chat ? `<div class="alert alert-danger small mx-3 my-2">${escapeHtml(state.error)}</div>` : ''}
          ${searchResultView()}
          <div class="list-label">YOUR CONVERSATIONS</div>
          <div class="chat-list">${chatListView()}</div>
        </aside>
        <section class="chat-main ${chat ? 'mobile-show' : ''}">
          ${chat ? `
            <header class="conversation-header">
              <button type="button" class="btn btn-light mobile-back" data-action="back">${icon('back')}</button>
              <span class="chat-avatar">${escapeHtml((chat.name || '?').charAt(0).toUpperCase())}</span>
              <div class="conversation-user"><strong>${escapeHtml(chat.name)}</strong><small>${escapeHtml(chat.mobileNumber || '')}</small></div>
            </header>
            <div class="messages-panel">${messageArea()}</div>
            ${state.error && state.messages.length ? `<div class="alert alert-danger small mx-3 my-1">${escapeHtml(state.error)}</div>` : ''}
            <form class="message-form" id="message-form">
              <input id="message-input" class="form-control" autocomplete="off" maxlength="2000" placeholder="${isChatSocketConnected() ? 'Type a message...' : 'Waiting for chat connection...'}" value="${escapeHtml(state.messageInput || '')}" ${state.sending || !isChatSocketConnected() ? 'disabled' : ''}>
              <button class="btn btn-success" type="submit" aria-label="Send message" ${state.sending || !state.messageInput?.trim() || !isChatSocketConnected() ? 'disabled' : ''}>${state.sending ? '<span class="spinner-border spinner-border-sm"></span>' : icon('send')}</button>
            </form>
            ${state.socketError ? `<div class="socket-notice" role="status">${escapeHtml(state.socketError)}</div>` : ''}
          ` : `<div class="welcome-message"><div class="welcome-mark">${icon('chat')}</div><h2>Welcome to ChatApp</h2><p>Select a chat or search for a registered user to start messaging.</p></div>`}
        </section>
      </div>
    </main>`
}

function render() {
  if (state.page === 'register') app.innerHTML = registerView()
  else if (state.page === 'chats') app.innerHTML = dashboardView()
  else app.innerHTML = loginView()
  if (state.page === 'chats' && state.selectedChat && !state.messagesLoading) {
    document.querySelector('#message-bottom')?.scrollIntoView({ block: 'end' })
  }
}

async function handleLogin(event) {
  event.preventDefault()
  const email = document.querySelector('#login-email').value.trim().toLowerCase()
  const password = document.querySelector('#login-password').value
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    state.error = 'Enter a valid email address.'
    render()
    return
  }
  if (!password) {
    state.error = 'Enter your password.'
    render()
    return
  }
  state.email = email
  state.password = password
  state.loading = true
  state.error = ''
  render()
  try {
    const data = await authApi.login({ email, password })
    if (!data.token) throw new Error('Login response did not include a token.')
    let mobileNumber
    try {
      const saved = JSON.parse(localStorage.getItem('chatapp_registered_profile') || 'null')
      if (saved?.email?.toLowerCase() === String(data.email || email).toLowerCase()) mobileNumber = saved.mobileNumber
    } catch { /* Saved profile is optional. */ }
    localStorage.setItem('chatapp_token', data.token)
    localStorage.setItem('chatapp_user', JSON.stringify({
      userId: data.userId, name: data.name, email: data.email || email, mobileNumber,
    }))
    state.page = 'chats'
    state.loading = false
    state.error = ''
    history.replaceState(null, '', '#chats')
    startSocket()
    await loadChats()
  } catch (error) {
    state.loading = false
    state.error = error.message || 'Unable to sign in.'
    render()
  }
}

async function handleSendOtp(event) {
  event.preventDefault()
  const mobileNumber = document.querySelector('#register-mobile').value.trim()
  if (!/^\+?[1-9]\d{7,14}$/.test(mobileNumber)) {
    state.error = 'Enter a valid mobile number with 8–15 digits.'
    render()
    return
  }
  state.mobileNumber = mobileNumber
  state.loading = true
  state.error = ''
  render()
  try {
    const result = await authApi.sendOtp(mobileNumber)
    state.notice = result.message || 'OTP sent.'
    state.registerStep = 'otp'
  } catch (error) {
    state.error = error.message || 'Could not send OTP.'
  } finally {
    state.loading = false
    render()
  }
}

async function handleVerifyOtp(event) {
  event.preventDefault()
  const otp = document.querySelector('#register-otp').value.trim()
  if (!/^\d{4,8}$/.test(otp)) {
    state.error = 'Enter the OTP you received.'
    render()
    return
  }
  state.otp = otp
  state.loading = true
  state.error = ''
  render()
  try {
    const result = await authApi.verifyOtp(state.mobileNumber, otp)
    state.notice = result.message || 'Mobile number verified.'
    state.registerStep = 'details'
  } catch (error) {
    state.error = error.message || 'OTP verification failed.'
  } finally {
    state.loading = false
    render()
  }
}

async function handleRegister(event) {
  event.preventDefault()
  const name = document.querySelector('#register-name').value.trim()
  const email = document.querySelector('#register-email').value.trim().toLowerCase()
  const password = document.querySelector('#register-password').value
  const confirmPassword = document.querySelector('#register-confirm').value
  state.name = name
  state.email = email
  state.password = password
  state.confirmPassword = confirmPassword
  if (name.length < 2) state.error = 'Enter your full name.'
  else if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email)) state.error = 'Enter a valid Gmail address.'
  else if (password.length < 6) state.error = 'Password must be at least 6 characters.'
  else if (password !== confirmPassword) state.error = 'Passwords do not match.'
  else state.error = ''
  if (state.error) {
    render()
    return
  }
  state.loading = true
  render()
  try {
    const result = await authApi.register({ name, mobileNumber: state.mobileNumber, email, password })
    localStorage.setItem('chatapp_registered_profile', JSON.stringify({
      name: result.name || name, email: result.email || email, mobileNumber: state.mobileNumber,
    }))
    state.page = 'login'
    state.registerStep = 'mobile'
    state.password = ''
    state.confirmPassword = ''
    state.notice = 'Registration successful. Sign in to continue.'
    location.hash = 'login'
  } catch (error) {
    state.error = error.message || 'Registration failed.'
  } finally {
    state.loading = false
    render()
  }
}

async function loadChats() {
  state.chatsLoading = true
  state.error = ''
  render()
  try {
    const data = await userApi.getChats()
    if (!Array.isArray(data)) throw new Error('Unexpected response while loading conversations.')
    state.chats = data
  } catch (error) {
    state.error = error.message || 'Could not load conversations.'
  } finally {
    state.chatsLoading = false
    render()
  }
}

async function handleSearch(event) {
  event.preventDefault()
  const number = document.querySelector('#search-mobile').value.trim()
  state.searchValue = number
  if (!/^\+?[1-9]\d{7,14}$/.test(number)) {
    state.error = 'Enter a valid mobile number.'
    render()
    return
  }
  state.loading = true
  state.error = ''
  state.searchUser = null
  render()
  try {
    state.searchUser = await userApi.search(number)
  } catch (error) {
    state.error = error.message || 'Could not find that user.'
  } finally {
    state.loading = false
    render()
  }
}

async function startChat() {
  if (!state.searchUser) return
  state.loading = true
  state.error = ''
  render()
  try {
    const result = await conversationApi.start(state.searchUser.mobileNumber)
    const chat = {
      conversationId: result.conversationId,
      userId: result.receiverId,
      name: result.receiverName,
      mobileNumber: result.receiverMobile,
    }
    const existing = state.chats.find((item) => String(item.conversationId) === String(chat.conversationId))
    if (!existing) state.chats.unshift(chat)
    state.selectedChat = existing || chat
    state.searchUser = null
    state.searchValue = ''
    state.messages = []
    subscribeToConversation(state.selectedChat.conversationId)
    await loadMessages()
  } catch (error) {
    state.error = error.message || 'Could not start conversation.'
    state.loading = false
    render()
  }
}

async function openChat(chat) {
  state.selectedChat = chat
  state.messages = []
  state.error = ''
  state.messagesLoading = true
  state.messageInput = ''
  state.socketError = ''
  subscribeToConversation(chat.conversationId)
  render()
  await loadMessages()
}

async function loadMessages() {
  if (!state.selectedChat) return
  const conversationId = state.selectedChat.conversationId
  state.messagesLoading = true
  state.loading = false
  state.error = ''
  render()
  try {
    const data = await messageApi.getHistory(conversationId)
    if (!Array.isArray(data)) throw new Error('Unexpected response while loading messages.')
    if (String(state.selectedChat?.conversationId) === String(conversationId)) {
      state.messages = mergeMessages(state.messages, data)
      updateChatPreview(conversationId, state.messages.at(-1))
    }
  } catch (error) {
    state.error = error.message || 'Could not load messages.'
  } finally {
    state.messagesLoading = false
    render()
  }
}

async function handleSendMessage(event) {
  event.preventDefault()
  const input = document.querySelector('#message-input')
  const content = input?.value.trim()
  if (!content || !state.selectedChat || state.sending) return
  if (!isChatSocketConnected()) {
    state.socketError = 'Chat is reconnecting. Please wait before sending.'
    render()
    return
  }
  state.messageInput = content
  state.sending = true
  state.error = ''
  render()
  try {
    sendChatMessage(state.selectedChat.conversationId, content)
    state.messageInput = ''
    state.socketError = ''
  } catch (error) {
    state.error = error.message || 'Could not send message.'
  } finally {
    state.sending = false
    render()
    document.querySelector('#message-input')?.focus()
  }
}

app.addEventListener('input', (event) => {
  const input = event.target
  if (input.id === 'login-email') state.email = input.value
  if (input.id === 'login-password') state.password = input.value
  if (input.id === 'register-mobile') state.mobileNumber = input.value
  if (input.id === 'register-otp') state.otp = input.value.replace(/\D/g, '')
  if (input.id === 'register-name') state.name = input.value
  if (input.id === 'register-email') state.email = input.value
  if (input.id === 'register-password') state.password = input.value
  if (input.id === 'register-confirm') state.confirmPassword = input.value
  if (input.id === 'search-mobile') state.searchValue = input.value
  if (input.id === 'message-input') {
    state.messageInput = input.value
    const button = input.form?.querySelector('button[type="submit"]')
    if (button) button.disabled = !input.value.trim() || state.sending
  }
})

app.addEventListener('submit', (event) => {
  if (event.target.id === 'login-form') handleLogin(event)
  if (event.target.id === 'send-otp-form') handleSendOtp(event)
  if (event.target.id === 'verify-otp-form') handleVerifyOtp(event)
  if (event.target.id === 'register-form') handleRegister(event)
  if (event.target.id === 'search-form') handleSearch(event)
  if (event.target.id === 'message-form') handleSendMessage(event)
})

app.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action
  if (action === 'toggle-password') {
    state.showPassword = !state.showPassword
    render()
  } else if (action === 'change-mobile') {
    state.registerStep = 'mobile'
    state.error = ''
    state.notice = ''
    render()
  } else if (action === 'start-chat') {
    startChat()
  } else if (action === 'new-chat') {
    document.querySelector('#search-mobile')?.focus()
  } else if (action === 'profile') {
    state.profileOpen = !state.profileOpen
    render()
  } else if (action === 'logout') {
    disconnectChatSocket()
    localStorage.removeItem('chatapp_token')
    localStorage.removeItem('chatapp_user')
    state.selectedChat = null
    state.chats = []
    state.profileOpen = false
    state.page = 'login'
    state.error = ''
    location.hash = 'login'
    render()
  } else if (action === 'back') {
    unsubscribeFromConversation()
    state.selectedChat = null
    state.messages = []
    state.error = ''
    render()
  }

  const chatButton = event.target.closest('[data-chat-id]')
  if (chatButton) {
    const chat = state.chats.find((item) => String(item.conversationId) === chatButton.dataset.chatId)
    if (chat) openChat(chat)
  }

  const link = event.target.closest('a[href^="#"]')
  if (link) {
    const page = link.getAttribute('href').slice(1)
    if (page === 'login' || page === 'register') {
      state.page = page
      state.error = ''
      state.notice = ''
      render()
    }
  }
})

window.addEventListener('hashchange', () => {
  const page = location.hash.slice(1)
  if (page === 'login' || page === 'register' || page === 'chats') {
    state.page = page
    if (page === 'chats' && localStorage.getItem('chatapp_token') && !state.chats.length) {
      startSocket()
      loadChats()
    }
    else render()
  }
})

window.addEventListener('chatapp:unauthorized', () => {
  disconnectChatSocket()
  state.page = 'login'
  state.selectedChat = null
  state.socketStatus = 'disconnected'
  state.error = 'Your session has expired. Please sign in again.'
  history.replaceState(null, '', '#login')
  render()
})

if (state.page === 'chats' && localStorage.getItem('chatapp_token')) {
  state.page = 'chats'
  location.hash = 'chats'
  render()
  startSocket()
  loadChats()
} else {
  state.page = state.page === 'register' ? 'register' : 'login'
  location.hash = state.page
  render()
}
