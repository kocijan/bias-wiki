import copy
import os
import re
import xml.etree.ElementTree as ET


def extract_language_svg(input_svg_path, language_code, output_dir):
    """
    Extract a specific language from the SVG and create a new language-specific file
    without any language attributes.
    """
    # Parse the SVG file
    tree = ET.parse(input_svg_path)
    root = tree.getroot()

    # Create a deep copy of the root to avoid modifying the original
    new_root = copy.deepcopy(root)

    # Get all namespaces
    namespaces = dict(
        [node for _, node in ET.iterparse(input_svg_path, events=["start-ns"])]
    )
    for prefix, uri in namespaces.items():
        ET.register_namespace(prefix, uri)

    # Find and remove elements with systemLanguage that doesn't match our target
    elements_to_remove = []
    for elem in new_root.findall(".//*[@systemLanguage]"):
        if elem.get("systemLanguage") != language_code:
            elements_to_remove.append(elem)

    for elem in elements_to_remove:
        parent = find_parent(new_root, elem)
        if parent is not None:
            parent.remove(elem)

    # Remove the systemLanguage attribute from remaining elements
    for elem in new_root.findall(".//*[@systemLanguage]"):
        elem.attrib.pop("systemLanguage")

    # Set the root language if it has an xml:lang attribute
    if "{http://www.w3.org/XML/1998/namespace}lang" in new_root.attrib:
        new_root.attrib["{http://www.w3.org/XML/1998/namespace}lang"] = language_code

    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    # Save the new SVG
    output_file = os.path.join(output_dir, f"cognitive_bias_codex_{language_code}.svg")

    # We need to write the file as a string to ensure proper XML declaration
    svg_string = ET.tostring(new_root, encoding="unicode")

    # Add XML declaration
    with open(output_file, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n')
        f.write(svg_string)

    return output_file


def find_parent(root, element):
    """Find the parent of an element in the tree"""
    for parent in root.iter():
        for child in list(parent):
            if child == element:
                return parent
    return None


def detect_languages(svg_path):
    """Detect all languages defined in the SVG file"""
    languages = set()

    # Use regex to find all systemLanguage attributes
    with open(svg_path, "r", encoding="utf-8") as f:
        content = f.read()
        lang_matches = re.findall(r'systemLanguage="([^"]+)"', content)
        for match in lang_matches:
            languages.add(match)

    return sorted(languages)


def main():
    # SVG input file
    input_svg = "assets/images/cognitive_bias_codex_enfr.svg"

    # Output directory
    output_dir = "assets/images"

    # Auto-detect all languages in the SVG
    languages = detect_languages(input_svg)
    print(f"Detected languages: {', '.join(languages)}")

    # Remove english if present
    if "en" in languages:
        languages.remove("en")

    # Process each language
    for lang in languages:
        print(f"Processing {lang} language...")
        output_file = extract_language_svg(input_svg, lang, output_dir)
        print(f"Created language-specific SVG: {output_file}")


if __name__ == "__main__":
    main()
