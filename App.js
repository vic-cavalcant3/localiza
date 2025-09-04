import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

// Local de interesse solicitado
const TARGET = { lat: -23.54280718198987, lng: -46.35692985923024 };

const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    html, body, #map { height:100%; margin:0; padding:0; }
    .badge {
      position: absolute; bottom: 10px; right: 10px;
      background: rgba(255,255,255,0.9); padding: 4px 8px; border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 12px; color: #333;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="badge">© OpenStreetMap contributors</div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    // Inicia já focado no ponto solicitado
    var map = L.map('map', { zoomControl: true }).setView([${TARGET.lat}, ${TARGET.lng}], 16);

    // Tiles OSM (sem chave)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Marcador do ponto solicitado
    var targetMarker = L.marker([${TARGET.lat}, ${TARGET.lng}]).addTo(map)
      .bindPopup('Local de interesse').openPopup();

    // Marcador opcional da posição do usuário (se o app enviar)
    var userMarker = null;
    function setUserLocation(lat, lng) {
      if (userMarker) { map.removeLayer(userMarker); }
      userMarker = L.marker([lat, lng], { title: 'Você está aqui' })
        .addTo(map)
        .bindPopup('Você está aqui');
    }

    // Recebe mensagens do React Native
    function handleMessage(e) {
      try {
        var data = JSON.parse(e.data);
        if (data && data.type === 'setLocation') {
          setUserLocation(data.lat, data.lng);
        }
      } catch (_) {}
    }
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>
`;

export default function App() {
  const webRef = useRef(null);
  const [loading, setLoading]   = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Permissão de localização é opcional — o mapa já abre no TARGET
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' && canAskAgain) {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
        }

        if (status === 'granted' && servicesEnabled) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            mayShowUserSettingsDialog: true
          });
          if (!mounted) return;
          const payload = JSON.stringify({
            type: 'setLocation',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          webRef.current?.postMessage(payload);
        }
      } catch (e) {
        if (mounted) setErrorMsg(e?.message ?? 'Erro ao obter localização.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: LEAFLET_HTML }}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        setSupportMultipleWindows={false}
      />

      {loading && (
        <View className="overlay" style={styles.overlay}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>Carregando mapa…</Text>
        </View>
      )}

      {errorMsg && !loading && (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)'
  },
  muted: { marginTop: 8, opacity: 0.7 },
  errorBox: {
    position: 'absolute', top: 12, left: 12, right: 12,
    backgroundColor: '#fff', padding: 8, borderRadius: 8, elevation: 2
  },
  error: { color: 'red', fontSize: 14, textAlign: 'center' }
});

