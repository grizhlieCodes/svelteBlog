import GhostContentAPI from "@tryghost/content-api";
import { element } from "svelte/internal";
import { writable } from 'svelte/store';

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const allArticles = writable([])

function loadRecentArticles() {
  const api = new GhostContentAPI({
    url: "https://testing-svelte.ghost.io",
    key: "23602dc86c8aeea22d4d64ef3a",
    version: "v3",
  });
  api.posts.browse({
    limit: 3,
    include: "tags, authors, created_at",
  })
    .then((posts) => {
      allArticles.update(articles => {
        return posts
      })
      cleanUpDate()
    })
    .catch((err) => {
      console.error(err);
    });
}

loadRecentArticles()

function loadFavoriteArticles() {
  const api = new GhostContentAPI({
    url: "https://testing-svelte.ghost.io",
    key: "23602dc86c8aeea22d4d64ef3a",
    version: "v3",
  });
  api.posts.browse({
    limit: 5,
    include: "tags, authors, created_at",
    filter: "tag: favorite"
  })
    .then((posts) => {
      allArticles.update(articles => {
        return posts
      })
      cleanUpDate()
    })
    .catch((err) => {
      console.error(err);
    });
}

function cleanUpDate() {
  allArticles.update(articles => {
    let updatedArticles = [...articles]
    updatedArticles.forEach(article => {
      let day = article.created_at.substring(8, 10)
      let month = monthNames[parseInt(article.created_at.substring(5, 7), 10) - 1].substring(0, 3)
      let year = article.created_at.substring(0, 4);

      article.created_at = `${day}, ${month}, ${year}`
    })
    return updatedArticles
  })
}

function clearAllArticles(){
  allArticles.update(articles => {
    return [];
  })
}

const customArticleStore = {
  subscribe: allArticles.subscribe,
  updateRecentArticles: loadRecentArticles,
  updateFavoriteArticles: loadFavoriteArticles,
  clearArticles: clearAllArticles
}

export default customArticleStore;