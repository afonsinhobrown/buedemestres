import { Alert as RNAlert, Platform } from 'react-native'

type AlertButton = {
  text?: string
  onPress?: () => void
  style?: 'default' | 'cancel' | 'destructive'
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== 'web') {
      RNAlert.alert(title, message, buttons as never)
      return
    }

    const text = message ? `${title}\n\n${message}` : title

    if (!buttons || buttons.length === 0) {
      if (typeof window !== 'undefined') window.alert(text)
      return
    }

    if (buttons.length === 1) {
      if (typeof window !== 'undefined') window.alert(text)
      buttons[0].onPress?.()
      return
    }

    const cancel = buttons.find((b) => b.style === 'cancel') || buttons[0]
    const primary =
      buttons.find((b) => b.style !== 'cancel' && b !== cancel) || buttons[buttons.length - 1]

    const confirmed =
      typeof window !== 'undefined' ? window.confirm(text) : false

    if (confirmed) {
      primary.onPress?.()
    } else {
      cancel.onPress?.()
    }
  },
}
