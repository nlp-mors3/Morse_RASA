import os
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
import logging

# Ensure logging is set up to see internal errors if needed
logging.basicConfig(level=logging.ERROR, format='%(asctime)s - %(levelname)s - %(message)s')

def get_content_sections(filepath, root_dir=None):
    """
    Reads a .docx file from a local path, extracts sections (headers and 
    associated content), and returns the data in a structured list.
    
    Args:
        filepath (str): The path to the document file (e.g., 'assets/NLP_IbaloiLanguage.docx').
        root_dir (str, optional): The base directory to resolve 'filepath' against. 
                                  If None, uses the current script's directory.
                                  
    Returns:
        list: A list of dictionaries, where each dict is a section.
    """
    
    # 1. Path Resolution and Error Check (CRITICAL for 500 errors)
    try:
        # Use os.path.normpath for the most robust, cross-platform path normalization
        normalized_filepath = os.path.normpath(filepath)
        
        if root_dir:
            # If a root directory is explicitly provided (e.g., Flask app root), use it.
            base_dir = root_dir
        else:
            # Otherwise, default to the directory of this script (__file__)
            base_dir = os.path.dirname(os.path.abspath(__file__))

        abs_filepath = os.path.join(base_dir, normalized_filepath)
        # --- MODIFIED LOGIC END ---
        
        if not os.path.exists(abs_filepath):
            raise FileNotFoundError(f"Document file not found at: {abs_filepath}")
            
        doc = Document(abs_filepath)
        
    except FileNotFoundError as e:
        # Re-raise File Not Found specifically
        raise
    except Exception as e:
        # Catch all other errors during file system or docx loading
        print(f"File system or docx loading error: {e}")
        # The Flask app will catch this and return the 500 error message
        raise 
    
    # 2. Interleave Paragraphs and Tables for Correct Ordering (Robust Iteration)
    all_blocks = []
    for block in doc.element.body:
        # Check if it's a paragraph or a table element and map it to the docx object
        if block.tag.endswith('}p'):
            all_blocks.append(Paragraph(block, doc))
        elif block.tag.endswith('}tbl'):
            all_blocks.append(Table(block, doc))

    # 3. Process Interleaved Blocks
    content_sections = []
    current_section = None
    
    for block in all_blocks:
        # --- Handle Paragraphs ---
        if isinstance(block, Paragraph):
            paragraph = block
            header_match = paragraph.style.name.split()

            # Check for a new Header (e.g., 'Heading 1')
            if header_match and header_match[0] == 'Heading' and len(header_match) > 1 and header_match[-1].isdigit():
                header_level = int(header_match[-1])
                header_text = paragraph.text.strip()
                
                # Close the previous section
                if current_section is not None:
                    content_sections.append(current_section)
                
                # Start a new section
                current_section = {
                    'header_level': header_level,
                    'header_text': header_text,
                    'content': "" # Changed to a string to match JS expectation
                }
                
            # Add content (paragraphs) to the current section
            elif current_section is not None and paragraph.text.strip():
                # Format paragraphs as HTML for direct insertion into the client
                current_section['content'] += f'<p>{paragraph.text}</p>\n'


        # --- Handle Tables ---
        elif isinstance(block, Table) and current_section is not None:
            table = block
            
            # Simple conversion of the table to an HTML string for the client
            table_html = '<table class="min-w-full divide-y divide-gray-200 border border-gray-300 rounded-md my-4">'
            for i, row in enumerate(table.rows):
                tag = 'th' if i == 0 else 'td'
                row_class = 'bg-gray-50' if i == 0 else 'bg-white'
                table_html += f'<tr class="{row_class} hover:bg-gray-100">'
                for cell in row.cells:
                    cell_class = 'px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider' if i == 0 else 'px-6 py-4 whitespace-nowrap text-sm text-gray-500'
                    table_html += f'<{tag} class="{cell_class} border-r border-gray-200">{cell.text}</{tag}>'
                table_html += '</tr>'
            table_html += '</table>'
            
            current_section['content'] += table_html + '\n'
            
            
    # Append the very last section
    if current_section is not None:
        content_sections.append(current_section)

    return content_sections

if __name__ == '__main__':
    # This block runs only when the file is executed directly (python doc_parser.py).
    # It is useful for quickly testing and debugging the get_content_sections function.
    
    # --------------------------------------------------------------------------------
    # NOTE: You MUST create a dummy docx file (e.g., 'test_doc.docx') 
    # and place it next to this Python script for this test to work.
    # --------------------------------------------------------------------------------
    
    # Using the exact problematic path for testing the fix:
    test_filepath = '../assets/NLP_IbaloiLanguage.docx' 
    print(f"--- Running Test on {test_filepath} ---")
    
    try:
        # Pass None for root_dir to test the default logic
        test_data = get_content_sections(test_filepath, root_dir=None) 
        print("\nSuccessfully extracted data:")
        
        # Pretty print the first two sections for a quick view
        for i, section in enumerate(test_data[:2]):
            print(f"--- Section {i+1} ({section['header_text']}) ---")
            print(f"Level: {section['header_level']}")
            # Truncate content for display
            content_preview = section['content'][:200].replace('\n', ' ')
            print(f"Content Preview: {content_preview}...")
        
        if not test_data:
            print("The document was processed, but no sections were found. Check your document formatting.")
            
    except FileNotFoundError as e:
        print(f"\nERROR: {e}")
        print("Please create the 'test_doc.docx' file or update 'test_filepath' to a valid document path to run this test.")
    except Exception as e:
        print(f"\nAn unexpected error occurred during testing: {e}")