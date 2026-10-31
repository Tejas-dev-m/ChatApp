const API_BASE = 'http://localhost:8080'

export async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('chatapp_token')
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new Error('Cannot reach the backend. Make sure Spring Boot is running at http://localhost:8080.')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status}).`)
    error.status = response.status
    if (response.status === 401 && token) {
      localStorage.removeItem('chatapp_token')
      localStorage.removeItem('chatapp_user')
      window.dispatchEvent(new Event('chatapp:unauthorized'))
    }
    throw error
  }
  return data
}
