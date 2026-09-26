# Bonavista Dashboard

Prototipo estático para validar los indicadores de Bonavista Apartments. Se abre desde GitHub Pages o mediante `index.html` en un navegador compatible. Pablo solo selecciona las dos exportaciones de Bookypro: reservas `.xlsx` y servicios `.csv`. No necesita Python ni instalar paquetes.

## Publicación

Publicar la raíz del repositorio en GitHub Pages (`Settings → Pages → Deploy from a branch → main /root`). El código y las fórmulas serán públicos; los ficheros de reservas nunca deben añadirse al repositorio. La librería JSZip se incluye localmente para no depender de un CDN.

## Históricos locales

Cada importación distinta crea una instantánea en IndexedDB del navegador que hizo la carga. Una carga idéntica no se duplica. La vista acumulada toma la captura más reciente de cada mes y conserva las anteriores para pickup; confirmado por Ignacio: cada exportación del PMS contiene todas las reservas del mes. Por tanto, la captura más reciente sustituye a la anterior solo en la vista vigente; las versiones previas se conservan para pickup. El usuario puede reabrir instantáneas, descargar una copia JSON conjunta de reservas, mercado e hipótesis y volver a incorporarla sin borrar el histórico presente. **La copia descargada incluye IDs de reserva y datos analíticos**; aunque se excluyen nombres, teléfonos, emails y documentos, hay que guardarla en una carpeta privada. No subirla a GitHub. El almacenamiento del navegador puede borrarse al limpiar datos, cambiar de dispositivo o usar modo privado. El pickup se calcula al disponer de dos capturas comparables del mismo mes.

## Métricas actuales y límites

- Producción PVP, reservas, noches, estancia media, huéspedes medios, antelación, canal, edificio, país y tarifa.
- Filtros por edificio y mes de llegada; evolución por mes de llegada y salida imprimible a PDF.
- Ocupación, ADR, RevPAR, canal directo y comparación interanual aparecen con hipótesis editables y advertencias de cobertura. Las cancelaciones permiten introducir noches canceladas; el pickup automático y los precios comparables aún requieren datos/integración. La reputación permite registrar manualmente capturas por plataforma y edificio, con categorías cuando estén disponibles.
- Las reservas con estancias que cruzan dos meses se atribuyen **íntegras al mes de llegada** en este prototipo. No usar las cifras como cierre financiero definitivo.
- El total PVP se concilia con los conceptos del CSV menos `Precio de descuento` del Excel. Los 311 registros de la muestra de septiembre de 2026 cuadran tras incorporar ese descuento. Confirmar con Pablo el tratamiento contable antes del cierre definitivo.

## Datos que faltan

Inventario y bloqueos diarios por apartamento; estados de reservas canceladas; periodos 2025 y 2026 comparables; regla fiscal de ADR y limpieza; mapeo de canal directo; enlaces y accesos a perfiles de reseñas; conjunto competitivo para precios.

## Privacidad

El procesamiento se ejecuta en el navegador. La importación del Excel usa una lista positiva de columnas analíticas; las columnas de nombre, email, teléfono, dirección y documentos nunca entran en el modelo ni en las instantáneas. No hay servidor de aplicación ni envío de los archivos a un backend. No usar exportaciones reales como fixtures, ejemplos ni archivos de prueba del repositorio público.

## Identidad visual

La versión v0.5 incorpora el logo SVG de Bonavista Apartments, guardado en `assets/logo.svg`, y el carmín corporativo `#E4042C`. Fuente del logo: `https://bonavista-apartments.com/assets/themes/bonavista-apartments.com/uploads/img/menu/logo.svg`. En cabecera se muestra en blanco sobre carmín mediante CSS; en impresión conserva el rojo original sobre fondo blanco.

## Hipótesis para la reunión

El número de apartamentos se inicializa con los códigos distintos de `Alojamiento` observados en el archivo, pero puede omitir unidades sin reservas. Los bloqueos arrancan en cero y el IVA supuesto para ADR es 10 %. Estas hipótesis son editables; no convierten la estimación en una medición definitiva. Si se exportan solo llegadas de un mes, la ocupación de ese mes puede omitir estancias iniciadas anteriormente. El importe de alquiler se reparte entre las noches y se resta el descuento antes de estimar ADR. El acumulado se etiqueta como incompleto cuando faltan meses en la importación.

## Gráficos y presentación a Pablo

La pantalla incluye producción mensual y diaria, mix de canales, estancia, ocupantes, países, tarifas, antelación y noches por edificio. Incluye también todos los KPI pedidos por Pablo: producción, ocupación, ADR, RevPAR, perfil de cliente, cancelaciones, pickup y reputación. Los últimos indicadores usan hipótesis editables o muestran explícitamente que falta una fuente. El desglose mensual se abre al seleccionar una tarjeta. Para los países se usa porcentaje de reservas; para canales, porcentaje del PVP.

La vista privada de revisión se distribuye separada del código público. Contiene datos analíticos derivados de la exportación de Pablo; no se publica en GitHub.

## Comparación interanual

Se puede importar una sola vez un JSON agregado `bonavista-historical-v1` con datos mensuales por edificio: `final` y `bookedByDay[1..31]`. El panel principal muestra para el mes en curso el cierre anterior arriba como meta, el PVP actual a la fecha de exportación y el año anterior al mismo día; añade progreso frente a la meta, variación frente al mes pasado cuando existe su carga y variación interanual al mismo día. Para meses pasados compara únicamente cierres completos y la variación interanual es entre cierres. La curva del año anterior es una reconstrucción retrospectiva desde fechas de creación y estados finales, no una instantánea guardada entonces; puede ignorar modificaciones de precio o cancelaciones a lo largo del tiempo. La vista privada lleva incorporado el histórico agregado 2024–25 derivado del Excel aportado, junto al JSON para importarlo en la app pública sin compartir reservas individuales. El panel señala diferencias de cartera entre años.

Cada tarjeta abre un panel con valor calculado, desglose por mes, edificio, canal, tarifa o país cuando el indicador admite ese corte, y la lista de reservas subyacentes.

## Cargas mensuales y acumulado

Cada carga queda como captura fechada. La vista «Ver acumulado» toma **la captura más reciente para cada mes de llegada** y concatena sus reservas una sola vez; las capturas anteriores siguen disponibles para el pickup. «Abrir captura» muestra solo la carga elegida. El comparativo principal usa el mes seleccionado o el último mes presente y la fecha de corte extraída del nombre del XLSX (editable). Los datos de 2025 incluidos en la vista privada provienen de la hoja `Datos` del Excel histórico y el total de septiembre de 2025 coincide con la hoja `Producción` (261.944,93 €).

## Mercado y reputación a demanda

**Experiencia acordada para Pablo:** abrir la aplicación, subir los dos ficheros y pulsar «Actualizar mercado» cuando quiera. No instalar Node.js, Playwright ni introducir comandos. El lector local incluido en `integrations/` es material de desarrollo y no una instrucción de operación para Pablo. La implementación prevista aloja la interfaz y el servicio de consulta en una aplicación privada gestionada; el servicio ejecuta la lectura en el servidor, devuelve solo notas y precios autorizados y nunca recibe el XLSX/CSV de reservas.

Mientras no se despliegue ese servicio, el botón figura desactivado y comunica que está pendiente de conexión. La variable `window.BONAVISTA_MARKET_ENDPOINT` se configura en el despliegue y debe apuntar a un endpoint protegido del mismo origen. Una consulta sin cambios no duplica registros. Se puede importar un JSON de mercado desde un proveedor mientras tanto. El contrato está en [`integrations/README.md`](integrations/README.md). La lectura automática en webs reales no está aún verificada ni activada; Booking, Expedia y Airbnb restringen la extracción automatizada en sus condiciones públicas.

La impresión A4 tiene estilos para KPIs, gráficos y tabla de mercado. Queda pendiente validar visualmente las páginas resultantes en un navegador con los datos del proyecto antes de considerarla definitiva.

## Comparativas del Excel de Pablo y MAT

El Excel de Pablo contiene tablas dinámicas para producción, canales, noches, personas, países, tarifas y antelación; los gráficos de tres referencias descritos por Ignacio no aparecen como objetos de gráfico en ese archivo y se han construido a partir de su explicación. El dashboard representa para meses cerrados dos cifras de cierre, y solo para el mes en curso una tercera cifra del año anterior reconstruida a la fecha de corte. También aplica la comparación a los diez gráficos de análisis: producción mensual y diaria, canales, estancia, personas, países, tarifas, antelación, noches por edificio y cancelaciones. El año anterior «a fecha» es una reconstrucción desde la fecha de creación y el estado final de cada reserva, no una captura conservada entonces; las cancelaciones de aquel día no se pueden reconstruir y se muestran sin valor. Los totales anuales completos sí vienen del histórico.

La comparación mensual principal permite alternar entre PVP y noches reservadas. Ignacio confirma PVP y propone validar con Pablo la segunda variable, aún no identificada.

El bloque MAT calcula ventanas consecutivas de doce meses completos para producción PVP, noches, reservas, estancia media, ocupantes medios, antelación, peso directo y un ADR de alquiler sujeto a la hipótesis fiscal editable. Cada media y porcentaje se calcula con su denominador agregado de los doce meses, sin promediar doce porcentajes. La muestra solo contiene septiembre de 2026; el último MAT completo disponible acaba en diciembre de 2025. Al importar los meses restantes avanzará automáticamente. El histórico analítico agregado v2 se genera exclusivamente a partir de datos no personales: nunca se publica en el repositorio abierto. La vista privada lo lleva incorporado; la versión pública acepta su JSON mediante la importación del histórico.

El desglose de cada KPI agrupa ahora la lista de «Reservas incluidas» por mes, edificio, canal, tarifa o país. Al pulsar una fila del resumen filtra la lista a ese grupo.
