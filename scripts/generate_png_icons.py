#!/usr/bin/env python3
"""
FinZvit Native Raster Asset Generator
Converts official SVG source vector assets directly to pixel-perfect PNGs
using macOS native sips engine. Guarantees 100% fidelity between SVG and PNG.
"""

import os
import subprocess
import sys

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    public_dir = os.path.join(root_dir, 'web/public')
    favicon_svg = os.path.join(public_dir, 'favicon.svg')
    og_svg = os.path.join(public_dir, 'og-image.svg')

    if not os.path.exists(favicon_svg):
        print(f"Помилка: не знайдено {favicon_svg}")
        sys.exit(1)

    print("🎨 Генерація растрових PNG напряму з офіційних векторних SVG...")

    conversions = [
        # (src, out_name, height, width)
        (favicon_svg, 'apple-touch-icon.png', 180, 180),
        (favicon_svg, 'icon-192.png', 192, 192),
        (favicon_svg, 'icon-512.png', 512, 512),
        (og_svg, 'og-image.png', 630, 1200),
    ]

    for src, out_name, h, w in conversions:
        out_path = os.path.join(public_dir, out_name)
        cmd = [
            'sips',
            '-s', 'format', 'png',
            '-z', str(h), str(w),
            src,
            '--out', out_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Помилка при створенні {out_name}: {res.stderr}")
            sys.exit(res.returncode)
        print(f"✓ {out_name} ({w}x{h}) скомпільовано з {os.path.basename(src)}")

    print("🎉 Всі PNG ассети на 100% синхронізовані з векторними SVG!")

if __name__ == '__main__':
    main()
