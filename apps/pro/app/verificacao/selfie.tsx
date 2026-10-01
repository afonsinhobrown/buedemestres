import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';

export default function VerificacaoSelfieScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-white">
        <Text className="text-center text-lg mb-4">Precisamos da câmara frontal para a selfie.</Text>
        <TouchableOpacity onPress={requestPermission} className="bg-blue-600 px-6 py-3 rounded-xl">
          <Text className="text-white font-bold">Dar Permissão</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takeSelfie = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      // Em produção, aqui enviamos para a API de "prova de vida"
      router.push('/verificacao/confirmar-dados');
    }
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView 
        ref={cameraRef}
        style={StyleSheet.absoluteFill} 
        facing="front"
      >
        <View className="flex-1 bg-black/60 pt-12 px-4">
          <TouchableOpacity onPress={() => router.back()} className="mb-8">
            <Text className="text-white text-lg">← Voltar</Text>
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold text-center mb-2">Prova de Vida</Text>
          <Text className="text-white/80 text-center px-4">
            Posicione o seu rosto dentro da oval e olhe directamente para a câmara.
          </Text>
        </View>

        {/* Oval Mask Mock */}
        <View className="flex-[2] justify-center items-center">
          <View className="w-64 h-80 border-4 border-green-400 rounded-[100px] bg-transparent" />
        </View>

        <View className="flex-1 bg-black/60 pb-12 justify-end items-center">
          <TouchableOpacity 
            onPress={takeSelfie}
            className="w-20 h-20 bg-white rounded-full border-4 border-gray-300"
          />
        </View>
      </CameraView>
    </View>
  );
}
