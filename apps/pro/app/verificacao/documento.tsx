import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';

export default function VerificacaoDocumentoScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [side, setSide] = useState<'frente' | 'verso'>('frente');
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-white">
        <Text className="text-center text-lg mb-4">Precisamos de acesso à câmara para capturar o seu BI.</Text>
        <TouchableOpacity onPress={requestPermission} className="bg-blue-600 px-6 py-3 rounded-xl">
          <Text className="text-white font-bold">Dar Permissão</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      // Guardar a foto (estado ou storage)
      if (side === 'frente') {
        setSide('verso');
      } else {
        router.push('/verificacao/selfie');
      }
    }
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView 
        ref={cameraRef}
        style={StyleSheet.absoluteFill} 
        facing="back"
      >
        <View className="flex-1 bg-black/60 pt-12 px-4">
          <TouchableOpacity onPress={() => router.back()} className="mb-8">
            <Text className="text-white text-lg">← Voltar</Text>
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold text-center mb-2">
            Captura do Documento ({side === 'frente' ? 'Frente' : 'Verso'})
          </Text>
          <Text className="text-white/80 text-center mb-8 px-4">
            Alinhe o seu documento dentro da moldura. Evite reflexos e certifique-se que o texto está nítido.
          </Text>
        </View>

        {/* Transparent frame for document */}
        <View className="flex-[2] flex-row">
          <View className="flex-1 bg-black/60" />
          <View className="w-[85%] border-2 border-white rounded-xl" />
          <View className="flex-1 bg-black/60" />
        </View>

        <View className="flex-1 bg-black/60 pb-12 justify-end items-center">
          <TouchableOpacity 
            onPress={takePicture}
            className="w-20 h-20 bg-white rounded-full border-4 border-gray-300"
          />
        </View>
      </CameraView>
    </View>
  );
}
