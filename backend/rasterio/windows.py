class Window:
    def __init__(self, col_off=0, row_off=0, width=64, height=64):
        self.col_off = col_off
        self.row_off = row_off
        self.width = width
        self.height = height

def from_bounds(left, bottom, right, top, transform):
    return Window(0, 0, 64, 64)

def transform(window, trans):
    return trans
