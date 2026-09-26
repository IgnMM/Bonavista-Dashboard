# Bonavista Dashboard

Prototipo estático para validar los indicadores de Bonavista Apartments. Se abre desde GitHub Pages o mediante `index.html` en un navegador compatible. Pablo solo selecciona las dos exportaciones de Bookypro: reservas `.xlsx` y servicios `.csv`. No necesita Python ni instalar paquetes.

## Publicación

Publicar la raíz del repositorio en GitHub Pages (`Settings → Pages → Deploy from a branch → main /root`). El código y las fórmulas serán públicos; los ficheros de reservas nunca deben añadirse al repositorio. La librería JSZip se incluye localmente para no depender de un CDN.

## Históricos locales

Cada importación correcta crea una instantánea en IndexedDB del navegador que hizo la carga. El usuario puede reabrir instantáneas y descargar un JSON de copia de seguridad. **La copia descargada incluye IDs de reserva y datos analíticos**; aunque se excluyen nombres, teléfonos, emails y documentos, hay que guardarla en una carpeta privada. No subirla a GitHub. El almacenamiento del navegador puede borrarse al limpiar datos, cambiar de dispositivo o usar modo privado. Aún no se calcula pickup a partir de estas instantáneas.

## Métricas actuales y límites

- Producción PVP, reservas, noches, estancia media, huéspedes medios, antelación, canal, edificio, país y tarifa.
- Filtros por edificio y mes de llegada; evolución por mes de llegada y salida imprimible a PDF.
- Pendientes ocupación, ADR sin IVA, RevPAR, cancelaciones, pickup, YoY, reputación y precios comparables. Requieren datos, definiciones o integraciones adicionales.
- Las reservas con estancias que cruzan dos meses se atribuyen **íntegras al mes de llegada** en este prototipo. No usar las cifras como cierre financiero definitivo.
- El total PVP se concilia con los conceptos del CSV menos `Precio de descuento` del Excel. Los 311 registros de la muestra de septiembre de 2026 cuadran tras incorporar ese descuento. Confirmar con Pablo el tratamiento contable antes del cierre definitivo.

## Datos que faltan

Inventario y bloqueos diarios por apartamento; estados de reservas canceladas; periodos 2025 y 2026 comparables; regla fiscal de ADR y limpieza; mapeo de canal directo; enlaces y accesos a perfiles de reseñas; conjunto competitivo para precios.

## Privacidad

El procesamiento se ejecuta en el navegador. La importación del Excel usa una lista positiva de columnas analíticas; las columnas de nombre, email, teléfono, dirección y documentos nunca entran en el modelo ni en las instantáneas. No hay servidor de aplicación ni envío de los archivos a un backend. No usar exportaciones reales como fixtures, ejemplos ni archivos de prueba del repositorio público.

## Identidad visual

La versión v0.5 incorpora el logo SVG de Bonavista Apartments, guardado en `assets/logo.svg`, y el carmín corporativo `#E4042C`. Fuente del logo: `https://bonavista-apartments.com/assets/themes/bonavista-apartments.com/uploads/img/menu/logo.svg`. En cabecera se muestra en blanco sobre carmín mediante CSS; en impresión conserva el rojo original sobre fondo blanco.
