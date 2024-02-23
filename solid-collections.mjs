import { z } from "zod";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import matter from "gray-matter";

const COLLECTIONS_ROOT = "src/routes";

const pages = z.array(z.string());

const sectionSchema = z.object({
	type: z.literal("section"),
	title: z.string(),
	// children: z.array(z.string()),
	pages,
});
const entrySchema = z.object({
	type: z.literal("markdown"),
	path: z.string(),
	slug: z.string(),
	titles: z.string(),
});
const sectionData = z.object({
	title: z.string(),
	pages,
});

const frontMatterSchema = z.object({
	title: z.string(),
});

async function getDirData(dirPath = process.cwd()) {
	try {
		const data = JSON.parse(
			await fs.readFile(path.resolve(dirPath, "data.json"), "utf-8")
		);

		if (!sectionData.safeParse(data).success) {
			// throw new Error("failed to parse")
			console.error("failed to parse::", data);
		}

		return data;
	} catch (e) {
		console.error("\n");
		console.error("\n");
		console.error(e);
		throw new Error(
			`failed to parse directory info. Does ${dirPath} have a data.json?`
		);
	}
}

async function buildFileTree(entry = COLLECTIONS_ROOT) {
	const entryPath = path.resolve(process.cwd(), entry);
	const parentSegment = path.parse(entryPath).dir;
	const stats = await fs.stat(entryPath);

	if (stats.isDirectory()) {
		const info = await getDirData(entryPath);

		const nested = await Promise.all(
			info.pages.map(async (file) => {
				return buildFileTree(path.join(entryPath, file));
			})
		);

		return {
			type: "section",
			title: info.title,
			pages: info.pages,
			children: nested.filter(Boolean),
		};
	} else if (!entryPath.includes("data.json")) {
		const file = await fs.readFile(entryPath, "utf-8");
		const parentSection = await getDirData(path.resolve(parentSegment));

		const { title, mainNavExclude } = matter(file).data;

		/**
		 * @todo
		 * parse frontmatter with Zod
		 */
		return {
			type: "markdown",
			file: path.basename(entryPath),
			path:
				"/" +
				path
					.relative(path.join(process.cwd(), COLLECTIONS_ROOT), entryPath)
					.replace(/\index\.mdx?/, "")
					.replace(/\.mdx?/, ""),
			slug: path.basename(entryPath, path.extname(entryPath)),
			parent: parentSection.title,
			title,
			mainNavExclude,
		};
	} else {
		console.error(`WARNING: \n ${entry} was not found.\n Please fix it!\n`);
		return;
	}
}

async function createNavTree() {
	const [learn, references] = await Promise.all([
		buildFileTree(COLLECTIONS_ROOT),
		buildFileTree(`${COLLECTIONS_ROOT}/reference`),
	]);

	if (
		learn &&
		learn.type === "section" &&
		references &&
		references.type === "section"
	) {
		return {
			references: references.children,
			learn: learn.children,
		};
	}
}

/**
 *
 * @param {string} fileName
 * @param {object} fileContent
 * @param {boolean} removeAsConst
 * @param {string} collectionDir
 */
async function writeFile(
	fileName,
	fileContent,
	removeAsConst = false,
	collectionDir = ".solid"
) {
	fs.writeFile(
		path.resolve(collectionDir, fileName),
		`export default ${JSON.stringify(fileContent, null, 2)} ${
			removeAsConst ? "" : "as const"
		}`
	);
}

async function createSolidCollectionDir() {
	const collectionDir = path.resolve(process.cwd(), ".solid");

	if (!existsSync(collectionDir)) {
		fs.mkdir(path.resolve(process.cwd(), ".solid"));
	}
}

/**
 *
 * @param {Awaited<ReturnType<typeof createNavTree>>} tree
 * @param {object} entryMap
 */
function createFlatEntryList(tree, entryMap) {
	for (const item of tree) {
		if (item.type === "markdown") {
			if (entryMap.findIndex((e) => e.path === item.path) > -1) {
				console.error(`Duplicated entry found: ${item.slug}`);
				break;
			}
			entryMap.push(item);
		} else {
			createFlatEntryList(item.children, entryMap);
		}
	}

	return entryMap;
}

(async () => {
	const tree = await createNavTree();
	await createSolidCollectionDir();
	const learnMap = createFlatEntryList(tree.learn, []);
	const referenceMap = createFlatEntryList(tree.references, []);

	await Promise.all([
		writeFile("tree.ts", tree),
		writeFile(
			"entriesList.js",
			{
				references: referenceMap,
				learn: learnMap,
			},
			true
		),
		writeFile("entries.ts", { references: referenceMap, learn: learnMap }),
	]);
})();
