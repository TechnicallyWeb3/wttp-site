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

  constructor(sitePath: string) {
    this.sitePath = path.resolve(sitePath);
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

  private discoverHtmlFiles(): void {
    const walkDir = (dir: string) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        
        if (file.isDirectory()) {
          walkDir(fullPath);
        } else if (file.name.endsWith('.html') && !file.name.includes('backup')) {
          // Exclude backup files from processing (backup.html, *.backup.html)
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
      
      // Look for Ninja Forms JavaScript data
      const formDataRegex = /var\s+formDisplay\s*=\s*1;[\s\S]*?var\s+form\s*=\s*\[\];[\s\S]*?form\.id\s*=\s*['"](\d+)['"];[\s\S]*?form\.settings\s*=\s*(\{[\s\S]*?\});[\s\S]*?form\.fields\s*=\s*(\[[\s\S]*?\]);/g;
      
      let match;
      while ((match = formDataRegex.exec(content)) !== null) {
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
      // If direct parsing fails, try to extract just the data we need
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
      
      // Replace Ninja Forms containers - match from noscript through the form container's closing div
      // This matches: noscript tag + whitespace + form div + content + spinner div + whitespace + closing div
      const ninjaFormRegex = /<noscript class="ninja-forms-noscript-message">[\s\S]*?<\/noscript>\s*<div\s+id="nf-form-\d+-cont"[^>]*>[\s\S]*?<div class="nf-loading-spinner"><\/div>[\s\S]*?<\/div>/g;
      
      content = content.replace(ninjaFormRegex, (match) => {
        modified = true;
        
        // Find which form this is
        const form = this.formsFound[0]; // For now, use the first form found
        
        return this.generateReplacementForm(form);
      });
      
      // Remove Ninja Forms JavaScript more carefully
      content = this.removeNinjaFormsJS(content);
      
      if (modified) {
        // Create backup before modifying
        const backupPath = htmlFile.replace('.html', '.backup.html');
        const originalContent = fs.readFileSync(htmlFile, 'utf-8');
        fs.writeFileSync(backupPath, originalContent);
        console.log(`💾 Created backup: ${path.relative(this.sitePath, backupPath)}`);
        
        fs.writeFileSync(htmlFile, content);
        console.log(`✏️  Updated form in ${path.relative(this.sitePath, htmlFile)}`);
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
    // Remove Ninja Forms JavaScript blocks
    content = content.replace(/<script[^>]*>[\s\S]*?var formDisplay=1;[\s\S]*?<\/script>/g, '');
    content = content.replace(/<script[^>]*id="tmpl-nf-[^"]*"[\s\S]*?<\/script>/g, '');
    content = content.replace(/<noscript class="ninja-forms-noscript-message">[\s\S]*?<\/noscript>/g, '');
    
    // Remove Ninja Forms CSS/JS file references
    content = content.replace(/<link[^>]*ninja-forms[^>]*>/g, '');
    content = content.replace(/<script[^>]*ninja-forms[^>]*><\/script>/g, '');
    content = content.replace(/<script[^>]*nf-front-end[^>]*><\/script>/g, '');
    
    return content;
  }
}

task("wp-ninja-fix", "Replace Ninja Forms with custom HTML forms")
  .addParam("path", "Path to WordPress site directory")
  .addFlag("dryRun", "Show what would be done without making changes")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { path: sitePath, dryRun } = taskArgs;

    if (!fs.existsSync(sitePath)) {
      throw new Error(`Site path does not exist: ${sitePath}`);
    }

    const fixer = new NinjaFormsFixer(sitePath);
    
    try {
      if (dryRun) {
        console.log('🔍 Dry run mode - no changes will be made');
        // TODO: Add dry run analysis
        return;
      }

      await fixer.fix();
      
    } catch (error) {
      console.error('❌ Error:', error);
      throw error;
    }
  });

export {};
