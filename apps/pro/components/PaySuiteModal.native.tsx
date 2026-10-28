import React from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native'
import { WebView } from 'react-native-webview'

interface PaySuiteModalProps {
  visible: boolean
  checkoutUrl: string | null
  onClose: () => void
  title?: string
}

export function PaySuiteModal({
  visible,
  checkoutUrl,
  onClose,
  title = 'Pagamento Seguro PaySuite',
}: PaySuiteModalProps) {
  if (!checkoutUrl) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>M-Pesa · e-Mola · Cartão (SSL 256-bit)</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>Fechar ✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webContainer}>
          <WebView
            source={{ uri: checkoutUrl }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#F2C94C" />
                <Text style={styles.loadingText}>A carregar janela de pagamento segura...</Text>
              </View>
            )}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            allowsInlineMediaPlayback
          />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: '#F5F0E8',
    fontSize: 16,
    fontWeight: '800',
  },
  sub: {
    color: '#F2C94C',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeBtnText: {
    color: '#F5F0E8',
    fontSize: 12,
    fontWeight: '800',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#F5F0E8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
})
