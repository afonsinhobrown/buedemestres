import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Alert } from '../../lib/alertCompat';
import { supabase } from '../../lib/supabase';
import { getKycDraft, resetKycDraft } from '../../lib/kycDraft';

function parseDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

async function uploadPhoto(userId: string, uri: string, suffix: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `${userId}/${Date.now()}-${suffix}.jpg`;
  const { error } = await supabase.storage
    .from('verification-documents')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export default function ConfirmarDadosScreen() {
  const router = useRouter();
  const draft = getKycDraft();
  const [submitting, setSubmitting] = useState(false);

  const [data, setData] = useState({
    nome: '',
    numeroDoc: '',
    dataNascimento: '',
    dataValidade: '',
  });

  const submeter = async () => {
    if (!draft.frontUri || !draft.selfieUri) {
      Alert.alert('Faltam fotografias', 'Repete a captura do documento e da selfie antes de submeter.');
      router.replace('/verificacao/documento');
      return;
    }
    if (!data.numeroDoc.trim()) {
      Alert.alert('Dados incompletos', 'Indica o número do documento.');
      return;
    }
    const expiresOn = data.dataValidade ? parseDate(data.dataValidade) : null;
    if (data.dataValidade && !expiresOn) {
      Alert.alert('Data inválida', 'Usa o formato DD/MM/AAAA para a data de validade.');
      return;
    }

    try {
      setSubmitting(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Sessão expirada. Entra novamente.');

      const frontPath = await uploadPhoto(user.id, draft.frontUri, 'frente');
      const backPath = draft.backUri ? await uploadPhoto(user.id, draft.backUri, 'verso') : null;
      const selfiePath = await uploadPhoto(user.id, draft.selfieUri, 'selfie');

      const { error: insertError } = await supabase.from('verification_documents').insert({
        provider_id: user.id,
        doc_type: 'bi',
        doc_number: data.numeroDoc.trim(),
        front_path: frontPath,
        back_path: backPath,
        selfie_path: selfiePath,
        expires_on: expiresOn,
        status: 'pending',
        stage: 'manual_review',
      });
      if (insertError) throw insertError;

      const { error: profileError } = await supabase
        .from('provider_profiles')
        .update({ verification: 'pending' })
        .eq('profile_id', user.id);
      if (profileError) throw profileError;

      resetKycDraft();
      router.replace('/verificacao/aguardar');
    } catch (err: any) {
      Alert.alert('Erro ao submeter', err?.message || 'Não foi possível enviar os documentos.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirmar Dados</Text>
      <Text style={styles.subtitle}>
        Confirma os dados do teu documento e submete para aprovação da equipa.
      </Text>

      <ScrollView style={styles.scroll}>
        <View style={styles.field}>
          <Text style={styles.label}>Nome Completo</Text>
          <TextInput
            style={styles.input}
            value={data.nome}
            onChangeText={(t) => setData({ ...data, nome: t })}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Nº do Documento</Text>
          <TextInput
            style={styles.input}
            value={data.numeroDoc}
            onChangeText={(t) => setData({ ...data, numeroDoc: t })}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Data de Nascimento</Text>
          <TextInput
            style={styles.input}
            placeholder="DD/MM/AAAA"
            value={data.dataNascimento}
            onChangeText={(t) => setData({ ...data, dataNascimento: t })}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Data de Validade</Text>
          <TextInput
            style={styles.input}
            placeholder="DD/MM/AAAA"
            value={data.dataValidade}
            onChangeText={(t) => setData({ ...data, dataValidade: t })}
          />
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.submitBtn} onPress={submeter} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Submeter Verificação</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { color: '#6B7280', marginBottom: 32 },
  scroll: { flex: 1 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#4B5563', marginBottom: 4 },
  input: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});
