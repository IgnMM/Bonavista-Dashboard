# Preguntas para Pablo — Dashboard

Registro acumulativo. Actualizado: 26 de septiembre de 2026.

## Definiciones y conciliación

1. **Producción PVP:** ¿confirmas que `Precio total` representa la venta final después de aplicar `Precio de descuento`, incluyendo alquiler, limpieza, tasa y demás conceptos? En la muestra, las 311 reservas concilian al restar el descuento de la suma del CSV.
2. **ADR:** ¿qué componentes quieres incluir? Propuesta a validar: ingreso de alojamiento sin IVA y sin tasa turística ni limpieza final. ¿Se descuentan comisiones y promociones? ¿Qué tipo de IVA corresponde a cada concepto?
3. **Atribución mensual:** si una estancia cruza dos meses, ¿quieres repartir ingresos y noches entre las fechas reales de estancia? Es la recomendación para ocupación, ADR y RevPAR.
4. **Canal directo:** ¿qué valores de `Canal` cuentan como venta directa (`Bonavista`, `Witbooking`, `Excliente` u otros)? ¿El canal `Excliente` indica una reserva directa o también es una etiqueta de procedencia del huésped? En el ejemplo, `Canal` está informado en 310/311 reservas; `Vía web` figura como «No» en todas.

## Datos necesarios

5. **Ocupación y RevPAR:** ¿puedes facilitar el inventario de apartamentos por edificio y las fechas de apertura, cierre o fuera de servicio? ¿Bookypro exporta noches disponibles a diario?
6. **Comparaciones:** ¿puedes descargar los mismos dos archivos para 2025 y para los meses transcurridos de 2026, manteniendo exactamente los filtros y estados usados? ¿Qué fecha de corte quieres para comparar el mes actual con el mismo momento del año anterior?
7. **Cancelaciones:** ¿puedes obtener exportaciones que incluyan reservas canceladas y, si existe, fecha de cancelación, noches y valor cancelado? La muestra solo contiene `Confirmed`.
8. **Pickup:** ¿con qué frecuencia descargarás las exportaciones (diaria/semanal)? Para calcular cambios reales necesitamos instantáneas fechadas del mismo periodo de estancia. ¿Bookypro permite recuperar informes históricos «tal como estaban» en fechas pasadas?

## Reputación y mercado

9. **Fichas de reseñas:** enlaces exactos de cada edificio/alojamiento en Booking, Expedia, Airbnb y Google; ¿quién administra cada cuenta? ¿Usáis ya una herramienta que agrupe opiniones?
10. **Precios de referencia:** ¿qué competidores, edificios y categorías compara el revenue manager? ¿Qué herramienta o fuente utiliza, para qué fechas de estancia y con qué frecuencia? ¿Quiere precio final para huésped bajo condiciones equivalentes?

## Operación y acceso

11. **Uso:** ¿quién accederá al dashboard, con qué permisos y desde qué equipos? Si el histórico queda en el navegador del ordenador de Pablo, ¿es suficiente para el piloto o debe compartirse entre personas?
12. **PDF:** ¿qué páginas/indicadores necesita imprimir o enviar, y con qué frecuencia?

## Decisiones ya tomadas para el piloto

- Subida manual del XLSX de reservas y CSV de servicios.
- Cálculo local en el navegador, sin Python para Pablo.
- Nunca subir exportaciones reales ni copias de seguridad al repositorio público.
- Instantáneas locales y copia descargable; la ubicación de un almacenamiento compartido se decidirá después.
