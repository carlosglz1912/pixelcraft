export interface UserData {
  deviceId: string
  username: string | null
  createdAt: number
}

const STORAGE_KEY = 'pixelcraft-user'

function generateDeviceId(): string {
  return crypto.randomUUID()
}

export function getUser(): UserData {
  if (typeof window === 'undefined') {
    return {
      deviceId: '',
      username: null,
      createdAt: Date.now(),
    }
  }

  const stored = localStorage.getItem(STORAGE_KEY)
  
  if (stored) {
    try {
      return JSON.parse(stored) as UserData
    } catch {
      // Invalid data, create new
    }
  }

  const newUser: UserData = {
    deviceId: generateDeviceId(),
    username: null,
    createdAt: Date.now(),
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
  return newUser
}

export function setUsername(username: string): UserData {
  const user = getUser()
  const updated = { ...user, username }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function getUserId(): string {
  const user = getUser()
  return user.username || user.deviceId
}

export function clearUser(): void {
  localStorage.removeItem(STORAGE_KEY)
}
