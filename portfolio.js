/* For YTD, use the newest saved snapshot for each arrival month. Older snapshots stay available for pickup. */
window.PORTFOLIO_BOOKINGS=null;
window.PORTFOLIO_ASOF={};
async function refreshPortfolio(){
  const snapshots=await listSnapshots();
  const selected=new Map(),asOf={};
  for(const shot of snapshots){
    const byMonth=new Map();
    for(const booking of shot.data.bookings){
      if(!byMonth.has(booking.month))byMonth.set(booking.month,[]);
      byMonth.get(booking.month).push(booking);
    }
    for(const [month,rows] of byMonth){
      if(selected.has(month))continue;
      selected.set(month,rows);asOf[month]=shot.data.meta.as_of||shot.id.slice(0,10);
    }
  }
  window.PORTFOLIO_BOOKINGS=[...selected.entries()].sort(([a],[b])=>a.localeCompare(b)).flatMap(([,rows])=>rows);
  window.PORTFOLIO_ASOF=asOf;
}
