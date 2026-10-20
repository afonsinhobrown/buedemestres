import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null
  if (!Device.isDevice) return null

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFC61A',
      })
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let status = existingStatus
    if (existingStatus !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status
    }
    if (status !== 'granted') return null

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId

    if (!projectId) {
      throw new Error('projectId EAS em falta na configuração da app.')
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      const { error: saveError } = await supabase.from('push_subscriptions').upsert(
        {
          profile_id: user.id,
          platform: Platform.OS,
          expo_token: token,
        },
        { onConflict: 'profile_id,expo_token' }
      )
      if (saveError) throw saveError
    }

    return token
  } catch (error: any) {
    console.warn(
      'Erro ao registar push:',
      error?.message || error,
      Platform.OS === 'android'
        ? '(verifica as credenciais FCM do projeto no EAS)'
        : ''
    )
    return null
  }
}

export async function unregisterPushToken(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('push_subscriptions').delete().eq('profile_id', user.id)
  } catch (error) {
    console.warn('Erro ao remover push:', error)
  }
}