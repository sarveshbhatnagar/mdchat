// src/commands/insert.js
import fs from "fs";
import { askLLM } from "../core/llm.js";

/**
 * Find AI insert blocks in content
 * @param {string} content - File content
 * @returns {Array} Array of insert block objects with start, end, and context
 */
function findInsertBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for insert start markers
    if (line.match(/<!--\s*AI\s*-?\s*insert\s+(here|start)\s*-->/i)) {
      const startLine = i;
      let endLine = -1;
      
      // Find the corresponding end marker
      for (let j = i + 1; j < lines.length; j++) {
        const endLineContent = lines[j].trim();
        if (endLineContent.match(/<!--\s*AI\s*insert\s+end\s*-->/i) || 
            endLineContent.match(/<!--\s*\/AI\s*-->/i)) {
          endLine = j;
          break;
        }
      }
      
      if (endLine !== -1) {
        // Get context before and after the block
        const contextBefore = lines.slice(Math.max(0, startLine - 10), startLine).join('\n');
        const contextAfter = lines.slice(endLine + 1, Math.min(lines.length, endLine + 11)).join('\n');
        
        blocks.push({
          startLine,
          endLine,
          contextBefore: contextBefore.trim(),
          contextAfter: contextAfter.trim(),
          originalContent: lines.slice(startLine, endLine + 1).join('\n')
        });
        
        i = endLine; // Skip to after this block
      }
    }
  }
  
  return blocks;
}

/**
 * Generate content for an insert block based on context
 * @param {Object} block - Insert block object
 * @param {Object} options - CLI options
 * @returns {Promise<string>} Generated content
 */
async function generateInsertContent(block, options = {}) {
  const prompt = `You are helping to write content that flows naturally between existing paragraphs. 

CONTEXT BEFORE:
${block.contextBefore}

CONTEXT AFTER:
${block.contextAfter}

Please write a paragraph or section that connects the content above and below smoothly. The content should:
1. Flow naturally from the preceding content
2. Lead logically into the following content  
3. Match the writing style and tone
4. Be relevant and add value to the overall narrative
5. Be appropriately detailed for the context

Write only the content that should be inserted, without any explanatory text or markers.`;

  return await askLLM(prompt, options);
}

/**
 * Insert command implementation
 * @param {string} filePath - Path to the markdown file
 * @param {Object} options - Command options
 */
export default async function insert(filePath, options = {}) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Find insert blocks
    const insertBlocks = findInsertBlocks(content);
    
    if (insertBlocks.length === 0) {
      console.log("ℹ️ No AI insert blocks found in the file.");
      console.log("💡 Add insert blocks like this:");
      console.log("   <!-- AI insert here -->");
      console.log("   <!-- AI insert end -->");
      return;
    }

    console.log(`🔍 Found ${insertBlocks.length} insert block(s) to process...`);

    let updatedContent = content;
    let totalOffset = 0;

    // Process blocks in reverse order to maintain line numbers
    for (let i = insertBlocks.length - 1; i >= 0; i--) {
      const block = insertBlocks[i];
      
      console.log(`\n📝 Processing insert block ${i + 1}/${insertBlocks.length}...`);
      
      if (options.preview) {
        console.log("Context before:");
        console.log(block.contextBefore.substring(0, 200) + (block.contextBefore.length > 200 ? "..." : ""));
        console.log("\nContext after:");
        console.log(block.contextAfter.substring(0, 200) + (block.contextAfter.length > 200 ? "..." : ""));
        continue;
      }

      // Extract CLI config options
      const { provider, model, apiKey, baseUrl, ...otherOptions } = options;
      const cliConfig = { provider, model, apiKey, baseUrl };
      
      // Generate content for this block
      const generatedContent = await generateInsertContent(block, cliConfig);
      
      // Replace the insert block with generated content
      const lines = updatedContent.split('\n');
      const beforeLines = lines.slice(0, block.startLine);
      const afterLines = lines.slice(block.endLine + 1);
      
      // Create the replacement content with AI markers
      const replacement = [
        '<!-- AI:insert -->',
        generatedContent.trim(),
        '<!-- /AI -->'
      ];
      
      updatedContent = [...beforeLines, ...replacement, ...afterLines].join('\n');
      
      console.log(`✅ Generated content for block ${i + 1}`);
    }

    if (options.preview) {
      console.log(`\n👁️ Preview mode: Found ${insertBlocks.length} insert blocks that would be processed.`);
      return;
    }

    // Save the updated content
    if (options.output) {
      fs.writeFileSync(options.output, updatedContent);
      console.log(`\n💾 Updated content saved to: ${options.output}`);
    } else {
      // Create backup
      const backupPath = `${filePath}.backup`;
      fs.writeFileSync(backupPath, content);
      
      // Update original file
      fs.writeFileSync(filePath, updatedContent);
      console.log(`\n💾 File updated: ${filePath}`);
      console.log(`📋 Backup created: ${backupPath}`);
    }

    console.log(`\n🎉 Successfully processed ${insertBlocks.length} insert block(s)!`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}
