def shapes(image, mask=None, connectivity=4, transform=None):
    # Yield empty generator or single dummy polygon for fallback
    yield ({"type": "Polygon", "coordinates": [[[75.7, 12.2], [75.9, 12.2], [75.9, 12.4], [75.7, 12.4], [75.7, 12.2]]]}, 1.0)
