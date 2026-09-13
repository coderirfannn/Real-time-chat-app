import os
from PIL import Image, ImageFilter
from collections import deque

source_path = r'C:\Users\mohdi\.gemini\antigravity-ide\brain\63f7a5e7-29ea-4f5a-89e1-e69b0cc22ef1\.user_uploaded\media_1789330543591.jpg'
assets_dir = r'c:\Users\mohdi\OneDrive\Desktop\ChatLock - Real time system\apps\mobile\assets'

img = Image.open(source_path).convert('RGB')
w, h = img.size
pixels = img.load()

# Step 1: Identify background seeds
# Checkerboard is neutral (max(R,G,B) - min(R,G,B) is small) and high brightness (R > 180, G > 180, B > 180)
def is_bg_pixel(r, g, b):
    diff = max(r, g, b) - min(r, g, b)
    avg = (r + g + b) / 3.0
    return diff < 20 and avg > 190

def is_bg_candidate(r, g, b):
    diff = max(r, g, b) - min(r, g, b)
    avg = (r + g + b) / 3.0
    return (diff < 20 and avg > 190) or (diff < 35 and avg > 185)

# BFS flood fill from all 4 boundaries + shackle loop hole
visited = [[False]*w for _ in range(h)]
queue = deque()

for x in range(w):
    r, g, b = pixels[x, 0]
    if is_bg_pixel(r, g, b):
        visited[0][x] = True
        queue.append((x, 0))
    r, g, b = pixels[x, h-1]
    if is_bg_pixel(r, g, b):
        visited[h-1][x] = True
        queue.append((x, h-1))

for y in range(h):
    r, g, b = pixels[0, y]
    if is_bg_pixel(r, g, b) and not visited[y][0]:
        visited[y][0] = True
        queue.append((0, y))
    r, g, b = pixels[w-1, y]
    if is_bg_pixel(r, g, b) and not visited[y][w-1]:
        visited[y][w-1] = True
        queue.append((w-1, y))

# Also add shackle inner loop seed to clear checkerboard inside the padlock shackle
if is_bg_pixel(*pixels[675, 290]):
    visited[290][675] = True
    queue.append((675, 290))

while queue:
    cx, cy = queue.popleft()
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        nx, ny = cx + dx, cy + dy
        if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
            r, g, b = pixels[nx, ny]
            if is_bg_candidate(r, g, b):
                visited[ny][nx] = True
                queue.append((nx, ny))

# Create transparent RGBA image
rgba = Image.new('RGBA', (w, h), (0, 0, 0, 0))
rgba_pixels = rgba.load()

# Create binary alpha mask
mask = Image.new('L', (w, h), 0)
mask_pixels = mask.load()

for y in range(h):
    for x in range(w):
        if not visited[y][x]:
            mask_pixels[x, y] = 255
            r, g, b = pixels[x, y]
            rgba_pixels[x, y] = (r, g, b, 255)

# Smooth mask edges slightly (1px gaussian blur on mask)
smooth_mask = mask.filter(ImageFilter.GaussianBlur(radius=0.8))
rgba.putalpha(smooth_mask)

# Find bounding box of the foreground object to center it
bbox = rgba.getbbox()
print(f"Foreground bounding box: {bbox}")

# Crop to tight bounding box
cropped_icon = rgba.crop(bbox)

# -------------------------------------------------------------
# 1. Adaptive Icon (1024x1024)
# Android requires the icon content to be inside a safe circle (center 66% = 675px out of 1024)
# -------------------------------------------------------------
target_safe_size = 640
cw, ch = cropped_icon.size
scale = target_safe_size / max(cw, ch)
new_w = int(cw * scale)
new_h = int(ch * scale)
resized_fg = cropped_icon.resize((new_w, new_h), Image.Resampling.LANCZOS)

adaptive_icon = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
offset_x = (1024 - new_w) // 2
offset_y = (1024 - new_h) // 2
adaptive_icon.paste(resized_fg, (offset_x, offset_y), resized_fg)

adaptive_path = os.path.join(assets_dir, 'adaptive-icon.png')
adaptive_icon.save(adaptive_path, 'PNG', optimize=True)
print(f"Saved adaptive icon to: {adaptive_path} ({os.path.getsize(adaptive_path)} bytes)")

# -------------------------------------------------------------
# 2. Main App Icon (1024x1024)
# Full bleed or nicely padded on dark navy background #0F172A
# -------------------------------------------------------------
icon_img = Image.new('RGBA', (1024, 1024), (15, 23, 42, 255)) # #0F172A
# Center the icon with 15% padding (size ~780px)
target_icon_size = 780
scale_icon = target_icon_size / max(cw, ch)
iw = int(cw * scale_icon)
ih = int(ch * scale_icon)
resized_icon = cropped_icon.resize((iw, ih), Image.Resampling.LANCZOS)
ix = (1024 - iw) // 2
iy = (1024 - ih) // 2
icon_img.paste(resized_icon, (ix, iy), resized_icon)

icon_path = os.path.join(assets_dir, 'icon.png')
icon_img.save(icon_path, 'PNG', optimize=True)
print(f"Saved app icon to: {icon_path} ({os.path.getsize(icon_path)} bytes)")

# -------------------------------------------------------------
# 3. Favicon (48x48 and 192x192)
# -------------------------------------------------------------
favicon = adaptive_icon.resize((192, 192), Image.Resampling.LANCZOS)
favicon_path = os.path.join(assets_dir, 'favicon.png')
favicon.save(favicon_path, 'PNG', optimize=True)
print(f"Saved favicon to: {favicon_path} ({os.path.getsize(favicon_path)} bytes)")

# -------------------------------------------------------------
# 4. Splash Screen (1284x2778 or 1024x1024 on dark background)
# -------------------------------------------------------------
splash_img = Image.new('RGBA', (1024, 1024), (15, 23, 42, 255))
splash_size = 400
scale_splash = splash_size / max(cw, ch)
sw = int(cw * scale_splash)
sh = int(ch * scale_splash)
resized_splash = cropped_icon.resize((sw, sh), Image.Resampling.LANCZOS)
sx = (1024 - sw) // 2
sy = (1024 - sh) // 2
splash_img.paste(resized_splash, (sx, sy), resized_splash)

splash_path = os.path.join(assets_dir, 'splash.png')
splash_img.save(splash_path, 'PNG', optimize=True)
print(f"Saved splash screen to: {splash_path} ({os.path.getsize(splash_path)} bytes)")

print("ALL ICONS GENERATED SUCCESSFULLY!")
