const BASE = [
  { name: "Platos", icon: "🍽️" },
  { name: "Copas", icon: "🍷" },
  { name: "Vasos", icon: "🥃" },
  { name: "Cubiertos", icon: "🍴" },
  { name: "Cafetería", icon: "☕" },
  { name: "Cerveza", icon: "🍺" },
  { name: "Otros", icon: "📦" }
]
  ;let supabaseClient = null;
let categories = [];
let items = [];
let selectedFile = null;
let editingId = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function show(id) {
  $$(".view").forEach(v => v.classList.remove("active"));
  $("#" + id).classList.add("active");
  window.scrollTo(0, 0);
}

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
    return categories.find(c => c.id === item.category_id)?.name || "Otros";
  }
  return item.category || "Otros";
}

async function initSupabase() {
  const cfg = window.VAJILLA_CONFIG || {};

  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    alert("Falta configurar Supabase.");
    return false;
  }

  supabaseClient = window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseKey
  );

  return true;
}

async function loadData() {
  const catResult = await supabaseClient
    .from("vajilla_categories")
    .select("*")
    .order("sort_order");

  if (catResult.error) throw catResult.error;

  categories = catResult.data || [];

  const itemResult = await supabaseClient
    .from("vajilla_items")
    .select("*")
    .order("name");

  if (itemResult.error) throw itemResult.error;

  items = itemResult.data || [];

  renderCategories();
  fillSelectors();
}

function renderCategories() {
  $("#categoryCount").textContent =
    categories.length + " categorías";

  $("#categoryGrid").innerHTML = categories.map(c => {
    const cantidad = items.filter(
      i => categoryName(i) === c.name
    ).length;

    return `
      <button class="category-card" data-cat="${esc(c.name)}">
        <span class="cat-icon">${BASE.find(b => b.name === c.name)?.icon || c.icon || "📦"}</span>
        <b>${esc(c.name)}</b>
        <small>
          ${cantidad} ${cantidad === 1 ? "artículo" : "artículos"}
        </small>
      </button>
    `;
  }).join("");

  $$("#categoryGrid .category-card").forEach(btn => {
    btn.onclick = () => openCategory(btn.dataset.cat);
  });
}

function itemCard(item, admin = false) {
  const photo = item.photo_url || "";

  return `
    <article class="item-card">

      <div class="item-photo">
        ${
          photo
            ? `<img src="${photo}" alt="">`
            : "📷"
        }
      </div>

      <div class="item-body">

        <h4>${esc(item.name)}</h4>

        <div class="item-meta">

          <span class="tag">
            ${esc(categoryName(item))}
          </span>

          ${
            item.usage
              ? `<span class="tag">${esc(item.usage)}</span>`
              : ""
          }

        </div>

        <div class="qty">
          ${Number(item.quantity || 0)} unidades
        </div>

        ${
          item.description
            ? `<div class="desc">${esc(item.description)}</div>`
            : ""
        }

        ${
          admin
            ? `
              <div style="
                display:flex;
                gap:14px;
                margin-top:12px;
              ">

                <button
                  class="text-btn edit-btn"
                  data-id="${item.id}"
                >
                  Editar
                </button>

                <button
                  class="text-btn delete-btn"
                  data-id="${item.id}"
                  style="color:#a23434;"
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

function openCategory(name) {
  $("#categoryTitle").textContent = name;

  const list = items.filter(
    i => categoryName(i) === name
  );

  const usages = [
    ...new Set(
      list
        .map(i => i.usage)
        .filter(Boolean)
    )
  ];

  $("#usageFilters").innerHTML =
    `<button class="chip active" data-use="">Todos</button>` +
    usages.map(u =>
      `<button class="chip" data-use="${esc(u)}">
        ${esc(u)}
      </button>`
    ).join("");

  function render(use = "") {
    const filtered = list.filter(
      i => !use || i.usage === use
    );

    $("#categoryItems").innerHTML =
      filtered.map(i => itemCard(i)).join("");

    $("#categoryEmpty")
      .classList
      .toggle("hidden", filtered.length > 0);
  }

  render();

  $$("#usageFilters .chip").forEach(btn => {

    btn.onclick = () => {

      $$("#usageFilters .chip")
        .forEach(x => x.classList.remove("active"));

      btn.classList.add("active");

      render(btn.dataset.use);
    };

  });

  show("categoryView");
}

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

  const filtered = items.filter(i =>
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
      ? filtered.map(i => itemCard(i)).join("")
      : `<div class="empty">Sin resultados</div>`;

  $("#searchResultsSection")
    .classList
    .remove("hidden");
}

function fillSelectors() {

  $("#itemCategory").innerHTML =
    categories.map(c =>
      `<option value="${c.id}">
        ${esc(c.name)}
      </option>`
    ).join("");

  $("#reportCategory").innerHTML =
    `<option value="">Todas</option>` +
    categories.map(c =>
      `<option>${esc(c.name)}</option>`
    ).join("");

  const usages = [
    ...new Set(
      items
        .map(i => i.usage)
        .filter(Boolean)
    )
  ];

  $("#usageSuggestions").innerHTML =
    usages.map(u =>
      `<option value="${esc(u)}">`
    ).join("");

  $("#reportUsage").innerHTML =
    `<option value="">Todos</option>` +
    usages.map(u =>
      `<option>${esc(u)}</option>`
    ).join("");
}

function renderAdmin() {

  $("#adminItems").innerHTML =
    items.length
      ? items.map(i => itemCard(i, true)).join("")
      : `
        <div class="empty">
          Todavía no hay artículos.
        </div>
      `;

  $$(".edit-btn").forEach(btn => {
    btn.onclick =
      () => editItem(btn.dataset.id);
  });

  $$(".delete-btn").forEach(btn => {
    btn.onclick =
      () => deleteItem(btn.dataset.id);
  });
}

function resetForm() {

  editingId = null;
  selectedFile = null;

  $("#formTitle").textContent =
    "Agregar artículo";

  $("#itemName").value = "";
  $("#itemUsage").value = "";
  $("#itemQuantity").value = "";
  $("#itemDescription").value = "";

  $("#photoPreview").src = "";

  $("#photoPreview")
    .classList
    .add("hidden");

  $("#photoPlaceholder")
    .classList
    .remove("hidden");

  $("#saveMsg").textContent = "";
  $("#saveMsg").style.color = "";
}

function previewFile(file) {

  if (!file) return;

  selectedFile = file;

  const reader = new FileReader();

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

  let width = bitmap.width;
  let height = bitmap.height;

  const scale = Math.min(
    1,
    maxSize / Math.max(width, height)
  );

  width =
    Math.round(width * scale);

  height =
    Math.round(height * scale);

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

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
          contentType: "image/webp",
          upsert: true
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

  return publicResult.data.publicUrl;
}

async function saveItem() {

  const name =
    $("#itemName")
      .value
      .trim();

  const category_id =
    $("#itemCategory").value;

  const usage =
    $("#itemUsage")
      .value
      .trim();

  const quantity =
    Number(
      $("#itemQuantity").value || 0
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

  $("#saveItemBtn").disabled = true;

  $("#saveMsg").style.color = "";

  $("#saveMsg").textContent =
    "Guardando…";

  try {

    let id = editingId;

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

      id = result.data.id;

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
              new Date().toISOString()
          })
          .eq("id", id);

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
              new Date().toISOString()
          })
          .eq("id", id);

      if (photoResult.error) {
        throw photoResult.error;
      }

    }

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

    }, 1200);

  } catch (error) {

    console.error(error);

    $("#saveItemBtn").disabled =
      false;

    $("#saveMsg").style.color =
      "#a23434";

    $("#saveMsg").textContent =
      "No se pudo guardar. " +
      (error.message || "");
  }
}

function editItem(id) {

  const item =
    items.find(
      i =>
        String(i.id) ===
        String(id)
    );

  if (!item) return;

  editingId = item.id;
  selectedFile = null;

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

  $("#saveMsg").textContent = "";

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

async function deleteItem(id) {

  const item =
    items.find(
      i =>
        String(i.id) ===
        String(id)
    );

  if (!item) return;

  const ok = confirm(
    `¿Eliminar "${item.name}"?\n\nEsta acción no se puede deshacer.`
  );

  if (!ok) return;

  const result =
    await supabaseClient
      .from("vajilla_items")
      .delete()
      .eq("id", id);

  if (result.error) {

    alert(
      "No se pudo eliminar: " +
      result.error.message
    );

    return;
  }

  await loadData();

  renderAdmin();

  alert(
    "Artículo eliminado correctamente"
  );
}

async function saveCategory() {

  const name =
    $("#newCategoryName")
      .value
      .trim();

  const icon =
    $("#newCategoryIcon").value;

  if (!name) {

    $("#categoryMsg").textContent =
      "Escribí un nombre.";

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

  $("#categoryMsg").textContent =
    "Categoría creada correctamente";

  await loadData();

  $("#categoryModal")
    .classList
    .add("hidden");

  $("#newCategoryName").value = "";
}

/* ==============================
   INFORMES
================================ */

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
    document.createElement("div");

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
      style="
        margin-top:20px;
        border-top:1px solid #ded8ca;
        padding-top:15px;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:10px;
          margin-bottom:12px;
        "
      >

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

      <div id="manualReportItems"></div>

    </div>

  `;

  const printButton =
    $("#printReport");

  panel.insertBefore(
    controls,
    printButton
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

      $("#reportCategory")
        .closest("label")
        .classList
        .toggle(
          "hidden",
          manual
        );

      $("#reportUsage")
        .closest("label")
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

  if (!box) return;

  box.innerHTML =
    items.map(item => `

      <label
        style="
          display:flex;
          align-items:center;
          gap:10px;
          margin:8px 0;
          padding:10px;
          background:#fff;
          border:1px solid #ded8ca;
          border-radius:10px;
        "
      >

        <input
          type="checkbox"
          class="report-check"
          value="${item.id}"
          style="
            width:auto;
            margin:0;
          "
        >

        <span>

          <b>
            ${esc(item.name)}
          </b>

          <small
            style="
              display:block;
              color:#6f7773;
              margin-top:2px;
            "
          >
            ${esc(categoryName(item))}
            ${item.usage ? " · " + esc(item.usage) : ""}
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

  let reportTitle =
    "Inventario de Vajilla";

  if (mode === "manual") {

    const selectedIds =
      $$(".report-check:checked")
        .map(c => c.value);

    filtered =
      items.filter(i =>
        selectedIds.includes(
          String(i.id)
        )
      );

    reportTitle =
      "Inventario de Vajilla — Selección de artículos";

  } else {

    const category =
      $("#reportCategory").value;

    const usage =
      $("#reportUsage").value;

    filtered =
      items.filter(i =>
        (!category ||
          categoryName(i) ===
          category) &&
        (!usage ||
          i.usage === usage)
      );
  }

  const total =
    filtered.reduce(
      (sum, i) =>
        sum +
        Number(i.quantity || 0),
      0
    );

  $("#reportPreview").innerHTML = `

    <h2>
      ${reportTitle}
    </h2>

    <p>
      <b>Fecha:</b>
      ${new Date().toLocaleDateString("es-AR")}
    </p>

    <table
      style="
        width:100%;
        border-collapse:collapse;
        margin-top:20px;
      "
    >

      <thead>

        <tr>

          <th
            style="
              text-align:left;
              padding:8px;
              border-bottom:2px solid #333;
            "
          >
            Artículo
          </th>

          <th
            style="
              text-align:left;
              padding:8px;
              border-bottom:2px solid #333;
            "
          >
            Categoría
          </th>

          <th
            style="
              text-align:left;
              padding:8px;
              border-bottom:2px solid #333;
            "
          >
            Uso
          </th>

          <th
            style="
              text-align:right;
              padding:8px;
              border-bottom:2px solid #333;
            "
          >
            Cantidad
          </th>

        </tr>

      </thead>

      <tbody>

        ${
          filtered.length
            ? filtered.map(i => `

              <tr>

                <td
                  style="
                    padding:8px;
                    border-bottom:1px solid #ddd;
                  "
                >
                  ${esc(i.name)}
                </td>

                <td
                  style="
                    padding:8px;
                    border-bottom:1px solid #ddd;
                  "
                >
                  ${esc(categoryName(i))}
                </td>

                <td
                  style="
                    padding:8px;
                    border-bottom:1px solid #ddd;
                  "
                >
                  ${esc(i.usage || "")}
                </td>

                <td
                  style="
                    padding:8px;
                    border-bottom:1px solid #ddd;
                    text-align:right;
                  "
                >
                  ${Number(i.quantity || 0)}
                </td>

              </tr>

            `).join("")
            : `
              <tr>
                <td
                  colspan="4"
                  style="
                    padding:25px;
                    text-align:center;
                    color:#777;
                  "
                >
                  No hay artículos seleccionados.
                </td>
              </tr>
            `
        }

      </tbody>

    </table>

    <div
      style="
        margin-top:22px;
        text-align:right;
        font-size:1.1rem;
      "
    >

      <b>
        Total de unidades:
        ${total}
      </b>

    </div>
  `;
}

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      const ok =
        await initSupabase();

      if (!ok) return;

      await loadData();

    } catch (error) {

      console.error(error);

      alert(
        "No se pudo conectar con Supabase. " +
        (error.message || "")
      );

      return;
    }

    prepareReportControls();

    $("#searchInput").oninput =
      e => search(e.target.value);

    $("#clearSearch").onclick =
      () => {

        $("#searchInput").value = "";

        search("");
      };

    /* SIN LOGIN */

    $("#adminBtn").onclick =
      () => {

        renderAdmin();

        show("adminView");
      };

    $("#logoutBtn").onclick =
      () => show("homeView");

    $("#newItemBtn").onclick =
      () => {

        resetForm();

        fillSelectors();

        show("itemFormView");
      };

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

    $("#cameraInput").onchange =
      e => previewFile(
        e.target.files[0]
      );

    $("#galleryInput").onchange =
      e => previewFile(
        e.target.files[0]
      );

    $("#saveItemBtn").onclick =
      saveItem;

    $("#itemFormBack").onclick =
      () => show("adminView");

    $("#reportsBtn").onclick =
      () => {

        renderManualReportList();

        report();

        show("reportsView");
      };

    $("#reportCategory").onchange =
      report;

    $("#reportUsage").onchange =
      report;

    $("#printReport").onclick =
      () => window.print();

    $$("[data-back]")
      .forEach(btn => {

        btn.onclick =
          () => show("homeView");

      });

    if (
      "serviceWorker" in navigator
    ) {

      navigator
        .serviceWorker
        .register("sw.js")
        .catch(() => {});
    }
  }
);
