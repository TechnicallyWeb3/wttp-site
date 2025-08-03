import mime from "mime-types";

// Helper function to determine if a MIME type is text-based and should include charset
function isTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith('text/') || 
         mimeType.includes('javascript') || 
         mimeType.includes('json') || 
         mimeType.includes('xml') || 
         mimeType.includes('html') || 
         mimeType.includes('css') || 
         mimeType.includes('svg');
}

// Helper function to determine MIME type from file extension
function getMimeType(filePath: string): string {
  const mimeType = mime.lookup(filePath);
  return mimeType ? mimeType.toString() : "application/octet-stream";
}

// Helper function to get MIME type with charset for text files
function getMimeTypeWithCharset(filePath: string): { mimeType: string; charset: string | undefined } {
  const baseMimeType = getMimeType(filePath);
  
  // For text-based files, add charset
  if (isTextMimeType(baseMimeType)) {
    return {
      mimeType: baseMimeType,
      charset: "utf-8"
    };
  }
  
  // For non-text files, no charset needed
  return {
    mimeType: baseMimeType,
    charset: undefined
  };
}

console.log('Testing charset detection...');

// Test text files
console.log('Text files:');
console.log('index.html:', getMimeTypeWithCharset('index.html'));
console.log('script.js:', getMimeTypeWithCharset('script.js'));
console.log('style.css:', getMimeTypeWithCharset('style.css'));
console.log('readme.md:', getMimeTypeWithCharset('readme.md'));
console.log('app.json:', getMimeTypeWithCharset('app.json'));
console.log('data.xml:', getMimeTypeWithCharset('data.xml'));

// Test non-text files
console.log('\nNon-text files:');
console.log('image.png:', getMimeTypeWithCharset('image.png'));
console.log('video.mp4:', getMimeTypeWithCharset('video.mp4'));
console.log('data.bin:', getMimeTypeWithCharset('data.bin')); 