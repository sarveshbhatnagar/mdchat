// src/commands/edit.js
import fs from "fs";
import path from "path";
import { askLLM } from "../core/llm.js";

const EDIT_ACTIONS = {
  simplify: "Simplify the following content to make it easier to understand while keeping the key information",
  clarify: "Clarify the following content by making it more clear and precise",
  shorten: "Shorten the following content while preserving the essential information",
  expand: "Expand the following content with more details and examples",
  improve: "Improve the following content by enhancing its quality, clarity, and readability",
  rewrite: "Rewrite the following content with better structure and flow",
  translate: "Translate the following content",
  fix: "Fix any grammar, spelling, or style issues in the following content"
};

export default async function edit(filePath, options = {}) {
  try {
    // Extract CLI config options
    const { provider, model, apiKey, baseUrl, ...otherOptions } = options;
    const cliConfig = { provider, model, apiKey, baseUrl };
    
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Error: File not found: ${filePath}`);
      process.exit(1);
    }
    
    // Read the original file
    const originalContent = await fs.promises.readFile(filePath, "utf8");
    console.log(`📄 Reading file: ${filePath}`);
    
    // Determine what to edit
    let contentToEdit = originalContent;
    let editContext = "entire file";
    
    if (otherOptions.section) {
      // Extract specific section
      const section = extractSection(originalContent, otherOptions.section);
      if (section) {
        contentToEdit = section.content;
        editContext = `section "${otherOptions.section}"`;
        console.log(`🎯 Targeting ${editContext}`);
      } else {
        console.log(`⚠️  Section "${otherOptions.section}" not found, editing entire file`);
      }
    }
    
    // Determine the action
    const action = otherOptions.action || "improve";
    if (!EDIT_ACTIONS[action]) {
      console.error(`❌ Error: Unknown action "${action}"`);
      console.error(`Available actions: ${Object.keys(EDIT_ACTIONS).join(", ")}`);
      process.exit(1);
    }
    
    console.log(`🔄 Action: ${action} (${editContext})`);
    
    // Create the editing prompt
    let prompt = `${EDIT_ACTIONS[action]}. Maintain the markdown formatting and structure:

${contentToEdit}`;

    // Add custom instructions if provided
    if (otherOptions.instructions) {
      prompt = `${EDIT_ACTIONS[action]}. Additional instructions: ${otherOptions.instructions}

Maintain the markdown formatting and structure:

${contentToEdit}`;
    }
    
    // Get AI edit
    const editedContent = await askLLM(prompt, cliConfig);
    
    // Handle output
    if (otherOptions.section) {
      if (otherOptions.replace) {
        // Section replace - replace only the specific section in the file
        await handleSectionReplace(filePath, originalContent, otherOptions.section, editedContent, otherOptions);
      } else {
        // Section edit - show both original and edited
        await handleSectionEdit(filePath, originalContent, otherOptions.section, editedContent, otherOptions);
      }
    } else if (otherOptions.replace) {
      // Replace the entire file
      await handleFileReplace(filePath, editedContent, otherOptions);
    } else {
      // Show diff/comparison
      await handleComparisonOutput(filePath, originalContent, editedContent, otherOptions);
    }
    
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

/**
 * Extract a specific section from markdown content
 */
function extractSection(content, sectionName) {
  // Try to find section by header
  const lines = content.split('\n');
  let sectionStart = -1;
  let sectionEnd = lines.length;
  let headerLevel = 0;
  
  // Find section start
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (match) {
      const level = match[1].length;
      const title = match[2].toLowerCase();
      
      if (title.includes(sectionName.toLowerCase()) || 
          sectionName.toLowerCase().includes(title)) {
        sectionStart = i;
        headerLevel = level;
        break;
      }
    }
  }
  
  if (sectionStart === -1) {
    return null;
  }
  
  // Find section end (next header of same or higher level)
  for (let i = sectionStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (match && match[1].length <= headerLevel) {
      sectionEnd = i;
      break;
    }
  }
  
  return {
    content: lines.slice(sectionStart, sectionEnd).join('\n'),
    start: sectionStart,
    end: sectionEnd
  };
}

/**
 * Handle section editing output
 */
async function handleSectionEdit(filePath, originalContent, sectionName, editedContent, options) {
  const section = extractSection(originalContent, sectionName);
  
  if (!section) {
    console.log("⚠️  Could not locate section for replacement");
    return;
  }
  
  if (options.output) {
    // Save to output file
    const block = `<!-- AI:edit -->\n## Edited Section: ${sectionName}\n\n${editedContent}\n<!-- /AI -->\n`;
    await fs.promises.appendFile(options.output, `\n\n${block}`);
    console.log(`✔ Edited section appended to ${options.output}`);
  } else {
    // Display comparison
    console.log("\n🔍 Original section:");
    console.log("```markdown");
    console.log(section.content);
    console.log("```");
    
    console.log("\n✨ Edited section:");
    console.log("```markdown");
    console.log(editedContent);
    console.log("```");
    
    console.log(`\n💡 To replace the section, use: --replace`);
    console.log(`💡 To save to file, use: -o filename.md`);
  }
}

/**
 * Handle section replacement in the original file
 */
async function handleSectionReplace(filePath, originalContent, sectionName, editedContent, options) {
  const section = extractSection(originalContent, sectionName);
  
  if (!section) {
    console.log("⚠️  Could not locate section for replacement");
    return;
  }
  
  // Create backup
  const backupPath = `${filePath}.backup.${Date.now()}`;
  await fs.promises.copyFile(filePath, backupPath);
  console.log(`💾 Backup created: ${backupPath}`);
  
  // Split original content into lines
  const lines = originalContent.split('\n');
  
  // Replace the section content
  const beforeSection = lines.slice(0, section.start);
  const afterSection = lines.slice(section.end);
  
  // Combine with edited content
  const newContent = [
    ...beforeSection,
    editedContent,
    ...afterSection
  ].join('\n');
  
  // Write the updated content
  await fs.promises.writeFile(filePath, newContent);
  console.log(`✔ Section "${sectionName}" replaced in ${filePath}`);
}

/**
 * Handle file replacement
 */
async function handleFileReplace(filePath, editedContent, options) {
  // Create backup
  const backupPath = `${filePath}.backup.${Date.now()}`;
  await fs.promises.copyFile(filePath, backupPath);
  console.log(`💾 Backup created: ${backupPath}`);
  
  // Replace file content
  await fs.promises.writeFile(filePath, editedContent);
  console.log(`✔ File replaced: ${filePath}`);
}

/**
 * Handle comparison output
 */
async function handleComparisonOutput(filePath, originalContent, editedContent, options) {
  if (options.output) {
    // Save to output file
    const block = `<!-- AI:edit -->\n## Edited version of ${path.basename(filePath)}\n\n${editedContent}\n<!-- /AI -->\n`;
    await fs.promises.appendFile(options.output, `\n\n${block}`);
    console.log(`✔ Edited content appended to ${options.output}`);
  } else {
    // Display the edited content
    console.log("\n✨ Edited content:");
    const block = `<!-- AI:edit -->\n${editedContent}\n<!-- /AI -->\n`;
    console.log(block);
    
    console.log(`\n💡 To replace the original file, use: --replace`);
    console.log(`💡 To save to a new file, use: -o filename.md`);
  }
}

/**
 * Interactive section selection
 */
export async function listSections(filePath) {
  const content = await fs.promises.readFile(filePath, "utf8");
  const lines = content.split('\n');
  const sections = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (match) {
      sections.push({
        level: match[1].length,
        title: match[2],
        line: i + 1,
        indent: '  '.repeat(match[1].length - 1)
      });
    }
  }
  
  if (sections.length === 0) {
    console.log("📄 No sections found in the file");
    return;
  }
  
  console.log(`📋 Sections in ${path.basename(filePath)}:`);
  sections.forEach((section, index) => {
    console.log(`${index + 1}. ${section.indent}${section.title} (line ${section.line})`);
  });
}
