import os, hashlib, zipfile, shutil, logging
from xml.etree import ElementTree as ET
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.shared import Inches

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- CONFIGURATION ---
# 2. URL path your client (e.g., Flask/Django/React app) uses to access the images
# This URL is relative to the web server root.
IMAGE_URL_BASE = '/assets/extracted_images/' 
# ---------------------

# Define the namespace map for OpenXML elements
NS_MAP = {
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}


# --- 1. IMAGE HELPER FUNCTIONS ---

def get_relationships_map(doc_archive):
    """Parses document.xml.rels to map r:id to media file paths."""
    rels_map = {}
    try:
        rels_xml_data = doc_archive.read('word/_rels/document.xml.rels')
        root = ET.fromstring(rels_xml_data)
        for rel in root.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
            r_id = rel.get('Id')
            target = rel.get('Target')
            
            if target.startswith('media/'):
                # FIX: Explicitly use forward slash '/' for the internal ZIP path
                rels_map[r_id] = 'word/' + target
                
    except KeyError:
        logging.error("document.xml.rels not found in DOCX archive.")
    return rels_map


def extract_and_save_image(doc_archive, rels_map, r_id, output_dir):
    """
    Extracts an image from the ZIP archive and saves it locally.
    output_dir must be the absolute path to the 'extracted_images' folder.
    """
    media_path = rels_map.get(r_id)
    if not media_path:
        logging.warning(f"Relationship ID {r_id} not mapped to a media file.")
        return None

    try:
        image_bytes = doc_archive.read(media_path)
        
        # Use SHA1 hash for a unique, consistent filename
        hash_object = hashlib.sha1(image_bytes)
        # Extract extension using the forward slash path
        file_ext = os.path.splitext(media_path.split('/')[-1])[1].lstrip('.')
        filename = f"{hash_object.hexdigest()}.{file_ext}" 
        
        # save_path uses os.path.join because it is a local file system operation
        save_path = os.path.join(output_dir, filename)

        # Create directories and save file only if it doesn't exist
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        if not os.path.exists(save_path):
            with open(save_path, 'wb') as f:
                f.write(image_bytes)
            logging.info(f"Saved new image: {filename} at {save_path}")
        
        return f"{IMAGE_URL_BASE}{filename}"
    except Exception as e:
        logging.error(f"Failed to extract or save image from {media_path}: {e}")
        return None

def cleanup_extracted_images(root_dir):
    """
    Deletes all files within the assets/extracted_images directory, 
    but preserves the directory structure.
    
    Args:
        root_dir (str): The absolute path to the Flask application root.
    """
    if not root_dir:
        logging.warning("Cleanup called without root_dir. Skipping image cleanup.")
        return

    # 1. Define the absolute path to the directory (matches where images are saved)
    cleanup_dir = os.path.join(root_dir, 'assets', 'extracted_images')
    
    # 2. Safety Check: Only proceed if the path is confirmed to be under assets
    if 'assets' in cleanup_dir and os.path.isdir(cleanup_dir):
        
        logging.info(f"Starting cleanup of extracted images in: {cleanup_dir}")
        
        try:
            # Iterate over all items in the directory
            for item in os.listdir(cleanup_dir):
                item_path = os.path.join(cleanup_dir, item)
                
                # Ensure we only delete files, not subdirectories (though none should exist)
                if os.path.isfile(item_path):
                    os.remove(item_path)
                    
            logging.info("Successfully deleted all extracted image files.")

        except Exception as e:
            logging.error(f"Error during image cleanup in {cleanup_dir}: {e}")
    else:
        logging.error(f"Cleanup directory check failed for: {cleanup_dir}")

def get_content_sections(filepath, root_dir=None):
    """
    Reads a .docx file, extracts sections (headers, content, tables, and images), 
    and returns the data in a structured list.
    """
    
    # 1. Path Resolution and Error Check
    try:
        normalized_filepath = os.path.normpath(filepath)
        
        if root_dir:
            base_dir = root_dir
        else:
            # Fallback for testing outside Flask
            base_dir = os.path.dirname(os.path.abspath(__file__)) 

        abs_filepath = os.path.join(base_dir, normalized_filepath)
        
        if not os.path.exists(abs_filepath):
            raise FileNotFoundError(f"Document file not found at: {abs_filepath}")
            
        doc = Document(abs_filepath)
        
    except FileNotFoundError as e:
        raise
    except Exception as e:
        logging.error(f"File system or docx loading error: {e}")
        raise 
    
    # --- FIX: Define the absolute save path relative to the Flask app root ---
    if root_dir:
        # If root_dir is provided (it is the Flask app root), use it to find the assets folder.
        SAVE_DIR_ABSOLUTE = os.path.join(root_dir, 'assets', 'extracted_images')
    else:
        # If not in Flask (e.g., in __main__ test block), fallback to relative path from script dir
        SAVE_DIR_ABSOLUTE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'extracted_images')
    
    
    # --- IMAGE PREP: Extract relationships from the DOCX ZIP archive ---
    doc_archive = None 
    rels_map = {} 
    try:
        doc_archive = zipfile.ZipFile(abs_filepath, 'r')
        rels_map = get_relationships_map(doc_archive)
    except Exception as e:
        logging.error(f"Could not open DOCX as ZIP archive for image extraction: {e}")
        
    # 2. Interleave Paragraphs and Tables for Correct Ordering
    all_blocks = []
    for block in doc.element.body:
        if block.tag.endswith('}p'):
            all_blocks.append(Paragraph(block, doc))
        elif block.tag.endswith('}tbl'):
            all_blocks.append(Table(block, doc))

    # 3. Process Interleaved Blocks
    content_sections = []
    current_section = None
    
    for block in all_blocks:
        # --- Handle Paragraphs and Images ---
        if isinstance(block, Paragraph):
            paragraph = block
            header_match = paragraph.style.name.split()

            # ... (Existing header logic remains unchanged) ...
            if header_match and header_match[0] == 'Heading' and len(header_match) > 1 and header_match[-1].isdigit():
                header_level = int(header_match[-1])
                header_text = paragraph.text.strip()
                
                if current_section is not None:
                    content_sections.append(current_section)
                
                current_section = {
                    'header_level': header_level,
                    'header_text': header_text,
                    'content': ""
                }
                
            # Add content (paragraphs and embedded images) to the current section
            elif current_section is not None:
                paragraph_html = ""
                
                # 1. Collect ALL text first by iterating runs
                for run in paragraph.runs:
                    paragraph_html += run.text
                
                # 2. XML EXTRACTION: Look for drawing elements in the paragraph's raw XML
                p_element = paragraph._element
                
                # Use local-name() for XPath compatibility
                xpath_query = ".//*[local-name()='blip' and namespace-uri()='http://schemas.openxmlformats.org/drawingml/2006/main']"
                
                drawing_elements = p_element.xpath(xpath_query)
                
                for blip in drawing_elements:
                    # The image ID is stored in the r:embed attribute
                    r_id = blip.get(f"{{{NS_MAP['r']}}}embed")

                    if r_id and doc_archive:
                        # PASS THE ABSOLUTE SAVE PATH
                        image_url = extract_and_save_image(doc_archive, rels_map, r_id, SAVE_DIR_ABSOLUTE) 
                        
                        if image_url:
                            # Basic fixed size for compatibility
                            paragraph_html += f'<img src="{image_url}" style="max-width:100%; height:auto; display:block; margin: 10px 0;" alt="Document Image" />'
                            
                
                # If there's content (text or images) in the paragraph, wrap it in a <p> tag
                if paragraph_html.strip():
                    current_section['content'] += f'<p>{paragraph_html.strip()}</p>\n'


        # --- Handle Tables ---
        elif isinstance(block, Table) and current_section is not None:
            # ... (Existing table logic remains unchanged) ...
            table = block
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

    if doc_archive:
        try:
            doc_archive.close()
        except Exception:
            pass # Ignore close errors

    return content_sections


if __name__ == '__main__':
    # --- Test Execution Block ---
    
    # NOTE: The path calculation for the test block is now more complex 
    # since doc_reader.py is in a subfolder. 
    
    test_filepath = '../assets/UserManual.docx'

    test_root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    test_save_dir = os.path.join(test_root_dir, 'assets', 'extracted_images')
    os.makedirs(test_save_dir, exist_ok=True)
    logging.info(f"Test image output directory ensured: {test_save_dir}")

    print(f"\n--- Running Test on {test_filepath} ---")
    
    try:
        # Pass the calculated App Root for consistent path resolution
        test_data = get_content_sections(test_filepath, root_dir=test_root_dir) 
        print("\nSuccessfully extracted data (first 2 sections):")
        
        for i, section in enumerate(test_data[:2]):
            print(f"--- Section {i+1} ({section['header_text']}) ---")
            print(f"Level: {section['header_level']}")
            # Check for an image tag in the content
            content_preview = section['content'][:200].replace('\n', ' ')
            print(f"Content Preview: {content_preview}...")
        
        if not test_data:
            print("The document was processed, but no sections were found. Check your document formatting.")
            
    except FileNotFoundError as e:
        print(f"\nERROR: {e}")
        print(f"Please check that '{test_filepath}' exists relative to the App Root directory.")
    except Exception as e:
        print(f"\nAn unexpected error occurred during testing: {e}")