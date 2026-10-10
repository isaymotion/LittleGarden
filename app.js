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
  function init(){
    $("expenseDate").value=localDate();
    $("reportMonth").value=currentMonth();
    categories.forEach(c=>{
      $("expenseCategory").add(new Option(`${c.icon} ${c.name}`,c.name));
      $("categoryFilter").add(new Option(c.name,c.name));
    });
    initTheme();
    bindEvents();
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
    $("reportMonth").addEventListener("change",renderReports);
    $("exportJsonBtn").addEventListener("click",exportJSON);
    $("exportJsonBtn2").addEventListener("click",exportJSON);
    $("exportCsvBtn").addEventListener("click",exportCSV);
    $("importFile").addEventListener("change",importFile);
    $("confirmDeleteBtn").addEventListener("click",()=>{ if(deleteTarget){expenses=expenses.filter(e=>e.id!==deleteTarget);saveExpenses();deleteTarget=null;renderAll();} });
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
    if(!saveExpenses())return;
    resetForm();renderAll();
    $("formMessage").textContent=id?"Expense updated.":"Expense added to your garden.";
  }
  function resetForm(){
    $("expenseForm").reset();$("expenseId").value="";$("expenseDate").value=localDate();
    $("saveExpenseBtn").textContent="Add expense";$("cancelEditBtn").classList.add("hidden");
    $("formMessage").textContent="";
  }
  function editExpense(id){
    const e=expenses.find(x=>x.id===id);if(!e)return;
    $("expenseId").value=e.id;$("expenseDate").value=e.date;$("expenseItem").value=e.item;$("expensePrice").value=e.price;$("expenseCategory").value=e.category;$("expenseNotes").value=e.notes;
    $("saveExpenseBtn").textContent="Save changes";$("cancelEditBtn").classList.remove("hidden");
    $("entryTitle").textContent="Edit expense";$("expenseItem").focus();window.scrollTo({top:0,behavior:"smooth"});
  }
  function askDelete(id){
    deleteTarget=id;const dialog=$("confirmDialog");
    if(typeof dialog.showModal==="function")dialog.showModal();
    else if(confirm("Delete this expense?")){$("confirmDeleteBtn").click();}
  }
  function renderAll(){renderSummary();renderReports();renderMonthFilter();renderExpenses();$("allCount").textContent=`${expenses.length} ${expenses.length===1?"entry":"entries"}`;}
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
      svg.appendChild(path);angle=end;
    });
    const hole=document.createElementNS(ns,"circle");hole.setAttribute("cx",cx);hole.setAttribute("cy",cy);hole.setAttribute("r","52");hole.setAttribute("fill","#fffdf7");svg.appendChild(hole);
    const label=document.createElementNS(ns,"text");label.setAttribute("x",cx);label.setAttribute("y",cy-2);label.setAttribute("text-anchor","middle");label.setAttribute("class","pie-center");label.textContent=money(total);svg.appendChild(label);
    const sub=document.createElementNS(ns,"text");sub.setAttribute("x",cx);sub.setAttribute("y",cy+15);sub.setAttribute("text-anchor","middle");sub.setAttribute("font-size","9");sub.setAttribute("fill","#819080");sub.textContent="TOTAL SPENT";svg.appendChild(sub);
    chart.appendChild(svg);
    items.filter(i=>i.value>0).sort((a,b)=>b.value-a.value).forEach(item=>{
      const row=document.createElement("div");row.className="legend-item";
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
  function renderMonthFilter(){
    const select=$("monthFilter"),current=select.value;const months=[...new Set(expenses.map(e=>e.date.slice(0,7)))].sort().reverse();select.innerHTML='<option value="">All months</option>';months.forEach(m=>select.add(new Option(new Date(`${m}-01T00:00:00`).toLocaleDateString("en-PH",{month:"long",year:"numeric"}),m)));if(months.includes(current))select.value=current;
  }
  function renderExpenses(){
    const query=$("searchInput").value.trim().toLocaleLowerCase();const category=$("categoryFilter").value;const month=$("monthFilter").value;const sort=$("sortFilter").value;
    const terms=query.split(/\s+/).filter(Boolean);
    let rows=expenses.filter(e=>{
      if(category&&e.category!==category)return false;
      if(month&&!e.date.startsWith(month))return false;
      if(!terms.length)return true;
      const cat=getCategory(e.category);
      const searchable=[e.item,e.notes,e.category,cat.area,cat.icon,e.date,e.date.slice(0,7),e.date.slice(8,10),
        new Date(e.date+"T00:00:00").toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"}),
        String(e.price),e.price.toFixed(2),money(e.price),String(Math.round(e.price)),e.id].join(" ").toLocaleLowerCase();
      return terms.every(term=>searchable.includes(term));
    });
    rows.sort((a,b)=>sort==="date-asc"?a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt):sort==="price-desc"?b.price-a.price:sort==="price-asc"?a.price-b.price:b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
    const tbody=$("expenseRows");tbody.innerHTML="";
    rows.forEach(e=>{
      const c=getCategory(e.category),tr=document.createElement("tr");
      tr.innerHTML=`<td>${escapeHTML(new Date(e.date+"T00:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}))}</td><td title="${escapeHTML(e.notes)}">${escapeHTML(e.item)}${e.notes?`<div class="chart-subtitle">${escapeHTML(e.notes)}</div>`:""}</td><td><span class="category-chip">${c.icon} ${escapeHTML(e.category)}</span></td><td class="amount-col"><strong>${money(e.price)}</strong></td><td class="actions-col"><div class="row-actions"><button class="icon-button" type="button" data-edit="${escapeHTML(e.id)}" aria-label="Edit ${escapeHTML(e.item)}">Edit</button><button class="icon-button" type="button" data-delete="${escapeHTML(e.id)}" aria-label="Delete ${escapeHTML(e.item)}">×</button></div></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editExpense(b.dataset.edit)));
    tbody.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>askDelete(b.dataset.delete)));
    $("emptyState").classList.toggle("hidden",rows.length>0);
    $("filteredSummary").textContent=`Showing ${rows.length} of ${expenses.length} ${expenses.length===1?"entry":"entries"}`;$("filteredTotal").textContent=money(sum(rows));
  }
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