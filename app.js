const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
let activeType = "sale", listings = [], user = null, favoriteIds = new Set(), visibleLimit = 6;
const fmt = n => new Intl.NumberFormat("kk-KZ").format(Number(n)) + " ₸";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(url, options={}) {
  const response = await fetch(url, {credentials:"same-origin", headers:{"Content-Type":"application/json",...(options.headers||{})}, ...options});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || "Сұрауды орындау мүмкін болмады.");
  return data;
}
let toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800)}
function card(item){return `<article class="listing-card"><div class="listing-image"><img src="${esc(item.image || "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80")}" alt="${esc(item.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80'"><span class="listing-badge">${item.type==="rent"?"Жалға беріледі":"Сатылады"}</span><button class="heart-button ${favoriteIds.has(item.id)?"saved":""}" data-favorite="${item.id}" aria-label="Таңдаулыға қосу">${favoriteIds.has(item.id)?"♥":"♡"}</button></div><div class="listing-details"><div class="listing-price">${fmt(item.price)}${item.type==="rent"?' <small>/ ай</small>':""}</div><h3 class="listing-title">${esc(item.title)}</h3><div class="listing-address">⌖ ${esc(item.city)}, ${esc(item.address)}</div><div class="listing-meta"><span>▦ ${item.rooms} бөлме</span><span>↔ ${item.area} м²</span><span>⌂ Үй</span></div></div></article>`}
function renderListings(){
 const grid=$("#listingGrid");
 const sort=$("#sortSelect").value;
 let list=[...listings];
 if(sort==="low")list.sort((a,b)=>a.price-b.price);
 if(sort==="high")list.sort((a,b)=>b.price-a.price);
 list=list.slice(0,visibleLimit);
 $("#resultCount").textContent=`${listings.length} хабарландыру`;
 grid.innerHTML=list.length?list.map(card).join(""):`<div class="empty-state"><strong>Сәйкес ұсыныс табылмады.</strong><br>Іздеу шарттарын өзгертіп көріңіз.</div>`;
 $("#loadMore").hidden=visibleLimit>=listings.length;
}
async function loadListings(){
 $("#listingGrid").innerHTML='<div class="loading-card">Үйлер жүктелуде…</div>';
 const params=new URLSearchParams({type:activeType});
 const city=$("#cityInput").value.trim(); const query=$("#queryInput").value.trim(); const rooms=$("#roomsInput").value;
 if(city)params.set("city",city);if(query)params.set("query",query);if(rooms)params.set("rooms",rooms);
 try{listings=await api("/api/listings?"+params.toString());visibleLimit=6;renderListings()}
 catch(e){$("#listingGrid").innerHTML=`<div class="empty-state">${esc(e.message)}</div>`}
}
function openModal(content){$("#modalContent").innerHTML=content;$("#modalBackdrop").hidden=false;document.body.style.overflow="hidden"}
function closeModal(){$("#modalBackdrop").hidden=true;document.body.style.overflow=""}
function authModal(mode="login"){
 const register=mode==="register";
 openModal(`<span class="eyebrow">ÜY АККАУНТЫ</span><h2 id="modalTitle">${register?"Тіркелу":"Қайта қош келдіңіз"}</h2><p>${register?"Жеке кабинет ашып, таңдаулыларыңызды сақтаңыз.":"Аккаунтыңызға кіріп, таңдаулыларыңызды қараңыз."}</p><form class="modal-form" id="authForm">${register?'<label>Аты-жөніңіз<input name="name" autocomplete="name" required minlength="2" placeholder="Атыңыз"></label>':""}<label>Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><label>Құпиясөз<input name="password" type="password" autocomplete="${register?"new-password":"current-password"}" required minlength="${register?8:1}" placeholder="${register?"Кемінде 8 таңба":"Құпиясөз"}"></label><button class="button button-dark" type="submit">${register?"Аккаунт ашу":"Кіру"}</button></form><div class="modal-switch">${register?"Аккаунтыңыз бар ма?":"Аккаунтыңыз жоқ па?"} <button id="authSwitch">${register?"Кіру":"Тіркелу"}</button></div>`);
 $("#authSwitch").onclick=()=>authModal(register?"login":"register");
 $("#authForm").onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget));try{const result=await api(`/api/auth/${register?"register":"login"}`,{method:"POST",body:JSON.stringify(body)});user=result.user;closeModal();updateHeader();await loadFavorites();toast(register?"Аккаунт сәтті ашылды.":"Сәтті кірдіңіз.");}catch(err){toast(err.message)}};
}
function publishModal(){
 if(!user){toast("Хабарландыру жариялау үшін аккаунтқа кіріңіз.");return authModal()}
 openModal(`<span class="eyebrow">ЖАҢА ҰСЫНЫС</span><h2 id="modalTitle">Хабарландыру жариялау</h2><p>Үй туралы ақпаратты толтырыңыз.</p><form class="modal-form" id="publishForm"><label>Хабарландыру атауы<input name="title" required minlength="5" maxlength="120" placeholder="Мысалы, жарық 2 бөлмелі пәтер"></label><label>Мәміле түрі<select name="type"><option value="sale">Сату</option><option value="rent">Жалға беру</option></select></label><label>Бағасы (теңге)<input name="price" type="number" min="1" required placeholder="25000000"></label><label>Қала<input name="city" required value="Ақтау"></label><label>Мекенжай / аудан<input name="address" required placeholder="15-шағын аудан"></label><div class="form-pair"><label>Бөлме саны<input name="rooms" type="number" min="1" max="20" required value="2"></label><label>Ауданы (м²)<input name="area" type="number" min="1" required value="60"></label></div><label>Фото URL (міндетті емес)<input name="image" type="url" placeholder="https://..."></label><label>Сипаттама<textarea name="description" maxlength="2000" placeholder="Үй туралы қысқаша ақпарат"></textarea></label><button class="button button-dark" type="submit">Жариялау</button></form>`);
 $("#publishForm").onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget));try{await api("/api/listings",{method:"POST",body:JSON.stringify(body)});closeModal();toast("Хабарландыру жарияланды.");await loadListings();$("#homes").scrollIntoView({behavior:"smooth"})}catch(err){toast(err.message)}};
}
async function loadFavorites(){if(!user){favoriteIds.clear();return}try{const rows=await api("/api/favorites");favoriteIds=new Set(rows.map(x=>x.id))}catch{favoriteIds.clear()}}
function updateHeader(){
 $("#loginOpen").textContent=user?user.name.split(" ")[0]:"Кіру";
 $("#loginOpen").onclick=()=>user?accountModal():authModal();
}
function accountModal(){openModal(`<span class="eyebrow">ЖЕКЕ КАБИНЕТ</span><h2 id="modalTitle">Сәлем, ${esc(user.name)}!</h2><p>${esc(user.email)}</p><div class="modal-form"><button class="button button-outline" id="myFavorites">♡ Таңдаулыларымды қарау</button><button class="button button-dark" id="logoutButton">Жүйеден шығу</button></div>`);$("#myFavorites").onclick=()=>{closeModal();showFavorites()};$("#logoutButton").onclick=async()=>{await api("/api/auth/logout",{method:"POST"});user=null;favoriteIds.clear();closeModal();updateHeader();renderListings();toast("Аккаунттан шықтыңыз.")}}
async function toggleFavorite(id){
 if(!user){toast("Таңдаулыларды сақтау үшін аккаунтқа кіріңіз.");return authModal()}
 try{if(favoriteIds.has(id)){await api(`/api/favorites/${id}`,{method:"DELETE"});favoriteIds.delete(id);toast("Таңдаулылардан алынды.")}else{await api(`/api/favorites/${id}`,{method:"POST"});favoriteIds.add(id);toast("Таңдаулыларға қосылды.")}renderListings()}catch(e){toast(e.message)}
}
async function showFavorites(){
 if(!user)return authModal();
 try{const rows=await api("/api/favorites");openModal(`<span class="eyebrow">СІЗ САҚТАҒАН ҮЙЛЕР</span><h2 id="modalTitle">Таңдаулылар</h2><div class="favorite-modal-list">${rows.length?rows.map(x=>`<div class="favorite-row"><img src="${esc(x.image||"")}" alt=""><div><strong>${esc(x.title)}</strong><small>${fmt(x.price)} · ${esc(x.address)}</small></div><button data-remove-favorite="${x.id}" aria-label="Өшіру">×</button></div>`).join(""):"<p>Әзірге сақталған үй жоқ.</p>"}</div>`);$$("[data-remove-favorite]").forEach(b=>b.onclick=async()=>{await api(`/api/favorites/${b.dataset.removeFavorite}`,{method:"DELETE"});favoriteIds.delete(Number(b.dataset.removeFavorite));showFavorites();renderListings()})}catch(e){toast(e.message)}
}
$("#searchForm").addEventListener("submit",e=>{e.preventDefault();loadListings();$("#homes").scrollIntoView({behavior:"smooth"})});
$$(".search-tab").forEach(btn=>btn.addEventListener("click",()=>{$$(".search-tab").forEach(b=>{b.classList.toggle("active",b===btn);b.setAttribute("aria-selected",b===btn?"true":"false")});activeType=btn.dataset.type;loadListings()}));
$("#sortSelect").addEventListener("change",renderListings);
$("#loadMore").addEventListener("click",()=>{visibleLimit+=6;renderListings()});
$("#showAll").addEventListener("click",e=>{e.preventDefault();visibleLimit=listings.length;renderListings()});
$("#listingGrid").addEventListener("click",e=>{const b=e.target.closest("[data-favorite]");if(b)toggleFavorite(Number(b.dataset.favorite))});
$("#loginOpen").addEventListener("click",()=>authModal());
$("#publishOpen").addEventListener("click",publishModal);
$("#favoritesShortcut").addEventListener("click",showFavorites);
$("#modalClose").addEventListener("click",closeModal);
$("#modalBackdrop").addEventListener("click",e=>{if(e.target===$("#modalBackdrop"))closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
$("#menuToggle").addEventListener("click",()=>{let nav=$(".mobile-nav");if(nav){nav.remove();return}nav=document.createElement("nav");nav.className="mobile-nav";nav.innerHTML='<a href="#homes">Үй табу</a><a href="#district">Аудандар</a><a href="#how">Қалай жұмыс істейді</a>';nav.querySelectorAll("a").forEach(a=>a.onclick=()=>nav.remove());$(".site-header").after(nav)});
async function init(){try{const data=await api("/api/me");user=data.user;updateHeader();await loadFavorites()}catch{}await loadListings()}
init();