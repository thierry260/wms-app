<script>
  import { X, TrashSimple, ArrowCounterClockwise } from "phosphor-svelte";
  import { writable } from "svelte/store";

  export let showFilters = false;
  export let data = [];
  export let filteredData = [];
  export let filters = [];
  export let sorting = [];

  let activeFilters = writable({}); // To store the active filters
  let selectedSortingKey = sorting.length > 0 ? sorting[0].key : null;
  let sortDirection = "asc"; // Default sorting direction

  // Close the filters panel
  const closeFilters = () => (showFilters = false);

  // Function to handle filter changes
  const handleFilterChange = (
    key,
    value,
    checked = null,
    type = null,
    operator = null
  ) => {
    activeFilters.update((currentFilters) => {
      if (type === "date") {
        // Date-based filter logic
        currentFilters[key] = { value, operator };
      } else if (checked !== null) {
        const existing = currentFilters[key] || [];
        currentFilters[key] = checked
          ? [...existing, value]
          : existing.filter((item) => item !== value);

        // If no items are selected, remove the key
        if (currentFilters[key].length === 0) {
          delete currentFilters[key];
        }
      } else {
        currentFilters[key] = value;
      }
      return currentFilters;
    });
  };

  // Function to clear all filters
  const clearFilters = (key = null) => {
    let localFilters = { ...$activeFilters }; // Clone the current activeFilters object

    if (key) {
      delete localFilters[key]; // Remove only the specified key
    } else {
      localFilters = {}; // Clear all filters if no key is provided
    }

    activeFilters.set(localFilters); // Use .set to update the store with the modified filters

    if (key) {
      // Uncheck only checkboxes associated with the specific key
      document
        .querySelectorAll(
          `.filters-container .filter-options[data-key="${key}"] input:checked`
        )
        .forEach((input) => (input.checked = false));
    } else {
      // Uncheck all checkboxes if no key is provided
      document
        .querySelectorAll(".filters-container input:checked")
        .forEach((input) => (input.checked = false));
    }
  };

  // Extract unique values for array-type filters (like assignees)
  const getUniqueArrayItems = (data, key) => {
    const allItems = data.flatMap((item) => item[key] || []);
    return [...new Set(allItems)];
  };

  // Extract unique values for non-array filters (for radio)
  const getUniqueItems = (data, key) => {
    const allItems = data.map((item) => item[key]).filter(Boolean);
    return [...new Set(allItems)];
  };

  // Function to compare two dates with the given operator
  const compareDates = (date1, date2, operator) => {
    // console.log("date1", date1);
    // console.log("date2", date2);
    switch (operator) {
      case "<":
        return date1 < date2;
      case "==":
        return date1.toDateString() === date2.toDateString();
      case ">":
        return date1 > date2;
      default:
        console.log(`Unknown operator ${operator}`);
        return false;
    }
  };

  // Function to sort data based on selected option and direction
  const sortData = (dataToSort) => {
    if (!selectedSortingKey) return dataToSort;

    const sortOption = sorting.find(
      (option) => option.key === selectedSortingKey
    );
    if (!sortOption) return dataToSort;

    console.log("sortOption", sortOption);
    return [...dataToSort].sort((a, b) => {
      let valueA = a[sortOption.key];
      let valueB = b[sortOption.key];

      if (sortOption.type === "date") {
        valueA = new Date(valueA.seconds * 1000);
        valueB = new Date(valueB.seconds * 1000);
      }

      if (sortOption.type === "custom") {
        valueA = sortOption.order[valueA];
        valueB = sortOption.order[valueB];
      }

      return (sortDirection === "asc" ? 1 : -1) * (valueA > valueB ? 1 : -1);
    });
  };

  // Filter and sort data when filters change
  $: {
    activeFilters.subscribe((filters) => {
      filteredData = data.filter((item) => filtersMatch(item, filters));
    });
  }

  // Sort filtered data when it changes
  $: {
    if (selectedSortingKey || sortDirection) {
      filteredData = sortData(filteredData);
    }
  }

  // Function to toggle sorting direction
  const toggleSortDirection = () => {
    sortDirection = sortDirection === "asc" ? "desc" : "asc";
  };

  // Function to check if item matches active filters
  const filtersMatch = (item, filters) => {
    for (const key in filters) {
      const filterValue = filters[key];
      if (typeof filterValue === "object" && filterValue.operator) {
        // Handle date comparison
        const itemDate = new Date(item[key].seconds * 1000);
        const currentDate = new Date();
        const comparisonDate = new Date(currentDate);
        comparisonDate.setDate(currentDate.getDate() + filterValue.value);

        // Set the time of both itemDate and comparisonDate to 00:00
        itemDate.setHours(0, 0, 0, 0);
        comparisonDate.setHours(0, 0, 0, 0);

        // console.log("itemDate", itemDate);
        // console.log("comparisonDate", comparisonDate);
        // console.log("item[key]", item[key]);
        // console.log("filterValue.value", filterValue.value);

        if (!compareDates(itemDate, comparisonDate, filterValue.operator)) {
          return false;
        }
      } else if (Array.isArray(filterValue)) {
        // Handle array filtering (e.g., assignees)
        if (!filterValue.some((v) => item[key]?.includes(v))) {
          return false;
        }
      } else if (item[key] !== filterValue) {
        return false;
      }
    }
    return true;
  };

  function getImageSrc(assignee) {
    if (assignee == "Anna") {
      assignee = "Placeholder";
    } else if (assignee == "") {
      assignee = "Toon";
    }
    // Convert assignee to lowercase and append .jpg
    const filename = `${assignee.toLowerCase()}.jpg`;
    return `/img/people/${filename}`; // Update with the correct path to your images
  }
</script>

<div class="filters-container {showFilters ? 'show' : ''}">
  <!-- Top section with title and close button -->
  <div class="filters-top">
    <div class="title">
      <h6>Filters</h6>
      {#if Object.keys($activeFilters).length > 0}
        <button class="basic clear" on:click={() => clearFilters()}
          ><ArrowCounterClockwise size={18} /></button
        >
      {/if}
    </div>
    <button class="basic" on:click={closeFilters}><X size={16} /></button>
  </div>

  <!-- Dynamically render filters based on the filters array -->
  <div class="filters-content">
    {#if sorting && sorting.length > 0}
      <!-- Sorting section -->
      <div class="sorting-section">
        <label class="legend" for="sorting-select">Sorteren op</label>
        <div class="sorting-select">
          <select id="sorting-select" bind:value={selectedSortingKey}>
            {#each sorting as sortOption}
              <option value={sortOption.key}>{sortOption.label}</option>
            {/each}
          </select>
          <button class="basic" on:click={toggleSortDirection}>
            {#if sortDirection === "asc"}
              ↑
            {:else}
              ↓
            {/if}
          </button>
        </div>
      </div>
    {/if}
    {#each filters as filter}
      <div class="filter-section">
        <span class="legend"
          >{filter.label}
          {#if $activeFilters[filter.key]}
            <button class="basic clear" on:click={clearFilters(filter.key)}
              ><TrashSimple size={14} /></button
            >
          {/if}</span
        >
        <div class="filter-options" data-key={filter.key}>
          {#if filter.type === "checkbox"}
            {#if filter.data && filter.data === "array"}
              {#each getUniqueArrayItems(data, filter.key) as option}
                <label>
                  <input
                    type="checkbox"
                    on:change={(e) =>
                      handleFilterChange(filter.key, option, e.target.checked)}
                  />
                  {#if filter.key === "assignees"}
                    <figure>
                      <img
                        src={getImageSrc(option)}
                        width="25px"
                        height="25px"
                      />
                    </figure>
                  {/if}
                  {option}
                </label>
              {/each}
            {:else}
              {#each getUniqueItems(data, filter.key) as option}
                <label>
                  <input
                    type="checkbox"
                    on:change={(e) =>
                      handleFilterChange(filter.key, option, e.target.checked)}
                  />
                  {#if filter.key === "assignees"}
                    <figure>
                      <img
                        src={getImageSrc(option)}
                        width="25px"
                        height="25px"
                      />
                    </figure>
                  {/if}
                  {option}
                </label>
              {/each}
            {/if}
          {/if}

          {#if filter.type === "radio"}
            {#if filter.options}
              {#each filter.options as option}
                <label>
                  <input
                    type="radio"
                    name={filter.key}
                    on:change={(e) => {
                      if (e.target.checked) {
                        handleFilterChange(
                          filter.key,
                          option.value,
                          null,
                          filter.data,
                          option.operator
                        );
                      }
                    }}
                  />
                  {option.label}
                </label>
              {/each}
            {:else if filter.data && filter.data === "array"}
              {#each getUniqueArrayItems(data, filter.key) as option}
                <label>
                  <input
                    type="radio"
                    name={filter.key}
                    on:change={(e) =>
                      handleFilterChange(filter.key, option, e.target.checked)}
                  />
                  {#if filter.key === "assignees"}
                    <figure>
                      <img
                        src={getImageSrc(option)}
                        width="25px"
                        height="25px"
                      />
                    </figure>
                  {/if}
                  {option}
                </label>
              {/each}
            {:else}
              {#each getUniqueItems(data, filter.key) as option}
                <label>
                  <input
                    type="radio"
                    name={filter.key}
                    on:change={(e) =>
                      handleFilterChange(filter.key, option, e.target.checked)}
                  />
                  {#if filter.key === "assignees"}
                    <figure>
                      <img
                        src={getImageSrc(option)}
                        width="25px"
                        height="25px"
                      />
                    </figure>
                  {/if}
                  {option}
                </label>
              {/each}
            {/if}
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- Bottom section with clear and show buttons -->
  <div class="filters-bottom">
    <button on:click={closeFilters}
      >{filteredData.length} resultaten bekijken</button
    >
  </div>
</div>

<style lang="scss">
  button.clear.clear {
    padding: 0;
    border: none;
    padding: 0;
  }
  .filters-container {
    position: fixed;
    --offset: 20px;
    top: var(--offset, 20px); /* Adjust the offset */
    right: var(--offset, 20px);
    bottom: var(--offset, 20px);
    width: calc(100% - var(--offset, 20px) * 2);
    max-width: 450px; /* Set the width of the off-canvas */
    background-color: white;
    border-radius: var(--border-radius);
    border: 1px solid var(--border);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateX(
      calc(100% + (var(--offset, 20px) * 2))
    ); /* Start hidden to the right */
    transition: transform 0.3s ease-out;
    z-index: 1000; /* Make sure it stays on top */

    display: flex;
    flex-direction: column;
    &.show {
      transform: translateX(0); /* Slide in when visible */
    }

    .filters-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      border-bottom: 1px solid var(--border);

      .title {
        display: flex;
        align-items: center;
        gap: 10px;
      }
    }

    .filters-content {
      padding: 20px;
      overflow-y: auto;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 15px;

      .legend {
        margin-bottom: 10px;
        text-transform: none;
        font-weight: 400;
        font-size: 1.3rem;

        display: flex;
        gap: 5px;
        align-items: center;
      }

      .sorting-section {
        .sorting-select {
          display: flex;
          gap: 10px;
          align-items: stretch;
          select {
            border-color: var(--border);
            font-size: 1.4rem;
          }
          button {
            min-width: 40px;
          }
        }
      }
      .filter-section {
        .filter-options {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          gap: 8px;
          label {
            padding: 8px 8px;
            border-radius: 5px;
            border: 1px solid transparent;
            display: flex;
            align-items: center;
            gap: 5px;
            background-color: #fff;
            font-size: 1.3rem;
            user-select: none;
            cursor: pointer;
            transition:
              border-color 0.2s ease-out,
              background-color 0.2s ease-out;

            &:hover {
              border-color: var(--border);
              background-color: var(--gray-100);
            }
            &:has(input:checked) {
              border-color: hsl(var(--primary-hs), 55%);
              background-color: hsl(var(--primary-hs), 96%);
            }

            &:has(img) {
              input[type="radio"],
              input[type="checkbox"] {
                display: none;
              }
            }

            input[type="radio"],
            input[type="checkbox"] {
              width: 16px;
              height: 16px;
              margin: 0;
              outline: none;
            }

            figure {
              margin: 0;
              border-radius: 50%;
              display: inline-flex;
              position: relative;

              &::before {
                content: "";
                position: absolute;
                border-radius: inherit;
                inset: -0.99px;
                background-color: rgba(5, 2, 41, 0.3);
                backdrop-filter: blur(1px);
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23ffffff' viewBox='0 0 256 256'%3E%3Cpath d='M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z'%3E%3C/path%3E%3C/svg%3E");
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23ffffff' viewBox='0 0 256 256'%3E%3Cpath d='M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z'%3E%3C/path%3E%3C/svg%3E");

                // background-color: $success;
                // background-color: hsl(120, 58%, 92%);
                // background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%234ccf4c' viewBox='0 0 256 256'%3E%3Cpath d='M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z'%3E%3C/path%3E%3C/svg%3E");

                background-repeat: no-repeat;
                background-size: 12px;
                background-position: center;
                opacity: 0;
                transition: opacity 0.1s ease-out;
              }
            }
            img {
              border-radius: inherit;
            }

            &:has(:checked) {
              figure::before {
                opacity: 1;
              }
            }
          }
        }
      }
    }

    .filters-bottom {
      display: grid;
      flex-wrap: wrap;
      justify-content: space-between;
      padding: 20px;
      border-top: 1px solid var(--border);
      gap: 15px;
      grid-template-columns: 1fr;
      @media (min-width: $xs) {
        // grid-template-columns: 1fr 1fr;
      }
      button {
        flex-grow: 1;
        width: 100%;
      }
    }
  }
</style>
