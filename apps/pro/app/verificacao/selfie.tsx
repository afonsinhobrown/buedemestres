import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Alert } from '../../lib/alertCompat';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { updateKycDraft } from '../../lib/kycDraft';

export default function VerificacaoSelfieScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<any>(null);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.permissionText}>Precisamos da câmara frontal para a selfie.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btnPermissao}>
          <Text style={styles.btnPermissaoText}>Dar Permissão</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takeSelfie = async () => {
    if (!cameraRef.current || saving) return;
    try {
      setSaving(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) throw new Error('Não foi possível capturar a selfie.');
      updateKycDraft({ selfieUri: photo.uri });
      router.push('/verificacao/confirmar-dados');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível capturar a selfie.');
    } finally {
      setSaving(false);
    }
  };

  const CameraComponent = CameraView as any;

  return (
    <View style={styles.container}>
      <CameraComponent 
        ref={cameraRef}
        style={StyleSheet.absoluteFill} 
        facing="front"
      >
        <View style={styles.topOverlay}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Prova de Vida</Text>
          <Text style={styles.subtitle}>
            Posicione o seu rosto dentro da oval e olhe directamente para a câmara.
          </Text>
        </View>

        {/* Oval Mask Mock */}
        <View style={styles.maskContainer}>
          <View style={styles.ovalMask} />
        </View>

        <View style={styles.bottomOverlay}>
          <TouchableOpacity 
            onPress={takeSelfie}
            disabled={saving}
            style={[styles.captureBtn, { alignItems: 'center', justifyContent: 'center' }]}
          >
            {saving && <ActivityIndicator color="#2563EB" />}
          </TouchableOpacity>
        </View>
      </CameraComponent>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  permissionText: {
    textAlign: 'center',
    fontSize: 18,
    marginBottom: 16,
  },
  btnPermissao: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPermissaoText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  backButton: {
    marginBottom: 32,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  maskContainer: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalMask: {
    width: 256,
    height: 320,
    borderWidth: 4,
    borderColor: '#4ADE80',
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
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
  },
});
