(() => {
  "use strict";
  const STORAGE_KEY = "little-garden-expenses-v1";
  const KEYS = {views:"little-garden-saved-views",lastCategory:"little-garden-last-category",theme:"little-garden-theme",textSize:"little-garden-text-size",navCollapsed:"little-garden-nav-collapsed",seenNews:"little-garden-seen-news",importUndo:"little-garden-import-undo",lastBackup:"little-garden-last-backup",recovery:"little-garden-expenses-recovery",budgets:"little-garden-budgets",recurring:"little-garden-recurring",income:"little-garden-income-v1",lastMethod:"little-garden-last-method",backupSnooze:"little-garden-backup-snooze",payMe:"little-garden-pay-me-v1"};
  const METHODS = ["Cash","GCash","Card","Bank transfer","Other"];
  const NO_METHOD = "Not set";
  const methodColors = {"Cash":"#80a878","GCash":"#8099c5","Card":"#d98d8b","Bank transfer":"#e7b66c","Other":"#b7a2d3","Not set":"#a9b0a2"};
  const cleanMethod = value => { const v=String(value ?? "").trim().toLowerCase(); return METHODS.find(m=>m.toLowerCase()===v) || ""; };
  const META = window.APP_META || {name:"Little Garden",version:""};
  const CHANGELOG = Array.isArray(window.APP_CHANGELOG) ? window.APP_CHANGELOG : [];
  const lsGet = key => { try { return localStorage.getItem(key); } catch(e) { return null; } };
  const lsSet = (key,value) => { try { localStorage.setItem(key,value); return true; } catch(e) { return false; } };
  const lsDel = key => { try { localStorage.removeItem(key); } catch(e) {} };
  const categories = [
    {name:"Groceries", icon:"🥬", area:"Daily living", color:"#80a878"},
    {name:"Restaurants & Dining", icon:"🍲", area:"Daily living", color:"#e7b66c"},
    {name:"Medications & Healthcare", icon:"🌼", area:"Health & care", color:"#d98d8b"},
    {name:"Property & Real Estate", icon:"🏡", area:"Property & transport", color:"#9a8ab8"},
    {name:"Utilities & Internet", icon:"💧", area:"Daily living", color:"#79b9c0"},
    {name:"Pets", icon:"🐾", area:"Health & care", color:"#c59b75"},
    {name:"Transportation", icon:"🚲", area:"Property & transport", color:"#8099c5"},
    {name:"Shopping & Personal Care", icon:"🌷", area:"Health & care", color:"#df9fc0"},
    {name:"Clothes", icon:"👗", area:"Lifestyle & other", color:"#c47fa5"},
    {name:"Hobbies & Entertainment", icon:"🎨", area:"Lifestyle & other", color:"#b7a2d3"},
    {name:"Education & Professional Development", icon:"📚", area:"Lifestyle & other", color:"#a6b9a0"},
    {name:"Books", icon:"📖", area:"Lifestyle & other", color:"#b9a04a"},
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
  const moneyFormat = new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"});
  const money = amount => moneyFormat.format(Number(amount)||0);
  const localDate = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const currentMonth = () => localDate().slice(0,7);
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const categoryNames = categories.map(c=>c.name);
  let loadWarning = "";
  let expenses = loadExpenses();
  let installPrompt = null;
  let selectedCalendarDate = "";   // day picked on the Calendar screen
  let journalDate = "";            // single-day filter on the Transactions screen
  let editReturn = "";             // screen to go back to after an edit is saved or cancelled
  let undoEntry = null;
  let undoTimer = null;
  let customViews = loadCustomViews();
  let journalMethod = "";          // payment-method filter on the Transactions screen ("" = any)
  let budgets = cleanBudgets(readJSON(KEYS.budgets));
  let recurring = cleanRecurring(readJSON(KEYS.recurring));
  let income = cleanIncome(readJSON(KEYS.income));
  let categoryTouched = false, methodTouched = false;   // set when she picks one herself, so suggestions stop overriding it
  let itemLookup = new Map();

  function validDate(s){
    if(typeof s!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y,m,d]=s.split("-").map(Number),date=new Date(y,m-1,d);
    return y>=1900 && date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d;   // rejects 2026-02-31 and the like
  }
  function isoStamp(value){
    if(typeof value!=="string" && typeof value!=="number") return "";
    const d=new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }
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
    if (!categoryNames.includes(category)) throw new Error(`Row ${index+1}: unknown category "${category}". Use one of the 14 fixed categories.`);
    const notes = String(raw.notes ?? raw.Notes ?? "").trim();
    const now=new Date().toISOString(),created=isoStamp(raw.createdAt ?? raw.createdat)||now;
    return {id:String(raw.id || makeId()).slice(0,80),date,item,price:Math.round(price*100)/100,category,method:cleanMethod(raw.method ?? raw.Method ?? raw["paid with"]),notes:notes.slice(0,500),createdAt:created,updatedAt:isoStamp(raw.updatedAt ?? raw.updatedat)||created};
  }
  function makeId(){ return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `e-${Date.now()}-${Math.random().toString(36).slice(2,10)}`; }
  function loadExpenses(){
    try {
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw) return [];
      const parsed=JSON.parse(raw);
      if(!Array.isArray(parsed)) throw new Error("Saved data is not a list.");
      const good=[],seen=new Set();let skipped=0;
      parsed.forEach((r,i)=>{
        try { const e=normalizeExpense(r,i); if(seen.has(e.id)) e.id=makeId(); seen.add(e.id); good.push(e); }
        catch(err) { skipped++; console.warn("Skipped a damaged record",err); }
      });
      if(skipped){
        // Keep an untouched copy so nothing is lost when the cleaned list is next saved.
        if(lsGet(KEYS.recovery)===null) lsSet(KEYS.recovery,raw);
        loadWarning=`${skipped} damaged record${skipped===1?" was":"s were"} skipped when loading. A safety copy of the original data was kept in this browser.`;
      }
      return good;
    } catch(e) {
      console.error("Could not load saved expenses",e);
      const raw=lsGet(STORAGE_KEY);
      if(raw){ if(lsGet(KEYS.recovery)===null) lsSet(KEYS.recovery,raw); loadWarning="Your saved expenses could not be read. A safety copy was kept in this browser. Restore from a backup in Tools and backup."; }
      return [];
    }
  }
  function saveExpenses(){
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(expenses)); return true; }
    catch(e){ alert("Your browser could not save these records. Storage may be full or disabled. Export a backup and try again."); return false; }
  }
  function getCategory(name){return categories.find(c=>c.name===name)||categories[categories.length-1];}
  function sum(rows){return Math.round(rows.reduce((n,e)=>n+Math.round(e.price*100),0))/100;}
  function init(){
    $("expenseDate").value=localDate();
    $("reportMonth").value=currentMonth();
    categories.forEach(c=>{
      $("expenseCategory").add(new Option(`${c.icon} ${c.name}`,c.name));
      $("categoryFilter").add(new Option(c.name,c.name));
      $("recurringCategory").add(new Option(`${c.icon} ${c.name}`,c.name));
    });
    ["expenseMethod","recurringMethod"].forEach(id=>{$(id).add(new Option(NO_METHOD,""));METHODS.forEach(m=>$(id).add(new Option(m,m)));});
    $("expenseMethod").value=cleanMethod(lsGet(KEYS.lastMethod));
    $("incomeDate").value=localDate();
    $("budgetCategoryFields").innerHTML=categories.map((c,i)=>`<div class="budget-field"><label for="budgetCat${i}">${c.icon} ${escapeHTML(c.name)}</label><div class="price-input"><span>₱</span><input id="budgetCat${i}" inputmode="decimal" max="999999999" min="0" placeholder="No limit" step="0.01" type="number"/></div></div>`).join("");
    { const lastCategory=lsGet(KEYS.lastCategory); if(categoryNames.includes(lastCategory)) $("expenseCategory").value=lastCategory; }
    $("calendarMonth").value=currentMonth();
    bindEvents();
    initInsightControls();
    initPdfExportControls();
    $("viewAllTransactionsBtn").addEventListener("click",()=>go("transactions"));
    renderAll();
    initShell();
    if(loadWarning) $("formMessage").textContent=loadWarning;
    initPayMe();
    initUpdates();
  }
  function bindEvents(){
    $("expenseForm").addEventListener("submit",onSave);
    $("cancelEditBtn").addEventListener("click",cancelEdit);
    ["searchInput","categoryFilter","monthFilter","sortFilter"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",()=>{if(id==="searchInput")$("q").value=$("searchInput").value;renderExpenses();}));
    $("reportMonth").addEventListener("change",()=>setReportMonth($("reportMonth").value));
    $("calendarMonth").addEventListener("change",()=>setReportMonth($("calendarMonth").value));
    document.querySelectorAll("[data-month-step]").forEach(b=>b.addEventListener("click",()=>{
      const [y,m]=selectedMonth().split("-").map(Number),d=new Date(y,m-1+Number(b.dataset.monthStep),1);
      setReportMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    }));
    ["topExpenseLimit","yearSummaryYear","trendYear","heatmapYear"].forEach(id=>$(id).addEventListener("change",renderInsights));
    $("dateRangeForm").addEventListener("submit",renderDateRangeComparison);
    ["categoryChart","areaChart","methodChart","categoryLegend","areaLegend","methodLegend"].forEach(id=>$(id).addEventListener("keydown",event=>{
      if((event.key==="Enter"||event.key===" ")&&event.target.closest("[data-chart-name]")){event.preventDefault();event.target.closest("[data-chart-name]").click();}
    }));
    ["categoryChart","areaChart","methodChart","categoryLegend","areaLegend","methodLegend"].forEach(id=>$(id).addEventListener("click",event=>{
      const target=event.target.closest("[data-chart-name]");
      if(!target)return;
      const name=target.dataset.chartName;
      if(id.startsWith("category"))setJournalFilters({category:name,month:selectedMonth()});
      else if(id.startsWith("method"))setJournalFilters({method:name,month:selectedMonth()});
      else setJournalFilters({query:name,month:selectedMonth()});
      go("transactions");
    }));
    $("clearCalendarDate").addEventListener("click",()=>{selectedCalendarDate="";renderCalendar();});
    $("addOnSelectedDayBtn").addEventListener("click",()=>{if(!selectedCalendarDate)return;const day=selectedCalendarDate;resetForm();$("expenseDate").value=day;editReturn="";go("home",focusEntryForm);});
    $("openDayInJournalBtn").addEventListener("click",()=>{if(!selectedCalendarDate)return;setJournalFilters({date:selectedCalendarDate});go("transactions");});
    $("clearJournalDate").addEventListener("click",()=>{journalDate="";journalMethod="";renderExpenses();});
    $("expenseCategory").addEventListener("change",()=>{categoryTouched=true;});
    $("expenseMethod").addEventListener("change",()=>{methodTouched=true;});
    ["input","change"].forEach(type=>$("expenseItem").addEventListener(type,applySuggestion));
    $("budgetForm").addEventListener("submit",saveBudgetForm);
    $("clearBudgetBtn").addEventListener("click",()=>{budgets=cleanBudgets(null);lsSet(KEYS.budgets,JSON.stringify(budgets));fillBudgetForm(true);renderBudgetHome();$("budgetMessage").textContent="All limits cleared.";});
    $("recurringForm").addEventListener("submit",addRecurring);
    $("incomeForm").addEventListener("submit",addIncome);
    $("deleteViewBtn").addEventListener("click",deleteSavedView);
    $("undoImportBtn").addEventListener("click",undoImport);
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

    window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("installTool").classList.remove("hidden");});
    $("installBtn").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installTool").classList.add("hidden");});
    window.addEventListener("storage",event=>{
      if(event.key===STORAGE_KEY){expenses=loadExpenses();renderAll();}
      else if(event.key===KEYS.views){customViews=loadCustomViews();renderSavedViews();}
      else if([KEYS.budgets,KEYS.recurring,KEYS.income].includes(event.key)){budgets=cleanBudgets(readJSON(KEYS.budgets));recurring=cleanRecurring(readJSON(KEYS.recurring));income=cleanIncome(readJSON(KEYS.income));renderAll();}
    });
  }
  function setReportMonth(value){
    $("reportMonth").value=/^\d{4}-\d{2}$/.test(value)?value:currentMonth();
    selectedCalendarDate="";renderAll();
  }
  // One place to set the Transactions filters, so every shortcut (charts, heatmap, calendar, recent items) behaves the same.
  function setJournalFilters({query="",category="",month="",sort="",date="",method=""}={}){
    journalMethod=method;
    $("searchInput").value=query;$("q").value=query;$("categoryFilter").value=category;
    renderMonthFilter();$("monthFilter").value=month;if($("monthFilter").value!==month)$("monthFilter").value="";
    if(sort)$("sortFilter").value=sort;
    journalDate=date;$("savedViewSelect").value="";renderExpenses();
  }
  function focusEntryForm(){
    const panel=document.querySelector(".entry-panel");
    panel.scrollIntoView({behavior:"auto",block:"start"});
    $("expenseItem").focus({preventScroll:true});
  }
  function onSave(event){
    event.preventDefault();
    const id=$("expenseId").value;
    const raw={id:id||makeId(),date:$("expenseDate").value,item:$("expenseItem").value,price:$("expensePrice").value,category:$("expenseCategory").value,method:$("expenseMethod").value,notes:$("expenseNotes").value};
    let entry;
    try{entry=normalizeExpense(raw);}catch(e){$("formMessage").textContent=e.message;return;}
    const previous=expenses;
    if(id){
      const old=expenses.find(e=>e.id===id);
      entry.updatedAt=new Date().toISOString();
      if(old){entry.createdAt=old.createdAt;expenses=expenses.map(e=>e.id===id?entry:e);}
      else expenses=[...expenses,entry];   // the record was deleted while it was open in the form: keep the edit
    }
    else expenses=[...expenses,entry];
    lsSet(KEYS.lastCategory,entry.category);
    if(entry.method)lsSet(KEYS.lastMethod,entry.method);else lsDel(KEYS.lastMethod);
    if(!saveExpenses()){expenses=previous;return;}
    const back=id?editReturn:"";
    resetForm();renderAll();
    $("formMessage").textContent=id?"Expense updated.":"Expense added to your garden.";
    if(back&&back!=="home")go(back);
  }
  function cancelEdit(){const back=editReturn;resetForm();if(back&&back!=="home")go(back);}
  function resetForm(){
    $("expenseForm").reset();$("expenseId").value="";$("expenseDate").value=localDate();editReturn="";$("optionalFields").open=false;categoryTouched=false;methodTouched=false;$("expenseMethod").value=cleanMethod(lsGet(KEYS.lastMethod));
    $("saveExpenseBtn").textContent="Add expense";$("cancelEditBtn").classList.add("hidden");$("entryTitle").textContent="New expense";
    { const lastCategory=lsGet(KEYS.lastCategory); if(categoryNames.includes(lastCategory)) $("expenseCategory").value=lastCategory; }
    $("formMessage").textContent="";
  }
  function editExpense(id){
    const from=currentRoute();
    const e=expenses.find(x=>x.id===id);if(!e)return;
    $("expenseId").value=e.id;$("expenseDate").value=e.date;$("expenseItem").value=e.item;$("expensePrice").value=e.price;$("expenseCategory").value=e.category;$("expenseMethod").value=e.method||"";$("expenseNotes").value=e.notes;
    $("saveExpenseBtn").textContent="Save changes";$("cancelEditBtn").classList.remove("hidden");
    $("entryTitle").textContent="Edit expense";$("optionalFields").open=!!e.notes;$("formMessage").textContent="";
    editReturn=from==="home"?"":from;
    go("home",focusEntryForm);
  }
  function askDelete(id){
    const entry=expenses.find(e=>e.id===id);if(!entry)return;
    undoEntry={entry,index:expenses.findIndex(e=>e.id===id)};
    const previous=expenses;
    expenses=expenses.filter(e=>e.id!==id);
    if(!saveExpenses()){expenses=previous;undoEntry=null;return;}
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
  function renderAll(){refreshYearOptions();renderSummary();renderReports();renderMonthFilter();renderExpenses();renderCalendar();renderComparison();renderSavedViews();renderInsights();renderRecentTransactions();renderBackupMeta();renderSuggestions();renderBudgetHome();renderDue();renderRecurringList();renderIncomeList();fillBudgetForm(false);renderHomeNotices();$("allCount").textContent=`${expenses.length} ${expenses.length===1?"entry":"entries"}`;}
  function renderRecentTransactions(){
    const host=$("recentTransactions"); if(!host)return; host.innerHTML="";
    const rows=[...expenses].sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt||"").localeCompare(String(a.createdAt||""))).slice(0,5);
    if(!rows.length){host.innerHTML="<div class=\"recent-empty\"><span aria-hidden=\"true\">🌱</span><strong>No transactions yet</strong><span>Your first saved expense will show up here.</span></div>";return;}
    rows.forEach(e=>{const c=getCategory(e.category),row=document.createElement("button");row.type="button";row.className="recent-transaction";row.innerHTML=`<span class=\"recent-category-icon\" aria-hidden=\"true\">${c.icon}</span><span class=\"recent-main\"><strong>${escapeHTML(e.item)}</strong><small>${escapeHTML(new Date(e.date+"T00:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric"}))} · ${escapeHTML(e.category)}</small></span><strong class=\"recent-amount\">${money(e.price)}</strong><span class=\"recent-chevron\" aria-hidden=\"true\">›</span>`;row.addEventListener("click",()=>{setJournalFilters({query:e.item});go("transactions");});host.appendChild(row);});
  }
  function selectedMonth(){return $("reportMonth").value||currentMonth();}
  function renderSummary(){
    const month=currentMonth();const rows=expenses.filter(e=>e.date.startsWith(month));const [y,m]=month.split("-").map(Number);
    const elapsed=new Date().getDate();
    $("monthTotal").textContent=money(sum(rows));$("monthCount").textContent=String(rows.length);
    $("dailyAverage").textContent=money(elapsed?sum(rows)/elapsed:0);
    $("monthLabel").textContent=new Date(y,m-1,1).toLocaleDateString("en-PH",{month:"long",year:"numeric"});
  }
  function renderReports(){renderSummary();const rows=expenses.filter(e=>e.date.startsWith(selectedMonth()));renderPie("categoryChart","categoryLegend",categories.map(c=>({name:c.name,color:c.color,value:sum(rows.filter(e=>e.category===c.name)),icon:c.icon})),sum(rows));renderPie("areaChart","areaLegend",areas.map(a=>({name:a.name,color:a.color,value:sum(rows.filter(e=>getCategory(e.category).area===a.name))})),sum(rows));renderPie("methodChart","methodLegend",[...METHODS,NO_METHOD].map(m=>({name:m,color:methodColors[m],value:sum(rows.filter(e=>(e.method||NO_METHOD)===m))})),sum(rows));renderDailyChart(rows);}
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

  // Rebuilt on every render so a year that first appears after an add or an import shows up straight away.
  function refreshYearOptions(){
    const thisYear=String(new Date().getFullYear());
    const years=new Set([thisYear,selectedMonth().slice(0,4)]);
    expenses.forEach(e=>years.add(e.date.slice(0,4)));
    const list=[...years].sort().reverse();
    ["yearSummaryYear","trendYear","heatmapYear","pdfYear"].forEach(id=>{
      const select=$(id),keep=select.value;
      if([...select.options].map(o=>o.value).join()===list.join()) return;
      select.innerHTML="";
      list.forEach(y=>select.add(new Option(y,y)));
      select.value=list.includes(keep)?keep:(id==="pdfYear"?thisYear:selectedMonth().slice(0,4));
    });
  }
  function initInsightControls(){
    refreshYearOptions();
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
      row.addEventListener("click",()=>{setJournalFilters({query:e.item,month,sort:"date-desc"});go("transactions");});
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
      const button=document.createElement("button");button.type="button";button.className="trend-legend-item";button.innerHTML=`<i style="background:${category.color}"></i>${category.icon} ${escapeHTML(category.name)}`;button.addEventListener("click",()=>{setJournalFilters({category:category.name});go("transactions");});legend.appendChild(button);
    });
    holder.appendChild(svg);
  }
  function renderHeatmap(year){
    const holder=$("spendingHeatmap");holder.innerHTML="";
    const values=expenses.filter(e=>e.date.startsWith(year)).reduce((o,e)=>(o[e.date]=(o[e.date]||0)+e.price,o),{});
    const max=Math.max(0,...Object.values(values));const start=new Date(Number(year),0,1);
    const offset=(start.getDay()+6)%7;
    for(let i=0;i<offset;i++){const blank=document.createElement("span");blank.className="heat-cell heat-empty";holder.appendChild(blank);}
    const totalDays=Math.round((new Date(Number(year)+1,0,1)-new Date(Number(year),0,1))/86400000);
    for(let i=0;i<totalDays;i++){
      const d=new Date(Number(year),0,i+1),date=localDate(d),amount=values[date]||0,ratio=max?amount/max:0,level=amount===0?0:ratio>.75?4:ratio>.5?3:ratio>.25?2:1;
      const cell=document.createElement("button");cell.type="button";cell.className=`heat-cell heat-level-${level}`;cell.title=`${date}: ${money(amount)}`;cell.setAttribute("aria-label",`${date}, ${money(amount)}. Select this date.`);
      cell.addEventListener("click",()=>{setJournalFilters({date});go("transactions");});
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
      if(journalDate&&e.date!==journalDate)return false;
      if(journalMethod&&(e.method||NO_METHOD)!==journalMethod)return false;
      if(!terms.length)return true;
      const cat=getCategory(e.category);
      const searchable=[e.item,e.notes,e.category,e.method,cat.area,cat.icon,e.date,e.date.slice(0,7),e.date.slice(8,10),
        new Date(e.date+"T00:00:00").toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"}),
        String(e.price),e.price.toFixed(2),money(e.price),String(Math.round(e.price)),e.id].join(" ").toLocaleLowerCase();
      return terms.every(term=>searchable.includes(term));
    });
    rows.sort((a,b)=>sort==="date-asc"?a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt):sort==="price-desc"?b.price-a.price:sort==="price-asc"?a.price-b.price:sort==="item-asc"?a.item.localeCompare(b.item,undefined,{sensitivity:"base"}):sort==="item-desc"?b.item.localeCompare(a.item,undefined,{sensitivity:"base"}):b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
    const tbody=$("expenseRows");tbody.innerHTML="";
    rows.forEach(e=>{
      const c=getCategory(e.category),tr=document.createElement("tr");
      tr.innerHTML=`<td class="cell-date">${escapeHTML(new Date(e.date+"T00:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}))}</td><td class="cell-item" title="${escapeHTML(e.notes)}">${escapeHTML(e.item)}${e.notes?`<div class="chart-subtitle">${escapeHTML(e.notes)}</div>`:""}</td><td class="cell-cat"><span class="category-chip">${c.icon} ${escapeHTML(e.category)}</span>${e.method?`<span class="method-tag">${escapeHTML(e.method)}</span>`:""}</td><td class="amount-col"><strong>${money(e.price)}</strong></td><td class="actions-col"><div class="row-actions"><button class="icon-button" type="button" data-edit="${escapeHTML(e.id)}" aria-label="Edit ${escapeHTML(e.item)}">Edit</button><button class="icon-button" type="button" data-delete="${escapeHTML(e.id)}" aria-label="Delete ${escapeHTML(e.item)}">×</button></div></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editExpense(b.dataset.edit)));
    tbody.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>askDelete(b.dataset.delete)));
    $("emptyState").classList.toggle("hidden",rows.length>0);
    $("filteredSummary").textContent=`Showing ${rows.length} of ${expenses.length} ${expenses.length===1?"entry":"entries"}`;$("filteredTotal").textContent=money(sum(rows));
    $("journalDateChip").classList.toggle("hidden",!journalDate&&!journalMethod);
    $("journalDateLabel").textContent=[journalDate?`Only ${longDate(journalDate)}`:"",journalMethod?(journalMethod===NO_METHOD?"No payment method set":`Paid with ${journalMethod}`):""].filter(Boolean).join(" · ");
  }
  function longDate(date){return new Date(date+"T00:00:00").toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});}
  function renderCalendarDay(){
    const list=$("calendarDayList");list.innerHTML="";
    const day=selectedCalendarDate,rows=day?expenses.filter(e=>e.date===day).sort((a,b)=>b.price-a.price):[];
    ["clearCalendarDate","addOnSelectedDayBtn"].forEach(id=>$(id).classList.toggle("hidden",!day));
    $("openDayInJournalBtn").classList.toggle("hidden",!rows.length);
    $("calendarSelection").textContent=!day?"No day selected.":rows.length?`${longDate(day)}: ${rows.length} ${rows.length===1?"entry":"entries"}, ${money(sum(rows))}.`:`${longDate(day)}: nothing recorded.`;
    rows.forEach(e=>{
      const c=getCategory(e.category),row=document.createElement("button");row.type="button";row.className="recent-transaction";
      row.innerHTML=`<span class="recent-category-icon" aria-hidden="true">${c.icon}</span><span class="recent-main"><strong>${escapeHTML(e.item)}</strong><small>${escapeHTML(e.category)}${e.notes?" · "+escapeHTML(e.notes):""}</small></span><strong class="recent-amount">${money(e.price)}</strong><span class="recent-chevron" aria-hidden="true">›</span>`;
      row.setAttribute("aria-label",`Edit ${e.item}, ${money(e.price)}`);
      row.addEventListener("click",()=>editExpense(e.id));list.appendChild(row);
    });
  }
  function renderCalendar(){
    const grid=$("calendarGrid");grid.innerHTML="";$("calendarMonth").value=selectedMonth();
    const today=localDate();
    const month=selectedMonth(),[y,m]=month.split("-").map(Number),first=new Date(y,m-1,1),days=new Date(y,m,0).getDate();
    ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(day=>{const head=document.createElement("div");head.className="calendar-weekday";head.textContent=day;grid.appendChild(head);});
    const offset=(first.getDay()+6)%7;for(let i=0;i<offset;i++){const blank=document.createElement("div");blank.className="calendar-day calendar-blank";blank.setAttribute("aria-hidden","true");grid.appendChild(blank);}
    const totals=Array(days).fill(0),counts=Array(days).fill(0);expenses.forEach(e=>{if(e.date.startsWith(month)){const d=Number(e.date.slice(8,10))-1;if(d>=0&&d<days){totals[d]+=e.price;counts[d]++;}}});
    for(let d=1;d<=days;d++){
      const date=`${month}-${String(d).padStart(2,"0")}`,cell=document.createElement("button");cell.type="button";cell.className="calendar-day"+(selectedCalendarDate===date?" is-selected":"")+(counts[d-1]?" has-spending":"")+(date===today?" is-today":"");cell.setAttribute("aria-pressed",String(selectedCalendarDate===date));cell.setAttribute("aria-label",`${date}, ${counts[d-1]} expenses, ${money(totals[d-1])}`);
      const number=document.createElement("span");number.className="calendar-day-number";number.textContent=String(d);cell.appendChild(number);
      if(counts[d-1]){const amount=document.createElement("span");amount.className="calendar-day-total";amount.textContent=compactMoney(totals[d-1]);cell.appendChild(amount);const count=document.createElement("span");count.className="calendar-day-count";count.textContent=`${counts[d-1]} ${counts[d-1]===1?"entry":"entries"}`;cell.appendChild(count);}
      cell.addEventListener("click",()=>{selectedCalendarDate=selectedCalendarDate===date?"":date;renderCalendar();});grid.appendChild(cell);
    }
    renderCalendarDay();
  }
  function compactMoney(amount){return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",notation:"compact",maximumFractionDigits:1}).format(amount);}
  function renderComparison(){
    const thisMonth=currentMonth(),[y,m]=thisMonth.split("-").map(Number),prevDate=new Date(y,m-2,1),prevMonth=`${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,"0")}`;
    const current=expenses.filter(e=>e.date.startsWith(thisMonth)),previous=expenses.filter(e=>e.date.startsWith(prevMonth));const currentTotal=sum(current),previousTotal=sum(previous);
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
  function loadCustomViews(){try{const v=JSON.parse(lsGet(KEYS.views)||"[]");return cleanViews(v);}catch(e){return[];}}
  function cleanViews(v){return Array.isArray(v)?v.filter(x=>x&&typeof x.name==="string"&&x.name.trim()&&x.state&&typeof x.state==="object").map(x=>({name:x.name.trim().slice(0,40),state:{query:String(x.state.query||"").slice(0,200),category:String(x.state.category||""),month:String(x.state.month||""),sort:String(x.state.sort||"date-desc")}})).slice(-12):[];}
  function renderSavedViews(){const select=$("savedViewSelect"),value=select.value;select.innerHTML='<option value="">Choose a view…</option><option value="this-month">This month</option><option value="healthcare">Healthcare</option><option value="largest">Largest expenses</option><option value="all">All records</option>';customViews.forEach((v,i)=>select.add(new Option(`★ ${v.name}`,`custom-${i}`)));if([...select.options].some(o=>o.value===value))select.value=value;$("deleteViewBtn").classList.toggle("hidden",!select.value.startsWith("custom-"));}
  function saveCurrentView(){
    const name=prompt("Name this saved view (for example, October healthcare):");if(!name||!name.trim())return;
    const view={name:name.trim().slice(0,40),state:{query:$("searchInput").value,category:$("categoryFilter").value,month:$("monthFilter").value,sort:$("sortFilter").value}};
    customViews=customViews.filter(v=>v.name.toLocaleLowerCase()!==view.name.toLocaleLowerCase());customViews.push(view);customViews=customViews.slice(-12);
    if(!lsSet(KEYS.views,JSON.stringify(customViews))){alert("Could not save this view in browser storage.");return;}
    renderSavedViews();$("savedViewSelect").value=`custom-${customViews.length-1}`;$("deleteViewBtn").classList.remove("hidden");
  }
  function deleteSavedView(){
    const value=$("savedViewSelect").value;if(!value.startsWith("custom-"))return;
    const index=Number(value.slice(7)),view=customViews[index];if(!view)return;
    if(!confirm(`Delete the saved view “${view.name}”? Your expenses are not affected.`))return;
    customViews=customViews.filter((_,i)=>i!==index);lsSet(KEYS.views,JSON.stringify(customViews));
    $("savedViewSelect").value="";renderSavedViews();
  }
  function applySavedView(){
    const value=$("savedViewSelect").value;let state=null;
    if(value.startsWith("custom-"))state=customViews[Number(value.slice(7))]?.state;
    else if(value==="this-month")state={query:"",category:"",month:currentMonth(),sort:"date-desc"};
    else if(value==="healthcare")state={query:"",category:"Medications & Healthcare",month:"",sort:"date-desc"};
    else if(value==="largest")state={query:"",category:"",month:"",sort:"price-desc"};
    else if(value==="all")state={query:"",category:"",month:"",sort:"date-desc"};
    $("deleteViewBtn").classList.toggle("hidden",!value.startsWith("custom-"));
    if(!state)return;
    setJournalFilters({query:state.query||"",category:state.category||"",month:state.month||"",sort:state.sort||"date-desc"});
    $("savedViewSelect").value=value;
  }
  function resetFilters(){ setJournalFilters({sort:"date-desc"});$("deleteViewBtn").classList.add("hidden"); }
  function downloadFile(filename,content,type){
    const standalone=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
    if(standalone&&navigator.canShare&&typeof File==="function"){
      // Installed apps on phones cannot always download files; the share sheet can save to Files or send it on.
      try{const file=new File([content],filename,{type:type.split(";")[0]});if(navigator.canShare({files:[file]})){navigator.share({files:[file],title:filename}).catch(()=>{});return;}}catch(e){}
    }
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.rel="noopener";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  function renderBackupMeta(){
    const last=isoStamp(lsGet(KEYS.lastBackup)||""),count=`${expenses.length} ${expenses.length===1?"expense":"expenses"} on this device.`;
    $("backupMeta").textContent=last?`${count} Last backup exported ${new Date(last).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"})}.`:`${count} No backup exported from this device yet.`;
  }
  async function exportJSON(){
    const payload={app:"Little Garden Expense Tracker",schemaVersion:1,appVersion:META.version,currency:"PHP",exportedAt:new Date().toISOString(),categories:categoryNames,expenses,...snapshotExtras(),payMe:await payMeForBackup()};
    downloadFile(`little-garden-expenses-${localDate()}.json`,JSON.stringify(payload,null,2),"application/json;charset=utf-8");
    lsSet(KEYS.lastBackup,payload.exportedAt);renderBackupMeta();
  }
  function csvCell(value){const s=String(value??"");return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function exportCSV(){
    const rows=[["id","date","item","price","category","method","notes","createdAt","updatedAt"],...expenses.map(e=>[e.id,e.date,e.item,e.price.toFixed(2),e.category,e.method,e.notes,e.createdAt,e.updatedAt])];
    downloadFile(`little-garden-expenses-${localDate()}.csv`,"\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n"),"text/csv;charset=utf-8");
  }
  function parseCSV(text){
    const rows=[];let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"'&&field==="")quoted=true;else if(c===","){row.push(field);field="";}else if(c==="\n"){row.push(field.replace(/\r$/,""));if(row.some(v=>v!==""))rows.push(row);row=[];field="";}else field+=c;}
    if(quoted)throw new Error("CSV contains an unclosed quoted field.");if(field!==""||row.length){row.push(field.replace(/\r$/,""));if(row.some(v=>v!==""))rows.push(row);}
    if(!rows.length)throw new Error("The CSV file is empty.");
    const headers=rows.shift().map(h=>h.trim().replace(/^\uFEFF/,"").toLowerCase());
    const required=["date","item","price","category"];for(const key of required)if(!headers.includes(key))throw new Error(`CSV is missing the required "${key}" column.`);
    return rows.map((values,i)=>{const obj={};headers.forEach((h,j)=>obj[h]=values[j]??"");const entry=normalizeExpense(obj,i);if(!String(obj.id||"").trim())entry.noId=true;return entry;});
  }

  function initPdfExportControls(){
    refreshYearOptions();
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
      const day=n=>`${range.start.slice(0,7)}-${String(n).padStart(2,"0")}`;
      for(let from=1;from<=days;from+=7){const to=Math.min(from+6,days);bins.push({label:from===to?String(from):`${from}–${to}`,start:day(from),end:day(to)});}
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
        <section class="report-section"><h2>${range.period==="week"?"Daily spending":range.period==="month"?"Spending by week of the month":"Monthly spending trend"}</h2><div class="chart-panel">${pdfTrendRows(range,rows)}</div></section>`:"";
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
      const text=await file.text();let imported,extras=null;
      if(file.name.toLowerCase().endsWith(".csv")||file.type==="text/csv")imported=parseCSV(text);
      else{
        let parsed;try{parsed=JSON.parse(text);}catch(e){throw new Error("This file is not a Little Garden JSON backup or a CSV.");}
        const list=Array.isArray(parsed)?parsed:parsed?.expenses;
        if(!Array.isArray(list))throw new Error("JSON backup should contain an expenses array.");
        imported=list.map((e,i)=>normalizeExpense(e,i));
        if(parsed&&!Array.isArray(parsed))extras=parsed;
      }
      const merge=$("importMode").value==="merge";
      if(!merge&&expenses.length&&!confirm(`Replace all ${expenses.length} ${expenses.length===1?"record":"records"} on this device with the ${imported.length} in this file? You can undo this afterwards with “Undo last import”.`)){message.textContent="Import cancelled. Nothing was changed.";message.style.color="";return;}
      const unique=new Map();
      if(merge)expenses.forEach(e=>unique.set(e.id,e));
      // Rows that came without an ID (a spreadsheet CSV) are matched on their content, so importing the same file twice does not double the records.
      const sameAs=e=>[e.date,e.item,e.price.toFixed(2),e.category,e.notes].join("\u0001");   // method is left out on purpose: old CSVs have none
      const known=new Set([...unique.values()].map(sameAs));
      let added=0,updated=0,skipped=0;
      imported.forEach(e=>{
        const noId=e.noId;delete e.noId;
        if(noId&&known.has(sameAs(e))){skipped++;return;}
        if(unique.has(e.id))updated++;else added++;
        unique.set(e.id,e);known.add(sameAs(e));
      });
      const result=[...unique.values()];
      if(result.length>100000)throw new Error("Import would exceed 100,000 records.");
      const previous=expenses;
      const snapshotSaved=lsSet(KEYS.importUndo,JSON.stringify({saved:new Date().toISOString(),expenses:previous,...snapshotExtras()}));
      expenses=result;
      if(!saveExpenses()){expenses=previous;return;}
      if(extras)applyImportedExtras(extras,merge);
      renderAll();
      const payCount=extras&&extras.payMe?await applyImportedPayMe(extras.payMe,merge):0;
      const parts=[`${added} added`];if(updated)parts.push(`${updated} updated`);if(skipped)parts.push(`${skipped} already here`);if(payCount)parts.push(`${payCount} Pay me ${payCount===1?"account":"accounts"} restored`);
      message.textContent=merge?`Import finished: ${parts.join(", ")}.`:`Replaced your records with ${result.length} from the file.${payCount?` ${payCount} Pay me ${payCount===1?"account":"accounts"} restored.`:""}`;
      if(!snapshotSaved)message.textContent+=" There was not enough browser storage to keep an undo copy.";
      message.style.color="var(--deep)";
    }catch(err){message.textContent=`Import failed: ${err.message}`;message.style.color="#a84943";}
    finally{event.target.value="";renderUndoImport();}
  }
  function renderUndoImport(){$("undoImportBtn").classList.toggle("hidden",lsGet(KEYS.importUndo)===null);}
  function undoImport(){
    let snap=null;try{snap=JSON.parse(lsGet(KEYS.importUndo));}catch(e){}
    const message=$("importMessage");
    if(!snap||!Array.isArray(snap.expenses)){lsDel(KEYS.importUndo);renderUndoImport();return;}
    if(!confirm(`Go back to the ${snap.expenses.length} ${snap.expenses.length===1?"record":"records"} you had before the last import? Anything added since then will be removed.`))return;
    const previous=expenses;
    try{expenses=snap.expenses.map((e,i)=>normalizeExpense(e,i));}catch(e){expenses=previous;message.textContent="The undo copy could not be read.";message.style.color="#a84943";return;}
    if(!saveExpenses()){expenses=previous;return;}
    customViews=cleanViews(snap.savedViews);
    if("budgets" in snap)budgets=cleanBudgets(snap.budgets);
    if("recurring" in snap)recurring=cleanRecurring(snap.recurring);
    if("income" in snap)income=cleanIncome(snap.income);
    saveExtras();
    lsDel(KEYS.importUndo);renderAll();renderUndoImport();
    message.textContent="Import undone. Your earlier records are back.";message.style.color="var(--deep)";
  }


  /* =====================================================================================
     Version 2.1: budget, recurring expenses, income, description suggestions, backup reminder.
     Each lives under its own storage key and travels in the JSON backup.
     ===================================================================================== */
  function readJSON(key){ try { return JSON.parse(lsGet(key)); } catch(e) { return null; } }
  function cleanAmount(value){ const n=Math.round(Number(value)*100)/100; return Number.isFinite(n)&&n>0&&n<=999999999 ? n : 0; }
  function cleanBudgets(v){
    const out={overall:0,categories:{}};
    if(!v||typeof v!=="object")return out;
    out.overall=cleanAmount(v.overall);
    if(v.categories&&typeof v.categories==="object")categoryNames.forEach(name=>{const n=cleanAmount(v.categories[name]);if(n)out.categories[name]=n;});
    return out;
  }
  function cleanRecurring(v){
    if(!Array.isArray(v))return [];
    const seen=new Set();
    return v.map(r=>{
      if(!r||typeof r!=="object")return null;
      const item=String(r.item||"").trim().slice(0,120),price=cleanAmount(r.price),day=Math.round(Number(r.day));
      if(!item||!price||!categoryNames.includes(r.category)||!(day>=1&&day<=31))return null;
      let id=String(r.id||makeId()).slice(0,80);if(seen.has(id))id=makeId();seen.add(id);
      return {id,item,price,category:r.category,method:cleanMethod(r.method),day,doneMonth:/^\d{4}-\d{2}$/.test(r.doneMonth)?r.doneMonth:""};
    }).filter(Boolean).slice(0,100);
  }
  function cleanIncome(v){
    if(!Array.isArray(v))return [];
    const seen=new Set();
    return v.map(r=>{
      if(!r||typeof r!=="object")return null;
      const source=String(r.source||"").trim().slice(0,120),amount=cleanAmount(r.amount);
      if(!source||!amount||!validDate(r.date))return null;
      let id=String(r.id||makeId()).slice(0,80);if(seen.has(id))id=makeId();seen.add(id);
      return {id,date:r.date,source,amount};
    }).filter(Boolean).slice(0,20000);
  }
  const snapshotExtras = () => ({savedViews:customViews,budgets,recurring,income});
  function saveExtras(){
    return [lsSet(KEYS.views,JSON.stringify(customViews)),lsSet(KEYS.budgets,JSON.stringify(budgets)),lsSet(KEYS.recurring,JSON.stringify(recurring)),lsSet(KEYS.income,JSON.stringify(income))].every(Boolean);
  }
  // A backup made before version 2.1 has no budget, recurring or income section: whatever is missing from the file is left as it is.
  function applyImportedExtras(file,merge){
    const byId=(mine,theirs)=>{const map=new Map();if(merge)mine.forEach(x=>map.set(x.id,x));theirs.forEach(x=>map.set(x.id,x));return [...map.values()];};
    if(Array.isArray(file.savedViews)){
      const views=cleanViews(file.savedViews),names=new Set(views.map(v=>v.name.toLocaleLowerCase()));
      customViews=(merge?[...customViews.filter(v=>!names.has(v.name.toLocaleLowerCase())),...views]:views).slice(-12);
    }
    if(file.budgets&&typeof file.budgets==="object"){
      const theirs=cleanBudgets(file.budgets);
      budgets=merge?{overall:budgets.overall||theirs.overall,categories:{...theirs.categories,...budgets.categories}}:theirs;   // on merge, limits already set here win
    }
    if(Array.isArray(file.recurring))recurring=cleanRecurring(byId(recurring,cleanRecurring(file.recurring)));
    if(Array.isArray(file.income))income=cleanIncome(byId(income,cleanIncome(file.income)));
    saveExtras();
  }

  /* ----- Description suggestions: past descriptions, newest first; picking one fills the category and payment method ----- */
  function renderSuggestions(){
    itemLookup=new Map();
    [...expenses].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).forEach(e=>{
      const key=e.item.toLocaleLowerCase();
      if(!itemLookup.has(key))itemLookup.set(key,{item:e.item,category:e.category,method:e.method});
    });
    const list=$("itemSuggestions");list.innerHTML="";
    [...itemLookup.values()].slice(0,150).forEach(x=>{const o=document.createElement("option");o.value=x.item;list.appendChild(o);});
  }
  function applySuggestion(){
    if($("expenseId").value)return;   // never change the category of an expense being edited
    const hit=itemLookup.get($("expenseItem").value.trim().toLocaleLowerCase());
    if(!hit)return;
    if(!categoryTouched)$("expenseCategory").value=hit.category;
    if(!methodTouched&&hit.method)$("expenseMethod").value=hit.method;
  }

  /* ----- Budget ----- */
  function budgetBar(label,spent,limit){
    const ratio=limit?spent/limit:0,state=ratio>1?"over":ratio>=.8?"near":"ok",left=Math.round((limit-spent)*100)/100;
    return `<div class="budget-row budget-${state}"><div class="budget-row-head"><span class="budget-row-label">${label}</span><span class="budget-row-figures">${money(spent)} of ${money(limit)}</span></div><div class="budget-track" role="img" aria-label="${Math.round(ratio*100)} percent of the limit used"><i style="width:${Math.min(100,ratio*100).toFixed(1)}%"></i></div><span class="budget-row-note">${left>=0?`${money(left)} left`:`${money(-left)} over`}</span></div>`;
  }
  function renderBudgetHome(){
    const month=currentMonth(),rows=expenses.filter(e=>e.date.startsWith(month)),spent=sum(rows);
    const earned=Math.round(income.filter(r=>r.date.startsWith(month)).reduce((n,r)=>n+Math.round(r.amount*100),0))/100;
    let html="";
    if(budgets.overall)html+=budgetBar("<strong>Total</strong>",spent,budgets.overall);
    categories.forEach(c=>{const limit=budgets.categories[c.name];if(limit)html+=budgetBar(`${c.icon} ${escapeHTML(c.name)}`,sum(rows.filter(e=>e.category===c.name)),limit);});
    if(earned){const left=Math.round((earned-spent)*100)/100;html+=`<p class="budget-income">Income this month ${money(earned)} · <strong class="${left<0?"change-up":"change-down"}">${left>=0?`${money(left)} left after spending`:`${money(-left)} more spent than received`}</strong></p>`;}
    if(!html)html='<p class="chart-subtitle">No budget yet. Set a monthly total or a limit for any category, and your progress shows here.</p>';
    $("budgetHome").innerHTML=html;
  }
  function fillBudgetForm(force){
    if(!force&&$("budgetForm").contains(document.activeElement))return;   // do not overwrite what she is typing
    $("budgetOverall").value=budgets.overall||"";
    categories.forEach((c,i)=>{$(`budgetCat${i}`).value=budgets.categories[c.name]||"";});
  }
  function saveBudgetForm(event){
    event.preventDefault();
    const next={overall:$("budgetOverall").value,categories:{}};
    categories.forEach((c,i)=>{next.categories[c.name]=$(`budgetCat${i}`).value;});
    budgets=cleanBudgets(next);
    const saved=lsSet(KEYS.budgets,JSON.stringify(budgets));
    fillBudgetForm(true);renderBudgetHome();
    const count=Object.keys(budgets.categories).length+(budgets.overall?1:0);
    $("budgetMessage").textContent=!saved?"Could not save the budget in browser storage.":count?`Budget saved: ${count} ${count===1?"limit":"limits"}.`:"No limits set.";
  }

  /* ----- Recurring expenses ----- */
  function dueDate(r,month){const [y,m]=month.split("-").map(Number);return `${month}-${String(Math.min(r.day,new Date(y,m,0).getDate())).padStart(2,"0")}`;}
  const shortDate = date => new Date(date+"T00:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric"});
  function saveRecurring(){return lsSet(KEYS.recurring,JSON.stringify(recurring));}
  function renderDue(){
    const month=currentMonth(),due=recurring.filter(r=>r.doneMonth!==month).sort((a,b)=>a.day-b.day),list=$("dueList");
    $("duePanel").classList.toggle("hidden",!due.length);list.innerHTML="";
    due.forEach(r=>{
      const c=getCategory(r.category),row=document.createElement("div");row.className="recent-transaction due-row";
      row.innerHTML=`<span class="recent-category-icon" aria-hidden="true">${c.icon}</span><span class="recent-main"><strong>${escapeHTML(r.item)}</strong><small>${escapeHTML(shortDate(dueDate(r,month)))} · ${escapeHTML(r.category)}${r.method?" · "+escapeHTML(r.method):""}</small></span><strong class="recent-amount">${money(r.price)}</strong><span class="due-actions"><button class="button button-primary" type="button" data-due-add aria-label="Add ${escapeHTML(r.item)} for this month">Add</button><button class="button button-quiet" type="button" data-due-skip aria-label="Skip ${escapeHTML(r.item)} this month">Skip</button></span>`;
      row.querySelector("[data-due-add]").addEventListener("click",()=>addRecurringNow(r.id));
      row.querySelector("[data-due-skip]").addEventListener("click",()=>{r.doneMonth=month;saveRecurring();renderDue();renderRecurringList();});
      list.appendChild(row);
    });
  }
  function addRecurringNow(id){
    const r=recurring.find(x=>x.id===id),month=currentMonth();if(!r||r.doneMonth===month)return;
    let entry;try{entry=normalizeExpense({date:dueDate(r,month),item:r.item,price:r.price,category:r.category,method:r.method});}catch(e){return;}
    const previous=expenses;expenses=[...expenses,entry];
    if(!saveExpenses()){expenses=previous;return;}
    r.doneMonth=month;saveRecurring();renderAll();
    $("formMessage").textContent=`Added “${r.item}” for ${shortDate(entry.date)}.`;
  }
  function addRecurring(event){
    event.preventDefault();
    const list=cleanRecurring([{item:$("recurringItem").value,price:$("recurringPrice").value,category:$("recurringCategory").value,method:$("recurringMethod").value,day:$("recurringDay").value}]);
    if(!list.length){$("recurringMessage").textContent="Check the description, the price and the day (1 to 31).";return;}
    recurring=[...recurring,list[0]].slice(-100);
    if(!saveRecurring()){$("recurringMessage").textContent="Could not save in browser storage.";return;}
    $("recurringForm").reset();$("recurringDay").value="1";
    renderDue();renderRecurringList();$("recurringMessage").textContent=`“${list[0].item}” will wait on Home each month.`;
  }
  function renderRecurringList(){
    const list=$("recurringList"),month=currentMonth();list.innerHTML="";
    [...recurring].sort((a,b)=>a.day-b.day).forEach(r=>{
      const c=getCategory(r.category),row=document.createElement("div");row.className="recent-transaction due-row";
      row.innerHTML=`<span class="recent-category-icon" aria-hidden="true">${c.icon}</span><span class="recent-main"><strong>${escapeHTML(r.item)}</strong><small>Day ${r.day} · ${escapeHTML(r.category)}${r.method?" · "+escapeHTML(r.method):""}${r.doneMonth===month?" · done for this month":""}</small></span><strong class="recent-amount">${money(r.price)}</strong><span class="due-actions"><button class="icon-button" type="button" aria-label="Remove the recurring expense ${escapeHTML(r.item)}">×</button></span>`;
      row.querySelector("button").addEventListener("click",()=>{
        if(!confirm(`Remove the recurring expense “${r.item}”? Expenses already recorded stay.`))return;
        recurring=recurring.filter(x=>x.id!==r.id);saveRecurring();renderDue();renderRecurringList();
      });
      list.appendChild(row);
    });
  }

  /* ----- Income ----- */
  function addIncome(event){
    event.preventDefault();
    const list=cleanIncome([{date:$("incomeDate").value,source:$("incomeSource").value,amount:$("incomeAmount").value}]);
    if(!list.length){$("incomeMessage").textContent="Check the date, the source and the amount.";return;}
    const previous=income;income=[...income,list[0]];
    if(!lsSet(KEYS.income,JSON.stringify(income))){income=previous;$("incomeMessage").textContent="Could not save in browser storage.";return;}
    $("incomeForm").reset();$("incomeDate").value=localDate();
    renderIncomeList();renderBudgetHome();$("incomeMessage").textContent="Income added.";
  }
  function renderIncomeList(){
    const list=$("incomeList"),month=currentMonth();list.innerHTML="";
    const total=Math.round(income.filter(r=>r.date.startsWith(month)).reduce((n,r)=>n+Math.round(r.amount*100),0))/100;
    $("incomeMonthTotal").textContent=`${money(total)} this month`;
    [...income].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,60).forEach(r=>{
      const row=document.createElement("div");row.className="recent-transaction due-row";
      row.innerHTML=`<span class="recent-category-icon" aria-hidden="true">🌻</span><span class="recent-main"><strong>${escapeHTML(r.source)}</strong><small>${escapeHTML(longDate(r.date))}</small></span><strong class="recent-amount">${money(r.amount)}</strong><span class="due-actions"><button class="icon-button" type="button" aria-label="Remove the income ${escapeHTML(r.source)}">×</button></span>`;
      row.querySelector("button").addEventListener("click",()=>{
        if(!confirm(`Remove “${r.source}”, ${money(r.amount)}?`))return;
        income=income.filter(x=>x.id!==r.id);lsSet(KEYS.income,JSON.stringify(income));renderIncomeList();renderBudgetHome();
      });
      list.appendChild(row);
    });
  }

  /* ----- Backup reminder on Home: after 30 days without an export, with a week's snooze ----- */
  function renderHomeNotices(){
    const host=$("homeNotices");host.innerHTML="";
    if(expenses.length<10)return;
    const day=86400000,last=Date.parse(isoStamp(lsGet(KEYS.lastBackup)||"")),snooze=Date.parse(isoStamp(lsGet(KEYS.backupSnooze)||""));
    const age=Number.isNaN(last)?null:Math.floor((Date.now()-last)/day);
    if(age!==null&&age<30)return;
    if(!Number.isNaN(snooze)&&Date.now()-snooze<7*day)return;
    const box=document.createElement("div");box.className="notice";box.setAttribute("role","status");
    box.innerHTML=`<span class="notice-text"><strong>Time for a backup.</strong> ${age===null?`You have ${expenses.length} expenses and no backup from this device yet.`:`Your last backup was ${age} days ago.`}</span><span class="notice-actions"><button class="button button-primary" type="button" data-notice-export>Export backup</button><button class="button button-quiet" type="button" data-notice-later>Later</button></span>`;
    box.querySelector("[data-notice-export]").addEventListener("click",()=>{exportJSON();renderHomeNotices();});
    box.querySelector("[data-notice-later]").addEventListener("click",()=>{lsSet(KEYS.backupSnooze,new Date().toISOString());renderHomeNotices();});
    host.appendChild(box);
  }

  /* =====================================================================================
     Version 2.3: Pay me. QR codes and account details to show or send when someone pays her back.
     Details live in localStorage (KEYS.payMe). The pictures live in IndexedDB, because every
     isaymotion app shares one origin and its small (~5 MB) localStorage. Both travel in the JSON backup.
     ===================================================================================== */
  const PAY_ACCOUNTS = [   // ids are storage keys: never rename one. Banks in alphabetical order.
    {id:"gcash",name:"GCash",short:"GC",kind:"E-wallet",color:"#1f63d6",numberLabel:"GCash number"},
    {id:"maya",name:"Maya (PayMaya)",short:"MY",kind:"E-wallet",color:"#0f9d6b",numberLabel:"Maya number"},
    {id:"bdo",name:"BDO",short:"BDO",kind:"Bank",color:"#1546a0"},
    {id:"bpi",name:"BPI",short:"BPI",kind:"Bank",color:"#b3242a"},
    {id:"gotyme",name:"GoTyme",short:"GT",kind:"Bank",color:"#0a9fb0"},
    {id:"maribank",name:"MariBank",short:"MR",kind:"Bank",color:"#e8662a"},
    {id:"mayabank",name:"Maya Bank",short:"MB",kind:"Bank",color:"#127a57"},
    {id:"metrobank",name:"Metrobank",short:"MT",kind:"Bank",color:"#24408e"},
    {id:"securitybank",name:"Security Bank",short:"SB",kind:"Bank",color:"#1787c6"},
    {id:"unionbank",name:"UnionBank",short:"UB",kind:"Bank",color:"#e07b00"}
  ];
  const PAY_DB = "little-garden-pay-me", PAY_STORE = "qr";
  let payMeta = {};            // {gcash:{name,number,note,updatedAt}, ...}
  const payQr = {};            // account id -> picture as a data URL (from IndexedDB)
  let payEditing = "";         // account whose editor is open
  let payDraftQr = null;       // picture picked in the open editor: null = unchanged, "" = remove, else data URL
  let payReady = false, payProblem = "";
  let payLoaded = Promise.resolve();
  const payAccount = id => PAY_ACCOUNTS.find(a=>a.id===id);
  const paySaved = id => !!(payQr[id] || (payMeta[id] && (payMeta[id].name || payMeta[id].number)));
  const payInitials = a => a.short || a.name.slice(0,2).toUpperCase();
  const payBadge = (a,extra="") => `<span class="pay-badge${extra}${payInitials(a).length>2?" pay-badge--3":""}" aria-hidden="true" style="--pay:${a.color}">${payInitials(a)}</span>`;
  const isQrDataUrl = v => typeof v==="string" && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length<8e6;
  const canShareFiles = (() => { try { return !!(navigator.canShare && navigator.share && navigator.canShare({files:[new File(["x"],"qr.jpg",{type:"image/jpeg"})]})); } catch(e) { return false; } })();

  function cleanPayMeta(v){
    const out={};
    if(!v||typeof v!=="object")return out;
    PAY_ACCOUNTS.forEach(a=>{
      const r=v[a.id];if(!r||typeof r!=="object")return;
      out[a.id]={name:String(r.name||"").trim().slice(0,80),number:String(r.number||"").trim().slice(0,40),note:String(r.note||"").trim().slice(0,160),updatedAt:isoStamp(r.updatedAt||"")||""};
    });
    return out;
  }
  function savePayMeta(){
    const keep={};Object.keys(payMeta).forEach(id=>{if(paySaved(id))keep[id]=payMeta[id];});
    payMeta=keep;
    return lsSet(KEYS.payMe,JSON.stringify(payMeta));
  }

  /* ----- IndexedDB: one store, key = account id, value = data URL ----- */
  function payDb(){
    if(!window.indexedDB)return Promise.reject(new Error("This browser cannot store pictures."));
    if(!payDb.open)payDb.open=new Promise((resolve,reject)=>{
      let req;try{req=indexedDB.open(PAY_DB,1);}catch(e){payDb.open=null;reject(new Error("Picture storage is not available here."));return;}
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(PAY_STORE))req.result.createObjectStore(PAY_STORE);};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>{payDb.open=null;reject(new Error("Picture storage is not available here."));};
    });
    return payDb.open;
  }
  async function payTx(mode,work){
    const db=await payDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(PAY_STORE,mode);work(tx.objectStore(PAY_STORE));
      tx.oncomplete=()=>resolve();
      tx.onerror=tx.onabort=()=>{const err=tx.error;reject(new Error(err&&err.name==="QuotaExceededError"?"There is not enough space on this device to save the picture.":"The picture could not be saved."));};
    });
  }
  const qrPut = (id,url) => payTx("readwrite",st=>st.put(url,id));
  const qrDel = id => payTx("readwrite",st=>st.delete(id));
  async function loadPayQr(){
    try{
      await payTx("readonly",st=>PAY_ACCOUNTS.forEach(a=>{const r=st.get(a.id);r.onsuccess=()=>{if(isQrDataUrl(r.result))payQr[a.id]=r.result;else delete payQr[a.id];};}));
    }catch(e){payProblem=`${e.message} Your account names and numbers still work.`;}
  }

  /* ----- A chosen picture is scaled down (longest side 1400 px) and saved as a JPEG on white ----- */
  function readQrPicture(file){
    return new Promise((resolve,reject)=>{
      if(!file)return reject(new Error("No picture was chosen."));
      if(file.type&&!/^image\//.test(file.type))return reject(new Error("Please choose a picture, such as a screenshot of your QR code."));
      if(file.size>25*1024*1024)return reject(new Error("That picture is larger than 25 MB."));
      const src=URL.createObjectURL(file),img=new Image();
      img.onload=()=>{
        try{
          const scale=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight,1));
          const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
          const c=document.createElement("canvas");c.width=w;c.height=h;
          const ctx=c.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);ctx.imageSmoothingQuality="high";ctx.drawImage(img,0,0,w,h);
          resolve(c.toDataURL("image/jpeg",0.92));
        }catch(e){reject(new Error("That picture could not be read."));}
        finally{URL.revokeObjectURL(src);}
      };
      img.onerror=()=>{URL.revokeObjectURL(src);reject(new Error("That picture could not be opened. Try a PNG or JPG screenshot."));};
      img.src=src;
    });
  }
  function dataUrlToFile(url,name){
    const comma=url.indexOf(","),mime=(url.slice(0,comma).match(/data:([^;]+)/)||[])[1]||"image/jpeg",bin=atob(url.slice(comma+1));
    const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new File([bytes],name,{type:mime});
  }
  async function copyText(text,btn){
    let ok=false;
    try{await navigator.clipboard.writeText(text);ok=true;}
    catch(e){const ta=document.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");ta.style.cssText="position:fixed;top:0;opacity:0";document.body.appendChild(ta);ta.select();try{ok=document.execCommand("copy");}catch(_){}ta.remove();}
    if(btn){const old=btn.dataset.label||btn.textContent;btn.dataset.label=old;btn.textContent=ok?"Copied":"Could not copy";setTimeout(()=>{btn.textContent=old;},1600);}
  }
  function sharePayQr(id){
    const a=payAccount(id),url=payQr[id];if(!a||!url)return;
    const m=payMeta[id]||{},file=dataUrlToFile(url,`${a.id}-qr.jpg`);
    // Build the file before calling share(): iPhone only allows share() straight after the tap.
    if(canShareFiles&&navigator.canShare({files:[file]})){
      navigator.share({files:[file],title:`${a.name} QR code`,text:[a.name,m.name,m.number].filter(Boolean).join(" · ")}).catch(()=>{});
      return;
    }
    const link=document.createElement("a");link.href=url;link.download=file.name;document.body.appendChild(link);link.click();link.remove();
  }

  /* ----- Pay me screen ----- */
  function payPicHTML(id){
    const pic=payDraftQr===null?payQr[id]:payDraftQr,a=payAccount(id);
    return `<div class="pay-preview">${pic?`<img src="${pic}" alt="Chosen ${escapeHTML(a.name)} QR picture">`:"<span>No QR picture yet</span>"}</div>
      <div class="pay-pic-actions"><label class="button button-outline pay-file">${pic?"Replace picture":"Choose QR picture"}<input type="file" accept="image/*" class="sr-only" data-pay-file="${id}"></label>${pic?`<button class="button button-quiet" type="button" data-pay-clearpic="${id}">Remove picture</button>`:""}</div>`;
  }
  function payEditorHTML(a){
    const m=payMeta[a.id]||{},saved=paySaved(a.id);
    return `<form class="pay-editor" data-pay-form="${a.id}" novalidate>
      <div class="pay-pic" data-pay-pic="${a.id}">${payPicHTML(a.id)}</div>
      <p class="pay-hint">Tip: in ${escapeHTML(a.name.replace(/\s*\(.*\)/,""))}, open your receive or QR screen, take a screenshot, then choose it here.</p>
      <div><label for="payName-${a.id}">Name on the account</label><input id="payName-${a.id}" maxlength="80" autocomplete="off" value="${escapeHTML(m.name||"")}" placeholder="As it appears to the sender"></div>
      <div><label for="payNumber-${a.id}">${escapeHTML(a.numberLabel||"Account number")}</label><input id="payNumber-${a.id}" maxlength="40" autocomplete="off" inputmode="numeric" value="${escapeHTML(m.number||"")}" placeholder="Optional"></div>
      <div><label for="payNote-${a.id}">Note</label><input id="payNote-${a.id}" maxlength="160" autocomplete="off" value="${escapeHTML(m.note||"")}" placeholder="Optional, e.g. savings account"></div>
      <div class="form-actions"><button class="button button-primary" type="submit">Save</button><button class="button button-quiet" type="button" data-pay-cancel>Cancel</button>${saved?`<button class="button button-quiet pay-remove" type="button" data-pay-remove="${a.id}">Remove ${escapeHTML(a.name)}</button>`:""}</div>
      <p class="form-message" role="status" aria-live="polite" data-pay-msg></p>
    </form>`;
  }
  function payCardHTML(a){
    const m=payMeta[a.id]||{},qr=payQr[a.id],editing=payEditing===a.id;
    const head=`<header class="pay-card__head">${payBadge(a)}<div><h3>${escapeHTML(a.name)}</h3><p>${escapeHTML(a.kind)}</p></div></header>`;
    if(editing)return `<article class="pay-card is-editing" data-pay-card="${a.id}" style="--pay:${a.color}">${head}${payEditorHTML(a)}</article>`;
    return `<article class="pay-card" data-pay-card="${a.id}" style="--pay:${a.color}">${head}
      ${qr?`<button class="pay-qr" type="button" data-pay-show="${a.id}" aria-label="Show the ${escapeHTML(a.name)} QR code full screen"><img src="${qr}" alt="${escapeHTML(a.name)} QR code"></button>`:'<p class="pay-noqr">No QR picture yet. Tap Edit to add one.</p>'}
      ${m.name||m.number?`<div class="pay-lines">${m.name?`<div class="pay-line"><span class="pay-label">Name</span><span class="pay-value">${escapeHTML(m.name)}</span></div>`:""}${m.number?`<div class="pay-line"><span class="pay-label">Number</span><span class="pay-value pay-num">${escapeHTML(m.number)}</span><button class="button button-quiet pay-copy" type="button" data-pay-copy="${a.id}" aria-label="Copy the ${escapeHTML(a.name)} number">Copy</button></div>`:""}</div>`:""}
      ${m.note?`<p class="pay-note">${escapeHTML(m.note)}</p>`:""}
      <div class="pay-actions">${qr?`<button class="button button-primary" type="button" data-pay-show="${a.id}">Show</button><button class="button button-outline" type="button" data-pay-share="${a.id}">${canShareFiles?"Share":"Save picture"}</button>`:""}<button class="button button-outline" type="button" data-pay-edit="${a.id}">Edit</button></div>
    </article>`;
  }
  function renderPayMe(){
    const body=$("payMeBody");if(!body)return;
    if(!payReady){body.innerHTML='<p class="chart-subtitle">Loading your QR codes…</p>';return;}
    const saved=PAY_ACCOUNTS.filter(a=>paySaved(a.id)),open=PAY_ACCOUNTS.filter(a=>!paySaved(a.id));
    body.innerHTML=`${payProblem?`<p class="pay-problem" role="alert">${escapeHTML(payProblem)}</p>`:""}
      ${saved.length?`<div class="pay-grid">${saved.map(payCardHTML).join("")}</div>`:'<div class="empty-state pay-empty"><span aria-hidden="true">🌱</span><h3>No accounts yet</h3><p>Pick one below and add its QR picture.</p></div>'}
      ${open.length?`<h3 class="pay-subhead">${saved.length?"Add another account":"Add an account"}</h3><div class="pay-add-list">${open.map(a=>payEditing===a.id?payCardHTML(a):`<div class="pay-add-row" style="--pay:${a.color}">${payBadge(a)}<div class="pay-add-name"><strong>${escapeHTML(a.name)}</strong><span>${escapeHTML(a.kind)}</span></div><button class="button button-outline" type="button" data-pay-edit="${a.id}" aria-label="Add ${escapeHTML(a.name)}">Add</button></div>`).join("")}</div>`:""}`;
    renderPayHome();
  }
  // Home: one tap from the front page to a full-screen QR code
  function renderPayHome(){
    const box=$("homePayMe");if(!box)return;
    const list=PAY_ACCOUNTS.filter(a=>payQr[a.id]);
    if(!list.length){box.innerHTML="";box.className="";return;}
    box.className="panel pay-home";
    box.innerHTML=`<div class="pay-home__top"><h2 class="pay-home__title">Pay me</h2><a class="pay-home__all" href="#/pay-me">All accounts</a></div><div class="pay-chips">${list.map(a=>`<button class="pay-chip" type="button" data-pay-show="${a.id}" aria-label="Show the ${escapeHTML(a.name)} QR code">${payBadge(a," pay-badge--sm")}<span>${escapeHTML(a.name)}</span></button>`).join("")}</div>`;
  }
  function openPayEditor(id){
    payEditing=id;payDraftQr=null;renderPayMe();
    const card=document.querySelector(`[data-pay-card="${id}"]`);
    if(card){card.scrollIntoView({block:"start",behavior:"smooth"});const f=card.querySelector("input:not([type=file])");if(f)setTimeout(()=>f.focus({preventScroll:true}),250);}
  }
  function closePayEditor(){const id=payEditing;payEditing="";payDraftQr=null;renderPayMe();const back=document.querySelector(`[data-pay-card="${id}"] [data-pay-edit], .pay-add-row [data-pay-edit="${id}"]`);if(back)back.focus({preventScroll:true});}
  async function savePayForm(form){
    const id=form.dataset.payForm,a=payAccount(id),msg=form.querySelector("[data-pay-msg]");
    const name=$(`payName-${id}`).value.trim(),number=$(`payNumber-${id}`).value.trim(),note=$(`payNote-${id}`).value.trim();
    const pic=payDraftQr===null?payQr[id]||"":payDraftQr;
    if(!pic&&!name&&!number){msg.textContent="Add a QR picture, a name or a number first.";msg.style.color="var(--bad)";return;}
    try{
      if(payDraftQr!==null){if(payDraftQr)await qrPut(id,payDraftQr);else await qrDel(id);}
    }catch(e){msg.textContent=e.message;msg.style.color="var(--bad)";return;}
    if(payDraftQr!==null){if(payDraftQr)payQr[id]=payDraftQr;else delete payQr[id];}
    payMeta[id]={name,number,note,updatedAt:new Date().toISOString()};
    const ok=savePayMeta();
    payEditing="";payDraftQr=null;renderPayMe();
    const card=document.querySelector(`[data-pay-card="${id}"]`);
    if(card){card.classList.add("is-fresh");card.scrollIntoView({block:"nearest"});const b=card.querySelector("[data-pay-show],[data-pay-edit]");if(b)b.focus({preventScroll:true});}
    if(!ok)alert(`${a.name} was saved, but the name and number could not be stored because this browser’s storage is full.`);
  }
  async function removePayAccount(id){
    const a=payAccount(id);
    if(!confirm(`Remove ${a.name} from Pay me? Its QR picture and details will be deleted from this device.`))return;
    try{await qrDel(id);}catch(e){}
    delete payQr[id];delete payMeta[id];savePayMeta();
    payEditing="";payDraftQr=null;renderPayMe();
  }
  function bindPayMe(){
    const view=$("payMeView");
    view.addEventListener("click",e=>{
      const t=e.target.closest("button");if(!t)return;
      if(t.dataset.payEdit)openPayEditor(t.dataset.payEdit);
      else if("payCancel" in t.dataset)closePayEditor();
      else if(t.dataset.payRemove)removePayAccount(t.dataset.payRemove);
      else if(t.dataset.payShare)sharePayQr(t.dataset.payShare);
      else if(t.dataset.payCopy)copyText((payMeta[t.dataset.payCopy]||{}).number||"",t);
      else if(t.dataset.payClearpic){payDraftQr="";const box=view.querySelector(`[data-pay-pic="${t.dataset.payClearpic}"]`);if(box)box.innerHTML=payPicHTML(t.dataset.payClearpic);}
    });
    view.addEventListener("change",async e=>{
      const input=e.target.closest("[data-pay-file]");if(!input)return;
      const id=input.dataset.payFile,form=input.closest("form"),msg=form&&form.querySelector("[data-pay-msg]");
      try{payDraftQr=await readQrPicture(input.files&&input.files[0]);if(msg){msg.textContent="Picture ready. Tap Save to keep it.";msg.style.color="var(--deep)";}}
      catch(err){if(msg){msg.textContent=err.message;msg.style.color="var(--bad)";}return;}
      const box=view.querySelector(`[data-pay-pic="${id}"]`);if(box)box.innerHTML=payPicHTML(id);
    });
    view.addEventListener("submit",e=>{const form=e.target.closest("[data-pay-form]");if(!form)return;e.preventDefault();savePayForm(form);});
    document.addEventListener("click",e=>{const t=e.target.closest("[data-pay-show]");if(t)openPayViewer(t.dataset.payShow);});
  }

  /* ----- Full-screen viewer: white card, big QR code, swipe-free Previous/Next between saved codes ----- */
  let payViewing = "", payViewerReturn = null;
  function payViewer(){
    let v=$("payViewer");if(v)return v;
    v=document.createElement("div");v.id="payViewer";v.className="pay-viewer";v.hidden=true;
    v.setAttribute("role","dialog");v.setAttribute("aria-modal","true");v.setAttribute("aria-labelledby","payViewerTitle");
    v.innerHTML=`<div class="pay-viewer__card"><div class="pay-viewer__top"><h2 id="payViewerTitle"></h2><button class="pay-viewer__close" type="button" data-pv="close" aria-label="Close">✕</button></div>
      <img class="pay-viewer__img" alt=""><p class="pay-viewer__name"></p><div class="pay-viewer__numrow"><p class="pay-viewer__num"></p><button class="button pay-viewer__btn" type="button" data-pv="copy">Copy number</button></div><p class="pay-viewer__note"></p>
      <div class="pay-viewer__nav"><button class="button pay-viewer__btn" type="button" data-pv="prev">‹ Previous</button><span class="pay-viewer__count"></span><button class="button pay-viewer__btn" type="button" data-pv="next">Next ›</button></div></div>`;
    document.body.appendChild(v);
    v.addEventListener("click",e=>{
      const b=e.target.closest("[data-pv]");
      if(e.target===v||b&&b.dataset.pv==="close")closePayViewer();
      else if(b&&b.dataset.pv==="prev")stepPayViewer(-1);
      else if(b&&b.dataset.pv==="next")stepPayViewer(1);
      else if(b&&b.dataset.pv==="copy")copyText((payMeta[payViewing]||{}).number||"",b);
    });
    document.addEventListener("keydown",e=>{
      if(v.hidden)return;
      if(e.key==="Escape"){e.preventDefault();closePayViewer();}
      else if(e.key==="ArrowLeft")stepPayViewer(-1);
      else if(e.key==="ArrowRight")stepPayViewer(1);
      else if(e.key==="Tab"){const f=[...v.querySelectorAll("button:not([hidden])")].filter(x=>x.offsetParent!==null);if(!f.length)return;const i=f.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus();}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}}
    });
    window.addEventListener("hashchange",()=>closePayViewer(false));
    return v;
  }
  function paintPayViewer(){
    const v=payViewer(),a=payAccount(payViewing),m=payMeta[payViewing]||{},list=PAY_ACCOUNTS.filter(x=>payQr[x.id]),i=list.findIndex(x=>x.id===payViewing);
    v.querySelector(".pay-viewer__card").style.setProperty("--pay",a.color);
    v.querySelector("h2").innerHTML=`${payBadge(a," pay-badge--sm")} ${escapeHTML(a.name)}`;
    const img=v.querySelector("img");img.src=payQr[payViewing];img.alt=`${a.name} QR code`;
    const name=v.querySelector(".pay-viewer__name");name.textContent=m.name||"";name.hidden=!m.name;
    v.querySelector(".pay-viewer__num").textContent=m.number||"";v.querySelector(".pay-viewer__numrow").hidden=!m.number;
    const note=v.querySelector(".pay-viewer__note");note.textContent=m.note||"";note.hidden=!m.note;
    v.querySelector(".pay-viewer__nav").hidden=list.length<2;
    v.querySelector(".pay-viewer__count").textContent=`${i+1} of ${list.length}`;
  }
  function openPayViewer(id){
    if(!payQr[id])return;
    payViewerReturn=document.activeElement;payViewing=id;
    const v=payViewer();paintPayViewer();v.hidden=false;document.body.classList.add("pay-viewer-open");
    v.querySelector("[data-pv=close]").focus();
  }
  function stepPayViewer(dir){
    const list=PAY_ACCOUNTS.filter(x=>payQr[x.id]);if(list.length<2)return;
    const i=list.findIndex(x=>x.id===payViewing);payViewing=list[(i+dir+list.length)%list.length].id;paintPayViewer();
  }
  function closePayViewer(restoreFocus=true){
    const v=$("payViewer");if(!v||v.hidden)return;
    v.hidden=true;document.body.classList.remove("pay-viewer-open");payViewing="";
    if(restoreFocus&&payViewerReturn&&document.contains(payViewerReturn))payViewerReturn.focus({preventScroll:true});
  }

  /* ----- Backup: the JSON file carries every saved account, picture included ----- */
  async function payMeForBackup(){
    await payLoaded;
    const accounts={};
    PAY_ACCOUNTS.forEach(a=>{if(!paySaved(a.id))return;const m=payMeta[a.id]||{};accounts[a.id]={name:m.name||"",number:m.number||"",note:m.note||"",updatedAt:m.updatedAt||"",qr:payQr[a.id]||""};});
    return {accounts};
  }
  // Older backups have no payMe section and change nothing here. On merge, accounts already on this device win.
  async function applyImportedPayMe(section,merge){
    if(!section||typeof section!=="object"||!section.accounts||typeof section.accounts!=="object")return 0;
    await payLoaded;
    const meta=cleanPayMeta(section.accounts);let count=0;
    for(const a of PAY_ACCOUNTS){
      const m=meta[a.id];if(!m)continue;
      if(merge&&paySaved(a.id))continue;
      const qr=isQrDataUrl(section.accounts[a.id].qr)?section.accounts[a.id].qr:"";
      if(!qr&&!m.name&&!m.number)continue;
      try{if(qr)await qrPut(a.id,qr);else await qrDel(a.id);}catch(e){continue;}
      if(qr)payQr[a.id]=qr;else delete payQr[a.id];
      payMeta[a.id]=m;count++;
    }
    savePayMeta();renderPayMe();
    return count;
  }
  function initPayMe(){
    payMeta=cleanPayMeta(readJSON(KEYS.payMe));
    bindPayMe();
    payLoaded=loadPayQr().then(()=>{payReady=true;renderPayMe();});
  }

  /* =====================================================================================
     Version 2.3: updates arrive without reinstalling. An installed iPhone app resumes instead of
     reloading, so it checks for a new version each time it comes back to the screen, and reloads once
     when the new version takes over (later, if she is in the middle of typing).
     ===================================================================================== */
  function initUpdates(){
    if(!("serviceWorker" in navigator)||location.protocol==="file:")return;
    const sw=navigator.serviceWorker;
    let hadController=!!sw.controller;   // the very first install takes over without a reload; every later version reloads
    let reloading=false,waiting=false,lastCheck=Date.now();
    const busy=()=>{
      const el=document.activeElement,tag=(el&&el.tagName||"").toLowerCase();
      return payEditing||tag==="input"||tag==="textarea"||tag==="select"||!!($("expenseId").value||$("expenseItem").value.trim()||$("expensePrice").value);
    };
    const reload=()=>{if(reloading)return;reloading=true;location.reload();};
    sw.addEventListener("controllerchange",()=>{if(!hadController){hadController=true;return;}if(busy())waiting=true;else reload();});
    sw.register("./sw.js",{updateViaCache:"none"}).then(reg=>{
      document.addEventListener("visibilitychange",()=>{
        if(document.visibilityState==="hidden"){if(waiting)reload();return;}
        if(Date.now()-lastCheck<30000)return;
        lastCheck=Date.now();reg.update().catch(()=>{});
      });
    }).catch(err=>console.warn("Offline cache unavailable",err));
  }

  /* =====================================================================================
     App shell, shared with the other isaymotion apps: ☰ menu (docked sidebar on wide screens,
     drawer on phones and tablets), back/forward buttons, top-bar search, text size, theme,
     bottom tab bar, What's new and About. Screens are the .page-view blocks in index.html;
     the address after # picks which one shows, so the browser's own Back button works too.
     ===================================================================================== */
  const ROUTES = {
    home:{title:"",label:"Home",icon:"home",group:"Start"},
    "pay-me":{title:"Pay me",label:"Pay me",icon:"qr",group:"Start"},
    transactions:{title:"Transactions",label:"Transactions",icon:"list",group:"Your spending"},
    insights:{title:"Insights",label:"Insights",icon:"pie",group:"Your spending"},
    calendar:{title:"Calendar",label:"Calendar",icon:"calendar",group:"Your spending"},
    budget:{title:"Budget and income",label:"Budget and income",icon:"wallet",group:"Your spending"},
    tools:{title:"Tools and backup",label:"Tools and backup",icon:"tools",group:"Your data"},
    "whats-new":{title:"What’s new",label:"What’s new",icon:"news",group:"App",badge:"news"},
    about:{title:"About",label:"About",icon:"info",group:"App"}
  };
  const LEGACY_ROUTES = {journal:"transactions",reports:"insights"};   // addresses used before version 2
  const ICONS = {
    home:'<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    pie:'<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    calendar:'<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    tools:'<path d="M12 3v11m0 0l-4-4m4 4l4-4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>',
    wallet:'<path d="M4 7a2 2 0 0 1 2-2h11v3M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-1zM16.5 13.5h.01"/>',
    news:'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h6M9 16h6"/>',
    qr:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 20h.01M20 14v.01"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    external:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
  };
  const navIcon = name => `<svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||ICONS.info}</svg>`;
  const routeHash = name => name==="home" ? "#/" : `#/${name}`;
  let pendingAfter = null;
  let shellReady = false;

  function currentRoute(){
    let key=location.hash.replace(/^#\/?/,"").split("/")[0];
    try { key=decodeURIComponent(key); } catch(e) {}
    key=key.toLowerCase();
    if(LEGACY_ROUTES[key]) key=LEGACY_ROUTES[key];
    if(!key) return "home";
    return Object.prototype.hasOwnProperty.call(ROUTES,key) ? key : "missing";
  }
  // Go to a screen. `after` runs once that screen is showing (used to focus the form, for example).
  function go(name,after){
    if(!shellReady){ pendingAfter=after||null; return; }
    if(currentRoute()===name){ pendingAfter=after||null; route(); return; }
    pendingAfter=after||null;
    location.hash=routeHash(name);   // the hashchange listener calls route()
  }

  /* ----- Theme: match device / light / dark. Stored only when it is light or dark. ----- */
  const THEME_ICONS = {
    auto:'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
    dark:'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    light:'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  const THEME_NAMES = {auto:"Match device",light:"Light",dark:"Dark"};
  const darkMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function getThemeMode(){ const t=lsGet(KEYS.theme); return t==="light"||t==="dark" ? t : "auto"; }
  function applyTheme(mode){
    const root=document.documentElement,dark=mode==="dark"||(mode==="auto"&&!!darkMQ&&darkMQ.matches);
    root.setAttribute("data-theme",dark?"dark":"light");root.setAttribute("data-theme-mode",mode);
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",dark?"#17251d":"#315b43");
    const btn=$("theme-btn"),label=`Theme: ${THEME_NAMES[mode]}`;
    btn.innerHTML=THEME_ICONS[mode];btn.setAttribute("aria-label",label);btn.setAttribute("title",label);
    document.querySelectorAll('input[name="theme"]').forEach(r=>{r.checked=r.value===mode;});
  }
  function setTheme(mode){
    if(mode!=="light"&&mode!=="dark")mode="auto";
    if(mode==="auto")lsDel(KEYS.theme);else lsSet(KEYS.theme,mode);
    applyTheme(mode);
  }

  /* ----- Header height -> --top (the sidebar and the Aa panel sit under it) ----- */
  function setTopVar(){ const bar=document.querySelector(".topbar"); document.documentElement.style.setProperty("--top",`${bar?bar.offsetHeight:64}px`); }

  /* ----- Text size ----- */
  const TEXT_SIZES = [["90","Smaller"],["100","Default"],["112.5","Larger"],["125","Largest"]];
  function getTextSize(){ const v=lsGet(KEYS.textSize); return TEXT_SIZES.some(z=>z[0]===v) ? v : "100"; }
  function setTextSize(value){
    if(!TEXT_SIZES.some(z=>z[0]===value))value="100";
    if(value==="100")lsDel(KEYS.textSize);else lsSet(KEYS.textSize,value);
    document.documentElement.style.fontSize=value==="100"?"":`${value}%`;
    document.querySelectorAll('input[name="textSize"],input[name="aboutTextSize"]').forEach(r=>{r.checked=r.value===value;});
    setTopVar();
  }
  function segGroup(name,legend,options,current){
    return `<fieldset class="setting"><legend>${escapeHTML(legend)}</legend><div class="seg">${options.map(o=>`<label><input type="radio" name="${name}" value="${o[0]}"${o[0]===current?" checked":""}><span>${escapeHTML(o[1])}</span></label>`).join("")}</div></fieldset>`;
  }
  function initTextSize(){
    const btn=$("textSizeBtn"),panel=document.createElement("div");
    panel.className="text-size-panel";panel.id="textSizePanel";panel.hidden=true;panel.setAttribute("role","dialog");panel.setAttribute("aria-label","Text size");
    document.body.appendChild(panel);
    const close=()=>{if(panel.hidden)return;panel.hidden=true;btn.setAttribute("aria-expanded","false");};
    const open=()=>{
      const cur=getTextSize();
      panel.innerHTML=`<p class="text-size-panel__title">Text size</p><div class="seg">${TEXT_SIZES.map((z,i)=>`<label><input type="radio" name="textSize" value="${z[0]}"${cur===z[0]?" checked":""}><span style="font-size:${(0.82+i*0.1).toFixed(2)}rem">${z[1]}</span></label>`).join("")}</div>`;
      panel.hidden=false;btn.setAttribute("aria-expanded","true");const f=panel.querySelector("input:checked");if(f)f.focus();
    };
    btn.addEventListener("click",e=>{e.stopPropagation();if(panel.hidden)open();else close();});
    panel.addEventListener("change",e=>{if(e.target.name==="textSize")setTextSize(e.target.value);});
    document.addEventListener("click",e=>{if(!panel.hidden&&!panel.contains(e.target)&&!btn.contains(e.target))close();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!panel.hidden){close();btn.focus();}});
    window.addEventListener("hashchange",close);
  }

  /* ----- In-app back/forward buttons: each history entry is stamped with its position ----- */
  const HIST_KEY = "little-garden-hist";
  let hist = {cur:0,max:0};
  const saveHist = () => { try { sessionStorage.setItem(HIST_KEY,JSON.stringify(hist)); } catch(e) {} };
  const stampHist = index => { try { history.replaceState({lgIdx:index},""); } catch(e) {} };
  function paintHist(){ $("nav-back").disabled=hist.cur<=0; $("nav-fwd").disabled=hist.cur>=hist.max; }
  function syncHist(){
    const st=history.state;
    if(st&&typeof st.lgIdx==="number"){hist.cur=st.lgIdx;if(hist.cur>hist.max)hist.max=hist.cur;}
    else{hist.cur+=1;hist.max=hist.cur;stampHist(hist.cur);}   // a new screen: anything that was ahead is discarded
    saveHist();paintHist();
  }
  function initHist(){
    try { const saved=JSON.parse(sessionStorage.getItem(HIST_KEY)); if(saved&&typeof saved.cur==="number"&&typeof saved.max==="number")hist=saved; } catch(e) {}
    const st=history.state;
    if(st&&typeof st.lgIdx==="number"){hist.cur=st.lgIdx;if(hist.max<hist.cur)hist.max=hist.cur;}
    else{hist={cur:0,max:0};stampHist(0);}
    saveHist();paintHist();
    $("nav-back").addEventListener("click",()=>{if(!$("nav-back").disabled)history.back();});
    $("nav-fwd").addEventListener("click",()=>{if(!$("nav-fwd").disabled)history.forward();});
    document.addEventListener("keydown",e=>{
      const tag=(e.target.tagName||"").toLowerCase(),typing=tag==="input"||tag==="textarea"||tag==="select"||e.target.isContentEditable;
      if(e.altKey&&!typing&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&(e.key==="ArrowLeft"||e.key==="ArrowRight")){e.preventDefault();if(e.key==="ArrowLeft")history.back();else history.forward();}
    });
  }

  /* ----- Scroll position comes back on Back/Forward, and starts at the top on ordinary links ----- */
  const scrollMemo = {};
  let scrollKey = "home", fromHistory = false;

  /* ----- Menu ----- */
  const isDrawerMode = () => window.matchMedia("(max-width: 1099px)").matches;
  function setMenuExpanded(open){ [$("menu-btn"),$("tab-menu")].forEach(b=>b.setAttribute("aria-expanded",open?"true":"false")); }
  function openDrawer(){
    if(!isDrawerMode())return;
    document.body.classList.add("drawer-open");$("nav-backdrop").hidden=false;setMenuExpanded(true);
    setTimeout(()=>$("nav-close").focus(),60);
  }
  function closeDrawer(){
    if(!document.body.classList.contains("drawer-open"))return;
    document.body.classList.remove("drawer-open");$("nav-backdrop").hidden=true;setMenuExpanded(false);
  }
  function otherApps(){
    if(!window.SHOW_OTHER_APPS||!Array.isArray(window.APP_LINKS))return [];
    const me=String(META.repo||"").toLowerCase();
    return window.APP_LINKS.filter(a=>a&&a.name&&/^https?:\/\//i.test(String(a.href||""))&&String(a.href).replace(/[?#].*$/,"").replace(/\/+$/,"").split("/").pop().toLowerCase()!==me);
  }
  function buildNav(){
    const cur=currentRoute(),groups=[];
    Object.keys(ROUTES).forEach(key=>{
      const r=ROUTES[key];let g=groups.find(x=>x.label===r.group);
      if(!g){g={label:r.group,items:[]};groups.push(g);}
      g.items.push(`<li><a class="nav-item${key===cur?" is-active":""}" href="${routeHash(key)}"${key===cur?' aria-current="page"':""}>${navIcon(r.icon)}<span>${escapeHTML(r.label)}</span>${r.badge?`<span class="badge" data-badge="${r.badge}" hidden></span>`:""}</a></li>`);
    });
    let html=groups.map(g=>`<div class="nav-group"><div class="nav-label">${escapeHTML(g.label)}</div><ul>${g.items.join("")}</ul></div>`).join("");
    const others=otherApps();
    if(others.length)html+=`<div class="nav-group"><div class="nav-label">Other apps</div><ul>${others.map(a=>`<li><a class="nav-item" href="${escapeHTML(a.href)}" target="_blank" rel="noopener">${navIcon("external")}<span>${escapeHTML(a.name)}</span><span class="sr-only"> (opens in a new tab)</span></a></li>`).join("")}</ul></div>`;
    $("sidenav-body").innerHTML=html;
    document.querySelectorAll(".tabbar a[data-tab]").forEach(tab=>{
      const on=tab.dataset.tab===cur;tab.classList.toggle("is-active",on);
      if(on)tab.setAttribute("aria-current","page");else tab.removeAttribute("aria-current");
    });
  }
  function initMenu(){
    $("menu-btn").addEventListener("click",openDrawer);
    $("tab-menu").addEventListener("click",()=>{if(document.body.classList.contains("drawer-open"))closeDrawer();else openDrawer();});
    $("nav-close").addEventListener("click",()=>{closeDrawer();$("menu-btn").focus();});
    $("nav-backdrop").addEventListener("click",closeDrawer);
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.body.classList.contains("drawer-open")){closeDrawer();$("menu-btn").focus();}});
    $("sidenav").addEventListener("click",e=>{const a=e.target.closest("a");if(a&&(a.getAttribute("href")===routeHash(currentRoute())||a.target==="_blank"))closeDrawer();});
    const collapse=$("collapse-btn");
    const label=()=>{const c=document.documentElement.classList.contains("nav-collapsed"),text=c?"Show the sidebar":"Hide the sidebar";collapse.setAttribute("aria-label",text);collapse.setAttribute("title",text);};
    collapse.addEventListener("click",()=>{
      const c=!document.documentElement.classList.contains("nav-collapsed");
      document.documentElement.classList.toggle("nav-collapsed",c);
      if(c)lsSet(KEYS.navCollapsed,"1");else lsDel(KEYS.navCollapsed);
      label();setTopVar();
    });
    label();
  }

  /* ----- What's new: the badge counts entries newer than the last one you opened ----- */
  const latestNews = () => CHANGELOG.length ? String(CHANGELOG[0].version) : "";
  function seenNews(){
    let seen=lsGet(KEYS.seenNews);
    if(seen===null){
      // A first-time visitor starts up to date. Someone who already has expenses saved is coming from an
      // earlier version, so everything after the first release counts as new for them.
      seen=expenses.length&&CHANGELOG.length>1?String(CHANGELOG[CHANGELOG.length-1].version):latestNews();
      lsSet(KEYS.seenNews,seen);
    }
    return seen;
  }
  function unseenNews(){
    const seen=seenNews(),out=[];
    for(const entry of CHANGELOG){if(String(entry.version)===seen)return out;out.push(entry);}
    return out;
  }
  function updateBadges(){
    const n=unseenNews().length;
    document.querySelectorAll('[data-badge="news"]').forEach(el=>{el.textContent=String(n);el.hidden=!n;});
  }
  const NEWS_TYPES = {feature:"New",update:"Improved",correction:"Fixed"};
  function renderNews(){
    const fresh=new Set(unseenNews().map(e=>String(e.version)));
    const fmt=iso=>{const d=new Date(`${iso}T00:00:00`);return Number.isNaN(d.getTime())?String(iso||""):d.toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});};
    $("newsView").innerHTML=`<section class="panel news-panel"><div class="section-heading"><div><p class="eyebrow">FRESH FROM THE GARDEN</p><h2>What’s new</h2><p class="chart-subtitle">Every change to Little Garden, newest first.</p></div><span aria-hidden="true" class="leaf-badge">✿</span></div>${
      CHANGELOG.map(entry=>`<article class="news__entry${fresh.has(String(entry.version))?" is-new":""}"><div class="news__date"><span>${escapeHTML(fmt(entry.date))}</span><span class="news__ver">Version ${escapeHTML(entry.version)}</span>${fresh.has(String(entry.version))?'<span class="news__new">New</span>':""}</div><div class="news__body"><h3>${escapeHTML(entry.title)}</h3><ul>${
        (entry.items||[]).map(it=>{const type=NEWS_TYPES[it.type]?it.type:"feature";return `<li><span class="news__type news__type--${type}">${NEWS_TYPES[type]}</span><span class="news__text">${escapeHTML(it.text)}${it.href&&/^#\//.test(it.href)?` <a href="${escapeHTML(it.href)}">Open</a>`:""}</span></li>`;}).join("")
      }</ul></div></article>`).join("")||'<p class="chart-subtitle">Nothing here yet.</p>'
    }<p class="news__note">Found a bug or have an idea? Write to <a href="mailto:isaymotion@gmail.com">isaymotion@gmail.com</a>.</p></section>`;
    lsSet(KEYS.seenNews,latestNews());   // opening the page marks everything as seen
  }
  function renderAbout(){
    $("aboutView").innerHTML=`<section class="panel about-panel"><div class="section-heading"><div><p class="eyebrow">ABOUT THIS APP</p><h2>${escapeHTML(META.name)}</h2><p class="chart-subtitle">${escapeHTML(META.tagline||"")} · Version ${escapeHTML(META.version||"")}</p></div><span aria-hidden="true" class="leaf-badge">❀</span></div>
      <p class="about-text">A private monthly expense journal in Philippine pesos. Your entries stay in this browser on this device. There is no account, no server and no tracking, and the app keeps working offline once it has loaded.</p>
      <p class="about-text">Because everything is stored here, clearing this browser’s site data erases it. Export a backup now and then from <a href="#/tools">Tools and backup</a>.</p>
      <h3 class="about-h">Settings</h3>
      <div class="about-card">${segGroup("theme","Theme",[["auto","Match device"],["light","Light"],["dark","Dark"]],getThemeMode())}${segGroup("aboutTextSize","Text size",TEXT_SIZES,getTextSize())}</div>
      <h3 class="about-h">Tips</h3>
      <ul class="about-list">
        <li>Tap ☰ for every screen. The arrows beside it go back and forward, and so does your phone’s Back button.</li>
        <li>Search from the top bar on any screen. It looks through descriptions, notes, categories, dates and amounts.</li>
        <li>On Insights, tap a chart slice, a top expense or a heatmap square to open the matching entries.</li>
        <li>On Calendar, tap a day to see it, then add an expense for that day.</li>
        <li>Set a monthly budget, recurring expenses and income in <a href="#/budget">Budget and income</a>. Home then shows how the month is going.</li>
        <li>Keep your GCash, Maya and bank QR codes in <a href="#/pay-me">Pay me</a>. Tap Show to put one full screen for scanning, or Share to send it in a chat.</li>
        <li>Start typing a description you have used before and pick it from the list. The category fills in for you.</li>
        <li>To install on iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen.</li>
      </ul>
      <p class="about-text about-credit">App created by Isabella Navarro, MD. Latest version November 2026. <a href="mailto:isaymotion@gmail.com">isaymotion@gmail.com</a></p>
    </section>`;
  }

  /* ----- Router ----- */
  function route(opts={}){
    closeDrawer();
    const name=currentRoute();
    scrollMemo[scrollKey]=window.scrollY;   // the screen we are leaving
    const restoreY=fromHistory&&name!==scrollKey&&Object.prototype.hasOwnProperty.call(scrollMemo,name)?scrollMemo[name]:null;
    scrollKey=name;fromHistory=false;
    if(name==="whats-new")renderNews();
    if(name==="about")renderAbout();
    if(name==="budget")fillBudgetForm(true);
    if(name==="pay-me")renderPayMe();
    document.querySelectorAll(".page-view").forEach(view=>{const on=view.dataset.view===name;view.hidden=!on;view.classList.toggle("is-active",on);});
    const title=name==="missing"?"Page not found":ROUTES[name].title;
    document.title=title?`${title} — Little Garden`:"Little Garden — Expense Tracker";
    buildNav();updateBadges();
    if(opts.focus&&document.activeElement!==$("q"))$("main").focus({preventScroll:true});
    const after=pendingAfter;pendingAfter=null;
    if(restoreY!==null&&!after)window.requestAnimationFrame(()=>window.scrollTo(0,restoreY));
    else window.scrollTo(0,0);
    if(after)after();
  }

  /* ----- Top-bar search: works from any screen and lists the matches in Transactions ----- */
  function initSearch(){
    const q=$("q");
    q.addEventListener("input",()=>{
      if(currentRoute()==="transactions"){$("searchInput").value=q.value;renderExpenses();}
      else{setJournalFilters({query:q.value});go("transactions");}
    });
    q.addEventListener("keydown",e=>{
      if(e.key==="Enter"){e.preventDefault();if(currentRoute()!=="transactions"){setJournalFilters({query:q.value});go("transactions");}q.blur();}
      else if(e.key==="Escape"&&q.value){e.preventDefault();q.value="";$("searchInput").value="";renderExpenses();}
    });
    document.addEventListener("keydown",e=>{
      const tag=(e.target.tagName||"").toLowerCase();
      if(e.key==="/"&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&tag!=="input"&&tag!=="textarea"&&tag!=="select"&&!e.target.isContentEditable){e.preventDefault();q.focus();q.select();}
    });
  }

  /* ----- Phone tab bar: slides away while you scroll down, comes back when you scroll up ----- */
  function initTabbar(){
    let lastY=window.scrollY,hold=0,ticking=false;
    const show=()=>{if(document.body.classList.contains("tabbar-hidden"))document.body.classList.remove("tabbar-hidden");};
    const hide=()=>{if(!document.body.classList.contains("tabbar-hidden"))document.body.classList.add("tabbar-hidden");};
    const update=()=>{
      ticking=false;
      const y=window.scrollY,dy=y-lastY,max=document.documentElement.scrollHeight-window.innerHeight,a=document.activeElement;
      const typing=!!(a&&a.matches&&a.matches("input, textarea, select"));
      if(Date.now()<hold||document.body.classList.contains("drawer-open")||typing||y<80||y>max-80){show();lastY=y;}
      else if(dy>10){hide();lastY=y;}
      else if(dy<-6){show();lastY=y;}
    };
    window.addEventListener("scroll",()=>{if(!ticking){ticking=true;window.requestAnimationFrame(update);}},{passive:true});
    window.addEventListener("hashchange",()=>{hold=Date.now()+700;show();});
    document.addEventListener("focusin",e=>{if(e.target.matches&&e.target.matches("input, textarea, select"))show();});
  }

  function initShell(){
    applyTheme(getThemeMode());
    $("theme-btn").addEventListener("click",()=>setTheme({auto:"light",light:"dark",dark:"auto"}[getThemeMode()]));
    if(darkMQ){const onDevice=()=>applyTheme(getThemeMode());if(darkMQ.addEventListener)darkMQ.addEventListener("change",onDevice);else if(darkMQ.addListener)darkMQ.addListener(onDevice);}
    setTopVar();window.addEventListener("resize",setTopVar);
    initTextSize();initHist();initMenu();initSearch();initTabbar();renderUndoImport();
    if("scrollRestoration" in history)history.scrollRestoration="manual";
    window.addEventListener("popstate",e=>{fromHistory=!!(e.state&&typeof e.state.lgIdx==="number");});
    window.addEventListener("hashchange",()=>{syncHist();route({focus:true});});
    $("main").addEventListener("change",e=>{
      if(e.target.name==="theme")setTheme(e.target.value);
      else if(e.target.name==="aboutTextSize")setTextSize(e.target.value);
    });
    shellReady=true;
    const after=pendingAfter;pendingAfter=null;
    route();
    if(after)after();
  }

  init();
})();