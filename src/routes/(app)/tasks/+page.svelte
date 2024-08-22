<script>
  import { db } from "$lib/firebase";
  import { onMount, tick } from "svelte";
  import Sortable from "sortablejs";
  import { writable, get } from "svelte/store";
  import Select from "svelte-select"; // Import svelte-select
  import { format } from "date-fns";
  import {
    collection,
    getDocs,
    doc,
    setDoc,
    getDoc,
    addDoc,
    updateDoc,
    arrayUnion,
    Timestamp,
    query,
    where,
    deleteDoc,
    writeBatch,
  } from "firebase/firestore";
  import {
    Clock,
    TrashSimple,
    PencilSimple,
    X,
    DotsSixVertical,
    ExclamationMark,
    ArrowDown,
    Funnel,
  } from "phosphor-svelte";

  let taskStatuses = writable([]);
  let tasks = writable({});
  let currentTask = writable({
    id: undefined,
    title: "",
    description: "",
    assignees: [],
    file_id: "",
    priority: "Medium",
    status: "",
    status_id: "",
    deadline: "",
  });
  let newStatusName = writable("");
  let modal;
  let assignees = writable([]);
  let files = writable([]);

  let allTasks = [];
  let sortOrder = writable("asc");
  let sortType = writable("deadline");
  let filters = writable({
    assignees: [],
  });

  let isDragging = false;
  let startX;
  let scrollLeft;

  let searchQuery = writable(""); // New writable store for search query
  $: searchQuery, filterAndSortTasks();
  $: if (typeof $searchQuery !== "string") {
    console.error("searchQuery is not a string!", $searchQuery);
  }

  let filtersVisible = writable(false);

  function toggleFilters() {
    filtersVisible.update((visible) => !visible);
  }

  onMount(async () => {
    // Fetch assignees (Example: hardcoded, adjust based on your structure)
    assignees.set(["Michel", "Mike", "Toon", "Thierry"]);

    // Fetch files
    const filesRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "files"
    );
    const fileSnapshots = await getDocs(filesRef);
    files.set(
      fileSnapshots.docs
        .filter((doc) => doc.id !== "0000")
        .map((doc) => ({
          id: doc.id,
          label: `${doc.id} - ${doc.data().name}`,
        }))
    );

    // Fetch task statuses
    await fetchTaskStatuses();
    await fetchTasks();
    allTasks = get(tasks);
    console.log(allTasks);
    sortAndFilterTasks(get(sortOrder));
    setupSortable();
  });

  async function fetchTasks() {
    const statuses = await fetchTaskStatuses();
    const tasksRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "tasks"
    );
    const taskSnapshots = await getDocs(tasksRef);

    const tasksArray = []; // Use an array instead of an object
    const fileRefs = new Map();

    // Process tasks and collect file references
    taskSnapshots.docs.forEach((doc) => {
      const taskData = { id: doc.id, ...doc.data() };
      taskData.assignees =
        taskData.assignees && taskData.assignees.length > 0
          ? taskData.assignees
          : ["placeholder"];

      // Push each task to the tasksArray
      tasksArray.push(taskData);

      const fileId = String(taskData.file_id); // Ensure it's a string

      // Collect file references
      if (fileId) {
        fileRefs.set(fileId, doc.id); // Use task ID as a placeholder for file reference
      }
    });

    // Fetch file data
    const fileDocs = await Promise.all(
      Array.from(fileRefs.keys()).map((fileId) =>
        getDoc(
          doc(
            db,
            "workspaces",
            localStorage.getItem("workspace"),
            "files",
            fileId
          )
        )
      )
    );

    // Map file data to file IDs
    const fileDataMap = new Map();
    fileDocs.forEach((fileDoc) => {
      if (fileDoc.exists()) {
        fileDataMap.set(fileDoc.id, fileDoc.data());
      }
    });

    // Combine task and file data
    tasksArray.forEach((task) => {
      task.fileData = fileDataMap.get(task.file_id) || null;
    });

    // Set the tasks store to the array
    tasks.set(tasksArray);
  }

  function sortAndFilterTasks(tasksArray, type, order) {
    // Ensure tasksArray is an array
    let filteredTasks = Array.isArray(tasksArray) ? tasksArray : [];

    // Apply filtering
    const activeFilters = get(filters);

    if (activeFilters.assignees.length > 0) {
      filteredTasks = filteredTasks.filter((task) => {
        // Normalize the task assignees to lowercase
        const taskAssignees = task.assignees.map((a) => a.toLowerCase());

        // Check if task includes at least one of the selected assignees
        const matchesAnyAssignee = activeFilters.assignees.some(
          (filterAssignee) =>
            taskAssignees.includes(filterAssignee.toLowerCase())
        );

        // Return true if it matches any assignee
        return matchesAnyAssignee;
      });
    }

    // Apply sorting
    return filteredTasks.sort((a, b) => {
      let aValue, bValue;

      if (type === "deadline") {
        aValue = a.deadline ? a.deadline.toDate() : new Date(0);
        bValue = b.deadline ? b.deadline.toDate() : new Date(0);
      } else if (type === "priority") {
        const priorityOrder = { Low: 1, Medium: 2, High: 3 };
        aValue = priorityOrder[a.priority] || 0;
        bValue = priorityOrder[b.priority] || 0;
      }

      if (order === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }

  async function fetchTaskStatuses() {
    const workspaceRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace")
    );
    const workspaceSnap = await getDoc(workspaceRef);
    const workspaceData = workspaceSnap.data();

    // Assumes statuses are stored in a field named "taskStatuses" which is an array
    const statuses = workspaceData.taskStatuses || [];
    taskStatuses.set(statuses);
    return statuses;
  }

  async function updateTaskStatus(taskId, newStatusId) {
    const taskRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "tasks",
      taskId
    );
    await setDoc(taskRef, { status_id: newStatusId }, { merge: true });
  }

  async function updateTaskStatusName(statusId, newName) {
    const workspaceRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace")
    );
    const workspaceSnap = await getDoc(workspaceRef);
    const workspaceData = workspaceSnap.data();
    const updatedStatuses = workspaceData.taskStatuses.map((status) =>
      status.id === statusId ? { ...status, name: newName } : status
    );
    await updateDoc(workspaceRef, { taskStatuses: updatedStatuses });
  }

  async function deleteTaskStatus(statusId) {
    const tasksRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "tasks"
    );
    const q = query(tasksRef, where("status_id", "==", statusId));
    const taskSnapshots = await getDocs(q);

    let confirmMessage = "Weet je zeker dat je deze status wilt verwijderen?";
    if (taskSnapshots.size > 0) {
      confirmMessage +=
        "\nAlle taken met deze status zullen ook worden verwijderd.";
    }

    if (confirm(confirmMessage)) {
      const workspaceRef = doc(
        db,
        "workspaces",
        localStorage.getItem("workspace")
      );
      const workspaceSnap = await getDoc(workspaceRef);
      const workspaceData = workspaceSnap.data();
      const updatedStatuses = workspaceData.taskStatuses.filter(
        (status) => status.id !== statusId
      );

      if (taskSnapshots.size > 0) {
        const batch = writeBatch(db);
        taskSnapshots.forEach((docSnapshot) => {
          batch.delete(docSnapshot.ref);
        });
        await batch.commit(); // Commit the batch operation
      }

      await updateDoc(workspaceRef, { taskStatuses: updatedStatuses });
      // Note: Deleting the status doc in 'tasks' subcollection is not needed
      // if task status is stored in the main 'workspaces' collection as part of workspace data
      taskStatuses.set(updatedStatuses);
    }
  }
  function handleEditClick(event) {
    const target = event.currentTarget
      .closest(".kanban-column-header")
      .querySelector("h3");
    target.focus();

    // Move the cursor to the end of the content inside the h3 element
    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(target);
    range.collapse(false); // Collapse the range to the end
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function handleKeyDown() {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent newline character in contentEditable
      const target = event.currentTarget;
      const statusId = target.closest(".kanban-column").dataset.id;
      const newName = target.innerText;

      updateTaskStatusName(statusId, newName);
    }
  }

  function handleBlur(event) {
    const target = event.currentTarget;
    const statusId = target.closest(".kanban-column").dataset.id;
    const newName = target.innerText;

    updateTaskStatusName(statusId, newName);
  }

  function isMobileViewport() {
    return window.innerWidth < 768;
  }

  function setupSortable() {
    // Set up task sorting within columns
    taskStatuses.subscribe((statuses) => {
      document
        .querySelectorAll(".kanban-column-content")
        .forEach((taskColumn) => {
          // Configuration object for Sortable
          const sortableConfig = {
            group: "taskColumnTasks",
            sort: false,
            animation: 250,
            onEnd: async function (evt) {
              const itemEl = evt.item;
              const oldStatusId = evt.from.closest(".kanban-column").dataset.id;
              const newStatusId = evt.to.closest(".kanban-column").dataset.id;
              const taskId = itemEl.dataset.id;

              if (oldStatusId !== newStatusId) {
                await updateTaskStatus(taskId, newStatusId);
              }
            },
          };

          // Add the handle option only for mobile viewports
          if (isMobileViewport()) {
            sortableConfig.handle = ".drag-handle";
          }

          // Initialize Sortable with the conditional configuration
          Sortable.create(taskColumn, sortableConfig);
        });

      // Set up column sorting
      Sortable.create(document.querySelector(".kanban-board"), {
        group: "taskColumn",
        // filter: ".kanban-column-content",
        handle: ".drag-column",
        animation: 250,
        onEnd: async function (evt) {
          const newOrder = Array.from(evt.from.children)
            .map((child) => child.dataset.id)
            .filter((id) => id); // Filters out null, undefined, and empty strings

          const workspaceRef = doc(
            db,
            "workspaces",
            localStorage.getItem("workspace")
          );
          const workspaceSnap = await getDoc(workspaceRef);
          const workspaceData = workspaceSnap.data();

          // Update column order in the workspace document
          await updateDoc(workspaceRef, {
            taskStatuses: newOrder.map((id) =>
              workspaceData.taskStatuses.find((status) => status.id === id)
            ),
          });
        },
      });
    });
  }

  function openModal(task, statusId) {
    if (task) {
      currentTask.set({
        ...task,
        deadline: task.deadline
          ? format(task.deadline.toDate(), "yyyy-MM-dd")
          : "", // Convert and format the date
      });
    } else {
      currentTask.update((n) => ({
        ...n,
        id: undefined,
        title: "",
        description: "",
        assignees: [],
        file_id: "",
        priority: "Medium",
        status_id: statusId, // Set the status ID here
        deadline: "",
      }));
    }

    modal.showModal();
  }

  function closeModal() {
    modal.close();
  }

  // Ensure `updated_at` is saved every time
  async function saveTask() {
    const taskData = get(currentTask);

    // Convert taskData.assignees to a plain array if needed
    if (taskData.assignees) {
      taskData.assignees = taskData.assignees.map((item) =>
        typeof item === "object" && item !== null && "value" in item
          ? item.value
          : item
      );
    }

    if (taskData.deadline) {
      taskData.deadline = Timestamp.fromDate(new Date(taskData.deadline));
    }

    if (taskData.id) {
      // Update existing task
      const taskRef = doc(
        db,
        "workspaces",
        localStorage.getItem("workspace"),
        "tasks",
        taskData.id
      );
      await updateDoc(taskRef, {
        ...taskData,
        updated_at: Timestamp.now(), // Ensure updated_at is set when updating
      });
      await fetchTasks(); // Refresh tasks to show the new task
      closeModal();
    } else {
      // Add new task
      delete taskData.id;
      try {
        const tasksRef = collection(
          db,
          "workspaces",
          localStorage.getItem("workspace"),
          "tasks"
        );
        await addDoc(tasksRef, {
          ...taskData,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(), // Ensure updated_at is set when saving
        });
        await fetchTasks(); // Refresh tasks to show the new task
        closeModal();
      } catch (error) {
        console.error("Error adding task: ", error);
      }
    }
  }

  async function deleteTask() {
    if (!confirm("Weet je zeker dat je deze taak wilt verwijderen?")) {
      return;
    }

    const taskData = get(currentTask);

    if (taskData.id) {
      try {
        // Reference to the specific task document to be deleted
        const taskRef = doc(
          db,
          "workspaces",
          localStorage.getItem("workspace"),
          "tasks",
          taskData.id
        );

        // Delete the document
        await deleteDoc(taskRef);

        // Optionally, refresh the task list to reflect the deletion
        await fetchTasks();
        closeModal();
      } catch (error) {
        console.error("Error deleting task: ", error);
      }
    } else {
      console.error("No task ID provided, cannot delete task.");
    }
  }

  // Utility functions
  function formatDate(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  function getDeadlineStatus(deadline) {
    if (!deadline) return "";
    const now = new Date();
    const deadlineDate = deadline.toDate();
    deadlineDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    if (now > deadlineDate) return "overdue";
    if (now.getTime() === deadlineDate.getTime()) return "today";
    return "";
  }

  async function addNewStatus() {
    const statusName = get(newStatusName).trim();
    if (!statusName) return; // Exit if the input is empty

    const newStatusId = doc(collection(db, "dummy")).id; // Generate a new unique ID
    const workspaceRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace")
    );
    const newStatus = { id: newStatusId, name: statusName };

    try {
      // Update Firestore with the new status
      await updateDoc(workspaceRef, {
        taskStatuses: arrayUnion(newStatus),
      });

      // Refresh the task statuses
      await fetchTaskStatuses();
      newStatusName.set(""); // Reset the input field
    } catch (error) {
      console.error("Error adding new status:", error);
    }
  }

  // Function to get the image source
  function getImageSrc(assignee) {
    // Convert assignee to lowercase and append .jpg
    const filename = `${assignee.toLowerCase()}.jpg`;
    return `/img/people/${filename}`; // Update with the correct path to your images
  }

  function handleMouseDown(event) {
    // Only start dragging if the mouse is pressed down directly on the board container
    if (event.target === event.currentTarget) {
      isDragging = true;
      startX = event.pageX - event.currentTarget.offsetLeft;
      scrollLeft = event.currentTarget.scrollLeft;
      event.currentTarget.style.cursor = "grabbing";
    }
  }

  function handleMouseUp(event) {
    isDragging = false;
    event.currentTarget.style.cursor = "grab";
  }

  function handleMouseMove(event) {
    if (!isDragging) return;
    const x = event.pageX - event.currentTarget.offsetLeft;
    const walk = (x - startX) * 3; // Scroll speed multiplier
    event.currentTarget.scrollLeft = scrollLeft - walk;
  }

  function handleSearchInput(event) {
    const inputValue = event.target.value || ""; // Ensure it's a string
    searchQuery.set(inputValue.toLowerCase().trim()); // Set the search query as a lowercase string
    filterAndSortTasks(); // Trigger the filtering and sorting logic
  }

  function filterAndSortTasks() {
    const query = get(searchQuery).toLowerCase();

    const filteredTasks = allTasks.filter((task) => {
      // Normalize task fields and search query for case-insensitive comparison
      const taskTitle = task.title.toLowerCase();
      const taskDescription = task.description?.toLowerCase() || "";
      const taskAssignees = task.assignees
        .map((assignee) => assignee.toLowerCase())
        .join(" ");
      const taskDossierNumber = task.file_id?.id || "geen dossier";
      const taskDossierLabel =
        task.file_id?.label?.toLowerCase() || "geen dossier";
      const taskFile = task.fileData?.name?.toLowerCase() || "";

      console.log("Task Title:", taskTitle);
      console.log("Task Description:", taskDescription);
      console.log("Task Assignees:", taskAssignees);
      console.log("Task Dossier Number:", taskDossierNumber);
      console.log("Task Dossier Label:", taskDossierLabel);
      console.log("Task File:", taskFile);
      console.log("Query:", query);

      // Check if the task matches the search query
      return (
        taskTitle.includes(query) ||
        taskDescription.includes(query) ||
        taskAssignees.includes(query) ||
        taskFile.includes(query) ||
        taskDossierNumber.includes(query) ||
        taskDossierLabel.includes(query)
      );
    });

    // Apply sorting to the filtered tasks
    const sortedTasks = sortAndFilterTasks(
      filteredTasks,
      get(sortType),
      get(sortOrder)
    );
    tasks.set(sortedTasks);
  }

  $: console.log("$currentTask.assignees: ", $currentTask.assignees);
</script>

<div class="filter-sort-controls">
  <!-- Button to toggle filters on mobile -->
  <button class="filter-toggle basic" on:click={toggleFilters}>
    {#if $filtersVisible}
      <X size={16} />
    {:else}
      <Funnel size={16} />
    {/if}
    Filters
  </button>

  <!-- Container for the filters -->
  <div class="filters-container" class:visible={$filtersVisible}>
    <div class="assignee-filters">
      {#each $assignees as assignee}
        <label>
          <input
            type="checkbox"
            value={assignee}
            name="[]"
            on:change={async (e) => {
              filters.update((f) => {
                let updatedFilters;
                if (e.target.checked) {
                  // Add assignee to the filters
                  updatedFilters = {
                    ...f,
                    assignees: [...f.assignees, assignee],
                  };
                } else {
                  // Remove assignee from the filters
                  updatedFilters = {
                    ...f,
                    assignees: f.assignees.filter((a) => a !== assignee),
                  };
                }
                return updatedFilters;
              });

              // Wait for the state to update before sorting and filtering
              await tick();

              // Always start from the full list of tasks
              const filteredAndSortedTasks =
                get(filters).assignees.length === 0
                  ? allTasks // Show all tasks if no filters are selected
                  : sortAndFilterTasks(allTasks, get(sortType), get(sortOrder));

              tasks.set(filteredAndSortedTasks);
            }}
          />
          <figure>
            <img
              src="/img/people/{assignee.toLowerCase()}.jpg"
              width="25px"
              height="25px"
            />
          </figure>
          {assignee}
        </label>
      {/each}
    </div>

    <div class="sorting">
      <label for="sortTypeDropdown">Sorteer op:</label>
      <select
        id="sortTypeDropdown"
        on:change={(e) => {
          sortType.set(e.target.value);
          sortAndFilterTasks($tasks, e.target.value, $sortOrder);
        }}
      >
        <option value="deadline" selected>Deadline</option>
        <option value="priority">Prioriteit</option>
      </select>
      <button
        class="basic sort-order-toggle"
        on:click={() => {
          const newOrder = $sortOrder === "asc" ? "desc" : "asc";
          sortOrder.set(newOrder); // Update the sortOrder store
          sortAndFilterTasks($tasks, $sortType, $sortOrder);
        }}
      >
        {#if $sortOrder === "asc"}
          ↑
        {:else}
          ↓
        {/if}
      </button>
    </div>

    <div class="task-search">
      <input
        type="text"
        class="search"
        placeholder="Zoek taken..."
        on:input={handleSearchInput}
      />
    </div>
  </div>
</div>
<div
  class="kanban-board"
  on:mousedown={handleMouseDown}
  on:mouseup={handleMouseUp}
  on:mousemove={handleMouseMove}
>
  {#if $taskStatuses.length > 0}
    {#each $taskStatuses as status (status.id)}
      <div class="kanban-column" data-id={status.id} data-name={status.name}>
        <div class="kanban-column-header">
          <div class="drag-column"><DotsSixVertical size="18" /></div>
          <h3
            on:keydown={handleKeyDown}
            on:blur={handleBlur}
            contenteditable="true"
          >
            {status.name}
          </h3>
          <div on:click={handleEditClick}><PencilSimple size={16} /></div>
          <div on:click={() => deleteTaskStatus(status.id)}>
            <TrashSimple size={16} />
          </div>
        </div>
        <ul
          id={status.id}
          class="kanban-column-content"
          data-status={status.id}
        >
          {#if Array.isArray($tasks)}
            {#each sortAndFilterTasks( $tasks.filter((task) => task.status_id === status.id), $sortType, $sortOrder ) as task (task.id)}
              <li
                class="kanban-task {getDeadlineStatus(task.deadline)}"
                data-id={task.id}
                data-priority={task.priority}
                on:click={() => openModal(task)}
              >
                <div class="drag-handle"><DotsSixVertical size="16" /></div>
                <div class="main">
                  <div class="top">
                    <div class="text">
                      <h4>{task.title}</h4>
                      <span class="subtitle"
                        >{task.file_id
                          ? task.file_id.label
                          : "Geen dossier"}</span
                      >
                    </div>
                    <div class="assignees">
                      {#each task.assignees as assignee}
                        <img
                          width="30px"
                          height="30px"
                          src={getImageSrc(assignee)}
                          alt="{assignee} profielfoto"
                          on:error={() => (src = "/img/people/placeholder.jpg")}
                        />
                      {/each}
                    </div>
                  </div>
                  <div class="bottom">
                    {#if task.deadline}
                      <div class="task-deadline">
                        <Clock size="18" />{formatDate(task.deadline)}
                      </div>
                    {/if}
                    {#if task.priority}
                      <div class="priority" data-priority={task.priority}>
                        {#if task.priority == "High"}
                          <ExclamationMark size={16} weight="bold" />
                        {/if}
                        {#if task.priority == "Low"}
                          <ArrowDown size={16} />
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              </li>
            {/each}
          {/if}
        </ul>
        <button
          class="kanban-task-add basic"
          data-status={status.id}
          on:click={() => openModal(null, status.id)}
        >
          + Taak toevoegen
        </button>
      </div>
    {/each}

    <div
      class="kanban-column new-column-placeholder"
      on:click={() => {
        document.querySelector(".new-column-placeholder input").focus();
      }}
    >
      <input
        bind:value={$newStatusName}
        placeholder="+ Nieuwe status toevoegen"
        on:keydown={(e) => e.key === "Enter" && addNewStatus()}
        on:blur={addNewStatus}
        on:click={(e) => e.stopPropagation()}
      />
    </div>
  {/if}
</div>

<dialog bind:this={modal} class="task-modal">
  {#if $currentTask.id}
    <div class="top">
      <h6>Taak bewerken</h6>
      <button class="basic" on:click={closeModal}><X size="16" /></button>
    </div>
  {:else}
    <h6>Taak toevoegen</h6>
  {/if}
  <form on:submit|preventDefault={saveTask}>
    <label
      ><span class="legend">Titel</span>
      <input type="text" bind:value={$currentTask.title} required />
    </label>

    <label
      ><span class="legend">Beschrijving</span>
      <textarea bind:value={$currentTask.description}></textarea>
    </label>

    <label
      ><span class="legend">Uitvoerders</span>
      <!-- <select bind:value={$currentTask.assignees} multiple>
        {#each $assignees as assignee}
          <option value={assignee}>{assignee}</option>
        {/each}
      </select> -->
      <Select
        items={$assignees}
        bind:value={$currentTask.assignees}
        getOptionLabel={(file) => `${file.id} - ${file.name}`}
        getOptionValue={(file) => file.id}
        getSelectionLabel={(option) =>
          option?.name || `No name found for dossier ${option.id}`}
        placeholder="Selecteer de uitvoerder(s)"
        multiple={true}
        ,
        clearable={true}
      />
    </label>

    <label
      ><span class="legend">Dossier</span>
      <Select
        items={$files}
        bind:value={$currentTask.file_id}
        getOptionLabel={(file) => `${file.id} - ${file.name}`}
        getOptionValue={(file) => file.id}
        getSelectionLabel={(option) =>
          option?.name || `No name found for dossier ${option.id}`}
        placeholder="Selecteer een dossier"
        itemId="id"
        clearable={false}
      />
    </label>

    <label
      ><span class="legend">Prioriteit</span>
      <select bind:value={$currentTask.priority} required>
        <option value="Low">Laag</option>
        <option value="Medium">Medium</option>
        <option value="High">Hoog</option>
      </select>
    </label>

    <label
      ><span class="legend">Status</span>
      <select bind:value={$currentTask.status_id} required>
        <option value="" disabled selected>Selecteer een status</option>
        {#each $taskStatuses as status}
          <option value={status.id}>{status.name}</option>
        {/each}
      </select>
    </label>

    <label
      ><span class="legend">Deadline</span>
      <input type="date" bind:value={$currentTask.deadline} />
    </label>

    <div class="buttons">
      <button class="basic" on:click={deleteTask}
        ><TrashSimple size="16" /></button
      >
      <div>
        <button class="basic" type="button" on:click={closeModal}
          >Annuleren</button
        >
        <button type="submit">Opslaan</button>
      </div>
    </div>
  </form>
</dialog>

<style lang="scss">
  .filter-sort-controls {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 30px;
    flex-wrap: wrap;
    gap: 20px 20px;

    .filters-container {
      display: flex;
      flex-wrap: wrap;
      gap: 15px 30px;
      width: 100%;

      @media (max-width: $xlm) {
        display: none;
      }
    }

    .assignee-filters {
      flex-grow: 1;
      label {
        padding: 5px 10px 5px 6px;
        border-radius: 55px;
        border: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 5px;
        background-color: #fff;
        font-size: 1.3rem;
        user-select: none;
        cursor: pointer;
        input[type="checkbox"] {
          display: none;
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
      @media (max-width: $xs) {
        overflow-x: auto;
        white-space: nowrap;
        -ms-overflow-style: none; /* Internet Explorer 10+ */
        scrollbar-width: none; /* Firefox */
        margin-inline: -30px;
        padding-inline: 30px;

        &::-webkit-scrollbar {
          display: none; /* Safari and Chrome */
        }
      }
    }

    select {
      font-size: 1.4rem;
    }

    div {
      display: flex;
      flex-direction: row;
      gap: 10px;
      align-items: stretch;
      @media (max-width: $xlm) {
        width: 100%;
      }
      label {
        flex-shrink: 0;
        align-self: center;
        font-size: 1.4rem;
      }
      button.basic {
        min-width: 40px;
      }
    }
  }

  .filter-toggle {
    display: none;
    align-items: center;
    gap: 5px;
    padding: 10px 20px;
    background-color: var(--primary);
    color: #fff;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }

  .filters-container {
    display: flex;
    flex-wrap: wrap;
    gap: 30px;
    width: 100%;
  }

  @media (max-width: $xlm) {
    .filter-sort-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-toggle {
      display: flex;
    }

    .filters-container {
      display: none;
      flex-direction: column;
      width: 100%;
    }

    .filters-container.visible {
      display: flex;
    }

    .assignee-filters {
      overflow-x: auto;
      white-space: nowrap;
      -ms-overflow-style: none; /* Internet Explorer 10+ */
      scrollbar-width: none; /* Firefox */
      margin-inline: -30px;
      padding-inline: 30px;

      &::-webkit-scrollbar {
        display: none; /* Safari and Chrome */
      }
    }
  }

  .kanban-board {
    --container: 1520px;
    display: flex;
    justify-content: space-between;
    outline: none;

    flex-grow: 1;
    flex-basis: 0;
    display: flex;
    align-items: start;
    overflow-x: auto;
    overflow-y: hidden;
    margin-inline: -60px;
    margin-bottom: -60px;
    // width: calc(100% + 120px);
    // padding-inline: max(50px, (100% - var(--container) + 100px) / 2);
    // padding-inline: max(50px, (100% - var(--container)) / 2);
    padding-inline: 60px;
    padding-bottom: 40px;
    // max-width: 100%;
    display: grid;
    grid-auto-columns: 400px;
    grid-auto-flow: column;
    grid-column-gap: 2rem;
    grid-template-rows: minmax(0, 1fr);
    cursor: grab;
    @media (max-width: $sm) {
      grid-auto-columns: max(75vw, 300px);
      margin-inline: -30px;
      // margin-bottom: 0;
      padding-inline: 30px;
    }
  }

  .kanban-column {
    background-color: var(--background);
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 15px;
    cursor: default;
    user-select: none;

    .kanban-column-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      color: var(--text);

      &:has(h3:focus) {
      }
      h3 {
        font-size: 1.6rem;
        flex-grow: 1;
        margin-bottom: 0;
        outline: none;
        cursor: text;
      }
      > div {
        cursor: pointer;
        &:first-child {
          cursor: grab;
        }
      }
    }

    &.new-column-placeholder {
      background-color: transparent;
      border: 2px dashed #ccc;
      min-height: 220px;
      box-shadow: none;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: default;
      input {
        background-color: transparent;
        border: none;
        outline: none;
      }
    }
    .kanban-column-content {
      min-height: 100px;
      list-style: none;
      padding: 0;
      flex-grow: 1;

      max-height: calc(100vh - 300px);
      max-height: calc(100dvh - 300px);
      @media (max-width: $sm) {
        max-height: calc(100vh - 400px);
        max-height: calc(100dvh - 400px);
      }
      overflow-y: auto;
      /* Chrome, Edge, and Safari */
      &::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      &::-webkit-scrollbar-thumb {
        background-color: #d1d1d1;
        border-radius: 10px;
        //   border: 3px solid #ffffff;
        border-left: 4px solid var(--background);
      }
      .kanban-task {
        background-color: #fff;
        border-radius: 4px;
        padding: 20px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        position: relative;
        cursor: pointer;
        border-left: 3px solid transparent;

        // &[data-priority="High"] {
        //   border-left: 3px solid $error;
        // }
        // &[data-priority="Medium"] {
        //   // border-left: 3px solid $warning;
        // }
        // &[data-priority="Low"] {
        //   border-left: 3px solid var(--gray-300);
        //   // background-color: rgba(255, 255, 255, 0.4);
        //   // h4 {
        //   //   // opacity: 0.5;
        //   // }
        // }

        .drag-handle {
          position: absolute;
          inset: 0;
          opacity: 0;
          color: var(--gray-400);
          pointer-events: none;
        }

        @media (max-width: $md) {
          padding: 0;
          display: flex;
          flex-direction: row;
          overflow: hidden;

          .drag-handle {
            pointer-events: auto;
            position: relative;
            opacity: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 5px;
            border-right: 1px solid #f1f1f1;
          }
          .main {
            padding: 20px;
          }
        }

        &:not(:last-child) {
          margin-bottom: 8px;
        }

        .top {
          display: flex;
          flex-direction: row;
          gap: 20px;

          .text {
            flex-grow: 1;
            overflow: hidden;
            position: relative;

            .subtitle {
              // text-transform: uppercase;
              opacity: 0.6;
              font-size: 1.3rem;
              margin-top: 0.35em;
              display: block;

              max-width: 100%;
              text-overflow: ellipsis;
              overflow: hidden;
              white-space: nowrap;

              &:empty {
                display: none;
              }
            }
          }
          .assignees {
            display: flex;
            flex-direction: row-reverse;
            &:empty {
              display: none;
            }

            img {
              border-radius: 50%;
              border: 3px solid #fff;
              filter: brightness(0.95);

              &:not(:first-child) {
                margin-right: -15px;
              }
            }
          }
        }
        .bottom {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-top: 20px;

          &:has(> .priority:first-child:last-child) {
            justify-content: flex-end;
          }
          .priority {
            color: var(--gray-400);

            &[data-priority="Medium"] {
              color: $warning;
            }
            &[data-priority="High"] {
              color: $error;
            }
            // display: none;
            // &[data-priority=""] {
            //   display: none;
            // }

            // width: 6px;
            // height: 6px;
            // border-radius: 50%;

            // &[data-priority="High"] {
            //   background-color: $error;
            // }
            // &[data-priority="Medium"] {
            //   background-color: $warning;
            // }
            // &[data-priority="Low"] {
            //   background-color: var(--gray-300);
            // }
          }
        }

        .task-deadline {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 0;
          border-radius: 5px;
          font-size: 13px;
          color: var(--text-light);
        }

        &.today .task-deadline {
          background-color: $warning;
          color: #fff;
          padding: 3px 5px;
        }
        &.overdue .task-deadline {
          background-color: $error;
          color: #fff;
          padding: 3px 5px;
        }

        h4 {
          font-size: 1.6rem;
          margin-bottom: 0;
          @media (max-width: $sm) {
            font-size: 1.4rem;
          }
        }
      }
    }

    &[data-name="Done"] {
      .kanban-task.kanban-task:not(.force_red) {
        border-left: 0;
      }
      .priority {
        display: none;
      }
      .task-deadline.task-deadline:not(.force_red) {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 0;
        border-radius: 5px;
        font-size: 13px;
        background-color: transparent;
        color: var(--text-light);
      }
    }
  }

  .legend {
    margin-bottom: 0.5em;
    display: block;
  }

  dialog .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .buttons {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    border-top: 1px solid var(--border);
    padding-top: 20px;
    div {
      display: flex;
      gap: inherit;

      .basic {
        @media (max-width: $sm) {
          display: none;
        }
      }
    }
  }
  input.search.search {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23a8a8a8' viewBox='0 0 256 256'%3E%3Cpath d='M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z'%3E%3C/path%3E%3C/svg%3E");
    background-position: left 12px center;
    background-repeat: no-repeat;
    background-size: 16px;
    padding-left: 35px;
    width: 100%;

    @media (min-width: $xlm) {
      max-width: 42px;
      padding-inline: 18px;
      transition: max-width 0.2s ease-out;
      cursor: pointer;
      &::placeholder {
        opacity: 0;
        transition: opacity 0.2s ease-out;
      }

      &:focus,
      &:not(:placeholder-shown) {
        max-width: 300px;
        padding-inline: 40px 20px;
        cursor: unset;
        &::placeholder {
          opacity: 0.5;
        }
      }
    }
  }
</style>
