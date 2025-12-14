import { readFile, writeFile, readdir, mkdir, cp } from 'fs/promises';
import { existsSync } from 'fs';
import path, { join, dirname } from 'path';
import uglifyJS from 'uglify-js';
import uglifycss from 'uglifycss';
import htmlMinifier from 'html-minifier';
import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';

const srcDir = './src';
const distDir = './dist';

// Function to minify JSON with error handling
function minifyJSON(jsonContent) {
	try {
		const parsed = JSON.parse(jsonContent);
		return JSON.stringify(parsed);
	} catch (error) {
		console.error('Error minifying JSON:', error);
		return jsonContent;
	}
}

const minifyImages = async (srcFolder, destFolder) => {
	console.log('🖼️  Optimizing images...');

	try {
		// Ensure the destination directory exists
		if (!existsSync(destFolder)) {
			await mkdir(destFolder, { recursive: true });
		}

		// Find and process PNG files [citation:6]
		// Note: Use absolute paths to avoid issues [citation:1]
		const files = await imagemin([`${srcFolder}/**/*.png`], {
			destination: destFolder,
			plugins: [
				imageminPngquant({
					quality: [0.65, 0.8],      // Min and max quality (65-80%)
					speed: 1,                  // Speed/quality trade-off (1=slow/best, 11=fast)
					strip: true,               // Remove optional metadata
					// dithering: 0.5,            // Amount of dithering (0-1, default: 1)
					// posterize: 4,              // Reduce number of colors (if needed)
				})
			]
		});

		console.log(`✅ Optimized ${files.length} images`);
		console.log('Optimized files:', files.map(f => path.basename(f.destinationPath)));

	} catch (error) {
		console.error('❌ Error optimizing images:', error);
		// Fallback to copying
		console.log('⚠️  Falling back to copying images as-is');
		await cp(srcFolder, destFolder, { recursive: true });
	}
}

// Recursive function to find all JSON files in a directory
async function findJSONFiles(dir, fileList = []) {
	const files = await readdir(dir, { withFileTypes: true });

	for (const file of files) {
		const fullPath = join(dir, file.name);

		if (file.isDirectory()) {
			await findJSONFiles(fullPath, fileList);
		} else if (file.name.endsWith('.json')) {
			fileList.push({
				path: fullPath,
				relativePath: fullPath.replace(srcDir, '').replace(/^[\\\/]/, '')
			});
		}
	}

	return fileList;
}

async function minifySite() {
	try {
		// Create dist directory if it doesn't exist
		if (!existsSync(distDir)) {
			await mkdir(distDir, { recursive: true });
		}

		// Copy assets folder
		const assetsSrc = join(srcDir, 'assets');
		const assetsDest = join(distDir, 'assets');

		if (existsSync(assetsSrc)) {
			await minifyImages(assetsSrc, assetsDest);
			console.log('📁 Minified assets folder');
		}

		// Minify CSS files
		const cssSrcDir = join(srcDir, 'css');
		const cssDestDir = join(distDir, 'css');

		if (existsSync(cssSrcDir)) {
			await mkdir(cssDestDir, { recursive: true });
			const cssFiles = (await readdir(cssSrcDir)).filter(f => f.endsWith('.css'));

			const cssMap = {};
			for (const file of cssFiles) {
				const content = await readFile(join(cssSrcDir, file), 'utf8');
				const minified = uglifycss.processString(content);
				const outputName = file.replace('.css', '.min.css');
				await writeFile(join(cssDestDir, outputName), minified);
				cssMap[file] = outputName;
				console.log(`🎨 Minified CSS: ${file} -> ${outputName}`);
			}

			// Minify JS files
			const jsSrcDir = join(srcDir, 'js');
			const jsDestDir = join(distDir, 'js');

			if (existsSync(jsSrcDir)) {
				await mkdir(jsDestDir, { recursive: true });
				const jsFiles = (await readdir(jsSrcDir)).filter(f => f.endsWith('.js'));

				const jsMap = {};
				for (const file of jsFiles) {
					const content = await readFile(join(jsSrcDir, file), 'utf8');
					const minifiedResult = uglifyJS.minify(content);

					if (minifiedResult.error) {
						throw new Error(`Error minifying ${file}: ${minifiedResult.error}`);
					}

					const outputName = file.replace('.js', '.min.js');
					await writeFile(join(jsDestDir, outputName), minifiedResult.code);
					jsMap[file] = outputName;
					console.log(`⚡ Minified JS: ${file} -> ${outputName}`);
				}

				// Find and minify all JSON files in src directory
				const jsonFiles = await findJSONFiles(srcDir);
				const jsonMap = {};

				for (const jsonFile of jsonFiles) {
					const content = await readFile(jsonFile.path, 'utf8');
					const minifiedJSON = minifyJSON(content);

					// Create output path preserving directory structure
					const outputPath = join(distDir, jsonFile.relativePath.replace('.json', '.min.json'));
					const outputDir = dirname(outputPath);

					// Ensure directory exists
					await mkdir(outputDir, { recursive: true });

					await writeFile(outputPath, minifiedJSON);
					jsonMap[jsonFile.relativePath] = jsonFile.relativePath.replace('.json', '.min.json');
					console.log(`📊 Minified JSON: ${jsonFile.relativePath}`);
				}

				// Process HTML
				const htmlPath = join(srcDir, 'index.html');
				if (existsSync(htmlPath)) {
					let htmlContent = await readFile(htmlPath, 'utf8');

					// Replace CSS references
					for (const [original, minified] of Object.entries(cssMap)) {
						const regex = new RegExp(`href=["']css/${original.replace('.', '\\.')}["']`, 'g');
						htmlContent = htmlContent.replace(regex, `href="css/${minified}"`);
					}

					// Replace JS references
					for (const [original, minified] of Object.entries(jsMap)) {
						const regex = new RegExp(`src=["']js/${original.replace('.', '\\.')}["']`, 'g');
						htmlContent = htmlContent.replace(regex, `src="js/${minified}"`);
					}

					// Replace JSON references
					for (const [originalPath, minifiedPath] of Object.entries(jsonMap)) {
						// Escape dots for regex
						const escapedPath = originalPath.replace(/\./g, '\\.');

						// Handle various path formats
						const patterns = [
							`src=["']${escapedPath}["']`,
							`src=["']\\./${escapedPath}["']`,
							`src=["']\\./\\./${escapedPath}["']`,
							`src=["']/${escapedPath}["']`
						];

						for (const pattern of patterns) {
							const regex = new RegExp(pattern, 'g');
							htmlContent = htmlContent.replace(regex, `src="${minifiedPath}"`);
						}

						console.log(`🔄 Updated JSON reference: ${originalPath} -> ${minifiedPath}`);
					}

					// Minify HTML
					const minifiedHTML = htmlMinifier.minify(htmlContent, {
						collapseWhitespace: true,
						removeComments: true,
						removeEmptyAttributes: true,
						removeRedundantAttributes: true,
						removeScriptTypeAttributes: true,
						removeStyleLinkTypeAttributes: true,
						minifyCSS: true,
						minifyJS: true,
						// Keep JSON-LD script tags intact
						processScripts: ['application/ld+json']
					});

					// Write minified HTML
					await writeFile(join(distDir, 'index.html'), minifiedHTML);
					console.log('📄 Minified HTML');
				}
			}
		}

		console.log('\n✅ Minification complete!');
		console.log(`📁 Output saved to: ${distDir}`);

	} catch (error) {
		console.error('❌ Error during minification:', error);
	}
}

// Run the minification
minifySite();