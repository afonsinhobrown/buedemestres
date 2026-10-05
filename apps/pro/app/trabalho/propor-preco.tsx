import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

interface ServiceLine {
  id: string;
  description: string;
  price: string;
}

export default function ProporPrecoScreen() {
  const router = useRouter();
  const { offerId } = useLocalSearchParams();
  const [lines, setLines] = useState<ServiceLine[]>([
    { id: '1', description: '', price: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addLine = () => {
    setLines([...lines, { id: Math.random().toString(), description: '', price: '' }]);
  };

  const updateLine = (id: string, field: 'description' | 'price', value: string) => {
    setLines(lines.map(line => line.id === id ? { ...line, [field]: value } : line));
  };

  const removeLine = (id: string) => {
    setLines(lines.filter(line => line.id !== id));
  };

  const total = lines.reduce((acc, line) => {
    const p = parseFloat(line.price) || 0;
    return acc + p;
  }, 0);

  const submitProposal = async () => {
    try {
      setIsSubmitting(true);
      const validLines = lines.filter(l => l.description.trim() !== '' && parseFloat(l.price) > 0);
      
      if (validLines.length === 0) {
        Alert.alert('Erro', 'Adicione pelo menos um serviço com preço válido.');
        return;
      }

      // RPC call to agree_price or direct insert, depending on the DB schema
      const { error } = await supabase.rpc('agree_price', {
        p_offer_id: offerId,
        p_total_price: total,
        p_items: validLines
      });

      if (error) throw error;

      router.push(`/trabalho/aguardar-pagamento?offerId=${offerId}`);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Ocorreu um erro ao propor o preço.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-2xl font-bold mb-6 text-gray-900">Propor Preço</Text>
      
      <ScrollView className="flex-1">
        {lines.map((line, index) => (
          <View key={line.id} className="mb-4 p-4 border border-gray-200 rounded-lg">
            <Text className="text-sm font-semibold text-gray-600 mb-2">Item {index + 1}</Text>
            <TextInput
              className="w-full bg-gray-50 p-3 rounded-md mb-3 border border-gray-200"
              placeholder="Descrição do serviço..."
              value={line.description}
              onChangeText={(text) => updateLine(line.id, 'description', text)}
            />
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <TextInput
                  className="w-full bg-gray-50 p-3 rounded-md border border-gray-200"
                  placeholder="Preço (MT)"
                  keyboardType="numeric"
                  value={line.price}
                  onChangeText={(text) => updateLine(line.id, 'price', text)}
                />
              </View>
              {lines.length > 1 && (
                <TouchableOpacity onPress={() => removeLine(line.id)} className="p-3 bg-red-50 rounded-md">
                  <Text className="text-red-500 font-semibold">Remover</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        <TouchableOpacity 
          onPress={addLine}
          className="py-3 items-center border border-dashed border-blue-400 rounded-lg bg-blue-50 mb-6"
        >
          <Text className="text-blue-600 font-semibold">+ Adicionar outro serviço</Text>
        </TouchableOpacity>

        <View className="flex-row justify-between items-center py-4 border-t border-gray-200 mb-6">
          <Text className="text-lg font-bold text-gray-800">Total a cobrar:</Text>
          <Text className="text-2xl font-bold text-blue-600">{total.toFixed(2)} MT</Text>
        </View>
      </ScrollView>

      <TouchableOpacity 
        onPress={submitProposal}
        disabled={isSubmitting}
        className={`w-full py-4 rounded-xl items-center ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600'}`}
      >
        <Text className="text-white font-bold text-lg">
          {isSubmitting ? 'A Enviar...' : 'Enviar Proposta ao Cliente'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
