import { doc, updateDoc, getDoc } from "firebase/firestore";
import { clearCache } from "$lib/utils/get"; // Adjust import path as per your setup
import { db } from "$lib/firebase"; // Use the alias '@' to refer to the 'src' directory
import { browser } from "$app/environment";

export const updateCategoryName = async (categoryId, newName) => {
  try {
    if (!browser) return;

    const workspaceId = localStorage.getItem("workspace"); // Adjust according to your setup
    const docRef = doc(db, "workspaces", workspaceId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const workspaceData = docSnap.data();
      const updatedCategories = updateCategoryNameInData(
        workspaceData.categories,
        categoryId,
        newName
      );

      await updateDoc(docRef, {
        categories: updatedCategories,
      });
      console.log(`Category with ID ${categoryId} updated successfully`);
      clearCache();
    } else {
      console.log("Workspace document not found");
    }
  } catch (error) {
    console.error("Error updating category:", error);
    throw error;
  }
};

// Function to recursively update the category name
export const updateCategoryNameInData = (dataArray, categoryId, newName) => {
  return dataArray.map((category) => {
    if (category.id === categoryId) {
      // Category found, update its name
      console.log("category name change made!");
      return {
        ...category,
        name: newName,
      };
    } else if (category.sub && category.sub.length > 0) {
      // Category might be in sub-categories, recursively check
      const updatedSub = updateCategoryNameInData(
        category.sub,
        categoryId,
        newName
      );
      return {
        ...category,
        sub: updatedSub,
      };
    } else {
      return category; // No changes needed
    }
  });
};

export const updateTemplateNameinDB = async (templateId, newName) => {
  try {
    if (!browser) return;

    const workspaceId = localStorage.getItem("workspace"); // Adjust according to your setup
    const docRef = doc(db, "workspaces", workspaceId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const workspaceData = docSnap.data();
      const updatedCategories = updateTemplateNameInData(
        workspaceData.categories,
        templateId,
        newName
      );

      await updateDoc(docRef, {
        categories: updatedCategories,
      });
      console.log(`Template with ID ${templateId} updated successfully`);
      clearCache();
    } else {
      console.log("Workspace document not found");
    }
  } catch (error) {
    console.error("Error updating template:", error);
    throw error;
  }
};

// Helper function to update template name within the data structure
const updateTemplateNameInData = (categories, templateId, newName) => {
  const updateNestedTemplates = (items) => {
    for (const item of items) {
      if (item.templates) {
        const template = item.templates.find(
          (template) => template.id === templateId
        );
        if (template) {
          template.name = newName;
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
};
