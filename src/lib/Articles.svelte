<script>
  import Badges from "$lib/Badges.svelte";
  import { fly } from "svelte/transition";
  import { createEventDispatcher } from "svelte";
  export let articles;
  const dispatch = createEventDispatcher();
  export let buttonSelection;
  export let loadingContent;

  import {getContext} from 'svelte';
  let globalSize = getContext('size')
  
  $: console.log($globalSize)
</script>
<div class="buttons">
  <button
    class:selected={buttonSelection == "recent"}
    on:click={() => dispatch('loader', "recent")}
    >Newest</button
  >
  <button
    on:click={() => dispatch('loader', "favourite")}
    class:selected={buttonSelection == "favourite"}>Start Here</button
  >
</div>

{#if !loadingContent}
     <ul>
       {#each articles as post, i}
         <li in:fly={{ duration: 250, x: -50 }} out:fly={{ duration: 250, x: -50 }}>
           <div class="flex-container">
             <p class="date">
               {post.created_at}
             </p>
             <a href="./posts/{post.slug}" class="title">{post.title}</a>
           </div>
           {#if buttonSelection == "favourite"}
             <Badges favBadge="true" />
           {:else}
             <Badges tags={post.tags} />
           {/if}
           <p class="excerpt">
             {post.excerpt}
             <a href="./posts/{post.slug}" class="read-more">read more</a>
           </p>
         </li>
       {/each}
     </ul>
{/if}

<style lang="scss">

    ul {
        width: 100%;
        max-width: 770px;
        grid-column: 2/3;
        margin: 0;
    }


  li {
    height: auto;
    text-decoration: none;
    list-style-type: none;
    display: flex;
    flex-flow: column nowrap;
    justify-content: space-around;
    align-items: center;
    margin-bottom: 3rem;

    a {
      text-decoration: none;
      font-size: 2rem;
    }
    a:hover,
    a:focus,
    a:active {
      text-decoration: none;
      color: inherit;
    }
  }
  .buttons {
    margin-bottom: 0;
    grid-column: 2/3;
    align-self: center;
  }
  button {
    background: transparent;
    outline: none;
    border: none;
    font-family: var(--garamond);
    font-size: 23px;
    font-weight: 700;
    margin: 0 20px;
    color: var(--disabled);
    transition: all 250ms ease;
    cursor: pointer;

    &:hover {
      color: var(--primary-200);
      text-decoration: underline;
    }
  }

  button.selected {
    color: var(--primary-200);
  }

  .flex-container {
    display: flex;
    flex-flow: column nowrap;
    justify-content: space-between;
    align-items: center;
  }

  .title {
    font-family: var(--garamond);
    font-size: clamp(35px, 20px + 4vw, 60px);
    color: var(--black);
    font-weight: 500;
    margin-bottom: 1.5rem;
  }

  p.date {
    color: var(--disabled);
    font-family: var(--garamond);
    font-size: 1rem;
    // margin-bottom: 15px;
  }

  p.excerpt {
    margin-top: 1rem;
    font-family: var(--openSans);
    color: #4d4d4d;
    font-size: 1rem;
  }

  a.read-more {
    font-size: 1rem;
    font-family: var(--openSans);
    color: var(--primary-300);
    font-weight: 600;

    &:hover {
      color: var(--primary-200);
    }
  }
</style>
