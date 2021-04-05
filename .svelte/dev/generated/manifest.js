import * as layout from "..\\..\\..\\src\\routes\\$layout.svelte";

const components = [
	() => import("..\\..\\..\\src\\routes\\index.svelte"),
	() => import("..\\..\\..\\src\\routes\\mainSite.svelte"),
	() => import("..\\..\\..\\src\\routes\\contact.svelte"),
	() => import("..\\..\\..\\src\\routes\\about.svelte"),
	() => import("..\\..\\..\\src\\routes\\posts\\[slug].svelte")
];

const d = decodeURIComponent;
const empty = () => ({});

export const routes = [
	// src/routes/index.svelte
[/^\/$/, [components[0]]],

// src/routes/mainSite.svelte
[/^\/mainSite\/?$/, [components[1]]],

// src/routes/contact.svelte
[/^\/contact\/?$/, [components[2]]],

// src/routes/about.svelte
[/^\/about\/?$/, [components[3]]],

// src/routes/posts/[slug].svelte
[/^\/posts\/([^/]+?)\/?$/, [components[4]], (m) => ({ slug: d(m[1])})]
];

export { layout };