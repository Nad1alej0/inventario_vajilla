const BASE = [
  { name: "Platos", icon: "🍽️" },
  { name: "Copas", icon: "🍷" },
  { name: "Vasos", icon: "🥃" },
  { name: "Cubiertos", icon: "🍴" },
  { name: "Cafetería", icon: "☕" },
  { name: "Otros", icon: "📦" }
];

let supabaseClient = null;
let categories = [];
let items = [];
let config = null;

let selectedFile = null;
let editingId = null;
let adminUnlocked = false;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];


/* =========================
   VISTAS
========================= */

function show(id) {
  $$(".view").forEach(v => {
    v.classList.remove("active");
  });

  $("#" + id).classList.add("active");

  window.scrollTo(0, 0);
}


/* =========================
   UTILIDADES
========================= */

function esc(s = "") {
  return String(s).replace(/[&<>"]/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[m]));
}


function categoryName(item) {
  if (item.category_id) {
    return (
      categories.find(
        c => String(c.id) === String(item.category_id)
      )?.name || "Otros"
    );
  }

  return item.category || "Otros";
}


function categoryIcon(category) {
  return (
    BASE.find(
      b => b.name === category.name
    )?.icon ||
    category.icon ||
    "📦"
  );
}


function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}


function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  return date.toLocaleString(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


/* =========================
   SUPABASE
========================= */

async function initSupabase() {
  const cfg = window.VAJILLA_CONFIG || {};

  if (
    !cfg.supabaseUrl ||
    !cfg.supabaseKey
  ) {
    alert(
      "Falta configurar Supabase."
    );

    return false;
  }

  supabaseClient =
    window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabaseKey
    );

  return true;
}


async function loadConfig() {
  const result =
    await supabaseClient
      .from("vajilla_config")
      .select("id, inventory_date, updated_at")
      .eq("id", 1)
      .single();

  if (result.error) {
    throw result.error;
  }

  config = result.data;

  renderStatus();
}


async function loadData() {
  const catResult =
    await supabaseClient
      .from("vajilla_categories")
      .select("*")
      .order("sort_order");

  if (catResult.error) {
    throw catResult.error;
  }

  categories =
    catResult.data || [];


  const itemResult =
    await supabaseClient
      .from("vajilla_items")
      .select("*")
      .order("name");

  if (itemResult.error) {
    throw itemResult.error;
  }

  items =
    itemResult.data || [];


  renderCategories();

  fillSelectors();

  renderSummary();

  renderCategoryManager();
}


async function refreshAll() {
  await loadData();
  await loadConfig();
}


async function touchUpdatedAt() {
  const now =
    new Date().toISOString();

  const result =
    await supabaseClient
      .from("vajilla_config")
      .update({
        updated_at: now
      })
      .eq("id", 1);

  if (result.error) {
    console.error(
      "No se pudo actualizar la fecha:",
      result.error
    );
  }

  await loadConfig();
}


/* =========================
   PORTADA
========================= */

function renderStatus() {
  if (!config) return;

  $("#inventoryDate").textContent =
    formatDate(
      config.inventory_date
    );

  $("#lastUpdated").textContent =
    formatDateTime(
      config.updated_at
    );
}


function renderSummary() {
  const totalUnits =
    items.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity || 0),
      0
    );

  $("#summaryCategories").textContent =
    categories.length;

  $("#summaryItems").textContent =
    items.length;

  $("#summaryUnits").textContent =
    totalUnits;
}


/* =========================
   CATEGORÍAS
========================= */

function renderCategories() {
  $("#categoryCount").textContent =
    categories.length +
    " categorías";


  $("#categoryGrid").innerHTML =
    categories.map(c => {

      const cantidad =
        items.filter(
          i =>
            String(i.category_id) ===
            String(c.id)
        ).length;

      return `
        <button
          class="category-card"
          data-cat="${esc(c.name)}"
        >

          <span class="cat-icon">
            ${categoryIcon(c)}
          </span>

          <b>
            ${esc(c.name)}
          </b>

          <small>
            ${cantidad}
            ${
              cantidad === 1
                ? "artículo"
                : "artículos"
            }
          </small>

        </button>
      `;
    }).join("");


  $$("#categoryGrid .category-card")
    .forEach(btn => {

      btn.onclick =
        () =>
          openCategory(
            btn.dataset.cat
          );

    });
}


function openCategory(name) {
  $("#categoryTitle").textContent =
    name;

  const list =
    items.filter(
      i =>
        categoryName(i) ===
        name
    );


  const usages = [
    ...new Set(
      list
        .map(i => i.usage)
        .filter(Boolean)
    )
  ];


  $("#usageFilters").innerHTML =
    `
      <button
        class="chip active"
        data-use=""
      >
        Todos
      </button>
    ` +
    usages.map(u => `
      <button
        class="chip"
        data-use="${esc(u)}"
      >
        ${esc(u)}
      </button>
    `).join("");


  function render(use = "") {
    const filtered =
      list.filter(
        i =>
          !use ||
          i.usage === use
      );


    $("#categoryItems").innerHTML =
      filtered
        .map(i => itemCard(i))
        .join("");


    $("#categoryEmpty")
      .classList
      .toggle(
        "hidden",
        filtered.length > 0
      );
  }


  render();


  $$("#usageFilters .chip")
    .forEach(btn => {

      btn.onclick = () => {

        $$("#usageFilters .chip")
          .forEach(x =>
            x.classList.remove(
              "active"
            )
          );

        btn.classList.add(
          "active"
        );

        render(
          btn.dataset.use
        );
      };

    });


  show("categoryView");
}


/* =========================
   TARJETAS DE ARTÍCULO
========================= */

function itemCard(
  item,
  admin = false
) {
  const photo =
    item.photo_url || "";

  return `
    <article class="item-card">

      <div class="item-photo">

        ${
          photo
            ? `
              <img
                src="${photo}"
                alt="${esc(item.name)}"
              >
            `
            : "📷"
        }

      </div>


      <div class="item-body">

        <h4>
          ${esc(item.name)}
        </h4>


        <div class="item-meta">

          <span class="tag">
            ${esc(categoryName(item))}
          </span>

          ${
            item.usage
              ? `
                <span class="tag">
                  ${esc(item.usage)}
                </span>
              `
              : ""
          }

        </div>


        <div class="qty">
          ${Number(item.quantity || 0)}
          unidades
        </div>


        ${
          item.description
            ? `
              <div class="desc">
                ${esc(item.description)}
              </div>
            `
            : ""
        }


        ${
          admin
            ? `
              <div class="item-admin-actions">

                <button
                  class="text-btn edit-btn"
                  data-id="${item.id}"
                >
                  Editar
                </button>

                <button
                  class="text-btn delete-btn danger"
                  data-id="${item.id}"
                >
                  Eliminar
                </button>

              </div>
            `
            : ""
        }

      </div>

    </article>
  `;
}


/* =========================
   BUSCADOR
========================= */

function search(q) {
  q = (q || "")
    .trim()
    .toLowerCase();


  if (!q) {
    $("#searchResultsSection")
      .classList
      .add("hidden");

    return;
  }


  const filtered =
    items.filter(i =>
      [
        i.name,
        categoryName(i),
        i.usage,
        i.description
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );


  $("#searchResults").innerHTML =
    filtered.length
      ? filtered
          .map(i => itemCard(i))
          .join("")
      : `
          <div class="empty">
            Sin resultados
          </div>
        `;


  $("#searchResultsSection")
    .classList
    .remove("hidden");
}


/* =========================
   SELECTORES
========================= */

function fillSelectors() {
  $("#itemCategory").innerHTML =
    categories.map(c => `
      <option value="${c.id}">
        ${esc(c.name)}
      </option>
    `).join("");


  $("#reportCategory").innerHTML =
    `
      <option value="">
        Todas
      </option>
    ` +
    categories.map(c => `
      <option value="${esc(c.name)}">
        ${esc(c.name)}
      </option>
    `).join("");


  const usages = [
    ...new Set(
      items
        .map(i => i.usage)
        .filter(Boolean)
    )
  ];


  $("#usageSuggestions").innerHTML =
    usages.map(u => `
      <option value="${esc(u)}">
    `).join("");


  $("#reportUsage").innerHTML =
    `
      <option value="">
        Todos
      </option>
    ` +
    usages.map(u => `
      <option value="${esc(u)}">
        ${esc(u)}
      </option>
    `).join("");
}


/* =========================
   ACCESO ADMINISTRACIÓN
========================= */

function ensureAdminLoginUI() {
  const panel = $("#pinView .panel");
  if (!panel || $("#adminEmail")) return;

  panel.innerHTML = `
    <span class="kicker">Acceso restringido</span>
    <h2>Administración</h2>
    <p class="muted">Ingresá con la cuenta de Nadia o Tiara.</p>

    <label>
      Email
      <input id="adminEmail" type="email" autocomplete="email" placeholder="tu@email.com">
    </label>

    <label>
      Contraseña
      <input id="adminPassword" type="password" autocomplete="current-password" placeholder="••••••••">
    </label>

    <button id="enterAdminBtn" class="primary" type="button">Ingresar</button>
    <p id="pinMsg" class="status"></p>
  `;
}

async function openAdminAccess() {
  if (adminUnlocked) {
    renderAdmin();
    show("adminView");
    return;
  }

  ensureAdminLoginUI();
  $("#pinMsg").textContent = "";
  show("pinView");

  const { data } = await supabaseClient.auth.getSession();
  if (data?.session) {
    const check = await supabaseClient
      .from("vajilla_admins")
      .select("user_id")
      .eq("user_id", data.session.user.id)
      .maybeSingle();

    if (check.data) {
      adminUnlocked = true;
      renderAdmin();
      show("adminView");
      return;
    }
  }

  setTimeout(() => $("#adminEmail")?.focus(), 100);
}

async function verifyAdminLogin() {
  const email = $("#adminEmail")?.value.trim();
  const password = $("#adminPassword")?.value || "";

  if (!email || !password) {
    $("#pinMsg").textContent = "Completá email y contraseña.";
    return;
  }

  $("#pinMsg").textContent = "Ingresando…";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    $("#pinMsg").textContent = "Email o contraseña incorrectos.";
    return;
  }

  const check = await supabaseClient
    .from("vajilla_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (check.error || !check.data) {
    await supabaseClient.auth.signOut();
    $("#pinMsg").textContent = "Esta cuenta no tiene permiso de administración.";
    return;
  }

  adminUnlocked = true;
  $("#pinMsg").textContent = "";
  renderAdmin();
  show("adminView");
}

async function closeAdmin() {
  adminUnlocked = false;
  await supabaseClient.auth.signOut();
  show("homeView");
}


/* =========================
   ADMINISTRACIÓN
========================= */

function renderAdmin() {
  $("#adminItems").innerHTML =
    items.length
      ? items
          .map(
            i =>
              itemCard(
                i,
                true
              )
          )
          .join("")
      : `
          <div class="empty">
            Todavía no hay artículos.
          </div>
        `;


  $$(".edit-btn")
    .forEach(btn => {

      btn.onclick =
        () =>
          editItem(
            btn.dataset.id
          );

    });


  $$(".delete-btn")
    .forEach(btn => {

      btn.onclick =
        () =>
          deleteItem(
            btn.dataset.id
          );

    });


  renderCategoryManager();
}


/* =========================
   GESTIONAR CATEGORÍAS
========================= */

function createCategoryManager() {
  if ($("#categoryManager")) {
    return;
  }

  const adminItems =
    $("#adminItems");

  if (!adminItems) {
    return;
  }


  const box =
    document.createElement(
      "section"
    );

  box.id =
    "categoryManager";

  box.className =
    "category-manager";


  box.innerHTML = `

    <div class="section-heading">

      <div>

        <span class="kicker">
          Organización
        </span>

        <h3>
          Gestionar categorías
        </h3>

        <small class="muted">
          Podés editar el nombre
          o eliminar categorías vacías.
        </small>

      </div>

    </div>


    <div
      id="categoryManagerList"
      class="category-manager-list"
    ></div>
  `;


  adminItems.parentNode
    .insertBefore(
      box,
      adminItems
    );
}


function renderCategoryManager() {
  createCategoryManager();

  const list =
    $("#categoryManagerList");

  if (!list) {
    return;
  }


  list.innerHTML =
    categories.map(category => {

      const cantidad =
        items.filter(
          item =>
            String(
              item.category_id
            ) ===
            String(
              category.id
            )
        ).length;


      return `

        <div class="category-manage-row">

          <div class="category-manage-name">

            <span class="category-manage-icon">
              ${categoryIcon(category)}
            </span>

            <div>

              <b>
                ${esc(category.name)}
              </b>

              <small>
                ${cantidad}
                ${
                  cantidad === 1
                    ? "artículo"
                    : "artículos"
                }
              </small>

            </div>

          </div>


          <div class="category-manage-actions">

            <button
              type="button"
              class="text-btn edit-category-btn"
              data-id="${category.id}"
            >
              Editar
            </button>


            <button
              type="button"
              class="text-btn delete-category-btn danger"
              data-id="${category.id}"
            >
              Eliminar
            </button>

          </div>

        </div>
      `;
    }).join("");


  $$(".edit-category-btn")
    .forEach(btn => {

      btn.onclick =
        () =>
          editCategory(
            btn.dataset.id
          );

    });


  $$(".delete-category-btn")
    .forEach(btn => {

      btn.onclick =
        () =>
          deleteCategory(
            btn.dataset.id
          );

    });
}


async function editCategory(id) {
  const category =
    categories.find(
      c =>
        String(c.id) ===
        String(id)
    );


  if (!category) {
    return;
  }


  const nuevoNombre =
    prompt(
      "Nuevo nombre de la categoría:",
      category.name
    );


  if (nuevoNombre === null) {
    return;
  }


  const limpio =
    nuevoNombre.trim();


  if (!limpio) {
    alert(
      "El nombre no puede quedar vacío."
    );

    return;
  }


  if (
    categories.some(
      c =>
        String(c.id) !==
          String(id) &&
        c.name.toLowerCase() ===
          limpio.toLowerCase()
    )
  ) {
    alert(
      "Ya existe una categoría con ese nombre."
    );

    return;
  }


  const result =
    await supabaseClient
      .from("vajilla_categories")
      .update({
        name: limpio
      })
      .eq("id", id);


  if (result.error) {
    alert(
      "No se pudo editar la categoría. " +
      result.error.message
    );

    return;
  }


  await touchUpdatedAt();

  await loadData();

  renderAdmin();


  alert(
    "Categoría actualizada correctamente."
  );
}


async function deleteCategory(id) {
  const category =
    categories.find(
      c =>
        String(c.id) ===
        String(id)
    );


  if (!category) {
    return;
  }


  const cantidad =
    items.filter(
      item =>
        String(
          item.category_id
        ) ===
        String(id)
    ).length;


  if (cantidad > 0) {
    alert(
      `No se puede eliminar "${category.name}".\n\n` +
      `Tiene ${cantidad} ${
        cantidad === 1
          ? "artículo"
          : "artículos"
      }.\n\n` +
      "Primero mové esos artículos a otra categoría o eliminálos."
    );

    return;
  }


  const ok =
    confirm(
      `¿Eliminar la categoría "${category.name}"?\n\n` +
      "Esta acción no se puede deshacer."
    );


  if (!ok) {
    return;
  }


  const result =
    await supabaseClient
      .from("vajilla_categories")
      .delete()
      .eq("id", id);


  if (result.error) {
    alert(
      "No se pudo eliminar la categoría. " +
      result.error.message
    );

    return;
  }


  await touchUpdatedAt();

  await loadData();

  renderAdmin();


  alert(
    "Categoría eliminada correctamente."
  );
}


/* =========================
   FECHA DE INVENTARIO
========================= */

async function updateInventoryDate() {
  const hoy =
    new Date();


  const fechaLocal =
    [
      hoy.getFullYear(),
      String(
        hoy.getMonth() + 1
      ).padStart(2, "0"),
      String(
        hoy.getDate()
      ).padStart(2, "0")
    ].join("-");


  const ok =
    confirm(
      "¿Actualizar la fecha de inventario a hoy?\n\n" +
      formatDate(fechaLocal)
    );


  if (!ok) {
    return;
  }


  const result =
    await supabaseClient
      .from("vajilla_config")
      .update({
        inventory_date:
          fechaLocal,
        updated_at:
          new Date()
            .toISOString()
      })
      .eq("id", 1);


  if (result.error) {
    alert(
      "No se pudo actualizar la fecha. " +
      result.error.message
    );

    return;
  }


  await loadConfig();


  alert(
    "Fecha de inventario actualizada correctamente."
  );
}


/* =========================
   FORMULARIO
========================= */

function resetForm() {
  editingId = null;
  selectedFile = null;


  $("#formTitle").textContent =
    "Agregar artículo";


  $("#itemName").value =
    "";

  $("#itemUsage").value =
    "";

  $("#itemQuantity").value =
    "";

  $("#itemDescription").value =
    "";


  $("#photoPreview").src =
    "";

  $("#photoPreview")
    .classList
    .add("hidden");

  $("#photoPlaceholder")
    .classList
    .remove("hidden");


  $("#saveMsg").textContent =
    "";

  $("#saveMsg").style.color =
    "";
}


function previewFile(file) {
  if (!file) {
    return;
  }


  selectedFile =
    file;


  const reader =
    new FileReader();


  reader.onload = e => {

    $("#photoPreview").src =
      e.target.result;

    $("#photoPreview")
      .classList
      .remove("hidden");

    $("#photoPlaceholder")
      .classList
      .add("hidden");
  };


  reader.readAsDataURL(file);
}


async function compressImage(
  file,
  maxSize = 1000,
  quality = 0.78
) {
  const bitmap =
    await createImageBitmap(file);


  let width =
    bitmap.width;

  let height =
    bitmap.height;


  const scale =
    Math.min(
      1,
      maxSize /
        Math.max(
          width,
          height
        )
    );


  width =
    Math.round(
      width * scale
    );

  height =
    Math.round(
      height * scale
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    width;

  canvas.height =
    height;


  canvas
    .getContext("2d")
    .drawImage(
      bitmap,
      0,
      0,
      width,
      height
    );


  return await new Promise(
    (resolve, reject) => {

      canvas.toBlob(
        blob => {

          if (blob) {
            resolve(blob);

          } else {
            reject(
              new Error(
                "No se pudo procesar la foto."
              )
            );
          }

        },
        "image/webp",
        quality
      );

    }
  );
}


async function uploadPhoto(
  file,
  itemId
) {
  const blob =
    await compressImage(file);


  const path =
    `${itemId}/${Date.now()}.webp`;


  const result =
    await supabaseClient
      .storage
      .from("vajilla-fotos")
      .upload(
        path,
        blob,
        {
          contentType:
            "image/webp",

          upsert:
            true
        }
      );


  if (result.error) {
    throw result.error;
  }


  const publicResult =
    supabaseClient
      .storage
      .from("vajilla-fotos")
      .getPublicUrl(path);


  return (
    publicResult
      .data
      .publicUrl
  );
}


/* =========================
   GUARDAR ARTÍCULO
========================= */

async function saveItem() {
  const name =
    $("#itemName")
      .value
      .trim();


  const category_id =
    $("#itemCategory")
      .value;


  const usage =
    $("#itemUsage")
      .value
      .trim();


  const quantity =
    Number(
      $("#itemQuantity")
        .value || 0
    );


  const description =
    $("#itemDescription")
      .value
      .trim();


  if (!name) {
    $("#saveMsg").textContent =
      "Falta el nombre del artículo.";

    return;
  }


  $("#saveItemBtn").disabled =
    true;


  $("#saveMsg").style.color =
    "";


  $("#saveMsg").textContent =
    "Guardando…";


  try {
    let id =
      editingId;


    if (!id) {
      const result =
        await supabaseClient
          .from("vajilla_items")
          .insert({
            name,
            category_id,
            usage,
            quantity,
            description
          })
          .select()
          .single();


      if (result.error) {
        throw result.error;
      }


      id =
        result.data.id;

    } else {

      const result =
        await supabaseClient
          .from("vajilla_items")
          .update({
            name,
            category_id,
            usage,
            quantity,
            description,
            updated_at:
              new Date()
                .toISOString()
          })
          .eq(
            "id",
            id
          );


      if (result.error) {
        throw result.error;
      }
    }


    if (selectedFile) {
      $("#saveMsg").textContent =
        "Subiendo foto…";


      const photo_url =
        await uploadPhoto(
          selectedFile,
          id
        );


      const photoResult =
        await supabaseClient
          .from("vajilla_items")
          .update({
            photo_url,
            updated_at:
              new Date()
                .toISOString()
          })
          .eq(
            "id",
            id
          );


      if (photoResult.error) {
        throw photoResult.error;
      }
    }


    await touchUpdatedAt();

    await loadData();

    renderAdmin();


    $("#saveMsg").style.color =
      "#176b4a";


    $("#saveMsg").textContent =
      "Artículo guardado correctamente";


    setTimeout(() => {

      $("#saveItemBtn").disabled =
        false;

      show("adminView");

    }, 1000);


  } catch (error) {
    console.error(error);


    $("#saveItemBtn").disabled =
      false;


    $("#saveMsg").style.color =
      "#a23434";


    $("#saveMsg").textContent =
      "No se pudo guardar. " +
      (
        error.message ||
        ""
      );
  }
}


/* =========================
   EDITAR ARTÍCULO
========================= */

function editItem(id) {
  const item =
    items.find(
      i =>
        String(i.id) ===
        String(id)
    );


  if (!item) {
    return;
  }


  editingId =
    item.id;

  selectedFile =
    null;


  $("#formTitle").textContent =
    "Editar artículo";


  $("#itemName").value =
    item.name || "";


  $("#itemCategory").value =
    item.category_id || "";


  $("#itemUsage").value =
    item.usage || "";


  $("#itemQuantity").value =
    item.quantity || 0;


  $("#itemDescription").value =
    item.description || "";


  $("#saveMsg").textContent =
    "";


  if (item.photo_url) {
    $("#photoPreview").src =
      item.photo_url;


    $("#photoPreview")
      .classList
      .remove("hidden");


    $("#photoPlaceholder")
      .classList
      .add("hidden");

  } else {

    $("#photoPreview")
      .classList
      .add("hidden");


    $("#photoPlaceholder")
      .classList
      .remove("hidden");
  }


  show("itemFormView");
}


/* =========================
   ELIMINAR ARTÍCULO
========================= */

async function deleteItem(id) {
  const item =
    items.find(
      i =>
        String(i.id) ===
        String(id)
    );


  if (!item) {
    return;
  }


  const ok =
    confirm(
      `¿Eliminar "${item.name}"?\n\n` +
      "Esta acción no se puede deshacer."
    );


  if (!ok) {
    return;
  }


  const result =
    await supabaseClient
      .from("vajilla_items")
      .delete()
      .eq(
        "id",
        id
      );


  if (result.error) {
    alert(
      "No se pudo eliminar. " +
      result.error.message
    );

    return;
  }


  await touchUpdatedAt();

  await loadData();

  renderAdmin();


  alert(
    "Artículo eliminado correctamente."
  );
}


/* =========================
   NUEVA CATEGORÍA
========================= */

async function saveCategory() {
  const name =
    $("#newCategoryName")
      .value
      .trim();


  const icon =
    $("#newCategoryIcon")
      .value;


  if (!name) {
    $("#categoryMsg").textContent =
      "Escribí un nombre.";

    return;
  }


  if (
    categories.some(
      c =>
        c.name
          .toLowerCase() ===
        name.toLowerCase()
    )
  ) {
    $("#categoryMsg").textContent =
      "Ya existe una categoría con ese nombre.";

    return;
  }


  const result =
    await supabaseClient
      .from("vajilla_categories")
      .insert({
        name,
        icon,
        sort_order:
          categories.length + 1
      })
      .select()
      .single();


  if (result.error) {
    $("#categoryMsg").textContent =
      result.error.message;

    return;
  }


  await touchUpdatedAt();

  await loadData();


  $("#categoryModal")
    .classList
    .add("hidden");


  $("#newCategoryName").value =
    "";


  $("#categoryMsg").textContent =
    "";


  renderAdmin();


  alert(
    "Categoría creada correctamente."
  );
}


/* =========================
   INFORMES
========================= */

function prepareReportControls() {
  const panel =
    $("#reportsView .panel");


  if (
    !panel ||
    $("#reportMode")
  ) {
    return;
  }


  const controls =
    document.createElement(
      "div"
    );


  controls.className =
    "report-extra-controls";


  controls.innerHTML = `

    <label>
      Tipo de informe

      <select id="reportMode">

        <option value="filter">
          Por categoría / uso
        </option>

        <option value="manual">
          Seleccionar artículos
        </option>

      </select>

    </label>


    <div
      id="manualReportBox"
      class="hidden"
    >

      <div class="manual-actions">

        <button
          id="selectAllReport"
          type="button"
          class="text-btn"
        >
          Seleccionar todos
        </button>


        <button
          id="clearReportSelection"
          type="button"
          class="text-btn"
        >
          Limpiar selección
        </button>

      </div>


      <div
        id="manualReportItems"
      ></div>

    </div>
  `;


  const preview =
    $("#reportPreview");


  panel.insertBefore(
    controls,
    preview
  );


  $("#reportMode").onchange =
    () => {

      const manual =
        $("#reportMode").value ===
        "manual";


      $("#manualReportBox")
        .classList
        .toggle(
          "hidden",
          !manual
        );


      $(".report-filters")
        .classList
        .toggle(
          "hidden",
          manual
        );


      renderManualReportList();

      report();
    };


  $("#selectAllReport").onclick =
    () => {

      $$(".report-check")
        .forEach(c => {
          c.checked = true;
        });

      report();
    };


  $("#clearReportSelection").onclick =
    () => {

      $$(".report-check")
        .forEach(c => {
          c.checked = false;
        });

      report();
    };
}


function renderManualReportList() {
  const box =
    $("#manualReportItems");


  if (!box) {
    return;
  }


  box.innerHTML =
    items.map(item => `

      <label class="report-select-row">

        <input
          type="checkbox"
          class="report-check"
          value="${item.id}"
        >

        <span>

          <b>
            ${esc(item.name)}
          </b>

          <small>
            ${esc(categoryName(item))}
            ${
              item.usage
                ? " · " +
                  esc(item.usage)
                : ""
            }
          </small>

        </span>

      </label>

    `).join("");


  $$(".report-check")
    .forEach(check => {

      check.onchange =
        report;

    });
}


function report() {
  const mode =
    $("#reportMode")
      ? $("#reportMode").value
      : "filter";


  let filtered = [];

  let filterText =
    "Todos los artículos";


  if (mode === "manual") {
    const selectedIds =
      $$(".report-check:checked")
        .map(
          c => c.value
        );


    filtered =
      items.filter(
        i =>
          selectedIds.includes(
            String(i.id)
          )
      );


    filterText =
      "Selección manual";

  } else {

    const category =
      $("#reportCategory").value;


    const usage =
      $("#reportUsage").value;


    filtered =
      items.filter(
        i =>
          (
            !category ||
            categoryName(i) ===
              category
          ) &&
          (
            !usage ||
            i.usage ===
              usage
          )
      );


    if (category || usage) {
      filterText =
        [
          category,
          usage
        ]
          .filter(Boolean)
          .join(" / ");
    }
  }


  const total =
    filtered.reduce(
      (sum, i) =>
        sum +
        Number(
          i.quantity || 0
        ),
      0
    );


  $("#reportPreview").innerHTML = `

    <div class="report-header">

      <div class="report-brand">
        MUNSTER · ESPACIO SEI
      </div>

      <h2>
        Inventario de Vajilla
      </h2>


      <div class="report-info">

        <div>
          <b>
            Fecha de inventario:
          </b>

          ${formatDate(
            config?.inventory_date
          )}
        </div>


        <div>
          <b>
            Reporte generado:
          </b>

          ${formatDateTime(
            new Date()
              .toISOString()
          )}
        </div>


        <div>
          <b>
            Filtro:
          </b>

          ${esc(filterText)}
        </div>

      </div>

    </div>


    <table class="report-table">

      <thead>

        <tr>

          <th>
            Artículo
          </th>

          <th>
            Categoría
          </th>

          <th>
            Uso
          </th>

          <th class="number">
            Cantidad
          </th>

        </tr>

      </thead>


      <tbody>

        ${
          filtered.length
            ? filtered.map(i => `

              <tr>

                <td>
                  ${esc(i.name)}
                </td>

                <td>
                  ${esc(
                    categoryName(i)
                  )}
                </td>

                <td>
                  ${esc(
                    i.usage || ""
                  )}
                </td>

                <td class="number">
                  ${Number(
                    i.quantity || 0
                  )}
                </td>

              </tr>

            `).join("")

            : `

              <tr>

                <td
                  colspan="4"
                  class="empty-report"
                >
                  No hay artículos seleccionados.
                </td>

              </tr>
            `
        }

      </tbody>

    </table>


    <div class="report-total">

      <span>
        Artículos:
        <b>
          ${filtered.length}
        </b>
      </span>

      <span>
        Total de unidades:
        <b>
          ${total}
        </b>
      </span>

    </div>
  `;
}


/* =========================
   INICIO
========================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      const ok =
        await initSupabase();


      if (!ok) {
        return;
      }


      await refreshAll();


    } catch (error) {

      console.error(error);


      alert(
        "No se pudo conectar con Supabase. " +
        (
          error.message ||
          ""
        )
      );


      return;
    }


    prepareReportControls();


    $("#searchInput").oninput =
      e =>
        search(
          e.target.value
        );


    $("#clearSearch").onclick =
      () => {

        $("#searchInput").value =
          "";

        search("");
      };


    /* ADMIN */

    $("#adminBtn").onclick =
      openAdminAccess;


    ensureAdminLoginUI();

    $("#enterAdminBtn").onclick =
      verifyAdminLogin;

    $("#adminPassword")
      .addEventListener("keydown", e => {
        if (e.key === "Enter") {
          verifyAdminLogin();
        }
      });


    $("#logoutBtn").onclick =
      closeAdmin;


    /* ARTÍCULOS */

    $("#newItemBtn").onclick =
      () => {

        resetForm();

        fillSelectors();

        show(
          "itemFormView"
        );
      };


    $("#itemFormBack").onclick =
      () => {

        renderAdmin();

        show(
          "adminView"
        );
      };


    $("#cameraInput").onchange =
      e =>
        previewFile(
          e.target.files[0]
        );


    $("#galleryInput").onchange =
      e =>
        previewFile(
          e.target.files[0]
        );


    $("#saveItemBtn").onclick =
      saveItem;


    /* CATEGORÍAS */

    $("#newCategoryBtn").onclick =
    $("#inlineNewCategory").onclick =
      () => {

        $("#categoryMsg").textContent =
          "";

        $("#categoryModal")
          .classList
          .remove("hidden");
      };


    $("#closeCategoryModal").onclick =
      () => {

        $("#categoryModal")
          .classList
          .add("hidden");
      };


    $("#saveCategoryBtn").onclick =
      saveCategory;


    /* FECHA */

    $("#updateInventoryDateBtn").onclick =
      updateInventoryDate;


    /* INFORMES */

    $("#reportsBtn").onclick =
    $("#publicReportsBtn").onclick =
      () => {

        renderManualReportList();

        report();

        show(
          "reportsView"
        );
      };


    $("#reportCategory").onchange =
      report;


    $("#reportUsage").onchange =
      report;


    $("#printReport").onclick =
      () =>
        window.print();


    /* VOLVER */

    $$("[data-back]")
      .forEach(btn => {

        btn.onclick =
          () =>
            show(
              "homeView"
            );

      });


    /* PWA */

    if (
      "serviceWorker" in
      navigator
    ) {
      navigator
        .serviceWorker
        .register(
          "sw.js"
        )
        .catch(
          () => {}
        );
    }

  }
);
