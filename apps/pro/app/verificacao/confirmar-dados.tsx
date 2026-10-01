import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

export default function ConfirmarDadosScreen() {
  const router = useRouter();
  
  // Mock data that would come from OCR API
  const [data, setData] = useState({
    nome: 'JOÃO MARIA SILVA',
    numeroDoc: '123456789M',
    dataNascimento: '15/08/1990',
    dataValidade: '20/12/2030'
  });

  return (
    <View className="flex-1 bg-white p-6">
      <Text className="text-2xl font-bold text-gray-900 mb-2">Confirmar Dados</Text>
      <Text className="text-gray-500 mb-8">
        Verifique se os dados extraídos do seu documento estão correctos. Edite se necessário.
      </Text>

      <ScrollView className="flex-1">
        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-600 mb-1">Nome Completo</Text>
          <TextInput
            className="bg-gray-50 p-4 rounded-xl border border-gray-200"
            value={data.nome}
            onChangeText={(t) => setData({ ...data, nome: t })}
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-600 mb-1">Nº do Documento</Text>
          <TextInput
            className="bg-gray-50 p-4 rounded-xl border border-gray-200"
            value={data.numeroDoc}
            onChangeText={(t) => setData({ ...data, numeroDoc: t })}
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-600 mb-1">Data de Nascimento</Text>
          <TextInput
            className="bg-gray-50 p-4 rounded-xl border border-gray-200"
            value={data.dataNascimento}
            onChangeText={(t) => setData({ ...data, dataNascimento: t })}
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-600 mb-1">Data de Validade</Text>
          <TextInput
            className="bg-gray-50 p-4 rounded-xl border border-gray-200"
            value={data.dataValidade}
            onChangeText={(t) => setData({ ...data, dataValidade: t })}
          />
        </View>
      </ScrollView>

      <TouchableOpacity 
        onPress={() => router.push('/verificacao/aguardar')}
        className="w-full bg-blue-600 py-4 rounded-xl items-center"
      >
        <Text className="text-white font-bold text-lg">Submeter Verificação</Text>
      </TouchableOpacity>
    </View>
  );
}
