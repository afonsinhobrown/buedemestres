import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function AguardarRevisaoScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white p-6 justify-center items-center">
      <View className="w-24 h-24 bg-blue-50 rounded-full items-center justify-center mb-6">
        <Text className="text-4xl">⏳</Text>
      </View>
      
      <Text className="text-2xl font-bold text-gray-900 mb-4 text-center">
        Dados em Revisão
      </Text>
      
      <Text className="text-gray-500 text-center text-lg mb-8">
        A nossa equipa está a analisar a sua submissão. Este processo costuma demorar até 24 horas úteis. 
        Receberá uma notificação assim que o seu perfil for aprovado!
      </Text>

      <TouchableOpacity 
        onPress={() => router.replace('/')}
        className="w-full bg-gray-900 py-4 rounded-xl items-center"
      >
        <Text className="text-white font-bold text-lg">Voltar ao Início</Text>
      </TouchableOpacity>
    </View>
  );
}
