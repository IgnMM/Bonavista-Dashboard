# Prototipo de lector de valoraciones (desarrollo)

Este lector se ejecutó como prototipo local de desarrollo. **Pablo no tendrá que instalarlo ni ejecutar comandos**: el servicio final se alojará y administrará con el dashboard. No se utilizan API ni credenciales de Booking, Expedia o Airbnb. El lector visita las fichas públicas enumeradas en `public-pages.json`, intenta leer la nota global y categorías visibles y devuelve por separado los errores. No inicia sesión ni intenta superar bloqueos de acceso. Las URL son fichas encontradas en buscadores y deben cotejarse con Pablo, especialmente cuando una plataforma tiene varias fichas por apartamento.

Las fichas se leen **en paralelo entre plataformas distintas** (Booking, Expedia, Airbnb y Google a la vez, cada una en su propia pestaña), pero **una detrás de otra dentro de la misma plataforma** (con una pequeña pausa entre fichas): pedir varias fichas de Booking o Expedia a la vez hizo que Expedia respondiera con HTTP 429 (demasiadas peticiones) en la primera prueba real.

## Competencia (benchmark)

`public-pages.json` tiene un segundo array, `competitors`, separado de `profiles` (que son las fichas propias de Bonavista). Es una lista manual: hay que añadir cada competidor a mano, con su URL de Google Maps. No hay descubrimiento automático por zona.

Por decisión explícita (2026-09-29): los competidores **solo se leen de Google**, nunca de Booking o Expedia — ambas restringen el acceso automatizado en sus condiciones y el riesgo es mayor cuantas más fichas ajenas se consultan. Si se añade un competidor con otra plataforma, el lector lo salta y lo reporta en `errors` sin visitarlo; es un control en el propio código (`COMPETITOR_ALLOWED_PLATFORMS`), no solo una nota en este documento.

Esquema de cada entrada de `competitors`:

```json
{
  "platform": "Google",
  "competitor": "Nombre del alojamiento competidor",
  "building": "Bonavista Virreina",
  "postalCode": "08001",
  "businessType": "hotel",
  "url": "https://www.google.com/maps/place/..."
}
```

- `building`: el edificio de Bonavista con el que se compara (para filtrar en el dashboard junto al resto de cifras de ese edificio).
- `postalCode` / `businessType` ("hotel", "aparthotel", etc.): metadatos libres, se muestran como etiqueta junto a la nota y sirven para filtrar la lista de competidores en el dashboard.
- El resultado lleva estos mismos campos (`competitor`, `postalCode`, `businessType`) además de `platform`/`building`/`score`/`categories`/`capturedAt`/`source`, para que el dashboard distinga la reputación propia de la de cada competidor.

Solo para un desarrollador que quiera probar el prototipo local:

```sh
cd integrations
npm install
npx playwright install chromium
npm start
```

Esta prueba local no constituye el despliegue para Pablo. Las reservas Bookypro no se envían al lector. La consulta puede fallar según cambios en cada página o limitaciones de acceso; aún no ha sido posible verificarla de extremo a extremo sobre las webs reales desde este entorno. La arquitectura final requiere un servicio alojado y acceso restringido; GitHub Pages por sí solo no ejecuta este lector.

Booking, Expedia y Airbnb restringen el acceso automatizado en sus condiciones públicas. La lectura puede ser técnicamente posible, pero antes de activar una fuente Bonavista debe elegir conscientemente el método de obtención, con preferencia por una exportación o proveedor que ya utilice su equipo. Se puede excluir cualquier plataforma quitando sus filas de `public-pages.json`.

La **consulta de precios** permanece sin automatizar: hay que fijar lista de comparables, ciudad/zona, fechas, ocupación, duración, condiciones y precio total con impuestos; un precio genérico mostrado en una página sin esos criterios no es comparable. El lector devuelve `rates: []` hasta definir y validar esas reglas. Las fuentes que deniegue o no logre leer se muestran como no disponibles.

**Criterios de comparabilidad confirmados con Pablo (2026-09-30):** mismo barrio, categoría de apartamento similar, estancia de 2 noches, 2 adultos, tarifa flexible/cancelable, precio final con impuestos incluidos. Pablo no tiene un benchmark de revenue management propio que imponer aquí ("no entraría en el mundo revenue, a nivel del desarrollo del dashboard") — estos criterios, propuestos por Ignacio, son los que rigen. Cualquier tarifa capturada que no cumpla estas condiciones no debe guardarse como comparable.

## Contrato de datos

Esquema de cada valoración: `{ "platform": "Booking|Expedia|Airbnb|Google", "building": "nombre tal como figura en el dashboard", "score": 8.4, "capturedAt": "2026-09-26T10:00:00Z", "source": "https://...", "categories": {"cleaning":8.2,"staff":9.0,"location":8.5} }`. Booking y Expedia usan escala de 0 a 10; Airbnb y Google, de 0 a 5. El conector debe obtener el score directamente de la ficha pública, identificar la ficha correspondiente y aportar su URL verificable.

Esquema de cada tarifa: `{ "property": "alojamiento comparable", "building": "nombre del edificio Bonavista de referencia", "source": "https://...", "capturedAt": "2026-09-26T10:00:00Z", "checkin": "2026-10-01", "nights": 2, "guests": 2, "currency": "EUR", "total": 280, "plan": "cancelación flexible" }`. `total` debe incluir todos los conceptos aplicables y el proveedor debe normalizar moneda, impuestos, ocupación, noches, condiciones y canal de compra. No comparar tarifas con criterios distintos sin avisarlo.

La app guarda localmente un cambio de valoración solo si la nota o categorías difieren de la última captura de esa ficha; guarda cada tarifa nueva por ficha, fuente, fechas, ocupantes, importe, moneda y plan. Una recarga idéntica informa 0 nuevos. Se puede importar la misma respuesta JSON manualmente para ensayar el contrato o usar exportaciones facilitadas por un proveedor con permiso.

Accesos necesarios para el conector: IDs de fichas de Bonavista en Booking, Expedia, Airbnb y Google; autorización API de las plataformas o del gestor de canales; proveedor de tarifas con derecho a consultar y almacenar resultados; lista de competidores por zona y reglas de estancia. Airbnb prohíbe el scraping automatizado de su web en sus condiciones: obtener datos desde una integración autorizada o un proveedor con licencia.
