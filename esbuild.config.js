const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  try {
    // Clean dist directory
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true });
    }
    fs.mkdirSync(distPath, { recursive: true });

    // Build the bundled and minified version
    const result = await esbuild.build({
      entryPoints: ['src/shadowgit-mcp-server.ts'],
      bundle: true,
      minify: true,
      platform: 'node',
      target: 'node18',
      outfile: 'dist/shadowgit-mcp-server.js',
      external: [
        // Don't bundle node built-ins
      ],
      format: 'cjs',
      sourcemap: false,
      treeShaking: true,
      metafile: true,
      banner: {
        js: '#!/usr/bin/env node'
      },
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });

    // Print build stats
    const text = await esbuild.analyzeMetafile(result.metafile);
    console.log('Build analysis:');
    console.log(text);

    // Also build TypeScript declarations using tsc
    console.log('\nGenerating TypeScript declarations...');
    const { execSync } = require('child_process');
    execSync('tsc --emitDeclarationOnly', { stdio: 'inherit' });

    console.log('\n✅ Build completed successfully!');
    
    // Check final size
    const stats = fs.statSync('dist/shadowgit-mcp-server.js');
    console.log(`\n📦 Bundle size: ${(stats.size / 1024).toFixed(2)}KB`);
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run build if called directly
if (require.main === module) {
  build();
}

module.exports = { build };