import fs from 'fs-extra';
import json5 from 'json5';
import globby from 'globby';
import type {
  Sidebars,
  SidebarItemDoc,
} from '@docusaurus/plugin-content-docs/src/sidebars/types.js';
import logger from '@docusaurus/logger';
import prettier from 'prettier';
import path from 'path';

const IGNORE_LIST = [
  'README',
  'styleguide',
  // these don't belong to any category yet
  'api/accelerator',
  'experimental',
  // these have limited relevance
  'tutorial/using-pepper-flash-plugin',
  'latest/development/README',
  'tutorial/support',
  'api/synopsis',
];

const categoryAliases = new Map([['Tutorial', 'How To']]);

/**
 * Capitalizes the first letter of each word in title.
 * @param {string} title
 */
const capitalize = (title: string) => {
  const words = title.split(' ');
  const capitalizedWords = words.map((word) => {
    return word[0].toUpperCase() + word.substring(1);
  });

  return capitalizedWords.join(' ');
};

/**
 * Returns a category inside `sidebars` whose property
 * `label` matches `category`.
 * @param categoryName The category to find
 * @param sidebars The sidebars object
 * @param defaultTopLevel The default top level to add to the category if it does not exist
 */
const findCategoryForDocument = (
  categoryName: string,
  sidebars: Sidebars,
  defaultTopLevel: string
) => {
  const topLevelIds = Object.keys(sidebars);

  const categoryAlias = categoryAliases.get(categoryName) || categoryName;

  for (const topLevelId of topLevelIds) {
    const entries = sidebars[topLevelId];

    for (const category of entries) {
      if (
        category.type === 'category' &&
        category.label.toLowerCase() === categoryAlias.toLowerCase()
      ) {
        return category;
      }
    }
  }

  /*
    If we reach this point, the category does not exist so we
    create a new one and add it directly to sidebars.
    Not a fan of modifying parameters though 😞
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const category: any = {
    type: 'category',
    label: categoryName,
    items: [],
  };

  sidebars[defaultTopLevel].push(category);

  return category;
};

/**
 * Using the given `destination` as the source,
 * adds any new document found at the end of each
 * category while preserving the order.
 * If the file does not exists, it gets created
 * using the folder structure as the guide.
 * @param root Root directory for the documentation
 * @param destination The path where `sidebars.js` lives
 */
export const createSidebar = async (root: string, destination: string) => {
  const documents = await globby(`**/*.md`, {
    onlyFiles: true,
    cwd: root,
  });

  const sidebars = (
    fs.existsSync(destination) ? require(destination) : { docs: [], api: [] }
  ) as Sidebars;

  const reverseLookup = new Map<string, SidebarItemDoc>();

  const setRecursive = (category) => {
    // Categories can also have a doc attached to them
    if (category?.link?.type === 'doc' && category.link.id) {
      reverseLookup.set(category.link.id, category);
    }

    // Go through all items in category
    for (const item of category.items) {
      // if doc is string shorthand
      if (typeof item === 'string') {
        reverseLookup.set(item, category);
        // if doc is added as object syntax
      } else if (item?.type === 'doc' && !!item.id) {
        reverseLookup.set(item.id, category);
        // if item is nested category, recurse
      } else if (item?.type === 'category') {
        setRecursive(item);
      }
    }
  };

  for (const id of Object.keys(sidebars)) {
    for (const category of sidebars[id]) {
      setRecursive(category);
    }
  }

  let hasNewDocuments = false;
  for (const document of documents) {
    const documentId = document.replace('.md', '');
    if (reverseLookup.has(documentId)) {
      continue;
    }

    const ignore = IGNORE_LIST.some((ignore) => documentId.endsWith(ignore));
    if (ignore) {
      continue;
    }

    const segments = document.split('/');
    // Documents are always under /latest/ or similar that are not relevant for the category
    segments.shift();
    // The last segment is the name of the file
    segments.pop();

    logger.info(`New document found: ${logger.green(document)}`);
    hasNewDocuments = true;

    const categoryId = segments
      .map((segment) => capitalize(segment.replace(/-/g, ' ')))
      .join(' ');
    const defaultTopLevel = segments[0] === 'api' ? 'api' : 'docs';
    const category = findCategoryForDocument(
      categoryId,
      sidebars,
      defaultTopLevel
    );

    category.items.push(document.replace('.md', ''));
  }

  if (hasNewDocuments) {
    logger.info(`Updating ${logger.green(destination)}`);
    const sidebarString = `module.exports = ${json5.stringify(sidebars)};`;

    // run it through our linter
    const prettierConfig = await prettier.resolveConfig(
      path.resolve(__dirname, '..', '..', '.prettierrc')
    );
    const formattedSidebarString = prettier.format(
      sidebarString,
      prettierConfig
    );

    await fs.writeFile(destination, formattedSidebarString, 'utf-8');
  } else {
    logger.info(`No new documents found`);
  }
};
