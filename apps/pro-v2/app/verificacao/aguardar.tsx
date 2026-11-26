import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function AguardarRevisaoScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>⏳</Text>
      </View>
      
      <Text style={styles.title}>
        Dados em Revisão
      </Text>
      
      <Text style={styles.subtitle}>
        A nossa equipa está a analisar a sua submissão. Este processo costuma demorar até 24 horas úteis. 
        Receberá uma notificação assim que o seu perfil for aprovado!
      </Text>

      <TouchableOpacity 
        onPress={() => router.replace('/')}
        style={styles.btnHome}
      >
        <Text style={styles.btnHomeText}>Voltar ao Início</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    backgroundColor: '#EFF6FF',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 18,
    marginBottom: 32,
    lineHeight: 26,
  },
  btnHome: {
    width: '100%',
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnHomeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
