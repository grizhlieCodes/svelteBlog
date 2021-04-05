<script>
  export let favBadge = false;
  export let tags = [];
</script>

<div
  class="tag-container" class:tag={!favBadge}
>
{#if favBadge}
  <p>favourite!</p>
{:else}
  {#each tags as tag}
    <p class:tag={!favBadge}>{tag.name}</p>
  {/each}
{/if}
</div>

<style lang="scss">
  .tag-container {
    user-select: none;
    font-family: var(--garamond);
    width: 100%;
    height: 30px;
    display: flex;
    place-items: unset;
    flex-flow: row nowrap;
    justify-content: center;
    align-items: center;

    p {
      font-size: 22px;
      border-radius: 4px;
      color: white;
      position: relative;
      width: auto;
      padding: 0.2rem 0.7rem;
      background: var(--primary-200);
      margin: 0 0.5rem;
    }
  }
</style>
