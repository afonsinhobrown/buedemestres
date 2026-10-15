import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
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
    <View style={styles.container}>
      <Text style={styles.title}>Verificação de Identidade</Text>
      <Text style={styles.subtitle}>
        Precisamos de validar a sua identidade para garantir a segurança da plataforma.
      </Text>

      <ScrollView style={styles.scrollView}>
        {steps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <View style={[
              styles.stepBadge,
              step.done ? styles.bgGreen : step.active ? styles.bgBlue : styles.bgGray
            ]}>
              <Text style={styles.stepBadgeText}>{step.done ? '✓' : index + 1}</Text>
            </View>
            <Text style={[
              styles.stepText,
              step.active ? styles.stepTextActive : styles.stepTextInactive
            ]}>
              {step.title}
            </Text>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity 
        onPress={() => router.push('/verificacao/documento')}
        style={styles.submitBtn}
      >
        <Text style={styles.submitBtnText}>Começar Captura</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    color: '#6B7280',
    marginBottom: 32,
  },
  scrollView: {
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  bgGreen: {
    backgroundColor: '#22C55E',
  },
  bgBlue: {
    backgroundColor: '#2563EB',
  },
  bgGray: {
    backgroundColor: '#E5E7EB',
  },
  stepBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  stepText: {
    fontSize: 18,
  },
  stepTextActive: {
    fontWeight: 'bold',
    color: '#111827',
  },
  stepTextInactive: {
    color: '#6B7280',
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
