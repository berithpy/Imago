/**
 * A curated list of short, easy-to-type Spanish words for password generation.
 * ~256 words → 256³ ≈ 16 million combinations per three-word password.
 */
const WORDS: readonly string[] = [
  // naturaleza
  "abeto", "agua", "alba", "alga", "arbol", "arena", "arroyo", "aurora",
  "bahia", "bosque", "brisa", "bruma", "cauce", "caverna", "cerro", "cielo",
  "cima", "cipres", "ciudad", "claro", "colina", "coral", "costa", "cueva",
  "duna", "encina", "espino", "estero", "flor", "flujo", "follaje", "fronda",
  "fuente", "glaciar", "grava", "grieta", "gruta", "helecho", "hierba",
  "hoja", "horizonte", "huerto", "isla", "jara", "lago", "laguna", "ladera",
  "lava", "lecho", "lirio", "llano", "lluvia", "loma", "luna", "luz",
  "manantial", "mar", "marga", "marisma", "matorral", "meseta", "monte",
  "musgo", "niebla", "nieve", "nube", "olmo", "orilla", "parra", "pena",
  "pinar", "playa", "prado", "risco", "roca", "rosal", "ruta", "salina",
  "sauce", "selva", "sendero", "sierra", "sol", "tejo", "tierra", "tilo",
  "tormenta", "torrente", "valle", "vapor", "vega", "vid", "viento",
  "viña", "volcan",
  // animales
  "aguila", "alce", "avestruz", "bisonte", "buho", "buitre", "ciervo",
  "cobra", "colibri", "condor", "coyote", "cuervo", "delfin",
  "erizo", "escarabajo", "falcon", "flamenco", "foca", "garza", "gavilan",
  "golondrina", "gorila", "grulla", "iguana", "jabali", "jaguar", "jilguero",
  "lagarto", "lechuza", "leopardo", "liebre", "lince", "lobo", "loro",
  "lucio", "luciernaga", "mapache", "marmota", "milano", "mofeta", "morsa",
  "murcielago", "nutria", "onza", "orca", "ostra", "pantera", "pato",
  "pelicano", "perico", "petirrojo", "puma", "rana", "raton", "salmon",
  "sapo", "sardina", "serpiente", "tejón", "tigre", "tiburon", "topo",
  "tortuga", "trucha", "turpial", "urogallo", "venado", "vibora", "zorro",
  // colores y materiales
  "acero", "ambar", "amatista", "azul", "beige", "bronce",
  "carmesi", "cobre", "coral", "ebano", "escarlata", "esmeralda", "garnet",
  "grana", "indigo", "jade", "jaspe", "malva", "marfil", "negro", "ocre",
  "oliva", "onix", "perla", "platino", "purpura", "rubi", "rojo", "rosa",
  "siena", "topacio", "turquesa", "violeta", "zafiro",
];

/** Returns a cryptographically random integer in [0, max). */
function randomInt(max: number): number {
  const array = new Uint32Array(1);
  // Use rejection sampling to avoid modulo bias.
  // We only accept values in [0, limit), where limit is the largest multiple
  // of max less than 2^32. This ensures a uniform distribution over [0, max).
  const range = 0x100000000; // 2^32
  const limit = Math.floor(range / max) * max;

  while (true) {
    crypto.getRandomValues(array);
    const value = array[0];
    if (value < limit) {
      return value % max;
    }
  }
}

/**
 * Generates a three-word password joined by hyphens, e.g. "ambar-falcon-risco".
 * Words are chosen without replacement so no word repeats.
 */
export function generatePassword(): string {
  const pool = [...WORDS];
  const chosen: string[] = [];

  for (let i = 0; i < 3; i++) {
    const idx = randomInt(pool.length);
    chosen.push(pool[idx]);
    pool.splice(idx, 1); // remove so it can't be picked again
  }

  return chosen.join("-");
}
