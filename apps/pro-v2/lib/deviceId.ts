import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const STORAGE_KEY = 'buedemestres_device_id'
let cached: string | null = null

function newId(): string {
  const c = globalThis.crypto as any
  if (c?.randomUUID) return c.randomUUID()
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached

  try {
    if (Platform.OS === 'web') {
      const storage = globalThis.localStorage
      let id = storage?.getItem(STORAGE_KEY)
      if (!id) {
        id = newId()
        storage?.setItem(STORAGE_KEY, id)
      }
      cached = id
      return id
    }

    let id = await SecureStore.getItemAsync(STORAGE_KEY)
    if (!id) {
      id = newId()
      await SecureStore.setItemAsync(STORAGE_KEY, id)
    }
    cached = id
    return id
  } catch {
    cached = newId()
    return cached
  }
}
