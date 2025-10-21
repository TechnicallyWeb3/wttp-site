import { task } from "hardhat/config";
import * as fs from "fs";
import * as path from "path";
import { HardhatRuntimeEnvironment } from "hardhat/types";

interface FormField {
  id: number;
  type: string;
  label: string;
  key: string;
  required: boolean;
  placeholder?: string;
  order: number;
}

interface NinjaForm {
  id: string;
  title: string;
  fields: FormField[];
}

class NinjaFormsFixer {
  private sitePath: string;
  private htmlFiles: string[] = [];
  private formsFound: NinjaForm[] = [];
  private createBackups: boolean;

  constructor(sitePath: string, createBackups: boolean = false) {
    this.sitePath = path.resolve(sitePath);
    this.createBackups = createBackups;
  }

  async fix(): Promise<void> {
    console.log(`🔧 Fixing Ninja Forms in: ${this.sitePath}`);
    
    // Find all HTML files
    this.discoverHtmlFiles();
    
    // Scan for Ninja Forms
    await this.scanForNinjaForms();
    
    if (this.formsFound.length === 0) {
      console.log("ℹ️  No Ninja Forms found to fix.");
      return;
    }
    
    console.log(`📝 Found ${this.formsFound.length} Ninja Form(s) to replace`);
    
    // Replace forms in HTML files
    await this.replaceFormsInFiles();
    
    console.log("✅ Ninja Forms replacement complete!");
  }

  async dryRunAnalysis(): Promise<void> {
    console.log(`🔧 Analyzing Ninja Forms in: ${this.sitePath}`);
    
    // Find all HTML files
    this.discoverHtmlFiles();
    
    // Scan for Ninja Forms
    await this.scanForNinjaForms();
    
    if (this.formsFound.length === 0) {
      console.log("ℹ️  No Ninja Forms found to analyze.");
      return;
    }
    
    console.log(`\n📊 DRY RUN ANALYSIS:`);
    console.log(`   Forms found: ${this.formsFound.length}`);
    this.formsFound.forEach((form, index) => {
      console.log(`   ${index + 1}. "${form.title}" (ID: ${form.id}) - ${form.fields.length} fields`);
    });
    
    console.log(`\n🔬 FULL SIMULATION (showing actual impact):`);
    
    // Analyze what would be changed in each file with FULL simulation
    for (const htmlFile of this.htmlFiles) {
      let content = fs.readFileSync(htmlFile, 'utf-8');
      const originalSize = content.length;
      let hasNinjaForms = false;
      
      // Test form container replacement
      const ninjaFormRegex = /<noscript class="ninja-forms-noscript-message">\s*Notice: JavaScript is required for this content\.\s*<\/noscript>\s*<div\s+id="nf-form-\d+-cont"[^>]*>\s*<div class="nf-loading-spinner"><\/div>\s*<\/div>/g;
      const formMatches = content.match(ninjaFormRegex);
      
      if (formMatches) {
        hasNinjaForms = true;
        console.log(`\n📄 ${path.relative(this.sitePath, htmlFile)}:`);
        console.log(`   📏 Original size: ${originalSize.toLocaleString()} characters`);
        
        // Simulate form replacement
        let simulatedContent = content;
        formMatches.forEach((match, index) => {
          const form = this.formsFound[0]; // Use first form for simulation
          const replacement = this.generateReplacementForm(form);
          const position = simulatedContent.indexOf(match);
          
          console.log(`   🔄 Form ${index + 1}: Replace ${match.length} chars with ${replacement.length} chars at position ${position.toLocaleString()}`);
          console.log(`      Original: "${match.substring(0, 50)}${match.length > 50 ? '...' : ''}"`);
          console.log(`      Replacement: "${replacement.substring(0, 50)}${replacement.length > 50 ? '...' : ''}"`);
          
          simulatedContent = simulatedContent.replace(match, replacement);
        });
        
        // Simulate JavaScript removal
        console.log(`   🎯 JavaScript cleanup simulation:`);
        const jsCleanedContent = this.removeNinjaFormsJS(simulatedContent);
        const finalSize = jsCleanedContent.length;
        const totalChange = finalSize - originalSize;
        
        console.log(`   📏 Final size: ${finalSize.toLocaleString()} characters`);
        console.log(`   📊 Net change: ${totalChange > 0 ? '+' : ''}${totalChange.toLocaleString()} characters`);
        
        // Validate critical content preservation
        const criticalSections = [
          '<!DOCTYPE html>',
          '<html',
          '<head',
          '<body',
          '</body>',
          '</html>',
          '<main',
          'wp-site-blocks'
        ];
        
        const missingCritical = criticalSections.filter(section => 
          content.includes(section) && !jsCleanedContent.includes(section)
        );
        
        if (missingCritical.length > 0) {
          console.log(`   ⚠️  WARNING: Critical content might be removed: ${missingCritical.join(', ')}`);
        } else {
          console.log(`   ✅ Critical page structure preserved`);
        }
        
        // Check for potential over-removal
        const scriptTagsBefore = (content.match(/<script[^>]*>/g) || []).length;
        const scriptTagsAfter = (jsCleanedContent.match(/<script[^>]*>/g) || []).length;
        const scriptsRemoved = scriptTagsBefore - scriptTagsAfter;
        
        console.log(`   📜 Script tags: ${scriptTagsBefore} → ${scriptTagsAfter} (removed: ${scriptsRemoved})`);
        
        if (scriptsRemoved > 5) {
          console.log(`   ⚠️  WARNING: Many script tags removed (${scriptsRemoved}). Review for over-removal.`);
        }
        
        if (this.createBackups) {
          // Generate proper backup filename: index.html -> index.ninja.html
          const dir = path.dirname(htmlFile);
          const filename = path.basename(htmlFile, '.html');
          const backupPath = path.join(dir, `${filename}.ninja.html`);
          
          console.log(`   💾 Would create backup: ${path.relative(this.sitePath, backupPath)}`);
          
          const wttpIgnorePath = path.join(this.sitePath, '.wttpignore');
          if (fs.existsSync(wttpIgnorePath)) {
            const relativePath = path.relative(this.sitePath, backupPath);
            console.log(`   📝 Would add to .wttpignore: ${relativePath.replace(/\\/g, '/')}`);
          }
        } else {
          console.log(`   ℹ️  No backup will be created (use --backup flag to enable)`);
        }
      }
    }
    
    if (!this.htmlFiles.some(file => {
      const content = fs.readFileSync(file, 'utf-8');
      return /<noscript class="ninja-forms-noscript-message">/.test(content);
    })) {
      console.log(`\n✨ No files contain Ninja Forms to replace.`);
    }
    
    console.log(`\n💡 To proceed with these changes, run without --dry-run flag.`);
    
    console.log(`\n📋 To apply these changes, run the command again without --dry-run`);
  }

  private discoverHtmlFiles(): void {
    const walkDir = (dir: string) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        
        if (file.isDirectory()) {
          walkDir(fullPath);
        } else if (file.name.endsWith('.html') && !file.name.includes('backup') && !file.name.includes('ninja') && !file.name.includes('routes')) {
          // Exclude backup files from processing (backup.html, *.backup.html, *.ninja.html, *.routes.html)
          this.htmlFiles.push(fullPath);
        }
      }
    };
    
    walkDir(this.sitePath);
    console.log(`📁 Found ${this.htmlFiles.length} HTML files to scan`);
  }

  private async scanForNinjaForms(): Promise<void> {
    for (const htmlFile of this.htmlFiles) {
      const content = fs.readFileSync(htmlFile, 'utf-8');
      
      // Look for Ninja Forms JavaScript data - handle both old and new formats
      // New format: formContentData in settings object (handles nfForms variable too)
      const newFormatRegex = /var\s+formDisplay\s*=\s*1;[\s\S]*?var\s+form\s*=\s*\[\];[\s\S]*?form\.id\s*=\s*['"](\d+)['"];[\s\S]*?form\.settings\s*=\s*(\{[\s\S]*?\});/g;
      // Old format: separate form.fields assignment
      const oldFormatRegex = /var\s+formDisplay\s*=\s*1;[\s\S]*?var\s+form\s*=\s*\[\];[\s\S]*?form\.id\s*=\s*['"](\d+)['"];[\s\S]*?form\.settings\s*=\s*(\{[\s\S]*?\});[\s\S]*?form\.fields\s*=\s*(\[[\s\S]*?\]);/g;
      
      // Try new format first
      let match;
      newFormatRegex.lastIndex = 0;
      while ((match = newFormatRegex.exec(content)) !== null) {
        try {
          const formId = match[1];
          const settingsStr = match[2];
          
          // Parse settings to get form title and fields
          const settings = this.safeJsonParse(settingsStr);
          
          if (settings) {
            let parsedFields: FormField[] = [];
            
            // Check if formContentData exists in settings (new format)
            if (settings.formContentData && Array.isArray(settings.formContentData)) {
              // Convert formContentData array to field objects  
              parsedFields = this.parseFormContentData(settings.formContentData);
            }
            
            if (parsedFields.length > 0) {
              this.formsFound.push({
                id: formId,
                title: settings.title || settings.form_title || 'Contact Form',
                fields: parsedFields
              });
              
              console.log(`📋 Found form: "${settings.title || settings.form_title}" with ${parsedFields.length} fields in ${path.relative(this.sitePath, htmlFile)}`);
            }
          }
        } catch (error) {
          console.warn(`⚠️  Error parsing form data in ${htmlFile}:`, error);
        }
      }
      
      // Try old format as fallback
      oldFormatRegex.lastIndex = 0;
      while ((match = oldFormatRegex.exec(content)) !== null) {
        try {
          const formId = match[1];
          const settingsStr = match[2];
          const fieldsStr = match[3];
          
          // Parse settings to get form title
          const settings = this.safeJsonParse(settingsStr);
          const fields = this.safeJsonParse(fieldsStr);
          
          if (settings && fields && Array.isArray(fields)) {
            const parsedFields = this.parseFormFields(fields);
            
            this.formsFound.push({
              id: formId,
              title: settings.title || 'Contact Form',
              fields: parsedFields
            });
            
            console.log(`📋 Found form: "${settings.title}" with ${parsedFields.length} fields in ${path.relative(this.sitePath, htmlFile)}`);
          }
        } catch (error) {
          console.warn(`⚠️  Error parsing form data in ${htmlFile}:`, error);
        }
      }
    }
  }

  private safeJsonParse(jsonStr: string): any {
    try {
      // Clean up the JSON string
      let cleaned = jsonStr
        .replace(/\\\//g, '/') // Fix escaped slashes
        .replace(/\\"/g, '"')  // Fix escaped quotes
        .replace(/(['"])?([a-zA-Z_$][a-zA-Z0-9_$]*)\1?:/g, '"$2":'); // Quote unquoted keys
      
      return JSON.parse(cleaned);
    } catch (e) {
      // If direct parsing fails, try to extract key data manually
      if (jsonStr.includes('"formContentData"')) {
        const formContentMatch = jsonStr.match(/"formContentData":\s*(\[.*?\])/);
        const titleMatch = jsonStr.match(/"title":\s*"([^"]+)"/);
        const formTitleMatch = jsonStr.match(/"form_title":\s*"([^"]+)"/);
        
        if (formContentMatch) {
          try {
            const formContentData = JSON.parse(formContentMatch[1]);
            return {
              title: titleMatch ? titleMatch[1] : (formTitleMatch ? formTitleMatch[1] : 'Contact Form'),
              form_title: formTitleMatch ? formTitleMatch[1] : undefined,
              formContentData: formContentData
            };
          } catch (parseError) {
            // Continue to fallback
          }
        }
      }
      
      // Fallback: extract just title
      if (jsonStr.includes('"title"')) {
        const titleMatch = jsonStr.match(/"title":\s*"([^"]+)"/);
        return { title: titleMatch ? titleMatch[1] : 'Contact Form' };
      }
      return null;
    }
  }

  private parseFormFields(fieldsData: any[]): FormField[] {
    const fields: FormField[] = [];
    
    for (const field of fieldsData) {
      if (field.type === 'submit') continue; // Skip submit buttons
      
      fields.push({
        id: field.id || fields.length + 1,
        type: this.normalizeFieldType(field.type),
        label: field.label || field.key || 'Field',
        key: field.key || field.label?.toLowerCase().replace(/\s+/g, '_') || `field_${field.id}`,
        required: Boolean(field.required),
        placeholder: field.placeholder || '',
        order: field.order || fields.length + 1
      });
    }
    
    // Sort by order
    fields.sort((a, b) => a.order - b.order);
    
    return fields;
  }

  private parseFormContentData(formContentData: string[]): FormField[] {
    const fields: FormField[] = [];
    
    for (let i = 0; i < formContentData.length; i++) {
      const fieldKey = formContentData[i];
      
      if (fieldKey === 'submit') continue; // Skip submit buttons
      
      // Generate field info from the key
      let fieldType = 'text';
      let fieldLabel = this.generateLabelFromKey(fieldKey);
      
      // Detect field type from key patterns
      if (fieldKey.includes('email')) {
        fieldType = 'email';
      } else if (fieldKey.includes('phone')) {
        fieldType = 'tel';
      } else if (fieldKey.includes('message')) {
        fieldType = 'textarea';
      } else if (fieldKey.includes('contact_method') || fieldKey.includes('preferred_contact')) {
        fieldType = 'select';
      }
      
      fields.push({
        id: i + 1,
        type: fieldType,
        label: fieldLabel,
        key: fieldKey,
        required: ['name', 'email'].some(req => fieldKey.includes(req)), // Assume name and email are required
        placeholder: '',
        order: i + 1
      });
    }
    
    return fields;
  }

  private generateLabelFromKey(key: string): string {
    // Convert field keys to readable labels
    if (key === 'name') return 'Name';
    if (key === 'email') return 'Email';
    if (key.includes('phone')) return 'Phone';
    if (key.includes('message')) return 'Message';
    if (key.includes('contact_method') || key.includes('preferred_contact')) return 'Preferred Contact Method';
    
    // Generic conversion: remove numbers, replace underscores with spaces, capitalize
    return key
      .replace(/_\d+$/, '') // Remove trailing numbers like _1760598589490
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private normalizeFieldType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'textbox': 'text',
      'email': 'email',
      'phone': 'tel',
      'textarea': 'textarea',
      'number': 'number',
      'url': 'url',
      'date': 'date'
    };
    
    return typeMap[type] || 'text';
  }

  private async replaceFormsInFiles(): Promise<void> {
    for (const htmlFile of this.htmlFiles) {
      let content = fs.readFileSync(htmlFile, 'utf-8');
      let modified = false;
      
      console.log(`\n🔍 Processing file: ${path.relative(this.sitePath, htmlFile)}`);
      console.log(`📄 File size: ${content.length} characters`);
      
      // PRECISE: Match the exact Ninja Forms structure we found in the backup
      // This matches: noscript + newlines + form div + whitespace + spinner + whitespace + closing div
      const ninjaFormRegex = /<noscript class="ninja-forms-noscript-message">\s*Notice: JavaScript is required for this content\.\s*<\/noscript>\s*<div\s+id="nf-form-\d+-cont"[^>]*>\s*<div class="nf-loading-spinner"><\/div>\s*<\/div>/g;
      
      console.log(`🔎 Testing Ninja Forms regex pattern...`);
      const matches = content.match(ninjaFormRegex);
      if (matches) {
        console.log(`✅ Found ${matches.length} Ninja Forms container(s)`);
        matches.forEach((match, index) => {
          console.log(`\n📋 Match ${index + 1}:`);
          console.log(`   Length: ${match.length} characters`);
          console.log(`   First 200 chars: ${match.substring(0, 200)}...`);
          console.log(`   Last 200 chars: ...${match.substring(match.length - 200)}`);
        });
      } else {
        console.log(`❌ No Ninja Forms containers found with current regex`);
        
        // Let's try to find any noscript tags
        const noscriptMatches = content.match(/<noscript[^>]*>[\s\S]*?<\/noscript>/g);
        if (noscriptMatches) {
          console.log(`🔍 Found ${noscriptMatches.length} noscript tag(s):`);
          noscriptMatches.forEach((match, index) => {
            console.log(`   ${index + 1}: ${match.substring(0, 100)}...`);
          });
        }
        
        // Let's try to find any form-related divs
        const formDivMatches = content.match(/<div[^>]*(?:nf-form|ninja-form|form)[^>]*>[\s\S]*?<\/div>/g);
        if (formDivMatches) {
          console.log(`🔍 Found ${formDivMatches.length} form-related div(s):`);
          formDivMatches.forEach((match, index) => {
            console.log(`   ${index + 1}: ${match.substring(0, 100)}...`);
          });
        }
      }
      
      content = content.replace(ninjaFormRegex, (match, offset) => {
        modified = true;
        
        console.log(`\n🔄 REPLACING MATCH at position ${offset}:`);
        console.log(`📥 ORIGINAL (${match.length} chars):`);
        if (match.length > 400) {
          console.log(`   First 200: ${match.substring(0, 200)}...`);
          console.log(`   Last 200: ...${match.substring(match.length - 200)}`);
        } else {
          console.log(`   ${match}`);
        }
        
        // Find which form this is
        const form = this.formsFound[0]; // For now, use the first form found
        const replacement = this.generateReplacementForm(form);
        
        console.log(`📤 REPLACEMENT (${replacement.length} chars):`);
        console.log(`   First 200: ${replacement.substring(0, 200)}...`);
        
        return replacement;
      });
      
      // Remove Ninja Forms JavaScript more carefully
      console.log(`\n🧹 Removing Ninja Forms JavaScript...`);
      const originalLength = content.length;
      content = this.removeNinjaFormsJS(content);
      if (content.length !== originalLength) {
        console.log(`   Removed ${originalLength - content.length} characters of JS`);
      }
      
      if (modified) {
        let backupPath: string | null = null;
        
        // Create backup only if flag is set AND file contains Ninja Forms
        if (this.createBackups && matches && matches.length > 0) {
          // Generate proper backup filename: index.html -> index.ninja.html
          const dir = path.dirname(htmlFile);
          const filename = path.basename(htmlFile, '.html');
          backupPath = path.join(dir, `${filename}.ninja.html`);
          
          const originalContent = fs.readFileSync(htmlFile, 'utf-8');
          fs.writeFileSync(backupPath, originalContent);
          console.log(`💾 Created backup: ${path.relative(this.sitePath, backupPath)}`);
          
          // Add to .wttpignore if it exists
          this.addToWttpIgnore(backupPath);
        }
        
        fs.writeFileSync(htmlFile, content);
        console.log(`✏️  Updated form in ${path.relative(this.sitePath, htmlFile)}`);
        console.log(`📊 Final file size: ${content.length} characters`);
      } else {
        console.log(`⏭️  No changes made to ${path.relative(this.sitePath, htmlFile)}`);
      }
    }
  }

  private generateReplacementForm(form: NinjaForm): string {
    const formHtml = `
<div id="custom-form-${form.id}" class="custom-contact-form">
  <h3>${form.title}</h3>
  <form id="contact-form-${form.id}" class="contact-form" onsubmit="return submitContactForm(event, '${form.id}')">
    ${form.fields.map(field => this.generateFieldHtml(field)).join('\n    ')}
    
    <div class="form-field">
      <button type="submit" class="submit-button">
        <span class="submit-text">Submit</span>
        <span class="submit-loading" style="display: none;">Sending...</span>
      </button>
    </div>
    
    <div id="form-message-${form.id}" class="form-message" style="display: none;"></div>
  </form>
</div>

<style>
.custom-contact-form {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.custom-contact-form h3 {
  margin-bottom: 20px;
  color: #333;
}

.form-field {
  margin-bottom: 20px;
}

.form-field label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-field input,
.form-field textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  font-family: inherit;
  transition: border-color 0.3s ease;
}

.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-color: #007cba;
  box-shadow: 0 0 0 2px rgba(0, 124, 186, 0.1);
}

.form-field textarea {
  min-height: 120px;
  resize: vertical;
}

.submit-button {
  background: #007cba;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.submit-button:hover {
  background: #005a87;
}

.submit-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.form-message {
  padding: 12px;
  border-radius: 4px;
  margin-top: 15px;
}

.form-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.form-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.required {
  color: #e74c3c;
}
</style>

<script>
async function submitContactForm(event, formId) {
  event.preventDefault();
  
  const form = event.target;
  const submitButton = form.querySelector('.submit-button');
  const submitText = form.querySelector('.submit-text');
  const submitLoading = form.querySelector('.submit-loading');
  const messageDiv = document.getElementById('form-message-' + formId);
  
  // Disable submit button and show loading
  submitButton.disabled = true;
  submitText.style.display = 'none';
  submitLoading.style.display = 'inline';
  messageDiv.style.display = 'none';
  
  // Collect form data
  const formData = new FormData(form);
  const formObject = {};
  for (let [key, value] of formData.entries()) {
    formObject[key] = value;
  }
  
  try {
    // Get current URL host
    const currentHost = window.location.hostname;
    
    // Prepare API URL
    const apiUrl = \`https://notify.mancino.ca/api/form-response?url=\${encodeURIComponent(currentHost)}&response=\${encodeURIComponent(JSON.stringify(formObject))}\`;
    
    // Submit to your API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: currentHost,
        response: formObject,
        form_id: formId,
        timestamp: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      // Success
      messageDiv.className = 'form-message success';
      messageDiv.textContent = 'Thank you! Your message has been sent successfully.';
      messageDiv.style.display = 'block';
      form.reset();
    } else {
      throw new Error('Server responded with error: ' + response.status);
    }
    
  } catch (error) {
    console.error('Form submission error:', error);
    messageDiv.className = 'form-message error';
    messageDiv.textContent = 'Sorry, there was an error sending your message. Please try again or contact us directly.';
    messageDiv.style.display = 'block';
  } finally {
    // Re-enable submit button
    submitButton.disabled = false;
    submitText.style.display = 'inline';
    submitLoading.style.display = 'none';
  }
  
  return false;
}
</script>`;
    
    return formHtml;
  }

  private generateFieldHtml(field: FormField): string {
    const requiredAttr = field.required ? 'required' : '';
    const requiredMark = field.required ? '<span class="required">*</span>' : '';
    const placeholder = field.placeholder ? `placeholder="${field.placeholder}"` : '';
    
    if (field.type === 'textarea') {
      return `
    <div class="form-field">
      <label for="${field.key}">${field.label}${requiredMark}</label>
      <textarea 
        id="${field.key}" 
        name="${field.key}" 
        ${placeholder}
        ${requiredAttr}
      ></textarea>
    </div>`;
    } else {
      return `
    <div class="form-field">
      <label for="${field.key}">${field.label}${requiredMark}</label>
      <input 
        type="${field.type}" 
        id="${field.key}" 
        name="${field.key}" 
        ${placeholder}
        ${requiredAttr}
      />
    </div>`;
    }
  }

  private removeNinjaFormsJS(content: string): string {
    let modifiedContent = content;
    let totalRemoved = 0;
    
    console.log(`   🎯 Using SELECTIVE JavaScript removal (targeting Ninja Forms only)`);
    
    // 1. Remove complete Ninja Forms script blocks by ID (handle both single and double quotes)
    const nfScriptMatches = modifiedContent.match(/<script[^>]*id=['"][^'"]*nf-[^'"]*['"][^>]*>[\s\S]*?<\/script>/g);
    if (nfScriptMatches) {
      console.log(`   🗑️  Removing ${nfScriptMatches.length} Ninja Forms script block(s) by ID`);
      nfScriptMatches.forEach((match, index) => {
        console.log(`     ${index + 1}: ${match.length} characters (ID-based removal)`);
        totalRemoved += match.length;
      });
      modifiedContent = modifiedContent.replace(/<script[^>]*id=['"][^'"]*nf-[^'"]*['"][^>]*>[\s\S]*?<\/script>/g, '');
    }

    // 2. Selectively clean inline scripts that contain Ninja Forms content
    modifiedContent = modifiedContent.replace(/<script([^>]*)>([\s\S]*?)<\/script>/g, (scriptMatch, scriptAttrs, scriptContent) => {
      
      // Skip external script references (src="...") - these should never be removed unless explicitly Ninja Forms
      if (scriptAttrs.includes('src=')) {
        // Only remove if it's explicitly a Ninja Forms external script
        if (scriptAttrs.includes('ninja-forms') || scriptAttrs.includes('nf-front-end')) {
          console.log(`     🗑️  Removing Ninja Forms external script: ${scriptAttrs.substring(0, 50)}...`);
          totalRemoved += scriptMatch.length;
          return '';
        }
        // Preserve all other external scripts
        return scriptMatch;
      }
      
      // Process inline scripts
      let cleanedContent = scriptContent;
      let removedFromThisScript = 0;
      
      // Only process scripts that contain Ninja Forms data
      if (cleanedContent.includes('formDisplay') || cleanedContent.includes('nfForms') || cleanedContent.includes('ninja')) {
        const originalLength = cleanedContent.length;
        
        // Remove specific Ninja Forms variable declarations
        cleanedContent = cleanedContent.replace(/var\s+formDisplay\s*=\s*[^;]+;/g, '');
        cleanedContent = cleanedContent.replace(/var\s+nfForms\s*=\s*[^;]+;/g, '');
        cleanedContent = cleanedContent.replace(/var\s+form\s*=\s*\[\];[\s\S]*?nfForms\.push\(form\);/g, '');
        cleanedContent = cleanedContent.replace(/form\.id\s*=\s*[^;]+;[\s\S]*?form\.fields\s*=\s*\[[^\]]*\];/g, '');
        cleanedContent = cleanedContent.replace(/form\.settings\s*=\s*\{[^}]*\};/g, '');
        
        // Remove Ninja Forms specific objects and arrays
        cleanedContent = cleanedContent.replace(/nfForms\s*=\s*nfForms\s*\|\|\s*\[\];/g, '');
        cleanedContent = cleanedContent.replace(/form\s*=\s*\[\];/g, '');
        
        removedFromThisScript = originalLength - cleanedContent.length;
        if (removedFromThisScript > 0) {
          console.log(`     ✂️  Selectively removed ${removedFromThisScript} chars from inline script`);
          totalRemoved += removedFromThisScript;
        }
        
        // If we removed everything, delete the entire script block
        if (cleanedContent.trim().length <= 5) {
          console.log(`     🗑️  Removing empty Ninja Forms script block (${scriptMatch.length} chars)`);
          totalRemoved += scriptMatch.length;
          return '';
        }
        
        // Return the cleaned script
        return `<script${scriptAttrs}>${cleanedContent}</script>`;
      }
      
      // Preserve all other inline scripts unchanged
      return scriptMatch;
    });

    // 3. Remove Ninja Forms template scripts (handle both single and double quotes)
    const tmplMatches = modifiedContent.match(/<script[^>]*id=['"]tmpl-nf-[^'"]*['"][\s\S]*?<\/script>/g);
    if (tmplMatches) {
      console.log(`   🗑️  Removing ${tmplMatches.length} Ninja Forms template script(s)`);
      tmplMatches.forEach((match, index) => {
        console.log(`     ${index + 1}: ${match.length} characters`);
        totalRemoved += match.length;
      });
      modifiedContent = modifiedContent.replace(/<script[^>]*id=['"]tmpl-nf-[^'"]*['"][\s\S]*?<\/script>/g, '');
    }
    
    // 4. Remove Ninja Forms CSS/JS file references
    const linkMatches = modifiedContent.match(/<link[^>]*ninja-forms[^>]*>/g);
    if (linkMatches) {
      console.log(`   🗑️  Removing ${linkMatches.length} Ninja Forms CSS link(s)`);
      linkMatches.forEach((match) => totalRemoved += match.length);
      modifiedContent = modifiedContent.replace(/<link[^>]*ninja-forms[^>]*>/g, '');
    }
    
    const scriptRefMatches = modifiedContent.match(/<script[^>]*ninja-forms[^>]*><\/script>/g);
    if (scriptRefMatches) {
      console.log(`   🗑️  Removing ${scriptRefMatches.length} Ninja Forms script reference(s)`);
      scriptRefMatches.forEach((match) => totalRemoved += match.length);
      modifiedContent = modifiedContent.replace(/<script[^>]*ninja-forms[^>]*><\/script>/g, '');
    }
    
    const frontEndMatches = modifiedContent.match(/<script[^>]*nf-front-end[^>]*><\/script>/g);
    if (frontEndMatches) {
      console.log(`   🗑️  Removing ${frontEndMatches.length} nf-front-end script reference(s)`);
      frontEndMatches.forEach((match) => totalRemoved += match.length);
      modifiedContent = modifiedContent.replace(/<script[^>]*nf-front-end[^>]*><\/script>/g, '');
    }
    
    console.log(`   📊 Total JavaScript removed: ${totalRemoved} characters`);
    return modifiedContent;
  }

  private addToWttpIgnore(backupPath: string): void {
    const wttpIgnorePath = path.join(this.sitePath, '.wttpignore');
    
    if (!fs.existsSync(wttpIgnorePath)) {
      return; // No .wttpignore file exists
    }
    
    try {
      // Get relative path from site root
      const relativePath = path.relative(this.sitePath, backupPath);
      const entryToAdd = relativePath.replace(/\\/g, '/'); // Use forward slashes for consistency
      
      // Read existing .wttpignore
      const existingContent = fs.readFileSync(wttpIgnorePath, 'utf-8');
      
      // Check if already exists
      if (existingContent.includes(entryToAdd)) {
        console.log(`   📝 Backup already in .wttpignore: ${entryToAdd}`);
        return;
      }
      
      // Add the backup file to .wttpignore
      const newContent = existingContent.trim() + '\n' + entryToAdd + '\n';
      fs.writeFileSync(wttpIgnorePath, newContent);
      console.log(`   📝 Added to .wttpignore: ${entryToAdd}`);
      
    } catch (error) {
      console.warn(`⚠️  Failed to update .wttpignore: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

task("wp-ninja-fix", "Replace Ninja Forms with custom HTML forms")
  .addParam("path", "Path to WordPress site directory")
  .addFlag("dryRun", "Show what would be done without making changes")
  .addFlag("backup", "Create backup files and add them to .wttpignore")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { path: sitePath, dryRun, backup } = taskArgs;

    if (!fs.existsSync(sitePath)) {
      throw new Error(`Site path does not exist: ${sitePath}`);
    }

    const fixer = new NinjaFormsFixer(sitePath, backup);
    
    try {
      if (dryRun) {
        console.log('🔍 Dry run mode - no changes will be made');
        if (backup) {
          console.log('💾 Backup mode enabled - would create .backup.html files');
        }
        await fixer.dryRunAnalysis();
        return;
      }

      if (backup) {
        console.log('💾 Backup mode enabled - creating .backup.html files');
      } else {
        console.log('ℹ️  Backup mode disabled - no backup files will be created');
      }
      
      await fixer.fix();
      
    } catch (error) {
      console.error('❌ Error:', error);
      throw error;
    }
  });

export {};
