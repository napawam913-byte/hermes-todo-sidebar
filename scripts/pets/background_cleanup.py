"""把图像模型常见的浅色棋盘格背景转换为真实透明通道。"""

from __future__ import annotations

from collections import deque

from PIL import Image

BACKGROUND_LIGHTNESS = 218
BACKGROUND_CHROMA = 14


def to_transparent_rgba(source: Image.Image) -> Image.Image:
    """保留被角色轮廓包围的浅色细节，只移除与画布边界连通的背景。"""
    rgba = source.convert("RGBA")
    alpha = rgba.getchannel("A")
    if alpha.getextrema()[0] == 0:
        return rgba

    width, height = rgba.size
    pixels = rgba.load()
    mask = Image.new("L", rgba.size, 255)
    mask_pixels = mask.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if visited[index] or not _is_light_neutral(pixels[x, y]):
            return
        visited[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    removed = 0
    while queue:
        x, y = queue.popleft()
        mask_pixels[x, y] = 0
        removed += 1
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    if removed < width * height * 0.05:
        raise ValueError("图像没有透明通道，也未检测到可移除的浅色边界背景")
    rgba.putalpha(mask)
    return rgba


def _is_light_neutral(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, _ = pixel
    return min(red, green, blue) >= BACKGROUND_LIGHTNESS and max(red, green, blue) - min(
        red, green, blue
    ) <= BACKGROUND_CHROMA
