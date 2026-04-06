"""Extract dominant colors from a logo image."""

from collections import Counter
from PIL import Image


def extract_colors_from_logo(image_path: str, num_colors: int = 8) -> dict:
    img = Image.open(image_path).convert("RGB")
    img = img.resize((150, 150), Image.LANCZOS)
    pixels = list(img.getdata())

    # Filter out near-white and near-black pixels
    filtered = [p for p in pixels if not (sum(p) > 700 or sum(p) < 60)]
    if len(filtered) < 50:
        filtered = pixels

    # Quantize to reduce noise
    quantized = [(r // 24 * 24, g // 24 * 24, b // 24 * 24) for r, g, b in filtered]
    counter = Counter(quantized)
    top = counter.most_common(num_colors)

    hex_colors = [f"#{r:02x}{g:02x}{b:02x}" for (r, g, b), _ in top]

    # Sort by darkness (good for primary) and vividness (good for accent)
    sorted_dark = sorted(top, key=lambda c: sum(c[0]))
    sorted_vivid = sorted(top, key=lambda c: max(c[0]) - min(c[0]), reverse=True)

    def to_hex(rgb_tuple):
        return f"#{rgb_tuple[0]:02x}{rgb_tuple[1]:02x}{rgb_tuple[2]:02x}"

    return {
        "all_colors": hex_colors,
        "suggested_primary": to_hex(sorted_dark[0][0]),
        "suggested_secondary": to_hex(sorted_dark[min(1, len(sorted_dark) - 1)][0]),
        "suggested_accent": to_hex(sorted_vivid[0][0]),
        "suggested_chart_colors": hex_colors[:8],
    }
