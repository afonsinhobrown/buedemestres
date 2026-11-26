import { Alert, Platform } from 'react-native'

export function mostrarAlerta(titulo: string, mensagem?: string, onPress?: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(mensagem ? `${titulo}\n\n${mensagem}` : titulo)
    }
    onPress?.()
    return
  }

  Alert.alert(titulo, mensagem || '', [{ text: 'OK', onPress }])
}

export function mostrarConfirmacao(
  titulo: string,
  mensagem: string,
  onConfirmar: () => void,
  opcoes?: { textoConfirmar?: string; textoCancelar?: string; onCancelar?: () => void }
) {
  if (Platform.OS === 'web') {
    const confirmado = typeof window !== 'undefined' ? window.confirm(`${titulo}\n\n${mensagem}`) : false
    if (confirmado) {
      onConfirmar()
    } else {
      opcoes?.onCancelar?.()
    }
    return
  }

  Alert.alert(titulo, mensagem, [
    { text: opcoes?.textoCancelar || 'Cancelar', style: 'cancel', onPress: opcoes?.onCancelar },
    { text: opcoes?.textoConfirmar || 'Confirmar', onPress: onConfirmar },
  ])
}
