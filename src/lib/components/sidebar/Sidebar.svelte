<script>
  import { user } from "$lib/stores/user";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { getAuth, signOut } from "firebase/auth";
  import {
    Timer,
    Folders,
    Users,
    DotsThree,
    X,
    SignOut,
    ListChecks,
    Layout,
    GearSix,
    CaretLeft,
  } from "phosphor-svelte";
  import { browser } from "$app/environment";

  $: currentUser = $user;

  let showMore = false;
  let isMobile = true;
  let isCompact = false;

  $: {
    if (typeof window !== "undefined") {
      isMobile = window.innerWidth < 992;
    }
  }

  // Check if the preference is saved in localStorage
  const checkSidebarState = () => {
    if (!browser) return;
    const storedState = localStorage.getItem("sidebarState");
    if (storedState) {
      isCompact = storedState === "compact";
    }
  };

  // Toggle sidebar between wide and compact mode
  const toggleSidebar = () => {
    isCompact = !isCompact;
    localStorage.setItem("sidebarState", isCompact ? "compact" : "wide");
  };

  const menuItems = [
    {
      label: "Dashboard",
      route: "/",
      icon: Layout,
    },
    {
      label: "Urenregistratie",
      mobile_label: "Uren",
      route: "/timetracking",
      icon: Timer,
    },
    {
      label: "Contacten",
      route: "/crm",
      icon: Users,
    },
    {
      label: "Dossiers",
      route: "/files",
      icon: Folders,
    },
    {
      label: "Taken",
      route: "/tasks",
      icon: ListChecks,
    },
    {
      label: "Instellingen",
      route: "/settings",
      icon: GearSix,
    },
    // Add additional items here
  ];

  const checkIsMobile = () => {
    if (typeof window !== "undefined") {
      isMobile = window.innerWidth < 992;
    }
  };

  onMount(() => {
    checkSidebarState();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", checkIsMobile);
    }
  });

  const logout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      localStorage.clear();
      goto("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const toggleMore = () => {
    showMore = !showMore;
  };

  // Function to get the image source
  function getImageSrc() {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (currentUser && currentUser.photoURL) {
      return currentUser.photoURL; // Return the user's profile picture URL
    } else {
      // Fallback to the placeholder image
      let userName = currentUser ? currentUser.displayName : "placeholder";
      if (!userName) {
        userName = "placeholder";
      }
      // Convert userName to lowercase and append .jpg
      const filename = `${userName.toLowerCase()}.jpg`;
      return `/img/people/${filename}`; // Update with the correct path to your images
    }
  }
</script>

<!-- Sidebar for Desktop -->
{#if !isMobile}
  <aside class="sidebar {isCompact ? 'compact' : 'wide'}">
    <img class="logo" src="/img/wms-logo.png" alt="WMS logo" />

    {#each menuItems as item}
      <a
        class="menu_item {item.route === $page.url.pathname ? 'active' : ''}"
        href={item.route}
        data-item={item.label}
      >
        <svelte:component this={item.icon} size={20} />
        {item.label}
      </a>
    {/each}
    <button class="logout-button" on:click={logout}>
      <div class="user">
        <figure class="avatar">
          <img
            width="40px"
            height="40px"
            src={getImageSrc(
              currentUser && currentUser.displayName
                ? currentUser.displayName.replace(/ .*/, "")
                : ""
            )}
          />
        </figure>
        <div class="info">
          {@html currentUser && currentUser.displayName
            ? `<strong>${currentUser.displayName}</strong>`
            : `<span>${currentUser && currentUser.email ? currentUser.email : ""}</span>`}
        </div>
      </div>
      <SignOut size={20} />
    </button>
    <span class="sidebar_toggle" on:click={toggleSidebar}>
      <div><CaretLeft size={14} /></div>
    </span>
  </aside>
{/if}

<!-- Bottom Navigation for Mobile -->
{#if isMobile}
  <nav class="sidebar-mobile">
    <div class="main_nav">
      <div class="main_nav_items">
        {#each menuItems.slice(0, 5) as item}
          <a
            class="nav_item {item.route === $page.url.pathname ? 'active' : ''}"
            href={item.route}
          >
            {#if item.route === $page.url.pathname}
              <svelte:component this={item.icon} size={18} weight="fill" />
            {:else}
              <svelte:component this={item.icon} size={18} />
            {/if}
            {item.mobile_label ? item.mobile_label : item.label}
          </a>
        {/each}
      </div>
      <div class="nav_item" on:click={toggleMore}>
        {#if showMore}
          <X size={20} />
        {:else}
          <DotsThree size={24} />
        {/if}
      </div>
    </div>
    {#if showMore}
      <div class="more-menu">
        <button class="logout-button" on:click={logout}
          ><SignOut size={18} />Uitloggen</button
        >
        {#each menuItems.slice(5) as item}
          <a
            class="more_item {item.route === $page.url.pathname
              ? 'active'
              : ''}"
            href={item.route}
          >
            {#if item.route === $page.url.pathname}
              <svelte:component this={item.icon} size={18} weight="fill" />
            {:else}
              <svelte:component this={item.icon} size={18} />
            {/if}
            {item.label}
          </a>
        {/each}
      </div>
    {/if}
  </nav>
{/if}

<style lang="scss">
  .sidebar {
    width: 100%;
    max-width: 320px;
    background: linear-gradient(230deg, var(--primary), var(--secondary));
    height: 100%;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    transition: max-width 0.25s ease-out;
    will-change: max-width;

    .logo {
      max-width: 140px;
      margin-inline: auto;
      width: 100%;
      display: block;
      padding-block: 30px;
      filter: brightness(0) invert(1);
      transition: padding 0.25s ease-out;
    }

    .label {
      color: #fff;
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
      gap: 8px;
      transition:
        border-color 0.1s ease-out,
        background-color 0.1s ease-out;
      color: #fff;
      text-decoration: none;
      margin-bottom: 20px;
      transition: font-size 0.25s ease-out;

      &.active {
        background-color: rgba(0, 0, 0, 0.2);
      }

      &:not(.active):hover {
        border-color: rgba(255, 255, 255, 0.6);
      }

      &[data-item="Instellingen"] {
        margin-top: auto;
        + .logout-button {
          margin-top: 15px;
        }
      }
    }

    .logout-button {
      margin-top: auto;
      padding: 10px 15px;
      background-image: none;
      background-color: transparent;
      border-radius: 10px;
      font-size: 1.6rem;
      color: #fff;
      cursor: pointer;
      border: 1px solid transparent;
      transition:
        border-color 0.2s ease-out,
        padding 0.25s ease-out;
      overflow: hidden;

      display: flex;
      justify-content: space-between;
      align-items: center;

      .user {
        display: flex;
        align-items: center;
        gap: 10px;

        figure {
          display: inline-flex;
          img {
            border-radius: 50%;
          }
        }
        .info {
          font-size: 1.4rem;
        }
      }

      &:hover {
        border-color: rgba(255, 255, 255, 0.2);
      }
    }

    .sidebar_toggle {
      display: flex;
      justify-content: center;
      align-items: center;
      position: absolute;
      // bottom: 33px;
      top: 85px;
      right: 0;
      transform: translateX(100%);
      outline-color: transparent;
      border-radius: 0 20px 20px 0;
      aspect-ratio: 1;
      width: 30px;
      height: 32px;
      border: 1px solid var(--border);
      border-left: 0;
      background-color: #fff;
      cursor: pointer;
      user-select: none;
      z-index: 1;
      transition:
        transform 0.2s ease-out 0.1s,
        background-color 0.3s ease-out;
      * {
        transition: transform 0.25s ease-out;
      }

      // &:hover {
      //   background-color: lighten($primary-color, 40%);
      //   background-color: lighten(adjust-hue($primary-color, -1), 33.73);
      //   background-color: $background;
      // }
    }

    &.compact {
      max-width: 74px; // Adjust based on your design
      padding: 15px;

      img.logo {
        padding-block: 20px 50px;
      }

      .menu_item {
        font-size: 0;
        gap: 0;
      }
      .sidebar_toggle {
        * {
          transform: rotate(180deg);
        }
      }
      .logout-button {
        padding: 0;
      }
    }
  }

  .sidebar-mobile {
    display: flex;
    justify-content: space-between;
    flex-direction: column-reverse;
    padding: 10px 25px;
    background: linear-gradient(230deg, var(--primary), var(--secondary));
    position: fixed;
    z-index: 1000;

    bottom: 20px;
    /* margin-inline: auto; */
    transform: translateX(-50%);
    left: 50%;
    border-radius: 30px;
    gap: 20px;
    align-items: center;

    left: 0;
    right: 0;
    transform: none;
    border-radius: 0;
    bottom: 0;
    align-items: stretch;
    padding: 10px;

    .main_nav {
      display: flex;
      justify-content: center;
      gap: 6px;

      justify-content: space-between;
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      grid-template-columns: 1fr 1fr 1fr 1fr 1fr min-content;
    }

    .main_nav_items {
      display: contents;
    }

    .nav_item {
      color: #fff;
      text-decoration: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      transition: color 0.1s ease-out;

      color: #fff;
      opacity: 0.5;
      display: flex;
      align-items: center;
      gap: 6px;
      border-radius: 5px;
      border: 1px solid rgba(0, 0, 0, 0);
      padding: 5px 15px;
      // height: 46px;
      transition:
        background-color 0.2s ease-out,
        border-color 0.2s ease-out,
        padding 0.2s ease-out;
      font-size: 1rem;
      overflow: hidden;

      padding: 5px;
      // height: 38px;
      // width: 38px;
      display: flex;
      justify-content: center;
      align-items: center;

      &.active {
        // background-color: rgba(255, 255, 255, 0.2);
        opacity: 1;
      }

      // &:hover:not(.active) {
      //   cursor: pointer;
      //   border-color: rgba(255, 255, 255, 0.2);
      // }
    }

    .more-menu {
      padding: 10px;

      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 20px;

      .logout-button {
        font-size: 1.4rem;
        font-family: var(--body);
        font-weight: 400;
        background: transparent;
        padding: 5px 0;
        gap: 10px;
      }

      .more_item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 0;
        color: #fff;
        text-decoration: none;
        font-size: 1.4rem;
      }
    }
  }
</style>
