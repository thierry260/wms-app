<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import SidebarItem from "./SidebarItem.svelte";
  import {
    House,
    Gear,
    ArrowsInLineVertical,
    ArrowsOutLineVertical,
  } from "phosphor-svelte";
  import { getAuth, signOut } from "firebase/auth";
  import { goto } from "$app/navigation";
  import { templatesStore } from "$lib/stores/templates";
  import { fetchWorkspaceData } from "$lib/utils/get";
  import { createCategory } from "$lib/utils/create";

  let data = [];
  let currentId = "";
  let currentType;
  let isHomeActive = false;
  let isSettingsActive = false;
  let areAllOpen = false;

  $: {
    currentId = $page.params.id;
    currentType = $page.route.id.includes("template") ? "template" : "category";
    isHomeActive =
      $page.route.id === "" ||
      $page.route.id === "/" ||
      $page.route.id === "/(app)";
    isSettingsActive = $page.route.id.includes("/settings");
  }
  const expandParents = (item, currentId, currentType) => {
    if (currentType === "category" && item.id === currentId) {
      item.open = true;
      return true;
    }
    if (currentType === "template" && item.templates) {
      for (const template of item.templates) {
        if (template.id === currentId) {
          item.open = true;
          return true;
        }
      }
    }
    if (item.sub) {
      for (const subItem of item.sub) {
        if (expandParents(subItem, currentId, currentType)) {
          item.open = true;
          return true;
        }
      }
    }
    return false;
  };
  onMount(async () => {
    let fetchedData = await fetchWorkspaceData("categories");
    if (Array.isArray(fetchedData)) {
      data = fetchedData.map((category) => ({
        ...category,
        open: false, // Add open property to handle accordion state
      }));
      data.forEach((item) => expandParents(item, currentId, currentType));
      templatesStore.set(data); // Initialize the store with the data
      console.log(data);
    } else {
      console.log("Categories not found");
      data = []; // Ensure data is an empty array if fetch fails
    }
  });
  const toggleAll = () => {
    areAllOpen = !areAllOpen;
    data = data.map((category) => ({
      ...category,
      open: areAllOpen,
      sub: category.sub
        ? category.sub.map((sub) => ({ ...sub, open: areAllOpen }))
        : category.sub,
      templates: category.templates
        ? category.templates.map((template) => ({
            ...template,
            open: areAllOpen,
          }))
        : category.templates,
    }));
  };
  // Logout function
  const logout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      goto("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const addMainCat = async () => {
    try {
      const newCategoryName = prompt(
        "Geef een naam in voor de nieuwe categorie:",
      );

      if (newCategoryName && newCategoryName.trim() !== "") {
        const newCategory = await createCategory(false, newCategoryName.trim());

        if (newCategory) {
          console.log(`New category created successfully:`, newCategory);
          data = [...data, newCategory];
        } else {
          console.log("Failed to create the new category.");
        }
      } else {
        console.log("Category name cannot be empty.");
      }
    } catch (error) {
      console.error("Error creating category:", error);
    }
  };
</script>

<aside class="sidebar">
  <img class="logo" src="/img/MailGen-logo.svg" alt="MailGen logo" />
  <a class="menu_item" href="/" class:active={isHomeActive}>
    <House size={20} />Home
  </a>
  <a class="menu_item" href="/settings" class:active={isSettingsActive}>
    <Gear size={20} />Instellingen
  </a>
  <button class="logout-button" on:click={logout}>Uitloggen</button>
</aside>

<style lang="scss">
  .sidebar {
    width: 100%;
    max-width: 350px;
    background: linear-gradient(230deg, var(--primary), var(--secondary));
    height: 100%;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    .logo {
      max-width: 200px;
      margin-inline: auto;
      width: 100%;
      display: block;
      padding-block: 30px;
    }
    .label {
      color: #fff;
    }
    .templates {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      min-height: 1px;

      .label {
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: default; /* Default cursor for the label */
        padding: 10px;
        min-height: 44px;
        background-color: transparent;
        border-radius: 10px;
        width: 100%;
        text-align: left;
        transition: background-color 0.1s ease-out;
        color: #fff;
        text-decoration: none;

        button {
          font-size: 0.5rem;
          cursor: default; /* Default cursor for the label */
          background-color: transparent;
          border: none; /* Remove border */
          text-align: left;
          transition: background-color 0.1s ease-out;
          color: #fff;
        }

        .toggle-all-icon {
          flex-shrink: 0;
          cursor: pointer; /* Pointer cursor for the icon */
        }
      }
      .templates_items {
        overflow-y: auto;
        padding-right: 10px;
        margin-right: -10px;
        flex-grow: 1;

        /* ===== Scrollbar CSS ===== */
        scrollbar-width: auto;
        // scrollbar-color: #ebebeb #ffffff;

        /* Chrome, Edge, and Safari */
        &::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        &::-webkit-scrollbar-track {
          background: transparent;
        }

        &::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
          border: px solid transparent;
        }
      }
    }
    .menu_item {
      cursor: pointer;
      padding: 10px;
      min-height: 44px;
      background-color: transparent;
      border: 1px solid transparent;
      border-radius: 10px;
      font-size: 1.5rem;
      width: 100%;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 5px;
      transition:
        border-color 0.1s ease-out,
        background-color 0.1s ease-out;
      color: #fff;
      text-decoration: none;
      margin-bottom: 20px;
      &.active {
        background-color: rgba(
          0,
          0,
          0,
          0.2
        ); /* svelte-ignore unused-selector */
      }
      &:not(.active):hover {
        border-color: rgba(255, 255, 255, 0.6);
      }
    }
    .add_main_cat {
      margin-top: 10px;
      color: rgba(255, 255, 255, 0.7);
    }
    .logout-button {
      margin-top: auto;
      padding: 10px;
      background-color: transparent;
      border: 1px solid #ffffff77;
      border-radius: 10px;
      font-size: 1.6rem;
      color: #fff;
      cursor: pointer;
      transition: background-color 0.1s ease-out;
      &:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }
    }
  }
</style>
