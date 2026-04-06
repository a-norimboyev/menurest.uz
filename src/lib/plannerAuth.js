export async function verifyCredentials(authApiBaseUrl, username, password) {
  if (!authApiBaseUrl) return false

  try {
    const response = await fetch(`${authApiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })
    if (!response.ok) return false
    const data = await response.json()
    return Boolean(data?.ok)
  } catch {
    return false
  }
}