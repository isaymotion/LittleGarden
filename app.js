(() => {
  "use strict";
  const STORAGE_KEY = "little-garden-expenses-v1";
  const categories = [
    {name:"Groceries", icon:"🥬", area:"Daily living", color:"#80a878"},
    {name:"Restaurants & Dining", icon:"🍲", area:"Daily living", color:"#e7b66c"},
    {name:"Medications & Healthcare", icon:"🌼", area:"Health & care", color:"#d98d8b"},
    {name:"Property & Real Estate", icon:"🏡", area:"Property & transport", color:"#9a8ab8"},
    {name:"Utilities & Internet", icon:"💧", area:"Daily living", color:"#79b9c0"},
    {name:"Pets", icon:"🐾", area:"Health & care", color:"#c59b75"},
    {name:"Transportation", icon:"🚲", area:"Property & transport", color:"#8099c5"},
    {name:"Shopping & Personal Care", icon:"🌷", area:"Health & care", color:"#df9fc0"},
    {name:"Hobbies & Entertainment", icon:"🎨", area:"Lifestyle & other", color:"#b7a2d3"},
    {name:"Education & Professional Development", icon:"📚", area:"Lifestyle & other", color:"#a6b9a0"},
    {name:"Gifts & Donations", icon:"🎁", area:"Lifestyle & other", color:"#e5a58e"},
    {name:"Miscellaneous", icon:"🍃", area:"Lifestyle & other", color:"#a9b0a2"}
  ];
  const areas = [
    {name:"Daily living", color:"#80a878"},
    {name:"Health & care", color:"#d98d8b"},
    {name:"Property & transport", color:"#8099c5"},
    {name:"Lifestyle & other", color:"#b7a2d3"}
  ];
  const $ = id => document.getElementById(id);
  const money = amount => new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(amount)||0);
  const localDate = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const currentMonth = () => localDate().slice(0,7);
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const categoryNames = categories.map(c=>c.name);
  let expenses = loadExpenses();
  let deleteTarget = null;
  let installPrompt = null;
  let selectedCalendarDate = "";
  let undoEntry = null;
  let undoTimer = null;
  let customViews = loadCustomViews();

  function validDate(s){ return typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+"T00:00:00")); }
  function normalizeExpense(raw, index=0) {
    if (!raw || typeof raw!=="object") throw new Error(`Row ${index+1}: expected an expense object.`);
    const date = String(raw.date ?? raw.Date ?? "").trim();
    const item = String(raw.item ?? raw.description ?? raw.Item ?? "").trim();
    const priceRaw = raw.price ?? raw.amount ?? raw.Price;
    const price = typeof priceRaw==="string" ? Number(priceRaw.replace(/[₱,\s]/g,"")) : Number(priceRaw);
    const category = String(raw.category ?? raw.Category ?? "Miscellaneous").trim();
    if (!validDate(date)) throw new Error(`Row ${index+1}: invalid or missing date.`);
    if (!item || item.length>120) throw new Error(`Row ${index+1}: item must be 1–120 characters.`);
    if (!Number.isFinite(price) || price<=0 || price>999999999) throw new Error(`Row ${index+1}: price must be greater than zero and within the supported limit.`);
    if (!categoryNames.includes(category)) throw new Error(`Row ${index+1}: unknown category "${category}". Use one of the 12 fixed categories.`);
    const notes = String(raw.notes ?? raw.Notes ?? "").trim();
    return {id:String(raw.id || makeId()),date,item,price:Math.round(price*100)/100,category,notes:notes.slice(0,500),createdAt:raw.createdAt || new Date().toISOString(),updatedAt:new Date().toISOString()};
  }
  function makeId(){ return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `e-${Date.now()}-${Math.random().toString(36).slice(2,10)}`; }
  function loadExpenses(){
    try {
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw) return [];
      const parsed=JSON.parse(raw);
      if(!Array.isArray(parsed)) return [];
      return parsed.map((r,i)=>normalizeExpense(r,i));
    } catch(e) {
      console.error("Could not load saved expenses",e);
      return [];
    }
  }
  function saveExpenses(){
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(expenses)); return true; }
    catch(e){ alert("Your browser could not save these records. Storage may be full or disabled. Export a backup and try again."); return false; }
  }
  function getCategory(name){return categories.find(c=>c.name===name)||categories[categories.length-1];}
  function sum(rows){return rows.reduce((n,e)=>n+e.price,0);}
  function showAppPage(name){
    const tabs=[...document.querySelectorAll(".section-tab")],views=[...document.querySelectorAll(".page-view")];
    tabs.forEach(tab=>{const active=tab.dataset.page===name;tab.classList.toggle("is-active",active);tab.setAttribute("aria-current",active?"page":"false");});
    views.forEach(view=>{const active=view.dataset.view===name;view.hidden=!active;view.classList.toggle("is-active",active);});
    window.scrollTo({top:0,behavior:"auto"});
  }
  function init(){
    $("expenseDate").value=localDate();
    $("reportMonth").value=currentMonth();
    categories.forEach(c=>{
      $("expenseCategory").add(new Option(`${c.icon} ${c.name}`,c.name));
      $("categoryFilter").add(new Option(c.name,c.name));
    });
    try { const lastCategory=localStorage.getItem("little-garden-last-category"); if(categoryNames.includes(lastCategory)) $("expenseCategory").value=lastCategory; } catch(e) {}
    initTheme();
    bindEvents();
    initInsightControls();
    initPdfExportControls();
    $("viewAllTransactionsBtn").addEventListener("click",()=>showAppPage("journal"));
    renderAll();
    if("serviceWorker" in navigator && location.protocol!=="file:") navigator.serviceWorker.register("./sw.js").catch(err=>console.warn("Offline cache unavailable",err));
  }
  function initTheme(){
    let theme="light";
    try { theme=localStorage.getItem("little-garden-theme") || "light"; } catch(e) {}
    applyTheme(theme);
    $("themeToggle").addEventListener("click",()=>{
      const next=document.documentElement.dataset.theme==="dark"?"light":"dark";
      applyTheme(next);
      try { localStorage.setItem("little-garden-theme",next); } catch(e) {}
    });
  }
  function applyTheme(theme){
    document.documentElement.dataset.theme=theme;
    const dark=theme==="dark";
    $("themeToggle").textContent=dark?"☀️ Light mode":"🌙 Dark mode";
    $("themeToggle").setAttribute("aria-label",dark?"Switch to light mode":"Switch to dark mode");
    document.querySelector('meta[name="theme-color"]').setAttribute("content",dark?"#17251d":"#315b43");
  }
  function bindEvents(){
    $("expenseForm").addEventListener("submit",onSave);
    $("cancelEditBtn").addEventListener("click",resetForm);
    ["searchInput","categoryFilter","monthFilter","sortFilter"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",renderExpenses));
    $("reportMonth").addEventListener("change",()=>{selectedCalendarDate="";$("clearCalendarDate").classList.add("hidden");renderAll();});
    ["topExpenseLimit","yearSummaryYear","trendYear","heatmapYear"].forEach(id=>$(id).addEventListener("change",renderInsights));
    $("dateRangeForm").addEventListener("submit",renderDateRangeComparison);
    ["categoryChart","areaChart","categoryLegend","areaLegend"].forEach(id=>$(id).addEventListener("keydown",event=>{
      if((event.key==="Enter"||event.key===" ")&&event.target.closest("[data-chart-name]")){event.preventDefault();event.target.closest("[data-chart-name]").click();}
    }));
    ["categoryChart","areaChart","categoryLegend","areaLegend"].forEach(id=>$(id).addEventListener("click",event=>{
      const target=event.target.closest("[data-chart-name]");
      if(!target)return;
      const name=target.dataset.chartName;
      $("searchInput").value="";
      if(id==="categoryChart"||id==="categoryLegend"){ $("categoryFilter").value=name; }
      else { $("categoryFilter").value=""; $("searchInput").value=name; }
      $("monthFilter").value=selectedMonth();selectedCalendarDate="";renderAll();
      $("transactionsTitle").scrollIntoView({behavior:"smooth",block:"start"});
    }));
    $("clearCalendarDate").addEventListener("click",()=>{selectedCalendarDate="";renderAll();});
    $("addOnSelectedDayBtn").addEventListener("click",()=>{if(!selectedCalendarDate)return;resetForm();$("expenseDate").value=selectedCalendarDate;$("expenseItem").focus();$("entryTitle").textContent="New expense";document.querySelector(".entry-panel").scrollIntoView({behavior:"smooth",block:"start"});});
    $("saveViewBtn").addEventListener("click",saveCurrentView);
    $("savedViewSelect").addEventListener("change",applySavedView);
    $("resetFiltersBtn").addEventListener("click",resetFilters);
    $("undoDeleteBtn").addEventListener("click",undoDelete);
    $("exportJsonBtn").addEventListener("click",exportJSON);
    $("exportJsonBtn2").addEventListener("click",exportJSON);
    $("exportCsvBtn").addEventListener("click",exportCSV);
    $("exportPdfBtn").addEventListener("click",exportPDFReport);
    $("pdfPeriod").addEventListener("change",updatePdfPeriodControls);
    $("importFile").addEventListener("change",importFile);

    window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("installBtn").classList.remove("hidden");});
    $("installBtn").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installBtn").classList.add("hidden");});
    window.addEventListener("storage",event=>{if(event.key===STORAGE_KEY){expenses=loadExpenses();renderAll();}});
  }
  function onSave(event){
    event.preventDefault();
    const id=$("expenseId").value;
    const raw={id:id||makeId(),date:$("expenseDate").value,item:$("expenseItem").value,price:$("expensePrice").value,category:$("expenseCategory").value,notes:$("expenseNotes").value};
    let entry;
    try{entry=normalizeExpense(raw);}catch(e){$("formMessage").textContent=e.message;return;}
    if(id){const old=expenses.find(e=>e.id===id);entry.createdAt=old?.createdAt||entry.createdAt;expenses=expenses.map(e=>e.id===id?entry:e);}
    else expenses.push(entry);
    try { localStorage.setItem("little-garden-last-category",entry.category); } catch(e) {}
    if(!saveExpenses())return;
    resetForm();renderAll();
    $("formMessage").textContent=id?"Expense updated.":"Expense added to your garden.";
  }
  function resetForm(){
    $("expenseForm").reset();$("expenseId").value="";$("expenseDate").value=localDate();
    $("saveExpenseBtn").textContent="Add expense";$("cancelEditBtn").classList.add("hidden");$("entryTitle").textContent="New expense";
    try { const lastCategory=localStorage.getItem("little-garden-last-category"); if(categoryNames.includes(lastCategory)) $("expenseCategory").value=lastCategory; } catch(e) {}
    $("formMessage").textContent="";
  }
  function editExpense(id){
    const e=expenses.find(x=>x.id===id);if(!e)return;
    $("expenseId").value=e.id;$("expenseDate").value=e.date;$("expenseItem").value=e.item;$("expensePrice").value=e.price;$("expenseCategory").value=e.category;$("expenseNotes").value=e.notes;
    $("saveExpenseBtn").textContent="Save changes";$("cancelEditBtn").classList.remove("hidden");
    $("entryTitle").textContent="Edit expense";$("expenseItem").focus();window.scrollTo({top:0,behavior:"smooth"});
  }
  function askDelete(id){
    const entry=expenses.find(e=>e.id===id);if(!entry)return;
    undoEntry={entry,index:expenses.findIndex(e=>e.id===id)};
    expenses=expenses.filter(e=>e.id!==id);
    if(!saveExpenses()){expenses.splice(undoEntry.index,0,entry);undoEntry=null;return;}
    renderAll();showUndoToast(`Deleted “${entry.item}”.`);
  }
  function showUndoToast(message){
    const toast=$("undoToast");$("undoMessage").textContent=message;toast.hidden=false;
    if(undoTimer)clearTimeout(undoTimer);
    undoTimer=setTimeout(()=>{toast.hidden=true;undoEntry=null;undoTimer=null;},8000);
  }
  function undoDelete(){
    if(!undoEntry)return;
    if(expenses.some(e=>e.id===undoEntry.entry.id)){undoEntry=null;$("undoToast").hidden=true;return;}
    expenses.splice(Math.min(undoEntry.index,expenses.length),0,undoEntry.entry);
    if(saveExpenses()){renderAll();$("undoToast").hidden=true;if(undoTimer)clearTimeout(undoTimer);undoTimer=null;undoEntry=null;}
  }
  function renderAll(){renderSummary();renderReports();renderMonthFilter();renderExpenses();renderCalendar();renderComparison();renderSavedViews();renderInsights();renderRecentTransactions();$("allCount").textContent=`${expenses.length} ${expenses.length===1?"entry":"entries"}`;}
  function renderRecentTransactions(){
    const host=$("recentTransactions"); if(!host)return; host.innerHTML="";
    const rows=[...expenses].sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt||"").localeCompare(String(a.createdAt||""))).slice(0,5);
    if(!rows.length){host.innerHTML="<div class=\"recent-empty\"><span aria-hidden=\"true\">🌱</span><strong>No transactions yet</strong><span>Your first saved expense will show up here.</span></div>";return;}
    rows.forEach(e=>{const c=getCategory(e.category),row=document.createElement("button");row.type="button";row.className="recent-transaction";row.innerHTML=`<span class=\"recent-category-icon\" aria-hidden=\"true\">${c.icon}</span><span class=\"recent-main\"><strong>${escapeHTML(e.item)}</strong><small>${escapeHTML(new Date(e.date+"T00:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric"}))} · ${escapeHTML(e.category)}</small></span><strong class=\"recent-amount\">${money(e.price)}</strong><span class=\"recent-chevron\" aria-hidden=\"true\">›</span>`;row.addEventListener("click",()=>{showAppPage("journal");$("searchInput").value=e.item;$("categoryFilter").value="";$("monthFilter").value="";selectedCalendarDate="";renderExpenses();});host.appendChild(row);});
  }
  function selectedMonth(){return $("reportMonth").value||currentMonth();}
  function renderSummary(){
    const month=selectedMonth();const rows=expenses.filter(e=>e.date.startsWith(month));const [y,m]=month.split("-").map(Number);
    const date=new Date();const elapsed=(date.getFullYear()===y&&date.getMonth()+1===m)?date.getDate():new Date(y,m,0).getDate();
    $("monthTotal").textContent=money(sum(rows));$("monthCount").textContent=String(rows.length);
    $("dailyAverage").textContent=money(elapsed?sum(rows)/elapsed:0);
    $("monthLabel").textContent=new Date(y,m-1,1).toLocaleDateString("en-PH",{month:"long",year:"numeric"});
  }
  function renderReports(){renderSummary();const rows=expenses.filter(e=>e.date.startsWith(selectedMonth()));renderPie("categoryChart","categoryLegend",categories.map(c=>({name:c.name,color:c.color,value:sum(rows.filter(e=>e.category===c.name)),icon:c.icon})),sum(rows));renderPie("areaChart","areaLegend",areas.map(a=>({name:a.name,color:a.color,value:sum(rows.filter(e=>getCategory(e.category).area===a.name))})),sum(rows));renderDailyChart(rows);}
  function renderPie(chartId,legendId,items,total){
    const chart=$(chartId),legend=$(legendId);chart.innerHTML="";legend.innerHTML="";
    if(total<=0){chart.innerHTML='<div class="no-chart">Your chart will bloom after your first entry.</div>';return;}
    const ns="http://www.w3.org/2000/svg";const svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox","0 0 220 220");svg.setAttribute("aria-hidden","true");
    let angle=-Math.PI/2;const cx=110,cy=110,r=91;
    const nonzero=items.filter(i=>i.value>0);
    nonzero.forEach((item,index)=>{
      const slice=item.value/total*Math.PI*2;const end=angle+slice;
      let path;
      if(nonzero.length===1){path=document.createElementNS(ns,"circle");path.setAttribute("cx",cx);path.setAttribute("cy",cy);path.setAttribute("r",r);path.setAttribute("fill",item.color);}
      else{
        const x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle),x2=cx+r*Math.cos(end),y2=cy+r*Math.sin(end);
        path=document.createElementNS(ns,"path");path.setAttribute("d",`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${slice>Math.PI?1:0} 1 ${x2} ${y2} Z`);path.setAttribute("fill",item.color);path.setAttribute("stroke","#fffdf7");path.setAttribute("stroke-width","1.5");
      }
      path.dataset.chartName=item.name;path.classList.add("chart-segment");path.setAttribute("tabindex","0");path.setAttribute("role","button");path.setAttribute("aria-label",`Show ${item.name} transactions`);svg.appendChild(path);angle=end;
    });
    const hole=document.createElementNS(ns,"circle");hole.setAttribute("cx",cx);hole.setAttribute("cy",cy);hole.setAttribute("r","52");hole.setAttribute("fill","#fffdf7");svg.appendChild(hole);
    const label=document.createElementNS(ns,"text");label.setAttribute("x",cx);label.setAttribute("y",cy-2);label.setAttribute("text-anchor","middle");label.setAttribute("class","pie-center");label.textContent=money(total);svg.appendChild(label);
    const sub=document.createElementNS(ns,"text");sub.setAttribute("x",cx);sub.setAttribute("y",cy+15);sub.setAttribute("text-anchor","middle");sub.setAttribute("font-size","9");sub.setAttribute("fill","#819080");sub.textContent="TOTAL SPENT";svg.appendChild(sub);
    chart.appendChild(svg);
    items.filter(i=>i.value>0).sort((a,b)=>b.value-a.value).forEach(item=>{
      const row=document.createElement("div");row.className="legend-item";
      row.dataset.chartName=item.name;row.classList.add("legend-item-clickable");row.tabIndex=0;row.setAttribute("role","button");row.setAttribute("aria-label",`Show ${item.name} transactions`);
      row.innerHTML=`<span class="legend-dot" style="background:${item.color}"></span><span class="legend-name">${escapeHTML(item.icon?item.icon+" ":"")}${escapeHTML(item.name)}</span><span class="legend-value">${money(item.value)}</span>`;
      legend.appendChild(row);
    });
    if(!legend.children.length)legend.innerHTML='<p class="chart-subtitle">No recorded spending.</p>';
  }
  function renderDailyChart(rows){
    const el=$("dailyChart");el.innerHTML="";const [y,m]=selectedMonth().split("-").map(Number);const days=new Date(y,m,0).getDate();const totals=Array(days).fill(0);
    rows.forEach(e=>{const d=Number(e.date.slice(8,10));if(d>=1&&d<=days)totals[d-1]+=e.price;});
    const max=Math.max(...totals,1);
    totals.forEach((value,i)=>{
      const col=document.createElement("div");col.className="bar-column";const bar=document.createElement("div");bar.className="bar";bar.style.height=`${Math.max(value>0?3:1,(value/max)*105)}px`;bar.title=`${selectedMonth()}-${String(i+1).padStart(2,"0")}: ${money(value)}`;bar.setAttribute("aria-label",`${i+1}: ${money(value)}`);
      const day=document.createElement("span");day.className="day-label";day.textContent=(i===0||i===days-1||(i+1)%5===0)?String(i+1):"";
      col.append(bar,day);el.appendChild(col);
    });
  }

  function initInsightControls(){
    const years=new Set([String(new Date().getFullYear()),selectedMonth().slice(0,4)]);
    expenses.forEach(e=>years.add(e.date.slice(0,4)));
    const list=[...years].sort().reverse();
    ["yearSummaryYear","trendYear","heatmapYear"].forEach(id=>{
      const select=$(id);select.innerHTML="";
      list.forEach(y=>select.add(new Option(y,y)));
      select.value=selectedMonth().slice(0,4);
    });
    const today=localDate(),monthStart=`${today.slice(0,7)}-01`;
    $("rangeAStart").value=monthStart;$("rangeAEnd").value=today;
    const priorMonth=new Date(Number(today.slice(0,4)),Number(today.slice(5,7))-2,1);
    const priorYear=priorMonth.getFullYear(),priorMonthNum=String(priorMonth.getMonth()+1).padStart(2,"0");
    const priorDays=new Date(priorYear,priorMonth.getMonth()+1,0).getDate();
    const matchingDay=String(Math.min(Number(today.slice(8,10)),priorDays)).padStart(2,"0");
    $("rangeBStart").value=`${priorYear}-${priorMonthNum}-01`;$("rangeBEnd").value=`${priorYear}-${priorMonthNum}-${matchingDay}`;
  }
  function renderInsights(){
    const month=selectedMonth(),monthRows=expenses.filter(e=>e.date.startsWith(month));
    const limit=Number($("topExpenseLimit").value)||5;
    const top=$("topExpensesList");top.innerHTML="";
    [...monthRows].sort((a,b)=>b.price-a.price).slice(0,limit).forEach((e,i)=>{
      const row=document.createElement("button");row.type="button";row.className="top-expense-row";
      row.innerHTML=`<span class="top-rank">${i+1}</span><span class="top-expense-info"><strong>${escapeHTML(e.item)}</strong><small>${escapeHTML(e.date)} · ${escapeHTML(e.category)}</small></span><strong class="top-expense-amount">${money(e.price)}</strong>`;
      row.addEventListener("click",()=>{resetFilters();$("monthFilter").value=month;$("searchInput").value=e.item;renderExpenses();$("transactionsTitle").scrollIntoView({behavior:"smooth",block:"start"});});
      top.appendChild(row);
    });
    if(!top.children.length)top.innerHTML='<p class="chart-subtitle">Your largest expenses for this month will appear here.</p>';
    const year=$("yearSummaryYear").value||new Date().getFullYear().toString(),yearRows=expenses.filter(e=>e.date.startsWith(year)),yearTotal=sum(yearRows);
    $("yearTotal").textContent=money(yearTotal);$("yearMonthlyAverage").textContent=money(yearTotal/12);$("yearEntryCount").textContent=String(yearRows.length);
    const catTotals=categories.map(c=>({name:c.name,icon:c.icon,total:sum(yearRows.filter(e=>e.category===c.name))})).sort((a,b)=>b.total-a.total);
    $("yearTopCategory").textContent=catTotals[0]?.total?`Highest category: ${catTotals[0].icon} ${catTotals[0].name} (${money(catTotals[0].total)})`:"Add entries to see your highest-spending category.";
    renderTrendChart($("trendYear").value||year);renderHeatmap($("heatmapYear").value||year);
  }
  function renderTrendChart(year){
    const holder=$("spendingTrends"),legend=$("trendLegend");holder.innerHTML="";legend.innerHTML="";
    const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox","0 0 720 250");svg.setAttribute("role","img");svg.setAttribute("aria-label",`Monthly category spending in ${year}`);
    const monthly=categories.map(c=>({category:c,values:Array.from({length:12},(_,m)=>sum(expenses.filter(e=>e.date.startsWith(`${year}-${String(m+1).padStart(2,"0")}`)&&e.category===c.name)))}));
    const max=Math.max(1,...monthly.flatMap(x=>x.values));const left=44,right=700,top=15,bottom=205;
    for(let g=0;g<=4;g++){const y=bottom-(bottom-top)*g/4,line=document.createElementNS(ns,"line");line.setAttribute("x1",left);line.setAttribute("x2",right);line.setAttribute("y1",y);line.setAttribute("y2",y);line.setAttribute("class","trend-gridline");svg.appendChild(line);const lab=document.createElementNS(ns,"text");lab.setAttribute("x",left-7);lab.setAttribute("y",y+4);lab.setAttribute("text-anchor","end");lab.setAttribute("class","trend-axis-label");lab.textContent=compactMoney(max*g/4);svg.appendChild(lab);}
    const monthNames=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    monthNames.forEach((m,i)=>{const x=left+(right-left)*i/11,t=document.createElementNS(ns,"text");t.setAttribute("x",x);t.setAttribute("y",228);t.setAttribute("text-anchor","middle");t.setAttribute("class","trend-axis-label");t.textContent=m;svg.appendChild(t);});
    monthly.forEach(({category,values})=>{
      const points=values.map((v,i)=>`${left+(right-left)*i/11},${bottom-(bottom-top)*v/max}`).join(" ");
      const line=document.createElementNS(ns,"polyline");line.setAttribute("points",points);line.setAttribute("fill","none");line.setAttribute("stroke",category.color);line.setAttribute("stroke-width","2.2");line.setAttribute("stroke-linejoin","round");line.setAttribute("stroke-linecap","round");line.setAttribute("class","trend-line");line.setAttribute("data-chart-name",category.name);svg.appendChild(line);
      values.forEach((v,i)=>{if(!v)return;const dot=document.createElementNS(ns,"circle");dot.setAttribute("cx",left+(right-left)*i/11);dot.setAttribute("cy",bottom-(bottom-top)*v/max);dot.setAttribute("r","3.2");dot.setAttribute("fill",category.color);dot.setAttribute("aria-label",`${monthNames[i]} ${category.name}: ${money(v)}`);svg.appendChild(dot);});
      const button=document.createElement("button");button.type="button";button.className="trend-legend-item";button.innerHTML=`<i style="background:${category.color}"></i>${category.icon} ${escapeHTML(category.name)}`;button.addEventListener("click",()=>{ $("categoryFilter").value=category.name;$("monthFilter").value="";$("searchInput").value="";selectedCalendarDate="";renderExpenses();$("transactionsTitle").scrollIntoView({behavior:"smooth",block:"start"});});legend.appendChild(button);
    });
    holder.appendChild(svg);
  }
  function renderHeatmap(year){
    const holder=$("spendingHeatmap");holder.innerHTML="";
    const values=expenses.filter(e=>e.date.startsWith(year)).reduce((o,e)=>(o[e.date]=(o[e.date]||0)+e.price,o),{});
    const max=Math.max(0,...Object.values(values));const start=new Date(Number(year),0,1),days=new Date(Number(year),1,0).getDate()+(new Date(Number(year),1,0).getDate()===29?0:0);
    const offset=(start.getDay()+6)%7;
    for(let i=0;i<offset;i++){const blank=document.createElement("span");blank.className="heat-cell heat-empty";holder.appendChild(blank);}
    const totalDays=(new Date(Number(year)+1,0,1)-new Date(Number(year),0,1))/86400000;
    for(let i=0;i<totalDays;i++){
      const d=new Date(Number(year),0,i+1),date=localDate(d),amount=values[date]||0,ratio=max?amount/max:0,level=amount===0?0:ratio>.75?4:ratio>.5?3:ratio>.25?2:1;
      const cell=document.createElement("button");cell.type="button";cell.className=`heat-cell heat-level-${level}`;cell.title=`${date}: ${money(amount)}`;cell.setAttribute("aria-label",`${date}, ${money(amount)}. Select this date.`);
      cell.addEventListener("click",()=>{$("reportMonth").value=date.slice(0,7);selectedCalendarDate=date;$("monthFilter").value="";renderAll();$("transactionsTitle").scrollIntoView({behavior:"smooth",block:"start"});});
      holder.appendChild(cell);
    }
  }
  function renderDateRangeComparison(event){
    event.preventDefault();
    const aStart=$("rangeAStart").value,aEnd=$("rangeAEnd").value,bStart=$("rangeBStart").value,bEnd=$("rangeBEnd").value;
    if(!validDate(aStart)||!validDate(aEnd)||!validDate(bStart)||!validDate(bEnd)||aStart>aEnd||bStart>bEnd){$("dateRangeResults").innerHTML='<p class="range-error">Please enter valid start and end dates for both periods.</p>';return;}
    const a=expenses.filter(e=>e.date>=aStart&&e.date<=aEnd),b=expenses.filter(e=>e.date>=bStart&&e.date<=bEnd),ta=sum(a),tb=sum(b);
    const days=(s,e)=>Math.round((new Date(e+"T00:00:00")-new Date(s+"T00:00:00"))/86400000)+1;
    const delta=tb===0?(ta===0?0:null):(ta-tb)/tb*100;
    const fmt=(s,e)=>`${new Date(s+"T00:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})} – ${new Date(e+"T00:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}`;
    const box=$("dateRangeResults");box.innerHTML=`<div class="range-summary"><article><span>Period A · ${fmt(aStart,aEnd)}</span><strong>${money(ta)}</strong><small>${money(ta/days(aStart,aEnd))} per day · ${a.length} entries</small></article><article><span>Period B · ${fmt(bStart,bEnd)}</span><strong>${money(tb)}</strong><small>${money(tb/days(bStart,bEnd))} per day · ${b.length} entries</small></article><article><span>Difference (A vs B)</span><strong>${delta===null?(ta>0?"New activity":"—"):`${delta>0?"+":""}${delta.toFixed(1)}%`}</strong><small>${money(ta-tb)} total difference</small></article></div><h4>Category differences (A − B)</h4><div class="range-category-list"></div>`;
    const list=box.querySelector(".range-category-list");
    categories.forEach(c=>{const av=sum(a.filter(e=>e.category===c.name)),bv=sum(b.filter(e=>e.category===c.name));if(!av&&!bv)return;const row=document.createElement("div");row.className="category-comparison-row";row.innerHTML=`<span>${c.icon} ${escapeHTML(c.name)}</span><span>${money(av)}</span><span class="${av>bv?"change-up":av<bv?"change-down":""}">${av>bv?"+":""}${money(av-bv)}</span>`;list.appendChild(row);});
    if(!list.children.length)list.innerHTML='<p class="chart-subtitle">No spending in either selected period.</p>';
  }
  function renderMonthFilter(){
    const select=$("monthFilter"),current=select.value;const months=[...new Set([...expenses.map(e=>e.date.slice(0,7)),currentMonth(),selectedMonth()])].sort().reverse();select.innerHTML='<option value="">All months</option>';months.forEach(m=>select.add(new Option(new Date(`${m}-01T00:00:00`).toLocaleDateString("en-PH",{month:"long",year:"numeric"}),m)));if(months.includes(current))select.value=current;
  }
  function renderExpenses(){
    const query=$("searchInput").value.trim().toLocaleLowerCase();const category=$("categoryFilter").value;const month=$("monthFilter").value;const sort=$("sortFilter").value;
    const terms=query.split(/\s+/).filter(Boolean);
    let rows=expenses.filter(e=>{
      if(category&&e.category!==category)return false;
      if(month&&!e.date.startsWith(month))return false;
      if(selectedCalendarDate&&e.date!==selectedCalendarDate)return false;
      if(!terms.length)return true;
      const cat=getCategory(e.category);
      const searchable=[e.item,e.notes,e.category,cat.area,cat.icon,e.date,e.date.slice(0,7),e.date.slice(8,10),
        new Date(e.date+"T00:00:00").toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"}),
        String(e.price),e.price.toFixed(2),money(e.price),String(Math.round(e.price)),e.id].join(" ").toLocaleLowerCase();
      return terms.every(term=>searchable.includes(term));
    });
    rows.sort((a,b)=>sort==="date-asc"?a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt):sort==="price-desc"?b.price-a.price:sort==="price-asc"?a.price-b.price:sort==="item-asc"?a.item.localeCompare(b.item,undefined,{sensitivity:"base"}):sort==="item-desc"?b.item.localeCompare(a.item,undefined,{sensitivity:"base"}):b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
    const tbody=$("expenseRows");tbody.innerHTML="";
    rows.forEach(e=>{
      const c=getCategory(e.category),tr=document.createElement("tr");
      tr.innerHTML=`<td>${escapeHTML(new Date(e.date+"T00:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}))}</td><td title="${escapeHTML(e.notes)}">${escapeHTML(e.item)}${e.notes?`<div class="chart-subtitle">${escapeHTML(e.notes)}</div>`:""}</td><td><span class="category-chip">${c.icon} ${escapeHTML(e.category)}</span></td><td class="amount-col"><strong>${money(e.price)}</strong></td><td class="actions-col"><div class="row-actions"><button class="icon-button" type="button" data-edit="${escapeHTML(e.id)}" aria-label="Edit ${escapeHTML(e.item)}">Edit</button><button class="icon-button" type="button" data-delete="${escapeHTML(e.id)}" aria-label="Delete ${escapeHTML(e.item)}">×</button></div></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editExpense(b.dataset.edit)));
    tbody.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>askDelete(b.dataset.delete)));
    $("emptyState").classList.toggle("hidden",rows.length>0);
    const dateNote=selectedCalendarDate?` on ${new Date(selectedCalendarDate+"T00:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}`:"";
    $("filteredSummary").textContent=`Showing ${rows.length} of ${expenses.length} ${expenses.length===1?"entry":"entries"}${dateNote}`;$("filteredTotal").textContent=money(sum(rows));
    $("clearCalendarDate").classList.toggle("hidden",!selectedCalendarDate);
    $("addOnSelectedDayBtn").classList.toggle("hidden",!selectedCalendarDate);
    $("calendarSelection").textContent=selectedCalendarDate?`Showing entries for ${new Date(selectedCalendarDate+"T00:00:00").toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"})}.`:"No day selected.";
  }
  function renderCalendar(){
    const grid=$("calendarGrid");grid.innerHTML="";
    const month=selectedMonth(),[y,m]=month.split("-").map(Number),first=new Date(y,m-1,1),days=new Date(y,m,0).getDate();
    ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(day=>{const head=document.createElement("div");head.className="calendar-weekday";head.textContent=day;grid.appendChild(head);});
    const offset=(first.getDay()+6)%7;for(let i=0;i<offset;i++){const blank=document.createElement("div");blank.className="calendar-day calendar-blank";blank.setAttribute("aria-hidden","true");grid.appendChild(blank);}
    const totals=Array(days).fill(0),counts=Array(days).fill(0);expenses.forEach(e=>{if(e.date.startsWith(month)){const d=Number(e.date.slice(8,10))-1;if(d>=0&&d<days){totals[d]+=e.price;counts[d]++;}}});
    for(let d=1;d<=days;d++){
      const date=`${month}-${String(d).padStart(2,"0")}`,cell=document.createElement("button");cell.type="button";cell.className="calendar-day"+(selectedCalendarDate===date?" is-selected":"")+(counts[d-1]?" has-spending":"");cell.setAttribute("aria-pressed",String(selectedCalendarDate===date));cell.setAttribute("aria-label",`${date}, ${counts[d-1]} expenses, ${money(totals[d-1])}`);
      const number=document.createElement("span");number.className="calendar-day-number";number.textContent=String(d);cell.appendChild(number);
      if(counts[d-1]){const amount=document.createElement("span");amount.className="calendar-day-total";amount.textContent=compactMoney(totals[d-1]);cell.appendChild(amount);const count=document.createElement("span");count.className="calendar-day-count";count.textContent=`${counts[d-1]} ${counts[d-1]===1?"entry":"entries"}`;cell.appendChild(count);}
      cell.addEventListener("click",()=>{selectedCalendarDate=selectedCalendarDate===date?"":date;$("monthFilter").value="";renderAll();});grid.appendChild(cell);
    }
  }
  function compactMoney(amount){return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",notation:"compact",maximumFractionDigits:1}).format(amount);}
  function renderComparison(){
    const [y,m]=selectedMonth().split("-").map(Number),prevDate=new Date(y,m-2,1),prevMonth=`${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,"0")}`;
    const current=expenses.filter(e=>e.date.startsWith(selectedMonth())),previous=expenses.filter(e=>e.date.startsWith(prevMonth));const currentTotal=sum(current),previousTotal=sum(previous);
    const label=date=>new Date(date+"-01T00:00:00").toLocaleDateString("en-PH",{month:"long",year:"numeric"});
    $("previousMonthTotal").textContent=money(previousTotal);$("previousMonthLabel").textContent=label(prevMonth);
    const change=previousTotal===0?(currentTotal===0?0:null):((currentTotal-previousTotal)/previousTotal)*100;
    $("monthChange").textContent=change===null?(currentTotal>0?"New activity":"—"):`${change>0?"+":""}${change.toFixed(1)}%`;
    $("monthChange").classList.toggle("change-up",change!==null&&change>0);$("monthChange").classList.toggle("change-down",change!==null&&change<0);
    $("monthChangeNote").textContent=previousTotal===0?(currentTotal>0?"No spending recorded last month":"No spending in either month"):change>0?"More than the previous month":change<0?"Less than the previous month":"Same total as previous month";
    $("previousDailyAverage").textContent=money(sum(previous)/new Date(y,m-1,0).getDate());
    const holder=$("categoryComparison");holder.innerHTML="";
    categories.forEach(c=>{const now=sum(current.filter(e=>e.category===c.name)),before=sum(previous.filter(e=>e.category===c.name));if(now===0&&before===0)return;const delta=now-before;const row=document.createElement("div");row.className="category-comparison-row";row.innerHTML=`<span>${c.icon} ${escapeHTML(c.name)}</span><span>${money(now)}</span><span class="${delta>0?"change-up":delta<0?"change-down":""}">${delta>0?"+":""}${money(delta)}</span>`;holder.appendChild(row);});
    if(!holder.children.length)holder.innerHTML='<p class="chart-subtitle">Add expenses to see category changes here.</p>';
  }
  function loadCustomViews(){try{const v=JSON.parse(localStorage.getItem("little-garden-saved-views")||"[]");return Array.isArray(v)?v.filter(x=>x&&typeof x.name==="string"&&x.state):[];}catch(e){return[];}}
  function renderSavedViews(){const select=$("savedViewSelect"),value=select.value;select.innerHTML='<option value="">Choose a view…</option><option value="this-month">This month</option><option value="healthcare">Healthcare</option><option value="largest">Largest expenses</option><option value="all">All records</option>';customViews.forEach((v,i)=>select.add(new Option(`★ ${v.name}`,`custom-${i}`)));if([...select.options].some(o=>o.value===value))select.value=value;}
  function saveCurrentView(){
    const name=prompt("Name this saved view (for example, October healthcare):");if(!name||!name.trim())return;
    const view={name:name.trim().slice(0,40),state:{query:$("searchInput").value,category:$("categoryFilter").value,month:$("monthFilter").value,sort:$("sortFilter").value}};
    customViews=customViews.filter(v=>v.name.toLocaleLowerCase()!==view.name.toLocaleLowerCase());customViews.push(view);customViews=customViews.slice(-12);
    try{localStorage.setItem("little-garden-saved-views",JSON.stringify(customViews));renderSavedViews();$("savedViewSelect").value=`custom-${customViews.length-1}`;}catch(e){alert("Could not save this view in browser storage.");}
  }
  function applySavedView(){
    const value=$("savedViewSelect").value;let state=null;
    if(value.startsWith("custom-"))state=customViews[Number(value.slice(7))]?.state;
    else if(value==="this-month")state={query:"",category:"",month:currentMonth(),sort:"date-desc"};
    else if(value==="healthcare")state={query:"Health & care",category:"",month:"",sort:"date-desc"};
    else if(value==="largest")state={query:"",category:"",month:"",sort:"price-desc"};
    else if(value==="all")state={query:"",category:"",month:"",sort:"date-desc"};
    if(!state)return;
    $("searchInput").value=state.query||"";$("categoryFilter").value=state.category||"";$("monthFilter").value=state.month||"";$("sortFilter").value=state.sort||"date-desc";selectedCalendarDate="";renderAll();
  }
  function resetFilters(){ $("searchInput").value="";$("categoryFilter").value="";$("monthFilter").value="";$("sortFilter").value="date-desc";selectedCalendarDate="";$("savedViewSelect").value="";renderAll(); }
  function downloadFile(filename,content,type){
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportJSON(){
    const payload={app:"Little Garden Expense Tracker",schemaVersion:1,currency:"PHP",exportedAt:new Date().toISOString(),categories:categoryNames,expenses};
    downloadFile(`little-garden-expenses-${localDate()}.json`,JSON.stringify(payload,null,2),"application/json;charset=utf-8");
  }
  function csvCell(value){const s=String(value??"");return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function exportCSV(){
    const rows=[["id","date","item","price","category","notes","createdAt","updatedAt"],...expenses.map(e=>[e.id,e.date,e.item,e.price.toFixed(2),e.category,e.notes,e.createdAt,e.updatedAt])];
    downloadFile(`little-garden-expenses-${localDate()}.csv`,"\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n"),"text/csv;charset=utf-8");
  }
  function parseCSV(text){
    const rows=[];let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"'&&field==="")quoted=true;else if(c===","){row.push(field);field="";}else if(c==="\n"){row.push(field.replace(/\r$/,""));if(row.some(v=>v!==""))rows.push(row);row=[];field="";}else field+=c;}
    if(quoted)throw new Error("CSV contains an unclosed quoted field.");if(field!==""||row.length){row.push(field.replace(/\r$/,""));if(row.some(v=>v!==""))rows.push(row);}
    if(!rows.length)throw new Error("The CSV file is empty.");
    const headers=rows.shift().map(h=>h.trim().replace(/^\uFEFF/,"").toLowerCase());
    const required=["date","item","price","category"];for(const key of required)if(!headers.includes(key))throw new Error(`CSV is missing the required "${key}" column.`);
    return rows.map((values,i)=>{const obj={};headers.forEach((h,j)=>obj[h]=values[j]??"");return normalizeExpense(obj,i);});
  }

  function initPdfExportControls(){
    const years=new Set([String(new Date().getFullYear())]);
    expenses.forEach(e=>years.add(e.date.slice(0,4)));
    const select=$("pdfYear");
    select.innerHTML="";
    [...years].sort().reverse().forEach(y=>select.add(new Option(y,y)));
    select.value=String(new Date().getFullYear());
    $("pdfWeekDate").value=localDate();
    $("pdfMonth").value=currentMonth();
    updatePdfPeriodControls();
  }
  function updatePdfPeriodControls(){
    const period=$("pdfPeriod").value;
    $("pdfWeekField").hidden=period!=="week";
    $("pdfMonthField").hidden=period!=="month";
    $("pdfYearField").hidden=period!=="year";
  }
  function isoDate(date){
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }
  function shiftDate(date,days){
    const copy=new Date(date.getFullYear(),date.getMonth(),date.getDate());
    copy.setDate(copy.getDate()+days);
    return copy;
  }
  function getPdfDateRange(){
    const period=$("pdfPeriod").value;
    if(period==="week"){
      const raw=$("pdfWeekDate").value;
      if(!validDate(raw))throw new Error("Choose a date within the week you want to export.");
      const d=new Date(`${raw}T00:00:00`);
      const monday=shiftDate(d,-((d.getDay()+6)%7));
      return {period,start:isoDate(monday),end:isoDate(shiftDate(monday,6)),label:`Week of ${monday.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}`};
    }
    if(period==="month"){
      const value=$("pdfMonth").value;
      if(!/^\d{4}-\d{2}$/.test(value))throw new Error("Choose a month to export.");
      const [y,m]=value.split("-").map(Number);
      return {period,start:`${value}-01`,end:isoDate(new Date(y,m,0)),label:new Date(y,m-1,1).toLocaleDateString("en-PH",{month:"long",year:"numeric"})};
    }
    const year=$("pdfYear").value;
    if(!/^\d{4}$/.test(year))throw new Error("Choose a year to export.");
    return {period,start:`${year}-01-01`,end:`${year}-12-31`,label:year};
  }
  function pdfEscape(value){
    return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function pdfDateLabel(value){
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});
  }
  function pdfTableRows(rows){
    if(!rows.length)return '<tr><td colspan="4" class="empty-row">No expenses recorded in this period.</td></tr>';
    return rows.map(e=>`<tr><td>${pdfEscape(pdfDateLabel(e.date))}</td><td class="description-cell">${pdfEscape(e.item)}${e.notes?`<small>${pdfEscape(e.notes)}</small>`:""}</td><td>${pdfEscape(e.category)}</td><td class="amount">${money(e.price)}</td></tr>`).join("");
  }
  function pdfBarRows(items,total){
    if(!items.length)return '<p class="muted">No spending to chart for this period.</p>';
    return items.map(item=>`<div class="bar-row"><span class="bar-label">${pdfEscape(item.name)}</span><span class="bar-track"><i style="width:${total?Math.max(0,Math.min(100,item.value/total*100)):0}%"></i></span><strong>${money(item.value)}</strong><small>${total?(item.value/total*100).toFixed(1):"0.0"}%</small></div>`).join("");
  }
  function pdfTrendRows(range,rows){
    let bins=[];
    if(range.period==="year"){
      bins=Array.from({length:12},(_,i)=>({label:new Date(Number(range.start.slice(0,4)),i,1).toLocaleDateString("en-PH",{month:"short"}),start:`${range.start.slice(0,4)}-${String(i+1).padStart(2,"0")}-01`,end:isoDate(new Date(Number(range.start.slice(0,4)),i+1,0))}));
    }else if(range.period==="month"){
      const [y,m]=range.start.split("-").map(Number),days=new Date(y,m,0).getDate();
      bins=Array.from({length:days},(_,i)=>({label:String(i+1),start:`${range.start.slice(0,7)}-${String(i+1).padStart(2,"0")}`,end:`${range.start.slice(0,7)}-${String(i+1).padStart(2,"0")}`})).filter((_,i)=>i===0||i===days-1||((i+1)%5===0));
    }else{
      const start=new Date(`${range.start}T00:00:00`);
      bins=Array.from({length:7},(_,i)=>{const d=shiftDate(start,i);return {label:d.toLocaleDateString("en-PH",{weekday:"short"}),start:isoDate(d),end:isoDate(d)};});
    }
    const values=bins.map(bin=>({...bin,value:sum(rows.filter(e=>e.date>=bin.start&&e.date<=bin.end))}));
    const max=Math.max(1,...values.map(v=>v.value));
    return values.map(v=>`<div class="trend-row"><span>${pdfEscape(v.label)}</span><span class="trend-track"><i style="width:${v.value/max*100}%"></i></span><strong>${money(v.value)}</strong></div>`).join("");
  }
  function exportPDFReport(){
    const message=$("pdfExportMessage");
    message.textContent="";
    try{
      const range=getPdfDateRange();
      const rows=expenses.filter(e=>e.date>=range.start&&e.date<=range.end).sort((a,b)=>a.date.localeCompare(b.date)||a.item.localeCompare(b.item));
      const total=sum(rows),count=rows.length,average=count?total/count:0;
      const categoryTotals=categories.map(c=>({name:c.name,icon:c.icon,color:c.color,value:sum(rows.filter(e=>e.category===c.name))}));
      const usedCategories=categoryTotals.filter(c=>c.value>0).sort((a,b)=>b.value-a.value);
      const topCategory=usedCategories[0];
      const largest=[...rows].sort((a,b)=>b.price-a.price)[0];
      const categoryTable=categoryTotals.map(c=>`<tr><td><span class="swatch" style="background:${c.color}"></span>${pdfEscape(c.name)}</td><td class="amount">${money(c.value)}</td><td class="amount">${total?(c.value/total*100).toFixed(1):"0.0"}%</td></tr>`).join("");
      const includeCharts=$("pdfIncludeCharts").checked;
      const includeInsights=$("pdfIncludeInsights").checked;
      const visual=$("pdfLayout").value==="visual";
      let comparisonLabel="";
      const durationDays=Math.round((new Date(`${range.end}T00:00:00`)-new Date(`${range.start}T00:00:00`))/86400000)+1;
      let previousStart,previousEnd;
      if(range.period==="month"){
        const [y,m]=range.start.split("-").map(Number),d=new Date(y,m-2,1);
        previousStart=isoDate(d);previousEnd=isoDate(new Date(d.getFullYear(),d.getMonth()+1,0));
        comparisonLabel=d.toLocaleDateString("en-PH",{month:"long",year:"numeric"});
      }else if(range.period==="year"){
        const y=Number(range.start.slice(0,4))-1;previousStart=`${y}-01-01`;previousEnd=`${y}-12-31`;comparisonLabel=String(y);
      }else{
        const d=new Date(`${range.start}T00:00:00`);previousStart=isoDate(shiftDate(d,-7));previousEnd=isoDate(shiftDate(d,-1));comparisonLabel=`${pdfDateLabel(previousStart)} – ${pdfDateLabel(previousEnd)}`;
      }
      const previousTotal=sum(expenses.filter(e=>e.date>=previousStart&&e.date<=previousEnd));
      const change=previousTotal===0?(total===0?0:null):((total-previousTotal)/previousTotal)*100;
      const insightCards=`
        <div class="insight-grid">
          <div class="insight"><span>Top category</span><strong>${topCategory?pdfEscape(topCategory.name):"No spending yet"}</strong><small>${topCategory?money(topCategory.value):"—"}</small></div>
          <div class="insight"><span>Largest transaction</span><strong>${largest?pdfEscape(largest.item):"No transactions"}</strong><small>${largest?`${money(largest.price)} · ${pdfEscape(pdfDateLabel(largest.date))}`:"—"}</small></div>
          <div class="insight"><span>Average per transaction</span><strong>${money(average)}</strong><small>${count} transaction${count===1?"":"s"}</small></div>
          <div class="insight"><span>Compared with previous period</span><strong>${change===null?(total>0?"New activity":"—"):`${change>0?"+":""}${change.toFixed(1)}%`}</strong><small>${pdfEscape(comparisonLabel)} · ${money(previousTotal)}</small></div>
        </div>`;
      const chartSection=includeCharts?`
        <section class="report-section"><h2>${range.period==="week"?"Daily spending":range.period==="month"?"Daily spending trend":"Monthly spending trend"}</h2><div class="chart-panel">${pdfTrendRows(range,rows)}</div></section>`:"";
      const insightSection=includeInsights?`<section class="report-section"><h2>Spending insights</h2>${insightCards}</section>`:"";
      const categorySection=includeCharts?`
        <section class="report-section"><h2>Category breakdown</h2><div class="two-col">
          <div class="chart-panel">${pdfBarRows(usedCategories,total)}</div>
          <div class="chart-panel"><h3>Category totals</h3><table><thead><tr><th>Category</th><th class="amount">Amount</th><th class="amount">Share</th></tr></thead><tbody>${categoryTable}</tbody><tfoot><tr class="total-row"><td>Total</td><td class="amount">${money(total)}</td><td class="amount">${total?"100.0":"0.0"}%</td></tr></tfoot></table></div>
        </div></section>`:"";
      const htmlDoc=`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Little Garden — ${pdfEscape(range.label)} report</title><style>
        :root{--ink:#263e31;--muted:#718274;--deep:#315b43;--leaf:#80a878;--line:#dfe5d8;--sage:#e9f0df}
        *{box-sizing:border-box}body{margin:0;background:#f3f5ef;color:var(--ink);font:10pt/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
        .report{max-width:1000px;margin:24px auto;padding:30px;background:white;border:1px solid var(--line);box-shadow:0 8px 30px #243d2b12}
        .masthead{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2px solid var(--deep);padding-bottom:16px;margin-bottom:20px}
        .brandline{display:flex;gap:12px;align-items:center}.leaf{width:42px;height:42px;border-radius:14px;background:var(--sage);display:grid;place-items:center;font-size:24px;color:var(--deep)}
        h1{font:700 25pt/1.1 Georgia,serif;margin:0 0 4px}.subtitle{color:var(--muted);font-size:10pt}.period{text-align:right;min-width:180px}.period strong{display:block;font-size:15pt}.period span{display:block;color:var(--muted);margin-top:4px}
        .visual .masthead{background:linear-gradient(110deg,#f0f5e8,#fffdf7);padding:22px;border:1px solid var(--line);border-radius:16px}
        .visual h1{color:var(--deep)}.eyebrow{font-size:8pt;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:700;margin:0 0 6px}
        h2{font-size:14pt;margin:0 0 12px}h3{font-size:11pt;margin:0 0 8px}
        .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0 24px}.metric{border:1px solid var(--line);background:#fbfcf8;border-radius:10px;padding:13px}.metric span{display:block;color:var(--muted);font-size:8.5pt}.metric strong{display:block;font-size:16pt;margin-top:5px;overflow-wrap:anywhere}
        .visual .metric{background:linear-gradient(145deg,#fbfcf8,#f1f5e9);border-radius:13px}.report-section{margin:22px 0;break-inside:auto}.report-section h2{padding-bottom:7px;border-bottom:1px solid var(--line)}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px}.chart-panel{border:1px solid var(--line);border-radius:10px;padding:14px}.bar-row{display:grid;grid-template-columns:minmax(130px,1.4fr) minmax(90px,2fr) auto 48px;gap:9px;align-items:center;margin:8px 0;font-size:9pt}.bar-label{overflow-wrap:anywhere}.bar-track,.trend-track{height:9px;background:#edf1e9;border-radius:99px;overflow:hidden}.bar-track i,.trend-track i{display:block;height:100%;background:var(--leaf);border-radius:99px}.bar-row strong,.trend-row strong{white-space:nowrap;font-size:8.5pt}.bar-row small{text-align:right;color:var(--muted)}
        .trend-row{display:grid;grid-template-columns:54px minmax(60px,1fr) auto;gap:10px;align-items:center;margin:7px 0;font-size:9pt}.trend-track i{background:var(--deep)}
        .insight-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.insight{border:1px solid var(--line);border-radius:10px;padding:12px;background:#fbfcf8;break-inside:avoid}.insight span,.insight small{display:block;color:var(--muted);font-size:8.5pt}.insight strong{display:block;margin:4px 0;overflow-wrap:anywhere}
        table{width:100%;border-collapse:collapse;font-size:8.5pt}th,td{padding:8px 9px;border:1px solid var(--line);text-align:left;vertical-align:top}th{background:#e9f0df;color:#284c37;font-weight:700}thead{display:table-header-group}.amount{text-align:right;white-space:nowrap}.swatch{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}.description-cell{min-width:160px}.description-cell small{display:block;color:var(--muted);margin-top:3px;white-space:pre-wrap}.empty-row{text-align:center;color:var(--muted);padding:20px}
        .total-row td{font-weight:700;background:#f3f6ef}.notes{font-size:8.5pt;color:var(--muted);margin-top:18px}.footer{border-top:1px solid var(--line);margin-top:24px;padding-top:10px;color:var(--muted);font-size:8pt;display:flex;justify-content:space-between;gap:12px}
        .visual .report-section h2{color:var(--deep)}.spreadsheet .masthead{padding-bottom:12px}.spreadsheet .metrics{gap:0;border:1px solid var(--line)}.spreadsheet .metric{border-radius:0;border:0;border-right:1px solid var(--line);background:#f4f7f1}.spreadsheet .metric:last-child{border-right:0}
        .print-hint{font-size:9pt;color:var(--muted);margin:0 0 18px}
        @page{size:auto;margin:13mm}
        @media print{body{background:white;font-size:9pt}.report{max-width:none;margin:0;padding:0;border:0;box-shadow:none}.no-print{display:none!important}.metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.report-section{break-inside:auto}.chart-panel,.insight,.metric{break-inside:avoid}table{page-break-inside:auto}tr{break-inside:avoid;page-break-inside:avoid}thead{display:table-header-group}.masthead{break-inside:avoid}.footer{break-inside:avoid}a{color:inherit;text-decoration:none}}
        @media screen and (max-width:640px){.report{margin:0;padding:16px;border:0}.masthead{display:block}.period{text-align:left;margin-top:14px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.two-col{grid-template-columns:1fr}.bar-row{grid-template-columns:minmax(90px,1fr) minmax(50px,1fr) auto}.bar-row small{display:none}table{font-size:8pt}th,td{padding:6px 5px}.description-cell{min-width:120px}}
        </style></head><body><main class="report ${visual?"visual":"spreadsheet"}">
        <header class="masthead"><div class="brandline"><div class="leaf">❀</div><div><p class="eyebrow">Little Garden · Expense Tracker</p><h1>${visual?"Spending in Bloom":"Expense Report"}</h1><div class="subtitle">${visual?"A thoughtful look at your money":"Personal spending statement"}</div></div></div><div class="period"><strong>${pdfEscape(range.label)}</strong><span>${pdfEscape(pdfDateLabel(range.start))} – ${pdfEscape(pdfDateLabel(range.end))}</span><span>Generated ${pdfEscape(new Date().toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}))}</span></div></header>
        <div class="metrics"><div class="metric"><span>Total spent</span><strong>${money(total)}</strong></div><div class="metric"><span>Transactions</span><strong>${count}</strong></div><div class="metric"><span>Days with expenses</span><strong>${new Set(rows.map(e=>e.date)).size}</strong></div><div class="metric"><span>Average per transaction</span><strong>${money(average)}</strong></div></div>
        ${categorySection}${chartSection}${insightSection}
        <section class="report-section"><h2>All transactions <span class="subtitle">(${count})</span></h2><table><thead><tr><th>Date</th><th>Description / notes</th><th>Category</th><th class="amount">Amount (PHP)</th></tr></thead><tbody>${pdfTableRows(rows)}</tbody><tfoot><tr class="total-row"><td colspan="3">Total for selected period</td><td class="amount">${money(total)}</td></tr></tfoot></table></section>
        <p class="notes">Amounts are shown in Philippine pesos (PHP). This report includes all saved transactions dated within the selected period. Your records remain stored locally in your browser.</p><footer class="footer"><span>Little Garden · Better spending, brighter days.</span><span>${pdfEscape(range.start)} to ${pdfEscape(range.end)}</span></footer>
        <p class="print-hint no-print">Use your browser’s Print command, then choose “Save as PDF” (wording varies by device).</p>
        </main></body></html>`;
      const printWindow=window.open("","_blank");
      if(!printWindow){message.textContent="Your browser blocked the report window. Allow pop-ups for this app, then try again.";return;}
      printWindow.document.open();printWindow.document.write(htmlDoc);printWindow.document.close();
      let didPrint=false;
      const triggerPrint=()=>{if(didPrint)return;didPrint=true;try{printWindow.focus();printWindow.print();}catch(err){console.warn("Print dialog could not open automatically",err);}};
      printWindow.addEventListener("load",()=>setTimeout(triggerPrint,350),{once:true});
      setTimeout(triggerPrint,900);
      message.textContent="Your report is ready. In the print dialog, choose Save as PDF.";
    }catch(err){message.textContent=err.message||"Could not prepare the PDF report.";}
  }

  async function importFile(event){
    const file=event.target.files?.[0];if(!file)return;const message=$("importMessage");message.textContent="";
    try{
      if(file.size>15*1024*1024)throw new Error("File is larger than 15 MB. Please use a smaller backup.");
      const text=await file.text();let imported;
      if(file.name.toLowerCase().endsWith(".csv")||file.type==="text/csv")imported=parseCSV(text);
      else{
        const parsed=JSON.parse(text);const list=Array.isArray(parsed)?parsed:parsed.expenses;
        if(!Array.isArray(list))throw new Error("JSON backup should contain an expenses array.");
        imported=list.map((e,i)=>normalizeExpense(e,i));
      }
      const unique=new Map();
      if($("importMode").value==="merge")expenses.forEach(e=>unique.set(e.id,e));
      imported.forEach(e=>unique.set(e.id,e));
      const result=[...unique.values()];
      if(result.length>100000)throw new Error("Import would exceed 100,000 records.");
      const previous=expenses;expenses=result;
      if(!saveExpenses()){expenses=previous;return;}
      renderAll();message.textContent=`Imported ${imported.length} record${imported.length===1?"":"s"} (${ $("importMode").value==="merge"?"merged":"replaced"}).`;message.style.color="var(--deep)";
    }catch(err){message.textContent=`Import failed: ${err.message}`;message.style.color="#a84943";}
    finally{event.target.value="";}
  }
  init();
})();