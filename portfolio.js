/* For YTD, use the newest saved snapshot for each arrival month. Older snapshots stay available for pickup. */
window.PORTFOLIO_BOOKINGS=null;
window.PORTFOLIO_ASOF={};
window.PORTFOLIO_CANCELLED=[];window.PORTFOLIO_CANCELLED_KNOWN=new Set();
/* Noches canceladas (arrival-month) de los meses indicados; null si algún mes con reservas no tiene dato de canceladas en su captura. */
function cancelledNightsFor(months,building){
 const list=window.PORTFOLIO_CANCELLED||[],known=window.PORTFOLIO_CANCELLED_KNOWN||new Set(),have=new Set((window.PORTFOLIO_BOOKINGS||[]).map(x=>x.month));
 const need=months.filter(m=>have.has(m));if(!need.length||!need.every(m=>known.has(m)))return null;
 return list.filter(r=>months.includes(r.month)&&(!building||matchBuilding(r.building,building))).reduce((n,r)=>n+Number(r.nights||0),0)}
async function refreshPortfolio(){
  const snapshots=await listSnapshots();
  const selected=new Map(),asOf={},source=new Map();
  for(const shot of snapshots){
    const byMonth=new Map();
    for(const booking of shot.data.bookings){
      if(!byMonth.has(booking.month))byMonth.set(booking.month,[]);
      byMonth.get(booking.month).push(booking);
    }
    for(const [month,rows] of byMonth){
      if(selected.has(month))continue;
      selected.set(month,rows);source.set(month,shot);asOf[month]=shot.data.meta.as_of||shot.id.slice(0,10);
    }
  }
  window.PORTFOLIO_BOOKINGS=[...selected.entries()].sort(([a],[b])=>a.localeCompare(b)).flatMap(([,rows])=>rows);
  window.PORTFOLIO_ASOF=asOf;
  const cancelled=[],known=new Set();
  for(const [month,shot] of source){const list=shot.data.meta?.cancelled;if(!Array.isArray(list))continue;known.add(month);for(const r of list)if(r.month===month)cancelled.push(r)}
  for(const shot of snapshots){const list=shot.data.meta?.cancelled;if(!Array.isArray(list))continue;const fresh=new Set();for(const r of list){if(source.has(r.month)||known.has(r.month))continue;cancelled.push(r);fresh.add(r.month)}for(const m of fresh)known.add(m)}
  window.PORTFOLIO_CANCELLED=cancelled;window.PORTFOLIO_CANCELLED_KNOWN=known;
}
