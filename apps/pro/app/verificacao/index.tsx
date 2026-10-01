import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

export default function VerificacaoIndexScreen() {
  const router = useRouter();

  const steps = [
    { title: 'Conta criada', done: true },
    { title: 'Informações Pessoais', done: true },
    { title: 'Fotografia do Documento', done: false, active: true },
    { title: 'Prova de Vida (Selfie)', done: false },
    { title: 'Verificação OCR', done: false },
    { title: 'Aprovação da Equipa', done: false },
  ];

  return (
    <View className="flex-1 bg-white p-6">
      <Text className="text-2xl font-bold text-gray-900 mb-2">Verificação de Identidade</Text>
      <Text className="text-gray-500 mb-8">
        Precisamos de validar a sua identidade para garantir a segurança da plataforma.
      </Text>

      <ScrollView className="flex-1">
        {steps.map((step, index) => (
          <View key={index} className="flex-row items-center mb-6">
            <View className={`w-8 h-8 rounded-full items-center justify-center mr-4 
              ${step.done ? 'bg-green-500' : step.active ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <Text className="text-white font-bold">{step.done ? '✓' : index + 1}</Text>
            </View>
            <Text className={`text-lg ${step.active ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
              {step.title}
            </Text>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity 
        onPress={() => router.push('/verificacao/documento')}
        className="w-full bg-blue-600 py-4 rounded-xl items-center"
      >
        <Text className="text-white font-bold text-lg">Começar Captura</Text>
      </TouchableOpacity>
    </View>
  );
}
