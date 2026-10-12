// The eight jobs a phrase can do in a prompt. Every mark on the site is one of these.
export const ROLES = [
  { id: "subject", name: "Subject", blurb: "Who or what the picture is of, and what it is doing." },
  { id: "setting", name: "Place", blurb: "Where it happens: the location, landmark or backdrop." },
  { id: "style", name: "Style", blurb: "The medium and look: photo, painting, anime, colour and mood." },
  { id: "light", name: "Light & weather", blurb: "Time of day, light sources, fog, rain and haze." },
  { id: "camera", name: "Camera & framing", blurb: "Viewpoint, distance, lens effects and how the frame is arranged." },
  { id: "motion", name: "Motion & time", blurb: "For video: how things and the camera move, and for how long." },
  { id: "detail", name: "Detail", blurb: "Small, specific things that stop the result looking generic." },
  { id: "guard", name: "Guardrail", blurb: "What to leave out: text, watermarks, faces, crowds." },
];
export const ROLE = Object.fromEntries(ROLES.map((r) => [r.id, r]));

// The older notes use 27 finer labels. Each folds into one role.
const KIND_TO_ROLE = {
  subject: "subject", action: "subject", prop: "subject", focus: "subject",
  setting: "setting", identity: "setting", geography: "setting", landmark: "setting", place: "setting", background: "setting",
  style: "style", color: "style", contrast: "style", mood: "style",
  lighting: "light", light: "light", atmosphere: "light",
  camera: "camera", composition: "camera", framing: "camera", depth: "camera", scale: "camera",
  motion: "motion", duration: "motion", timing: "motion",
  detail: "detail",
  constraint: "guard", faces: "guard", text: "guard", mark: "guard", parameter: "guard", guard: "guard",
};
export const roleOf = (kind) => KIND_TO_ROLE[String(kind || "").toLowerCase()] || "detail";

export const CATEGORIES = [
  ["landscapes", "Landscapes"], ["cities", "International Cities"], ["us-cities", "US Cities"], ["street", "Street"],
  ["people", "People"], ["portraits", "Portraits"], ["cyberpunk", "Cyberpunk"], ["futuristic", "Futuristic"],
  ["animals", "Animals"], ["fictional-animals", "Fictional Animals"], ["myths", "Myths"], ["comic", "Comic book art"],
  ["anime", "Anime"], ["food", "Food"], ["architecture", "Architecture"], ["space", "Space"],
  ["fantasy", "Fantasy"], ["vehicles", "Vehicles"], ["nature", "Nature"],
].map(([slug, label]) => ({ slug, label }));
export const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));
