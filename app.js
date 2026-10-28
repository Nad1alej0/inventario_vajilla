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


function productName(item) {
  return (item.product || item.name || "Sin producto").trim();
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

      const catItems =
        items.filter(
          i =>
            String(i.category_id) ===
            String(c.id)
        );

      const models =
        catItems.length;

      const units =
        catItems.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0),
          0
        );

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
            ${models}
            ${models === 1 ? "modelo" : "modelos"}
            · ${units} unidades
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

  const grouped = {};

  list.forEach(item => {
    const product =
      productName(item);

    if (!grouped[product]) {
      grouped[product] = [];
    }

    grouped[product].push(item);
  });

  $("#usageFilters").innerHTML = "";

  const products =
    Object.entries(grouped)
      .sort((a, b) =>
        a[0].localeCompare(
          b[0],
          "es",
          { sensitivity: "base" }
        )
      );

  $("#categoryItems").innerHTML =
    products.length
      ? products.map(([product, productItems]) => {

          const units =
            productItems.reduce(
              (sum, item) =>
                sum + Number(item.quantity || 0),
              0
            );

          const models =
            productItems.length;

          return `
            <button
              class="product-card"
              data-product="${esc(product)}"
            >
              <div>
                <span class="kicker">
                  Producto
                </span>

                <h3>
                  ${esc(product)}
                </h3>
              </div>

              <div class="product-totals">
                <b>
                  ${units}
                </b>

                <small>
                  unidades
                </small>
              </div>

              <small class="muted">
                ${models}
                ${models === 1 ? "modelo" : "modelos"}
              </small>
            </button>
          `;
        }).join("")
      : "";

  $("#categoryEmpty")
    .classList
    .toggle(
      "hidden",
      products.length > 0
    );

  $$("#categoryItems .product-card")
    .forEach(btn => {

      btn.onclick =
        () =>
          openProduct(
            name,
            btn.dataset.product
          );

    });

  const back =
    $("#categoryView [data-back]");

  if (back) {
    back.onclick =
      () =>
        show("homeView");
  }

  show("categoryView");
}


function openProduct(
  category,
  product
) {
  $("#categoryTitle").textContent =
    product;

  const list =
    items.filter(
      i =>
        categoryName(i) ===
          category &&
        productName(i) ===
          product
    );

  const total =
    list.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity || 0),
      0
    );

  $("#usageFilters").innerHTML = `
    <span class="chip active">
      ${list.length}
      ${list.length === 1 ? "modelo" : "modelos"}
      · ${total} unidades
    </span>
  `;

  $("#categoryItems").innerHTML =
    list
      .map(i => itemCard(i))
      .join("");

  $("#categoryEmpty")
    .classList
    .toggle(
      "hidden",
      list.length > 0
    );

  const back =
    $("#categoryView [data-back]");

  if (back) {
    back.onclick =
      () =>
        openCategory(category);
  }

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

          <span class="tag">
            ${esc(productName(item))}
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
        i.product,
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

const ADMIN_LOGIN_EMAIL = "nadiallanqueleo89+inventario@gmail.com";

function ensureAdminLoginUI() {
  const panel = $("#pinView .panel");
  if (!panel || $("#adminPinInput")) return;

  panel.innerHTML = `
    <span class="kicker">Acceso restringido</span>
    <h2>Administración</h2>
    <p class="muted">Ingresá el PIN de administración.</p>

    <label>
      PIN
      <input
        id="adminPinInput"
        type="password"
        inputmode="numeric"
        maxlength="12"
        autocomplete="current-password"
        placeholder="••••"
      >
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

  setTimeout(() => $("#adminPinInput")?.focus(), 100);
}

async function verifyAdminPin() {
  const pin = $("#adminPinInput")?.value.trim() || "";

  if (!pin) {
    $("#pinMsg").textContent = "Ingresá el PIN.";
    return;
  }

  $("#pinMsg").textContent = "Ingresando…";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: ADMIN_LOGIN_EMAIL,
    password: pin
  });

  if (error) {
    $("#pinMsg").textContent = "PIN incorrecto.";
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


  $("#itemProduct").value =
    "";

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
  const product =
    $("#itemProduct")
      .value
      .trim();


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


  if (!product) {
    $("#saveMsg").textContent =
      "Falta el producto.";

    return;
  }


  if (!name) {
    $("#saveMsg").textContent =
      "Falta el modelo.";

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
      id =
        crypto.randomUUID();


      const result =
        await supabaseClient
          .from("vajilla_items")
          .insert({
            id,
            product,
            name,
            category_id,
            usage,
            quantity,
            description
          });


      if (result.error) {
        throw result.error;
      }

    } else {

      const result =
        await supabaseClient
          .from("vajilla_items")
          .update({
            product,
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


  $("#itemProduct").value =
    item.product || item.name || "";

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
      verifyAdminPin;

    $("#adminPinInput")
      .addEventListener("keydown", e => {
        if (e.key === "Enter") {
          verifyAdminPin();
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
/* DIBUJOS NUEVOS PARA LAS CATEGORÍAS */

let categoriaEnEdicion = null;

const dibujoSVG = contenido => `
  <svg xmlns="http://www.w3.org/2000/svg"
       viewBox="0 0 64 64"
       width="32" height="32"
       aria-hidden="true"
       style="vertical-align:middle;max-width:100%">
    ${contenido}
  </svg>
`;

const dibujosCategorias = {
  pinta: dibujoSVG(`
    <path d="M17 13h30l-5 43H22z"
          fill="#d9eff0" stroke="#4d7776" stroke-width="2"/>
    <path d="M21 26h22l-3 27H24z" fill="#e6ad38"/>
    <path d="M18 15c-4-8 5-13 11-8
             4-6 15-4 15 2
             7-1 9 8 2 11H20z"
          fill="#fff7df" stroke="#cbbf98" stroke-width="2"/>
    <path d="m26 29 2 19"
          stroke="#fff3bf" stroke-width="3"/>
  `),

  pinzas: dibujoSVG(`
    <path d="M29 10c-6-7-15-1-12 7
             l11 23-8 12 6 4 10-16
             -13-25c-1-3 2-5 4-2
             l19 27-2 16 8 1 1-20z"
          fill="#a9bfc0" stroke="#49696b" stroke-width="2"/>
    <path d="m21 49 7 5M45 49h7"
          stroke="#d6a64b" stroke-width="5"/>
  `),

  cazuela: dibujoSVG(`
    <path d="M14 29H7v10h10m33-10h7v10H47"
          fill="none" stroke="#9e5739"
          stroke-width="5" stroke-linejoin="round"/>
    <path d="M13 27h38l-4 23
             c-7 7-23 7-30 0z"
          fill="#c8794f" stroke="#8b4d35" stroke-width="2"/>
    <ellipse cx="32" cy="27" rx="19" ry="7"
             fill="#e6aa70" stroke="#8b4d35" stroke-width="2"/>
    <ellipse cx="32" cy="28" rx="14" ry="4" fill="#80523d"/>
    <path d="M24 19c-5-6 4-7 0-13
             m14 13c-5-6 4-7 0-13"
          stroke="#a1b7b2" stroke-width="2" fill="none"/>
  `),

  termo: dibujoSVG(`
    <path d="M25 7h16v10H25z"
          fill="#d4ad5d" stroke="#6e674a" stroke-width="2"/>
    <path d="M23 18h20l3 7v29
             c0 5-26 5-26 0V25z"
          fill="#6c8a72" stroke="#35574b" stroke-width="2"/>
    <path d="M24 21h18v6H24zM21 48h24v7H21z"
          fill="#c5d4ca"/>
    <path d="M45 27h8v16h-8"
          fill="none" stroke="#35574b"
          stroke-width="4" stroke-linejoin="round"/>
    <path d="M26 31v12" stroke="#b3ccaf" stroke-width="3"/>
  `)
};

/* Respeta el dibujo elegido, también en categorías existentes. */

categoryIcon = function (categoria) {
  const icono =
    categoria.icon ||
    BASE.find(base => base.name === categoria.name)?.icon ||
    "📦";

  return dibujosCategorias[icono] || esc(icono);
};

function actualizarSeleccionDibujo() {
  const selector = document.querySelector("#newCategoryIcon");

  document.querySelectorAll("#selectorDibujos button").forEach(boton => {
    const elegido = boton.dataset.icono === selector.value;

    boton.setAttribute("aria-pressed", String(elegido));
    boton.style.borderColor = elegido ? "#b28b36" : "#d9e2dc";
    boton.style.background = elegido ? "#f7efd9" : "#fffdf8";
  });
}

function prepararSelectorDibujos() {
  const selector = document.querySelector("#newCategoryIcon");

  if (!selector || document.querySelector("#selectorDibujos")) return;

  [
    ["pinta", "Vaso de cerveza"],
    ["pinzas", "Pinzas"],
    ["cazuela", "Cazuela"],
    ["termo", "Termo"]
  ].forEach(([valor, nombre]) => {
    selector.add(new Option(nombre, valor));
  });

  selector.hidden = true;

  const panel = document.createElement("div");

  panel.id = "selectorDibujos";
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Elegir dibujo de categoría");

  panel.style.cssText = `
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(88px,1fr));
    gap:8px;
    margin:8px 0 18px;
    max-height:42vh;
    overflow-y:auto;
    padding:3px;
  `;

  Array.from(selector.options).forEach(opcion => {
    const boton = document.createElement("button");

    boton.type = "button";
    boton.dataset.icono = opcion.value;

    boton.style.cssText = `
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:5px;
      min-height:76px;
      border:2px solid;
      border-radius:12px;
      padding:8px;
      color:#153d32;
      cursor:pointer;
      font-size:12px;
    `;

    const dibujo = document.createElement("span");
    dibujo.style.cssText = "font-size:28px;line-height:34px";
    dibujo.innerHTML =
      dibujosCategorias[opcion.value] || esc(opcion.value);

    const nombre = document.createElement("span");
    nombre.textContent =
      opcion.textContent.replace(opcion.value, "").trim() ||
      opcion.textContent;

    boton.append(dibujo, nombre);

    boton.onclick = () => {
      selector.value = opcion.value;
      actualizarSeleccionDibujo();
    };

    panel.append(boton);
  });

  selector.closest("label").after(panel);
  actualizarSeleccionDibujo();
}

function abrirFormularioCategoria(categoria = null) {
  prepararSelectorDibujos();

  categoriaEnEdicion = categoria ? categoria.id : null;

  document.querySelector("#newCategoryName").value =
    categoria ? categoria.name : "";

  document.querySelector("#newCategoryIcon").value =
    categoria
      ? categoria.icon ||
        BASE.find(base => base.name === categoria.name)?.icon ||
        "📦"
      : "📦";

  document.querySelector("#categoryModal h3").textContent =
    categoria ? "Editar categoría" : "Nueva categoría";

  document.querySelector("#saveCategoryBtn").textContent =
    categoria ? "Guardar cambios" : "Crear categoría";

  document.querySelector("#categoryMsg").textContent = "";

  actualizarSeleccionDibujo();

  document.querySelector("#categoryModal").classList.remove("hidden");
}

editCategory = async function (id) {
  const categoria = categories.find(
    elemento => String(elemento.id) === String(id)
  );

  if (categoria) abrirFormularioCategoria(categoria);
};

saveCategory = async function () {
  const nombre = document.querySelector("#newCategoryName").value.trim();
  const icono = document.querySelector("#newCategoryIcon").value;
  const mensaje = document.querySelector("#categoryMsg");
  const boton = document.querySelector("#saveCategoryBtn");

  if (!nombre) {
    mensaje.textContent = "Escribí un nombre.";
    return;
  }

  const repetida = categories.some(categoria =>
    String(categoria.id) !== String(categoriaEnEdicion) &&
    categoria.name.toLowerCase() === nombre.toLowerCase()
  );

  if (repetida) {
    mensaje.textContent = "Ya existe una categoría con ese nombre.";
    return;
  }

  boton.disabled = true;
  mensaje.textContent = "Guardando…";

  try {
    const tabla = supabaseClient.from("vajilla_categories");

    const resultado = categoriaEnEdicion !== null
      ? await tabla
          .update({ name: nombre, icon: icono })
          .eq("id", categoriaEnEdicion)
          .select()
          .single()
      : await tabla
          .insert({
            name: nombre,
            icon: icono,
            sort_order: categories.length + 1
          })
          .select()
          .single();

    if (resultado.error) throw resultado.error;

    await touchUpdatedAt();
    await loadData();
    renderAdmin();

    document.querySelector("#categoryModal").classList.add("hidden");
    mensaje.textContent = "";
    categoriaEnEdicion = null;

    alert("Categoría guardada correctamente.");
  } catch (error) {
    mensaje.textContent = "No se pudo guardar. " + error.message;
  } finally {
    boton.disabled = false;
  }
};

/*
  Se prepara el selector al abrir el formulario.
  Funciona aunque la app todavía esté cargando los datos.
*/

document.addEventListener("click", evento => {
  const boton = evento.target.closest(
    "#newCategoryBtn, #inlineNewCategory"
  );

  if (!boton) return;

  evento.preventDefault();
  evento.stopImmediatePropagation();

  abrirFormularioCategoria();
}, true);
