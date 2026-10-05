import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { auth, db } from './firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  
  if (data) {
    const { locations } = data as any;
    if (locations && locations.length > 0) {
      const location = locations[0];
      
      const user = auth.currentUser;
      if (!user) return;

      // Actualizar a presença do provedor na base de dados
      const presenceRef = doc(db, 'provider_presence', user.uid);
      await setDoc(presenceRef, {
        provider_id: user.uid,
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        last_seen: new Date().toISOString(),
        is_online: true
      }, { merge: true });
    }
  }
});

export const startLocationTracking = async () => {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus === 'granted') {
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus === 'granted') {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // 30 segundos
        distanceInterval: 10,
        deferredUpdatesInterval: 30000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "Bué de Mestres (Pro)",
          notificationBody: "A partilhar a sua localização para receber pedidos.",
          notificationColor: "#2563eb",
        }
      });
    }
  }
};

export const stopLocationTracking = async () => {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    
    // Marcar como offline quando parar
    const user = auth.currentUser;
    if (user) {
      const presenceRef = doc(db, 'provider_presence', user.uid);
      await updateDoc(presenceRef, { is_online: false });
    }
  }
};
