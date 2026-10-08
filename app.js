
const BASE=[
  {name:"Platos",icon:"🍽️"},
  {name:"Copas",icon:"🍷"},
  {name:"Vasos",icon:"🥃"},
  {name:"Cubiertos",icon:"🍴"},
  {name:"Cafetería",icon:"☕"},
  {name:"Cerveza",icon:"🍺"},
  {name:"Servicio",icon:"🫖"},
  {name:"Otros",icon:"📦"}
];

let supabaseClient=null;
let categories=[];
let items=[];
let selectedFile=null;
let editingId=null;

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function show(id){
  $$(".view").forEach(x=>x.classList.remove("active"));
  $("#"+id).classList.add("active");
  scrollTo(0,0);
}

function esc(s=""){
  return String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
}

function cname(i){
  if(i.category_name) return i.category_name;
  if(i.category_id){
    return categories.find(c=>c.id===i.category_id)?.name || "Otros";
  }
  return i.category || "Otros";
}

function card(i,admin=false){
  const photo=i.photo_url||i.photo||"";
  return `<article class="item-card">
    <div class="item-photo">${photo?`<img src="${photo}" alt="">`:"📷"}</div>
    <div class="item-body">
      <h4>${esc(i.name)}</h4>
      <span class="tag">${esc(cname(i))}</span>
      ${i.usage?`<span class="tag">${esc(i.usage)}</span>`:""}
      <div class="qty">${Number(i.quantity||0)} unidades</div>
      ${i.description?`<div class="desc">${esc(i.description)}</div>`:""}
      ${admin?`<button class="text-btn edit" data-id="${i.id}">Editar</button>`:""}
    </div>
  </article>`;
}

async function initSupabase(){
  const cfg=window.VAJILLA_CONFIG||{};
  if(!cfg.supabaseUrl || !cfg.supabaseKey){
    alert("Falta configurar Supabase.");
    return false;
  }
  supabaseClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
  return true;
}

async function loadData(){
  const c=await supabaseClient.from("vajilla_categories").select("*").order("sort_order");
  if(c.error) throw c.error;
  categories=(c.data||[]).map(x=>({id:x.id,name:x.name,icon:x.icon||"📦"}));

  const i=await supabaseClient.from("vajilla_items").select("*").order("name");
  if(i.error) throw i.error;
  items=i.data||[];

  renderCats();
  fillSelectors();
}

function renderCats(){
  $("#categoryCount").textContent=categories.length+" categorías";
  $("#categoryGrid").innerHTML=categories.map(c=>{
    const n=items.filter(i=>cname(i)===c.name).length;
    return `<button class="category-card" data-c="${esc(c.name)}">
      <span class="cat-icon">${c.icon}</span>
      <b>${esc(c.name)}</b>
      <small>${n} ${n===1?"artículo":"artículos"}</small>
    </button>`;
  }).join("");
  $$("#categoryGrid button").forEach(b=>b.onclick=()=>openCat(b.dataset.c));
}

function fillSelectors(){
  $("#itemCategory").innerHTML=categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("#reportCategory").innerHTML='<option value="">Todas</option>'+categories.map(c=>`<option>${esc(c.name)}</option>`).join("");

  const uses=[...new Set(items.map(i=>i.usage).filter(Boolean))].sort();
  $("#usageSuggestions").innerHTML=uses.map(x=>`<option value="${esc(x)}">`).join("");
  $("#reportUsage").innerHTML='<option value="">Todos</option>'+uses.map(x=>`<option>${esc(x)}</option>`).join("");
}

function openCat(n){
  $("#categoryTitle").textContent=n;
  const list=items.filter(i=>cname(i)===n);
  const uses=[...new Set(list.map(i=>i.usage).filter(Boolean))].sort();

  $("#usageFilters").innerHTML='<button class="chip active" data-u="">Todos</button>'+
    uses.map(x=>`<button class="chip" data-u="${esc(x)}">${esc(x)}</button>`).join("");

  function render(use=""){
    const f=list.filter(i=>!use||i.usage===use);
    $("#categoryItems").innerHTML=f.map(i=>card(i)).join("");
    $("#categoryEmpty").classList.toggle("hidden",f.length>0);
  }

  render();
  $$("#usageFilters button").forEach(b=>b.onclick=()=>{
    $$("#usageFilters button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    render(b.dataset.u);
  });
  show("categoryView");
}

function search(q){
  q=q.trim().toLowerCase();
  if(!q){
    $("#searchResultsSection").classList.add("hidden");
    return;
  }
  const f=items.filter(i=>
    [i.name,cname(i),i.usage,i.description].filter(Boolean).join(" ").toLowerCase().includes(q)
  );
  $("#searchResults").innerHTML=f.map(i=>card(i)).join("")||'<div class="empty">Sin resultados</div>';
  $("#searchResultsSection").classList.remove("hidden");
}

async function login(){
  $("#loginMsg").textContent="Ingresando…";
  const email=$("#adminEmail").value.trim();
  const password=$("#adminPassword").value;

  const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error){
    $("#loginMsg").textContent="Email o contraseña incorrectos.";
    return;
  }

  const check=await supabaseClient.from("vajilla_admins")
    .select("user_id")
    .eq("user_id",data.user.id)
    .maybeSingle();

  if(check.error || !check.data){
    await supabaseClient.auth.signOut();
    $("#loginMsg").textContent="Esta cuenta no tiene permiso de administración.";
    return;
  }

  $("#loginMsg").textContent="";
  renderAdmin();
  show("adminView");
}

async function logout(){
  await supabaseClient.auth.signOut();
  show("homeView");
}

function renderAdmin(){
  $("#adminItems").innerHTML=items.map(i=>card(i,true)).join("")||'<div class="empty">Todavía no hay artículos.</div>';
  $$(".edit").forEach(b=>b.onclick=()=>edit(b.dataset.id));
}

function reset(){
  editingId=null;
  selectedFile=null;
  $("#formTitle").textContent="Agregar artículo";
  $("#itemName").value="";
  $("#itemUsage").value="";
  $("#itemQuantity").value="";
  $("#itemDescription").value="";
  $("#saveMsg").textContent="";
  $("#photoPreview").src="";
  $("#photoPreview").classList.add("hidden");
  $("#photoPlaceholder").classList.remove("hidden");
}

function preview(f){
  if(!f)return;
  selectedFile=f;
  const r=new FileReader();
  r.onload=e=>{
    $("#photoPreview").src=e.target.result;
    $("#photoPreview").classList.remove("hidden");
    $("#photoPlaceholder").classList.add("hidden");
  };
  r.readAsDataURL(f);
}

async function compressImage(file,maxSize=1000,quality=.78){
  const bitmap=await createImageBitmap(file);
  let w=bitmap.width,h=bitmap.height;
  const scale=Math.min(1,maxSize/Math.max(w,h));
  w=Math.round(w*scale);
  h=Math.round(h*scale);

  const canvas=document.createElement("canvas");
  canvas.width=w;
  canvas.height=h;
  canvas.getContext("2d").drawImage(bitmap,0,0,w,h);

  return await new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("No se pudo procesar la foto.")),"image/webp",quality);
  });
}

async function uploadPhoto(file,itemId){
  const blob=await compressImage(file);
  const path=`${itemId}/${Date.now()}.webp`;

  const up=await supabaseClient.storage.from("vajilla-fotos").upload(path,blob,{
    contentType:"image/webp",
    upsert:true
  });

  if(up.error) throw up.error;

  return supabaseClient.storage.from("vajilla-fotos").getPublicUrl(path).data.publicUrl;
}

async function saveItem(){
  const name=$("#itemName").value.trim();
  const category_id=$("#itemCategory").value;
  const usage=$("#itemUsage").value.trim();
  const quantity=Number($("#itemQuantity").value||0);
  const description=$("#itemDescription").value.trim();

  if(!name){
    $("#saveMsg").textContent="Falta el nombre del artículo.";
    return;
  }

  $("#saveItemBtn").disabled=true;
  $("#saveMsg").textContent="Guardando…";

  try{
    let id=editingId;

    if(!id){
      const ins=await supabaseClient.from("vajilla_items").insert({
        name,category_id,usage,quantity,description
      }).select().single();

      if(ins.error) throw ins.error;
      id=ins.data.id;
    }else{
      const upd=await supabaseClient.from("vajilla_items").update({
        name,category_id,usage,quantity,description,updated_at:new Date().toISOString()
      }).eq("id",id);

      if(upd.error) throw upd.error;
    }

    if(selectedFile){
      $("#saveMsg").textContent="Subiendo foto…";
      const photo_url=await uploadPhoto(selectedFile,id);

      const updPhoto=await supabaseClient.from("vajilla_items")
        .update({photo_url,updated_at:new Date().toISOString()})
        .eq("id",id);

      if(updPhoto.error) throw updPhoto.error;
    }

    await loadData();
    renderAdmin();

    $("#saveMsg").textContent="Artículo guardado correctamente";
    $("#saveMsg").style.color="#176b4a";

    setTimeout(()=>{
      show("adminView");
      $("#saveMsg").textContent="";
      $("#saveItemBtn").disabled=false;
    },1100);

  }catch(e){
    console.error(e);
    $("#saveMsg").textContent="No se pudo guardar. "+(e.message||"");
    $("#saveMsg").style.color="#a23434";
    $("#saveItemBtn").disabled=false;
  }
}

function edit(id){
  const i=items.find(x=>String(x.id)===String(id));
  if(!i)return;

  editingId=i.id;
  selectedFile=null;
  $("#formTitle").textContent="Editar artículo";
  $("#itemName").value=i.name||"";
  $("#itemCategory").value=i.category_id||"";
  $("#itemUsage").value=i.usage||"";
  $("#itemQuantity").value=i.quantity||0;
  $("#itemDescription").value=i.description||"";
  $("#saveMsg").textContent="";

  if(i.photo_url){
    $("#photoPreview").src=i.photo_url;
    $("#photoPreview").classList.remove("hidden");
    $("#photoPlaceholder").classList.add("hidden");
  }else{
    $("#photoPreview").classList.add("hidden");
    $("#photoPlaceholder").classList.remove("hidden");
  }

  show("itemFormView");
}

async function saveCategory(){
  const name=$("#newCategoryName").value.trim();
  const icon=$("#newCategoryIcon").value;
  if(!name){
    $("#categoryMsg").textContent="Escribí un nombre.";
    return;
  }

  const r=await supabaseClient.from("vajilla_categories").insert({
    name,icon,sort_order:categories.length+1
  }).select().single();

  if(r.error){
    $("#categoryMsg").textContent=r.error.message;
    return;
  }

  $("#categoryMsg").textContent="Categoría creada correctamente";
  await loadData();
  $("#categoryModal").classList.add("hidden");
  $("#newCategoryName").value="";
}

function report(){
  const c=$("#reportCategory").value;
  const u=$("#reportUsage").value;
  const f=items.filter(i=>(!c||cname(i)===c)&&(!u||i.usage===u));

  $("#reportPreview").innerHTML=`<h2>Inventario de Vajilla</h2>
  <p>${new Date().toLocaleDateString("es-AR")}</p>
  <table style="width:100%;border-collapse:collapse">
  ${f.map(i=>`<tr>
    <td style="padding:8px;border-bottom:1px solid #ddd">${esc(i.name)}</td>
    <td>${esc(cname(i))}</td>
    <td>${esc(i.usage||"")}</td>
    <td style="text-align:right">${i.quantity}</td>
  </tr>`).join("")}</table>`;
}


async function handleRecoveryMode(){
  const url=new URL(window.location.href);
  const code=url.searchParams.get("code");
  const type=url.searchParams.get("type");
  const hash=window.location.hash||"";
  const isRecovery=Boolean(code) || type==="recovery" || hash.includes("type=recovery");

  if(!isRecovery) return false;

  try{
    if(code){
      const {error}=await supabaseClient.auth.exchangeCodeForSession(code);
      if(error) throw error;
    }
  }catch(e){
    console.error(e);
    $("#recoveryMsg").textContent="El enlace de recuperación no pudo validarse. Pedí uno nuevo.";
  }

  show("recoveryView");

  $("#saveNewPasswordBtn").onclick=async()=>{
    const p1=$("#newPassword").value;
    const p2=$("#confirmPassword").value;
    $("#recoveryMsg").style.color="#6f7773";

    if(!p1 || p1.length<6){
      $("#recoveryMsg").textContent="La contraseña debe tener al menos 6 caracteres.";
      return;
    }
    if(p1!==p2){
      $("#recoveryMsg").textContent="Las contraseñas no coinciden.";
      return;
    }

    $("#saveNewPasswordBtn").disabled=true;
    $("#recoveryMsg").textContent="Guardando…";

    const {error}=await supabaseClient.auth.updateUser({password:p1});
    if(error){
      $("#saveNewPasswordBtn").disabled=false;
      $("#recoveryMsg").style.color="#a23434";
      $("#recoveryMsg").textContent="No se pudo cambiar la contraseña. "+error.message;
      return;
    }

    $("#recoveryMsg").style.color="#176b4a";
    $("#recoveryMsg").textContent="Contraseña actualizada correctamente.";
    history.replaceState({},document.title,window.location.pathname);
    setTimeout(async()=>{
      await supabaseClient.auth.signOut();
      show("adminLoginView");
      $("#loginMsg").textContent="Ya podés ingresar con tu nueva contraseña.";
      $("#saveNewPasswordBtn").disabled=false;
    },1200);
  };
  return true;
}


document.addEventListener("DOMContentLoaded",async()=>{
  try{
    if(!await initSupabase()) return;
    const recoveryMode=await handleRecoveryMode();
    await loadData();
    if(recoveryMode) return;
  }catch(e){
    console.error(e);
    alert("No se pudo conectar con Supabase. "+(e.message||""));
    return;
  }

  $("#searchInput").oninput=e=>search(e.target.value);
  $("#clearSearch").onclick=()=>{$("#searchInput").value="";search("")};

  $("#adminBtn").onclick=()=>show("adminLoginView");
  $("#loginBtn").onclick=login;
  $("#logoutBtn").onclick=logout;

  $("#newItemBtn").onclick=()=>{reset();fillSelectors();show("itemFormView")};

  $("#newCategoryBtn").onclick=$("#inlineNewCategory").onclick=()=>{
    $("#categoryMsg").textContent="";
    $("#categoryModal").classList.remove("hidden");
  };

  $("#closeCategoryModal").onclick=()=>$("#categoryModal").classList.add("hidden");
  $("#saveCategoryBtn").onclick=saveCategory;

  $("#cameraInput").onchange=e=>preview(e.target.files[0]);
  $("#galleryInput").onchange=e=>preview(e.target.files[0]);

  $("#saveItemBtn").onclick=saveItem;
  $("#itemFormBack").onclick=()=>show("adminView");

  $("#reportsBtn").onclick=()=>{report();show("reportsView")};
  $("#reportCategory").onchange=report;
  $("#reportUsage").onchange=report;
  $("#printReport").onclick=()=>print();

  $$("[data-back]").forEach(b=>b.onclick=()=>show("homeView"));

  if("serviceWorker"in navigator){
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
});
