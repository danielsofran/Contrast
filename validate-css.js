import fs from 'fs';
import path from 'path';
import validator from 'w3c-css-validator';

// Find all CSS files recursively
function findCSSFiles(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const cssFiles = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			// Recursively search subdirectories, ignoring node_modules
			if (entry.name !== 'node_modules') {
				cssFiles.push(...findCSSFiles(fullPath));
			}
		} else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.css' && !entry.name.endsWith('.min.css')) {
			cssFiles.push(fullPath);
		}
	}

	return cssFiles;
}

function readFileContent(filePath) {
	return fs.readFileSync(filePath, 'utf8');
}

// Validate a single CSS file
async function validateCSSFile(filePath) {
	try {
		console.log(`🔍 Validating: ${filePath}`);

		const cssContent = readFileContent(filePath);
		const result = await validator.validateText(cssContent)

		return {
			filePath,
			isValid: result.valid,
			errors: result.errors || [],
			warnings: result.warnings || []
		};
	} catch (error) {
		return {
			filePath,
			isValid: false,
			errors: [{ message: `Validation failed: ${error.message}` }],
			warnings: []
		};
	}
}

// Main validation function
async function validateAllCSS() {
	console.log('📁 Searching for CSS files...');

	const cssFiles = findCSSFiles(process.cwd());

	if (cssFiles.length === 0) {
		console.log('❌ No CSS files found.');
		process.exit(1);
	}

	console.log(`📄 Found ${cssFiles.length} CSS file(s):`);
	cssFiles.forEach(file => console.log(`   - ${file}`));
	console.log('');

	const results = [];
	let hasErrors = false;

	// Validate each file with delay to respect W3C rate limits [citation:3]
	for (const file of cssFiles) {
		const result = await validateCSSFile(file);
		results.push(result);

		if (!result.isValid) {
			hasErrors = true;
		}

		// Respect W3C rate limits - wait 1.5 seconds between requests [citation:3]
		await new Promise(resolve => setTimeout(resolve, 1500));
	}

	// Print all results
	console.log('\n📊 VALIDATION RESULTS:');
	console.log('=' .repeat(50));

	results.forEach(result => {
		console.log(`\n📄 ${result.filePath}:`);

		if (result.isValid && result.warnings.length === 0) {
			console.log('   ✅ Valid CSS - No errors or warnings');
		} else {
			if (result.errors.length > 0) {
				console.log('   ❌ Errors:');
				result.errors.forEach(error => {
					console.log(`      - Line ${error.line}: ${error.message}`);
				});
			}

			if (result.warnings.length > 0) {
				console.log('   ⚠️  Warnings:');
				result.warnings.forEach(warning => {
					console.log(`      - Line ${warning.line}: ${warning.message}`);
				});
			}

			if (result.isValid && result.warnings.length > 0) {
				console.log('   ✅ Valid CSS (with warnings)');
			}
		}
	});

	// Final summary and exit code
	console.log('\n' + '=' .repeat(50));
	const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
	const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

	console.log(`📈 Summary: ${totalErrors} error(s), ${totalWarnings} warning(s) across ${cssFiles.length} file(s)`);

	if (hasErrors) {
		console.log('❌ Validation failed - CSS errors found');
		process.exit(1);
	} else {
		console.log('✅ All CSS files are valid!');
		process.exit(0);
	}
}

// Run the validation
validateAllCSS().catch(error => {
	console.error('💥 Unexpected error:', error);
	process.exit(1);
});