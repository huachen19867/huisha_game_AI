from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a contact sheet and animated WebP from deterministic VFX frames.")
    parser.add_argument("sequence", type=Path, help="Directory containing frame-*.png and manifest.json")
    parser.add_argument("--fps", type=float, default=4.0)
    parser.add_argument("--columns", type=int, default=5)
    parser.add_argument("--crop", help="Optional x,y,width,height region for a detail preview")
    parser.add_argument("--tag", default="detail", help="Output filename tag used with --crop")
    args = parser.parse_args()

    frames = sorted(args.sequence.glob("frame-*.png"))
    if not frames:
        raise SystemExit(f"No frame-*.png files found in {args.sequence}")
    if args.fps <= 0 or args.columns <= 0:
        raise SystemExit("fps and columns must be positive")

    crop_box = None
    if args.crop:
        try:
            x, y, width, height = (int(value) for value in args.crop.split(","))
        except (TypeError, ValueError):
            raise SystemExit("--crop must be x,y,width,height using integers") from None
        if min(x, y) < 0 or width <= 0 or height <= 0:
            raise SystemExit("--crop coordinates must be non-negative and its size must be positive")
        crop_box = (x, y, x + width, y + height)

    manifest_path = args.sequence / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    frame_times = [frame.get("time") for frame in manifest.get("frames", [])]

    with Image.open(frames[0]) as first_frame:
        source_width, source_height = first_frame.size
    if crop_box and (crop_box[2] > source_width or crop_box[3] > source_height):
        raise SystemExit(
            f"--crop {crop_box} exceeds source frame bounds {source_width}x{source_height}"
        )

    content_width = crop_box[2] - crop_box[0] if crop_box else source_width
    content_height = crop_box[3] - crop_box[1] if crop_box else source_height

    def fitted_size(max_width: int, max_height: int) -> tuple[int, int]:
        scale = min(max_width / content_width, max_height / content_height)
        return max(1, round(content_width * scale)), max(1, round(content_height * scale))

    thumb_size = fitted_size(400, 300)
    preview_size = fitted_size(800, 600)
    gap = 14
    label_height = 28
    rows = math.ceil(len(frames) / args.columns)
    sheet_width = gap + args.columns * (thumb_size[0] + gap)
    sheet_height = gap + rows * (thumb_size[1] + label_height + gap)
    sheet = Image.new("RGB", (sheet_width, sheet_height), "#08090b")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    animation = []

    for index, path in enumerate(frames):
        with Image.open(path) as source:
            rgb = source.convert("RGB")
            if crop_box:
                rgb = rgb.crop(crop_box)
            thumb = rgb.resize(thumb_size, Image.Resampling.LANCZOS)
            animation.append(rgb.resize(preview_size, Image.Resampling.LANCZOS))
        column = index % args.columns
        row = index // args.columns
        x = gap + column * (thumb_size[0] + gap)
        y = gap + row * (thumb_size[1] + label_height + gap)
        sheet.paste(thumb, (x, y))
        time_label = f" / {frame_times[index]:g}s" if index < len(frame_times) and frame_times[index] is not None else ""
        draw.text((x, y + thumb_size[1] + 7), f"F{index:02d}{time_label}", fill="#d7cab0", font=font)

    suffix = f"-{args.tag}" if crop_box else ""
    sheet.save(args.sequence / f"contact-sheet{suffix}.png", optimize=True)
    duration_ms = max(1, round(1000 / args.fps))
    animation[0].save(
        args.sequence / f"sequence{suffix}.webp",
        save_all=True,
        append_images=animation[1:],
        duration=duration_ms,
        loop=0,
        quality=82,
        method=6,
    )
    detail = f" for crop {args.crop}" if crop_box else ""
    print(f"Built {len(frames)}-frame contact sheet and animated WebP{detail} at {args.sequence}")


if __name__ == "__main__":
    main()
