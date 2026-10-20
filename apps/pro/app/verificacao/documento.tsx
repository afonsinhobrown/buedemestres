import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Alert } from '../../lib/alertCompat'
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { updateKycDraft } from '../../lib/kycDraft';

export default function VerificacaoDocumentoScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [side, setSide] = useState<'frente' | 'verso'>('frente');
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Precisamos de acesso à câmara para capturar o seu BI.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
          <Text style={styles.permissionBtnText}>Dar Permissão</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || saving) return;
    try {
      setSaving(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) throw new Error('Não foi possível capturar a imagem.');

      if (side === 'frente') {
        updateKycDraft({ frontUri: photo.uri });
        setSide('verso');
      } else {
        updateKycDraft({ backUri: photo.uri });
        router.push('/verificacao/selfie');
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível capturar o documento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView 
        ref={cameraRef}
        style={StyleSheet.absoluteFill} 
        facing="back"
      >
        <View style={styles.topOverlay}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            Captura do Documento ({side === 'frente' ? 'Frente' : 'Verso'})
          </Text>
          <Text style={styles.subtitle}>
            Alinhe o seu documento dentro da moldura. Evite reflexos e certifique-se que o texto está nítido.
          </Text>
        </View>

        <View style={styles.frameRow}>
          <View style={styles.frameSide} />
          <View style={styles.frame} />
          <View style={styles.frameSide} />
        </View>

        <View style={styles.bottomOverlay}>
          <TouchableOpacity
            onPress={takePicture}
            disabled={saving}
            style={styles.captureBtn}
          >
            {saving && <ActivityIndicator color="#2563EB" />}
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  permissionText: { textAlign: 'center', fontSize: 18, marginBottom: 16 },
  permissionBtn: { backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permissionBtnText: { color: '#fff', fontWeight: 'bold' },
  topOverlay: { backgroundColor: 'rgba(0,0,0,0.6)', paddingTop: 48, paddingHorizontal: 16 },
  backButton: { marginBottom: 32 },
  backButtonText: { color: '#fff', fontSize: 18 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 32, paddingHorizontal: 16 },
  frameRow: { flex: 2, flexDirection: 'row' },
  frameSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  frame: { width: '85%', borderWidth: 2, borderColor: '#fff', borderRadius: 12 },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingBottom: 48,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  captureBtn: {
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
