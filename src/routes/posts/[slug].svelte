<script context="module">
	import GhostContentAPI from '@tryghost/content-api'
	export async function load(ctx){
		const api = new GhostContentAPI({
            url: "https://testing-svelte.ghost.io",
            key: "23602dc86c8aeea22d4d64ef3a",
            version: "v3",
		})
        let slug = ctx.page.params.slug
		try {
			const post = await api.posts.read({slug},{formats: ['html']})
			return {props: {"post": post}}
		} catch(err) {
			console.log(err)
		}
	}
</script>

<script>
	export let post;
</script>

<div class="post-container">
	<h1>{post.title}</h1>
	{@html post.html}
</div>

<style lang="scss">
	.post-container {
		grid-column: 2/3;
	}

	.post-container{
		& :global(p){
			font-family: var(--openSans);
			font-size: calc(1rem + 1px);
			margin: 1rem 0;
			text-align: left;
		}

		& :global(h1){
			font-family: var(--garamond);
			font-size: 3rem;
		}

		& :global(figure){
			width: 100%;
		}

		& :global(img){
			width: 100%;
			// aspect-ratio: auto;
			height: auto;
		}
	}

</style>