import puppeteer from 'puppeteer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFile } from 'fs/promises';

// Create require for CommonJS modules in ES module context
const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

async function testWithAxeCore(pageUrl) {
    console.log(`🔍 Testing accessibility for: ${pageUrl}`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set realistic viewport
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to page
        await page.goto(pageUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Inject axe-core using correct path resolution
        const axePath = require.resolve('axe-core');
        await page.addScriptTag({ path: axePath });

        // Run axe audit with configuration
        const results = await page.evaluate(async () => {
            return await axe.run({
                runOnly: {
                    type: 'tag',
                    values: ['wcag2a', 'wcag2aa', 'best-practice']
                },
                rules: {
                    'color-contrast': { enabled: true },
                    'image-alt': { enabled: true },
                    'label': { enabled: true },
                    'link-name': { enabled: true },
                    'button-name': { enabled: true }
                }
            });
        });

        return {
            url: pageUrl,
            timestamp: new Date().toISOString(),
            pageTitle: await page.title(),
            summary: {
                violations: results.violations.length,
                passes: results.passes.length,
                incomplete: results.incomplete.length
            },
            violations: results.violations.map(v => ({
                id: v.id,
                impact: v.impact,
                description: v.description,
                help: v.helpUrl,
                nodes: v.nodes.length
            })),
            passes: results.passes.length,
            incomplete: results.incomplete.length,
            rawResults: results // Optional: include full results
        };

    } catch (error) {
        console.error(`❌ Accessibility test failed:`, error.message);
        return {
            error: error.message,
            url: pageUrl,
            timestamp: new Date().toISOString()
        };
    } finally {
        await browser.close();
    }
}

// Save results to file
async function saveResults(results, filename = 'accessibility-report.json') {
    try {
        await writeFile(filename, JSON.stringify(results, null, 2));
        console.log(`📁 Report saved to: ${filename}`);
        return filename;
    } catch (error) {
        console.error(`❌ Failed to save report:`, error.message);
        return null;
    }
}

// Main execution
async function main() {
    const url = "https://danielsofran.github.io/Contrast/";
    console.log('♿ Starting accessibility audit...\n');

    const results = await testWithAxeCore(url);

    if (results.error) {
        console.error('❌ Test failed:', results.error);
        process.exit(1);
    }

    // Save detailed report
    const reportFile = await saveResults(results);

    // Print summary
    console.log('\n📊 Accessibility Audit Summary:');
    console.log('==============================');
    console.log(`URL: ${results.url}`);
    console.log(`Title: ${results.pageTitle}`);
    console.log(`Timestamp: ${results.timestamp}`);
    console.log(`\nResults:`);
    console.log(`  Violations: ${results.summary.violations} issues found`);
    console.log(`  Passes: ${results.summary.passes} checks passed`);
    console.log(`  Incomplete: ${results.summary.incomplete} checks need review`);

    if (results.violations && results.violations.length > 0) {
        console.log('\n⚠️  Violations found:');
        results.violations.forEach((v, i) => {
            console.log(`  ${i + 1}. ${v.id} (${v.impact}) - ${v.description}`);
            console.log(`     Affects ${v.nodes} element(s)`);
            console.log(`     Help: ${v.help}`);
        });
    } else {
        console.log('\n✅ No violations found!');
    }

    // Exit with appropriate code
    process.exit(results.summary.violations > 0 ? 1 : 0);
}

// Run if this is the main module
main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

// Export for use in other modules
export { testWithAxeCore, saveResults };