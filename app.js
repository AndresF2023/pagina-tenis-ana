const STORAGE_KEY = "tennis-exercises-v1";
const NOTES_KEY = "tennis-exercise-notes-v1";

const defaultExercises = [
  {
    id: crypto.randomUUID(),
    title: "Derecha cruzada en movimiento",
    description: "Peloteo cruzado con desplazamiento lateral y foco en consistencia.",
    videoUrl: "https://www.youtube.com/watch?v=9fdfQ03w06Q"
  },
  {
    id: crypto.randomUUID(),
    title: "Saque y primer golpe",
    description: "Secuencia de saque abierto y ataque con derecha al siguiente tiro.",
    videoUrl: "https://www.youtube.com/watch?v=a6x8VZ4T6j8"
  }
];

const form = document.getElementById("exercise-form");
const list = document.getElementById("exercise-list");
const template = document.getElementById("exercise-template");
const isFileProtocol = window.location.protocol === "file:";

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

function loadExercises() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultExercises));
    return [...defaultExercises];
  }

  try {
    return JSON.parse(saved);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultExercises));
    return [...defaultExercises];
  }
}

function saveExercises(exercises) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exercises));
}

function loadNotes() {
  const saved = localStorage.getItem(NOTES_KEY);
  if (!saved) return {};

  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function saveNotes(notes) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function deleteNoteByExerciseId(exerciseId) {
  const notes = loadNotes();
  if (!notes[exerciseId]) return;
  delete notes[exerciseId];
  saveNotes(notes);
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
  const notes = loadNotes();
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
    notesField.value = notes[exercise.id] || "";
    notesField.addEventListener("input", (event) => {
      const current = loadNotes();
      current[exercise.id] = event.target.value;
      saveNotes(current);
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
    deleteButton.addEventListener("click", () => {
      const confirmed = window.confirm(`¿Seguro que deseas eliminar "${exercise.title}"?`);
      if (!confirmed) return;

      const currentExercises = loadExercises();
      const updatedExercises = currentExercises.filter((item) => item.id !== exercise.id);
      saveExercises(updatedExercises);
      deleteNoteByExerciseId(exercise.id);
      renderExercises(updatedExercises);
    });
    cardContent.appendChild(deleteButton);

    list.appendChild(clone);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const videoUrl = String(formData.get("videoUrl") || "").trim();

  if (!title || !description || !videoUrl) return;

  const exercises = loadExercises();
  const next = [{ id: crypto.randomUUID(), title, description, videoUrl }, ...exercises];
  saveExercises(next);
  renderExercises(next);
  form.reset();
});

renderExercises(loadExercises());
