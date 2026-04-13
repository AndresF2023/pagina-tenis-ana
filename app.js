const STORAGE_KEY = "tennis-exercises-v2";
const defaultExercises = [
  {
    id: crypto.randomUUID(),
    title: "Derecha cruzada en movimiento",
    description: "Peloteo cruzado con desplazamiento lateral y foco en consistencia.",
    videoUrl: "https://www.youtube.com/watch?v=9fdfQ03w06Q",
    notes: ""
  },
  {
    id: crypto.randomUUID(),
    title: "Saque y primer golpe",
    description: "Secuencia de saque abierto y ataque con derecha al siguiente tiro.",
    videoUrl: "https://www.youtube.com/watch?v=a6x8VZ4T6j8",
    notes: ""
  }
];

const form = document.getElementById("exercise-form");
const list = document.getElementById("exercise-list");
const template = document.getElementById("exercise-template");
const statusBadge = document.getElementById("data-source-status");
const isFileProtocol = window.location.protocol === "file:";

const SUPABASE_URL = window.__SUPABASE_URL__ || "";
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || "";

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof window.supabase?.createClient === "function") {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    console.error(error);
  }
}

let currentExercises = [];
const noteSaveTimers = new Map();

function getYouTubeVideoId(parsedUrl) {
  const host = parsedUrl.hostname.replace("www.", "");

  if (host.includes("youtube.com")) {
    const fromQuery = parsedUrl.searchParams.get("v");
    if (fromQuery) return fromQuery;

    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    if (segments[0] === "shorts" || segments[0] === "embed" || segments[0] === "live") {
      return segments[1] || "";
    }
  }

  if (host.includes("youtu.be")) {
    return parsedUrl.pathname.split("/").filter(Boolean)[0] || "";
  }

  return "";
}

function getYouTubeThumbnail(url) {
  try {
    const parsed = new URL(url);
    const videoId = getYouTubeVideoId(parsed);
    if (!videoId) return "";
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  } catch {
    return "";
  }
}

function loadLocalExercises() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultExercises));
    return [...defaultExercises];
  }

  try {
    const parsed = JSON.parse(saved);
    return parsed.map((exercise) => ({
      ...exercise,
      notes: typeof exercise.notes === "string" ? exercise.notes : ""
    }));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultExercises));
    return [...defaultExercises];
  }
}

function saveLocalExercises(exercises) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exercises));
}

function setDataSourceStatus(message) {
  statusBadge.textContent = message;
}

function formatDbError(error) {
  if (!error) return "";
  const msg = error.message || error.error_description || "";
  const details = [error.code, error.details, error.hint].filter(Boolean).join(" — ");
  return [msg, details].filter(Boolean).join("\n");
}

function normalizeVideoUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function mapExerciseRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    videoUrl: row.video_url || "",
    notes: typeof row.notes === "string" ? row.notes : ""
  };
}

function sortExercisesByDate(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
  return list;
}

async function loadExercises() {
  if (!supabase) {
    setDataSourceStatus("Modo local: los cambios se guardan solo en este navegador.");
    return loadLocalExercises();
  }

  const { data, error } = await supabase
    .from("exercises")
    .select("id, title, description, video_url, notes, created_at");

  if (error) {
    console.error(error);
    setDataSourceStatus(
      `Error al leer Supabase: ${error.message || "desconocido"}. Revisa tabla public.exercises, RLS y permisos (ver supabase-schema.sql). Modo local temporal.`
    );
    return loadLocalExercises();
  }

  setDataSourceStatus("Conectado a base de datos (Supabase).");
  const rows = sortExercisesByDate(data ?? []);
  return rows.map(mapExerciseRow);
}

async function createExercise(exercise) {
  if (!supabase) {
    const next = [exercise, ...currentExercises];
    saveLocalExercises(next);
    return next;
  }

  const payload = {
    title: exercise.title,
    description: exercise.description,
    video_url: exercise.videoUrl,
    notes: ""
  };

  const { data: insertedRows, error: insertError } = await supabase
    .from("exercises")
    .insert(payload)
    .select("id, title, description, video_url, notes, created_at");

  if (insertError) throw insertError;

  const inserted = Array.isArray(insertedRows) && insertedRows.length > 0 ? insertedRows[0] : null;
  let reloaded = await loadExercises();

  if (inserted) {
    const insertedMapped = mapExerciseRow(inserted);
    if (!reloaded.some((item) => item.id === insertedMapped.id)) {
      reloaded = [insertedMapped, ...reloaded];
    }
    return reloaded;
  }

  reloaded = await loadExercises();
  if (reloaded.length === 0) {
    setDataSourceStatus(
      "Supabase: el alta puede haber funcionado pero no hay filas visibles. Falta politica RLS de SELECT para rol anon o permisos GRANT. Ejecuta de nuevo supabase-schema.sql en el SQL Editor."
    );
    window.alert(
      "No se pudo mostrar el ejercicio guardado.\n\nEn Supabase abre SQL Editor y ejecuta todo el archivo supabase-schema.sql (politicas RLS + GRANT).\n\nLuego Table Editor > exercises y comprueba si la fila existe."
    );
  }
  return reloaded;
}

async function deleteExercise(exerciseId) {
  if (!supabase) {
    const updated = currentExercises.filter((item) => item.id !== exerciseId);
    saveLocalExercises(updated);
    return updated;
  }

  const { error } = await supabase.from("exercises").delete().eq("id", exerciseId);
  if (error) throw error;
  return loadExercises();
}

async function updateExerciseNotes(exerciseId, notes) {
  if (!supabase) {
    const updated = currentExercises.map((item) =>
      item.id === exerciseId ? { ...item, notes } : item
    );
    saveLocalExercises(updated);
    currentExercises = updated;
    return;
  }

  const { error } = await supabase.from("exercises").update({ notes }).eq("id", exerciseId);
  if (error) console.error(error);
}

function getEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");
    const youtubeId = getYouTubeVideoId(parsed);

    if (youtubeId) {
      return `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`;
    }

    if (host.includes("vimeo.com")) {
      const videoId = parsed.pathname.split("/").filter(Boolean).pop();
      if (videoId) return `https://player.vimeo.com/video/${videoId}`;
    }
  } catch {
    return "";
  }

  return "";
}

function renderExercises(exercises) {
  list.innerHTML = "";

  const previousWarning = document.getElementById("local-file-warning");
  if (previousWarning) previousWarning.remove();

  if (isFileProtocol) {
    const warning = document.createElement("p");
    warning.id = "local-file-warning";
    warning.className = "empty-message";
    warning.innerHTML =
      "Estas viendo la pagina en modo archivo (file://). YouTube bloquea el reproductor en este modo. " +
      "Para reproducir los videos dentro de esta pagina, abre el archivo <code>abrir-pagina.bat</code> y usa localhost.";
    list.before(warning);
  }

  if (exercises.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = "Todavía no hay ejercicios. Agrega el primero desde el formulario.";
    list.appendChild(empty);
    return;
  }

  exercises.forEach((exercise) => {
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector(".card");
    const frame = clone.querySelector("iframe");
    const title = clone.querySelector(".exercise-title");
    const description = clone.querySelector(".exercise-description");
    const notesField = clone.querySelector(".notes");
    const embedUrl = getEmbedUrl(exercise.videoUrl);
    const videoWrapper = card.querySelector(".video-wrapper");
    const thumbnailUrl = getYouTubeThumbnail(exercise.videoUrl);

    title.textContent = exercise.title;
    description.textContent = exercise.description;
    notesField.value = exercise.notes || "";
    notesField.addEventListener("input", (event) => {
      const nextNotes = event.target.value;
      if (noteSaveTimers.has(exercise.id)) {
        clearTimeout(noteSaveTimers.get(exercise.id));
      }

      const timer = setTimeout(() => {
        updateExerciseNotes(exercise.id, nextNotes);
        noteSaveTimers.delete(exercise.id);
      }, 450);
      noteSaveTimers.set(exercise.id, timer);
    });

    if (embedUrl && !isFileProtocol) {
      frame.src = embedUrl;
      frame.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
    } else {
      frame.remove();

      if (thumbnailUrl) {
        const img = document.createElement("img");
        img.src = thumbnailUrl;
        img.alt = `Miniatura de ${exercise.title}`;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        videoWrapper.appendChild(img);
      } else {
        const msg = document.createElement("p");
        msg.className = "empty-message";
        msg.textContent = "No se pudo cargar vista previa. Usa el enlace para abrir el video.";
        videoWrapper.appendChild(msg);
      }
    }

    const openLink = document.createElement("a");
    openLink.href = exercise.videoUrl;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = isFileProtocol ? "Ver video (recomendado en file://)" : "Abrir video en una pestaña nueva";
    openLink.style.display = "inline-block";
    openLink.style.marginTop = "0.5rem";
    openLink.style.color = "#1f6feb";
    const cardContent = card.querySelector(".card-content");
    cardContent.appendChild(openLink);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Eliminar ejercicio";
    deleteButton.style.marginTop = "0.7rem";
    deleteButton.style.background = "#c62828";
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(`¿Seguro que deseas eliminar "${exercise.title}"?`);
      if (!confirmed) return;
      try {
        currentExercises = await deleteExercise(exercise.id);
        renderExercises(currentExercises);
      } catch (error) {
        console.error(error);
        window.alert("No se pudo eliminar. Revisa la configuracion de la base de datos.");
      }
    });
    cardContent.appendChild(deleteButton);

    list.appendChild(clone);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const videoUrl = normalizeVideoUrl(formData.get("videoUrl"));

  if (!title || !description || !videoUrl) return;
  if (!isValidHttpUrl(videoUrl)) {
    window.alert("La URL del video no es valida. Usa un enlace que empiece con http:// o https://");
    return;
  }
  try {
    currentExercises = await createExercise({
      id: crypto.randomUUID(),
      title,
      description,
      videoUrl,
      notes: ""
    });
    renderExercises(currentExercises);
    form.reset();
  } catch (error) {
    console.error(error);
    const detail = formatDbError(error);
    window.alert(
      `No se pudo guardar el ejercicio.${detail ? `\n\n${detail}` : ""}\n\nComprueba en Supabase: existe la tabla public.exercises con columnas title, description, video_url, notes; RLS con politicas para anon; clave API del proyecto (anon o publishable).`
    );
  }
});

async function init() {
  currentExercises = await loadExercises();
  if (SUPABASE_URL && SUPABASE_ANON_KEY && !supabase) {
    setDataSourceStatus(
      "Claves de Supabase configuradas pero el cliente no inicio. Revisa la consola (F12) y la carga del script supabase.js. Los datos se guardan solo en local."
    );
  }
  renderExercises(currentExercises);
}

init();
