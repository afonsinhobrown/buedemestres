import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AguardarPagamentoScreen() {
  const router = useRouter();
  const { offerId } = useLocalSearchParams();
  const [status, setStatus] = useState<'pending' | 'held'>('pending');

  useEffect(() => {
    // Listen for changes in the job_payments table or offer status
    const channel = supabase
      .channel('payment_status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_payments',
          filter: `offer_id=eq.${offerId}`,
        },
        (payload) => {
          if (payload.new.status === 'held') {
            setStatus('held');
            setTimeout(() => {
              router.replace(`/trabalho/em-curso?offerId=${offerId}`);
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [offerId]);

  return (
    <View className="flex-1 bg-white p-6 justify-center items-center">
      <View className="bg-blue-50 p-8 rounded-full mb-6">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
      
      <Text className="text-2xl font-bold text-gray-900 mb-3 text-center">
        A Aguardar Pagamento
      </Text>
      
      <Text className="text-gray-500 text-center text-base mb-8">
        {status === 'pending' 
          ? 'O cliente está a rever a sua proposta e a fazer o pagamento retido (escrow).'
          : 'Pagamento confirmado e retido em segurança! A iniciar serviço...'}
      </Text>

      {status === 'held' && (
        <View className="bg-green-100 px-4 py-2 rounded-full">
          <Text className="text-green-700 font-semibold">Fundos Retidos ✅</Text>
        </View>
      )}
    </View>
  );
}
