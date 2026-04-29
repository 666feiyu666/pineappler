import siteContent from "../../content-source/site/site.json";

export const siteMeta = siteContent.meta;
export const homeQuote = siteContent.homeQuote;
export const homeImage = siteContent.homeImage;
export const homeNews = siteContent.homeNews || [];
export const aboutContent = siteContent.about;
export const taxonomyOrder = siteContent.taxonomyOrder || {
  notesTopics: [],
  writingTypes: [],
  projectCategories: []
};
