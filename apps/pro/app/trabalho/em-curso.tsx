import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function EmCursoScreen() {
  const router = useRouter();
  const { offerId } = useLocalSearchParams();
  const [isFinishing, setIsFinishing] = useState(false);

  const finishJob = async () => {
    try {
      setIsFinishing(true);
      // RPC to release payment and mark job as completed
      const { error } = await supabase.rpc('release_job_payment', {
        p_offer_id: offerId
      });

      if (error) throw error;

      Alert.alert('Sucesso', 'Serviço concluído com sucesso!');
      router.replace('/'); // Back to home
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Ocorreu um erro ao concluir o serviço.');
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-6 justify-between">
      <View className="mt-8 items-center">
        <View className="bg-blue-100 p-6 rounded-full mb-6">
          <Text className="text-4xl">🛠️</Text>
        </View>
        <Text className="text-3xl font-bold text-gray-900 mb-2">Serviço em Curso</Text>
        <Text className="text-gray-500 text-center px-4">
          O pagamento já está retido de forma segura. Faça o seu melhor trabalho!
        </Text>
      </View>

      <View className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8">
        <Text className="text-gray-600 font-semibold mb-4 text-lg">Dicas:</Text>
        <View className="flex-row items-start mb-3">
          <Text className="text-blue-500 mr-2">•</Text>
          <Text className="text-gray-700">Comunique sempre com o cliente se houver imprevistos.</Text>
        </View>
        <View className="flex-row items-start">
          <Text className="text-blue-500 mr-2">•</Text>
          <Text className="text-gray-700">Apenas clique em concluir quando o cliente confirmar que o trabalho está pronto.</Text>
        </View>
      </View>

      <TouchableOpacity 
        onPress={finishJob}
        disabled={isFinishing}
        className={`w-full py-4 rounded-xl items-center mb-8 ${isFinishing ? 'bg-gray-400' : 'bg-green-600'}`}
      >
        <Text className="text-white font-bold text-lg">
          {isFinishing ? 'A Concluir...' : 'Concluir Serviço'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
