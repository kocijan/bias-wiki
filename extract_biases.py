import argparse
import json
import re
import urllib.parse
import xml.etree.ElementTree as ET

import requests


def parse_svg_for_biases(svg_file, num_biases=10):
    """Extract biases and their Wikipedia links from an SVG file."""
    # Load the SVG content
    with open(svg_file, "r", encoding="utf-8") as file:
        svg_content = file.read()

    # Parse the SVG content
    try:
        root = ET.fromstring(svg_content)
    except ET.ParseError as e:
        print(f"Error parsing SVG: {e}")
        return []

    # Namespace for xlink
    namespaces = {"xlink": "http://www.w3.org/1999/xlink"}

    # Extract biases and their Wikipedia links
    biases = []
    for a_tag in root.findall(".//{http://www.w3.org/2000/svg}a"):
        link = a_tag.get(f"{{{namespaces['xlink']}}}href")
        if not link:
            continue

        # Find the text element without a language tag (which is English)
        english_text = ""
        for text_element in a_tag.findall(".//{http://www.w3.org/2000/svg}text"):
            if "systemLanguage" not in text_element.attrib:
                english_text = "".join(text_element.itertext()).strip()
                break  # Found the English text, stop looking

        if english_text and link:
            biases.append((english_text, link))
            if len(biases) >= num_biases:
                break

    return biases


def fetch_wikipedia_content(article_title):
    """Fetch the lead section of a Wikipedia article."""
    # Clean the article title from the URL
    article_title = article_title.split("/wiki/")[-1]

    # API endpoint - without explaintext=true to preserve HTML
    url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&titles={article_title}&exintro=true&redirects=true"

    response = requests.get(url)
    data = response.json()

    # Extract the content
    pages = data.get("query", {}).get("pages", {})

    for page_id, page_data in pages.items():
        if "extract" in page_data:
            return page_data["extract"]

    return ""


def save_to_file(biases_with_content, output_file):
    """Save the extracted bias information to a file."""
    with open(output_file, "w", encoding="utf-8") as file:
        file.write("<html><body>\n")
        for bias_name, link, content in biases_with_content:
            file.write(f"<div class='bias'>\n")
            file.write(f"<h2>{bias_name}</h2>\n")
            file.write(f"<a href='{link}' target='_blank'>Wikipedia Link</a>\n")
            file.write(f"<div class='content'>{content}</div>\n")
            file.write(
                f"<div class='attribution'>Content from <a href='{link}'>Wikipedia</a>, licensed under <a href='https://creativecommons.org/licenses/by-sa/3.0/'>CC BY-SA 3.0</a></div>\n"
            )
            file.write("</div>\n")
        file.write("</body></html>\n")


def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Extract cognitive biases from SVG and fetch Wikipedia data."
    )
    parser.add_argument("num_biases", type=int, help="Number of biases to extract")
    parser.add_argument(
        "--svg_file",
        type=str,
        default="Cognitive_bias_codex_en.svg.txt",
        help="Path to the SVG file",
    )
    parser.add_argument(
        "--output_file", type=str, default="biases_output.html", help="Output file path"
    )

    args = parser.parse_args()

    # Parse SVG for biases
    biases = parse_svg_for_biases(args.svg_file, args.num_biases)

    print(f"Extracted {len(biases)} biases from the SVG")

    # Fetch content for each bias
    biases_with_content = []
    for bias_name, wiki_link in biases:
        title = wiki_link.split("/wiki/")[-1]
        print(f"Fetching content for {bias_name} ({title})...")
        content = fetch_wikipedia_content(wiki_link)
        biases_with_content.append((bias_name, wiki_link, content))

    # Save to file
    save_to_file(biases_with_content, args.output_file)

    print(f"Saved {len(biases_with_content)} biases to {args.output_file}")


if __name__ == "__main__":
    main()
