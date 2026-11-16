# NewCloset 👗

App para iOS (y Android) para organizar tu armario:

- **Importa prendas con un enlace** de cualquier tienda (Zara, Mango, Uniqlo, Shein…). La app descarga la página y saca foto, nombre, marca, precio y categoría.
- **Probador con maniquí**: viste el maniquí con tus prendas, pon **tu cara** (opcional) y elige tono de piel.
- **Looks**: guarda tus conjuntos y vuelve a probarlos con un toque.
- **Premium**: añade una prenda **con una foto** y la IA (Claude) la identifica y la busca en tiendas online. Además, prendas y looks ilimitados.

![Capturas](docs/preview.png)

## Modelo de negocio

| | Gratis | Premium (3,99 €/mes · 24,99 €/año) |
|---|---|---|
| Prendas | 25 | Ilimitadas |
| Looks guardados | 3 | Ilimitados |
| Búsqueda por foto con IA | 1 de prueba | Sí |

Los límites están en `src/lib/store.tsx` (`FREE_LIMITS`) y los precios en `src/lib/purchases.ts`.

## Estructura

```
src/app/            Pantallas (Expo Router)
  (tabs)/index.tsx    Probador (maniquí)
  (tabs)/wardrobe.tsx Armario
  (tabs)/outfits.tsx  Looks guardados
  (tabs)/profile.tsx  Cara, tono de piel y plan
  add.tsx             Añadir prenda: enlace / foto IA / manual
  pick/[slot].tsx     Elegir prenda para una zona del maniquí
  garment/[id].tsx    Editar / eliminar prenda
  paywall.tsx         Pantalla Premium
src/lib/importer.ts Importador de enlaces (JSON-LD, OpenGraph)
src/lib/store.tsx   Estado + guardado local (AsyncStorage)
src/lib/purchases.ts Compras in-app (modo demo por ahora)
server/             Backend de IA (Node + Claude)
```

## Probarla en tu móvil

```bash
npm install
```

```bash
npx expo start
```

Escanea el QR con la app **Expo Go** en tu iPhone. (En la web la importación por enlace no funciona porque el navegador bloquea las descargas a otras webs; en el móvil sí.)

## Servidor de IA (función Premium por foto)

La clave de la API de Anthropic **nunca** va dentro de la app: vive en el servidor.

```bash
cd server && npm install
```

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Luego crea un `.env` en la raíz con `EXPO_PUBLIC_API_URL=http://<IP-de-tu-ordenador>:8787` (ver `.env.example`). Para producción, despliega `server/` en Railway, Render, Fly.io o similar y pon esa URL (https).

Cada búsqueda hace 2 llamadas a Claude (identificar la prenda + búsqueda web), así que tiene coste por uso: por eso es Premium.

## Publicar en la App Store

1. Cuenta de **Apple Developer** (99 $/año).
2. Cambia `ios.bundleIdentifier` en `app.json` por uno tuyo (p. ej. `com.tunombre.newcloset`).
3. **Compras reales**: crea las suscripciones en App Store Connect con los IDs de `src/lib/purchases.ts`, integra RevenueCat (`react-native-purchases`) en las funciones `purchase()` / `restorePurchases()` y pon `DEMO_PURCHASES = false`. Esto requiere un *development build* (no Expo Go).
4. Compila y sube con Expo Services:

```bash
npx eas-cli@latest build --platform ios
```

```bash
npx eas-cli@latest submit --platform ios
```

5. En App Store Connect: capturas, descripción, **política de privacidad** (obligatoria: la app usa cámara y fotos) y enlace a los términos de la suscripción.

## Próximos pasos recomendados

- **Quitar el fondo** de las fotos de prendas para que encajen mejor en el maniquí (en iOS se puede con Vision; o en el servidor).
- **Compartir desde la tienda**: extensión "Compartir" de iOS para mandar un enlace a NewCloset sin copiar/pegar.
- Sincronización en la nube / cuentas de usuario.
- Enlaces de afiliado en "Ver en la tienda" como segunda fuente de ingresos.
