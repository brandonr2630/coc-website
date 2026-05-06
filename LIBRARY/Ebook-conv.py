import json
from pdfminer.high_level import extract_text

def pdf_to_json(pdf_path):
    # Extract text from the PDF
    text = extract_text(pdf_path)

    if not text:
        raise ValueError("No text found in the PDF.")

    # Split text into lines
    lines = text.split('\n')

    # Create a basic JSON structure
    data = {
        "title": "Extracted Book",
        "author": "Unknown Author",
        "chapters": []
    }

    chapter_name = None
    current_chapter_content = []

    for line in lines:
        if line.strip() and not chapter_name:
            # Assume the first non-empty line is the title of the first chapter
            chapter_name = line.strip()
        elif line.strip():
            # If we have a chapter name, add content to the current chapter
            current_chapter_content.append(line)
        else:
            # An empty line indicates the end of a chapter or section
            if chapter_name and current_chapter_content:
                data['chapters'].append({
                    "chapter_name": chapter_name,
                    "content": "\n".join(current_chapter_content).strip()
                })
                chapter_name = None
                current_chapter_content = []

    # Add the last chapter if it exists
    if chapter_name and current_chapter_content:
        data['chapters'].append({
            "chapter_name": chapter_name,
            "content": "\n".join(current_chapter_content).strip()
        })

    return data

# Example usage
pdf_path = 'your_book.pdf'
json_data = pdf_to_json(pdf_path)

# Save the JSON to a file
with open('output.json', 'w', encoding='utf-8') as json_file:
    json.dump(json_data, json_file, ensure_ascii=False, indent=4)

print("PDF has been converted to JSON and saved as output.json")
