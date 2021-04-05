import { ssr } from '@sveltejs/kit/ssr';
import root from './generated/root.svelte';
import { set_paths } from './runtime/paths.js';
import * as user_hooks from "./hooks.js";

const template = ({ head, body }) => "<!DOCTYPE html>\n<html lang=\"en\">\n\t<head>\n\t\t<meta charset=\"utf-8\" />\n\t\t<link rel=\"icon\" href=\"/favicon.ico\" />\n\t\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n\t\t" + head + "\n\t</head>\n\t<body>\n\t\t<div id=\"svelte\" style=\"position: relative; height: 100%;\" >" + body + "</div>\n\t</body>\n</html>\n";

set_paths({"base":"","assets":"/."});

// allow paths to be overridden in svelte-kit start
export function init({ paths }) {
	set_paths(paths);
}

const d = decodeURIComponent;
const empty = () => ({});

const components = [
	() => import("..\\..\\src\\routes\\index.svelte"),
	() => import("..\\..\\src\\routes\\mainSite.svelte"),
	() => import("..\\..\\src\\routes\\contact.svelte"),
	() => import("..\\..\\src\\routes\\about.svelte"),
	() => import("..\\..\\src\\routes\\posts\\[slug].svelte")
];



const client_component_lookup = {".svelte/build/runtime/internal/start.js":"start-06962a62.js","src/routes/index.svelte":"pages\\index.svelte-750cdb38.js","src/routes/mainSite.svelte":"pages\\mainSite.svelte-4ec1a767.js","src/routes/contact.svelte":"pages\\contact.svelte-1cd4b86e.js","src/routes/about.svelte":"pages\\about.svelte-effcaed0.js","src/routes/posts/[slug].svelte":"pages\\posts\\[slug].svelte-bbbe1be7.js"};

const manifest = {
	assets: [{"file":"favicon.ico","size":1150,"type":"image/vnd.microsoft.icon"},{"file":"robots.txt","size":67,"type":"text/plain"}],
	layout: () => import("..\\..\\src\\routes\\$layout.svelte"),
	error: () => import("./components\\error.svelte"),
	routes: [
		{
						type: 'page',
						pattern: /^\/$/,
						params: empty,
						parts: [{ id: "src/routes/index.svelte", load: components[0] }],
						css: ["assets/start-7e5f45fa.css", "assets/pages\\index.svelte-aa263bb9.css"],
						js: ["start-06962a62.js", "chunks/index-61bdb035.js", "chunks/index-5f559568.js", "pages\\index.svelte-750cdb38.js", "chunks/content-api-d1f47f42.js"]
					},
		{
						type: 'page',
						pattern: /^\/mainSite\/?$/,
						params: empty,
						parts: [{ id: "src/routes/mainSite.svelte", load: components[1] }],
						css: ["assets/start-7e5f45fa.css"],
						js: ["start-06962a62.js", "chunks/index-61bdb035.js", "chunks/index-5f559568.js", "pages\\mainSite.svelte-4ec1a767.js"]
					},
		{
						type: 'page',
						pattern: /^\/contact\/?$/,
						params: empty,
						parts: [{ id: "src/routes/contact.svelte", load: components[2] }],
						css: ["assets/start-7e5f45fa.css"],
						js: ["start-06962a62.js", "chunks/index-61bdb035.js", "chunks/index-5f559568.js", "pages\\contact.svelte-1cd4b86e.js"]
					},
		{
						type: 'page',
						pattern: /^\/about\/?$/,
						params: empty,
						parts: [{ id: "src/routes/about.svelte", load: components[3] }],
						css: ["assets/start-7e5f45fa.css"],
						js: ["start-06962a62.js", "chunks/index-61bdb035.js", "chunks/index-5f559568.js", "pages\\about.svelte-effcaed0.js"]
					},
		{
						type: 'page',
						pattern: /^\/posts\/([^/]+?)\/?$/,
						params: (m) => ({ slug: d(m[1])}),
						parts: [{ id: "src/routes/posts/[slug].svelte", load: components[4] }],
						css: ["assets/start-7e5f45fa.css", "assets/pages\\posts\\[slug].svelte-4c5b6620.css"],
						js: ["start-06962a62.js", "chunks/index-61bdb035.js", "chunks/index-5f559568.js", "pages\\posts\\[slug].svelte-bbbe1be7.js", "chunks/content-api-d1f47f42.js"]
					}
	]
};

const get_hooks = hooks => ({
	getContext: hooks.getContext || (() => ({})),
	getSession: hooks.getSession || (() => ({})),
	handle: hooks.handle || ((request, render) => render(request))
});

const hooks = get_hooks(user_hooks);

export function render(request, {
	paths = {"base":"","assets":"/."},
	local = false,
	only_render_prerenderable_pages = false,
	get_static_file
} = {}) {
	return ssr({
		...request,
		host: request.headers["host"]
	}, {
		paths,
		local,
		template,
		manifest,
		target: "#svelte",
		entry: "/./_app/start-06962a62.js",
		root,
		hooks,
		dev: false,
		amp: false,
		only_render_prerenderable_pages,
		app_dir: "_app",
		get_component_path: id => "/./_app/" + client_component_lookup[id],
		get_stack: error => error.stack,
		get_static_file,
		get_amp_css: dep => amp_css_lookup[dep],
		ssr: true,
		router: true,
		hydrate: true
	});
}