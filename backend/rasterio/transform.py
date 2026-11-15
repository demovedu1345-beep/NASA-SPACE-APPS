def from_bounds(west, south, east, north, width, height):
    return (east - west)/width, 0.0, west, 0.0, -(north - south)/height, north
