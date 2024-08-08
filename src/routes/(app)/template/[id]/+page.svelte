<script>
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { fetchWorkspaceData, fetchTemplateData } from "$lib/utils/get";
  import { updateTemplateNameinDB } from "$lib/utils/set";
  import { deleteTemplate } from "$lib/utils/delete";
  import { templatesStore } from "$lib/stores/templates";
  import { get } from "svelte/store";
  import { browser } from "$app/environment";
  import { updateDoc, doc, getDoc, setDoc } from "firebase/firestore"; // Import Firestore update function
  import { db } from "$lib/firebase"; // Adjust the import path if necessary

  import {
    Star,
    TrashSimple,
    PencilSimple,
    X,
    CopySimple,
    EnvelopeSimple,
    ListBullets,
    ListNumbers,
    ArrowUUpLeft,
    ArrowUUpRight,
  } from "phosphor-svelte";
  import { Editor, generateHTML, Node, mergeAttributes } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import Placeholder from "@tiptap/extension-placeholder";
  import BulletList from "@tiptap/extension-bullet-list";
  import OrderedList from "@tiptap/extension-ordered-list";
  import ListItem from "@tiptap/extension-list-item";
  import History from "@tiptap/extension-history";
  import Underline from "@tiptap/extension-underline";
  import Bold from "@tiptap/extension-bold";
  import Italic from "@tiptap/extension-italic";

  let id;
  let templateData = {};
  let templateContentHTML = "";
  let workspaceVariables = { variables: {} }; // Ensure workspaceVariables is initialized with a default structure
  let userInput = {};
  let isNextStage = false; // Control the visibility of stages
  let mail = {};
  let isActive = false;
  let isEditMode = false; // Toggle for edit mode
  let selectedVariable = ""; // Track the selected variable for insertion
  let isFavorite = false;
  let showVariablePopup = false; // State to control the popup visibility
  let variableSearchQuery = "";
  let newVariable = { field_name: "", placeholder: "" };
  let variableInput;
  let showPlaceholderField = false; // State to control placeholder field visibility

  // Subscribe to the page store to get the ID parameter
  $: id = $page.params.id;
  const Variable = Node.create({
    name: "variable",
    group: "inline",
    inline: true,
    atom: true,

    addAttributes() {
      return {
        id: {
          default: null,
        },
        variable: {
          default: null,
        },
        placeholder: {
          default: "",
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: "code[data-variable][data-id][data-placeholder]",
        },
      ];
    },

    renderHTML({ HTMLAttributes, node }) {
      console.log("HTMLAttributes", HTMLAttributes);
      console.log("node", node);
      return [
        "code",
        mergeAttributes(HTMLAttributes, {
          "data-id": node.attrs.id || "",
          "data-variable": node.attrs.variable || "",
          "data-placeholder": node.attrs.placeholder || "",
        }),
        `{{${node.attrs.placeholder || node.attrs.variable || ""}}}`,
      ];
    },

    addNodeView() {
      return ({ node, getPos, view }) => {
        const dom = document.createElement("code");
        dom.classList.add("variable");
        dom.setAttribute("data-id", node.attrs.id || "");
        dom.setAttribute("data-variable", node.attrs.variable || "");
        dom.setAttribute("data-placeholder", node.attrs.placeholder || "");
        dom.setAttribute("contenteditable", "false");
        dom.textContent = `{{${node.attrs.placeholder || node.attrs.variable || ""}}}`;

        console.log(view);

        dom.addEventListener("click", () => {
          if (!view) {
            console.error("Editor view is not available");
            return;
          }
          const variable = prompt("Edit variable", node.attrs.variable);
          if (variable) {
            console.log(view);
            view.dispatch(
              view.state.tr.setNodeMarkup(getPos(), null, { variable }),
            );
          }
        });

        return {
          dom,
        };
      };
    },
  });

  function isJson(str) {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }

  // Fetch all data for the component
  const fetchWorkspaceAndTemplateData = async () => {
    try {
      console.log(`fetching template data with ID ${id}`);
      templateData = await fetchTemplateData(id);
      console.log("Template data fetched:", templateData);

      workspaceVariables = (await fetchWorkspaceData()) || { variables: {} }; // Ensure workspaceVariables is not null

      // Ensure workspaceVariables has a variables property
      if (!workspaceVariables.variables) {
        workspaceVariables.variables = {};
      }

      // Helper function to extract variable IDs from nested content
      const extractVariableIds = (content) => {
        const variableIds = [];
        const extract = (items) => {
          if (Array.isArray(items)) {
            console.log("items is array");
            items.forEach((item) => {
              console.log("looping through items");
              if (item.type === "variable" && item.attrs && item.attrs.id) {
                console.log("item with type variable found");
                variableIds.push(item.attrs.id);
              }
              if (item.content && Array.isArray(item.content)) {
                console.log("go deeper");
                extract(item.content);
              }
            });
          } else {
            console.log("items is not array");
          }
        };
        extract(content);
        return variableIds;
      };

      const variableIds = extractVariableIds(templateData.content.content);

      console.log(variableIds);

      // Initialize user input fields with placeholders
      if (variableIds.length > 0) {
        userInput = {};
        variableIds.forEach((variableId) => {
          if (workspaceVariables.variables[variableId]) {
            userInput[variableId] =
              workspaceVariables.variables[variableId].placeholder || "";
          }
        });
      }

      console.log(templateData.content);

      if (
        templateData &&
        templateData.content &&
        typeof templateData.content === "object" &&
        !Array.isArray(templateData.content) &&
        templateData.content !== null
      ) {
        console.log("json content");
        templateContentHTML = generateHTML(templateData.content, [
          StarterKit,
          BulletList,
          OrderedList,
          ListItem,
          Variable,
          History,
          Bold,
          Italic,
          Underline,
        ]);
      } else {
        console.log("html content");
        templateContentHTML = templateData.content;
      }

      console.log(templateContentHTML);

      templateData.id = id;

      // Save to localStorage as recently viewed template
      saveRecentlyViewedTemplate(templateData);

      // Load favorite state after fetching template data
      loadFavoriteState();
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  $: {
    if (id) {
      isNextStage = false;
      console.log("Fetching template details for template ID:", id);
      isEditMode = browser && window.location.hash.includes("#edit");
      fetchWorkspaceAndTemplateData();
    }
  }

  let editorElement;
  let editor;

  // Initialize the editor when isEditMode becomes true
  $: if (editorElement) {
    initializeEditor();
    console.log("init editor");
  }

  $: if (!isEditMode && editor) {
    editor.destroy();
  }

  $: if (variableInput) {
    variableInput.focus();
  }

  const parseVariables = (content) => {
    const regex = /{{(.*?)}}/g;
    let match;
    const result = [];

    let lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      const [fullMatch, variableName] = match;
      const startIndex = match.index;
      const endIndex = regex.lastIndex;

      if (lastIndex < startIndex) {
        result.push(content.slice(lastIndex, startIndex));
      }

      result.push({
        type: "variable",
        attrs: { variable: variableName },
      });

      lastIndex = endIndex;
    }

    if (lastIndex < content.length) {
      result.push(content.slice(lastIndex));
    }

    return result;
  };

  const initializeEditor = () => {
    if (!editorElement) return;

    console.log(editorElement);

    const initialContent = templateContentHTML; // Fetch or define your initial content
    const parsedContent = parseVariables(initialContent);

    editor = new Editor({
      content: templateData.content,
      element: editorElement,
      extensions: [
        StarterKit.configure({
          history: false,
          heading: {
            levels: [1, 2, 3, 4, 5, 6],
          },
        }),
        Placeholder.configure({
          placeholder:
            "Begin met schrijven. Gebruik 'Shift + {' om een variabele toe te voegen.",
        }),
        BulletList,
        OrderedList,
        ListItem,
        Variable,
        History,
        Bold,
        Italic,
        Underline,
      ],
      onTransaction: () => {
        editor = editor; // force re-render so `editor.isActive` works as expected
      },
    });
  };

  const toggleFavorite = () => {
    isFavorite = !isFavorite;
    saveFavoriteState();
  };

  const saveFavoriteState = () => {
    if (browser) {
      let favoriteTemplates =
        JSON.parse(localStorage.getItem("favoriteTemplates")) || [];

      const index = favoriteTemplates.findIndex(
        (item) => item.id === templateData.id,
      );

      if (isFavorite && index === -1) {
        favoriteTemplates.unshift(templateData);
      } else if (!isFavorite && index !== -1) {
        favoriteTemplates.splice(index, 1);
      }

      localStorage.setItem(
        "favoriteTemplates",
        JSON.stringify(favoriteTemplates),
      );
    } else {
      console.warn("localStorage is not available in this environment.");
    }
  };

  const loadFavoriteState = () => {
    if (browser) {
      let favoriteTemplates =
        JSON.parse(localStorage.getItem("favoriteTemplates")) || [];

      isFavorite = favoriteTemplates.some(
        (item) => item.id === templateData.id,
      );
    } else {
      console.warn("localStorage is not available in this environment.");
    }
  };

  // Function to handle key combination
  function addVariableShortcut(event) {
    if (!isEditMode) return;
    const isShift = event.shiftKey;
    const isOpenBrace = event.key === "{";

    if (isShift && isOpenBrace) {
      event.preventDefault(); // Prevent default action for this shortcut
      showVariablePopup = true;
    }
  }

  // Call updatePreviewContent initially after fetching data
  onMount(() => {
    if (id) {
      fetchWorkspaceAndTemplateData().then(() => {
        updatePreviewContent();
      });
      fetchVariables();
      document.addEventListener("keydown", addVariableShortcut);
    }
  });

  onDestroy(() => {
    document.removeEventListener("keydown", addVariableShortcut);
    if (editor) {
      editor.destroy();
    }
  });

  const updateTemplateName = (id, newName) => {
    templatesStore.update((categories) => {
      const updateNestedTemplates = (items) => {
        for (const item of items) {
          if (item.templates) {
            const templateIndex = item.templates.findIndex(
              (template) => template.id === id,
            );
            if (templateIndex !== -1) {
              item.templates[templateIndex].name = newName;
              return true; // Exit after updating
            }
          }
          if (item.sub) {
            if (updateNestedTemplates(item.sub)) {
              return true; // Exit after updating
            }
          }
        }
        return false;
      };
      updateNestedTemplates(categories);
      return categories;
    });
  };

  const removeTemplateFromStore = (id) => {
    let categoryId = null;

    templatesStore.update((categories) => {
      const removeNestedTemplate = (items) => {
        for (const item of items) {
          if (item.templates) {
            const templateIndex = item.templates.findIndex(
              (template) => template.id === id,
            );
            if (templateIndex !== -1) {
              item.templates.splice(templateIndex, 1); // Remove the template
              categoryId = item.id; // Store the category id
              return true; // Exit after removing
            }
          }
          if (item.sub) {
            if (removeNestedTemplate(item.sub)) {
              return true; // Exit after removing
            }
          }
        }
        return false;
      };
      removeNestedTemplate(categories);
      return categories;
    });

    return categoryId;
  };

  // Reactive statement to update the preview content
  $: previewContent = replaceVariables(templateContentHTML, userInput);

  // Replace variables in content based on user input
  const replaceVariables = (content, variables) => {
    if (!content) return ""; // Check if content is defined

    return content.replace(/{{(.*?)}}/g, (match, p1) => {
      const variable = Object.entries(workspaceVariables.variables).find(
        ([id, data]) => {
          return data.placeholder === p1.trim();
        },
      );
      const value = variable ? variables[variable[0]] || match : match;
      return value;
    });
  };

  const handleInputChange = (variableId, event) => {
    userInput = { ...userInput, [variableId]: event.target.value };
    updatePreviewContent(); // Ensure the preview content updates
  };

  const updatePreviewContent = () => {
    const previewElement = document.querySelector(".preview-content");
    if (previewElement) {
      previewElement.innerHTML = replaceVariables(
        templateContentHTML,
        userInput,
      );
    }
  };

  // Handle click on variable span
  const handleVariableClick = (variableId) => {
    console.log("Clicked variable:", variableId);
    const inputElement = document.getElementById(variableId);
    console.log("Input element:", inputElement);
    if (inputElement) {
      inputElement.focus();
      inputElement.select();
    }
  };

  // Copy the generated content to clipboard
  const copyToClipboard = async (e) => {
    e.currentTarget.parentNode.dataset.tooltip = "Gekopieerd";
    const content = document.querySelector(".preview-content").innerText;
    try {
      await navigator.clipboard.writeText(content);
      console.log(`Copied to clipboard:\n\n${content}`);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const resetCopyTooltip = (e) => {
    e.currentTarget.parentNode.dataset.tooltip =
      e.currentTarget.parentNode.dataset.default_tooltip;
  };

  // Function to save the recently viewed template to localStorage
  const saveRecentlyViewedTemplate = (template) => {
    if (browser) {
      let recentlyViewed =
        JSON.parse(localStorage.getItem("recentlyViewed")) || [];
      // Check if the template is already in the recently viewed list
      const index = recentlyViewed.findIndex((item) => item.id === template.id);
      if (index !== -1) {
        recentlyViewed.splice(index, 1); // Remove the template from the list to re-add it later
      }
      recentlyViewed.unshift(template); // Add the template at the beginning of the array
      // Limit to storing only the last 4 viewed templates
      if (recentlyViewed.length > 4) {
        recentlyViewed = recentlyViewed.slice(0, 4);
      }
      localStorage.setItem("recentlyViewed", JSON.stringify(recentlyViewed));
    } else {
      console.warn("localStorage is not available in this environment.");
    }
  };

  // Move to the prev stage
  const prevPage = () => {
    isNextStage = false;
  };

  // Move to the next stage
  const nextPage = () => {
    isNextStage = true;
  };

  function sendEmail() {
    const content = document.querySelector(".preview-content").innerText;
    try {
      navigator.clipboard.writeText(content);
      console.log(`Copied to clipboard:\n\n${content}`);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }

    // Construct the email body with the correct spaces
    const bodyContent = "Gebruik Ctrl/Cmd + V om de mail te plakken.";

    const params = new URLSearchParams({
      subject: mail.subject,
      body: bodyContent,
    });

    if (mail.cc) {
      params.append("cc", mail.cc);
    }

    if (mail.bcc) {
      params.append("bcc", mail.bcc);
    }

    // Manually encode the parameters
    const encodedParams = Array.from(params.entries())
      .map(([key, value]) => {
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join("&");

    const mailtoLink = `mailto:${encodeURIComponent(mail.to)}${encodedParams ? `?${encodedParams}` : ""}`;
    console.log("mailtoLink", mailtoLink);

    window.open(mailtoLink);
  }

  // Toggle edit mode
  const toggleEditMode = () => {
    isEditMode = !isEditMode;
  };

  const confirmAndDelete = () => {
    const confirmDelete = window.confirm(
      "Weet je zeker dat je deze template wilt verwijderen?",
    );
    if (confirmDelete) {
      deleteTemplate(templateData.id)
        .then(() => {
          // Handle success, e.g., show success message or redirect
          console.log("Template deleted successfully");
          const templateCatId = removeTemplateFromStore(templateData.id);
          goto(`/category/${templateCatId}`);
        })
        .catch((error) => {
          // Handle error, e.g., show error message
          console.error("Error deleting template:", error);
        });
    }
  };

  // Handle save button click
  const saveTemplate = async () => {
    templateData.content = editor.getJSON();
    console.log(templateData.content);
    try {
      const docRef = doc(
        db,
        `workspaces/${localStorage.getItem("workspace")}/templates`,
        id,
      );
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // Document exists, so update it
        await updateDoc(docRef, {
          content: templateData.content,
          name: templateData.name,
          variables: templateData.variables,
        });
      } else {
        // Document does not exist, so create it
        await setDoc(docRef, {
          content: templateData.content,
          name: templateData.name,
          variables: templateData.variables,
          createdAt: new Date(),
        });
      }

      toggleEditMode();
      updateTemplateName(id, templateData.name);
      updateTemplateNameinDB(id, templateData.name);
      fetchWorkspaceAndTemplateData(); // Refresh the data
    } catch (e) {
      console.error("Error updating document: ", e);
    }
  };

  const addNewVariable = async () => {
    if (newVariable.field_name && newVariable.placeholder) {
      const id =
        "var_" +
        Date.now().toString(36) +
        Math.random().toString(36).substr(2, 9);
      const variable = {
        field_name: newVariable.field_name,
        placeholder: newVariable.placeholder,
      };
      workspaceVariables.variables[id] = variable;

      console.log("New Variable ID:", id);
      console.log("New Variable:", variable);

      // Update the Firestore document with the new variable
      const docRef = doc(db, "workspaces", localStorage.getItem("workspace"));
      await updateDoc(docRef, {
        [`variables.${id}`]: variable,
      });

      newVariable = { field_name: "", placeholder: "" };
      selectedVariable = id;

      return { id, ...variable }; // Return the object containing the new variable's attributes
    }
    return null; // Ensure that a null value is returned if no variable is added
  };

  const insertVariable = (variable) => {
    console.log("Inserting Variable:", variable);

    editor
      .chain()
      .focus()
      .insertContent({
        type: "variable",
        attrs: {
          id: variable.id,
          variable: variable.field_name,
          placeholder: variable.placeholder,
        },
      })
      .run();

    showVariablePopup = false;
    variableSearchQuery = "";
    showPlaceholderField = false;

    console.log("Inserted Variable:", variable);
  };

  const handleVariableSearch = (e) => {
    variableSearchQuery = e.target.value;
    console.log(workspaceVariables);
    let existingVariable = {};
    if (workspaceVariables.variables) {
      console.log(workspaceVariables.variables);
      existingVariable = Object.entries(workspaceVariables.variables).filter(
        ([id, data]) =>
          data.field_name
            .toLowerCase()
            .includes(variableSearchQuery.toLowerCase()),
      );
    }

    if (existingVariable.length > 0) {
      // If existing variable is found
      selectedVariable = existingVariable[0];
      showPlaceholderField = false;
    } else if (variableSearchQuery) {
      // If no existing variable is found, allow adding new variable
      selectedVariable = "";
      newVariable.field_name = variableSearchQuery;
      showPlaceholderField = true;
    } else {
      showPlaceholderField = false;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      addVariableAction();
    } else if (e.key === "Escape") {
      console.log("Escape clicked");
      showVariablePopup = false;
    }
  };

  const addVariableAction = async () => {
    if (selectedVariable) {
      console.log(selectedVariable);
      insertVariable({
        id: selectedVariable[0],
        variable: selectedVariable[1].field_name,
        placeholder: selectedVariable[1].placeholder,
      });
    } else if (newVariable.field_name && newVariable.placeholder) {
      console.log("custom var");
      const newVariableData = await addNewVariable(); // Wait for the Promise to resolve
      if (newVariableData) {
        insertVariable(newVariableData);
      }
    }
  };

  // Set focus on the variable search input when the popup is shown
  $: if (showVariablePopup) {
    setTimeout(() => {
      const variableInputElement = document.querySelector(".popup input");
      if (variableInputElement) {
        variableInputElement.focus();
      }
      document.addEventListener("keydown", handleKeyPress);
    }, 0);
  } else {
    document.removeEventListener("keydown", handleKeyPress);
  }
  // Fetch existing variables from the workspace
  const fetchVariables = async () => {
    if (!browser) return;
    workspaceVariables = await fetchWorkspaceData("variables");

    if (workspaceVariables) {
      console.log("Workspace Variables:", workspaceVariables);
    } else {
      console.log("No such document!");
    }
  };

  const extractVariablesFromContent = (content) => {
    const regex = /{{(.*?)}}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      matches.push(match[1].trim());
    }
    return matches;
  };
</script>

{#if !isNextStage}
  <div class="top">
    <h1>
      {templateData.name}
    </h1>
    <button class="button basic" on:click={toggleEditMode}>
      {#if isEditMode}
        <X size="18" />Annuleren
      {:else}
        <PencilSimple size="18" />Aanpassen
      {/if}
    </button>
    {#if !isEditMode}
      <button class="button basic" on:click={confirmAndDelete}>
        <TrashSimple size="18" />
      </button>
      <button class="button basic favorite_button" on:click={toggleFavorite}>
        {#if isFavorite}
          <Star size="18" weight="fill" />
        {:else}
          <Star size="18" />
        {/if}
      </button>
    {/if}
  </div>
  {#if isEditMode}
    <div class="edit-template">
      <h2>Template naam</h2>
      <input
        type="text"
        bind:value={templateData.name}
        placeholder="Template naam"
      />
      <h2>Template inhoud</h2>
      <div class="editor_outer">
        {#if editor}
          <div class="editor_buttons">
            <div class="formatting">
              <button
                on:click={() =>
                  editor.chain().focus().toggleHeading({ level: 3 }).run()}
                class:active={editor.isActive("heading", { level: 3 })}
              >
                H
              </button>
              <button
                on:click={() => editor.chain().focus().setParagraph().run()}
                class:active={editor.isActive("paragraph")}
              >
                P
              </button>
              <button
                on:click={() => editor.chain().focus().toggleBold().run()}
                class:active={editor.isActive("bold")}
              >
                B
              </button>
              <button
                on:click={() => editor.chain().focus().toggleItalic().run()}
                class:active={editor.isActive("italic")}
              >
                I
              </button>
              <button
                on:click={() => editor.chain().focus().toggleUnderline().run()}
                class:active={editor.isActive("underline")}
              >
                U
              </button>
              <button
                on:click={() => editor.chain().focus().toggleBulletList().run()}
                class:active={editor.isActive("bulletList")}
              >
                <ListBullets size="14" />
              </button>
              <button
                on:click={() =>
                  editor.chain().focus().toggleOrderedList().run()}
                class:active={editor.isActive("orderedList")}
              >
                <ListNumbers size="14" />
              </button>
            </div>
            <div class="actions">
              <button
                class="button outline add_variable"
                on:click={() => (showVariablePopup = true)}
                >+ Voeg variabele toe</button
              >
              <button
                on:click={() => editor.chain().focus().undo().run()}
                class:disabled={!editor.can().undo()}
                ><ArrowUUpLeft size="18" /></button
              >
              <button
                on:click={() => editor.chain().focus().redo().run()}
                class:disabled={!editor.can().redo()}
                ><ArrowUUpRight size="18" /></button
              >
            </div>
          </div>
        {/if}
        <div class="editor" bind:this={editorElement}></div>
      </div>
      <button class="button" on:click={saveTemplate}>Opslaan</button>
    </div>

    {#if showVariablePopup}
      <div class="popup">
        <h2>Voeg een variabele toe</h2>
        <input
          type="text"
          placeholder="Variabele naam"
          bind:value={variableSearchQuery}
          on:input={handleVariableSearch}
          on:keypress={handleKeyPress}
        />
        {#if variableSearchQuery && workspaceVariables.variables && !showPlaceholderField}
          <ul>
            {#each Object.entries(workspaceVariables.variables).filter( ([id, data]) => data.field_name
                  .toLowerCase()
                  .includes(variableSearchQuery.toLowerCase()), ) as [id, data]}
              <li
                on:click={() =>
                  insertVariable({
                    id: id,
                    variable: data.field_name,
                    placeholder: data.placeholder,
                  })}
              >
                {data.field_name}
              </li>
            {/each}
          </ul>
        {/if}
        {#if showPlaceholderField}
          <input
            type="text"
            placeholder="Placeholder"
            bind:value={newVariable.placeholder}
            on:keypress={handleKeyPress}
          />
        {/if}
        <button
          class="button basic"
          on:click={() => (showVariablePopup = false)}>Sluiten</button
        >
        <button class="button" on:click={addVariableAction}>+ Toevoegen</button>
      </div>
    {/if}
  {:else}
    <div class="template">
      <div class="variables">
        {#each Object.keys(userInput) as variableId}
          {#if workspaceVariables.variables && workspaceVariables.variables[variableId]}
            <div>
              <label class="label" for={variableId}>
                {workspaceVariables.variables[variableId].field_name}
              </label>
              <input
                type="text"
                id={variableId}
                bind:value={userInput[variableId]}
                placeholder={workspaceVariables.variables[variableId]
                  .placeholder}
                on:input={(e) => handleInputChange(variableId, e)}
              />
            </div>
          {/if}
        {/each}
      </div>

      <div class="preview">
        <div class="preview-content">
          {@html previewContent ||
            "<em style='opacity:0.6;'>Deze template is nog leeg..</em>"}
        </div>
      </div>
      <div class="buttons">
        <span
          data-flow="top"
          data-tooltip="Klik om te kopiëren"
          data-default_tooltip="Klik om te kopiëren"
        >
          <button
            class="button outline"
            on:mouseleave={resetCopyTooltip}
            on:click={copyToClipboard}><CopySimple size="18" />Kopiëren</button
          >
        </span>
        <button class="button outline" on:click={nextPage}
          ><EnvelopeSimple size="18" />Mailen</button
        >
      </div>
    </div>
  {/if}
{:else}
  <h1>{templateData.name} - Mailen</h1>
  <div class="email-details">
    <label class="input_wrapper">
      <input
        type="text"
        id="subject"
        bind:value={mail.subject}
        placeholder="&nbsp;"
      />
      <span for="userEmail">Onderwerp</span>
    </label>
    <label class="input_wrapper">
      <input type="text" id="to" bind:value={mail.to} placeholder="&nbsp;" />
      <span for="userEmail">Aan</span>
    </label>
    <div class="input_columns">
      <label class="input_wrapper">
        <input type="email" id="cc" bind:value={mail.cc} placeholder="&nbsp;" />
        <span for="cc">CC</span>
      </label>
      <label class="input_wrapper">
        <input
          type="email"
          id="bcc"
          bind:value={mail.bcc}
          placeholder="&nbsp;"
        />
        <span for="bcc">BCC</span>
      </label>
    </div>
  </div>
  <span class="label">Preview</span>
  <div class="preview">
    <div class="preview-content">
      {@html replaceVariables(templateContentHTML, userInput) ||
        "<em style='opacity:0.6;'>Deze template is nog leeg..</em>"}
    </div>
  </div>
  <div class="buttons mail_actions">
    <button class="button outline" on:click={prevPage}>Vorige</button>
    <button class="button" on:click={sendEmail}>Mail openen</button>
  </div>
{/if}

<style lang="scss">
  .top {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 20px;
    h1 {
      flex-grow: 1;
      margin-bottom: 0;
    }
  }
  .template {
    display: flex;
    flex-direction: column;
    gap: 20px;
    .variables {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      > * {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
    }
  }
  .preview {
    background-color: #fff;
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    padding: 30px;
    h2 {
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.5em;
    }
    .preview-content {
      line-height: 1.5;
      p:empty {
        display: flex;
        height: 1.5em;
      }
    }
    .variable {
      text-decoration: underline; /* Voor onderstreping */
      cursor: pointer; /* Verander cursor naar pointer bij hover */
      /* Of gebruik bijvoorbeeld background-color voor achtergrondmarkering */
    }
  }

  .mail_actions {
    margin-top: 20px;
  }
  .buttons {
    display: flex;
    gap: 10px;
  }
  .email-details {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
    > div {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
  }

  .editor_outer {
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    margin-bottom: 10px;
    .editor_buttons {
      border-bottom: 1px solid var(--border);
      background-color: var(--gray-100);
      border-top-left-radius: inherit;
      border-top-right-radius: inherit;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 5px;
      padding: 5px;
      .formatting {
        flex-grow: 1;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 5px;
        justify-content: center;
        button {
          display: flex;
        }
        .add_variable {
          padding: 10px 20px;
          display: inline-flex;
          font-size: 1.5rem;
          font-family: inherit;
          font-weight: 400;
          margin: 4px 5px;
        }
        .disabled {
          pointer-events: none;
          opacity: 0.5;
        }
      }
      button {
        background-color: transparent;
        border: 1px solid transparent;
        margin: 0;
        padding: 8px;
        border-radius: var(--border-radius);
        transition: background-color 0.2s ease-out;
        min-width: 32px;
        &.active {
          border-color: var(--border);
        }
        &:hover {
          background-color: var(--gray-200);
        }
      }
    }

    .editor {
      border-bottom-left-radius: inherit;
      border-bottom-right-radius: inherit;
    }
  }

  .popup {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    padding: 30px;
    border-radius: var(--border-radius);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    input {
      margin-bottom: 10px;
    }

    button {
      margin-right: 10px;
    }

    ul {
      list-style-type: none;
      padding: 0;
    }

    li {
      padding: 10px;
      background: #f0f0f0;
      margin-bottom: 5px;
      cursor: pointer;
    }

    li:hover {
      background: #e0e0e0;
    }
  }

  .edit-template {
    h2 {
      margin-top: 1em;
      margin-bottom: 0.5em;
      font-size: 2rem;
    }
  }
</style>
