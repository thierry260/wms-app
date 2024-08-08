import { doc, updateDoc, getDoc, deleteDoc } from "firebase/firestore";
import { clearCache } from "$lib/utils/get"; // Adjust import path as per your setup
import { db } from "$lib/firebase"; // Use the alias '@' to refer to the 'src' directory
import { browser } from "$app/environment";

export const deleteCategory = async (categoryId) => {
  try {
    if (!browser) return;

    const workspaceId = localStorage.getItem("workspace"); // Adjust according to your setup
    const docRef = doc(db, "workspaces", workspaceId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const workspaceData = docSnap.data();
      const updatedCategories = removeCategoryFromData(
        workspaceData.categories,
        categoryId
      );

      await updateDoc(docRef, {
        categories: updatedCategories,
      });

      console.log(`Category with ID ${categoryId} deleted successfully`);
      clearCache();
    } else {
      console.log("Workspace document not found");
    }
  } catch (error) {
    console.error("Error deleting category:", error);
    throw error;
  }
};

export const removeCategoryFromData = (dataArray, categoryIdToDelete) => {
  return dataArray
    .map((category) => {
      if (category.id === categoryIdToDelete) {
        // Category found at this level, remove it
        return null;
      } else if (category.sub && category.sub.length > 0) {
        // Category might be in sub-categories, recursively check
        const updatedSub = removeCategoryFromData(
          category.sub,
          categoryIdToDelete
        );
        return {
          ...category,
          sub: updatedSub.filter(Boolean), // Remove null entries
        };
      } else {
        return category; // No changes needed
      }
    })
    .filter(Boolean); // Remove null entries
};

// Function to delete a document from Firestore
export const deleteDocument = async (collectionPath, documentId) => {
  try {
    const docRef = doc(db, collectionPath, documentId);
    await deleteDoc(docRef);
    clearCache();
    console.log(
      `Document with ID ${documentId} deleted successfully from ${collectionPath}`
    );
  } catch (error) {
    console.error(`Error deleting document from ${collectionPath}:`, error);
    throw error;
  }
};

export const deleteTemplate = async (templateId) => {
  try {
    if (!browser) return;

    const workspaceId = localStorage.getItem("workspace"); // Adjust according to your setup
    const docRef = doc(db, "workspaces", workspaceId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const workspaceData = docSnap.data();

      // Delete the template document
      await deleteDoc(doc(db, "templates", templateId));
      console.log(`Template with ID ${templateId} deleted successfully`);

      // Remove template ID from workspace categories
      const updatedCategories = removeTemplateFromCategories(
        workspaceData.categories,
        templateId
      );

      // Update workspace document with updated categories
      await updateDoc(docRef, {
        categories: updatedCategories,
      });

      // Update categories store
      // categories.set(updatedCategories);

      // Clear cache or perform any additional actions if needed
      clearCache();
    } else {
      console.log("Workspace document not found");
    }
  } catch (error) {
    console.error("Error deleting template:", error);
    throw error;
  }
};

const removeTemplateFromCategories = (categoriesArray, templateIdToDelete) => {
  return categoriesArray.map((category) => {
    if (category.templates && category.templates.length > 0) {
      category.templates = category.templates.filter(
        (template) => template.id !== templateIdToDelete
      );
    }
    if (category.sub && category.sub.length > 0) {
      category.sub = removeTemplateFromCategories(
        category.sub,
        templateIdToDelete
      );
    }
    return category;
  });
};
