import json
from ebooklib import epub

def create_epub_from_json(json_file_path, output_epub_path):
    # Load JSON data
    with open(json_file_path, 'r', encoding='utf-8') as json_file:
        data = json.load(json_file)

    # Create a new EPUB book
    book = epub.EpubBook()

    # Set metadata
    book.set_identifier('id123456')
    book.set_title(data.get('title', 'Unknown Title'))
    book.set_language('en')

    # Add author (if available)
    if data.get('author'):
        book.add_author(data['author'])

    # Create a list to hold chapters
    chapters = []

    # Add chapters
    for i, chapter in enumerate(data.get('chapters', []), start=1):
        chapter_title = chapter.get('chapter_name', f'Chapter {i}')
        chapter_content = chapter.get('content', '')
        
        c = epub.EpubHtml(title=chapter_title, file_name=f'chap_{i}.xhtml', lang='en')
        c.content = f'<html xmlns="http://www.w3.org/1999/xhtml"><head><title>{chapter_title}</title></head><body><h1>{chapter_title}</h1><p>{chapter_content}</p></body></html>'
        
        # Add the chapter to the book and chapters list
        book.add_item(c)
        chapters.append(c)

    # Define Table Of Contents (TOC)
    toc = tuple(chapters)

    # Define spine (order of chapters in the book)
    spine = ['nav'] + chapters

    # Create default NCX and Nav files
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())

    # Add CSS for styling
    style = 'BODY {color: white;}'
    nav_css = epub.EpubItem(uid="style_nav", file_name="style/nav.css", media_type="text/css", content=style)
    book.add_item(nav_css)

    # Write to the EPUB file
    epub.write_epub(output_epub_path, book, {})

if __name__ == '__main__':
    json_file_path = 'output.json'  # Path to your JSON file
    output_epub_path = 'ebook_output.epub'  # Desired output EPUB file path

    create_epub_from_json(json_file_path, output_epub_path)
