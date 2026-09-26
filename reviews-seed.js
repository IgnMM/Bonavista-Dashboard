/* Real public review scores, captured manually on 2026-09-26 from each platform's public listing page.
   Safe to publish: these are the platforms' own public ratings, not derived from Bookypro reservations.
   Re-running this seed is harmless (market.js dedupes by platform+building+source, only new scores are stored). */
(function(){
  const CAPTURED = '2026-09-26T12:00:00Z';
  const SEED = { format:'bonavista-market-v1', reviews:[
    {platform:'Booking',building:'Bonavista Virreina',score:8.7,capturedAt:CAPTURED,source:'https://www.booking.com/hotel/es/bonavista-apartments-barcelona-virreina.html',categories:{}},
    {platform:'Booking',building:'Bonavista Passeig de Gracia',score:9.3,capturedAt:CAPTURED,source:'https://www.booking.com/hotel/es/bonavista-apartments-barcelona.html',categories:{}},
    {platform:'Booking',building:'Bonavista Pedrera',score:8.7,capturedAt:CAPTURED,source:'https://www.booking.com/hotel/es/bonavista-apartments-pedrera-barcelona.html',categories:{}},
    {platform:'Booking',building:'Bonavista Eixample',score:8.6,capturedAt:CAPTURED,source:'https://www.booking.com/hotel/es/bonavista-apartments-barcelona-eixample.html',categories:{}},
    {platform:'Expedia',building:'Bonavista Virreina',score:9.2,capturedAt:CAPTURED,source:'https://www.expedia.com/Barcelona-Hotels-Bonavista-Apartments-Virreina.h10245743.Hotel-Information',categories:{}},
    {platform:'Expedia',building:'Bonavista Passeig de Gracia',score:9.6,capturedAt:CAPTURED,source:'https://www.expedia.com/Barcelona-Hotels-Bonavista-Apartments-Passeig-De-Gracia.h10245491.Hotel-Information',categories:{}},
    {platform:'Expedia',building:'Bonavista Pedrera',score:8.8,capturedAt:CAPTURED,source:'https://www.expedia.com/Barcelona-Hotels-Bonavista-Apartments-Pedrera.h16448601.Hotel-Information',categories:{}},
    {platform:'Expedia',building:'Bonavista Eixample',score:8.6,capturedAt:CAPTURED,source:'https://www.expedia.com/Barcelona-Hotels-Bonavista-Apartments-Eixample.h10245905.Hotel-Information',categories:{}},
    {platform:'Airbnb',building:'Bonavista Virreina',score:4.71,capturedAt:CAPTURED,source:'https://www.airbnb.com/rooms/43235590',categories:{}},
    {platform:'Airbnb',building:'Bonavista Passeig de Gracia',score:4.86,capturedAt:CAPTURED,source:'https://www.airbnb.com/rooms/1329067',categories:{}},
    {platform:'Airbnb',building:'Bonavista Eixample',score:4.66,capturedAt:CAPTURED,source:'https://www.airbnb.com/rooms/43236801',categories:{}},
    {platform:'Google',building:'Bonavista Virreina',score:4.3,capturedAt:CAPTURED,source:'https://www.google.com/maps/search/Bonavista+Apartments+Virreina+Barcelona',categories:{}},
    {platform:'Google',building:'Bonavista Passeig de Gracia',score:4.7,capturedAt:CAPTURED,source:'https://www.google.com/maps/search/Bonavista+Apartments+Passeig+de+Gracia+Barcelona',categories:{}},
    {platform:'Google',building:'Bonavista Pedrera',score:4.5,capturedAt:CAPTURED,source:'https://www.google.com/maps/place/Bonavista+Apartments+-+Pedrera',categories:{}},
    {platform:'Google',building:'Bonavista Eixample',score:3.6,capturedAt:CAPTURED,source:'https://www.google.com/maps/place/Bonavista+Apartments+-+Eixample',categories:{}},
    {platform:'Google',building:'Bonavista Tamarit',score:5,capturedAt:CAPTURED,source:'https://www.google.com/maps/search/Bonavista+Apartments+Tamarit+Barcelona',categories:{}}
  ], rates:[
    {property:'Bonavista Apartments - Virreina (propio, Booking)',building:'Bonavista Virreina',source:'https://www.booking.com/hotel/es/bonavista-apartments-barcelona-virreina.html',capturedAt:CAPTURED,checkin:'2026-10-15',nights:2,guests:2,currency:'EUR',total:535,plan:'estándar, impuestos incluidos'},
    {property:'Espais Blaus Apartments (competidor, referencia provisional a validar con Pablo)',building:'Bonavista Virreina',source:'https://www.booking.com/hotel/es/espais-blaus-apartments.html',capturedAt:CAPTURED,checkin:'2026-10-15',nights:2,guests:2,currency:'EUR',total:702,plan:'estándar'}
  ]};
  function trySeed(){
    if(!window.BONAVISTA_MARKET){setTimeout(trySeed,50);return}
    window.BONAVISTA_MARKET.ingest(SEED);
  }
  trySeed();
})();
