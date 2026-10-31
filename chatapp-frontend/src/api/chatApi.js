import { request } from './http'

export const authApi = {
  sendOtp: (mobileNumber) =>
    request('/api/auth/send-otp', { method: 'POST', body: { mobileNumber } }),
  verifyOtp: (mobileNumber, otp) =>
    request('/api/auth/verify-otp', { method: 'POST', body: { mobileNumber, otp } }),
  register: (details) =>
    request('/api/auth/register', { method: 'POST', body: details }),
  login: (credentials) =>
    request('/api/auth/login', { method: 'POST', body: credentials }),
}

export const userApi = {
  getChats: () => request('/api/users/my-chats'),
  search: (mobileNumber) =>
    request(`/api/users/search?mobileNumber=${encodeURIComponent(mobileNumber)}`),
}

export const conversationApi = {
  start: (mobileNumber) =>
    request('/api/conversations/start', { method: 'POST', body: { mobileNumber } }),
}

export const messageApi = {
  getHistory: (conversationId) =>
    request(`/api/messages/${encodeURIComponent(conversationId)}`),
}
