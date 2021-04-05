<script>
  import articleStore from "../store/store.js";
  import Articles from "$lib/Articles.svelte";
  import Spinner from "$lib/LoadingSpinner.svelte";


  let loadingContent = true;
  let buttonSelection = "recent";

  function turnOffSpinnerAfterPageLoad(){
    setTimeout(() => {
      loadingContent = false
    }, 650)
  }

  turnOffSpinnerAfterPageLoad()

  function loadContent(event) {
    articleStore.clearArticles();
    loadingContent = true;

    setTimeout(() => {
      if (event.detail == "recent") {
        loadRecentArticles(event.detail);
      } else {
        loadFavoriteArticles(event.detail);
      }
      loadingContent = false;
    }, 600);
  }

  function loadRecentArticles(buttonSelected) {
    articleStore.updateRecentArticles();
    buttonSelection = buttonSelected;
  }
  function loadFavoriteArticles(buttonSelected) {
    articleStore.updateFavoriteArticles();
    buttonSelection = buttonSelected;
  }

  articleStore.updateRecentArticles()
  
</script>

{#if loadingContent}
  <Spinner />
{/if}
<Articles
  articles={$articleStore}
  on:loader={loadContent}
  {buttonSelection}
  {loadingContent}
/>
